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
    const [resumenSnap, ordenesSnap] = await Promise.all([
      colCajaChica().doc(RESUMEN_DOC_ID).get(),
      getFirestoreClient().collection("ordenesPago").get(),
    ]);

    const resumen = resumenSnap.data();
    const saldoAnterior = Number(resumen?.saldoAnterior) || 0;
    const gastos = Number(resumen?.gastos) || 0;
    const observaciones = String(resumen?.observaciones || "");

    // Los ingresos de Caja Chica son las Ordenes de Pago emitidas para
    // reponer el fondo (tipoMovimiento = CAJA_CHICA). Los gastos todavia
    // no tienen un modulo que los registre, por eso se cargan a mano.
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

    return {
      exito: true as const,
      saldoAnterior,
      gastos,
      observaciones,
      ingresos,
      saldo: saldoAnterior + ingresos - gastos,
      ordenes,
    };
  }),

  actualizar: publicQuery
    .input(
      z.object({
        saldoAnterior: z.number(),
        gastos: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await colCajaChica().doc(RESUMEN_DOC_ID).set(input, { merge: true });
      return { exito: true as const };
    }),
});
