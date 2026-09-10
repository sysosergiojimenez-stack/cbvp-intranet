// Migracion unica de las pestanas Sheets "USUARIOS" y "ROLES" a sus
// colecciones Firestore equivalentes (usuarios, roles).
//
// USUARIOS nunca tuvo un identificador real (la columna A "IDENTIFICADOR"
// siempre se escribio vacia), asi que usuarios usa IDs auto-generados de
// Firestore: si se vuelve a correr el script, duplica las filas (no hay
// forma de deduplicar sin un id estable). Pensado para correrse una sola
// vez, justo antes del deploy.
//
// ROLES si es idempotente: usa como doc ID el nombre del cargo (columna
// A), con { merge: true }.
//
// USO:
//   npx tsx scripts/migrateUsuariosToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_USUARIOS_ID.
import "dotenv/config";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const BATCH_SIZE = 400;

async function main() {
  const db = getFirestoreClient();

  // --- USUARIOS -> usuarios (IDs auto-generados) ---
  const usuariosData = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:W");
  const colUsuarios = db.collection("usuarios");
  let batch = db.batch();
  let enBatch = 0;
  let migradosUsuarios = 0;
  for (let i = 1; i < usuariosData.length; i++) {
    const row = usuariosData[i];
    const codigo = String(row[1] || "").trim();
    const primerNombre = String(row[7] || "").trim();
    if (!codigo || !primerNombre) continue; // fila vacia/incompleta, igual que hacen los routers

    batch.set(colUsuarios.doc(), {
      codigo,
      anioJuramento: String(row[2] || ""),
      categoria: String(row[3] || ""),
      cargo: String(row[4] || ""),
      rango: String(row[5] || ""),
      codigoRadial: String(row[6] || ""),
      primerNombre,
      segundoNombre: String(row[8] || ""),
      primerApellido: String(row[9] || ""),
      segundoApellido: String(row[10] || ""),
      nroDoc: String(row[11] || ""),
      fechaNacimiento: String(row[12] || ""),
      correo: String(row[13] || ""),
      contrasena: String(row[14] || ""),
      nivelPermiso: String(row[15] || ""),
      descripcionPermiso: String(row[16] || ""),
      situ: String(row[17] || ""),
      cuota: String(row[18] || ""),
      licenciaInicio: String(row[19] || ""),
      licenciaDias: String(row[20] || ""),
      exencion: String(row[21] || ""),
      comisionadoDesde: String(row[22] || ""),
    });
    migradosUsuarios++;
    enBatch++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`USUARIOS: migrados ${migradosUsuarios} documentos a "usuarios".`);

  // --- ROLES -> roles (doc ID = cargo) ---
  const rolesData = await readSheet(env.SHEET_USUARIOS_ID, "ROLES!A1:D");
  const colRoles = db.collection("roles");
  batch = db.batch();
  enBatch = 0;
  let migradosRoles = 0;
  for (let i = 1; i < rolesData.length; i++) {
    const row = rolesData[i];
    const cargo = String(row[0] || "").trim();
    if (!cargo) continue;
    batch.set(
      colRoles.doc(cargo),
      {
        nivel: parseInt(String(row[1] || "")) || 1,
        descripcion: String(row[2] || ""),
        accesos: String(row[3] || ""),
      },
      { merge: true }
    );
    migradosRoles++;
    enBatch++;
    if (enBatch === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`ROLES: migrados ${migradosRoles} documentos a "roles".`);

  console.log("Migracion de Usuarios/Roles completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
