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

// Formatea un timestamp ISO como tiempo relativo ("hace 5 min", "hace 2 h",
// "ayer", "12/03/2027") para las notificaciones -- exacto solo importa en
// los primeros minutos, despues alcanza con una nocion aproximada.
export function formatearTiempoRelativo(iso: string): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return "";

  const ahora = Date.now();
  const diffMs = ahora - fecha.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `hace ${diffHoras} h`;

  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias === 1) return "ayer";
  if (diffDias < 7) return `hace ${diffDias} dias`;

  return fecha.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}
