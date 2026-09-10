import { getFirestoreClient } from "./firestore";

export const colAsistenciaEncabezado = () => getFirestoreClient().collection("asistenciaEncabezado");
export const colAsistenciaPersonal = () => getFirestoreClient().collection("asistenciaPersonal");

/**
 * Trae toda la coleccion asistenciaPersonal reacomodada como filas
 * posicionales (mismo orden de columnas que tenia la pestana Sheets
 * "Asistencia_Personal"), para poder reusar sin cambios los calculos de
 * asistencia mensual (logica de negocio sensible) tanto en
 * planillas.ts como en asistencia.ts.
 */
export async function obtenerAsistenciaPersonalComoFilas(): Promise<unknown[][]> {
  const snapshot = await colAsistenciaPersonal().get();
  const filas: unknown[][] = [[]]; // fila 0 = placeholder de encabezado (los loops arrancan en i=1)
  snapshot.forEach((doc) => {
    const f = doc.data();
    filas.push([
      doc.id,             // 0 idFila
      f.idPlanilla,       // 1
      f.fechaCarga,       // 2
      f.fechaActividad,   // 3
      "",                 // 4 (no usado, columna vacia en el original)
      "",                 // 5 (no usado, columna vacia en el original)
      f.codigo,           // 6
      f.nombre,           // 7
      f.asistencia,       // 8
      f.cargadoPorId,      // 9
      f.cargadoPorNombre,  // 10
      f.exencion,          // 11
    ]);
  });
  return filas;
}

/** Mapa idPlanilla -> tipoActividad (en mayusculas), desde asistenciaEncabezado. */
export async function obtenerTipoPorPlanillaAsistencia(): Promise<Map<string, string>> {
  const snapshot = await colAsistenciaEncabezado().get();
  const tipoPorPlanilla = new Map<string, string>();
  snapshot.forEach((doc) => {
    const tipo = String(doc.data().tipoActividad || "").trim().toUpperCase();
    if (tipo) tipoPorPlanilla.set(doc.id, tipo);
  });
  return tipoPorPlanilla;
}
