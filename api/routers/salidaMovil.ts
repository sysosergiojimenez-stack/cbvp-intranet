import { z } from "zod";
import { Firestore } from "@google-cloud/firestore";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { env } from "../lib/env";
import { extractSalidaMovilData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { MOVILES_VALIDOS, normalizarMovil } from "@contracts/moviles";
import { TIPOS_SERVICIO_VALIDOS, normalizarTipoServicio } from "@contracts/tiposServicio";
import { crearNotificacion } from "../services/notificacionesFirestore";
import { enviarNotificacion } from "../services/pushNotifications";
import { getCodigosPorNivelMinimo } from "../lib/notificacionesHelpers";

function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
}

// Algunos registros viejos tienen el anio de fechaSalida en 2 digitos ("26"
// en vez de "2026"), lo que rompe tanto la comparacion lexicografica de
// fechas como el filtro exacto por anio numerico si no se normaliza antes.
function normalizarAnio(y: string): string {
  return y.length === 2 ? `20${y}` : y;
}

// El frontend usa <input type="date">, que exige exactamente DD/MM/AAAA
// (dia y mes con 2 digitos, anio con 4) para poder mostrar el valor en el
// picker -- si no coincide, el campo se ve vacio en la UI aunque el dato
// siga guardado como texto. Gemini normalmente ya devuelve este formato
// (se lo pide el prompt), pero puede variar: sin cero a la izquierda, con
// "-" o "." como separador, con anio de 2 digitos, o en formato ISO. Se
// normaliza aca para blindar el contrato con el picker sin depender 100%
// de que el modelo siga la instruccion al pie de la letra.
function normalizarFechaDDMMYYYY(valor: string): string {
  const v = valor.trim();
  if (!v) return "";

  // DD/MM/AAAA, DD-MM-AAAA o DD.MM.AAAA (con o sin ceros a la izquierda,
  // anio de 2 o 4 digitos)
  const conSeparador = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (conSeparador) {
    const [, d, m, y] = conSeparador;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${normalizarAnio(y)}`;
  }

  // AAAA-MM-DD (ISO), por si el modelo devuelve este formato en vez del pedido
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }

  // No reconocido: se deja tal cual (visible en el JSON crudo / editable a
  // mano) en vez de descartarlo, seria peor perder el dato que Gemini leyo.
  return v;
}

// <input type="time"> exige HH:mm exacto (24hs, sin segundos ni AM/PM).
function normalizarHoraHHmm(valor: string): string {
  const v = valor.trim();
  if (!v) return "";

  const conAmPm = v.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*([AaPp])\.?[Mm]\.?$/);
  if (conAmPm) {
    let [, h, min, ampm] = conAmPm;
    let hora = parseInt(h, 10) % 12;
    if (ampm.toLowerCase() === "p") hora += 12;
    return `${String(hora).padStart(2, "0")}:${min.padStart(2, "0")}`;
  }

  const simple = v.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (simple) {
    const [, h, min] = simple;
    return `${h.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }

  return v;
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
          fechaSalida: normalizarFechaDDMMYYYY(String(r.fechaSalida || "")),
          horaSalida: normalizarHoraHHmm(String(r.horaSalida || "")),
          kilometrajeSalida: String(r.kilometrajeSalida || "").trim(),
          direccion: String(r.direccion || "").trim(),
          fechaLlegada: normalizarFechaDDMMYYYY(String(r.fechaLlegada || "")),
          horaLlegada: normalizarHoraHHmm(String(r.horaLlegada || "")),
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
          fechaSalida: normalizarFechaDDMMYYYY(r.fechaSalida),
          horaSalida: normalizarHoraHHmm(r.horaSalida),
          fechaLlegada: normalizarFechaDDMMYYYY(r.fechaLlegada),
          horaLlegada: normalizarHoraHHmm(r.horaLlegada),
          urlImagenes: input.imageUrls,
          creadoEn: Firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      // Toda salida "10:40 X" es un incendio (Edificio, Vivienda, Pastizal,
      // etc. -- ver contracts/tiposServicio.ts) y queda pendiente de un
      // Informe de Servicios en el modulo del Comandante de Compania. Se
      // avisa con una sola notificacion aunque la planilla traiga varias.
      const direccionesIncendio = input.registros
        .filter((r) => r.tipoServicio.startsWith("10:40 "))
        .map((r) => r.direccion.trim())
        .filter(Boolean);
      if (direccionesIncendio.length > 0) {
        const listado = direccionesIncendio.slice(0, 3).join(", ");
        const restantes = direccionesIncendio.length - 3;
        const tituloIncendio = direccionesIncendio.length === 1 ? "Nueva salida de incendio" : `${direccionesIncendio.length} nuevas salidas de incendio`;
        const mensajeIncendio = `Pendiente de Informe de Servicios: ${listado}${restantes > 0 ? ` y ${restantes} mas` : ""}.`;
        await crearNotificacion({
          tipo: "informe_incendio",
          titulo: tituloIncendio,
          mensaje: mensajeIncendio,
          link: "/informe-servicios",
        });
        // El push (a diferencia de la notificacion en la app, que es visible
        // para todos) se limita a nivel 3+ -- son quienes gestionan el
        // Informe de Servicios, no hace falta interrumpir a todo el personal.
        getCodigosPorNivelMinimo(3)
          .then((codigos) => enviarNotificacion(codigos, {
            title: tituloIncendio,
            body: mensajeIncendio,
            url: "/informe-servicios",
          }))
          .catch((err) => console.error("Error enviando push de salida de incendio:", err));
      }

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
        return `${normalizarAnio(y)}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
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
        return `${normalizarAnio(y)}-${m.padStart(2, "0")}-${d.padStart(2, "0")} ${hora}`;
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
      await salidasMovilCollection().doc(id).update({
        ...campos,
        fechaSalida: normalizarFechaDDMMYYYY(campos.fechaSalida),
        horaSalida: normalizarHoraHHmm(campos.horaSalida),
        fechaLlegada: normalizarFechaDDMMYYYY(campos.fechaLlegada),
        horaLlegada: normalizarHoraHHmm(campos.horaLlegada),
      });
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
        const anioFila = parseInt(normalizarAnio(partes[2]), 10);
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
