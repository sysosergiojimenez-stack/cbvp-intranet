import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

function colCajaChica() {
  return getFirestoreClient().collection("cajaChica");
}

function generateId(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

export const cajaChicaRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snap = await colCajaChica().get();

    const movimientos = snap.docs
      .map((doc) => {
        const fila = doc.data();
        const saldoAnterior = Number(fila.saldoAnterior) || 0;
        const ingresos = Number(fila.ingresos) || 0;
        const gastos = Number(fila.gastos) || 0;
        return {
          id: doc.id,
          fecha: String(fila.fecha || ""),
          observaciones: String(fila.observaciones || ""),
          saldoAnterior,
          ingresos,
          gastos,
          saldo: saldoAnterior + ingresos - gastos,
        };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    return { exito: true as const, movimientos };
  }),

  guardar: publicQuery
    .input(
      z.object({
        fecha: z.string().min(1),
        saldoAnterior: z.number(),
        ingresos: z.number(),
        gastos: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      await colCajaChica()
        .doc(id)
        .set({ ...input, fechaCarga: new Date().toISOString() });
      return { exito: true as const, id };
    }),

  editar: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        fecha: z.string().min(1),
        saldoAnterior: z.number(),
        ingresos: z.number(),
        gastos: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      await colCajaChica().doc(id).update(campos);
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colCajaChica().doc(input.id).delete();
      return { exito: true as const };
    }),
});
