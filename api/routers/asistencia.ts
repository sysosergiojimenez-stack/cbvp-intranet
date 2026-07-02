import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow } from "../services/sheets";
import { env } from "../lib/env";
import { extractAsistenciaData } from "../services/gemini";
import { uploadFile } from "../services/drive";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

function toTitleCase(str: string): string {
  return str.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface PersonalAsistencia {
  codigo: string;
  nombre: string;
  asistencia: string;
}

export const asistenciaRouter = createRouter({
  procesar: publicQuery
    .input(
      z.object({
        imageBase64: z.string().min(1),
        mimeType: z.string().min(1),
        usuarioId: z.string(),
        usuarioNombre: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Extract data using Gemini
      const extractedData = await extractAsistenciaData(input.imageBase64, input.mimeType);

      if (!extractedData || typeof extractedData !== "object") {
        return { exito: false as const, error: "No se pudieron extraer datos de la imagen" };
      }

      const tipoActividad = String(extractedData.tipoActividad || "").trim().toUpperCase();
      const otroTipo = String(extractedData.otroTipo || "").trim();
      const fechaActividad = String(extractedData.fechaActividad || "").trim();
      const inicioActividad = String(extractedData.inicioActividad || "").trim();
      const finalizaActividad = String(extractedData.finalizaActividad || "").trim();
      const acargoActividad = String(extractedData.acargoActividad || "").trim();
      const detalles = String(extractedData.detalles || "").trim();

      const validTypes = ["PRACTICA", "CITACION", "REUNION DE Cia", "OTRO"];
      const tipoNormalizado = tipoActividad === "REUNION DE CIA" ? "REUNION DE Cia" : tipoActividad;
      if (!validTypes.includes(tipoNormalizado)) {
        return { exito: false as const, error: `Tipo de actividad no reconocido: ${tipoActividad}` };
      }

      const tipoFinal = tipoNormalizado === "OTRO" && otroTipo ? `OTRO: ${otroTipo}` : tipoNormalizado;

      // Upload image to Drive (optional)
      let imageUrl = "";
      try {
        const folderId = (env as Record<string, string>).DRIVE_FOLDER_ID || "root";
        imageUrl = await uploadFile(
          folderId,
          `asistencia_${generateId()}.${input.mimeType.split("/")[1] || "jpg"}`,
          input.mimeType,
          input.imageBase64
        );
      } catch {
        // Continue without image URL
      }

      const idPlanilla = generateId();
      const fechaCarga = new Date().toLocaleDateString("es-ES");

      // Save header
      await appendRow(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado", [
        idPlanilla,
        fechaCarga,
        fechaActividad,
        tipoFinal,
        inicioActividad,
        finalizaActividad,
        acargoActividad,
        detalles,
        imageUrl,
      ]);

      // Extract and save personnel
      const secciones = ["combatientes", "activos", "especiales"] as const;
      const allPersonnel: PersonalAsistencia[] = [];

      for (const seccion of secciones) {
        const lista = extractedData[seccion];
        if (Array.isArray(lista)) {
          for (const item of lista) {
            if (!item || typeof item !== "object") continue;
            const codigoRaw = String((item as Record<string, unknown>).codigo || "").trim();
            const nombreRaw = String((item as Record<string, unknown>).nombre || "").trim();
            if (!codigoRaw && !nombreRaw) continue;

            const asistenciaRaw = String((item as Record<string, unknown>).asistencia || "AUSENTE").trim().toUpperCase();
            const asistenciaNormalizada = asistenciaRaw === "AUSENTE CON AVISO" ? "AUSENTE CON AVISO" :
              asistenciaRaw === "PRESENTE" ? "PRESENTE" : "AUSENTE";

            allPersonnel.push({
              codigo: codigoRaw,
              nombre: nombreRaw ? toTitleCase(nombreRaw) : "",
              asistencia: asistenciaNormalizada,
            });
          }
        }
      }

      // Save to Asistencia_Personal
      for (const p of allPersonnel) {
        await appendRow(env.SHEET_GUARDIAS_ID, "Asistencia_Personal", [
          "",
          idPlanilla,
          fechaCarga,
          fechaActividad,
          "",
          "",
          p.codigo,
          p.nombre,
          p.asistencia,
          input.usuarioId,
          input.usuarioNombre,
        ]);
      }

      return {
        exito: true as const,
        idPlanilla,
        tipoActividad: tipoFinal,
        fechaActividad,
        totalPersonnel: allPersonnel.length,
        presentes: allPersonnel.filter(p => p.asistencia === "PRESENTE").length,
      };
    }),

  historial: publicQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        tipo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado!A1:I5000");
      const planillas: Array<{
        idPlanilla: string;
        fechaCarga: string;
        fechaActividad: string;
        tipoActividad: string;
        inicioActividad: string;
        finalizaActividad: string;
        acargoActividad: string;
        detalles: string;
        urlImagen: string;
      }> = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const tipo = String(row[3] || "").trim();
        if (input.tipo && !tipo.toUpperCase().includes(input.tipo.toUpperCase())) continue;

        planillas.push({
          idPlanilla: String(row[0] || ""),
          fechaCarga: String(row[1] || ""),
          fechaActividad: String(row[2] || ""),
          tipoActividad: tipo,
          inicioActividad: String(row[4] || ""),
          finalizaActividad: String(row[5] || ""),
          acargoActividad: String(row[6] || ""),
          detalles: String(row[7] || ""),
          urlImagen: String(row[8] || ""),
        });
      }

      planillas.sort((a, b) => {
        const dateA = parseDate(a.fechaActividad);
        const dateB = parseDate(b.fechaActividad);
        return dateB - dateA;
      });

      const start = (input.page - 1) * input.limit;
      const end = start + input.limit;
      const paginated = planillas.slice(start, end);

      return {
        exito: true as const,
        planillas: paginated,
        total: planillas.length,
        page: input.page,
        totalPages: Math.ceil(planillas.length / input.limit),
      };
    }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:K5000");
      const personal: Array<{
        idFila: string;
        idPlanilla: string;
        fechaCarga: string;
        fechaActividad: string;
        codigo: string;
        nombre: string;
        asistencia: string;
        cargadoPorId: string;
        cargadoPorNombre: string;
      }> = [];

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1] || "").trim() === input.idPlanilla.trim()) {
          personal.push({
            idFila: String(data[i][0] || ""),
            idPlanilla: String(data[i][1] || ""),
            fechaCarga: String(data[i][2] || ""),
            fechaActividad: String(data[i][3] || ""),
            codigo: String(data[i][6] || ""),
            nombre: String(data[i][7] || ""),
            asistencia: String(data[i][8] || ""),
            cargadoPorId: String(data[i][9] || ""),
            cargadoPorNombre: String(data[i][10] || ""),
          });
        }
      }

      return { exito: true as const, personal };
    }),

  misMetricas: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const searchCode = extractNumber(input.codigo);
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:K5000");
      const asistencias: Array<{
        idPlanilla: string;
        fechaActividad: string;
        asistencia: string;
      }> = [];

      for (let i = 1; i < data.length; i++) {
        const codigoFila = String(data[i][6] || "").trim();
        const numFila = extractNumber(codigoFila);
        if (numFila === searchCode) {
          asistencias.push({
            idPlanilla: String(data[i][1] || ""),
            fechaActividad: String(data[i][3] || ""),
            asistencia: String(data[i][8] || ""),
          });
        }
      }

      const stats = {
        totalActividades: asistencias.length,
        presentes: asistencias.filter(a => a.asistencia === "PRESENTE").length,
        ausentes: asistencias.filter(a => a.asistencia === "AUSENTE").length,
        ausentesConAviso: asistencias.filter(a => a.asistencia === "AUSENTE CON AVISO").length,
      };

      return { exito: true as const, asistencias, stats };
    }),
});

function parseDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length < 3) return 0;
  const day = parseInt(parts[0]) || 1;
  const month = (parseInt(parts[1]) || 1) - 1;
  const year = parseInt(parts[2]) || 2000;
  return new Date(year, month, day).getTime();
}
