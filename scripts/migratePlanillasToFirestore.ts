// Migracion unica de las pestanas Sheets "Guardias_Encabezado" y
// "Guardias_Personal" a sus colecciones Firestore equivalentes
// (guardiasEncabezado, guardiasPersonal). Idempotente: usa el mismo ID de
// columna A que ya traen los datos de origen, con { merge: true }.
//
// USO:
//   npx tsx scripts/migratePlanillasToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_GUARDIAS_ID.
import "dotenv/config";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const BATCH_SIZE = 400;

// Convierte un serial de tiempo de Google Sheets (fraccion de dia) a HH:MM.
// Las pestanas viejas a veces guardan horas asi si la celda tenia formato
// de hora; los datos nuevos (via Gemini) ya vienen como texto "HH:MM".
function serialToTime(serial: unknown): string {
  if (typeof serial === "number" && serial >= 0 && serial < 1) {
    const totalMinutes = Math.round(serial * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return String(serial || "");
}

async function main() {
  const db = getFirestoreClient();

  // --- Guardias_Encabezado -> guardiasEncabezado ---
  const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado!A1:K");
  const colEnc = db.collection("guardiasEncabezado");
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
        fechaGuardia: String(row[2] || ""),
        grupo: String(row[3] || ""),
        inicioGuardia: serialToTime(row[4]),
        finalizaGuardia: serialToTime(row[5]),
        directorSem: String(row[6] || ""),
        comandanteSemana: String(row[7] || ""),
        oficialK20: String(row[8] || ""),
        novedades: String(row[9] || ""),
        urlImagen: String(row[10] || ""),
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
  console.log(`Guardias_Encabezado: migrados ${migradosEnc} documentos a "guardiasEncabezado".`);

  // --- Guardias_Personal -> guardiasPersonal ---
  const persData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Personal!A1:M");
  const colPers = db.collection("guardiasPersonal");
  batch = db.batch();
  enBatch = 0;
  let migradosPers = 0;
  for (let i = 1; i < persData.length; i++) {
    const row = persData[i];
    const idFila = String(row[0] || "").trim();
    if (!idFila) continue;
    batch.set(
      colPers.doc(idFila),
      {
        idPlanilla: String(row[1] || ""),
        fechaCarga: String(row[2] || ""),
        fechaGuardia: String(row[3] || ""),
        grupo: String(row[4] || ""),
        tipo: String(row[5] || ""),
        codigo: String(row[6] || ""),
        nombre: String(row[7] || ""),
        asignacion: String(row[8] || ""),
        asistencia: String(row[9] || ""),
        idCargador: String(row[10] || ""),
        nombreCargador: String(row[11] || ""),
        exencion: String(row[12] || ""),
      },
      { merge: true }
    );
    migradosPers++;
    enBatch++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`Guardias_Personal: migrados ${migradosPers} documentos a "guardiasPersonal".`);

  console.log("Migracion de Planillas de Guardia completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
