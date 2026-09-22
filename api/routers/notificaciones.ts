import { z } from "zod";
import { Firestore } from "@google-cloud/firestore";
import { createRouter, publicQuery, adminProcedure } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colNotificaciones, crearNotificacion } from "../services/notificacionesFirestore";
import { env } from "../lib/env";
import type { NotificacionResumen } from "@contracts/notificaciones";

const LIMITE_DEFAULT = 50;

function colSuscripciones() {
  return getFirestoreClient().collection("pushSubscriptions");
}

// Una notificacion es visible para un codigo si fue dirigida a el
// especificamente, o si es un broadcast (destinatarioCodigo === "").
// Se hacen 2 queries por separado (Firestore no permite OR entre valores
// distintos de un mismo campo sin "in") y se combinan en memoria.
async function obtenerVisiblesPara(codigo: string): Promise<NotificacionResumen[]> {
  const [propiasSnap, broadcastSnap] = await Promise.all([
    colNotificaciones().where("destinatarioCodigo", "==", codigo).get(),
    colNotificaciones().where("destinatarioCodigo", "==", "").get(),
  ]);

  const vistos = new Set<string>();
  const notificaciones: NotificacionResumen[] = [];

  for (const doc of [...propiasSnap.docs, ...broadcastSnap.docs]) {
    if (vistos.has(doc.id)) continue;
    vistos.add(doc.id);
    const fila = doc.data();
    const leidoPor: string[] = Array.isArray(fila.leidoPor) ? fila.leidoPor : [];
    notificaciones.push({
      id: doc.id,
      tipo: String(fila.tipo || "sistema"),
      titulo: String(fila.titulo || ""),
      mensaje: String(fila.mensaje || ""),
      link: String(fila.link || ""),
      fechaCreacion: String(fila.fechaCreacion || ""),
      leida: leidoPor.includes(codigo),
    });
  }

  notificaciones.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
  return notificaciones;
}

export const notificacionesRouter = createRouter({
  listar: publicQuery
    .input(z.object({ codigo: z.string().min(1), limite: z.number().min(1).max(200).optional() }))
    .query(async ({ input }) => {
      const todas = await obtenerVisiblesPara(input.codigo);
      return { exito: true as const, notificaciones: todas.slice(0, input.limite || LIMITE_DEFAULT) };
    }),

  contarNoLeidas: publicQuery
    .input(z.object({ codigo: z.string().min(1) }))
    .query(async ({ input }) => {
      const todas = await obtenerVisiblesPara(input.codigo);
      return { exito: true as const, cantidad: todas.filter((n) => !n.leida).length };
    }),

  marcarLeida: publicQuery
    .input(z.object({ id: z.string(), codigo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colNotificaciones().doc(input.id).update({
        leidoPor: Firestore.FieldValue.arrayUnion(input.codigo),
      });
      return { exito: true as const };
    }),

  marcarTodasLeidas: publicQuery
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const todas = await obtenerVisiblesPara(input.codigo);
      const noLeidas = todas.filter((n) => !n.leida);
      if (noLeidas.length === 0) return { exito: true as const };

      const batch = getFirestoreClient().batch();
      noLeidas.forEach((n) => {
        batch.update(colNotificaciones().doc(n.id), {
          leidoPor: Firestore.FieldValue.arrayUnion(input.codigo),
        });
      });
      await batch.commit();
      return { exito: true as const };
    }),

  // Anuncio manual, solo para administradores (nivel 5 o cargo DESARROLLADOR).
  // destinatarioCodigo vacio = para todos.
  enviar: adminProcedure
    .input(
      z.object({
        destinatarioCodigo: z.string().optional().or(z.literal("")),
        titulo: z.string().min(1).max(120),
        mensaje: z.string().min(1).max(1000),
        link: z.string().optional().or(z.literal("")),
        creadaPor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await crearNotificacion({
        destinatarioCodigo: input.destinatarioCodigo || "",
        tipo: "anuncio",
        titulo: input.titulo,
        mensaje: input.mensaje,
        link: input.link || "",
        creadaPor: input.creadaPor,
      });
      return { exito: true as const };
    }),

  // Clave publica VAPID que el navegador necesita para pushManager.subscribe.
  // No es secreta (viaja en cada suscripcion), pero se sirve desde el
  // servidor para no hardcodearla en el frontend.
  vapidPublicKey: publicQuery.query(() => {
    return { exito: true as const, publicKey: env.VAPID_PUBLIC_KEY };
  }),

  // Guarda o actualiza la suscripcion push de un dispositivo. Se identifica
  // por endpoint (unico por navegador/dispositivo) para poder reemplazar la
  // suscripcion si el mismo usuario vuelve a suscribirse desde el mismo
  // dispositivo (ej. permiso revocado y vuelto a otorgar).
  suscribir: publicQuery
    .input(
      z.object({
        userId: z.string().min(1),
        endpoint: z.string().min(1),
        keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
      })
    )
    .mutation(async ({ input }) => {
      const existente = await colSuscripciones().where("endpoint", "==", input.endpoint).limit(1).get();
      const data = {
        userId: input.userId,
        endpoint: input.endpoint,
        keys: input.keys,
        actualizadoEn: new Date().toISOString(),
      };
      if (!existente.empty) {
        await existente.docs[0].ref.set(data, { merge: true });
      } else {
        await colSuscripciones().add({ ...data, creadoEn: new Date().toISOString() });
      }
      return { exito: true as const };
    }),

  desuscribir: publicQuery
    .input(z.object({ endpoint: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const snap = await colSuscripciones().where("endpoint", "==", input.endpoint).get();
      if (!snap.empty) {
        const batch = getFirestoreClient().batch();
        snap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
      return { exito: true as const };
    }),
});
