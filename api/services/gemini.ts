import { env } from "../lib/env";

export async function extractAsistenciaData(
  base64Content: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Sos un sistema experto en leer planillas de asistencia escaneadas del Cuerpo de Bomberos Voluntarios del Paraguay (CBVP). Tu tarea es extraer TODOS los datos y devolver SOLO un JSON valido, sin explicaciones ni markdown.

=== INSTRUCCIONES DE EXTRACCION ===

## 1. ENCABEZADO (parte superior de la planilla)
Busca estos campos en la parte de arriba:

- **tipoActividad**: Es una de estas 4 opciones SIEMPRE: "PRACTICA", "CITACION", "REUNION DE Cia", "OTRO". Si dice "OTRO", busca un campo de texto adicional donde especifiquen qué es (ej: "Limpieza de cuarteles", "Mantenimiento de motobomba").
- **otroTipo**: SOLO si tipoActividad es "OTRO", aca va el texto descriptivo. Si no es OTRO, deja vacio "".
- **fechaActividad**: Fecha escrita en la planilla. Formato DD/MM/YYYY o DD-MM-YYYY. Ej: "15/03/2025".
- **inicioActividad**: Hora de inicio. Ej: "19:30".
- **finalizaActividad**: Hora de finalizacion. Ej: "21:00".
- **acargoActividad**: Nombre de la persona a cargo. Ej: "Oficial Perez".
- **detalles**: Cualquier texto en la seccion "Detalles" o "Observaciones" del encabezado. Si no hay nada, vacio.

## 2. SECCIONES DE PERSONAL

La planilla tiene 3 secciones de personal. Extrae TODAS las filas que tengan al menos nombre o codigo:

### SECCION A: BOMBEROS COMBATIENTES
Columnas tipicas: Nº | Cód. | Personal (Apellido y Nombre) | Asistencia | Observaciones

### SECCION B: BOMBEROS ACTIVOS
Misma estructura que combatientes.

### SECCION C: ASISTENCIAS ESPECIALES
Misma estructura que combatientes.

## 3. REGLAS CRITICAS PARA ASISTENCIA (la parte mas importante)

La columna ASISTENCIA tiene 3 opciones posibles. Fijate BIEN que esta marcado con una X, un tick (✓), una tilde, un circulo, o un palomita:

- "PRESENTE" → El bombero estuvo presente. Hay una marca (X, tick, circulo) junto a PRESENTE.
- "AUSENTE" → El bombero no vino. Hay una marca junto a AUSENTE y NINGUNA otra marca adicional.
- "AUSENTE CON AVISO" → El bombero no vino pero aviso. Hay una marca junto a AUSENTE y ADEMAS dice "con aviso" o "c/aviso" o hay una marca especial que indica que aviso.

REGLAS IMPORTANTES:
- NO inventes asistencia. Si no podes determinar con claridad, usa "AUSENTE".
- Si hay una marca (X, tick, circulo, palomita) en la casilla, eso indica que SI corresponde esa opcion.
- Si NO hay ninguna marca, generalmente significa que vino (PRESENTE) en planillas donde solo marcan los ausentes.
- Lee el formato de la planilla: algunas marcan los presentes, otras marcan los ausentes.

## 4. REGLAS PARA CODIGOS

- Formato tipico: "C-4852/14" (letra C, guion, numero, barra, numero).
- Extraelo exactamente como aparece escrito.
- Si no tiene codigo, deja el campo vacio "".

## 5. REGLAS PARA NOMBRES

- Extrae APELLIDO y NOMBRE tal cual estan escritos.
- Mantene las tildes: Perez, Gonzalez, Nuñez.
- Usa mayusculas y minusculas como aparecen.

## 6. REGLAS PARA OBSERVACIONES

- Extrae cualquier texto adicional: "con aviso", "licencia", "enfermo", etc.
- Si no hay observaciones, deja vacio "".

=== FORMATO DE RESPUESTA (SOLO JSON) ===

{
  "tipoActividad": "PRACTICA",
  "otroTipo": "",
  "fechaActividad": "15/03/2025",
  "inicioActividad": "19:30",
  "finalizaActividad": "21:00",
  "acargoActividad": "Oficial Juan Perez",
  "detalles": "Practica de knots y nudos",
  "combatientes": [
    {"numero":"1","codigo":"C-4852/14","nombre":"Garcia Martinez Juan","asistencia":"PRESENTE","observaciones":""},
    {"numero":"2","codigo":"C-5123/22","nombre":"Lopez Benitez Maria","asistencia":"AUSENTE","observaciones":"con aviso"}
  ],
  "activos": [
    {"numero":"1","codigo":"A-1025/18","nombre":"Fernandez Carlos","asistencia":"PRESENTE","observaciones":""}
  ],
  "especiales": [
    {"numero":"1","codigo":"E-0098/20","nombre":"Rivera Pedro","asistencia":"AUSENTE CON AVISO","observaciones":"problemas familiares"}
  ]
}

INSTRUCCION FINAL: Analiza la imagen y extrae TODOS los datos. Devolve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.`;

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
    generationConfig: {
      temperature: 0.1,
      topP: 0.1,
      topK: 1,
      responseMimeType: "application/json",
    },
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

  const prompt = `Sos un sistema experto en leer planillas de guardia escaneadas del Cuerpo de Bomberos Voluntarios del Paraguay (CBVP). Tu tarea es extraer TODOS los datos y devolver SOLO un JSON valido, sin explicaciones ni markdown.

=== INSTRUCCIONES DE EXTRACCION ===

## 1. ENCABEZADO (parte superior)
- **compania**: Nombre de la compañia. Ej: "20ma. Compañia Mercado 4".
- **grupo**: Grupo de guardia. Ej: "GRUPO 1", "GRUPO A".
- **fechaGuardia**: Fecha. Formato DD/MM/YYYY.
- **tipoGuardia**: Tipo de guardia. Ej: "NORMAL", "ESPECIAL", "DE DIA", "NOCTURNA".

## 2. GUARDIA NORMAL
Columnas: Nº | Cód. | Personal | Asignación | Asistencia
Extrae TODAS las filas que tengan nombre o codigo.

## 3. GUARDIAS ESPECIALES
Columnas: Nº | Cód. | Personal | Asignación
Extrae filas con datos.

## 4. REFUERZOS
Columnas: Nº | Cód. | Personal | Asignación
Extrae filas con datos.

## 5. RADIO OPERADORES
Columnas: Cód. | Personal | Alfa | K20
Extrae filas con datos.

## 6. MOVILES
Columnas: Cód. | Situación | Kilometraje (formato XX:XX)
Extrae filas con datos.

## 7. FIRMAS Y OTROS
- **novedades**: Texto de la seccion Novedades.
- **inicioGuardia**: Hora de inicio.
- **finalizaGuardia**: Hora de finalizacion.
- **directorSem**: Nombre del Director de Semana.
- **comandanteSemana**: Nombre del Comandante de Semana.
- **oficialK20**: Nombre del Oficial K20.

## 8. REGLAS CRITICAS PARA ASISTENCIA

En la columna ASISTENCIA de GUARDIA NORMAL hay 4 opciones posibles. Fijate BIEN que esta marcada con X, tick, circulo o palomita:

- "PRESENTE" → Hay marca junto a PRESENTE. El bombero vino.
- "ACACR" → Ausente con Aviso Con Reemplazo. Hay marca junto a ACACR.
- "ACASR" → Ausente Con Aviso Sin Reemplazo. Hay marca junto a ACASR.
- "ASASR" → Ausente Sin Aviso Sin Reemplazo. Hay marca junto a ASASR.

REGLAS IMPORTANTES:
- Copia EXACTAMENTE la opcion marcada. NO inventes ni simplifiques.
- NO uses "AUSENTE" como valor generico.
- Si no podes determinar con claridad, usa "PRESENTE" (es lo mas comun).
- Si NO hay ninguna marca en la columna asistencia, probablemente es "PRESENTE".

## 9. REGLAS GENERALES
- Extrae codigos exactamente como aparecen: "C-4852/14", "AB-202".
- Extrae nombres tal cual: "Garcia Martinez Juan".
- Extrae kilometraje en formato HH:MM (ej: "10:77").
- Si un campo esta vacio, usa string vacio "".

=== FORMATO DE RESPUESTA (SOLO JSON) ===

{
  "compania": "20ma. Compañia Mercado 4",
  "grupo": "GRUPO 1",
  "fechaGuardia": "15/03/2025",
  "tipoGuardia": "NORMAL",
  "personal": [
    {"numero":"1","codigo":"C-9876/22","nombre":"Garcia Martinez Juan","asignacion":"MOTO BOMBA","asistencia":"PRESENTE"}
  ],
  "guardiasEspeciales": [],
  "refuerzos": [],
  "radioOperadores": [],
  "moviles": [{"codigo":"AB-202","situacion":"Operativa","kilometraje":"10:77"}],
  "novedades": "",
  "inicioGuardia": "19:00",
  "finalizaGuardia": "07:00",
  "directorSem": "",
  "comandanteSemana": "",
  "oficialK20": ""
}

INSTRUCCION FINAL: Analiza la imagen y extrae TODOS los datos. Devolve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.`;

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
    generationConfig: {
      temperature: 0.1,
      topP: 0.1,
      topK: 1,
      responseMimeType: "application/json",
    },
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
