import { z } from "zod";
import { formatearNombreCompleto } from "../lib/nombres";
import { normalizarFechaISO, normalizarMesAnio } from "../lib/fechas";
import { createRouter, publicQuery, adminProcedure } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colUsuarios } from "../services/usuariosFirestore";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

const colGuardiasPersonal = () => getFirestoreClient().collection("guardiasPersonal");

export const personalRouter = createRouter({
  list: publicQuery.query(async () => {
    const snapshot = await colUsuarios().get();
    const personal: Array<{
      identificador: string;
      codigo: string;
      anioJuramento: string;
      categoria: string;
      cargo: string;
      rango: string;
      codigoRadial: string;
      nombreCompleto: string;
      nivelPermiso: number;
      situ: string;
      cuota: string;
      licenciaInicio: string;
      licenciaDias: string;
      exencion: string;
      comisionadoDesde: string;
    }> = [];

    snapshot.forEach((doc) => {
      const fila = doc.data();
      const codigo = fila.codigo ? String(fila.codigo).trim() : "";
      const primerNombre = fila.primerNombre ? String(fila.primerNombre).trim() : "";
      if (!codigo || !primerNombre) return;

      const primerApellido = fila.primerApellido ? String(fila.primerApellido).trim() : "";
      const rango = fila.rango ? String(fila.rango).trim() : "";
      const categoriaFila = fila.categoria ? String(fila.categoria).trim() : "";
      const nombreCompleto = formatearNombreCompleto(rango, categoriaFila, primerNombre, primerApellido);

      const nivelRaw = parseInt(String(fila.nivelPermiso || "1"), 10);

      personal.push({
        identificador: doc.id,
        codigo,
        anioJuramento: String(fila.anioJuramento || ""),
        categoria: String(fila.categoria || ""),
        cargo: String(fila.cargo || ""),
        rango: String(fila.rango || ""),
        codigoRadial: String(fila.codigoRadial || ""),
        nombreCompleto,
        nivelPermiso: nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1,
        situ: String(fila.situ || ""),
        cuota: normalizarMesAnio(String(fila.cuota || "")),
        licenciaInicio: normalizarFechaISO(String(fila.licenciaInicio || "")),
        licenciaDias: String(fila.licenciaDias || ""),
        exencion: String(fila.exencion || ""),
        comisionadoDesde: normalizarFechaISO(String(fila.comisionadoDesde || "")),
      });
    });

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
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const codigoBusqueda = input.codigo.toString().trim().toUpperCase();
      const numeroBusqueda = extractNumber(codigoBusqueda);

      const snapshot = await colGuardiasPersonal().get();

      const guardias: Array<{
        idPlanilla: string;
        fechaGuardia: string;
        grupo: string;
        tipo: string;
        asignacion: string;
        asistencia: string;
        fechaCarga: string;
      }> = [];

      snapshot.forEach((doc) => {
        const fila = doc.data();
        const codigoFila = fila.codigo ? String(fila.codigo).trim().toUpperCase() : "";
        const numeroFila = extractNumber(codigoFila);

        if (numeroFila && numeroFila === numeroBusqueda) {
          guardias.push({
            idPlanilla: String(fila.idPlanilla || ""),
            fechaGuardia: String(fila.fechaGuardia || ""),
            grupo: String(fila.grupo || ""),
            tipo: String(fila.tipo || ""),
            asignacion: String(fila.asignacion || ""),
            asistencia: String(fila.asistencia || ""),
            fechaCarga: String(fila.fechaCarga || ""),
          });
        }
      });

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
        codigo: z.string().min(1),
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
        correo: z.string().email().optional().or(z.literal('')),
        contrasena: z.string().optional().or(z.literal('')),
        nivelPermiso: z.string().optional().or(z.literal('')),
        descripcionPermiso: z.string().optional().or(z.literal('')),
        situ: z.string().optional().or(z.literal('')),
        cuota: z.string().optional().or(z.literal('')),
        licenciaInicio: z.string().optional().or(z.literal('')),
        licenciaDias: z.string().optional().or(z.literal('')),
        exencion: z.string().optional().or(z.literal('')),
        comisionadoDesde: z.string().optional().or(z.literal('')),
      })
    )
    .mutation(async ({ input }) => {
      await colUsuarios().add({
        codigo: input.codigo,
        anioJuramento: input.anioJuramento,
        categoria: input.categoria,
        cargo: "",
        rango: input.rango,
        codigoRadial: input.codigoRadial,
        primerNombre: input.primerNombre,
        segundoNombre: input.segundoNombre,
        primerApellido: input.primerApellido,
        segundoApellido: input.segundoApellido,
        nroDoc: input.nroDocId || "",
        fechaNacimiento: input.fechaNacimiento || "",
        correo: input.correo,
        contrasena: input.contrasena,
        nivelPermiso: input.nivelPermiso,
        descripcionPermiso: input.descripcionPermiso,
        situ: input.situ || "",
        cuota: normalizarMesAnio(input.cuota || ""),
        licenciaInicio: input.licenciaInicio || "",
        licenciaDias: input.licenciaDias || "",
        exencion: input.exencion || "",
        comisionadoDesde: input.comisionadoDesde || "",
      });
      return { exito: true as const, mensaje: "Bombero registrado correctamente" };
    }),

  obtenerPorCodigo: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await colUsuarios().get();
      const searchNum = extractNumber(input.codigo);
      for (const doc of snapshot.docs) {
        const fila = doc.data();
        const codigoFila = String(fila.codigo || "").trim();
        const numFila = extractNumber(codigoFila);
        if (numFila === searchNum) {
          return {
            exito: true as const,
            bombero: {
              identificador: doc.id,
              codigo: codigoFila,
              anioJuramento: String(fila.anioJuramento || ""),
              categoria: String(fila.categoria || ""),
              cargo: String(fila.cargo || ""),
              rango: String(fila.rango || ""),
              codigoRadial: String(fila.codigoRadial || ""),
              primerNombre: String(fila.primerNombre || ""),
              segundoNombre: String(fila.segundoNombre || ""),
              primerApellido: String(fila.primerApellido || ""),
              segundoApellido: String(fila.segundoApellido || ""),
              nroDocId: String(fila.nroDoc || ""),
              fechaNacimiento: String(fila.fechaNacimiento || ""),
              correo: String(fila.correo || ""),
              nivelPermiso: String(fila.nivelPermiso || "1"),
              descripcionPermiso: String(fila.descripcionPermiso || ""),
              situ: String(fila.situ || ""),
              cuota: normalizarMesAnio(String(fila.cuota || "")),
              licenciaInicio: normalizarFechaISO(String(fila.licenciaInicio || "")),
              licenciaDias: String(fila.licenciaDias || ""),
              exencion: String(fila.exencion || ""),
              comisionadoDesde: normalizarFechaISO(String(fila.comisionadoDesde || "")),
            },
          };
        }
      }
      return { exito: false as const, error: "Bombero no encontrado" };
    }),

  editar: publicQuery
    .input(
      z.object({
        codigoOriginal: z.string().min(1),
        codigo: z.string().min(1),
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
        situ: z.string().optional().or(z.literal('')),
        cuota: z.string().optional().or(z.literal('')),
        licenciaInicio: z.string().optional().or(z.literal('')),
        licenciaDias: z.string().optional().or(z.literal('')),
        exencion: z.string().optional().or(z.literal('')),
        comisionadoDesde: z.string().optional().or(z.literal('')),
      })
    )
    .mutation(async ({ input }) => {
      const snapshot = await colUsuarios().get();
      const searchNum = extractNumber(input.codigoOriginal);
      let docId: string | null = null;
      for (const doc of snapshot.docs) {
        const codigoFila = String(doc.data().codigo || "").trim();
        if (extractNumber(codigoFila) === searchNum) {
          docId = doc.id;
          break;
        }
      }
      if (!docId) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      await colUsuarios().doc(docId).update({
        codigo: input.codigo,
        anioJuramento: input.anioJuramento,
        categoria: input.categoria,
        rango: input.rango,
        codigoRadial: input.codigoRadial,
        primerNombre: input.primerNombre,
        segundoNombre: input.segundoNombre,
        primerApellido: input.primerApellido,
        segundoApellido: input.segundoApellido,
        nroDoc: input.nroDocId || "",
        fechaNacimiento: input.fechaNacimiento || "",
        situ: input.situ || "",
        cuota: normalizarMesAnio(input.cuota || ""),
        licenciaInicio: input.licenciaInicio || "",
        licenciaDias: input.licenciaDias || "",
        exencion: input.exencion || "",
        comisionadoDesde: input.comisionadoDesde || "",
      });
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
      // Buscar por correo+contrasena en vez de por codigo
      // Asi solo puedes modificar tu propia fila
      const snapshot = await colUsuarios().get();
      let docId: string | null = null;
      for (const doc of snapshot.docs) {
        const fila = doc.data();
        const storedEmail = String(fila.correo || "").trim();
        const storedPassword = String(fila.contrasena || "").trim();
        if (storedEmail === input.correoActual.trim() && storedPassword === input.contrasenaActual.trim()) {
          docId = doc.id;
          break;
        }
      }
      if (!docId) {
        return { exito: false as const, error: "Correo o contrasena actual incorrectos" };
      }
      await colUsuarios().doc(docId).update({
        correo: input.correoNuevo.trim(),
        contrasena: input.contrasenaNueva.trim(),
      });
      return { exito: true as const, mensaje: "Datos de acceso actualizados correctamente" };
    }),

  resumenCuadroServicio: publicQuery.query(async () => {
    const snapshot = await colUsuarios().get();
    let regimenNormal = 0;
    let regimenEspecial = 0;
    let b10a = 0;
    let b15a = 0;
    let b20a = 0;
    let comisionados = 0;
    let licencia = 0;
    let total = 0;

    snapshot.forEach((doc) => {
      const fila = doc.data();
      const codigo = fila.codigo ? String(fila.codigo).trim() : "";
      const primerNombre = fila.primerNombre ? String(fila.primerNombre).trim() : "";
      if (!codigo || !primerNombre) return;
      total++;

      const situ = String(fila.situ || "RN").trim().toUpperCase() || "RN";
      if (situ === "RN") regimenNormal++;
      else if (situ === "GE") regimenEspecial++;
      else if (situ === "B10A") b10a++;
      else if (situ === "B15A") b15a++;
      else if (situ === "B20A") b20a++;
      else if (situ === "CM") comisionados++;
      else if (situ === "LC") licencia++;
    });

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
        codigo: z.string().min(1),
        cargo: z.string().min(1),
        nivelPermiso: z.number().min(1).max(5),
      })
    )
    .mutation(async ({ input }) => {
      const snapshot = await colUsuarios().get();
      const searchNum = extractNumber(input.codigo);
      let docId: string | null = null;
      for (const doc of snapshot.docs) {
        const codigoFila = String(doc.data().codigo || "").trim();
        if (extractNumber(codigoFila) === searchNum) {
          docId = doc.id;
          break;
        }
      }
      if (!docId) {
        return { exito: false as const, error: "Bombero no encontrado" };
      }
      await colUsuarios().doc(docId).update({ cargo: input.cargo, nivelPermiso: input.nivelPermiso });
      return { exito: true as const };
    }),
});
