import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange, deleteRows, getSheetId, findRowIndex } from "../services/sheets";
import { normalizarFechaISO } from "../lib/fechas";
import { leerUsuariosBase } from "../lib/usuarios";
import { env } from "../lib/env";

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const rolesGuardiaRouter = createRouter({
  // Lista todos los Roles de Guardia creados, mas reciente primero.
  listar: publicQuery.query(async () => {
    const data = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera!A1:F");
    const roles: Array<{
      id: string;
      mesInicio: number;
      anioInicio: number;
      mesFin: number;
      anioFin: number;
      fechaCreacion: string;
      etiqueta: string;
    }> = [];

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      const id = String(fila[0] || "").trim();
      if (!id) continue;
      const mesInicio = Number(fila[1]) || 1;
      const anioInicio = Number(fila[2]) || 0;
      const mesFin = Number(fila[3]) || 1;
      const anioFin = Number(fila[4]) || 0;
      const etiqueta = anioInicio === anioFin
        ? `${MESES[mesInicio - 1]} - ${MESES[mesFin - 1]} ${anioFin}`
        : `${MESES[mesInicio - 1]} ${anioInicio} - ${MESES[mesFin - 1]} ${anioFin}`;
      roles.push({
        id,
        mesInicio,
        anioInicio,
        mesFin,
        anioFin,
        fechaCreacion: String(fila[5] || ""),
        etiqueta,
      });
    }

    // Mas reciente primero (el id es un timestamp AAAAMMDDHHMMSS)
    roles.sort((a, b) => b.id.localeCompare(a.id));

    return { exito: true as const, roles };
  }),

  // Crea un nuevo Rol de Guardia bimensual a partir del mes/anio de inicio.
  crear: publicQuery
    .input(
      z.object({
        mesInicio: z.number().min(1).max(12),
        anioInicio: z.number().min(2020),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      let mesFin = input.mesInicio + 1;
      let anioFin = input.anioInicio;
      if (mesFin > 12) {
        mesFin = 1;
        anioFin += 1;
      }

      const ahora = new Date();
      const fechaCreacion = `${String(ahora.getDate()).padStart(2, "0")}/${String(ahora.getMonth() + 1).padStart(2, "0")}/${ahora.getFullYear()}`;

      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera", [
        id,
        input.mesInicio,
        input.anioInicio,
        mesFin,
        anioFin,
        fechaCreacion,
      ]);

      return { exito: true as const, id };
    }),

  // Trae la cabecera de un Rol + sus grupos, cada uno con su personal asignado.
  obtenerDetalle: publicQuery
    .input(z.object({ idRol: z.string() }))
    .query(async ({ input }) => {
      const cabData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera!A1:F");
      let cabecera: { id: string; mesInicio: number; anioInicio: number; mesFin: number; anioFin: number; fechaCreacion: string } | null = null;
      for (let i = 1; i < cabData.length; i++) {
        if (String(cabData[i][0] || "").trim() === input.idRol) {
          cabecera = {
            id: input.idRol,
            mesInicio: Number(cabData[i][1]) || 1,
            anioInicio: Number(cabData[i][2]) || 0,
            mesFin: Number(cabData[i][3]) || 1,
            anioFin: Number(cabData[i][4]) || 0,
            fechaCreacion: String(cabData[i][5] || ""),
          };
          break;
        }
      }
      if (!cabecera) {
        return { exito: false as const, error: "Rol de Guardia no encontrado" };
      }

      const gruposData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos!A1:D");
      const grupos: Array<{ id: string; nombreGrupo: string; orden: number }> = [];
      for (let i = 1; i < gruposData.length; i++) {
        const fila = gruposData[i];
        if (String(fila[1] || "").trim() !== input.idRol) continue;
        grupos.push({
          id: String(fila[0] || ""),
          nombreGrupo: String(fila[2] || ""),
          orden: Number(fila[3]) || 0,
        });
      }
      grupos.sort((a, b) => a.orden - b.orden);

      const personalData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal!A1:G");
      const { porIdentificador } = await leerUsuariosBase();
      const nombrePorIdentificador = new Map<string, string>();
      for (const u of porIdentificador.values()) {
        nombrePorIdentificador.set(u.identificador, u.nombreCompleto);
      }

      const calData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Calendario!A1:E");
      function diasGuardados(idGrupo: string, anio: number, mes: number): number[] {
        for (let i = 1; i < calData.length; i++) {
          if (
            String(calData[i][1] || "").trim() === idGrupo &&
            Number(calData[i][2]) === anio &&
            Number(calData[i][3]) === mes
          ) {
            const str = String(calData[i][4] || "").trim();
            return str ? str.split(",").map((d) => Number(d.trim())).filter((n) => !isNaN(n)) : [];
          }
        }
        return [];
      }

      const gruposConPersonal = grupos.map((g) => {
        const personalGrupo: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; orden: number }> = [];
        for (let i = 1; i < personalData.length; i++) {
          const fila = personalData[i];
          if (String(fila[1] || "").trim() !== input.idRol) continue;
          if (String(fila[2] || "").trim() !== g.id) continue;
          const identificador = String(fila[3] || "").trim();
          personalGrupo.push({
            id: String(fila[0] || ""),
            codigo: identificador,
            nombre: nombrePorIdentificador.get(identificador) || identificador,
            radial: String(fila[4] || ""),
            asignacion: String(fila[5] || ""),
            orden: Number(fila[6]) || 0,
          });
        }
        personalGrupo.sort((a, b) => a.orden - b.orden);
        return {
          ...g,
          personal: personalGrupo,
          diasInicio: diasGuardados(g.id, cabecera!.anioInicio, cabecera!.mesInicio),
          diasFin: diasGuardados(g.id, cabecera!.anioFin, cabecera!.mesFin),
        };
      });

      function leerLista(rows: unknown[][], conAsignacion: boolean) {
        const lista: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; observaciones: string }> = [];
        for (let i = 1; i < rows.length; i++) {
          const fila = rows[i];
          if (String(fila[1] || "").trim() !== input.idRol) continue;
          const identificador = String(fila[2] || "").trim();
          if (!identificador) continue;
          lista.push({
            id: String(fila[0] || ""),
            codigo: identificador,
            nombre: nombrePorIdentificador.get(identificador) || identificador,
            radial: String(fila[3] || ""),
            asignacion: conAsignacion ? String(fila[4] || "") : "",
            observaciones: conAsignacion ? String(fila[5] || "") : String(fila[4] || ""),
          });
        }
        return lista;
      }

      const especialesData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Especiales!A1:F");
      const activosData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Activos!A1:F");

      const especiales = leerLista(especialesData, true);
      const activos = leerLista(activosData, true);

      // Licencias: se calculan automaticamente segun quien tenga SITU=LC o LM
      // con una licencia vigente que se superponga con las fechas de este Rol.
      const rolInicioDate = new Date(cabecera!.anioInicio, cabecera!.mesInicio - 1, 1);
      const rolFinDate = new Date(cabecera!.anioFin, cabecera!.mesFin, 0);
      const usuariosData = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:U");
      const licencias: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; observaciones: string }> = [];
      for (let i = 1; i < usuariosData.length; i++) {
        const filaU = usuariosData[i];
        const identificadorU = String(filaU[0] || "").trim();
        if (!identificadorU) continue;
        const situU = String(filaU[17] || "").trim().toUpperCase();
        if (situU !== "LC" && situU !== "LM") continue;
        const licInicioStr = normalizarFechaISO(String(filaU[19] || "").trim());
        const licDiasStr = String(filaU[20] || "").trim();
        if (!licInicioStr || !licDiasStr) continue;
        const licInicioDate = new Date(licInicioStr);
        if (isNaN(licInicioDate.getTime())) continue;
        const licFinDate = new Date(licInicioDate);
        licFinDate.setDate(licFinDate.getDate() + (Number(licDiasStr) || 0));
        const vigenteEnRol = licInicioDate <= rolFinDate && licFinDate >= rolInicioDate;
        if (!vigenteEnRol) continue;
        licencias.push({
          id: identificadorU,
          codigo: identificadorU,
          nombre: nombrePorIdentificador.get(identificadorU) || identificadorU,
          radial: "",
          asignacion: situU === "LM" ? "Licencia Maternidad" : "Licencia",
          observaciones: `Del ${licInicioDate.toLocaleDateString("es-PY")} al ${licFinDate.toLocaleDateString("es-PY")}`,
        });
      }

      const codigosAsignados = new Set<string>();
      gruposConPersonal.forEach((g) => g.personal.forEach((p) => codigosAsignados.add(p.codigo)));
      especiales.forEach((p) => codigosAsignados.add(p.codigo));
      licencias.forEach((p) => codigosAsignados.add(p.codigo));
      activos.forEach((p) => codigosAsignados.add(p.codigo));

      const noAsignados: Array<{ codigo: string; nombre: string }> = [];
      nombrePorIdentificador.forEach((nombre, identificador) => {
        if (!codigosAsignados.has(identificador)) {
          noAsignados.push({ codigo: identificador, nombre });
        }
      });
      noAsignados.sort((a, b) => a.nombre.localeCompare(b.nombre));

      return { exito: true as const, cabecera, grupos: gruposConPersonal, especiales, licencias, activos, noAsignados };
    }),

  // Agrega una persona a la lista de Guardias Especiales del Rol.
  agregarEspecial: publicQuery
    .input(z.object({ idRol: z.string(), identificador: z.string().min(1), radial: z.string().optional().or(z.literal("")), asignacion: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Especiales", [id, input.idRol, input.identificador, input.radial || "", input.asignacion || "", input.observaciones || ""]);
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Guardias Especiales.
  quitarEspecial: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const rowIndex = await findRowIndex(env.SHEET_GUARDIAS_ID, "RolesGuardia_Especiales!A1:F", 0, input.id);
      if (rowIndex === -1) return { exito: false as const, error: "No encontrado" };
      const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Especiales");
      await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, [rowIndex]);
      return { exito: true as const };
    }),

  // Agrega una persona a la lista de Licencias del Rol.
  agregarLicencia: publicQuery
    .input(z.object({ idRol: z.string(), identificador: z.string().min(1), radial: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Licencias", [id, input.idRol, input.identificador, input.radial || "", input.observaciones || ""]);
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Licencias.
  quitarLicencia: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const rowIndex = await findRowIndex(env.SHEET_GUARDIAS_ID, "RolesGuardia_Licencias!A1:E", 0, input.id);
      if (rowIndex === -1) return { exito: false as const, error: "No encontrado" };
      const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Licencias");
      await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, [rowIndex]);
      return { exito: true as const };
    }),

  // Agrega una persona a la lista de Activos del Rol.
  agregarActivo: publicQuery
    .input(z.object({ idRol: z.string(), identificador: z.string().min(1), radial: z.string().optional().or(z.literal("")), asignacion: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Activos", [id, input.idRol, input.identificador, input.radial || "", input.asignacion || "", input.observaciones || ""]);
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Activos.
  quitarActivo: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const rowIndex = await findRowIndex(env.SHEET_GUARDIAS_ID, "RolesGuardia_Activos!A1:F", 0, input.id);
      if (rowIndex === -1) return { exito: false as const, error: "No encontrado" };
      const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Activos");
      await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, [rowIndex]);
      return { exito: true as const };
    }),

  // Guarda (crea o actualiza) los dias marcados de guardia para un grupo, mes y anio.
  guardarCalendario: publicQuery
    .input(
      z.object({
        idGrupo: z.string(),
        anio: z.number(),
        mes: z.number(),
        dias: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Calendario!A1:E");
      let rowIndex = -1;
      let idExistente = "";
      for (let i = 1; i < data.length; i++) {
        if (
          String(data[i][1] || "").trim() === input.idGrupo &&
          Number(data[i][2]) === input.anio &&
          Number(data[i][3]) === input.mes
        ) {
          rowIndex = i + 1;
          idExistente = String(data[i][0] || "");
          break;
        }
      }
      const diasStr = input.dias.slice().sort((a, b) => a - b).join(",");
      if (rowIndex !== -1) {
        await updateRange(env.SHEET_GUARDIAS_ID, `RolesGuardia_Calendario!A${rowIndex}:E${rowIndex}`, [[
          idExistente,
          input.idGrupo,
          input.anio,
          input.mes,
          diasStr,
        ]]);
      } else {
        const id = generateId();
        await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Calendario", [id, input.idGrupo, input.anio, input.mes, diasStr]);
      }
      return { exito: true as const };
    }),

  // Crea un nuevo grupo dentro de un Rol de Guardia.
  crearGrupo: publicQuery
    .input(z.object({ idRol: z.string(), nombreGrupo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos!A1:D");
      let maxOrden = 0;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1] || "").trim() === input.idRol) {
          maxOrden = Math.max(maxOrden, Number(data[i][3]) || 0);
        }
      }
      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos", [id, input.idRol, input.nombreGrupo, maxOrden + 1]);
      return { exito: true as const, id };
    }),

  // Elimina un grupo y todo el personal asignado a ese grupo.
  eliminarGrupo: publicQuery
    .input(z.object({ idGrupo: z.string() }))
    .mutation(async ({ input }) => {
      const rowIndex = await findRowIndex(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos!A1:D", 0, input.idGrupo);
      if (rowIndex !== -1) {
        const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos");
        await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, [rowIndex]);
      }

      const personalData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal!A1:G");
      const filasABorrar: number[] = [];
      for (let i = 1; i < personalData.length; i++) {
        if (String(personalData[i][2] || "").trim() === input.idGrupo) {
          filasABorrar.push(i + 1);
        }
      }
      if (filasABorrar.length > 0) {
        const sheetIdPersonal = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal");
        await deleteRows(env.SHEET_GUARDIAS_ID, sheetIdPersonal, filasABorrar);
      }

      return { exito: true as const };
    }),

  // Agrega una persona a un grupo dentro de un Rol de Guardia.
  agregarPersonal: publicQuery
    .input(
      z.object({
        idRol: z.string(),
        idGrupo: z.string(),
        identificador: z.string().min(1),
        radial: z.string().optional().or(z.literal("")),
        asignacion: z.string().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal!A1:G");
      let maxOrden = 0;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][2] || "").trim() === input.idGrupo) {
          maxOrden = Math.max(maxOrden, Number(data[i][6]) || 0);
        }
      }
      await appendRow(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal", [
        id,
        input.idRol,
        input.idGrupo,
        input.identificador,
        input.radial || "",
        input.asignacion || "",
        maxOrden + 1,
      ]);
      return { exito: true as const, id };
    }),

  // Quita una persona de un grupo.
  quitarPersonal: publicQuery
    .input(z.object({ idPersonal: z.string() }))
    .mutation(async ({ input }) => {
      const rowIndex = await findRowIndex(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal!A1:G", 0, input.idPersonal);
      if (rowIndex === -1) {
        return { exito: false as const, error: "No encontrado" };
      }
      const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal");
      await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, [rowIndex]);
      return { exito: true as const };
    }),

  // Elimina un Rol de Guardia completo (cabecera, grupos, personal, calendarios y listas).
  eliminarRol: publicQuery
    .input(z.object({ idRol: z.string() }))
    .mutation(async ({ input }) => {
      const idRol = input.idRol.trim();

      // Cabecera
      const cabData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Cabecera!A1:F");
      const filasABorrar = new Map<string, number[]>();
      for (let i = 1; i < cabData.length; i++) {
        if (String(cabData[i][0] || "").trim() === idRol) {
          filasABorrar.set("RolesGuardia_Cabecera", [i + 1]);
          break;
        }
      }

      // Grupos del rol
      const gruposData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Grupos!A1:D");
      const idsGrupos = new Set<string>();
      const filasGrupos: number[] = [];
      for (let i = 1; i < gruposData.length; i++) {
        if (String(gruposData[i][1] || "").trim() === idRol) {
          idsGrupos.add(String(gruposData[i][0] || "").trim());
          filasGrupos.push(i + 1);
        }
      }
      if (filasGrupos.length > 0) filasABorrar.set("RolesGuardia_Grupos", filasGrupos);

      // Personal de los grupos del rol
      const personalData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Personal!A1:G");
      const filasPersonal: number[] = [];
      for (let i = 1; i < personalData.length; i++) {
        if (String(personalData[i][1] || "").trim() === idRol || idsGrupos.has(String(personalData[i][2] || "").trim())) {
          filasPersonal.push(i + 1);
        }
      }
      if (filasPersonal.length > 0) filasABorrar.set("RolesGuardia_Personal", filasPersonal);

      // Calendarios de los grupos del rol
      const calData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Calendario!A1:E");
      const filasCal: number[] = [];
      for (let i = 1; i < calData.length; i++) {
        if (idsGrupos.has(String(calData[i][1] || "").trim())) {
          filasCal.push(i + 1);
        }
      }
      if (filasCal.length > 0) filasABorrar.set("RolesGuardia_Calendario", filasCal);

      // Especiales, Licencias y Activos del rol
      const filasEspeciales: number[] = [];
      const especialesData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Especiales!A1:F");
      for (let i = 1; i < especialesData.length; i++) {
        if (String(especialesData[i][1] || "").trim() === idRol) filasEspeciales.push(i + 1);
      }
      if (filasEspeciales.length > 0) filasABorrar.set("RolesGuardia_Especiales", filasEspeciales);

      const filasLicencias: number[] = [];
      const licenciasData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Licencias!A1:E");
      for (let i = 1; i < licenciasData.length; i++) {
        if (String(licenciasData[i][1] || "").trim() === idRol) filasLicencias.push(i + 1);
      }
      if (filasLicencias.length > 0) filasABorrar.set("RolesGuardia_Licencias", filasLicencias);

      const filasActivos: number[] = [];
      const activosData = await readSheet(env.SHEET_GUARDIAS_ID, "RolesGuardia_Activos!A1:F");
      for (let i = 1; i < activosData.length; i++) {
        if (String(activosData[i][1] || "").trim() === idRol) filasActivos.push(i + 1);
      }
      if (filasActivos.length > 0) filasABorrar.set("RolesGuardia_Activos", filasActivos);

      // Borrar de abajo hacia arriba para mantener los indices validos
      for (const [sheetName, filas] of filasABorrar) {
        const ordenadas = filas.sort((a, b) => b - a);
        const sheetId = await getSheetId(env.SHEET_GUARDIAS_ID, sheetName);
        await deleteRows(env.SHEET_GUARDIAS_ID, sheetId, ordenadas);
      }

      return { exito: true as const };
    }),
});
