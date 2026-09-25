// Migracion unica de las Ordenes de Pago desde la planilla vieja
// ("PLATAFORMA OPERATIVA K-20", pestana DK_NOTAS) a la coleccion Firestore
// "ordenesPago" de esta app. Solo migra las filas donde ASUNTO = "924a0901"
// (el id de "ORDEN DE PAGO" en DK_ASUNTO); el resto de DK_NOTAS son otro
// tipo de notas (rendiciones, circulares, etc.) y se ignoran.
//
// Idempotente: usa el mismo ID_REGISTRO de origen como doc ID de Firestore
// con { merge: true }, asi que se puede re-correr sin duplicar.
//
// USO:
//   npx tsx scripts/migrateOrdenesPagoFromSheet.ts --dry-run   (solo muestra, no escribe)
//   npx tsx scripts/migrateOrdenesPagoFromSheet.ts             (migra de verdad)
//
// Requiere un .env local con GOOGLE_SERVICE_ACCOUNT_JSON, y que la planilla
// vieja este compartida (Lector) con esa cuenta de servicio.
import "dotenv/config";
import { getSheetsClient } from "../api/services/googleAuth";
import { getFirestoreClient } from "../api/services/firestore";
import { normalizarFechaDDMMYYYY } from "../api/lib/fechas";
import type { TipoMovimientoOrdenPago } from "../contracts/ordenesPago";

const SHEET_ID = "1suNi7qzeREtp1kxbTNTaH9-k4onarq3jn5TwnRiHbqw";
const ASUNTO_ORDEN_DE_PAGO = "924a0901";
const ID_CAJA_CHICA_REAL = "aaddf111"; // DK_CUENTAS_BANCARIAS: TIPO = "CAJA EN EFECTIVO"

const dryRun = process.argv.includes("--dry-run");

async function leerRango(tab: string, range = "A1:Z2000"): Promise<string[][]> {
  const sheets = getSheetsClient();
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${tab}!${range}` });
  return (resp.data.values as string[][]) || [];
}

function soloDigitos(valor: string | undefined): string {
  return (valor || "").replace(/[^\d]/g, "");
}

// "UENO BANK CTA No 194398001" -> { nombre: "UENO BANK", cuenta: "194398001" }
function parsearCuenta(valor: string | undefined): { nombre: string; cuenta: string } {
  const v = (valor || "").trim();
  if (!v) return { nombre: "", cuenta: "" };
  const m = v.match(/^(.*?)\s+CTA No\s+(\S+)$/i);
  if (!m) return { nombre: v, cuenta: "" };
  return { nombre: m[1].trim(), cuenta: m[2].trim() };
}

// "05/11/2025 11:41:08" -> ISO
function marcaTemporalAISO(valor: string | undefined): string {
  const v = (valor || "").trim();
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return new Date().toISOString();
  const [, d, mo, y, h, mi, s] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0)).toISOString();
}

interface OrdenMigrada {
  idOrigen: string;
  fecha: string;
  anio: number;
  mesaEntrada: string;
  bancoNombre: string;
  bancoCuenta: string;
  tipoMovimiento: TipoMovimientoOrdenPago;
  descripcion: string;
  monto: number;
  comandanteNombre: string;
  directorNombre: string;
  fechaCarga: string;
}

async function main() {
  const notas = await leerRango("DK_NOTAS");
  const header = notas[0];
  const idx = (nombre: string) => header.indexOf(nombre);
  const iId = 0;
  const iMarcaTemporal = idx("MARCA_TEMPORAL");
  const iFecha = idx("FECHA");
  const iAsunto = idx("ASUNTO");
  const iFirma1 = idx("FIRMA 1");
  const iFirma2 = idx("FIRMA 2");
  const iMesaEntrada = idx("MESA DE ENTRADA");
  const iConcepto = idx("CONCEPTO");
  const iDetalles = idx("DETALLES");
  const iMonto = idx("MONTO SOLICITADO");
  const iCajaEnEfectivo = idx("CAJA EN EFECTIVO");
  const iCuentaTexto = 22; // columna W, sin encabezado

  const opRows = notas.slice(1).filter((r) => r[iAsunto] === ASUNTO_ORDEN_DE_PAGO);

  const conceptosRows = await leerRango("DK_CONCEPTOS");
  const conceptoPorId = new Map(conceptosRows.slice(1).map((r) => [r[0], r[4]]));

  const firmasRows = await leerRango("DK_NOTAS_FIRMAS");
  const firmaPorId = new Map(firmasRows.slice(1).map((r) => [r[0], { nombre: r[3] || "", cargo: (r[4] || "").toLowerCase() }]));

  const cuentasRows = await leerRango("DK_CUENTAS_BANCARIAS");
  const tipoCuentaPorId = new Map(cuentasRows.slice(1).map((r) => [r[0], r[3] || ""]));

  const migradas: OrdenMigrada[] = [];
  let sinFecha = 0;

  for (const r of opRows) {
    const fecha = normalizarFechaDDMMYYYY(r[iFecha] || "");
    if (!fecha) { sinFecha++; continue; }
    const anio = Number(fecha.split("/")[2]);

    const { nombre: cuentaTextoNombre, cuenta: cuentaTextoCuenta } = parsearCuenta(r[iCuentaTexto]);
    const bancoNombre = cuentaTextoNombre;
    const bancoCuenta = cuentaTextoCuenta;
    let tipoMovimiento: TipoMovimientoOrdenPago = "OTROS";
    if (!bancoNombre) {
      // sin cuenta en texto: se deja banco/cuenta vacios; solo se usa la
      // referencia de CAJA EN EFECTIVO para saber si es caja chica real.
      const refCaja = r[iCajaEnEfectivo] || "";
      const tipoRef = tipoCuentaPorId.get(refCaja) || "";
      if (refCaja === ID_CAJA_CHICA_REAL || tipoRef === "CAJA EN EFECTIVO") tipoMovimiento = "CAJA_CHICA";
    }

    const conceptoTxt = conceptoPorId.get(r[iConcepto]) || "";
    const detallesTxt = (r[iDetalles] || "").trim();
    const descripcion = [conceptoTxt, detallesTxt].filter(Boolean).join(" - ");

    let comandanteNombre = "";
    let directorNombre = "";
    for (const hash of [r[iFirma1], r[iFirma2]]) {
      const f = firmaPorId.get(hash);
      if (!f) continue;
      if (f.cargo.includes("comandante") || f.cargo.includes("presidente")) comandanteNombre = f.nombre;
      else if (f.cargo.includes("director")) directorNombre = f.nombre;
    }

    migradas.push({
      idOrigen: r[iId],
      fecha,
      anio,
      mesaEntrada: soloDigitos(r[iMesaEntrada]),
      bancoNombre,
      bancoCuenta,
      tipoMovimiento,
      descripcion: descripcion || "(sin concepto)",
      monto: Number(soloDigitos(r[iMonto])) || 0,
      comandanteNombre,
      directorNombre,
      fechaCarga: marcaTemporalAISO(r[iMarcaTemporal]),
    });
  }

  // Numeracion secuencial por anio, en orden cronologico -- igual esquema
  // que usa el mutation "guardar" para las ordenes nuevas.
  const porAnio = new Map<number, OrdenMigrada[]>();
  for (const o of migradas) {
    if (!porAnio.has(o.anio)) porAnio.set(o.anio, []);
    porAnio.get(o.anio)!.push(o);
  }
  const numeroPorIdOrigen = new Map<string, number>();
  for (const [, grupo] of porAnio) {
    grupo.sort((a, b) => {
      const [da, ma, ya] = a.fecha.split("/").map(Number);
      const [db, mb, yb] = b.fecha.split("/").map(Number);
      const fa = new Date(ya, ma - 1, da).getTime();
      const fb = new Date(yb, mb - 1, db).getTime();
      if (fa !== fb) return fa - fb;
      return (Number(a.mesaEntrada) || 0) - (Number(b.mesaEntrada) || 0);
    });
    grupo.forEach((o, i) => numeroPorIdOrigen.set(o.idOrigen, i + 1));
  }

  // --- Resumen ---
  console.log(`Filas DK_NOTAS con ASUNTO=ORDEN DE PAGO: ${opRows.length}`);
  console.log(`Migradas con fecha valida: ${migradas.length} (sin fecha valida: ${sinFecha})`);
  const porTipo: Record<string, number> = {};
  for (const o of migradas) porTipo[o.tipoMovimiento] = (porTipo[o.tipoMovimiento] || 0) + 1;
  console.log("Distribucion tipoMovimiento:", porTipo);
  const sinBanco = migradas.filter((o) => !o.bancoNombre).length;
  console.log(`Sin banco/cuenta (quedan vacios): ${sinBanco}`);
  const sinFirmas = migradas.filter((o) => !o.comandanteNombre && !o.directorNombre).length;
  console.log(`Sin ninguna firma resuelta: ${sinFirmas}`);
  const anios = [...porAnio.keys()].sort();
  console.log(`Anios: ${anios.join(", ")}`);
  for (const a of anios) console.log(`  ${a}: ${porAnio.get(a)!.length} ordenes, numeradas 1..${porAnio.get(a)!.length}`);

  console.log("\nPrimeras 5 (ordenadas por fecha dentro del primer anio):");
  const primerAnio = anios[0];
  for (const o of porAnio.get(primerAnio)!.slice(0, 5)) {
    console.log({ numero: `${numeroPorIdOrigen.get(o.idOrigen)}/${o.anio}`, ...o });
  }

  console.log("\nUltimas 5:");
  const ultimoAnio = anios[anios.length - 1];
  for (const o of porAnio.get(ultimoAnio)!.slice(-5)) {
    console.log({ numero: `${numeroPorIdOrigen.get(o.idOrigen)}/${o.anio}`, ...o });
  }

  if (dryRun) {
    console.log("\n--dry-run: no se escribio nada en Firestore.");
    return;
  }

  const db = getFirestoreClient();
  const col = db.collection("ordenesPago");
  let batch = db.batch();
  let enBatch = 0;
  for (const o of migradas) {
    const numero = numeroPorIdOrigen.get(o.idOrigen)!;
    batch.set(
      col.doc(o.idOrigen),
      {
        numero,
        anio: o.anio,
        fecha: o.fecha,
        mesaEntrada: o.mesaEntrada,
        bancoNombre: o.bancoNombre,
        bancoCuenta: o.bancoCuenta,
        tipoMovimiento: o.tipoMovimiento,
        detalle: [{ descripcion: o.descripcion, bancoAlias: "", nroCuenta: "", monto: o.monto }],
        total: o.monto,
        observaciones: "",
        comandanteNombre: o.comandanteNombre,
        directorNombre: o.directorNombre,
        creadoPor: "",
        fechaCarga: o.fechaCarga,
      },
      { merge: true }
    );
    enBatch++;
    if (enBatch === 400) {
      await batch.commit();
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) await batch.commit();
  console.log(`\nMigradas ${migradas.length} Ordenes de Pago a Firestore.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
