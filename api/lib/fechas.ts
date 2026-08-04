// Normaliza una fecha que puede venir de Google Sheets en distintos formatos
// (DD/MM/AAAA como la muestra Sheets en espanol, o ya en formato ISO
// AAAA-MM-DD) a formato ISO AAAA-MM-DD, que es el unico que aceptan los
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

  // Formato DD/MM/AAAA (el mas comun al leer Sheets en espanol)
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return "";
}

// Normaliza un campo mes/año que puede venir de Google Sheets como YYYY-MM,
// DD/MM/YYYY (cuando Sheets interpreta el valor como fecha) o numero serial
// de fecha, y lo devuelve siempre como YYYY-MM.
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
