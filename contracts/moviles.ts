export const MOVILES_VALIDOS = ["AR-203", "AB-202"] as const;

export type MovilValido = (typeof MOVILES_VALIDOS)[number];

export function normalizarMovil(valor: string): MovilValido {
  const digitos = valor.replace(/[^0-9]/g, "");
  if (digitos.includes("203")) return "AR-203";
  if (digitos.includes("202")) return "AB-202";
  return MOVILES_VALIDOS[0];
}
