import "dotenv/config";
import { readSheet, updateRange } from "../api/services/sheets";
import { env } from "../api/lib/env";
import { leerUsuariosBase } from "../api/lib/usuarios";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

function columnIndexToLetter(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

interface HojaMigracion {
  nombre: string;
  rango: string;
  columnas: number[];
}

const HOJAS: HojaMigracion[] = [
  // Guardias_Personal: G = personal, K = id del cargador
  { nombre: "Guardias_Personal", rango: "A1:L", columnas: [6, 10] },
  // Asistencia_Personal: G = personal, J = id del cargador
  { nombre: "Asistencia_Personal", rango: "A1:K", columnas: [6, 9] },
  // Roles de Guardia: C o D = identificador del bombero
  { nombre: "RolesGuardia_Personal", rango: "A1:G", columnas: [3] },
  { nombre: "RolesGuardia_Especiales", rango: "A1:F", columnas: [2] },
  { nombre: "RolesGuardia_Licencias", rango: "A1:E", columnas: [2] },
  { nombre: "RolesGuardia_Activos", rango: "A1:F", columnas: [2] },
];

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Modo: ${apply ? "APLICAR" : "SIMULACIÓN (dry-run)"}`);
  if (!apply) {
    console.log("Usa --apply para escribir los cambios en Google Sheets.\n");
  }

  console.log("1. Leyendo usuarios y autogenerando identificadores faltantes...");
  const { usuarios, porIdentificador, porCodigo } = await leerUsuariosBase({
    autoGenerarIdentificador: true,
  });
  console.log(`   Usuarios activos: ${usuarios.length}`);

  // Mapa numérico por si el código histórico es solo el número (sin el prefijo).
  const porNumeroCodigo = new Map<string, string>();
  for (const u of usuarios) {
    const num = extractNumber(u.codigo);
    if (num && !porNumeroCodigo.has(num)) {
      porNumeroCodigo.set(num, u.identificador);
    }
  }

  let totalActualizaciones = 0;
  let totalSinCambio = 0;
  let totalSinMatch = 0;

  for (const hoja of HOJAS) {
    console.log(`\n2. Procesando ${hoja.nombre}...`);
    const data = await readSheet(
      env.SHEET_GUARDIAS_ID,
      `${hoja.nombre}!${hoja.rango}`
    );
    if (data.length <= 1) {
      console.log("   Sin filas de datos.");
      continue;
    }

    const actualizaciones: Array<{
      row: number;
      col: number;
      original: string;
      nuevo: string;
    }> = [];
    const sinMatch: Array<{ row: number; col: number; valor: string }> = [];
    const yaCorrectos: Array<{ row: number; col: number; valor: string }> = [];

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      for (const col of hoja.columnas) {
        const valor = String(fila[col] || "").trim();
        if (!valor) continue;

        if (porIdentificador.has(valor)) {
          yaCorrectos.push({ row: i + 1, col, valor });
          continue;
        }

        if (porCodigo.has(valor)) {
          const usuario = porCodigo.get(valor)!;
          actualizaciones.push({ row: i + 1, col, original: valor, nuevo: usuario.identificador });
          continue;
        }

        const num = extractNumber(valor);
        if (num && porNumeroCodigo.has(num)) {
          const nuevo = porNumeroCodigo.get(num)!;
          actualizaciones.push({ row: i + 1, col, original: valor, nuevo });
          continue;
        }

        sinMatch.push({ row: i + 1, col, valor });
      }
    }

    console.log(`   - Filas leídas: ${data.length - 1}`);
    console.log(`   - Ya usan identificador: ${yaCorrectos.length}`);
    console.log(`   - A actualizar: ${actualizaciones.length}`);
    console.log(`   - Sin match: ${sinMatch.length}`);

    if (actualizaciones.length > 0) {
      const muestra = actualizaciones
        .slice(0, 5)
        .map((a) => `fila ${a.row}: ${a.original} -> ${a.nuevo}`);
      console.log(
        `   - Muestra: ${muestra.join("; ")}${
          actualizaciones.length > 5 ? "..." : ""
        }`
      );
    }

    if (sinMatch.length > 0) {
      const muestra = sinMatch
        .slice(0, 5)
        .map((s) => `fila ${s.row}: ${s.valor}`);
      console.log(
        `   - Sin match: ${muestra.join("; ")}${
          sinMatch.length > 5 ? "..." : ""
        }`
      );
    }

    if (apply) {
      for (const upd of actualizaciones) {
        const letra = columnIndexToLetter(upd.col);
        await updateRange(
          env.SHEET_GUARDIAS_ID,
          `${hoja.nombre}!${letra}${upd.row}:${letra}${upd.row}`,
          [[upd.nuevo]]
        );
      }
    }

    totalActualizaciones += actualizaciones.length;
    totalSinCambio += yaCorrectos.length;
    totalSinMatch += sinMatch.length;
  }

  console.log("\n==========================================");
  console.log(`Resumen de migración (${apply ? "aplicada" : "simulada"})`);
  console.log(`  - Actualizaciones: ${totalActualizaciones}`);
  console.log(`  - Ya correctos: ${totalSinCambio}`);
  console.log(`  - Sin match: ${totalSinMatch}`);
  console.log("==========================================");

  if (!apply) {
    console.log("\nNo se escribió nada. Ejecuta con --apply para confirmar.");
  }
}

main().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
