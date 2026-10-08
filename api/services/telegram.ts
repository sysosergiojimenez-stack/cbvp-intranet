import { getFirestoreClient } from "./firestore";
import { env } from "../lib/env";

function colVinculaciones() {
  return getFirestoreClient().collection("telegramVinculaciones");
}

function colCodigosVinculacion() {
  return getFirestoreClient().collection("telegramCodigosVinculacion");
}

const MINUTOS_EXPIRACION_CODIGO = 10;

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN no configurado");
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    throw new Error(`Error enviando mensaje de Telegram: ${resp.status} ${detalle}`);
  }
}

// Codigo de 6 digitos para vincular una cuenta de cbvp-intranet (ya logueada
// via Basic auth) con un chat de Telegram. El usuario lo pide desde la app y
// lo envia al bot con /vincular <codigo>.
export async function generarCodigoVinculacion(codigoUsuario: string): Promise<string> {
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEn = Date.now() + MINUTOS_EXPIRACION_CODIGO * 60 * 1000;
  await colCodigosVinculacion().doc(codigo).set({ codigoUsuario, expiraEn });
  return codigo;
}

export async function consumirCodigoVinculacion(codigo: string, chatId: string): Promise<
  { exito: true; codigoUsuario: string } | { exito: false; error: string }
> {
  const ref = colCodigosVinculacion().doc(codigo.trim());
  const doc = await ref.get();
  if (!doc.exists) return { exito: false, error: "Codigo invalido o ya usado" };

  const { codigoUsuario, expiraEn } = doc.data() as { codigoUsuario: string; expiraEn: number };
  await ref.delete();
  if (Date.now() > expiraEn) return { exito: false, error: "El codigo expiro, generá uno nuevo desde la app" };

  await colVinculaciones().doc(chatId).set({ codigoUsuario, vinculadoEn: Date.now() });
  return { exito: true, codigoUsuario };
}

export async function obtenerCodigoUsuarioPorChatId(chatId: string): Promise<string | null> {
  const doc = await colVinculaciones().doc(chatId).get();
  if (!doc.exists) return null;
  return String(doc.data()?.codigoUsuario || "") || null;
}

// Usado cuando se quiera avisar por Telegram a todos los chats vinculados
// (ej. alertas), en paralelo al envio existente de Web Push.
export async function obtenerTodosLosChatIds(): Promise<string[]> {
  const snapshot = await colVinculaciones().get();
  return snapshot.docs.map((d) => d.id);
}
