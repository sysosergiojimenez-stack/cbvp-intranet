import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow } from "../services/sheets";
import { env } from "../lib/env";
import { extractSalidaMovilData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

interface RegistroMovil {
  movil: string;
  conductor: string;
  oficialACargo: string;
  nroTripulantes: string;
  tipoServicio: string;
  fechaSalida: string;
  horaSalida: string;
  kilometrajeSalida: string;
  direccion: string;
  fechaLlegada: string;
  horaLlegada: string;
  kilometrajeLlegada: string;
}

export const salidaMovilRouter = createRouter({
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
      const extractedData = await extractSalidaMovilData(
        input.images.map((img) => ({ base64Content: img.base64, mimeType: img.mimeType }))
      );

      const registrosRaw = Array.isArray((extractedData as any).registros)
        ? (extractedData as any).registros
        : [];
      const registros: RegistroMovil[] = registrosRaw
        .filter((r: any) => r && typeof r === "object")
        .map((r: any) => ({
          movil: String(r.movil || "").trim(),
          conductor: String(r.conductor || "").trim(),
          oficialACargo: String(r.oficialACargo || "").trim(),
          nroTripulantes: String(r.nroTripulantes || "").trim(),
          tipoServicio: String(r.tipoServicio || "").trim(),
          fechaSalida: String(r.fechaSalida || "").trim(),
          horaSalida: String(r.horaSalida || "").trim(),
          kilometrajeSalida: String(r.kilometrajeSalida || "").trim(),
          direccion: String(r.direccion || "").trim(),
          fechaLlegada: String(r.fechaLlegada || "").trim(),
          horaLlegada: String(r.horaLlegada || "").trim(),
          kilometrajeLlegada: String(r.kilometrajeLlegada || "").trim(),
        }))
        .filter((r: RegistroMovil) => r.movil || r.conductor || r.fechaSalida);

      const imageUrls: string[] = [];
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        for (let i = 0; i < input.images.length; i++) {
          try {
            const img = input.images[i];
            const url = await uploadToGCS(
              bucketName,
              `salida_movil_${generateId()}_${i}.${img.mimeType.split("/")[1] || "jpg"}`,
              img.mimeType,
              img.base64
            );
            imageUrls.push(url);
          } catch (err) {
            uploadError = err instanceof Error ? err.message : String(err);
          }
        }
      } else {
        uploadError = "GCS_BUCKET_NAME no configurado";
      }

      return {
        exito: true as const,
        imageUrls,
        uploadError: uploadError || undefined,
        registros,
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        imageUrls: z.array(z.string()),
        registros: z.array(
          z.object({
            movil: z.string(),
            conductor: z.string(),
            oficialACargo: z.string(),
            nroTripulantes: z.string(),
            tipoServicio: z.string(),
            fechaSalida: z.string(),
            horaSalida: z.string(),
            kilometrajeSalida: z.string(),
            direccion: z.string(),
            fechaLlegada: z.string(),
            horaLlegada: z.string(),
            kilometrajeLlegada: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const idPlanilla = generateId();
      const fechaCarga = new Date().toLocaleDateString("es-ES");
      const urlImagenes = JSON.stringify(input.imageUrls);

      for (let i = 0; i < input.registros.length; i++) {
        const r = input.registros[i];
        await appendRow(env.SHEET_GUARDIAS_ID, "SALIDAS_MOVIL", [
          `${idPlanilla}-${i + 1}`,
          idPlanilla,
          fechaCarga,
          r.movil,
          r.conductor,
          r.oficialACargo,
          r.nroTripulantes,
          r.tipoServicio,
          r.fechaSalida,
          r.horaSalida,
          r.kilometrajeSalida,
          r.direccion,
          r.fechaLlegada,
          r.horaLlegada,
          r.kilometrajeLlegada,
          urlImagenes,
        ]);
      }

      return {
        exito: true as const,
        idPlanilla,
        totalRegistros: input.registros.length,
      };
    }),

  historial: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_GUARDIAS_ID, "SALIDAS_MOVIL!A1:P5000");
    const porPlanilla = new Map<
      string,
      { idPlanilla: string; fechaCarga: string; cantidadRegistros: number; urlImagenes: string[] }
    >();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const idPlanilla = String(row[1] || "");
      if (!idPlanilla) continue;
      const fechaCarga = String(row[2] || "");
      let urlImagenes: string[] = [];
      try {
        const parsed = JSON.parse(String(row[15] || ""));
        if (Array.isArray(parsed)) urlImagenes = parsed;
      } catch {
        /* ignore */
      }

      if (!porPlanilla.has(idPlanilla)) {
        porPlanilla.set(idPlanilla, { idPlanilla, fechaCarga, cantidadRegistros: 0, urlImagenes });
      }
      porPlanilla.get(idPlanilla)!.cantidadRegistros++;
    }

    const planillas = Array.from(porPlanilla.values()).sort((a, b) => b.idPlanilla.localeCompare(a.idPlanilla));
    return { exito: true as const, planillas };
  }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "SALIDAS_MOVIL!A1:P5000");
      const registros = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (String(row[1] || "").trim() === input.idPlanilla.trim()) {
          registros.push({
            id: String(row[0] || ""),
            movil: String(row[3] || ""),
            conductor: String(row[4] || ""),
            oficialACargo: String(row[5] || ""),
            nroTripulantes: String(row[6] || ""),
            tipoServicio: String(row[7] || ""),
            fechaSalida: String(row[8] || ""),
            horaSalida: String(row[9] || ""),
            kilometrajeSalida: String(row[10] || ""),
            direccion: String(row[11] || ""),
            fechaLlegada: String(row[12] || ""),
            horaLlegada: String(row[13] || ""),
            kilometrajeLlegada: String(row[14] || ""),
          });
        }
      }
      return { exito: true as const, registros };
    }),
});
