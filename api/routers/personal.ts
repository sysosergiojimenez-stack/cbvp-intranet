import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet } from "../services/sheets";
import { env } from "../lib/env";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

export const personalRouter = createRouter({
  list: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:O1000");
    const personal: Array<{
      identificador: string;
      codigo: string;
      anioJuramento: string;
      categoria: string;
      cargo: string;
      rango: string;
      codigoRadial: string;
      nombreCompleto: string;
    }> = [];

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      const codigo = fila[1] ? String(fila[1]).trim() : "";
      const primerNombre = fila[7] ? String(fila[7]).trim() : "";
      if (!codigo || !primerNombre) continue;

      const primerApellido = fila[9] ? String(fila[9]).trim() : "";
      const nombreCompleto = primerNombre + (primerApellido ? " " + primerApellido : "");

      personal.push({
        identificador: String(fila[0] || ""),
        codigo,
        anioJuramento: String(fila[2] || ""),
        categoria: String(fila[3] || ""),
        cargo: String(fila[4] || ""),
        rango: String(fila[5] || ""),
        codigoRadial: String(fila[6] || ""),
        nombreCompleto,
      });
    }

    // Ordenar: primero por AnioJuramento (numerico ASC), luego por Codigo (numerico ASC)
    personal.sort((a, b) => {
      const anioA = parseInt(a.anioJuramento) || 0;
      const anioB = parseInt(b.anioJuramento) || 0;
      if (anioA !== anioB) return anioA - anioB;

      const numA = parseInt(extractNumber(a.codigo)) || 0;
      const numB = parseInt(extractNumber(b.codigo)) || 0;
      return numA - numB;
    });

    return { exito: true as const, personal };
  }),

  historial: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const codigoBusqueda = input.codigo.toString().trim().toUpperCase();
      const numeroBusqueda = extractNumber(codigoBusqueda);

      const data = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L5000"
      );

      const guardias: Array<{
        idPlanilla: string;
        fechaGuardia: string;
        grupo: string;
        tipo: string;
        asignacion: string;
        asistencia: string;
        fechaCarga: string;
      }> = [];

      for (let i = 1; i < data.length; i++) {
        const codigoFila = data[i][6] ? String(data[i][6]).trim().toUpperCase() : "";
        const numeroFila = extractNumber(codigoFila);

        if (numeroFila && numeroFila === numeroBusqueda) {
          guardias.push({
            idPlanilla: String(data[i][1] || ""),
            fechaGuardia: String(data[i][3] || ""),
            grupo: String(data[i][4] || ""),
            tipo: String(data[i][5] || ""),
            asignacion: String(data[i][8] || ""),
            asistencia: String(data[i][9] || ""),
            fechaCarga: String(data[i][2] || ""),
          });
        }
      }

      const stats = {
        totalGuardias: guardias.length,
        guardiasNormales: guardias.filter((g) => g.tipo === "GUARDIA NORMAL").length,
        guardiasEspeciales: guardias.filter((g) => g.tipo === "GUARDIA ESPECIAL").length,
        refuerzos: guardias.filter((g) => g.tipo === "REFUERZO").length,
        presentes: guardias.filter((g) => g.asistencia === "PRESENTE").length,
        acacr: guardias.filter((g) => g.asistencia === "ACACR").length,
        acasr: guardias.filter((g) => g.asistencia === "ACASR").length,
        asasr: guardias.filter((g) => g.asistencia === "ASASR").length,
      };

      return { exito: true as const, guardias, stats };
    }),
});
