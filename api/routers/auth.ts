import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet } from "../services/sheets";
import { env } from "../lib/env";

function normalizeCode(code: string): string {
  return code.toString().trim().toUpperCase();
}

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

async function obtenerNivelPermiso(cargo: string) {
  try {
    const data = await readSheet(env.SHEET_USUARIOS_ID, "ROLES!A1:D100");
    const cargoBusqueda = cargo.toString().trim();
    for (let i = 1; i < data.length; i++) {
      const rowCargo = data[i][0] ? String(data[i][0]).trim() : "";
      if (rowCargo === cargoBusqueda) {
        return {
          exito: true,
          nivel: parseInt(String(data[i][1])) || 1,
          descripcion: data[i][2] ? String(data[i][2]) : "",
          accesos: data[i][3] ? String(data[i][3]) : "",
        };
      }
    }
    return { exito: false, nivel: 1, descripcion: "", accesos: "" };
  } catch {
    return { exito: false, nivel: 1, descripcion: "", accesos: "" };
  }
}

export const authRouter = createRouter({
  login: publicQuery
    .input(
      z.object({
        correo: z.string().email(),
        contrasena: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const correoInput = input.correo.trim().toLowerCase();
      const passInput = input.contrasena.trim();

      // Read from USUARIOS sheet
      // Columns: 0=ID, 1=Codigo, 2=AnioJuramento, 3=Categoria, 4=Cargo, 5=Rango,
      // 6=CodigoRadial, 7=PrimerNombre, 8=SegundoNombre, 9=PrimerApellido, 10=SegundoApellido,
      // 11=NroDoc, 12=FechaNacimiento, 13=Correo, 14=Contrasena
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:O1000");

      for (let i = 1; i < data.length; i++) {
        const fila = data[i];
        const correoFila = fila[13] ? String(fila[13]).trim().toLowerCase() : "";
        const passFila = fila[14] ? String(fila[14]).trim() : "";

        if (correoFila === correoInput && passFila === passInput) {
          const cargo = fila[4] ? String(fila[4]).trim() : "Voluntario(a)";
          const permiso = await obtenerNivelPermiso(cargo);

          const primerNombre = fila[7] ? String(fila[7]).trim() : "";
          const primerApellido = fila[9] ? String(fila[9]).trim() : "";
          const nombreCompleto =
            primerNombre + (primerApellido ? " " + primerApellido : "");

          return {
            exito: true as const,
            identificador: String(fila[0] || ""),
            codigo: String(fila[1] || ""),
            categoria: String(fila[3] || ""),
            cargo,
            rango: String(fila[5] || ""),
            nivelPermiso: permiso.exito ? permiso.nivel : 2,
            descripcionPermiso: permiso.exito ? permiso.descripcion : "",
            accesosPermiso: permiso.exito ? permiso.accesos : "",
            nombreCompleto,
            correo: correoFila,
          };
        }
      }

      return {
        exito: false as const,
        mensaje: "Correo o contrasena incorrectos",
      };
    }),

  ficha: publicQuery
    .input(z.object({ correo: z.string().email() }))
    .query(async ({ input }) => {
      const correoBusqueda = input.correo.trim().toLowerCase();
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:O1000");

      for (let i = 1; i < data.length; i++) {
        const fila = data[i];
        const correoFila = fila[13] ? String(fila[13]).trim().toLowerCase() : "";
        if (correoFila === correoBusqueda) {
          const primerNombre = fila[7] ? String(fila[7]).trim() : "";
          const primerApellido = fila[9] ? String(fila[9]).trim() : "";
          const nombreCompleto =
            primerNombre + (primerApellido ? " " + primerApellido : "");

          return {
            exito: true as const,
            identificador: String(fila[0] || ""),
            codigo: String(fila[1] || ""),
            anioJuramento: String(fila[2] || ""),
            categoria: String(fila[3] || ""),
            cargo: String(fila[4] || ""),
            rango: String(fila[5] || ""),
            codigoRadial: String(fila[6] || ""),
            nombreCompleto,
            nroDoc: String(fila[11] || ""),
            fechaNacimiento: String(fila[12] || ""),
            correo: correoFila,
          };
        }
      }

      return { exito: false as const, mensaje: "Usuario no encontrado" };
    }),
});
