import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

function colSitios() {
  return getFirestoreClient().collection("controlMovilSitios");
}

export const controlMovilRouter = createRouter({
  listadoSitios: publicQuery.query(async () => {
    const snapshot = await colSitios().get();
    const sitios = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.denominacion || "").localeCompare(String(b.denominacion || "")));
    return { exito: true as const, sitios };
  }),

  crearSitio: publicQuery
    .input(z.object({ movilId: z.string(), denominacion: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const ref = await colSitios().add({ movilId: input.movilId, denominacion: input.denominacion });
      return { exito: true as const, id: ref.id };
    }),

  editarSitio: publicQuery
    .input(z.object({ id: z.string(), denominacion: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colSitios().doc(input.id).update({ denominacion: input.denominacion });
      return { exito: true as const, mensaje: "Sitio actualizado" };
    }),

  eliminarSitio: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await colSitios().doc(input.id).delete();
      return { exito: true as const, mensaje: "Sitio eliminado" };
    }),
});
