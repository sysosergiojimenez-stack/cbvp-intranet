import { sendTelegramMessage, consumirCodigoVinculacion, obtenerCodigoUsuarioPorChatId } from "./services/telegram";
import { obtenerEstadoGuardiaHoy } from "./routers/rolesGuardia";
import { responderComoAgente, type AgentTool } from "./services/geminiAgent";

interface TelegramUpdate {
  message?: {
    chat: { id: number | string };
    text?: string;
  };
}

// Herramientas que el agente de IA puede invocar. El codigoUsuario nunca lo
// decide el modelo -- ya viene resuelto por chatId antes de armar esta
// lista, asi que cada tool solo expone lo necesario para responder.
function construirTools(codigoUsuario: string): AgentTool[] {
  return [
    {
      name: "consultar_guardia_hoy",
      description: "Devuelve si HOY es dia de guardia para el bombero que escribe (campo tieneGuardiaHoy). El campo nombreGrupo indica el grupo de guardia AL QUE PERTENECE el bombero (no necesariamente el que esta de turno hoy) -- no lo uses para decir que grupo tiene guardia hoy, solo para identificar de que grupo es. El campo radial es su codigo radial personal, si tiene.",
      parameters: { type: "object", properties: {}, required: [] },
      ejecutar: () => obtenerEstadoGuardiaHoy(codigoUsuario),
    },
  ];
}

// Despacha un Update de Telegram. /start y /vincular son flujos de
// seguridad y se manejan con match exacto; cualquier otro mensaje pasa por
// el agente de IA, que decide si necesita alguna de las tools de arriba.
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
    await sendTelegramMessage(chatId, "Cuenta vinculada correctamente. Ya podés preguntarme lo que necesites.");
    return;
  }

  const codigoUsuario = await obtenerCodigoUsuarioPorChatId(chatId);
  if (!codigoUsuario) {
    await sendTelegramMessage(chatId, "Primero vinculá tu cuenta con /vincular <código> (generalo desde la app).");
    return;
  }

  const respuesta = await responderComoAgente(texto, construirTools(codigoUsuario));
  await sendTelegramMessage(chatId, respuesta);
}
