import webpush from "web-push";
import { getFirestoreClient } from "./firestore";
import { env } from "../lib/env";

function colSuscripciones() {
  return getFirestoreClient().collection("pushSubscriptions");
}

let vapidConfigurado = false;
function asegurarVapid() {
  if (vapidConfigurado) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas");
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigurado = true;
}

export interface PayloadNotificacion {
  title: string;
  body: string;
  url?: string;
}

interface SuscripcionGuardada {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function getSuscripcionesDeUsuarios(userIds: string[]): Promise<SuscripcionGuardada[]> {
  if (userIds.length === 0) return [];
  const db = getFirestoreClient();
  const resultados: SuscripcionGuardada[] = [];
  // Firestore "in" admite hasta 30 valores por consulta -- se trocea por si
  // en algun momento se notifica a mas usuarios de una sola vez.
  const CHUNK = 30;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const snap = await db.collection("pushSubscriptions").where("userId", "in", chunk).get();
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.endpoint && d.keys?.p256dh && d.keys?.auth) {
        resultados.push({ id: doc.id, userId: String(d.userId || ""), endpoint: d.endpoint, keys: d.keys });
      }
    });
  }
  return resultados;
}

// Envia una notificacion push a todos los dispositivos suscritos de los
// userIds indicados (userId = codigo del bombero en Listado de Personal).
// Si una suscripcion ya no es valida (dispositivo desinstalo la app,
// permiso revocado), la borra en vez de reintentarla en el futuro.
export async function enviarNotificacion(userIds: string[], payload: PayloadNotificacion): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("Push omitido: VAPID no configurado");
    return;
  }
  asegurarVapid();

  const suscripciones = await getSuscripcionesDeUsuarios(userIds);
  if (suscripciones.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    suscripciones.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
      } catch (err: any) {
        // 404/410 = la suscripcion ya no existe del lado del navegador.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await colSuscripciones().doc(sub.id).delete().catch(() => {});
        } else {
          console.error("Error enviando push a", sub.userId, err?.message || err);
        }
      }
    })
  );
}
