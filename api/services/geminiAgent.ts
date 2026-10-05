import { env } from "../lib/env";
import { ORGANIZACION } from "../lib/organizacion";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

const SYSTEM_PROMPT = `Sos el asistente virtual del ${ORGANIZACION.nombreCompleto} (${ORGANIZACION.nombreCorto}) en Telegram. Respondé siempre en español, de forma breve y clara (es un chat, no un documento). Usá las herramientas disponibles cuando la pregunta del usuario lo amerite. Si no tenés una herramienta para responder algo, decí honestamente que todavía no podés ayudar con eso -- nunca inventes datos. Basate SOLO en los campos que te devuelve cada herramienta, respetando exactamente lo que significa cada uno (leé bien la descripción de cada campo); nunca generes una respuesta que se contradiga a sí misma.`;

export interface AgentTool {
  name: string;
  description: string;
  parameters: object;
  ejecutar: () => Promise<unknown>;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
  thoughtSignature?: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{ content: { parts: GeminiPart[] } }>;
  error?: { message: string };
}

async function llamarGemini(contents: GeminiContent[], tools: AgentTool[]): Promise<GeminiPart[]> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const payload = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
    generationConfig: { temperature: 0.2 },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as GeminiResponse;
  if (result.error) throw new Error(`Gemini API error: ${result.error.message}`);

  const parts = result.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) throw new Error("No content in Gemini response");
  return parts;
}

// Primer intercambio: el modelo puede responder texto directo o pedir
// llamar a una tool. Si pide una tool, se ejecuta localmente y se hace un
// segundo intercambio con el resultado para obtener la respuesta final en
// lenguaje natural. codigoUsuario nunca lo decide el modelo -- cada tool ya
// viene con su propia logica de ejecucion resuelta por el backend (ver
// telegramWebhook.ts).
export async function responderComoAgente(mensajeUsuario: string, tools: AgentTool[]): Promise<string> {
  try {
    const contents: GeminiContent[] = [{ role: "user", parts: [{ text: mensajeUsuario }] }];
    const primeraRespuesta = await llamarGemini(contents, tools);

    const functionCallPart = primeraRespuesta.find((p) => p.functionCall);
    if (!functionCallPart?.functionCall) {
      const texto = primeraRespuesta.find((p) => p.text)?.text;
      return texto?.trim() || "No pude procesar tu mensaje, intenta de nuevo.";
    }

    const { name } = functionCallPart.functionCall;
    const tool = tools.find((t) => t.name === name);
    if (!tool) return "No pude procesar tu mensaje, intenta de nuevo.";

    const resultado = await tool.ejecutar();

    // Se reenvia la part de functionCall tal cual la devolvio el modelo (no
    // reconstruida), porque trae un thoughtSignature que Gemini exige
    // recibir de vuelta para mantener la continuidad del razonamiento.
    contents.push({ role: "model", parts: [functionCallPart] });
    contents.push({ role: "user", parts: [{ functionResponse: { name, response: resultado as object } }] });

    const segundaRespuesta = await llamarGemini(contents, tools);
    const textoFinal = segundaRespuesta.find((p) => p.text)?.text;
    return textoFinal?.trim() || "No pude procesar tu mensaje, intenta de nuevo.";
  } catch (err: unknown) {
    console.error("Error en responderComoAgente:", err instanceof Error ? err.message : String(err));
    return "Tuve un problema para responderte, intenta de nuevo en un momento.";
  }
}
