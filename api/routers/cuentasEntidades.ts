import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

function colCuentas() {
  return getFirestoreClient().collection("cuentasEntidades");
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

export const cuentasEntidadesRouter = createRouter({
  listado: publicQuery.query(async () => {
    const [cuentasSnap, ordenesSnap, campanaSociosSnap] = await Promise.all([
      colCuentas().get(),
      getFirestoreClient().collection("ordenesPago").get(),
      getFirestoreClient().collection("campanaSocios").get(),
    ]);

    // Debitos = suma de Ordenes de Pago cuya cuenta de origen coincide con
    // esta entidad.
    const debitosPorCuenta = new Map<string, number>();
    ordenesSnap.forEach((doc) => {
      const fila = doc.data();
      const cuenta = String(fila.bancoCuenta || "").trim();
      if (!cuenta) return;
      debitosPorCuenta.set(cuenta, (debitosPorCuenta.get(cuenta) || 0) + (Number(fila.total) || 0));
    });

    // Creditos = Total Depositado de los reportes de Campana de Socios,
    // que siempre se deposita en la cuenta de Ueno Bank.
    let creditoCampanaSocios = 0;
    campanaSociosSnap.forEach((doc) => {
      creditoCampanaSocios += Number(doc.data().totalDepositado) || 0;
    });

    const cuentas = cuentasSnap.docs
      .map((doc) => {
        const fila = doc.data();
        const cuenta = String(fila.cuenta || "").trim();
        const nombre = String(fila.nombre || "").trim();
        const saldoInicial = Number(fila.saldoInicial) || 0;
        const debitos = debitosPorCuenta.get(cuenta) || 0;
        const creditos = nombre.toUpperCase() === "UENO BANK" ? creditoCampanaSocios : 0;
        return {
          id: doc.id,
          nombre,
          cuenta,
          saldoInicial,
          observaciones: String(fila.observaciones || ""),
          debitos,
          creditos,
          saldo: saldoInicial + creditos - debitos,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { exito: true as const, cuentas };
  }),

  guardar: publicQuery
    .input(
      z.object({
        nombre: z.string().min(1),
        cuenta: z.string().min(1),
        saldoInicial: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      await colCuentas()
        .doc(id)
        .set({ ...input, fechaCarga: new Date().toISOString() });
      return { exito: true as const, id };
    }),

  editar: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        nombre: z.string().min(1),
        cuenta: z.string().min(1),
        saldoInicial: z.number(),
        observaciones: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      await colCuentas().doc(id).update(campos);
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colCuentas().doc(input.id).delete();
      return { exito: true as const };
    }),
});
