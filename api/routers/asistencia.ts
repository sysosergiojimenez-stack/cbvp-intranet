import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange, deleteRows, getSheetId } from "../services/sheets";
import { env } from "../lib/env";
import { extractAsistenciaData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";

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

function parseImageUrls(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // No es JSON, es el formato viejo (una sola URL como texto plano)
  }
  return [value];
}

interface PersonalAsistencia {
  codigo: string;
  nombre: string;
  asistencia: string;
}

export const asistenciaRouter = createRouter({
  extraer: publicQuery
    .input(
      z.object({
        images: z
          .array(
            z.object({
              base64: z.string().min(1),
              mimeType: z.string().min(1),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extractedData = await extractAsistenciaData(
        input.images.map(img => ({ base64Content: img.base64, mimeType: img.mimeType }))
      );

      if (!extractedData || typeof extractedData !== "object") {
        return { exito: false as const, error: "No se pudieron extraer datos de las imagenes" };
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

      const imageUrls: string[] = [];
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        for (let i = 0; i < input.images.length; i++) {
          try {
            const img = input.images[i];
            const url = await uploadToGCS(
              bucketName,
              `asistencia_${generateId()}_${i}.${img.mimeType.split("/")[1] || "jpg"}`,
              img.mimeType,
              img.base64
            );
            imageUrls.push(url);
            console.log("[Asistencia] Imagen subida a GCS:", url);
          } catch (err) {
            uploadError = err instanceof Error ? err.message : String(err);
            console.error("[Asistencia] Error subiendo imagen a GCS:", uploadError);
          }
        }
      } else {
        uploadError = "GCS_BUCKET_NAME no configurado";
        console.error("[Asistencia] GCS_BUCKET_NAME no configurado");
      }

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
            const asistenciaNormalizada = asistenciaRaw === "COMISIONADO" || asistenciaRaw === "COMISIONADA" ? "COMISIONADO" :
              asistenciaRaw === "PRESENTE" ? "PRESENTE" : "AUSENTE";

            allPersonnel.push({
              codigo: codigoRaw,
              nombre: nombreRaw ? toTitleCase(nombreRaw) : "",
              asistencia: asistenciaNormalizada,
            });
          }
        }
      }

      return {
        exito: true as const,
        imageUrls,
        uploadError: uploadError || undefined,
        datos: {
          tipoActividad: tipoFinal,
          fechaActividad,
          inicioActividad,
          finalizaActividad,
          acargoActividad,
          detalles,
          personal: allPersonnel,
        },
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        imageUrls: z.array(z.string()),
        datos: z.object({
          tipoActividad: z.string(),
          fechaActividad: z.string(),
          inicioActividad: z.string(),
          finalizaActividad: z.string(),
          acargoActividad: z.string(),
          detalles: z.string(),
          personal: z.array(
            z.object({
              codigo: z.string(),
              nombre: z.string(),
              asistencia: z.string(),
            })
          ),
        }),
        usuarioId: z.string(),
        usuarioNombre: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const idPlanilla = generateId();
      const fechaCarga = new Date().toLocaleDateString("es-ES");
      const d = input.datos;

      await appendRow(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado", [
        idPlanilla,
        fechaCarga,
        d.fechaActividad,
        d.tipoActividad,
        d.inicioActividad,
        d.finalizaActividad,
        d.acargoActividad,
        d.detalles,
        JSON.stringify(input.imageUrls),
      ]);

      for (const p of d.personal) {
        await appendRow(env.SHEET_GUARDIAS_ID, "Asistencia_Personal", [
          "",
          idPlanilla,
          fechaCarga,
          d.fechaActividad,
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
        totalPersonnel: d.personal.length,
        presentes: d.personal.filter(p => p.asistencia === "PRESENTE").length,
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
        urlImagenes: string[];
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
          urlImagenes: parseImageUrls(String(row[8] || "")),
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

  editarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        codigo: z.string(),
        nuevaAsistencia: z.enum(["PRESENTE", "AUSENTE", "COMISIONADO"]),
      })
    )
    .mutation(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:K5000");

      for (let i = 1; i < data.length; i++) {
        const rowIdPlanilla = String(data[i][1] || "").trim();
        const rowCodigo = String(data[i][6] || "").trim();
        if (rowIdPlanilla === input.idPlanilla.trim() && rowCodigo === input.codigo.trim()) {
          // Update column I (index 8) = asistencia
          await updateRange(
            env.SHEET_GUARDIAS_ID,
            `Asistencia_Personal!I${i + 1}:I${i + 1}`,
            [[input.nuevaAsistencia]]
          );
          return { exito: true as const, mensaje: "Asistencia actualizada" };
        }
      }

      return { exito: false as const, error: "Bombero no encontrado en la planilla" };
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
        comisionados: asistencias.filter(a => a.asistencia === "COMISIONADO").length,
      };

      return { exito: true as const, asistencias, stats };
    }),

  eliminar: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .mutation(async ({ input }) => {
      // Find header row
      const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado!A1:I5000");
      let encRowIndex = -1;
      for (let i = 1; i < encData.length; i++) {
        if (String(encData[i][0] || "").trim() === input.idPlanilla.trim()) {
          encRowIndex = i;
          break;
        }
      }
      if (encRowIndex === -1) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      // Delete header row (encRowIndex is 0-based array index, add 1 for 1-based row number)
      const encSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado");
      await deleteRows(env.SHEET_GUARDIAS_ID, encSheetId, [encRowIndex + 1]);

      // Find and delete all personnel rows (from bottom to top)
      const persData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:K5000");
      const rowsToDelete: number[] = [];
      for (let i = 1; i < persData.length; i++) {
        if (String(persData[i][1] || "").trim() === input.idPlanilla.trim()) {
          rowsToDelete.push(i);
        }
      }

      if (rowsToDelete.length > 0) {
        const persSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Asistencia_Personal");
        // Convert 0-based array indices to 1-based row numbers for deleteRows
        const rowNumbers = rowsToDelete.map(idx => idx + 1).sort((a, b) => b - a);
        for (const rowNum of rowNumbers) {
          await deleteRows(env.SHEET_GUARDIAS_ID, persSheetId, [rowNum]);
        }
      }

      return { exito: true as const, mensaje: "Planilla eliminada correctamente" };
    }),

  editar: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        fechaActividad: z.string().optional(),
        tipoActividad: z.string().optional(),
        inicioActividad: z.string().optional(),
        finalizaActividad: z.string().optional(),
        acargoActividad: z.string().optional(),
        detalles: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Find header row
      const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado!A1:I5000");
      let encRowIndex = -1;
      for (let i = 1; i < encData.length; i++) {
        if (String(encData[i][0] || "").trim() === input.idPlanilla.trim()) {
          encRowIndex = i;
          break;
        }
      }
      if (encRowIndex === -1) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      // Build updated row preserving existing values
      const existingRow = encData[encRowIndex];
      const updatedRow = [
        existingRow[0],                                     // A: idPlanilla (unchanged)
        existingRow[1],                                     // B: fechaCarga (unchanged)
        input.fechaActividad ?? existingRow[2] ?? "",      // C: fechaActividad
        input.tipoActividad ?? existingRow[3] ?? "",       // D: tipoActividad
        input.inicioActividad ?? existingRow[4] ?? "",     // E: inicioActividad
        input.finalizaActividad ?? existingRow[5] ?? "",   // F: finalizaActividad
        input.acargoActividad ?? existingRow[6] ?? "",     // G: acargoActividad
        input.detalles ?? existingRow[7] ?? "",            // H: detalles
        existingRow[8] ?? "",                              // I: urlImagen (unchanged)
      ];

      await updateRange(
        env.SHEET_GUARDIAS_ID,
        `Asistencia_Encabezado!A${encRowIndex + 1}:I${encRowIndex + 1}`,
        [updatedRow]
      );

      return { exito: true as const, mensaje: "Planilla actualizada correctamente" };
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
