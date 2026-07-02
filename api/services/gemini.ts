import { env } from "../lib/env";

export async function extractAsistenciaData(
  base64Content: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Analiza esta planilla de asistencia del Cuerpo de Bomberos Voluntarios del Paraguay y extrae TODOS los datos en formato JSON.

ESTRUCTURA:
- Encabezado: Tipo de Actividad (PRACTICA, CITACION, REUNION DE Cia, OTRO), Fecha, Lugar/Inicio, Finaliza, A Cargo, Detalles
- BOMBEROS COMBATIENTES: Nº, Cód., Personal, Asistencia, Observaciones
- BOMBEROS ACTIVOS: Nº, Cód., Personal, Asistencia, Observaciones
- ASISTENCIAS ESPECIALES: Nº, Cód., Personal, Asistencia, Observaciones

REGLAS IMPORTANTES:
- Si TIPO es OTRO, extrae tambien el campo otroTipo con el texto especificado
- ASISTENCIA tiene 3 opciones: PRESENTE (marcado), AUSENTE (no marcado), AUSENTE CON AVISO (marcado ausente con nota de aviso)
- Copia EXACTAMENTE la opcion que este marcada. NO inventes.
- Extrae CADA bombero de CADA seccion.
- El formato de codigo es tipo "C-4852/14".

RESPONDE SOLO JSON:

{
  "tipoActividad": "PRACTICA|CITACION|REUNION DE Cia|OTRO",
  "otroTipo": "",
  "fechaActividad": "",
  "inicioActividad": "",
  "finalizaActividad": "",
  "acargoActividad": "",
  "detalles": "",
  "combatientes": [{"numero":"1","codigo":"C-4852/14","nombre":"Juan Perez","asistencia":"PRESENTE","observaciones":""}],
  "activos": [{"numero":"1","codigo":"","nombre":"","asistencia":"PRESENTE","observaciones":""}],
  "especiales": [{"numero":"1","codigo":"","nombre":"","asistencia":"PRESENTE","observaciones":""}]
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt } as GeminiPart,
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Content,
            },
          } as unknown as GeminiPart,
        ],
      },
    ],
  };

  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as GeminiResponse;

  if (result.error) {
    throw new Error(`Gemini API error: ${result.error.message}`);
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No content in Gemini response");
  }

  const jsonClean = text.replace(/```json\s*|```\s*|```/g, "").trim();
  try {
    return JSON.parse(jsonClean) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  error?: { message: string };
}

export async function extractGuardiaData(
  base64Content: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Analiza esta planilla de guardias del Cuerpo de Bomberos Voluntarios del Paraguay y extrae TODOS los datos en formato JSON.

ESTRUCTURA:
- Encabezado: Compañía, Grupo, Fecha, Tipo de Guardia
- GUARDIA NORMAL: Nº, Cód., Personal, Asignación, Asistencia
- GUARDIAS ESPECIALES: Nº, Cód., Personal, Asignación
- REFUERZOS: Nº, Cód., Personal, Asignación
- RADIO OPERADORES: Cód., Personal, Alfa, K20
- MOVILES: Cód., Situación, Kilometraje (XX:XX)
- NOVEDADES, Inicio/Fin Guardia, Firmas

REGLAS IMPORTANTES PARA ASISTENCIA:
- En la columna ASISTENCIA de GUARDIA NORMAL hay 4 opciones posibles: PRESENTE, ACACR, ACASR, ASASR
- Copia EXACTAMENTE la opción que esté marcada con tick/check. NO inventes ni simplifiques.
- Si está marcado PRESENTE → escribe "PRESENTE"
- Si está marcado ACACR → escribe "ACACR"
- Si está marcado ACASR → escribe "ACASR"
- Si está marcado ASASR → escribe "ASASR"
- NO uses "AUSENTE" como valor genérico. Siempre copia exactamente lo que dice la planilla.

RESPONDE SOLO JSON:

{
  "compania": "...", "grupo": "...", "fechaGuardia": "...", "tipoGuardia": "...",
  "personal": [{"numero":"1","codigo":"C-9876/22","nombre":"...","asignacion":"...","asistencia":"PRESENTE"}],
  "guardiasEspeciales": [{"numero":"1","codigo":"","nombre":"","asignacion":""}],
  "refuerzos": [{"numero":"1","codigo":"","nombre":"","asignacion":""}],
  "radioOperadores": [{"codigo":"","nombre":"","alfa":"","k20":""}],
  "moviles": [{"codigo":"AB-202","situacion":"","kilometraje":"10:77"}],
  "novedades": "", "inicioGuardia": "", "finalizaGuardia": "",
  "directorSem": "", "comandanteSemana": "", "oficialK20": ""
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt } as GeminiPart,
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Content,
            },
          } as unknown as GeminiPart,
        ],
      },
    ],
  };

  const url = `${GEMINI_API_URL}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as GeminiResponse;

  if (result.error) {
    throw new Error(`Gemini API error: ${result.error.message}`);
  }

  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No content in Gemini response");
  }

  const jsonClean = text.replace(/```json\s*|```\s*|```/g, "").trim();
  try {
    return JSON.parse(jsonClean) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse Gemini response as JSON");
  }
}
