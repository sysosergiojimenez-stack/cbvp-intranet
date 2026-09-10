// Migracion unica de la pestana Sheets "PERMISOS_NIVELES" a la coleccion
// Firestore "permisosNiveles". Idempotente: se puede volver a correr sin
// duplicar (doc ID = numero de nivel, { merge: true }).
//
// USO:
//   npx tsx scripts/migratePermisosNivelesToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_USUARIOS_ID
// (copiados de las env vars del servicio Cloud Run cbvp-intranet-git).
import "dotenv/config";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const COLUMNAS_PERMISO = [
  "ver_todo",
  "editar_planillas",
  "eliminar_planillas",
  "ver_personal",
  "ver_historial",
  "cargar_planillas",
  "ver_perfil_propio",
  "configuracion",
  "ver_informes",
  "gestionar_roles_guardia",
  "crear_bombero",
] as const;

function parseBool(value: unknown): boolean {
  return String(value || "").trim().toUpperCase() === "TRUE";
}

async function main() {
  const data = await readSheet(env.SHEET_USUARIOS_ID, "PERMISOS_NIVELES!A1:L");
  const db = getFirestoreClient();
  const collection = db.collection("permisosNiveles");

  let migrados = 0;
  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const nivel = Number(fila[0]);
    if (!nivel) continue;

    const flags: Record<string, boolean> = {};
    COLUMNAS_PERMISO.forEach((accion, idx) => {
      const colIndex = idx + 1;
      if (fila[colIndex] !== undefined) {
        flags[accion] = parseBool(fila[colIndex]);
      }
    });

    await collection.doc(String(nivel)).set(flags, { merge: true });
    migrados++;
  }

  console.log(`Migrados ${migrados} niveles a la coleccion "permisosNiveles".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
