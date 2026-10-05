import { sendTelegramMessage, consumirCodigoVinculacion, obtenerCodigoUsuarioPorChatId } from "./services/telegram";
import { obtenerEstadoGuardiaHoy } from "./routers/rolesGuardia";

interface TelegramUpdate {
  message?: {
    chat: { id: number | string };
    text?: string;
  };
}

// Despacha un Update de Telegram por texto del mensaje. Cada comando nuevo
// (ademas de /start, /vincular, /guardia) se agrega acá como un nuevo caso.
export async function handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;
  const chatId = String(message.chat.id);
  const texto = message.text.trim();

  if (texto === "/start") {
    await sendTelegramMessage(
      chatId,
      "Hola! Para vincular tu cuenta de cbvp-intranet, generá un código desde la app (Configuración > Vincular Telegram) y enviame /vincular <código>."
    );
    return;
  }

  if (texto.startsWith("/vincular")) {
    const codigo = texto.replace("/vincular", "").trim();
    if (!codigo) {
      await sendTelegramMessage(chatId, "Usá: /vincular <código> (generalo desde la app).");
      return;
    }
    const resultado = await consumirCodigoVinculacion(codigo, chatId);
    if (!resultado.exito) {
      await sendTelegramMessage(chatId, `No se pudo vincular: ${resultado.error}`);
      return;
    }
    await sendTelegramMessage(chatId, "Cuenta vinculada correctamente. Ya podés usar /guardia.");
    return;
  }

  if (texto === "/guardia") {
    const codigoUsuario = await obtenerCodigoUsuarioPorChatId(chatId);
    if (!codigoUsuario) {
      await sendTelegramMessage(chatId, "Primero vinculá tu cuenta con /vincular <código> (generalo desde la app).");
      return;
    }
    const estado = await obtenerEstadoGuardiaHoy(codigoUsuario);
    if (!estado.exito) {
      await sendTelegramMessage(chatId, estado.error);
      return;
    }
    const mensaje = estado.tieneGuardiaHoy
      ? `Hoy te toca guardia${estado.nombreGrupo ? ` (${estado.nombreGrupo})` : ""}.${estado.radial ? ` Radial: ${estado.radial}.` : ""}`
      : `Hoy no te toca guardia${estado.nombreGrupo ? ` (grupo ${estado.nombreGrupo})` : ""}.`;
    await sendTelegramMessage(chatId, mensaje);
    return;
  }

  await sendTelegramMessage(chatId, "No entendí ese comando. Probá /guardia o /vincular <código>.");
}
