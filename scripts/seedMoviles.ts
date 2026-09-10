// Carga inicial (unica) de la coleccion Firestore "moviles" con los datos
// ya existentes de la flota. Idempotente: usa el mismo ID de documento que
// traen los datos de origen, con { merge: true }.
//
// USO:
//   npx tsx scripts/seedMoviles.ts
import "dotenv/config";
import { getFirestoreClient } from "../api/services/firestore";

const MOVILES = [
  {
    id: "ad5be1f2",
    fechaCarga: "20/09/2022 11:01:06",
    codificacion: "AB-202",
    tipo: "AUTOBOMBA",
    procedencia: "JAPON",
    anioAdquisicion: "2021",
    marca: "ISUZU",
    modelo: "FORWARD",
    anio: "2003",
    chasis: "FSR33G47000495",
    matricula: "",
    foto: "MOVILES_Images/ad5be1f2.FOTO.185229.jpg",
    condicion: "10:79",
    tipoCombustible: "DIESEL",
  },
  {
    id: "9d343b0b",
    fechaCarga: "20/09/2022 11:28:08",
    codificacion: "AB-201",
    tipo: "AUTOBOMBA",
    procedencia: "ALEMANIA",
    anioAdquisicion: "2004",
    marca: "MERCEDES BENZ",
    modelo: "322",
    anio: "1962",
    chasis: "130-10-028675",
    matricula: "",
    foto: "MOVILES_Images/9d343b0b.FOTO.112106.png",
    condicion: "10:77",
    tipoCombustible: "DIESEL",
  },
  {
    id: "94db486a",
    fechaCarga: "05/03/2025 18:11:18",
    codificacion: "AR-203",
    tipo: "AUTORESCATE",
    procedencia: "JAPON",
    anioAdquisicion: "2024",
    marca: "ISUZU",
    modelo: "ELF",
    anio: "1994",
    chasis: "NKR66G-7400821",
    matricula: "",
    foto: "MOVILES_Images/AR-203.FOTO.145100.jpg",
    condicion: "10:78",
    tipoCombustible: "DIESEL",
  },
];

async function main() {
  const db = getFirestoreClient();
  const collection = db.collection("moviles");

  for (const { id, ...datos } of MOVILES) {
    await collection.doc(id).set(datos, { merge: true });
  }

  console.log(`Cargados ${MOVILES.length} moviles a la coleccion "moviles".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
