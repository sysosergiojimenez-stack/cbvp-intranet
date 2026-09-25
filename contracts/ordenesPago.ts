export const TIPOS_MOVIMIENTO_ORDEN_PAGO = [
  "CAJA_CHICA",
  "PAGO_PROVEEDORES",
  "PAGO_PERSONAL",
  "OTROS",
] as const;

export type TipoMovimientoOrdenPago = (typeof TIPOS_MOVIMIENTO_ORDEN_PAGO)[number];

export const LABEL_TIPO_MOVIMIENTO: Record<TipoMovimientoOrdenPago, string> = {
  CAJA_CHICA: "Caja Chica",
  PAGO_PROVEEDORES: "Pago a Proveedores",
  PAGO_PERSONAL: "Pago a Personal",
  OTROS: "Otros",
};
