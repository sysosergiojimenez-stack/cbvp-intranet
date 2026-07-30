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
