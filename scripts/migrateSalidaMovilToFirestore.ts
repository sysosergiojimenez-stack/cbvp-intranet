// Migracion unica de la pestana Sheets "SALIDAS_MOVIL" a la coleccion
// Firestore "salidasMovil". Idempotente: se puede volver a correr sin
// duplicar (usa el mismo doc ID deterministico que ya trae cada fila y
// { merge: true }).
//
// USO:
//   npx tsx scripts/migrateSalidaMovilToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_GUARDIAS_ID
// (copiados de las env vars del servicio Cloud Run cbvp-intranet-git).
import "dotenv/config";
import { Firestore } from "@google-cloud/firestore";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const BATCH_SIZE = 400; // por debajo del limite de 500 operaciones por batch de Firestore

async function main() {
  const data = await readSheet(env.SHEET_GUARDIAS_ID, "SALIDAS_MOVIL!A1:P");
  const db = getFirestoreClient();
  const collection = db.collection("salidasMovil");

  let batch = db.batch();
  let enBatch = 0;
  let migrados = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const id = String(row[0] || "").trim();
    const idPlanilla = String(row[1] || "").trim();
    if (!id || !idPlanilla) continue;

    let urlImagenes: string[] = [];
    try {
      const parsed = JSON.parse(String(row[15] || ""));
      if (Array.isArray(parsed)) urlImagenes = parsed;
    } catch {
      /* ignore */
    }

    batch.set(
      collection.doc(id),
      {
        idPlanilla,
        fechaCarga: String(row[2] || ""),
        movil: String(row[3] || ""),
        conductor: String(row[4] || ""),
        oficialACargo: String(row[5] || ""),
        nroTripulantes: String(row[6] || ""),
        tipoServicio: String(row[7] || ""),
        fechaSalida: String(row[8] || ""),
        horaSalida: String(row[9] || ""),
        kilometrajeSalida: String(row[10] || ""),
        direccion: String(row[11] || ""),
        fechaLlegada: String(row[12] || ""),
        horaLlegada: String(row[13] || ""),
        kilometrajeLlegada: String(row[14] || ""),
        urlImagenes,
        creadoEn: Firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    enBatch++;
    migrados++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }

  if (enBatch > 0) await batch.commit();
  console.log(`Migrados ${migrados} registros a la coleccion "salidasMovil".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
