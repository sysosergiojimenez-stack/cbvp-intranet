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

// Informe de 10:41 / 10:42 (accidentes, extricaciones, rescates). Se genera
// a partir de una Salida de Movil cuyo tipo de servicio empieza con 10:41
// o 10:42. Comparte el contador correlativo de N° de Servicio con el
// Informe de Incendio.
function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
}

function informesAccidenteCollection() {
  return getFirestoreClient().collection("informesAccidente");
}

const personaSchema = z.object({
  nombre: z.string(),
  ci: z.string(),
  edad: z.string(),
  nacionalidad: z.string(),
});

const vehiculoSchema = z.object({
  tipo: z.string(),
  marca: z.string(),
  modelo: z.string(),
  color: z.string(),
  chapaNo: z.string(),
  conductor: z.string(),
  ci: z.string(),
  edad: z.string(),
  registroNo: z.string(),
  municipio: z.string(),
  domicilio: z.string(),
});

const voluntarioConductorSchema = z.object({ movil: z.string(), conductor: z.string(), codigo: z.string() });
const voluntarioCombatienteSchema = z.object({ movil: z.string(), combatiente: z.string(), codigo: z.string() });

const informeAccidenteInput = z.object({
  id: z.string().optional(),
  salidaId: z.string(),

  // "10:41" | "10:42" (casilla del encabezado)
  tipoInforme: z.string(),
  nServicio: z.string(),
  movil: z.string(),
  fecha: z.string(),
  ordenDeSalida: z.string(),
  horaSalida: z.string(),
  horaLlegada: z.string(),
  horaRetirada: z.string(),
  direccion: z.string(),
  frenteAlNo: z.string(),
  entreCalle1: z.string(),
  entreCalle2: z.string(),
  ciudad: z.string(),
  barrio: z.string(),
  zona: z.string(),
  alMandoDelActo: z.string(),
  aCargoDeLaCompania: z.string(),

  // Naturaleza de intervencion (A-G) y lugar
  naturalezaTipos: z.array(z.string()),
  naturalezaOtros: z.string(),
  lugarTipos: z.array(z.string()),

  vehiculos: z.array(vehiculoSchema),

  heridos: z.array(personaSchema),
  muertos: z.array(personaSchema),
  totalAccidentados: z.string(),
  totalHeridos: z.string(),
  totalMuertos: z.string(),

  materialesUtilizadosMoviles: z.string(),
  materialesUtilizadosMenor: z.string(),
  materialesUtilizadosAjenos: z.string(),
  otrosDeApoyo: z.string(),
  personalPolicialACargoDe: z.string(),
  ministerioPublicoOficiadoPor: z.string(),
  otrosDatosInteres: z.string(),

  causasAccidente: z.string(),
  desarrolloDelInforme: z.string(),
  nominaConductores: z.array(voluntarioConductorSchema),
  nominaCombatientes: z.array(voluntarioCombatienteSchema),
  nominaACargo: z.string(),
  nominaFirma: z.string(),
  croquisFotos: z.array(z.string()),
});

export const informeAccidenteRouter = createRouter({
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
          tipoInforme: tipoServicio.startsWith("10:42") ? "10:42" : "10:41",
          fecha: String(s.fechaSalida || ""),
          horaSalida: String(s.horaSalida || ""),
          horaLlegada: String(s.horaLlegada || ""),
          direccion: String(s.direccion || ""),
          movil: String(s.movil || ""),
          conductor,
          codigoConductor: codigoPorNombre.get(normalizarNombre(conductor)) || "",
          aCargoDeLaCompania: String(s.oficialACargo || ""),
        },
      };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await informesAccidenteCollection().get();
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
      const snap = await informesAccidenteCollection().where("salidaId", "==", input.salidaId).limit(1).get();
      if (snap.empty) return { exito: true as const, informe: null };
      const doc = snap.docs[0];
      return { exito: true as const, informe: { id: doc.id, ...doc.data() } };
    }),

  obtener: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const doc = await informesAccidenteCollection().doc(input.id).get();
      if (!doc.exists) return { exito: false as const, error: "Informe no encontrado" };
      return { exito: true as const, informe: { id: doc.id, ...doc.data() } };
    }),

  guardar: publicQuery
    .input(informeAccidenteInput)
    .mutation(async ({ input }) => {
      const { id, ...datos } = input;
      let docId = id || "";
      let nServicio = datos.nServicio.trim();

      // Una salida tiene un solo informe: si se vuelve a guardar, se
      // actualiza el mismo documento y conserva su numero.
      if (datos.salidaId) {
        const existentes = await informesAccidenteCollection().where("salidaId", "==", datos.salidaId).limit(1).get();
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

      await informesAccidenteCollection().doc(docId).set(
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
      await informesAccidenteCollection().doc(input.id).delete();
      return { exito: true as const };
    }),
});
