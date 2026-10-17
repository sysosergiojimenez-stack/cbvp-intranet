// Datos y calculos compartidos del submodulo Colecta (formatos de Tesoreria
// para el conteo de alcancias, sobres, POS Upay y transferencias).

export const BILLETES = [100000, 50000, 20000, 10000, 5000, 2000];
export const MONEDAS = [1000, 500, 100, 50];

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export interface ColectaGeneral {
  compania: string;
  ciudad: string;
  // YYYY-MM-DD o '' (sin fecha: el acta queda con lineas para completar a mano)
  fecha: string;
  local: string;
}

export interface FilaDistribucion { n: string; responsable: string; ci: string; telefono: string }
export interface FilaResumen { n: string; billetes: string; monedas: string }
export interface FilaPos { n: string; desde: string; hasta: string; monto: string }
export interface FilaTransferencia { n: string; comprobante: string; banco: string; monto: string }

// Un conteo (de una alcancia o de un sobre): cantidad por denominacion.
export interface ConteoBloque {
  numero: string;
  cantidades: Record<string, string>;
}
export interface DatosConteo { alcancia: ConteoBloque; sobre: ConteoBloque }

// Los montos se cargan como texto (con "." como separador visual) y se
// limpian a entero solo para calcular.
export function aEntero(valor: string): number {
  const limpio = (valor || '').replace(/[^\d-]/g, '');
  return limpio ? parseInt(limpio, 10) : 0;
}

export function formatearGs(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function numeroCorrelativo(i: number): string {
  return String(i + 1).padStart(3, '0');
}

export function totalDenominaciones(denominaciones: number[], cantidades: Record<string, string>): number {
  return denominaciones.reduce((sum, d) => sum + d * aEntero(cantidades[String(d)] || ''), 0);
}

export function totalesConteo(bloque: ConteoBloque) {
  const billetes = totalDenominaciones(BILLETES, bloque.cantidades);
  const monedas = totalDenominaciones(MONEDAS, bloque.cantidades);
  return { billetes, monedas, total: billetes + monedas };
}

export function filasNumeradas<T>(cantidad: number, crear: (n: string) => T): T[] {
  return Array.from({ length: cantidad }, (_, i) => crear(numeroCorrelativo(i)));
}

export function dividirFecha(fecha: string): { dia: string; mes: string; anio: string } {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { dia: '', mes: '', anio: '' };
  return { dia: String(parseInt(m[3], 10)), mes: MESES[parseInt(m[2], 10) - 1] || '', anio: m[1] };
}

export function fechaISOHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
