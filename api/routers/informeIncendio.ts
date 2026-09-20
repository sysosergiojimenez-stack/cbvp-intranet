import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colUsuarios } from "../services/usuariosFirestore";

// Los 7 tipos de servicio "10:40" del catalogo son, todos, despachos de
// incendio (edificio, vivienda, pastizal, basural, deposito, local
// comercial, vehicular) -- son las unicas salidas elegibles para generar
// un Informe de Incendio.
const TIPOS_SERVICIO_INCENDIO = new Set([
  "10:40 EDIFICIO",
  "10:40 VIVIENDA",
  "10:40 PASTIZAL",
  "10:40 BASURAL",
  "10:40 DEPOSITO",
  "10:40 LOCAL COMERCIAL",
  "10:40 VEHICULAR",
]);

function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
}

function informesIncendioCollection() {
  return getFirestoreClient().collection("informesIncendio");
}

const personaSchema = z.object({
  nombre: z.string(),
  ci: z.string(),
  edad: z.string(),
  nacionalidad: z.string(),
});

const voluntarioConductorSchema = z.object({
  movil: z.string(),
  conductor: z.string(),
  codigo: z.string(),
});

const voluntarioCombatienteSchema = z.object({
  movil: z.string(),
  combatiente: z.string(),
  codigo: z.string(),
});

// Todos los campos del formulario oficial "Informe de Incendio" (frente y
// dorso). Los que se pueden completar solos desde la Salida de Movil de
// origen se marcan abajo; el resto lo completa el Comandante a mano -- no
// existe ese dato en ningun otro lado de la app hoy.
const informeIncendioInput = z.object({
  id: z.string().optional(),
  salidaId: z.string(),

  // Encabezado (prefill desde la salida + N Servicio libre)
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

  // Seguro / magnitud / transporte
  seguro: z.string(),
  seguroEmpresa: z.string(),
  seguroValor: z.string(),
  magnitud: z.string(),
  transporteAereoTipo: z.string(),
  transporteTerrestreTipo: z.string(),
  transporteAcuaticoTipo: z.string(),

  // Edificio / forestal
  edificioTipos: z.array(z.string()),
  edificioComercialTipoDetalle: z.string(),
  edificioPublicoTipoDetalle: z.string(),
  edificioMatConstruccion: z.string(),
  edificioEspecificarTipo: z.string(),
  forestalBosqueTipo: z.string(),
  forestalPastizalTipo: z.string(),
  forestalOtrosEspecificar: z.string(),

  // Identificacion del local / transporte
  propietarioChofer: z.string(),
  identCI: z.string(),
  identEdad: z.string(),
  identNacionalidad: z.string(),
  identEstadoCivil: z.string(),
  identRegNo: z.string(),
  identTelPart: z.string(),
  identDireccionPart: z.string(),
  identTelLab: z.string(),
  identDireccionLab: z.string(),
  identMaterialContenidoRamo: z.string(),

  // Vehiculo involucrado
  vehiculoTipo: z.string(),
  vehiculoMarca: z.string(),
  vehiculoModelo: z.string(),
  vehiculoChapaNo: z.string(),

  // Causa / estado del fuego / propagacion
  posibleCausa: z.string(),
  posibleOrigen: z.string(),
  estadoFuego: z.number().min(1).max(10).nullable(),
  factoresPropagacion: z.string(),
  accesoLocal: z.string(),
  accesoViolentadoPor: z.string(),
  colorLlamas: z.string(),
  colorHumo: z.string(),
  oloresIdentificados: z.string(),
  materialesExplosivos: z.boolean(),
  materialesInflamables: z.boolean(),
  materialesToxicos: z.boolean(),
  materialesOtros: z.boolean(),

  // Afectados
  inmueblesAfectadosFuego: z.string(),
  inmueblesAfectadosExtincion: z.string(),
  objetosAfectadosFuego: z.string(),
  objetosAfectadosExtincion: z.string(),

  // Dorso: heridos / muertos
  heridos: z.array(personaSchema),
  muertos: z.array(personaSchema),

  // Dorso: materiales / apoyo
  materialesUtilizadosMoviles: z.string(),
  materialesUtilizadosMenor: z.string(),
  materialesUtilizadosAjenos: z.string(),
  otrosDeApoyo: z.string(),
  personalPolicialACargoDe: z.string(),
  ministerioPublicoOficiadoPor: z.string(),
  otrosDatosInteres: z.string(),

  // Dorso: desarrollo + nomina de voluntarios
  desarrolloDelInforme: z.string(),
  nominaConductores: z.array(voluntarioConductorSchema),
  nominaCombatientes: z.array(voluntarioCombatienteSchema),
  nominaACargo: z.string(),
  nominaFirma: z.string(),
});

export type InformeIncendioInput = z.infer<typeof informeIncendioInput>;

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0");
}

function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const informeIncendioRouter = createRouter({
  // Salidas de Movil de tipo incendio que todavia no tienen un Informe de
  // Incendio generado a partir de ellas.
  salidasPendientes: publicQuery.query(async () => {
    const [salidasSnap, informesSnap] = await Promise.all([
      salidasMovilCollection().get(),
      informesIncendioCollection().get(),
    ]);

    const salidaIdsConInforme = new Set<string>();
    informesSnap.forEach((doc) => {
      const salidaId = String(doc.data().salidaId || "");
      if (salidaId) salidaIdsConInforme.add(salidaId);
    });

    const salidas = salidasSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .filter((s) => TIPOS_SERVICIO_INCENDIO.has(String(s.tipoServicio || "")))
      .filter((s) => !salidaIdsConInforme.has(s.id))
      .map((s) => ({
        id: s.id,
        movil: String(s.movil || ""),
        conductor: String(s.conductor || ""),
        oficialACargo: String(s.oficialACargo || ""),
        tipoServicio: String(s.tipoServicio || ""),
        fechaSalida: String(s.fechaSalida || ""),
        horaSalida: String(s.horaSalida || ""),
        direccion: String(s.direccion || ""),
      }))
      .sort((a, b) => b.fechaSalida.localeCompare(a.fechaSalida));

    return { exito: true as const, salidas };
  }),

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
      const codigoConductor = codigoPorNombre.get(normalizarNombre(conductor)) || "";

      return {
        exito: true as const,
        datos: {
          fecha: String(s.fechaSalida || ""),
          horaSalida: String(s.horaSalida || ""),
          horaLlegada: String(s.horaLlegada || ""),
          direccion: String(s.direccion || ""),
          movil: String(s.movil || ""),
          conductor,
          codigoConductor,
          aCargoDeLaCompania: String(s.oficialACargo || ""),
        },
      };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await informesIncendioCollection().get();
    const informes = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, any>))
      .map((i) => ({
        id: i.id,
        nServicio: String(i.nServicio || ""),
        fecha: String(i.fecha || ""),
        direccion: String(i.direccion || ""),
        movil: String(i.movil || ""),
        magnitud: String(i.magnitud || ""),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    return { exito: true as const, informes };
  }),

  obtener: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const doc = await informesIncendioCollection().doc(input.id).get();
      if (!doc.exists) return { exito: false as const, error: "Informe no encontrado" };
      return { exito: true as const, informe: { id: doc.id, ...doc.data() } };
    }),

  guardar: publicQuery
    .input(informeIncendioInput)
    .mutation(async ({ input }) => {
      const { id, ...datos } = input;
      const docId = id || generateId();
      await informesIncendioCollection().doc(docId).set(
        { ...datos, actualizadoEn: new Date().toISOString() },
        { merge: true }
      );
      return { exito: true as const, id: docId };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await informesIncendioCollection().doc(input.id).delete();
      return { exito: true as const };
    }),
});
