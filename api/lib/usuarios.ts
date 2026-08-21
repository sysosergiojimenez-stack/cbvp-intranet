import { readSheet } from "../services/sheets";
import { env } from "./env";
import { formatearNombreCompleto } from "./nombres";
import { generarIdentificadorUnico } from "./identificador";
import { updateRange } from "../services/sheets";

export interface UsuarioBase {
  identificador: string;
  codigo: string;
  anioJuramento: string;
  categoria: string;
  cargo: string;
  rango: string;
  codigoRadial: string;
  primerNombre: string;
  primerApellido: string;
  nombreCompleto: string;
  nivelPermiso: number;
  situ: string;
  cuota: string;
  licenciaInicio: string;
  licenciaDias: string;
  rowIndex: number;
}

export async function leerUsuariosBase(
  opts: { autoGenerarIdentificador?: boolean } = {}
): Promise<{
  usuarios: UsuarioBase[];
  porIdentificador: Map<string, UsuarioBase>;
  porCodigo: Map<string, UsuarioBase>;
}> {
  const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:U");
  const identificadoresExistentes = new Set<string>();
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || "").trim();
    if (id) identificadoresExistentes.add(id);
  }

  const filasSinIdentificador: number[] = [];
  const usuarios: UsuarioBase[] = [];

  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    let identificador = String(fila[0] || "").trim();
    const codigo = fila[1] ? String(fila[1]).trim() : "";
    const primerNombre = fila[7] ? String(fila[7]).trim() : "";

    if (!primerNombre) continue;

    if (!identificador && opts.autoGenerarIdentificador !== false) {
      filasSinIdentificador.push(i);
      continue;
    }

    const primerApellido = fila[9] ? String(fila[9]).trim() : "";
    const rango = fila[5] ? String(fila[5]).trim() : "";
    const categoria = fila[3] ? String(fila[3]).trim() : "";
    const nivelRaw = parseInt(String(fila[15] || "1"), 10);

    usuarios.push({
      identificador,
      codigo,
      anioJuramento: String(fila[2] || ""),
      categoria,
      cargo: fila[4] ? String(fila[4]).trim() : "",
      rango,
      codigoRadial: fila[6] ? String(fila[6]).trim() : "",
      primerNombre,
      primerApellido,
      nombreCompleto: formatearNombreCompleto(rango, categoria, primerNombre, primerApellido),
      nivelPermiso: nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1,
      situ: String(fila[17] || "RN").trim().toUpperCase() || "RN",
      cuota: String(fila[18] || ""),
      licenciaInicio: String(fila[19] || ""),
      licenciaDias: String(fila[20] || ""),
      rowIndex: i + 1,
    });
  }

  if (filasSinIdentificador.length > 0 && opts.autoGenerarIdentificador !== false) {
    for (const rowIndex of filasSinIdentificador) {
      const id = await generarIdentificadorUnico(identificadoresExistentes);
      identificadoresExistentes.add(id);
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!A${rowIndex + 1}`, [[id]]);
      const fila = data[rowIndex];
      const primerApellido = fila[9] ? String(fila[9]).trim() : "";
      const rango = fila[5] ? String(fila[5]).trim() : "";
      const categoria = fila[3] ? String(fila[3]).trim() : "";
      const nivelRaw = parseInt(String(fila[15] || "1"), 10);
      usuarios.push({
        identificador: id,
        codigo: fila[1] ? String(fila[1]).trim() : "",
        anioJuramento: String(fila[2] || ""),
        categoria,
        cargo: fila[4] ? String(fila[4]).trim() : "",
        rango,
        codigoRadial: fila[6] ? String(fila[6]).trim() : "",
        primerNombre: String(fila[7] || "").trim(),
        primerApellido,
        nombreCompleto: formatearNombreCompleto(rango, categoria, String(fila[7] || "").trim(), primerApellido),
        nivelPermiso: nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1,
        situ: String(fila[17] || "RN").trim().toUpperCase() || "RN",
        cuota: String(fila[18] || ""),
        licenciaInicio: String(fila[19] || ""),
        licenciaDias: String(fila[20] || ""),
        rowIndex: rowIndex + 1,
      });
    }
  }

  const porIdentificador = new Map<string, UsuarioBase>();
  const porCodigo = new Map<string, UsuarioBase>();
  for (const u of usuarios) {
    porIdentificador.set(u.identificador, u);
    if (u.codigo) porCodigo.set(u.codigo, u);
  }

  return { usuarios, porIdentificador, porCodigo };
}
