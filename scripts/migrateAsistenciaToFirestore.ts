// Migracion unica de las pestanas Sheets "Asistencia_Encabezado" y
// "Asistencia_Personal" a sus colecciones Firestore equivalentes
// (asistenciaEncabezado, asistenciaPersonal). Idempotente para
// asistenciaEncabezado (mismo id de columna A, { merge: true }).
// asistenciaPersonal NO tiene id propio en el origen (columna A siempre
// vacia en el Sheet), asi que usa IDs auto-generados de Firestore: si se
// vuelve a correr el script, duplica esas filas (no hay forma de
// deduplicar sin un id estable). Pensado para correrse una sola vez.
//
// USO:
//   npx tsx scripts/migrateAsistenciaToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_GUARDIAS_ID.
import "dotenv/config";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const BATCH_SIZE = 400;

function parseImageUrls(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // No es JSON, es el formato viejo (una sola URL como texto plano)
  }
  return [value];
}

async function main() {
  const db = getFirestoreClient();

  // --- Asistencia_Encabezado -> asistenciaEncabezado ---
  const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado!A1:I");
  const colEnc = db.collection("asistenciaEncabezado");
  let batch = db.batch();
  let enBatch = 0;
  let migradosEnc = 0;
  for (let i = 1; i < encData.length; i++) {
    const row = encData[i];
    const idPlanilla = String(row[0] || "").trim();
    if (!idPlanilla) continue;
    batch.set(
      colEnc.doc(idPlanilla),
      {
        fechaCarga: String(row[1] || ""),
        fechaActividad: String(row[2] || ""),
        tipoActividad: String(row[3] || ""),
        inicioActividad: String(row[4] || ""),
        finalizaActividad: String(row[5] || ""),
        acargoActividad: String(row[6] || ""),
        detalles: String(row[7] || ""),
        urlImagenes: parseImageUrls(String(row[8] || "")),
      },
      { merge: true }
    );
    migradosEnc++;
    enBatch++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`Asistencia_Encabezado: migrados ${migradosEnc} documentos a "asistenciaEncabezado".`);

  // --- Asistencia_Personal -> asistenciaPersonal (IDs auto-generados) ---
  const persData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:L");
  const colPers = db.collection("asistenciaPersonal");
  batch = db.batch();
  enBatch = 0;
  let migradosPers = 0;
  for (let i = 1; i < persData.length; i++) {
    const row = persData[i];
    const idPlanilla = String(row[1] || "").trim();
    if (!idPlanilla) continue;
    batch.set(colPers.doc(), {
      idPlanilla,
      fechaCarga: String(row[2] || ""),
      fechaActividad: String(row[3] || ""),
      codigo: String(row[6] || ""),
      nombre: String(row[7] || ""),
      asistencia: String(row[8] || ""),
      cargadoPorId: String(row[9] || ""),
      cargadoPorNombre: String(row[10] || ""),
      exencion: String(row[11] || ""),
    });
    migradosPers++;
    enBatch++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`Asistencia_Personal: migrados ${migradosPers} documentos a "asistenciaPersonal".`);

  console.log("Migracion de Asistencia completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
