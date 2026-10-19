import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

// La colecta es anual y antes se guardaba solo en localStorage del
// navegador (nunca llegaba al servidor): un cambio de navegador, de
// dispositivo, o limpiar datos del sitio borraba todo. Ahora cada Colecta
// (un año) es un documento de esta coleccion, con sus actas de conteo,
// distribucion, POS Upay y transferencias adentro.
function colColectas() {
  return getFirestoreClient().collection("colectas");
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

const generalSchema = z.object({
  compania: z.string(),
  ciudad: z.string(),
  fecha: z.string(),
  local: z.string(),
});
const filaDistribucionSchema = z.object({ n: z.string(), responsable: z.string(), ci: z.string(), telefono: z.string() });
const filaResumenSchema = z.object({ n: z.string(), billetes: z.string(), monedas: z.string() });
const filaPosSchema = z.object({ n: z.string(), desde: z.string(), hasta: z.string(), monto: z.string() });
const filaTransferenciaSchema = z.object({ n: z.string(), comprobante: z.string(), banco: z.string(), monto: z.string() });
const conteoBloqueSchema = z.object({ numero: z.string(), cantidades: z.record(z.string(), z.string()) });
const conteoSchema = z.object({ alcancia: conteoBloqueSchema, sobre: conteoBloqueSchema });
const actaSchema = z.object({ id: z.string().min(1), titulo: z.string(), fecha: z.string(), filas: z.array(filaResumenSchema) });

// Lo que se guarda en el documento (sin "id": ese es el id del documento de
// Firestore, no se duplica adentro).
const colectaSchema = z.object({
  anio: z.string().min(1),
  general: generalSchema,
  distribucion: z.array(filaDistribucionSchema),
  conteo: conteoSchema,
  actas: z.array(actaSchema).min(1),
  pos: z.array(filaPosSchema),
  transferencias: z.array(filaTransferenciaSchema),
});

export const colectaRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await colColectas().get();
    const colectas = snapshot.docs
      .map((doc) => ({ id: doc.id, anio: String(doc.data().anio || "") }))
      .sort((a, b) => b.anio.localeCompare(a.anio, undefined, { numeric: true }));
    return { exito: true as const, colectas };
  }),

  obtener: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const doc = await colColectas().doc(input.id).get();
      if (!doc.exists) {
        return { exito: false as const, error: "Colecta no encontrada" };
      }
      const fila = doc.data()!;
      return {
        exito: true as const,
        id: doc.id,
        anio: String(fila.anio || ""),
        general: fila.general || { compania: "", ciudad: "", fecha: "", local: "" },
        distribucion: Array.isArray(fila.distribucion) ? fila.distribucion : [],
        conteo: fila.conteo || { alcancia: { numero: "", cantidades: {} }, sobre: { numero: "", cantidades: {} } },
        actas: Array.isArray(fila.actas) && fila.actas.length > 0 ? fila.actas : [{ id: generateId(), titulo: "Acta N° 1", fecha: "", filas: [] }],
        pos: Array.isArray(fila.pos) ? fila.pos : [],
        transferencias: Array.isArray(fila.transferencias) ? fila.transferencias : [],
      };
    }),

  // Crea una colecta a partir de un bloque ya armado del lado del cliente
  // (vacia para un año nuevo, o reconstruida al importar datos del
  // navegador). Devuelve el id asignado.
  crear: publicQuery
    .input(z.object({ colecta: colectaSchema }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await colColectas().doc(id).set(input.colecta);
      return { exito: true as const, id };
    }),

  guardar: publicQuery
    .input(z.object({ id: z.string().min(1), colecta: colectaSchema }))
    .mutation(async ({ input }) => {
      await colColectas().doc(input.id).set(input.colecta);
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colColectas().doc(input.id).delete();
      return { exito: true as const };
    }),
});
