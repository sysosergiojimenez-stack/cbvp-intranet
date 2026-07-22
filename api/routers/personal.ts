import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange, findRowIndex } from "../services/sheets";
import { env } from "../lib/env";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

export const personalRouter = createRouter({
  list: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:O");
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
        "Guardias_Personal!A1:L"
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

  crear: publicQuery
    .input(
      z.object({
        codigo: z.string().min(1),
        anioJuramento: z.string().min(1),
        categoria: z.string().min(1),
        rango: z.string().min(1),
        codigoRadial: z.string(),
        primerNombre: z.string().min(1),
        segundoNombre: z.string(),
        primerApellido: z.string().min(1),
        segundoApellido: z.string(),
        nroDocId: z.string().optional(),
        fechaNacimiento: z.string().optional(),
        correo: z.string().email().optional().or(z.literal('')),
        contrasena: z.string().optional().or(z.literal('')),
        nivelPermiso: z.string().optional().or(z.literal('')),
        descripcionPermiso: z.string().optional().or(z.literal('')),
      })
    )
    .mutation(async ({ input }) => {
      await appendRow(env.SHEET_USUARIOS_ID, "USUARIOS", [
        "", // A: IDENTIFICADOR (no se usa)
        input.codigo,
        input.anioJuramento,
        input.categoria,
        "", // E: CARGO (no se usa en formulario)
        input.rango,
        input.codigoRadial,
        input.primerNombre,
        input.segundoNombre,
        input.primerApellido,
        input.segundoApellido,
        input.nroDocId || "",
        input.fechaNacimiento || "",
        input.correo,
        input.contrasena,
        input.nivelPermiso,
        input.descripcionPermiso,
      ]);
      return { exito: true as const, mensaje: "Bombero registrado correctamente" };
    }),

  obtenerPorCodigo: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:Q");
      const searchNum = extractNumber(input.codigo);
      for (let i = 1; i < data.length; i++) {
        const codigoFila = String(data[i][1] || "").trim();
        const numFila = extractNumber(codigoFila);
        if (numFila === searchNum) {
          return {
            exito: true as const,
            bombero: {
              identificador: String(data[i][0] || ""),
              codigo: codigoFila,
              anioJuramento: String(data[i][2] || ""),
              categoria: String(data[i][3] || ""),
              cargo: String(data[i][4] || ""),
              rango: String(data[i][5] || ""),
              codigoRadial: String(data[i][6] || ""),
              primerNombre: String(data[i][7] || ""),
              segundoNombre: String(data[i][8] || ""),
              primerApellido: String(data[i][9] || ""),
              segundoApellido: String(data[i][10] || ""),
              nroDocId: String(data[i][11] || ""),
              fechaNacimiento: String(data[i][12] || ""),
              correo: String(data[i][13] || ""),
              nivelPermiso: String(data[i][15] || "1"),
              descripcionPermiso: String(data[i][16] || ""),
            },
          };
        }
      }
      return { exito: false as const, error: "Bombero no encontrado" };
    }),

  editar: publicQuery
    .input(
      z.object({
        codigoOriginal: z.string().min(1),
        codigo: z.string().min(1),
        anioJuramento: z.string().min(1),
        categoria: z.string().min(1),
        rango: z.string().min(1),
        codigoRadial: z.string(),
        primerNombre: z.string().min(1),
        segundoNombre: z.string(),
        primerApellido: z.string().min(1),
        segundoApellido: z.string(),
        nroDocId: z.string().optional(),
        fechaNacimiento: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:Q");
      const searchNum = extractNumber(input.codigoOriginal);
      let rowIndex = -1;
      let existingRow: string[] = [];
      for (let i = 1; i < data.length; i++) {
        const codigoFila = String(data[i][1] || "").trim();
        const numFila = extractNumber(codigoFila);
        if (numFila === searchNum) {
          rowIndex = i + 1;
          existingRow = data[i] as string[];
          break;
        }
      }
      if (rowIndex === -1) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!A${rowIndex}:Q${rowIndex}`, [[
        "", // A: IDENTIFICADOR
        input.codigo,
        input.anioJuramento,
        input.categoria,
        existingRow[4] || "", // E: CARGO (preserve existing)
        input.rango,
        input.codigoRadial,
        input.primerNombre,
        input.segundoNombre,
        input.primerApellido,
        input.segundoApellido,
        input.nroDocId || "",
        input.fechaNacimiento || "",
        existingRow[13] || "", // N: correo (preserve existing)
        existingRow[14] || "", // O: contrasena (preserve existing)
        existingRow[15] || "", // P: nivelPermiso (preserve existing)
        existingRow[16] || "", // Q: descripcionPermiso (preserve existing)
      ]]);
      return { exito: true as const, mensaje: "Bombero actualizado correctamente" };
    }),

  cambiarAcceso: publicQuery
    .input(
      z.object({
        correoActual: z.string().email(),
        correoNuevo: z.string().email(),
        contrasenaActual: z.string().min(1),
        contrasenaNueva: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Buscar por correo+contrasena en vez de por codigo
      // Asi solo puedes modificar tu propia fila
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:Q");
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as string[];
        const storedEmail = String(row[13] || "").trim();
        const storedPassword = String(row[14] || "").trim();
        if (storedEmail === input.correoActual.trim() && storedPassword === input.contrasenaActual.trim()) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex === -1) {
        return { exito: false as const, error: "Correo o contrasena actual incorrectos" };
      }
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!N${rowIndex}:O${rowIndex}`, [[
        input.correoNuevo.trim(),
        input.contrasenaNueva.trim(),
      ]]);
      return { exito: true as const, mensaje: "Datos de acceso actualizados correctamente" };
    }),
});
