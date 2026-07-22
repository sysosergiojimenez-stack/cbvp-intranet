import { env } from "../lib/env";
import { ORGANIZACION } from "../lib/organizacion";

export async function extractAsistenciaData(
  images: Array<{ base64Content: string; mimeType: string }>
): Promise<Record<string, unknown>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Sos un sistema experto en leer planillas de asistencia escaneadas del ${ORGANIZACION.nombreCompleto} (${ORGANIZACION.nombreCorto}). Puede que se te envien VARIAS imagenes que corresponden a distintas paginas o secciones de la MISMA planilla (por ejemplo, una pagina con combatientes y otra con activos). Analiza TODAS las imagenes en conjunto y combina los datos en un unico resultado, sin duplicar personas que aparezcan repetidas en mas de una imagen. Tu tarea es extraer TODOS los datos y devolver SOLO un JSON valido, sin explicaciones ni markdown.

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

La asistencia se determina por la columna FIRMA y la columna OBSERVACIONES. Fijate BIEN en cada fila:

- "PRESENTE" → El bombero estuvo presente. La columna FIRMA esta firmada (tiene una firma escrita).
- "AUSENTE" → El bombero no vino. NO hay firma en la columna FIRMA y en la columna OBSERVACIONES no dice nada o esta vacia.
- "COMISIONADO" → El bombero esta comisionado a otra dependencia del ${ORGANIZACION.nombreCorto} y esta exento de practicas y citaciones en esta Compañia. NO hay firma en la columna FIRMA y en la columna OBSERVACIONES esta escrita la palabra "COMISIONADO" o "COMISIONADA".

REGLAS IMPORTANTES:
- NO inventes asistencia. Si no podes determinar con claridad, usa "AUSENTE".
- Si la columna FIRMA tiene una firma escrita → "PRESENTE".
- Si NO hay firma y NO hay texto "COMISIONADO/COMISIONADA" en observaciones → "AUSENTE".
- Si NO hay firma Y en observaciones dice "COMISIONADO" o "COMISIONADA" → "COMISIONADO".

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
    {"numero":"1","codigo":"E-0098/20","nombre":"Rivera Pedro","asistencia":"COMISIONADO","observaciones":"COMISIONADO"}
  ]
}

INSTRUCCION FINAL: Analiza la imagen y extrae TODOS los datos. Devolve SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.`;

  const parts: GeminiPart[] = [{ text: prompt } as GeminiPart];
  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64Content,
      },
    } as unknown as GeminiPart);
  }

  const payload = {
    contents: [
      {
        parts,
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

  const prompt = `Sos un sistema experto en leer planillas de guardia escaneadas del ${ORGANIZACION.nombreCompleto} (${ORGANIZACION.nombreCorto}). Tu tarea es extraer TODOS los datos y devolver SOLO un JSON valido, sin explicaciones ni markdown.

=== INSTRUCCIONES DE EXTRACCION ===

## 1. ENCABEZADO (parte superior)
- **grupo**: Numero de grupo, escrito junto a "GRUPO N". Ej: "GRUPO 1".
- **fechaGuardia**: Fecha escrita a mano en el recuadro "FECHA". Formato DD/MM/YYYY.

## 2. GUARDIA NORMAL
Tabla con columnas: N | Cod. | Personal | Asignacion | HORARIO (Entrada, Salida) | FIRMA | REEMPLAZANTE (Cod., Personal)

Para cada fila con nombre o codigo, extrae:
- numero, codigo, nombre, asignacion
- entrada: hora de entrada escrita en la columna HORARIO. Si dice "-:-" o esta en blanco, usa "".
- salida: hora de salida. Si dice "-:-" o esta en blanco, usa "".
- reemplazanteCodigo: codigo escrito en la columna REEMPLAZANTE > Cod. Si esta vacio, usa "".
- reemplazanteNombre: nombre escrito en la columna REEMPLAZANTE > Personal. Si esta vacio, usa "".

### REGLA CRITICA PARA ASISTENCIA (GUARDIA NORMAL):
- Si la fila tiene Entrada Y Salida completas (con hora real, no "-:-") Y hay una firma escrita en la columna FIRMA -> "PRESENTE".
- Si la fila NO tiene entrada/salida completas (vacia o "-:-") Y la columna REEMPLAZANTE tiene codigo o nombre cargado -> "AUSENTE CON REEMPLAZO".
- Si la fila NO tiene entrada/salida completas Y la columna REEMPLAZANTE esta vacia -> "AUSENTE".
- NO inventes datos. Si el horario esta vacio o son solo guiones "-:-" o "_:-", consideralo vacio.

## 3. GUARDIAS ESPECIALES
Tabla con columnas: N | Cod | Personal | Asignacion | ENTRADA | SALIDA | FIRMA
Extrae TODAS las filas que tengan nombre o codigo: numero, codigo, nombre, asignacion, entrada, salida (mismo criterio que arriba, "" si esta vacio o son guiones).

## 4. REFUERZOS
Tabla con columnas: N | Cod | Personal | Asignacion | Firma
Extrae filas con datos: numero, codigo, nombre, asignacion.

## 5. MOVILES
Tabla con columnas: Cod | Situacion | Kilometraje Inicial
La columna Situacion tiene 3 codigos de radio pre-impresos con checkbox al lado: "10:77", "10:78", "10:79". Fijate cual esta tildado/marcado con una X o check.
Para cada movil con datos, extrae:
- codigo: codigo del movil (ej: "AB-202").
- situacion: el codigo que esta marcado con checkbox (ej: "10:78"). Si ninguno esta marcado, usa "".
- kilometraje: el numero escrito en la columna "Kilometraje Inicial" (ej: "73.696"). Extraelo tal cual esta escrito.

## 6. NOVEDADES Y PIE DE PLANILLA
- **novedades**: Texto escrito en la seccion "NOVEDADES DE LA GUARDIA" / "Obs.". Si no hay nada, deja vacio "".
- **inicioGuardia**: Hora junto a "Inicio la Guardia". Formato HH:MM.
- **finalizaGuardia**: Hora junto a "Finaliza la Guardia". Formato HH:MM.
- **directorSem**: Codigo o texto junto a "Director de Semana". Ej: "C-1".
- **comandanteSemana**: Codigo o texto junto a "Comandante de Semana". Ej: "A-8".
- **oficialK20**: Codigo o texto junto a "Oficial K20". Ej: "C201".
- **radioOperadoresAlfa**: Nombres escritos junto a "Radio Operadores ALFA". Si hay varios, separalos con coma. Ej: "Veronica, Lugo".

## 7. REGLAS GENERALES
- Extrae codigos exactamente como aparecen escritos: "C-4852/14", "AB-202".
- Extrae nombres tal cual estan escritos, manteniendo tildes y mayusculas/minusculas.
- Si un campo esta vacio o no lo podes leer con claridad, usa string vacio "".
- NO inventes datos que no esten en la imagen.

=== FORMATO DE RESPUESTA (SOLO JSON) ===

{
  "grupo": "GRUPO 1",
  "fechaGuardia": "06/07/2026",
  "personal": [
    {"numero":"1","codigo":"C-2009/05","nombre":"Capitan Mayor BVC Carlos Cespedes","asignacion":"A cargo / Conductor","entrada":"22:00","salida":"06:00","asistencia":"PRESENTE","reemplazanteCodigo":"","reemplazanteNombre":""},
    {"numero":"2","codigo":"C-4763/14","nombre":"BVC Julio Peralta","asignacion":"Combatiente / Conductor","entrada":"","salida":"","asistencia":"AUSENTE","reemplazanteCodigo":"","reemplazanteNombre":""}
  ],
  "guardiasEspeciales": [
    {"numero":"1","codigo":"","nombre":"","asignacion":"","entrada":"","salida":""}
  ],
  "refuerzos": [
    {"numero":"1","codigo":"C4852","nombre":"BVC Sergio Jimenez","asignacion":"Combatiente"}
  ],
  "moviles": [
    {"codigo":"AB-202","situacion":"10:78","kilometraje":"73.696"}
  ],
  "novedades": "Se cargo combustible por valor de 30.000 gs.",
  "inicioGuardia": "22:00",
  "finalizaGuardia": "06:00",
  "directorSem": "C-1",
  "comandanteSemana": "A-8",
  "oficialK20": "C201",
  "radioOperadoresAlfa": "Veronica, Lugo"
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

export async function extractSalidaMovilData(
  images: Array<{ base64Content: string; mimeType: string }>
): Promise<Record<string, unknown>> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  const prompt = `Sos un sistema experto en leer planillas de "Registro de Salidas de Moviles" del ${ORGANIZACION.nombreCompleto} (${ORGANIZACION.nombreCorto}). La planilla puede contener VARIAS paginas o imagenes; analiza TODAS en conjunto, sin duplicar registros que aparezcan repetidos.

La planilla tiene hasta 5 registros numerados (1 a 5), cada uno correspondiente a un movil distinto. No todos los registros estan necesariamente llenos - ignora completamente los que no tengan ningun dato escrito.

Para cada registro numerado CON DATOS, extrae:
- movil: codigo o nombre del movil, escrito junto a "MOVIL:"
- conductor: texto escrito junto a "10:30:" (codigo de radio que significa "conductor")
- oficialACargo: texto escrito junto a "10:31:" (codigo de radio que significa "oficial o a cargo")
- nroTripulantes: numero escrito junto a "10:32:" (codigo de radio que significa "numero de tripulantes")
- tipoServicio: texto escrito junto a "TIPO DE SERVICIO:"
- fechaSalida: fecha en la fila "DATOS DE SALIDA", columna FECHA. Formato DD/MM/YYYY.
- horaSalida: hora en la fila "DATOS DE SALIDA", columna HORA.
- kilometrajeSalida: numero en la fila "DATOS DE SALIDA", columna KILOMETRAJE.
- direccion: texto en la fila "DATOS DE SALIDA", columna DIRECCION.
- fechaLlegada: fecha en la fila "DATOS DE LLEGADA", columna FECHA. Formato DD/MM/YYYY.
- horaLlegada: hora en la fila "DATOS DE LLEGADA", columna HORA.
- kilometrajeLlegada: numero en la fila "DATOS DE LLEGADA", columna KILOMETRAJE.

Si un campo esta vacio o no es legible, usa string vacio "". NO inventes datos.

Responde UNICAMENTE en formato JSON con esta estructura exacta:

{
  "registros": [
    {
      "movil": "AB-202",
      "conductor": "C-4852/14",
      "oficialACargo": "C-2009/05",
      "nroTripulantes": "3",
      "tipoServicio": "Traslado",
      "fechaSalida": "15/03/2026",
      "horaSalida": "10:30",
      "kilometrajeSalida": "73696",
      "direccion": "Av. Mariscal Lopez y Brasil",
      "fechaLlegada": "15/03/2026",
      "horaLlegada": "11:15",
      "kilometrajeLlegada": "73710"
    }
  ]
}

INSTRUCCION FINAL: Analiza todas las imagenes, extrae SOLO los registros numerados que tengan datos escritos, y devolve UNICAMENTE el JSON, sin texto adicional, sin markdown, sin explicaciones.`;

  const parts: GeminiPart[] = [{ text: prompt } as GeminiPart];
  for (const img of images) {
    parts.push({
      inline_data: {
        mime_type: img.mimeType,
        data: img.base64Content,
      },
    } as unknown as GeminiPart);
  }

  const payload = {
    contents: [
      {
        parts,
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
