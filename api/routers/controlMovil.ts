import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { ESTADOS_CHECKLIST_VALIDOS } from "@contracts/controlMovil";

function colSitios() {
  return getFirestoreClient().collection("controlMovilSitios");
}

function colChecklists() {
  return getFirestoreClient().collection("controlMovilChecklists");
}

const itemChecklistInput = z.object({
  materialId: z.string(),
  item: z.string(),
  detalle: z.string(),
  sitioId: z.string(),
  sitioDenominacion: z.string(),
  estado: z.enum(ESTADOS_CHECKLIST_VALIDOS),
  observacion: z.string(),
});

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

  // Guarda un checklist completo (conforme/no conforme por material, con
  // observacion opcional en los no conformes) como un registro historico
  // inmutable -- no pisa checklists anteriores del mismo movil.
  guardarChecklist: publicQuery
    .input(
      z.object({
        movilId: z.string(),
        movilCodificacion: z.string(),
        usuario: z.string(),
        items: z.array(itemChecklistInput).min(1),
      })
    )
    .mutation(async ({ input }) => {
      const ahora = new Date();
      const totalConforme = input.items.filter((i) => i.estado === "conforme").length;
      const totalNoConforme = input.items.filter((i) => i.estado === "no_conforme").length;

      const ref = await colChecklists().add({
        movilId: input.movilId,
        movilCodificacion: input.movilCodificacion,
        usuario: input.usuario,
        fecha: ahora.toISOString(),
        fechaLegible: `${ahora.toLocaleDateString("es-ES")} ${ahora.toLocaleTimeString("es-ES")}`,
        items: input.items,
        totalConforme,
        totalNoConforme,
      });
      return { exito: true as const, id: ref.id };
    }),

  historialChecklists: publicQuery
    .input(z.object({ movilId: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await colChecklists().where("movilId", "==", input.movilId).get();
      const checklists = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
      return { exito: true as const, checklists };
    }),
});
