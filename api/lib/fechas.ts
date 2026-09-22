// Normaliza una fecha que puede venir en distintos formatos (DD/MM/AAAA,
// el mas comun en datos migrados o ingresados en espanol, o ya en formato
// ISO AAAA-MM-DD) a formato ISO AAAA-MM-DD, que es el unico que aceptan los
// <input type="date"> del navegador y el que usamos para calculos internos.
// Devuelve "" si no se puede interpretar.

export function normalizarFechaISO(valor: string): string {
  if (!valor) return "";
  const v = valor.trim();

  // Ya viene en formato ISO (AAAA-MM-DD), con o sin hora
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Formato DD/MM/AAAA (el mas comun en espanol)
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return "";
}

// Normaliza un campo mes/año que puede venir como YYYY-MM, DD/MM/YYYY
// (formato fecha) o numero serial de fecha estilo Sheets/Excel (dato
// legado de la migracion), y lo devuelve siempre como YYYY-MM.
export function normalizarMesAnio(valor: string): string {
  if (!valor) return "";
  const v = valor.trim();

  // Ya viene en formato YYYY-MM
  const isoMatch = v.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  // Formato DD/MM/AAAA
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, , mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}`;
  }

  // Numero serial de Google Sheets (fecha)
  const serial = parseFloat(v);
  if (!isNaN(serial) && serial > 30000 && serial < 60000) {
    const epoch = new Date(1899, 11, 30);
    const fecha = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  }

  return "";
}

// Fecha de planilla de asistencia: se guarda y se compara siempre como
// DD/MM/AAAA. Gemini o la carga manual pueden traer guiones, puntos,
// ISO o anio de 2 digitos -- se unifica aca y si no se reconoce se deja
// el texto original.
export function normalizarFechaDDMMYYYY(valor: string): string {
  const v = valor.trim();
  if (!v) return "";

  const conSeparador = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (conSeparador) {
    const [, d, m, y] = conSeparador;
    const anio = y.length === 2 ? `20${y}` : y;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${anio}`;
  }

  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  return v;
}

// Tipo de actividad de Practicas y Citaciones: sin tildes, en el catalogo
// fijo (PRACTICA / CITACION / REUNION DE Cia / OTRO), para que
// tipo.includes("PRACTICA") del informe mensual no falle con "PRÁCTICA".
export function normalizarTipoActividad(valor: string): string {
  const raw = valor.trim();
  if (!raw) return "";
  const upper = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (upper.startsWith("PRACTICA")) return "PRACTICA";
  if (upper.startsWith("CITACION")) return "CITACION";
  if (upper.includes("REUNION")) return "REUNION DE Cia";
  if (upper.startsWith("OTRO")) {
    const detalle = raw.replace(/^otro\s*:?\s*/i, "").trim();
    return detalle && !/^otro$/i.test(detalle) ? `OTRO: ${detalle}` : "OTRO";
  }
  return upper;
}
