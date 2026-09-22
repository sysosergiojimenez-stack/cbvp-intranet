import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colUsuarios } from "../services/usuariosFirestore";
import { env } from "../lib/env";
import { extractCuotaData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { normalizarFechaDDMMYYYY, normalizarMesAnio, sumarMesesAMesAnio } from "../lib/fechas";

// Regla del cuartel: 1 mes de cuota = 5000 Gs. Un pago que no sea multiplo
// exacto de 5000 se redondea hacia abajo (nunca se le regalan meses a nadie
// por una diferencia de centimos/redondeo en el monto escaneado).
const MONTO_POR_MES = 5000;

function colCuotas() {
  return getFirestoreClient().collection("cuotasBomberos");
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

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

export const cuotasBomberosRouter = createRouter({
  // Extrae fecha, nro de factura/recibo y monto del documento subido, y
  // calcula cuantos meses de cuota corresponden y hasta que mes quedaria
  // pagada -- todo como sugerencia, se puede corregir antes de guardar.
  extraer: publicQuery
    .input(
      z.object({
        codigo: z.string().min(1),
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extraido = await extractCuotaData(input.base64, input.mimeType);

      const fechaEmision = normalizarFechaDDMMYYYY(String((extraido as any).fechaEmision || ""));
      const nroFactura = String((extraido as any).nroFactura || "").trim();
      const montoNum = Number((extraido as any).monto) || 0;
      const meses = Math.floor(montoNum / MONTO_POR_MES);

      const searchNum = extractNumber(input.codigo);
      const snapshot = await colUsuarios().get();
      let cuotaActual = "";
      for (const doc of snapshot.docs) {
        const codigoFila = String(doc.data().codigo || "").trim();
        if (extractNumber(codigoFila) === searchNum) {
          cuotaActual = normalizarMesAnio(String(doc.data().cuota || ""));
          break;
        }
      }

      // Si el bombero nunca pago cuota (campo vacio en Listado de Personal),
      // no hay base de la cual partir -- se deja en blanco para que se
      // complete a mano en la pantalla de confirmacion, en vez de inventar
      // una fecha de arranque.
      const cuotaNueva = cuotaActual ? sumarMesesAMesAnio(cuotaActual, meses) : "";

      let urlDocumento = "";
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        try {
          urlDocumento = await uploadToGCS(
            bucketName,
            `cuota_${searchNum}_${generateId()}.${input.mimeType.split("/")[1] || "pdf"}`,
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
        fechaEmision,
        nroFactura,
        monto: montoNum,
        meses,
        cuotaActual,
        cuotaNueva,
        urlDocumento,
        uploadError: uploadError || undefined,
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        codigo: z.string().min(1),
        fechaEmision: z.string().min(1),
        nroFactura: z.string(),
        monto: z.number().min(0),
        meses: z.number().min(0),
        cuotaAnterior: z.string(),
        cuotaNueva: z.string().min(1),
        urlDocumento: z.string(),
        cargadoPor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const searchNum = extractNumber(input.codigo);
      const snapshot = await colUsuarios().get();
      let docId: string | null = null;
      let nombreBombero = "";
      for (const doc of snapshot.docs) {
        const fila = doc.data();
        const codigoFila = String(fila.codigo || "").trim();
        if (extractNumber(codigoFila) === searchNum) {
          docId = doc.id;
          nombreBombero = `${fila.primerNombre || ""} ${fila.primerApellido || ""}`.trim();
          break;
        }
      }
      if (!docId) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }

      const id = generateId();
      await colCuotas().doc(id).set({
        codigo: input.codigo,
        nombreBombero,
        fechaEmision: input.fechaEmision,
        nroFactura: input.nroFactura,
        monto: input.monto,
        meses: input.meses,
        cuotaAnterior: input.cuotaAnterior,
        cuotaNueva: normalizarMesAnio(input.cuotaNueva),
        urlDocumento: input.urlDocumento,
        cargadoPor: input.cargadoPor || "",
        fechaCarga: new Date().toISOString(),
      });

      await colUsuarios().doc(docId).update({ cuota: normalizarMesAnio(input.cuotaNueva) });

      return { exito: true as const, id };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await colCuotas().get();
    const pagos = snapshot.docs
      .map((doc) => {
        const fila = doc.data();
        return {
          id: doc.id,
          codigo: String(fila.codigo || ""),
          nombreBombero: String(fila.nombreBombero || ""),
          fechaEmision: String(fila.fechaEmision || ""),
          nroFactura: String(fila.nroFactura || ""),
          monto: Number(fila.monto) || 0,
          meses: Number(fila.meses) || 0,
          cuotaAnterior: String(fila.cuotaAnterior || ""),
          cuotaNueva: String(fila.cuotaNueva || ""),
          urlDocumento: String(fila.urlDocumento || ""),
          fechaCarga: String(fila.fechaCarga || ""),
        };
      })
      .sort((a, b) => b.fechaCarga.localeCompare(a.fechaCarga));
    return { exito: true as const, pagos };
  }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colCuotas().doc(input.id).delete();
      return { exito: true as const };
    }),
});
