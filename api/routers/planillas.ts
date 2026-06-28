import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange, findRowIndex, deleteRows, getSheetId } from "../services/sheets";
import { extractGuardiaData } from "../services/gemini";
import { uploadFile } from "../services/storage";
import { env } from "../lib/env";

export const planillasRouter = createRouter({
  historial: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado!A1:K5000");
    const planillas = [];

    for (let i = 1; i < data.length; i++) {
      planillas.push({
        idPlanilla: String(data[i][0] || ""),
        fechaCarga: String(data[i][1] || ""),
        fechaGuardia: String(data[i][2] || ""),
        grupo: String(data[i][3] || ""),
        inicioGuardia: String(data[i][4] || ""),
        finalizaGuardia: String(data[i][5] || ""),
        directorSem: String(data[i][6] || ""),
        comandanteSemana: String(data[i][7] || ""),
        oficialK20: String(data[i][8] || ""),
        novedades: String(data[i][9] || ""),
        urlImagen: String(data[i][10] || ""),
      });
    }

    planillas.sort((a, b) => {
      const parseFecha = (f: string) => {
        try {
          const parts = f.split(" ");
          const [d, m, y] = parts[0].split("/");
          return new Date(`${y}-${m}-${d}T${parts[1] || "00:00"}`).getTime();
        } catch {
          return 0;
        }
      };
      return parseFecha(b.fechaCarga) - parseFecha(a.fechaCarga);
    });

    return { exito: true as const, planillas };
  }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const data = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L5000"
      );
      const personal = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]) === input.idPlanilla) {
          personal.push({
            idFila: String(data[i][0] || ""),
            idPlanilla: String(data[i][1] || ""),
            fechaCarga: String(data[i][2] || ""),
            fechaGuardia: String(data[i][3] || ""),
            grupo: String(data[i][4] || ""),
            tipo: String(data[i][5] || ""),
            codigo: String(data[i][6] || ""),
            nombre: String(data[i][7] || ""),
            asignacion: String(data[i][8] || ""),
            asistencia: String(data[i][9] || ""),
            idCargador: String(data[i][10] || ""),
            nombreCargador: String(data[i][11] || ""),
          });
        }
      }

      return { exito: true as const, personal };
    }),

  procesar: publicQuery
    .input(
      z.object({
        base64Data: z.string(),
        fileName: z.string(),
        fileType: z.string(),
        user: z.object({
          identificador: z.string(),
          nombreCompleto: z.string(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // 1. Extract base64 content
        const parts = input.base64Data.split(",");
        const base64Content = parts.length > 1 ? parts[1] : parts[0];

        // 2. Upload to Google Drive
        let urlImagen = "";
        if (env.GCS_BUCKET_NAME) {
          urlImagen = await uploadFile(
            env.GCS_BUCKET_NAME,
            input.fileName,
            input.fileType,
            base64Content
          );
        }

        // 3. Extract data with Gemini
        const datosExtraidos = await extractGuardiaData(base64Content, input.fileType);

        // 4. Generate planilla ID
        const now = new Date();
        const idPlanilla =
          "GRD-" +
          now.toISOString().slice(0, 10).replace(/-/g, "") +
          "-" +
          String(now.getHours()).padStart(2, "0") +
          String(now.getMinutes()).padStart(2, "0") +
          String(now.getSeconds()).padStart(2, "0");

        const fechaCargaStr = now
          .toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          .replace(/\//g, "/");

        // 5. Save header
        await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado", [
          idPlanilla,
          fechaCargaStr,
          String(datosExtraidos.fechaGuardia || ""),
          String(datosExtraidos.grupo || ""),
          String(datosExtraidos.inicioGuardia || ""),
          String(datosExtraidos.finalizaGuardia || ""),
          String(datosExtraidos.directorSem || ""),
          String(datosExtraidos.comandanteSemana || ""),
          String(datosExtraidos.oficialK20 || ""),
          String(datosExtraidos.novedades || ""),
          urlImagen,
        ]);

        // 6. Save personal
        const personal = datosExtraidos.personal as Array<Record<string, unknown>>;
        const guardiasEspeciales = datosExtraidos.guardiasEspeciales as Array<
          Record<string, unknown>
        >;
        const refuerzos = datosExtraidos.refuerzos as Array<Record<string, unknown>>;

        let filaIdx = 1;

        if (Array.isArray(personal)) {
          for (const p of personal) {
            await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
              `${idPlanilla}-${filaIdx}`,
              idPlanilla,
              fechaCargaStr,
              String(datosExtraidos.fechaGuardia || ""),
              String(datosExtraidos.grupo || ""),
              "GUARDIA NORMAL",
              String(p.codigo || ""),
              String(p.nombre || ""),
              String(p.asignacion || ""),
              String(p.asistencia || ""),
              input.user.identificador,
              input.user.nombreCompleto,
            ]);
            filaIdx++;
          }
        }

        if (Array.isArray(guardiasEspeciales)) {
          for (const e of guardiasEspeciales) {
            if (e.codigo || e.nombre) {
              await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
                `${idPlanilla}-${filaIdx}`,
                idPlanilla,
                fechaCargaStr,
                String(datosExtraidos.fechaGuardia || ""),
                String(datosExtraidos.grupo || ""),
                "GUARDIA ESPECIAL",
                String(e.codigo || ""),
                String(e.nombre || ""),
                String(e.asignacion || ""),
                "",
                input.user.identificador,
                input.user.nombreCompleto,
              ]);
              filaIdx++;
            }
          }
        }

        if (Array.isArray(refuerzos)) {
          for (const r of refuerzos) {
            if (r.codigo || r.nombre) {
              await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
                `${idPlanilla}-${filaIdx}`,
                idPlanilla,
                fechaCargaStr,
                String(datosExtraidos.fechaGuardia || ""),
                String(datosExtraidos.grupo || ""),
                "REFUERZO",
                String(r.codigo || ""),
                String(r.nombre || ""),
                String(r.asignacion || ""),
                "",
                input.user.identificador,
                input.user.nombreCompleto,
              ]);
              filaIdx++;
            }
          }
        }

        return {
          exito: true as const,
          mensaje: "Planilla procesada correctamente",
          idPlanilla,
          datos: datosExtraidos,
        };
      } catch (error) {
        return {
          exito: false as const,
          mensaje: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  actualizarEncabezado: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        datos: z.object({
          fechaGuardia: z.string().optional(),
          grupo: z.string().optional(),
          inicioGuardia: z.string().optional(),
          finalizaGuardia: z.string().optional(),
          directorSem: z.string().optional(),
          comandanteSemana: z.string().optional(),
          oficialK20: z.string().optional(),
          novedades: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const rowIdx = await findRowIndex(
          env.SHEET_GUARDIAS_ID,
          "Guardias_Encabezado!A1:K5000",
          0,
          input.idPlanilla
        );

        if (rowIdx === -1) {
          return { exito: false as const, mensaje: "Planilla no encontrada" };
        }

        const d = input.datos;
        await updateRange(env.SHEET_GUARDIAS_ID, `Guardias_Encabezado!C${rowIdx}:J${rowIdx}`, [
          [
            d.fechaGuardia || "",
            d.grupo || "",
            d.inicioGuardia || "",
            d.finalizaGuardia || "",
            d.directorSem || "",
            d.comandanteSemana || "",
            d.oficialK20 || "",
            d.novedades || "",
          ],
        ]);

        return { exito: true as const, mensaje: "Encabezado actualizado" };
      } catch (error) {
        return {
          exito: false as const,
          mensaje: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  eliminar: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .mutation(async ({ input }) => {
      // Delete from Encabezado
      const encData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Encabezado!A1:K5000"
      );
      const encRowsToDelete: number[] = [];

      for (let i = encData.length - 1; i >= 1; i--) {
        if (encData[i][0] && String(encData[i][0]).trim() === input.idPlanilla.trim()) {
          encRowsToDelete.push(i + 1);
        }
      }

      if (encRowsToDelete.length > 0) {
        const encSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado");
        await deleteRows(env.SHEET_GUARDIAS_ID, encSheetId, encRowsToDelete);
      }

      // Delete from Personal
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L5000"
      );
      const persRowsToDelete: number[] = [];

      for (let i = persData.length - 1; i >= 1; i--) {
        if (persData[i][1] && String(persData[i][1]).trim() === input.idPlanilla.trim()) {
          persRowsToDelete.push(i + 1);
        }
      }

      if (persRowsToDelete.length > 0) {
        const persSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Guardias_Personal");
        await deleteRows(env.SHEET_GUARDIAS_ID, persSheetId, persRowsToDelete);
      }

      return { exito: true as const, mensaje: "Planilla eliminada" };
    }),
});
