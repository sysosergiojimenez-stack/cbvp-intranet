import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { CONDICIONES_MOVIL_VALIDAS } from "@contracts/condicionMovil";

function movilesCollection() {
  return getFirestoreClient().collection("moviles");
}

const movilInput = z.object({
  codificacion: z.string(),
  tipo: z.string(),
  procedencia: z.string(),
  anioAdquisicion: z.string(),
  marca: z.string(),
  modelo: z.string(),
  anio: z.string(),
  chasis: z.string(),
  matricula: z.string(),
  foto: z.string(),
  condicion: z.enum(CONDICIONES_MOVIL_VALIDAS),
  tipoCombustible: z.string(),
});

export const movilesRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await movilesCollection().get();
    const moviles = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.codificacion || "").localeCompare(String(b.codificacion || "")));
    return { exito: true as const, moviles };
  }),

  crear: publicQuery
    .input(movilInput)
    .mutation(async ({ input }) => {
      const fechaCarga = new Date().toLocaleDateString("es-ES");
      const ref = await movilesCollection().add({ ...input, fechaCarga });
      return { exito: true as const, id: ref.id };
    }),

  editar: publicQuery
    .input(movilInput.extend({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      await movilesCollection().doc(id).update(campos);
      return { exito: true as const, mensaje: "Movil actualizado" };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await movilesCollection().doc(input.id).delete();
      return { exito: true as const, mensaje: "Movil eliminado" };
    }),
});
