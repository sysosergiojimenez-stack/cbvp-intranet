import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { env } from "../lib/env";
import { extractFacturaGastoData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { normalizarFechaISO } from "../lib/fechas";

function colFacturasGastos() {
  return getFirestoreClient().collection("facturasGastos");
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

export const facturasGastosRouter = createRouter({
  // Extrae Nro Factura, Fecha, Proveedor, Detalle y Monto de la foto/PDF
  // subido con IA. "Pagado desde" no se extrae -- se carga a mano en la
  // pantalla de confirmacion porque no figura en el documento.
  extraer: publicQuery
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extraido = await extractFacturaGastoData(input.base64, input.mimeType);

      const nroFactura = String(extraido.nroFactura || "").trim();
      const fecha = normalizarFechaISO(String(extraido.fecha || ""));
      const proveedor = String(extraido.proveedor || "").trim();
      const detalle = String(extraido.detalle || "").trim();
      const monto = Number(extraido.monto) || 0;

      let urlDocumento = "";
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        try {
          urlDocumento = await uploadToGCS(
            bucketName,
            `factura_gasto_${generateId()}.${input.mimeType.split("/")[1] || "pdf"}`,
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
        nroFactura,
        fecha,
        proveedor,
        detalle,
        monto,
        urlDocumento,
        uploadError: uploadError || undefined,
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        nroFactura: z.string(),
        fecha: z.string().min(1),
        proveedor: z.string().min(1),
        detalle: z.string(),
        monto: z.number().min(0),
        pagadoDesdeTipo: z.enum(["CAJA_CHICA", "ORDEN_PAGO"]),
        pagadoDesdeOrdenId: z.string().optional(),
        pagadoDesdeLabel: z.string().min(1),
        urlDocumento: z.string(),
        cargadoPor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      await colFacturasGastos()
        .doc(id)
        .set({
          ...input,
          pagadoDesdeOrdenId: input.pagadoDesdeOrdenId || "",
          cargadoPor: input.cargadoPor || "",
          fechaCarga: new Date().toISOString(),
        });
      return { exito: true as const, id };
    }),

  editar: publicQuery
    .input(
      z.object({
        id: z.string().min(1),
        nroFactura: z.string(),
        fecha: z.string().min(1),
        proveedor: z.string().min(1),
        detalle: z.string(),
        monto: z.number().min(0),
        pagadoDesdeTipo: z.enum(["CAJA_CHICA", "ORDEN_PAGO"]),
        pagadoDesdeOrdenId: z.string().optional(),
        pagadoDesdeLabel: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      await colFacturasGastos()
        .doc(id)
        .update({ ...campos, pagadoDesdeOrdenId: campos.pagadoDesdeOrdenId || "" });
      return { exito: true as const };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await colFacturasGastos().get();
    const facturas = snapshot.docs
      .map((doc) => {
        const fila = doc.data();
        return {
          id: doc.id,
          nroFactura: String(fila.nroFactura || ""),
          fecha: String(fila.fecha || ""),
          proveedor: String(fila.proveedor || ""),
          detalle: String(fila.detalle || ""),
          monto: Number(fila.monto) || 0,
          pagadoDesdeTipo: fila.pagadoDesdeTipo === "ORDEN_PAGO" ? ("ORDEN_PAGO" as const) : ("CAJA_CHICA" as const),
          pagadoDesdeOrdenId: String(fila.pagadoDesdeOrdenId || ""),
          pagadoDesdeLabel: String(fila.pagadoDesdeLabel || ""),
          urlDocumento: String(fila.urlDocumento || ""),
          fechaCarga: String(fila.fechaCarga || ""),
        };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { exito: true as const, facturas };
  }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colFacturasGastos().doc(input.id).delete();
      return { exito: true as const };
    }),
});
