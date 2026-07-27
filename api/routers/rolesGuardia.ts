import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow } from "../services/sheets";
import { env } from "../lib/env";

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const rolesGuardiaRouter = createRouter({
  // Lista todos los Roles de Guardia creados, mas reciente primero.
  listar: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera!A1:F");
    const roles: Array<{
      id: string;
      mesInicio: number;
      anioInicio: number;
      mesFin: number;
      anioFin: number;
      fechaCreacion: string;
      etiqueta: string;
    }> = [];

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      const id = String(fila[0] || "").trim();
      if (!id) continue;
      const mesInicio = Number(fila[1]) || 1;
      const anioInicio = Number(fila[2]) || 0;
      const mesFin = Number(fila[3]) || 1;
      const anioFin = Number(fila[4]) || 0;
      const etiqueta = anioInicio === anioFin
        ? `${MESES[mesInicio - 1]} - ${MESES[mesFin - 1]} ${anioFin}`
        : `${MESES[mesInicio - 1]} ${anioInicio} - ${MESES[mesFin - 1]} ${anioFin}`;
      roles.push({
        id,
        mesInicio,
        anioInicio,
        mesFin,
        anioFin,
        fechaCreacion: String(fila[5] || ""),
        etiqueta,
      });
    }

    // Mas reciente primero (el id es un timestamp AAAAMMDDHHMMSS)
    roles.sort((a, b) => b.id.localeCompare(a.id));

    return { exito: true as const, roles };
  }),

  // Crea un nuevo Rol de Guardia bimensual a partir del mes/anio de inicio.
  crear: publicQuery
    .input(
      z.object({
        mesInicio: z.number().min(1).max(12),
        anioInicio: z.number().min(2020),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      let mesFin = input.mesInicio + 1;
      let anioFin = input.anioInicio;
      if (mesFin > 12) {
        mesFin = 1;
        anioFin += 1;
      }

      const ahora = new Date();
      const fechaCreacion = `${String(ahora.getDate()).padStart(2, "0")}/${String(ahora.getMonth() + 1).padStart(2, "0")}/${ahora.getFullYear()}`;

      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera", [
        id,
        input.mesInicio,
        input.anioInicio,
        mesFin,
        anioFin,
        fechaCreacion,
      ]);

      return { exito: true as const, id };
    }),
});
