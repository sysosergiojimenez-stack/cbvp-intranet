import { z } from "zod";
import { Firestore } from "@google-cloud/firestore";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { env } from "../lib/env";
import { extractSalidaMovilData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { MOVILES_VALIDOS, normalizarMovil } from "@contracts/moviles";
import { TIPOS_SERVICIO_VALIDOS, normalizarTipoServicio } from "@contracts/tiposServicio";

function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
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
          movil: normalizarMovil(String(r.movil || "")),
          conductor: String(r.conductor || "").trim(),
          oficialACargo: String(r.oficialACargo || "").trim(),
          nroTripulantes: String(r.nroTripulantes || "").trim(),
          tipoServicio: normalizarTipoServicio(String(r.tipoServicio || "")),
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
            movil: z.enum(MOVILES_VALIDOS),
            conductor: z.string(),
            oficialACargo: z.string(),
            nroTripulantes: z.string(),
            tipoServicio: z.enum(TIPOS_SERVICIO_VALIDOS),
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

      const db = getFirestoreClient();
      const batch = db.batch();
      const collection = salidasMovilCollection();
      input.registros.forEach((r, i) => {
        batch.set(collection.doc(`${idPlanilla}-${i + 1}`), {
          idPlanilla,
          fechaCarga,
          ...r,
          urlImagenes: input.imageUrls,
          creadoEn: Firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      return {
        exito: true as const,
        idPlanilla,
        totalRegistros: input.registros.length,
      };
    }),

  historial: publicQuery.query(async () => {
    const snapshot = await salidasMovilCollection().get();
    const porPlanilla = new Map<
      string,
      { idPlanilla: string; fechaCarga: string; cantidadRegistros: number; urlImagenes: string[] }
    >();

    snapshot.forEach((doc) => {
      const row = doc.data();
      const idPlanilla = String(row.idPlanilla || "");
      if (!idPlanilla) return;
      const fechaCarga = String(row.fechaCarga || "");
      const urlImagenes: string[] = Array.isArray(row.urlImagenes) ? row.urlImagenes : [];

      if (!porPlanilla.has(idPlanilla)) {
        porPlanilla.set(idPlanilla, { idPlanilla, fechaCarga, cantidadRegistros: 0, urlImagenes });
      }
      porPlanilla.get(idPlanilla)!.cantidadRegistros++;
    });

    const planillas = Array.from(porPlanilla.values()).sort((a, b) => b.idPlanilla.localeCompare(a.idPlanilla));
    return { exito: true as const, planillas };
  }),

  listado: publicQuery
    .input(
      z
        .object({
          fechaDesde: z.string().optional(),
          fechaHasta: z.string().optional(),
          movil: z.string().optional(),
          tipoServicio: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const snapshot = await salidasMovilCollection().get();
      const registros: Array<{
        id: string; movil: string; conductor: string; oficialACargo: string;
        nroTripulantes: string; tipoServicio: string; fechaSalida: string; horaSalida: string;
        kilometrajeSalida: string; direccion: string; fechaLlegada: string; horaLlegada: string;
        kilometrajeLlegada: string; imageUrls: string[];
      }> = [];
      const movilesSet = new Set<string>();
      const tiposServicioSet = new Set<string>();

      const fechaISO = (fecha: string): string => {
        const partes = fecha.split("/");
        if (partes.length !== 3) return "";
        const [d, m, y] = partes;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      };

      snapshot.forEach((doc) => {
        const row = doc.data();
        if (!row.idPlanilla) return;

        const movil = String(row.movil || "").trim();
        const tipoServicio = String(row.tipoServicio || "").trim();
        const fechaSalida = String(row.fechaSalida || "");

        if (movil) movilesSet.add(movil);
        if (tipoServicio) tiposServicioSet.add(tipoServicio);

        if (input?.movil && movil !== input.movil.trim()) return;
        if (input?.tipoServicio && tipoServicio !== input.tipoServicio.trim()) return;
        if (input?.fechaDesde || input?.fechaHasta) {
          const fISO = fechaISO(fechaSalida);
          if (!fISO) return;
          if (input.fechaDesde && fISO < input.fechaDesde) return;
          if (input.fechaHasta && fISO > input.fechaHasta) return;
        }

        const imageUrls: string[] = Array.isArray(row.urlImagenes) ? row.urlImagenes : [];
        registros.push({
          id: doc.id,
          movil: String(row.movil || ""),
          conductor: String(row.conductor || ""),
          oficialACargo: String(row.oficialACargo || ""),
          nroTripulantes: String(row.nroTripulantes || ""),
          tipoServicio: String(row.tipoServicio || ""),
          fechaSalida,
          horaSalida: String(row.horaSalida || ""),
          kilometrajeSalida: String(row.kilometrajeSalida || ""),
          direccion: String(row.direccion || ""),
          fechaLlegada: String(row.fechaLlegada || ""),
          horaLlegada: String(row.horaLlegada || ""),
          kilometrajeLlegada: String(row.kilometrajeLlegada || ""),
          imageUrls,
        });
      });

      const claveOrden = (r: (typeof registros)[0]): string => {
        const partes = r.fechaSalida.split("/");
        if (partes.length !== 3) return "0000-00-00 00:00";
        const [d, m, y] = partes;
        const hora = r.horaSalida || "00:00";
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")} ${hora}`;
      };

      registros.sort((a, b) => claveOrden(b).localeCompare(claveOrden(a)));

      return {
        exito: true as const,
        registros,
        moviles: Array.from(movilesSet).sort(),
        tiposServicio: Array.from(tiposServicioSet).sort(),
      };
    }),

  editar: publicQuery
    .input(
      z.object({
        id: z.string(),
        movil: z.enum(MOVILES_VALIDOS),
        conductor: z.string(),
        oficialACargo: z.string(),
        nroTripulantes: z.string(),
        tipoServicio: z.enum(TIPOS_SERVICIO_VALIDOS),
        fechaSalida: z.string(),
        horaSalida: z.string(),
        kilometrajeSalida: z.string(),
        direccion: z.string(),
        fechaLlegada: z.string(),
        horaLlegada: z.string(),
        kilometrajeLlegada: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      await salidasMovilCollection().doc(id).update(campos);
      return { exito: true as const, mensaje: "Registro actualizado" };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await salidasMovilCollection().doc(input.id).delete();
      return { exito: true as const, mensaje: "Registro eliminado" };
    }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await salidasMovilCollection()
        .where("idPlanilla", "==", input.idPlanilla.trim())
        .get();
      const registros = snapshot.docs.map((doc) => {
        const row = doc.data();
        return {
          id: doc.id,
          movil: String(row.movil || ""),
          conductor: String(row.conductor || ""),
          oficialACargo: String(row.oficialACargo || ""),
          nroTripulantes: String(row.nroTripulantes || ""),
          tipoServicio: String(row.tipoServicio || ""),
          fechaSalida: String(row.fechaSalida || ""),
          horaSalida: String(row.horaSalida || ""),
          kilometrajeSalida: String(row.kilometrajeSalida || ""),
          direccion: String(row.direccion || ""),
          fechaLlegada: String(row.fechaLlegada || ""),
          horaLlegada: String(row.horaLlegada || ""),
          kilometrajeLlegada: String(row.kilometrajeLlegada || ""),
        };
      });
      return { exito: true as const, registros };
    }),

  estadisticasServicios: publicQuery
    .input(z.object({ mes: z.number().min(1).max(12), anio: z.number() }))
    .query(async ({ input }) => {
      const snapshot = await salidasMovilCollection().get();
      const conteo = new Map<string, number>();
      let total = 0;
      snapshot.forEach((doc) => {
        const row = doc.data();
        if (!row.idPlanilla) return;
        const fechaSalida = String(row.fechaSalida || "").trim();
        const tipoServicio = String(row.tipoServicio || "").trim();
        if (!fechaSalida || !tipoServicio) return;
        const partes = fechaSalida.split("/");
        if (partes.length !== 3) return;
        const mesFila = parseInt(partes[1], 10);
        const anioFila = parseInt(partes[2], 10);
        if (mesFila !== input.mes || anioFila !== input.anio) return;
        conteo.set(tipoServicio, (conteo.get(tipoServicio) || 0) + 1);
        total++;
      });
      const tipos = Array.from(conteo.entries())
        .map(([tipo, cantidad]) => ({ tipo, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
      return { exito: true as const, tipos, total };
    }),
});
