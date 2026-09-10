import { z } from "zod";
import { formatearNombreCompleto } from "../lib/nombres";
import { createRouter, publicQuery } from "../middleware";
import { readSheet } from "../services/sheets";
import { getFirestoreClient } from "../services/firestore";
import { normalizarFechaISO } from "../lib/fechas";
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

const db = () => getFirestoreClient();
const colCabecera = () => db().collection("rolesGuardiaCabecera");
const colGrupos = () => db().collection("rolesGuardiaGrupos");
const colPersonal = () => db().collection("rolesGuardiaPersonal");
const colEspeciales = () => db().collection("rolesGuardiaEspeciales");
const colActivos = () => db().collection("rolesGuardiaActivos");
const colLicencias = () => db().collection("rolesGuardiaLicencias");
const colCalendario = () => db().collection("rolesGuardiaCalendario");

function idCalendario(idGrupo: string, anio: number, mes: number): string {
  return `${idGrupo}_${anio}_${mes}`;
}

export const rolesGuardiaRouter = createRouter({
  // Lista todos los Roles de Guardia creados, mas reciente primero.
  listar: publicQuery.query(async () => {
    const snapshot = await colCabecera().get();
    const roles: Array<{
      id: string;
      mesInicio: number;
      anioInicio: number;
      mesFin: number;
      anioFin: number;
      fechaCreacion: string;
      etiqueta: string;
    }> = [];

    snapshot.forEach((doc) => {
      const fila = doc.data();
      const mesInicio = Number(fila.mesInicio) || 1;
      const anioInicio = Number(fila.anioInicio) || 0;
      const mesFin = Number(fila.mesFin) || 1;
      const anioFin = Number(fila.anioFin) || 0;
      const etiqueta = anioInicio === anioFin
        ? `${MESES[mesInicio - 1]} - ${MESES[mesFin - 1]} ${anioFin}`
        : `${MESES[mesInicio - 1]} ${anioInicio} - ${MESES[mesFin - 1]} ${anioFin}`;
      roles.push({
        id: doc.id,
        mesInicio,
        anioInicio,
        mesFin,
        anioFin,
        fechaCreacion: String(fila.fechaCreacion || ""),
        etiqueta,
      });
    });

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

      await colCabecera().doc(id).set({
        mesInicio: input.mesInicio,
        anioInicio: input.anioInicio,
        mesFin,
        anioFin,
        fechaCreacion,
      });

      return { exito: true as const, id };
    }),

  // Trae la cabecera de un Rol + sus grupos, cada uno con su personal asignado.
  obtenerDetalle: publicQuery
    .input(z.object({ idRol: z.string() }))
    .query(async ({ input }) => {
      const cabDoc = await colCabecera().doc(input.idRol).get();
      if (!cabDoc.exists) {
        return { exito: false as const, error: "Rol de Guardia no encontrado" };
      }
      const cabFila = cabDoc.data()!;
      const cabecera = {
        id: input.idRol,
        mesInicio: Number(cabFila.mesInicio) || 1,
        anioInicio: Number(cabFila.anioInicio) || 0,
        mesFin: Number(cabFila.mesFin) || 1,
        anioFin: Number(cabFila.anioFin) || 0,
        fechaCreacion: String(cabFila.fechaCreacion || ""),
      };

      const gruposSnap = await colGrupos().where("idRol", "==", input.idRol).get();
      const grupos: Array<{ id: string; nombreGrupo: string; orden: number }> = [];
      gruposSnap.forEach((doc) => {
        const fila = doc.data();
        grupos.push({
          id: doc.id,
          nombreGrupo: String(fila.nombreGrupo || ""),
          orden: Number(fila.orden) || 0,
        });
      });
      grupos.sort((a, b) => a.orden - b.orden);

      const personalSnap = await colPersonal().where("idRol", "==", input.idRol).get();
      const usuariosData = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:U");
      const nombrePorCodigo = new Map<string, string>();
      for (let i = 1; i < usuariosData.length; i++) {
        const codigo = String(usuariosData[i][1] || "").trim();
        const primerNombre = String(usuariosData[i][7] || "").trim();
        const primerApellido = String(usuariosData[i][9] || "").trim();
        const rangoFila = String(usuariosData[i][5] || "").trim();
        const categoriaFila = String(usuariosData[i][3] || "").trim();
        if (codigo) nombrePorCodigo.set(codigo, formatearNombreCompleto(rangoFila, categoriaFila, primerNombre, primerApellido));
      }

      async function diasGuardados(idGrupo: string, anio: number, mes: number): Promise<number[]> {
        const doc = await colCalendario().doc(idCalendario(idGrupo, anio, mes)).get();
        if (!doc.exists) return [];
        const dias = doc.data()!.dias;
        return Array.isArray(dias) ? dias : [];
      }

      const gruposConPersonal = await Promise.all(grupos.map(async (g) => {
        const personalGrupo: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; orden: number }> = [];
        personalSnap.forEach((doc) => {
          const fila = doc.data();
          if (String(fila.idGrupo || "").trim() !== g.id) return;
          const codigo = String(fila.codigo || "").trim();
          personalGrupo.push({
            id: doc.id,
            codigo,
            nombre: nombrePorCodigo.get(codigo) || codigo,
            radial: String(fila.radial || ""),
            asignacion: String(fila.asignacion || ""),
            orden: Number(fila.orden) || 0,
          });
        });
        personalGrupo.sort((a, b) => a.orden - b.orden);
        return {
          ...g,
          personal: personalGrupo,
          diasInicio: await diasGuardados(g.id, cabecera.anioInicio, cabecera.mesInicio),
          diasFin: await diasGuardados(g.id, cabecera.anioFin, cabecera.mesFin),
        };
      }));

      function leerLista(
        snapshot: FirebaseFirestore.QuerySnapshot,
        conAsignacion: boolean
      ) {
        const lista: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; observaciones: string }> = [];
        snapshot.forEach((doc) => {
          const fila = doc.data();
          const codigo = String(fila.codigo || "").trim();
          if (!codigo) return;
          lista.push({
            id: doc.id,
            codigo,
            nombre: nombrePorCodigo.get(codigo) || codigo,
            radial: String(fila.radial || ""),
            asignacion: conAsignacion ? String(fila.asignacion || "") : "",
            observaciones: conAsignacion ? String(fila.observaciones || "") : String(fila.asignacion || fila.observaciones || ""),
          });
        });
        return lista;
      }

      const especialesSnap = await colEspeciales().where("idRol", "==", input.idRol).get();
      const activosSnap = await colActivos().where("idRol", "==", input.idRol).get();

      const especiales = leerLista(especialesSnap, true);
      const activos = leerLista(activosSnap, true);

      // Licencias: se calculan automaticamente segun quien tenga SITU=LC o LM
      // con una licencia vigente que se superponga con las fechas de este Rol.
      const rolInicioDate = new Date(cabecera.anioInicio, cabecera.mesInicio - 1, 1);
      const rolFinDate = new Date(cabecera.anioFin, cabecera.mesFin, 0);
      const licencias: Array<{ id: string; codigo: string; nombre: string; radial: string; asignacion: string; observaciones: string }> = [];
      for (let i = 1; i < usuariosData.length; i++) {
        const filaU = usuariosData[i];
        const codigoU = String(filaU[1] || "").trim();
        if (!codigoU) continue;
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
          id: codigoU,
          codigo: codigoU,
          nombre: nombrePorCodigo.get(codigoU) || codigoU,
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
      nombrePorCodigo.forEach((nombre, codigo) => {
        if (!codigosAsignados.has(codigo)) {
          noAsignados.push({ codigo, nombre });
        }
      });
      noAsignados.sort((a, b) => a.nombre.localeCompare(b.nombre));

      return { exito: true as const, cabecera, grupos: gruposConPersonal, especiales, licencias, activos, noAsignados };
    }),

  // Agrega una persona a la lista de Guardias Especiales del Rol.
  agregarEspecial: publicQuery
    .input(z.object({ idRol: z.string(), codigo: z.string().min(1), radial: z.string().optional().or(z.literal("")), asignacion: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await colEspeciales().doc(id).set({
        idRol: input.idRol, codigo: input.codigo, radial: input.radial || "",
        asignacion: input.asignacion || "", observaciones: input.observaciones || "",
      });
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Guardias Especiales.
  quitarEspecial: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await colEspeciales().doc(input.id).delete();
      return { exito: true as const };
    }),

  // Agrega una persona a la lista de Licencias del Rol.
  agregarLicencia: publicQuery
    .input(z.object({ idRol: z.string(), codigo: z.string().min(1), radial: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await colLicencias().doc(id).set({
        idRol: input.idRol, codigo: input.codigo, radial: input.radial || "", observaciones: input.observaciones || "",
      });
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Licencias.
  quitarLicencia: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await colLicencias().doc(input.id).delete();
      return { exito: true as const };
    }),

  // Agrega una persona a la lista de Activos del Rol.
  agregarActivo: publicQuery
    .input(z.object({ idRol: z.string(), codigo: z.string().min(1), radial: z.string().optional().or(z.literal("")), asignacion: z.string().optional().or(z.literal("")), observaciones: z.string().optional().or(z.literal("")) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      await colActivos().doc(id).set({
        idRol: input.idRol, codigo: input.codigo, radial: input.radial || "",
        asignacion: input.asignacion || "", observaciones: input.observaciones || "",
      });
      return { exito: true as const, id };
    }),

  // Quita una persona de la lista de Activos.
  quitarActivo: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await colActivos().doc(input.id).delete();
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
      const dias = input.dias.slice().sort((a, b) => a - b);
      await colCalendario().doc(idCalendario(input.idGrupo, input.anio, input.mes)).set({
        idGrupo: input.idGrupo, anio: input.anio, mes: input.mes, dias,
      });
      return { exito: true as const };
    }),

  // Crea un nuevo grupo dentro de un Rol de Guardia.
  crearGrupo: publicQuery
    .input(z.object({ idRol: z.string(), nombreGrupo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const id = generateId();
      const snapshot = await colGrupos().where("idRol", "==", input.idRol).get();
      let maxOrden = 0;
      snapshot.forEach((doc) => {
        maxOrden = Math.max(maxOrden, Number(doc.data().orden) || 0);
      });
      await colGrupos().doc(id).set({ idRol: input.idRol, nombreGrupo: input.nombreGrupo, orden: maxOrden + 1 });
      return { exito: true as const, id };
    }),

  // Elimina un grupo y todo el personal asignado a ese grupo.
  eliminarGrupo: publicQuery
    .input(z.object({ idGrupo: z.string() }))
    .mutation(async ({ input }) => {
      await colGrupos().doc(input.idGrupo).delete();

      const personalSnap = await colPersonal().where("idGrupo", "==", input.idGrupo).get();
      if (!personalSnap.empty) {
        const batch = db().batch();
        personalSnap.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      return { exito: true as const };
    }),

  // Agrega una persona a un grupo dentro de un Rol de Guardia.
  agregarPersonal: publicQuery
    .input(
      z.object({
        idRol: z.string(),
        idGrupo: z.string(),
        codigo: z.string().min(1),
        radial: z.string().optional().or(z.literal("")),
        asignacion: z.string().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      const snapshot = await colPersonal().where("idGrupo", "==", input.idGrupo).get();
      let maxOrden = 0;
      snapshot.forEach((doc) => {
        maxOrden = Math.max(maxOrden, Number(doc.data().orden) || 0);
      });
      await colPersonal().doc(id).set({
        idRol: input.idRol,
        idGrupo: input.idGrupo,
        codigo: input.codigo,
        radial: input.radial || "",
        asignacion: input.asignacion || "",
        orden: maxOrden + 1,
      });
      return { exito: true as const, id };
    }),

  // Quita una persona de un grupo.
  quitarPersonal: publicQuery
    .input(z.object({ idPersonal: z.string() }))
    .mutation(async ({ input }) => {
      await colPersonal().doc(input.idPersonal).delete();
      return { exito: true as const };
    }),
});
