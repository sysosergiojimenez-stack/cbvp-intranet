import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange } from "../services/sheets";
import { env } from "../lib/env";

const DEFAULTS: Record<number, Record<string, boolean>> = {
  5: { ver_todo: true, editar_planillas: true, eliminar_planillas: true, ver_personal: true, ver_historial: true, cargar_planillas: true, ver_perfil_propio: true, configuracion: true },
  4: { ver_todo: true, editar_planillas: true, eliminar_planillas: true, ver_personal: true, ver_historial: true, cargar_planillas: true, ver_perfil_propio: true, configuracion: false },
  3: { ver_todo: true, editar_planillas: false, eliminar_planillas: false, ver_personal: true, ver_historial: true, cargar_planillas: true, ver_perfil_propio: true, configuracion: false },
  2: { ver_todo: true, editar_planillas: false, eliminar_planillas: false, ver_personal: true, ver_historial: true, cargar_planillas: true, ver_perfil_propio: true, configuracion: false },
  1: { ver_todo: false, editar_planillas: false, eliminar_planillas: false, ver_personal: false, ver_historial: false, cargar_planillas: false, ver_perfil_propio: true, configuracion: false },
};

export const permisosRouter = createRouter({
  // Trae la configuracion de que puede hacer cada Nivel (1 a 5).
  // Si un nivel no esta cargado en la hoja, se completa con los valores por defecto.
  obtenerNiveles: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_USUARIOS_ID, "PERMISOS_NIVELES!A1:I");
    const niveles: Record<number, Record<string, boolean>> = {};

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      const nivel = Number(fila[0]);
      if (!nivel) continue;
      niveles[nivel] = {
        ver_todo: String(fila[1] || "").trim().toUpperCase() === "TRUE",
        editar_planillas: String(fila[2] || "").trim().toUpperCase() === "TRUE",
        eliminar_planillas: String(fila[3] || "").trim().toUpperCase() === "TRUE",
        ver_personal: String(fila[4] || "").trim().toUpperCase() === "TRUE",
        ver_historial: String(fila[5] || "").trim().toUpperCase() === "TRUE",
        cargar_planillas: String(fila[6] || "").trim().toUpperCase() === "TRUE",
        ver_perfil_propio: String(fila[7] || "").trim().toUpperCase() === "TRUE",
        configuracion: String(fila[8] || "").trim().toUpperCase() === "TRUE",
      };
    }

    for (const n of [1, 2, 3, 4, 5]) {
      if (!niveles[n]) niveles[n] = DEFAULTS[n];
    }

    return { exito: true as const, niveles };
  }),

  // Crea o actualiza la fila de un Nivel con los permisos que tiene habilitados.
  actualizarNivel: publicQuery
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
      })
    )
    .mutation(async ({ input }) => {
      const data = await readSheet(env.SHEET_USUARIOS_ID, "PERMISOS_NIVELES!A1:I");
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (Number(data[i][0]) === input.nivel) {
          rowIndex = i + 1;
          break;
        }
      }

      const fila = [
        input.nivel,
        input.ver_todo,
        input.editar_planillas,
        input.eliminar_planillas,
        input.ver_personal,
        input.ver_historial,
        input.cargar_planillas,
        input.ver_perfil_propio,
        input.configuracion,
      ];

      if (rowIndex === -1) {
        await appendRow(env.SHEET_USUARIOS_ID, "PERMISOS_NIVELES", fila);
      } else {
        await updateRange(env.SHEET_USUARIOS_ID, `PERMISOS_NIVELES!A${rowIndex}:I${rowIndex}`, [fila]);
      }

      return { exito: true as const };
    }),
});
