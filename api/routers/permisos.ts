import { z } from "zod";
import { createRouter, publicQuery, adminProcedure } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { DEFAULTS_POR_NIVEL } from "@contracts/permisos";
import type { AccionPermiso } from "@contracts/permisos";

function permisosNivelesCollection() {
  return getFirestoreClient().collection("permisosNiveles");
}

// Columna 0 = nivel. El resto son flags en orden.
const COLUMNAS_PERMISO: AccionPermiso[] = [
  'ver_todo',
  'editar_planillas',
  'eliminar_planillas',
  'ver_personal',
  'ver_historial',
  'cargar_planillas',
  'ver_perfil_propio',
  'configuracion',
  'ver_informes',
  'gestionar_roles_guardia',
  'crear_bombero',
];

function parseBool(value: unknown): boolean {
  return String(value || "").trim().toUpperCase() === "TRUE";
}

export const permisosRouter = createRouter({
  // Trae la configuracion de que puede hacer cada Nivel (1 a 5).
  // Si un nivel no esta cargado en la hoja, se completa con los valores por defecto.
  // Si una fila existe pero le faltan columnas (datos antiguos), se rellena con el default.
  obtenerNiveles: publicQuery.query(async () => {
    try {
      const snapshot = await permisosNivelesCollection().get();
      const niveles: Record<number, Record<string, boolean>> = {};

      snapshot.forEach((doc) => {
        const nivel = Number(doc.id);
        if (!nivel) return;

        const fila = doc.data();
        const base = DEFAULTS_POR_NIVEL[nivel] || {};
        const flags: Record<string, boolean> = { ...base };

        COLUMNAS_PERMISO.forEach((accion) => {
          if (fila[accion] !== undefined) {
            flags[accion] = parseBool(fila[accion]);
          }
        });

        niveles[nivel] = flags;
      });

      for (const n of [1, 2, 3, 4, 5]) {
        if (!niveles[n]) niveles[n] = DEFAULTS_POR_NIVEL[n];
      }

      return { exito: true as const, niveles };
    } catch {
      // Si la coleccion no existe todavia, devolvemos los defaults para no bloquear la app.
      return { exito: true as const, niveles: DEFAULTS_POR_NIVEL };
    }
  }),

  // Crea o actualiza la fila de un Nivel con los permisos que tiene habilitados.
  actualizarNivel: adminProcedure
    .input(
      z.object({
        nivel: z.number().min(1).max(5),
        ver_todo: z.boolean(),
        editar_planillas: z.boolean(),
        eliminar_planillas: z.boolean(),
        ver_personal: z.boolean(),
        ver_historial: z.boolean(),
        cargar_planillas: z.boolean(),
        ver_perfil_propio: z.boolean(),
        configuracion: z.boolean(),
        ver_informes: z.boolean(),
        gestionar_roles_guardia: z.boolean(),
        crear_bombero: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const { nivel, ...flags } = input;
      await permisosNivelesCollection().doc(String(nivel)).set(flags, { merge: true });
      return { exito: true as const };
    }),
});
