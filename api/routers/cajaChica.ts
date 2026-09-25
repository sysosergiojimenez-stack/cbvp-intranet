import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

// Caja Chica es un fondo unico (no una lista de cuentas), por eso el
// resumen editable vive en un solo documento fijo.
const RESUMEN_DOC_ID = "resumen";

function colCajaChica() {
  return getFirestoreClient().collection("cajaChica");
}

export const cajaChicaRouter = createRouter({
  listado: publicQuery.query(async () => {
    const [resumenSnap, ordenesSnap, facturasSnap] = await Promise.all([
      colCajaChica().doc(RESUMEN_DOC_ID).get(),
      getFirestoreClient().collection("ordenesPago").get(),
      getFirestoreClient().collection("facturasGastos").get(),
    ]);

    const resumen = resumenSnap.data();
    const saldoAnterior = Number(resumen?.saldoAnterior) || 0;
    const observaciones = String(resumen?.observaciones || "");

    // Los ingresos de Caja Chica son las Ordenes de Pago emitidas para
    // reponer el fondo (tipoMovimiento = CAJA_CHICA).
    const ordenes = ordenesSnap.docs
      .map((doc) => {
        const fila = doc.data();
        return {
          id: doc.id,
          numero: Number(fila.numero) || 0,
          anio: Number(fila.anio) || 0,
          fecha: String(fila.fecha || ""),
          bancoNombre: String(fila.bancoNombre || ""),
          tipoMovimiento: String(fila.tipoMovimiento || ""),
          total: Number(fila.total) || 0,
        };
      })
      .filter((o) => o.tipoMovimiento === "CAJA_CHICA")
      .sort((a, b) => b.anio - a.anio || b.numero - a.numero);

    const ingresos = ordenes.reduce((acc, o) => acc + o.total, 0);

    // Los gastos de Caja Chica son las Facturas de Gastos cargadas con
    // Pagado Desde = Caja Chica.
    const facturas = facturasSnap.docs
      .map((doc) => {
        const fila = doc.data();
        return {
          id: doc.id,
          nroFactura: String(fila.nroFactura || ""),
          fecha: String(fila.fecha || ""),
          proveedor: String(fila.proveedor || ""),
          monto: Number(fila.monto) || 0,
          pagadoDesdeTipo: fila.pagadoDesdeTipo === "ORDEN_PAGO" ? ("ORDEN_PAGO" as const) : ("CAJA_CHICA" as const),
        };
      })
      .filter((f) => f.pagadoDesdeTipo === "CAJA_CHICA")
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const gastos = facturas.reduce((acc, f) => acc + f.monto, 0);

    return {
      exito: true as const,
      saldoAnterior,
      observaciones,
      ingresos,
      gastos,
      saldo: saldoAnterior + ingresos - gastos,
      ordenes,
      facturas,
    };
  }),

  actualizar: publicQuery
    .input(
      z.object({
        saldoAnterior: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await colCajaChica().doc(RESUMEN_DOC_ID).set(input, { merge: true });
      return { exito: true as const };
    }),
});
