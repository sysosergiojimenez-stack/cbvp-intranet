import { z } from "zod";
import { normalizarFechaISO } from "../lib/fechas";
import { createRouter, publicQuery, adminProcedure } from "../middleware";
import { readSheet, appendRow, updateRange } from "../services/sheets";
import { env } from "../lib/env";
import { generarIdentificadorUnico } from "../lib/identificador";
import { leerUsuariosBase } from "../lib/usuarios";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

const NIVEL_LABELS: Record<number, string> = {
  1: "Basico",
  2: "Operativo",
  3: "Supervisor",
  4: "Administrador",
  5: "Total",
};

export const personalRouter = createRouter({
  list: publicQuery.query(async () => {
    const { usuarios } = await leerUsuariosBase();

    const personal = usuarios
      .filter((u) => u.cargo.toUpperCase() !== "DESARROLLADOR")
      .map((u) => ({
        identificador: u.identificador,
        codigo: u.codigo,
        anioJuramento: u.anioJuramento,
        categoria: u.categoria,
        cargo: u.cargo,
        rango: u.rango,
        codigoRadial: u.codigoRadial,
        nombreCompleto: u.nombreCompleto,
        nivelPermiso: 1,
        situ: u.situ,
        cuota: u.cuota,
        licenciaInicio: normalizarFechaISO(u.licenciaInicio),
        licenciaDias: u.licenciaDias,
      }));

    // Ordenar: primero por AnioJuramento (numerico ASC), luego por Codigo (numerico ASC)
    personal.sort((a, b) => {
      const anioA = parseInt(a.anioJuramento) || 0;
      const anioB = parseInt(b.anioJuramento) || 0;
      if (anioA !== anioB) return anioA - anioB;

      const numA = parseInt(extractNumber(a.codigo)) || 0;
      const numB = parseInt(extractNumber(b.codigo)) || 0;
      return numA - numB;
    });

    return { exito: true as const, personal };
  }),

  historial: publicQuery
    .input(z.object({ identificador: z.string() }))
    .query(async ({ input }) => {
      const identificadorBusqueda = input.identificador.trim();

      const data = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L"
      );

      const guardias: Array<{
        idPlanilla: string;
        fechaGuardia: string;
        grupo: string;
        tipo: string;
        asignacion: string;
        asistencia: string;
        fechaCarga: string;
      }> = [];

      for (let i = 1; i < data.length; i++) {
        const identificadorFila = data[i][6] ? String(data[i][6]).trim() : "";

        if (identificadorFila === identificadorBusqueda) {
          guardias.push({
            idPlanilla: String(data[i][1] || ""),
            fechaGuardia: String(data[i][3] || ""),
            grupo: String(data[i][4] || ""),
            tipo: String(data[i][5] || ""),
            asignacion: String(data[i][8] || ""),
            asistencia: String(data[i][9] || ""),
            fechaCarga: String(data[i][2] || ""),
          });
        }
      }

      const stats = {
        totalGuardias: guardias.length,
        guardiasNormales: guardias.filter((g) => g.tipo === "GUARDIA NORMAL").length,
        guardiasEspeciales: guardias.filter((g) => g.tipo === "GUARDIA ESPECIAL").length,
        refuerzos: guardias.filter((g) => g.tipo === "REFUERZO").length,
        presentes: guardias.filter((g) => g.asistencia === "PRESENTE").length,
        acacr: guardias.filter((g) => g.asistencia === "ACACR").length,
        acasr: guardias.filter((g) => g.asistencia === "ACASR").length,
        asasr: guardias.filter((g) => g.asistencia === "ASASR").length,
      };

      return { exito: true as const, guardias, stats };
    }),

  crear: publicQuery
    .input(
      z.object({
        codigo: z.string().optional().or(z.literal("")),
        anioJuramento: z.string().min(1),
        categoria: z.string().min(1),
        rango: z.string().min(1),
        codigoRadial: z.string(),
        primerNombre: z.string().min(1),
        segundoNombre: z.string(),
        primerApellido: z.string().min(1),
        segundoApellido: z.string(),
        nroDocId: z.string().optional(),
        fechaNacimiento: z.string().optional(),
        correo: z.string().email().optional().or(z.literal("")),
        contrasena: z.string().optional().or(z.literal("")),
        nivelPermiso: z.string().optional().or(z.literal("")),
        descripcionPermiso: z.string().optional().or(z.literal("")),
        situ: z.string().optional().or(z.literal("")),
        cuota: z.string().optional().or(z.literal("")),
        licenciaInicio: z.string().optional().or(z.literal("")),
        licenciaDias: z.string().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:A");
      const existentes = new Set<string>();
      for (let i = 1; i < data.length; i++) {
        const id = String(data[i][0] || "").trim();
        if (id) existentes.add(id);
      }
      const identificador = await generarIdentificadorUnico(existentes);

      await appendRow(env.SHEET_USUARIOS_ID, "USUARIOS", [
        identificador,
        input.codigo || "",
        input.anioJuramento,
        input.categoria,
        "", // E: CARGO (no se usa en formulario)
        input.rango,
        input.codigoRadial,
        input.primerNombre,
        input.segundoNombre,
        input.primerApellido,
        input.segundoApellido,
        input.nroDocId || "",
        input.fechaNacimiento || "",
        input.correo,
        input.contrasena,
        input.nivelPermiso,
        input.descripcionPermiso,
        input.situ || "",
        input.cuota || "",
        input.licenciaInicio || "",
        input.licenciaDias || "",
      ]);
      return { exito: true as const, mensaje: "Bombero registrado correctamente", identificador };
    }),

  obtenerPorIdentificador: publicQuery
    .input(z.object({ identificador: z.string() }))
    .query(async ({ input }) => {
      const { porIdentificador } = await leerUsuariosBase();
      const u = porIdentificador.get(input.identificador.trim());
      if (!u) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      const fullData = await readSheet(env.SHEET_USUARIOS_ID, `USUARIOS!A${u.rowIndex}:U${u.rowIndex}`);
      const row = fullData[0] || [];
      return {
        exito: true as const,
        bombero: {
          identificador: u.identificador,
          codigo: u.codigo,
          anioJuramento: u.anioJuramento,
          categoria: u.categoria,
          cargo: u.cargo,
          rango: u.rango,
          codigoRadial: u.codigoRadial,
          primerNombre: u.primerNombre,
          segundoNombre: String(row[8] || ""),
          segundoApellido: String(row[10] || ""),
          primerApellido: u.primerApellido,
          nroDocId: String(row[11] || ""),
          fechaNacimiento: String(row[12] || ""),
          correo: String(row[13] || ""),
          nivelPermiso: String(row[15] || "1"),
          descripcionPermiso: String(row[16] || ""),
          situ: u.situ,
          cuota: u.cuota,
          licenciaInicio: normalizarFechaISO(u.licenciaInicio),
          licenciaDias: u.licenciaDias,
        },
      };
    }),

  editar: publicQuery
    .input(
      z.object({
        identificador: z.string().min(1),
        codigo: z.string().optional().or(z.literal("")),
        anioJuramento: z.string().min(1),
        categoria: z.string().min(1),
        rango: z.string().min(1),
        codigoRadial: z.string(),
        primerNombre: z.string().min(1),
        segundoNombre: z.string(),
        primerApellido: z.string().min(1),
        segundoApellido: z.string(),
        nroDocId: z.string().optional(),
        fechaNacimiento: z.string().optional(),
        situ: z.string().optional().or(z.literal("")),
        cuota: z.string().optional().or(z.literal("")),
        licenciaInicio: z.string().optional().or(z.literal("")),
        licenciaDias: z.string().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const { porIdentificador } = await leerUsuariosBase();
      const u = porIdentificador.get(input.identificador.trim());
      if (!u) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      const data = await readSheet(env.SHEET_USUARIOS_ID, `USUARIOS!A${u.rowIndex}:U${u.rowIndex}`);
      const existingRow = data[0] || [];
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!A${u.rowIndex}:U${u.rowIndex}`, [[
        input.identificador,
        input.codigo ?? existingRow[1] ?? "",
        input.anioJuramento,
        input.categoria,
        existingRow[4] || "", // E: CARGO (preserve existing)
        input.rango,
        input.codigoRadial,
        input.primerNombre,
        input.segundoNombre,
        input.primerApellido,
        input.segundoApellido,
        input.nroDocId || "",
        input.fechaNacimiento || "",
        existingRow[13] || "", // N: correo (preserve existing)
        existingRow[14] || "", // O: contrasena (preserve existing)
        existingRow[15] || "", // P: nivelPermiso (preserve existing)
        existingRow[16] || "", // Q: descripcionPermiso (preserve existing)
        input.situ || "",
        input.cuota || "",
        input.licenciaInicio || "",
        input.licenciaDias || "",
      ]]);
      return { exito: true as const, mensaje: "Bombero actualizado correctamente" };
    }),

  cambiarAcceso: publicQuery
    .input(
      z.object({
        correoActual: z.string().email(),
        correoNuevo: z.string().email(),
        contrasenaActual: z.string().min(1),
        contrasenaNueva: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Buscar por correo+contrasena en vez de por identificador
      // Asi solo puedes modificar tu propia fila
      const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:Q");
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as string[];
        const storedEmail = String(row[13] || "").trim();
        const storedPassword = String(row[14] || "").trim();
        if (storedEmail === input.correoActual.trim() && storedPassword === input.contrasenaActual.trim()) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex === -1) {
        return { exito: false as const, error: "Correo o contrasena actual incorrectos" };
      }
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!N${rowIndex}:O${rowIndex}`, [[
        input.correoNuevo.trim(),
        input.contrasenaNueva.trim(),
      ]]);
      return { exito: true as const, mensaje: "Datos de acceso actualizados correctamente" };
    }),

  resumenCuadroServicio: publicQuery.query(async () => {
    const { usuarios } = await leerUsuariosBase();

    let regimenNormal = 0;
    let regimenEspecial = 0;
    let b10a = 0;
    let b15a = 0;
    let b20a = 0;
    let comisionados = 0;
    let licencia = 0;

    for (const u of usuarios) {
      if (u.cargo.toUpperCase() === "DESARROLLADOR") continue;
      const situ = u.situ;
      if (situ === "RN") regimenNormal++;
      else if (situ === "GE") regimenEspecial++;
      else if (situ === "B10A") b10a++;
      else if (situ === "B15A") b15a++;
      else if (situ === "B20A") b20a++;
      else if (situ === "CM") comisionados++;
      else if (situ === "LC") licencia++;
    }

    const total = usuarios.filter((u) => u.cargo.toUpperCase() !== "DESARROLLADOR").length;
    const enCuadro = regimenNormal + regimenEspecial + b10a + b15a + b20a + comisionados;
    const fueraDeCuadro = total - enCuadro - licencia;

    return {
      exito: true as const,
      regimenNormal,
      regimenEspecial,
      b10a,
      b15a,
      b20a,
      comisionados,
      enCuadro,
      licencia,
      fueraDeCuadro,
      total,
    };
  }),

  // Asigna el Cargo (rol) y el Nivel de Permiso a un bombero existente.
  actualizarRolPermiso: adminProcedure
    .input(
      z.object({
        codigo: z.string().min(1).optional(),
        identificador: z.string().min(1).optional(),
        cargo: z.string().min(1),
        nivelPermiso: z.number().min(1).max(5),
      }).refine((data) => !!data.codigo || !!data.identificador, {
        message: "Se requiere codigo o identificador",
        path: ["codigo"],
      })
    )
    .mutation(async ({ input }) => {
      const { porIdentificador, porCodigo } = await leerUsuariosBase();
      const u = input.identificador
        ? porIdentificador.get(input.identificador.trim())
        : porCodigo.get(input.codigo!.trim());
      if (!u) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!E${u.rowIndex}`, [[input.cargo]]);
      await updateRange(env.SHEET_USUARIOS_ID, `USUARIOS!P${u.rowIndex}:Q${u.rowIndex}`, [[input.nivelPermiso, NIVEL_LABELS[input.nivelPermiso] || ""]]);
      return { exito: true as const };
    }),
});
