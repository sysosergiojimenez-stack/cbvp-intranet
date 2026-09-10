export const CONDICIONES_MOVIL_VALIDAS = [
  "En Servicio",
  "Fuera de Servicio",
  "De Baja",
] as const;

export type CondicionMovil = (typeof CONDICIONES_MOVIL_VALIDAS)[number];
