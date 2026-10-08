import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colUsuarios } from "../services/usuariosFirestore";
import {
  asignarNumeroCorrelativo,
  generateId,
  normalizarFechaDDMMYYYY,
  normalizarNombre,
  numeroDe,
} from "./informeIncendio";

// Historia Prehospitalaria: se genera a partir de una Salida de Movil de
// asistencia a pacientes (10:44, 10:49, 10:50 o 10:51). Comparte el contador
// correlativo de N° de Servicio con los demas informes de servicio.
function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
}

function historiasCollection() {
  return getFirestoreClient().collection("informesPrehospitalarios");
}

const signoVitalSchema = z.object({
  hora: z.string(), fc: z.string(), fr: z.string(), pa: z.string(), temp: z.string(),
});
const respondienteSchema = z.object({ nombre: z.string(), cod: z.string() });

const historiaInput = z.object({
  id: z.string().optional(),
  salidaId: z.string(),
  tipoInforme: z.string(),
  nServicio: z.string(),
  movil: z.string(),
  fecha: z.string(),
  direccion: z.string(),
  nombre: z.string(),
  edad: z.string(),
  sexo: z.string(),
  destino: z.string(),
  prioridadTriage: z.string(),
  signosVitales: z.array(signoVitalSchema),
  // Casillas y textos del formulario, con clave "<grupo>_<item>"
  checks: z.record(z.string(), z.boolean()),
  textos: z.record(z.string(), z.string()),
  glasgowOjos: z.number().min(1).max(4).nullable(),
  glasgowVerbal: z.number().min(1).max(5).nullable(),
  glasgowMotora: z.number().min(1).max(6).nullable(),
  respondientes: z.array(respondienteSchema),
});

export const informePrehospitalarioRouter = createRouter({
  // Datos de la salida elegida, para precompletar un informe nuevo.
  datosDesdeSalida: publicQuery
    .input(z.object({ salidaId: z.string() }))
    .query(async ({ input }) => {
      const doc = await salidasMovilCollection().doc(input.salidaId).get();
      if (!doc.exists) return { exito: false as const, error: "Salida no encontrada" };
      const s = doc.data() || {};

      const personalSnap = await colUsuarios().get();
      const codigoPorNombre = new Map<string, string>();
      personalSnap.forEach((pdoc) => {
        const fila = pdoc.data();
        const nombre = normalizarNombre(`${fila.primerNombre || ""} ${fila.primerApellido || ""}`);
        if (nombre) codigoPorNombre.set(nombre, String(fila.codigoRadial || ""));
      });

      const conductor = String(s.conductor || "");
      const tipoServicio = String(s.tipoServicio || "");
      return {
        exito: true as const,
        datos: {
          tipoInforme: tipoServicio.match(/^\d{2}:\d{2}/)?.[0] || "10:44",
          fecha: String(s.fechaSalida || ""),
          direccion: String(s.direccion || ""),
          movil: String(s.movil || ""),
          conductor,
          codigoConductor: codigoPorNombre.get(normalizarNombre(conductor)) || "",
        },
      };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await historiasCollection().get();
    const informes = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .map((i) => ({
        id: i.id,
        salidaId: String(i.salidaId || ""),
        tipoInforme: String(i.tipoInforme || ""),
        nServicio: String(i.nServicio || ""),
        fecha: String(i.fecha || ""),
        direccion: String(i.direccion || ""),
        movil: String(i.movil || ""),
      }))
      .sort((a, b) => numeroDe(b.nServicio) - numeroDe(a.nServicio));
    return { exito: true as const, informes };
  }),

  porSalida: publicQuery
    .input(z.object({ salidaId: z.string() }))
    .query(async ({ input }) => {
      const snap = await historiasCollection().where("salidaId", "==", input.salidaId).limit(1).get();
      if (snap.empty) return { exito: true as const, informe: null };
      const doc = snap.docs[0];
      return { exito: true as const, informe: { id: doc.id, ...doc.data() } };
    }),

  obtener: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const doc = await historiasCollection().doc(input.id).get();
      if (!doc.exists) return { exito: false as const, error: "Informe no encontrado" };
      return { exito: true as const, informe: { id: doc.id, ...doc.data() } };
    }),

  guardar: publicQuery
    .input(historiaInput)
    .mutation(async ({ input }) => {
      const { id, ...datos } = input;
      let docId = id || "";
      let nServicio = datos.nServicio.trim();

      // Una salida tiene un solo informe: si se vuelve a guardar, se
      // actualiza el mismo documento y conserva su numero.
      if (datos.salidaId) {
        const existentes = await historiasCollection().where("salidaId", "==", datos.salidaId).limit(1).get();
        if (!existentes.empty) {
          const previo = existentes.docs[0];
          if (!docId || docId === previo.id) {
            docId = previo.id;
            if (!nServicio) nServicio = String(previo.data().nServicio || "");
          }
        }
      }

      if (!nServicio) nServicio = await asignarNumeroCorrelativo();
      docId = docId || generateId();

      await historiasCollection().doc(docId).set(
        {
          ...datos,
          nServicio,
          fecha: normalizarFechaDDMMYYYY(datos.fecha),
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true }
      );
      return { exito: true as const, id: docId, nServicio };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await historiasCollection().doc(input.id).delete();
      return { exito: true as const };
    }),
});
