// Migracion unica de las 7 pestanas Sheets "RolesGuardia_*" a sus
// colecciones Firestore equivalentes. Idempotente: usa el mismo doc ID
// que ya traen los datos de origen (o uno deterministico para el
// calendario) con { merge: true }, asi que se puede volver a correr sin
// duplicar.
//
// USO:
//   npx tsx scripts/migrateRolesGuardiaToFirestore.ts
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON y SHEET_GUARDIAS_ID.
import "dotenv/config";
import { readSheet } from "../api/services/sheets";
import { getFirestoreClient } from "../api/services/firestore";
import { env } from "../api/lib/env";

const db = getFirestoreClient();

async function migrarSimple(
  sheetName: string,
  range: string,
  collectionName: string,
  mapRow: (row: unknown[]) => { id: string; data: Record<string, unknown> } | null
) {
  const data = await readSheet(env.SHEET_GUARDIAS_ID, `${sheetName}!${range}`);
  const collection = db.collection(collectionName);
  let migrados = 0;

  let batch = db.batch();
  let enBatch = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const mapped = mapRow(row);
    if (!mapped) continue;
    batch.set(collection.doc(mapped.id), mapped.data, { merge: true });
    migrados++;
    enBatch++;
    if (enBatch === 400) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`${sheetName}: migrados ${migrados} documentos a "${collectionName}".`);
}

async function main() {
  await migrarSimple("RolesGuardia_Cabecera", "A1:F", "rolesGuardiaCabecera", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        mesInicio: Number(row[1]) || 1,
        anioInicio: Number(row[2]) || 0,
        mesFin: Number(row[3]) || 1,
        anioFin: Number(row[4]) || 0,
        fechaCreacion: String(row[5] || ""),
      },
    };
  });

  await migrarSimple("RolesGuardia_Grupos", "A1:D", "rolesGuardiaGrupos", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        idRol: String(row[1] || ""),
        nombreGrupo: String(row[2] || ""),
        orden: Number(row[3]) || 0,
      },
    };
  });

  await migrarSimple("RolesGuardia_Personal", "A1:G", "rolesGuardiaPersonal", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        idRol: String(row[1] || ""),
        idGrupo: String(row[2] || ""),
        codigo: String(row[3] || ""),
        radial: String(row[4] || ""),
        asignacion: String(row[5] || ""),
        orden: Number(row[6]) || 0,
      },
    };
  });

  await migrarSimple("RolesGuardia_Especiales", "A1:F", "rolesGuardiaEspeciales", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        idRol: String(row[1] || ""),
        codigo: String(row[2] || ""),
        radial: String(row[3] || ""),
        asignacion: String(row[4] || ""),
        observaciones: String(row[5] || ""),
      },
    };
  });

  await migrarSimple("RolesGuardia_Activos", "A1:F", "rolesGuardiaActivos", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        idRol: String(row[1] || ""),
        codigo: String(row[2] || ""),
        radial: String(row[3] || ""),
        asignacion: String(row[4] || ""),
        observaciones: String(row[5] || ""),
      },
    };
  });

  await migrarSimple("RolesGuardia_Licencias", "A1:E", "rolesGuardiaLicencias", (row) => {
    const id = String(row[0] || "").trim();
    if (!id) return null;
    return {
      id,
      data: {
        idRol: String(row[1] || ""),
        codigo: String(row[2] || ""),
        radial: String(row[3] || ""),
        observaciones: String(row[4] || ""),
      },
    };
  });

  // Calendario usa un doc ID deterministico (idGrupo_anio_mes) en vez del
  // id de columna A, para que el router pueda hacer upsert directo.
  await migrarSimple("RolesGuardia_Calendario", "A1:E", "rolesGuardiaCalendario", (row) => {
    const idGrupo = String(row[1] || "").trim();
    const anio = Number(row[2]) || 0;
    const mes = Number(row[3]) || 0;
    if (!idGrupo || !anio || !mes) return null;
    const diasStr = String(row[4] || "").trim();
    const dias = diasStr ? diasStr.split(",").map((d) => Number(d.trim())).filter((n) => !isNaN(n)) : [];
    return {
      id: `${idGrupo}_${anio}_${mes}`,
      data: { idGrupo, anio, mes, dias },
    };
  });

  console.log("Migracion de RolesGuardia completa.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
