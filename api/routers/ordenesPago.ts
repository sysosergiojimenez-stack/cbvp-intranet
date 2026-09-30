import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { TIPOS_MOVIMIENTO_ORDEN_PAGO } from "@contracts/ordenesPago";
import { env } from "../lib/env";
import { extractOrdenPagoData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { normalizarFechaDDMMYYYY } from "../lib/fechas";

function colOrdenesPago() {
  return getFirestoreClient().collection("ordenesPago");
}

function generateId(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

const detalleItemSchema = z.object({
  descripcion: z.string(),
  bancoAlias: z.string(),
  nroCuenta: z.string(),
  monto: z.number().min(0),
});

export const ordenesPagoRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await colOrdenesPago().get();
    const ordenes = snapshot.docs
      .map((doc) => {
        const fila = doc.data();
        const detalle = Array.isArray(fila.detalle)
          ? fila.detalle.map((d: Record<string, unknown>) => ({
              descripcion: String(d.descripcion || ""),
              bancoAlias: String(d.bancoAlias || ""),
              nroCuenta: String(d.nroCuenta || ""),
              monto: Number(d.monto) || 0,
            }))
          : [];
        return {
          id: doc.id,
          numero: Number(fila.numero) || 0,
          anio: Number(fila.anio) || 0,
          fecha: String(fila.fecha || ""),
          mesaEntrada: String(fila.mesaEntrada || ""),
          bancoNombre: String(fila.bancoNombre || ""),
          bancoCuenta: String(fila.bancoCuenta || ""),
          tipoMovimiento: String(fila.tipoMovimiento || ""),
          detalle,
          total: Number(fila.total) || 0,
          observaciones: String(fila.observaciones || ""),
          comandanteNombre: String(fila.comandanteNombre || ""),
          directorNombre: String(fila.directorNombre || ""),
          creadoPor: String(fila.creadoPor || ""),
          fechaCarga: String(fila.fechaCarga || ""),
          urlDocumento: String(fila.urlDocumento || ""),
        };
      })
      .sort((a, b) => b.anio - a.anio || b.numero - a.numero);
    return { exito: true as const, ordenes };
  }),

  // Extrae fecha, banco de origen, detalle de conceptos, observaciones y
  // firmantes de una Orden de Pago vieja (en papel, de antes de este
  // sistema) subida como foto/PDF. El tipo de movimiento y la mesa de
  // entrada no se extraen -- se completan a mano en el formulario porque
  // son categorias propias de la app.
  extraer: publicQuery
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extraido = await extractOrdenPagoData(input.base64, input.mimeType);

      const fecha = normalizarFechaDDMMYYYY(String(extraido.fecha || ""));
      const bancoNombre = String(extraido.bancoNombre || "").trim();
      const bancoCuenta = String(extraido.bancoCuenta || "").trim();
      const detalleRaw = Array.isArray(extraido.detalle) ? extraido.detalle : [];
      const detalle = detalleRaw.map((d) => {
        const fila = d as Record<string, unknown>;
        return {
          descripcion: String(fila.descripcion || "").trim(),
          bancoAlias: String(fila.bancoAlias || "").trim(),
          nroCuenta: String(fila.nroCuenta || "").trim(),
          monto: Number(fila.monto) || 0,
        };
      });
      const observaciones = String(extraido.observaciones || "").trim();
      const comandanteNombre = String(extraido.comandanteNombre || "").trim();
      const directorNombre = String(extraido.directorNombre || "").trim();

      let urlDocumento = "";
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        try {
          urlDocumento = await uploadToGCS(
            bucketName,
            `orden_pago_antigua_${generateId()}.${input.mimeType.split("/")[1] || "pdf"}`,
            input.mimeType,
            input.base64
          );
        } catch (err) {
          uploadError = err instanceof Error ? err.message : String(err);
        }
      } else {
        uploadError = "GCS_BUCKET_NAME no configurado";
      }

      return {
        exito: true as const,
        fecha,
        bancoNombre,
        bancoCuenta,
        detalle,
        observaciones,
        comandanteNombre,
        directorNombre,
        urlDocumento,
        uploadError: uploadError || undefined,
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        anio: z.number(),
        fecha: z.string().min(1),
        mesaEntrada: z.string().optional(),
        bancoNombre: z.string(),
        bancoCuenta: z.string(),
        tipoMovimiento: z.enum(TIPOS_MOVIMIENTO_ORDEN_PAGO),
        detalle: z.array(detalleItemSchema).min(1),
        observaciones: z.string(),
        comandanteNombre: z.string(),
        directorNombre: z.string(),
        creadoPor: z.string().optional(),
        urlDocumento: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // El numero se recalcula en el momento de guardar (no se confia en el
      // que el cliente vio al abrir el formulario) para minimizar colisiones
      // entre dos personas cargando ordenes casi al mismo tiempo.
      const snapshot = await colOrdenesPago().where("anio", "==", input.anio).get();
      let max = 0;
      snapshot.forEach((doc) => {
        const n = Number(doc.data().numero) || 0;
        if (n > max) max = n;
      });
      const numero = max + 1;
      const total = input.detalle.reduce((acc, d) => acc + (d.monto || 0), 0);

      const id = generateId();
      await colOrdenesPago()
        .doc(id)
        .set({
          numero,
          anio: input.anio,
          fecha: input.fecha,
          mesaEntrada: input.mesaEntrada || "",
          bancoNombre: input.bancoNombre,
          bancoCuenta: input.bancoCuenta,
          tipoMovimiento: input.tipoMovimiento,
          detalle: input.detalle,
          total,
          observaciones: input.observaciones,
          comandanteNombre: input.comandanteNombre,
          directorNombre: input.directorNombre,
          creadoPor: input.creadoPor || "",
          urlDocumento: input.urlDocumento || "",
          fechaCarga: new Date().toISOString(),
        });

      return { exito: true as const, id, numero };
    }),

  editar: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        fecha: z.string().min(1),
        mesaEntrada: z.string().optional(),
        bancoNombre: z.string(),
        bancoCuenta: z.string(),
        tipoMovimiento: z.enum(TIPOS_MOVIMIENTO_ORDEN_PAGO),
        detalle: z.array(detalleItemSchema).min(1),
        observaciones: z.string(),
        comandanteNombre: z.string(),
        directorNombre: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      const total = campos.detalle.reduce((acc, d) => acc + (d.monto || 0), 0);
      await colOrdenesPago()
        .doc(id)
        .update({ ...campos, mesaEntrada: campos.mesaEntrada || "", total });
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colOrdenesPago().doc(input.id).delete();
      return { exito: true as const };
    }),
});
