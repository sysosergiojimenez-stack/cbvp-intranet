// Carga inicial de las 2 cuentas que ya se usaban en Ordenes de Pago dentro
// de la coleccion nueva "cuentasEntidades". Saldo inicial en 0 -- el usuario
// lo completa a mano desde el modulo una vez que confirme el saldo real.
// Idempotente: usa el numero de cuenta como parte del doc ID.
//
// USO: npx tsx scripts/seedCuentasEntidades.ts
import "dotenv/config";
import { getFirestoreClient } from "../api/services/firestore";

const CUENTAS = [
  { nombre: "Coop. Mercado 4 LTDA.", cuenta: "1009460" },
  { nombre: "UENO BANK", cuenta: "194398001" },
];

async function main() {
  const db = getFirestoreClient();
  const col = db.collection("cuentasEntidades");
  for (const c of CUENTAS) {
    await col.doc(`seed_${c.cuenta}`).set(
      {
        nombre: c.nombre,
        cuenta: c.cuenta,
        saldoInicial: 0,
        observaciones: "",
        fechaCarga: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`Sembrada: ${c.nombre} (${c.cuenta})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
