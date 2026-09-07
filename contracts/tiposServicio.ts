export const TIPOS_SERVICIO_VALIDOS = [
  "10:28 RETIRO ALIMENTOS",
  "10:33 RECARGA DE AGUA",
  "10:34 CARG COMBUSTIBLE",
  "10:40 EDIFICIO",
  "10:40 VIVIENDA",
  "10:40 PASTIZAL",
  "10:40 BASURAL",
  "10:40 DEPOSITO",
  "10:40 LOCAL COMERCIAL",
  "10:40 VEHICULAR",
  "10:41 ARROLLAMIENTO",
  "10:41 MOTOCICLISTA",
  "10:41 VEHICULAR",
  "10:42 PERSONAS/OTROS",
  "10:43 RESCATE ANIMAL",
  "10:43 TALLER",
  "10:43 SERVICIOS VARIOS",
  "10:43 COBERTURAS Y GESTION ADMINISTRATIVA",
  "10:44 VERIF. DE PACIENTE",
  "10:51 ASISTENCIAS",
  "10:53 INTENTO SUICIDIO",
  "10:55 FUGA DE GAS",
  "10:56 DERRAME COMBUST.",
  "10:57 DERRUMBE",
  "10:58 AMENAZA DE BOMBA",
] as const;

export type TipoServicioValido = (typeof TIPOS_SERVICIO_VALIDOS)[number];

export function normalizarTipoServicio(valor: string): TipoServicioValido | "" {
  const v = valor.trim().toUpperCase().replace(/\s+/g, " ");
  if (!v) return "";

  const exacto = TIPOS_SERVICIO_VALIDOS.find(t => t === v);
  if (exacto) return exacto;

  const codigo = v.match(/\d{2}:\d{2}/)?.[0];
  const etiqueta = v.replace(/\d{2}:\d{2}\s*/, "").trim();

  const candidatos = TIPOS_SERVICIO_VALIDOS.filter(t => {
    const etiquetaCatalogo = t.replace(/^\d{2}:\d{2}\s*/, "");
    return etiquetaCatalogo === etiqueta || etiquetaCatalogo.includes(etiqueta) || etiqueta.includes(etiquetaCatalogo);
  });

  if (codigo) {
    const porCodigo = candidatos.filter(t => t.startsWith(codigo));
    if (porCodigo.length === 1) return porCodigo[0];
  }

  if (candidatos.length === 1) return candidatos[0];

  return "";
}
