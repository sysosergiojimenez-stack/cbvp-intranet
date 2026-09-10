import { z } from "zod";
import { Firestore } from "@google-cloud/firestore";
import { formatearNombreCompleto } from "../lib/nombres";
import { normalizarFechaISO, normalizarMesAnio } from "../lib/fechas";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { obtenerTipoPorPlanillaAsistencia, obtenerAsistenciaPersonalComoFilas } from "../services/asistenciaFirestore";
import { obtenerUsuariosComoFilas } from "../services/usuariosFirestore";
import { extractGuardiaData } from "../services/gemini";
import { uploadFile } from "../services/storage";
import { env } from "../lib/env";

function esExentoAutomatico(
  persona: { situ: string; exencion?: string; comisionadoDesde?: string },
  fechaDia: Date,
  tipo: 'GUARDIAS' | 'PRACTICAS'
): boolean {
  if (persona.situ !== 'CM') return false;
  if (!persona.exencion || !persona.comisionadoDesde) return false;
  const exencion = persona.exencion.toUpperCase();
  const cubreTipo =
    exencion === 'AMBOS' ||
    (tipo === 'GUARDIAS' && exencion === 'GUARDIAS') ||
    (tipo === 'PRACTICAS' && exencion === 'PRACTICAS');
  if (!cubreTipo) return false;
  const desdeISO = normalizarFechaISO(persona.comisionadoDesde);
  if (!desdeISO) return false;
  const [y, m, d] = desdeISO.split('-').map(Number);
  const desde = new Date(y, m - 1, d);
  desde.setHours(0, 0, 0, 0);
  const dia = new Date(fechaDia);
  dia.setHours(0, 0, 0, 0);
  return dia >= desde;
}

const db = () => getFirestoreClient();
const colEncabezado = () => db().collection("guardiasEncabezado");
const colPersonal = () => db().collection("guardiasPersonal");

// Trae todo Guardias_Personal reacomodado como filas posicionales (mismo
// orden de columnas que tenia la pestana Sheets original), para poder
// reusar sin cambios el calculo de asistencia/porcentajes de
// asistenciaMensualDetallada y totalAcumulado (logica de negocio sensible,
// se prefiere no tocarla al migrar el origen de datos).
async function obtenerGuardiasPersonalComoFilas(): Promise<unknown[][]> {
  const snapshot = await colPersonal().get();
  const filas: unknown[][] = [[]]; // fila 0 = placeholder de encabezado (los loops arrancan en i=1)
  snapshot.forEach((doc) => {
    const f = doc.data();
    filas.push([
      doc.id,             // 0 idFila
      f.idPlanilla,       // 1
      f.fechaCarga,       // 2
      f.fechaGuardia,     // 3
      f.grupo,            // 4
      f.tipo,             // 5
      f.codigo,           // 6
      f.nombre,           // 7
      f.asignacion,       // 8
      f.asistencia,       // 9
      f.idCargador,       // 10
      f.nombreCargador,   // 11
      f.exencion,         // 12
    ]);
  });
  return filas;
}

export const planillasRouter = createRouter({
  historial: publicQuery
    .input(z.object({ codigo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const encSnapshot = await colEncabezado().get();
      const planillas: Array<{
        idPlanilla: string; fechaCarga: string; fechaGuardia: string; grupo: string;
        inicioGuardia: string; finalizaGuardia: string; directorSem: string;
        comandanteSemana: string; oficialK20: string; novedades: string; urlImagen: string;
      }> = [];

      encSnapshot.forEach((doc) => {
        const fila = doc.data();
        planillas.push({
          idPlanilla: doc.id,
          fechaCarga: String(fila.fechaCarga || ""),
          fechaGuardia: String(fila.fechaGuardia || ""),
          grupo: String(fila.grupo || ""),
          inicioGuardia: String(fila.inicioGuardia || ""),
          finalizaGuardia: String(fila.finalizaGuardia || ""),
          directorSem: String(fila.directorSem || ""),
          comandanteSemana: String(fila.comandanteSemana || ""),
          oficialK20: String(fila.oficialK20 || ""),
          novedades: String(fila.novedades || ""),
          urlImagen: String(fila.urlImagen || ""),
        });
      });

      const parseFecha = (f: string) => {
        try {
          const parts = f.split(" ");
          const [d, m, y] = parts[0].split("/");
          return new Date(`${y}-${m}-${d}T${parts[1] || "00:00"}`).getTime();
        } catch {
          return 0;
        }
      };

      // If codigo provided (Voluntario), filter planillas where bombero appears
      const searchCode = input?.codigo;
      if (searchCode) {
        const persSnapshot = await colPersonal().get();
        const numericSearch = (searchCode.match(/\d+/) || [searchCode])[0];
        const planillaIds = new Set<string>();
        persSnapshot.forEach((doc) => {
          const fila = doc.data();
          const codigoRaw = String(fila.codigo || "").trim();
          const codigoMatch = codigoRaw.match(/\d+/);
          const codigo = codigoMatch ? codigoMatch[0] : codigoRaw;
          if (codigo === numericSearch) {
            planillaIds.add(String(fila.idPlanilla || "").trim());
          }
        });
        const filtered = planillas.filter(p => planillaIds.has(p.idPlanilla));
        filtered.sort((a, b) => parseFecha(b.fechaGuardia) - parseFecha(a.fechaGuardia));
        return { exito: true as const, planillas: filtered };
      }

      planillas.sort((a, b) => parseFecha(b.fechaGuardia) - parseFecha(a.fechaGuardia));

      return { exito: true as const, planillas };
    }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await colPersonal().where("idPlanilla", "==", input.idPlanilla).get();
      const personal = snapshot.docs.map((doc) => {
        const fila = doc.data();
        return {
          idFila: doc.id,
          idPlanilla: String(fila.idPlanilla || ""),
          fechaCarga: String(fila.fechaCarga || ""),
          fechaGuardia: String(fila.fechaGuardia || ""),
          grupo: String(fila.grupo || ""),
          tipo: String(fila.tipo || ""),
          codigo: String(fila.codigo || ""),
          nombre: String(fila.nombre || ""),
          asignacion: String(fila.asignacion || ""),
          asistencia: String(fila.asistencia || ""),
          exencion: String(fila.exencion || ""),
          idCargador: String(fila.idCargador || ""),
          nombreCargador: String(fila.nombreCargador || ""),
        };
      });

      return { exito: true as const, personal };
    }),

  extraer: publicQuery
    .input(
      z.object({
        base64Data: z.string(),
        fileName: z.string(),
        fileType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const parts = input.base64Data.split(",");
        const base64Content = parts.length > 1 ? parts[1] : parts[0];

        let urlImagen = "";
        if (env.GCS_BUCKET_NAME) {
          urlImagen = await uploadFile(
            env.GCS_BUCKET_NAME,
            input.fileName,
            input.fileType,
            base64Content
          );
        }

        const datosExtraidos = await extractGuardiaData(base64Content, input.fileType);

        return {
          exito: true as const,
          urlImagen,
          datos: datosExtraidos,
        };
      } catch (error) {
        return {
          exito: false as const,
          mensaje: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  guardar: publicQuery
    .input(
      z.object({
        urlImagen: z.string(),
        datos: z.object({
          fechaGuardia: z.string().optional(),
          grupo: z.string().optional(),
          inicioGuardia: z.string().optional(),
          finalizaGuardia: z.string().optional(),
          directorSem: z.string().optional(),
          comandanteSemana: z.string().optional(),
          oficialK20: z.string().optional(),
          novedades: z.string().optional(),
          personal: z
            .array(
              z.object({
                codigo: z.string().optional(),
                nombre: z.string().optional(),
                asignacion: z.string().optional(),
                asistencia: z.string().optional(),
                exencion: z.string().optional(),
              })
            )
            .optional(),
          guardiasEspeciales: z
            .array(
              z.object({
                codigo: z.string().optional(),
                nombre: z.string().optional(),
                asignacion: z.string().optional(),
              })
            )
            .optional(),
          refuerzos: z
            .array(
              z.object({
                codigo: z.string().optional(),
                nombre: z.string().optional(),
                asignacion: z.string().optional(),
              })
            )
            .optional(),
        }),
        user: z.object({
          identificador: z.string(),
          nombreCompleto: z.string(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const datosExtraidos = input.datos;
        const urlImagen = input.urlImagen;

        const now = new Date();
        const idPlanilla =
          "GRD-" +
          now.toISOString().slice(0, 10).replace(/-/g, "") +
          "-" +
          String(now.getHours()).padStart(2, "0") +
          String(now.getMinutes()).padStart(2, "0") +
          String(now.getSeconds()).padStart(2, "0");

        const fechaCargaStr = now
          .toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
          .replace(/\//g, "/");

        const batch = db().batch();
        batch.set(colEncabezado().doc(idPlanilla), {
          fechaCarga: fechaCargaStr,
          fechaGuardia: String(datosExtraidos.fechaGuardia || ""),
          grupo: String(datosExtraidos.grupo || ""),
          inicioGuardia: String(datosExtraidos.inicioGuardia || ""),
          finalizaGuardia: String(datosExtraidos.finalizaGuardia || ""),
          directorSem: String(datosExtraidos.directorSem || ""),
          comandanteSemana: String(datosExtraidos.comandanteSemana || ""),
          oficialK20: String(datosExtraidos.oficialK20 || ""),
          novedades: String(datosExtraidos.novedades || ""),
          urlImagen,
          creadoEn: Firestore.FieldValue.serverTimestamp(),
        });

        let filaIdx = 1;
        const personal = datosExtraidos.personal || [];
        for (const p of personal) {
          batch.set(colPersonal().doc(`${idPlanilla}-${filaIdx}`), {
            idPlanilla,
            fechaCarga: fechaCargaStr,
            fechaGuardia: String(datosExtraidos.fechaGuardia || ""),
            grupo: String(datosExtraidos.grupo || ""),
            tipo: "GUARDIA NORMAL",
            codigo: String(p.codigo || ""),
            nombre: String(p.nombre || ""),
            asignacion: String(p.asignacion || ""),
            asistencia: String(p.asistencia || ""),
            idCargador: input.user.identificador,
            nombreCargador: input.user.nombreCompleto,
            exencion: p.exencion || "",
          });
          filaIdx++;
        }
        const guardiasEspeciales = datosExtraidos.guardiasEspeciales || [];
        for (const e of guardiasEspeciales) {
          if (e.codigo || e.nombre) {
            batch.set(colPersonal().doc(`${idPlanilla}-${filaIdx}`), {
              idPlanilla,
              fechaCarga: fechaCargaStr,
              fechaGuardia: String(datosExtraidos.fechaGuardia || ""),
              grupo: String(datosExtraidos.grupo || ""),
              tipo: "GUARDIA ESPECIAL",
              codigo: String(e.codigo || ""),
              nombre: String(e.nombre || ""),
              asignacion: String(e.asignacion || ""),
              asistencia: "",
              idCargador: input.user.identificador,
              nombreCargador: input.user.nombreCompleto,
            });
            filaIdx++;
          }
        }
        const refuerzos = datosExtraidos.refuerzos || [];
        for (const r of refuerzos) {
          if (r.codigo || r.nombre) {
            batch.set(colPersonal().doc(`${idPlanilla}-${filaIdx}`), {
              idPlanilla,
              fechaCarga: fechaCargaStr,
              fechaGuardia: String(datosExtraidos.fechaGuardia || ""),
              grupo: String(datosExtraidos.grupo || ""),
              tipo: "REFUERZO",
              codigo: String(r.codigo || ""),
              nombre: String(r.nombre || ""),
              asignacion: String(r.asignacion || ""),
              asistencia: "",
              idCargador: input.user.identificador,
              nombreCargador: input.user.nombreCompleto,
            });
            filaIdx++;
          }
        }

        await batch.commit();

        return {
          exito: true as const,
          mensaje: "Planilla guardada correctamente",
          idPlanilla,
        };
      } catch (error) {
        return {
          exito: false as const,
          mensaje: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  actualizarEncabezado: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        datos: z.object({
          fechaGuardia: z.string().optional(),
          grupo: z.string().optional(),
          inicioGuardia: z.string().optional(),
          finalizaGuardia: z.string().optional(),
          directorSem: z.string().optional(),
          comandanteSemana: z.string().optional(),
          oficialK20: z.string().optional(),
          novedades: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const doc = await colEncabezado().doc(input.idPlanilla).get();
        if (!doc.exists) {
          return { exito: false as const, mensaje: "Planilla no encontrada" };
        }

        const d = input.datos;
        await colEncabezado().doc(input.idPlanilla).update({
          fechaGuardia: d.fechaGuardia || "",
          grupo: d.grupo || "",
          inicioGuardia: d.inicioGuardia || "",
          finalizaGuardia: d.finalizaGuardia || "",
          directorSem: d.directorSem || "",
          comandanteSemana: d.comandanteSemana || "",
          oficialK20: d.oficialK20 || "",
          novedades: d.novedades || "",
        });

        return { exito: true as const, mensaje: "Encabezado actualizado" };
      } catch (error) {
        return {
          exito: false as const,
          mensaje: error instanceof Error ? error.message : String(error),
        };
      }
    }),

  actualizarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        personal: z.array(
          z.object({
            idFila: z.string(),
            asignacion: z.string().optional(),
            asistencia: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const batch = db().batch();
      for (const p of input.personal) {
        batch.set(
          colPersonal().doc(p.idFila.trim()),
          { asignacion: p.asignacion || "", asistencia: p.asistencia || "" },
          { merge: true }
        );
      }
      await batch.commit();

      return { exito: true as const, mensaje: "Personal actualizado" };
    }),

  editarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        codigo: z.string(),
        nuevaAsistencia: z.enum(["PRESENTE", "AUSENTE", "AUSENTE CON REEMPLAZO"]),
      })
    )
    .mutation(async ({ input }) => {
      const snapshot = await colPersonal().where("idPlanilla", "==", input.idPlanilla.trim()).get();
      for (const doc of snapshot.docs) {
        const rowCodigo = String(doc.data().codigo || "").trim();
        if (rowCodigo === input.codigo.trim()) {
          await colPersonal().doc(doc.id).update({ asistencia: input.nuevaAsistencia });
          return { exito: true as const, mensaje: "Asistencia actualizada" };
        }
      }
      return { exito: false as const, error: "Bombero no encontrado en la planilla" };
    }),

  editar: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        fechaGuardia: z.string().optional(),
        grupo: z.string().optional(),
        inicioGuardia: z.string().optional(),
        finalizaGuardia: z.string().optional(),
        directorSem: z.string().optional(),
        comandanteSemana: z.string().optional(),
        oficialK20: z.string().optional(),
        novedades: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const idPlanilla = input.idPlanilla.trim();
      const doc = await colEncabezado().doc(idPlanilla).get();
      if (!doc.exists) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      const campos: Record<string, string> = {};
      if (input.fechaGuardia !== undefined) campos.fechaGuardia = input.fechaGuardia;
      if (input.grupo !== undefined) campos.grupo = input.grupo;
      if (input.inicioGuardia !== undefined) campos.inicioGuardia = input.inicioGuardia;
      if (input.finalizaGuardia !== undefined) campos.finalizaGuardia = input.finalizaGuardia;
      if (input.directorSem !== undefined) campos.directorSem = input.directorSem;
      if (input.comandanteSemana !== undefined) campos.comandanteSemana = input.comandanteSemana;
      if (input.oficialK20 !== undefined) campos.oficialK20 = input.oficialK20;
      if (input.novedades !== undefined) campos.novedades = input.novedades;

      await colEncabezado().doc(idPlanilla).update(campos);

      return { exito: true as const, mensaje: "Planilla actualizada correctamente" };
    }),

  eliminar: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .mutation(async ({ input }) => {
      const idPlanilla = input.idPlanilla.trim();

      await colEncabezado().doc(idPlanilla).delete();

      const persSnapshot = await colPersonal().where("idPlanilla", "==", idPlanilla).get();
      if (!persSnapshot.empty) {
        const batch = db().batch();
        persSnapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      return { exito: true as const, mensaje: "Planilla eliminada" };
    }),

  misMetricas: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await colPersonal().get();
      const searchCodeMatch = input.codigo.match(/\d+/);
      const searchCode = searchCodeMatch ? searchCodeMatch[0] : input.codigo.trim();

      const guardias: Array<{
        idPlanilla: string; fechaGuardia: string; grupo: string;
        tipo: string; asignacion: string; asistencia: string; fechaCarga: string;
      }> = [];

      snapshot.forEach((doc) => {
        const fila = doc.data();
        const codigoRaw = String(fila.codigo || "").trim();
        const codigoMatch = codigoRaw.match(/\d+/);
        const codigo = codigoMatch ? codigoMatch[0] : codigoRaw;
        if (codigo !== searchCode) return;
        guardias.push({
          idPlanilla: String(fila.idPlanilla || ""),
          fechaCarga: String(fila.fechaCarga || ""),
          fechaGuardia: String(fila.fechaGuardia || ""),
          grupo: String(fila.grupo || ""),
          tipo: String(fila.tipo || "").trim().toUpperCase(),
          asignacion: String(fila.asignacion || ""),
          asistencia: String(fila.asistencia || "").trim().toUpperCase(),
        });
      });

      const parseFechaGuardia = (f: string) => {
        try {
          const [d, m, y] = f.split(" ")[0].split("/");
          return new Date(`${y}-${m}-${d}`).getTime();
        } catch {
          return 0;
        }
      };
      guardias.sort((a, b) => parseFechaGuardia(b.fechaGuardia) - parseFechaGuardia(a.fechaGuardia));

      const stats = {
        totalGuardias: guardias.length,
        guardiasNormales: guardias.filter(g => g.tipo === "GUARDIA NORMAL").length,
        guardiasEspeciales: guardias.filter(g => g.tipo === "GUARDIA ESPECIAL").length,
        refuerzos: guardias.filter(g => g.tipo === "REFUERZO").length,
        presentes: guardias.filter(g => g.asistencia === "PRESENTE").length,
        ausentes: guardias.filter(g => g.asistencia === "AUSENTE").length,
        ausentesConReemplazo: guardias.filter(g => g.asistencia === "AUSENTE CON REEMPLAZO").length,
      };

      return { exito: true as const, guardias, stats };
    }),

  asistenciaMensualDetallada: publicQuery
    .input(z.object({ mes: z.number().min(1).max(12), anio: z.number(), categoria: z.string() }))
    .query(async ({ input }) => {
      const usuariosData = await obtenerUsuariosComoFilas();
      const personasBase: Array<{ codigo: string; numero: string; nombre: string; situ: string; exencion: string; comisionadoDesde: string }> = [];
      for (let i = 1; i < usuariosData.length; i++) {
        const fila = usuariosData[i];
        const codigo = fila[1] ? String(fila[1]).trim() : "";
        const primerNombre = fila[7] ? String(fila[7]).trim() : "";
        const categoria = String(fila[3] || "").trim().toUpperCase();
        if (!codigo || !primerNombre) continue;
        if (categoria !== input.categoria.toUpperCase()) continue;
        const primerApellido = fila[9] ? String(fila[9]).trim() : "";
        const rango = fila[5] ? String(fila[5]).trim() : "";
        const nombre = formatearNombreCompleto(rango, categoria, primerNombre, primerApellido);
        const situ = String(fila[17] || "RN").trim() || "RN";
        const numero = (codigo.match(/\d+/) || [""])[0];
        personasBase.push({
          codigo,
          numero,
          nombre,
          situ,
          exencion: String(fila[21] || ""),
          comisionadoDesde: String(fila[22] || ""),
        });
      }
      personasBase.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

      const guardiasData = await obtenerGuardiasPersonalComoFilas();
      const diasDelMes = new Date(input.anio, input.mes, 0).getDate();

      // Datos de practicas para la planilla de asistencia de activos
      const tipoPorPlanilla = await obtenerTipoPorPlanillaAsistencia();
      const persData = await obtenerAsistenciaPersonalComoFilas();

      function calcular(p: { codigo: string; numero: string; nombre: string; situ: string; exencion: string; comisionadoDesde: string }, tipoRequerido: string) {
        if (p.situ === "LM") {
          const dias = new Array(diasDelMes).fill("E");
          return { codigo: p.codigo, nombre: p.nombre, situ: p.situ, dias, totalGuardias: diasDelMes, presentes: diasDelMes, porcentaje: 100 };
        }
        const dias: string[] = new Array(diasDelMes).fill("");
        let totalGuardias = 0;
        let presentes = 0;
        for (let i = 1; i < guardiasData.length; i++) {
          const fila = guardiasData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const tipoFila = String(fila[5] || "").trim().toUpperCase();
          if (tipoFila !== tipoRequerido) continue;
          const fechaGuardia = String(fila[3] || "").trim();
          const partes = fechaGuardia.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[9] || "").trim().toUpperCase();
          totalGuardias++;
          if (asistencia === "PRESENTE" || asistencia === "AUSENTE CON REEMPLAZO") {
            presentes++;
            dias[dia - 1] = "P";
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) {
              presentes++;
              dias[dia - 1] = "E";
            } else {
              dias[dia - 1] = "A";
            }
          }
        }
        // Aplicar exenciones automaticas del personal para dias sin guardia cargada
        for (let dia = 1; dia <= diasDelMes; dia++) {
          if (dias[dia - 1]) continue;
          const fechaDia = new Date(input.anio, input.mes - 1, dia);
          if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) {
            dias[dia - 1] = "E";
            presentes++;
            totalGuardias++;
          }
        }
        const realPercent = totalGuardias > 0 ? (presentes / totalGuardias) * 100 : 0;
        let porcentaje = realPercent;
        if (p.situ === "B10A") {
          porcentaje = Math.min(100, (realPercent / 50) * 100);
        } else if (p.situ === "B15A") {
          porcentaje = Math.min(100, (realPercent / 25) * 100);
        } else if (p.situ === "B20A") {
          porcentaje = presentes >= 1 ? 100 : 0;
        }
        return {
          codigo: p.codigo,
          nombre: p.nombre,
          situ: p.situ,
          dias,
          totalGuardias,
          presentes,
          porcentaje: Math.round(porcentaje),
        };
      }

      function calcularActivo(p: { codigo: string; numero: string; nombre: string; situ: string; exencion: string; comisionadoDesde: string }) {
        if (p.situ === "LM") {
          const dias = new Array(diasDelMes).fill("E");
          return { codigo: p.codigo, nombre: p.nombre, situ: p.situ, dias, totalGuardias: diasDelMes, presentes: diasDelMes, porcentaje: 100 };
        }

        // 0=vacio, 1=A, 2=E, 3=P
        const scores: number[] = new Array(diasDelMes).fill(0);
        let total = 0;
        let presentes = 0;

        // Guardias normales
        for (let i = 1; i < guardiasData.length; i++) {
          const fila = guardiasData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const tipoFila = String(fila[5] || "").trim().toUpperCase();
          if (tipoFila !== "GUARDIA NORMAL") continue;
          const fechaGuardia = String(fila[3] || "").trim();
          const partes = fechaGuardia.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[9] || "").trim().toUpperCase();
          let score = 1;
          if (asistencia === "PRESENTE" || asistencia === "AUSENTE CON REEMPLAZO") {
            score = 3;
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) score = 2;
          }
          if (score > scores[dia - 1]) scores[dia - 1] = score;
        }

        // Practicas
        for (let i = 1; i < persData.length; i++) {
          const fila = persData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const idPlanilla = String(fila[1] || "").trim();
          const tipo = tipoPorPlanilla.get(idPlanilla) || "";
          if (!tipo.includes("PRACTICA")) continue;
          const fechaActividad = String(fila[3] || "").trim();
          const partes = fechaActividad.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[8] || "").trim().toUpperCase();
          let score = 1;
          if (asistencia === "PRESENTE") {
            score = 3;
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) score = 2;
          }
          if (score > scores[dia - 1]) scores[dia - 1] = score;
        }

        // Exenciones automaticas para dias sin actividad cargada
        for (let dia = 1; dia <= diasDelMes; dia++) {
          if (scores[dia - 1]) continue;
          const fechaDia = new Date(input.anio, input.mes - 1, dia);
          if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) {
            scores[dia - 1] = 2;
          }
        }

        const dias = scores.map((s) => {
          if (s === 3) return "P";
          if (s === 2) return "E";
          if (s === 1) return "A";
          return "";
        });

        for (const s of scores) {
          if (s === 0) continue;
          total++;
          if (s === 3 || s === 2) presentes++;
        }

        const realPercent = total > 0 ? (presentes / total) * 100 : 0;
        let porcentaje = realPercent;
        if (p.situ === "B10A") {
          porcentaje = Math.min(100, (realPercent / 50) * 100);
        } else if (p.situ === "B15A") {
          porcentaje = Math.min(100, (realPercent / 25) * 100);
        } else if (p.situ === "B20A") {
          porcentaje = presentes >= 1 ? 100 : 0;
        }

        return {
          codigo: p.codigo,
          nombre: p.nombre,
          situ: p.situ,
          dias,
          totalGuardias: total,
          presentes,
          porcentaje: Math.round(porcentaje),
        };
      }

      if (input.categoria.toUpperCase() === "ACTIVO") {
        const asistencia = personasBase.map((p) => calcularActivo(p));
        return { exito: true as const, diasDelMes, normales: asistencia, especiales: [] as ReturnType<typeof calcular>[] };
      }

      const personasGE = personasBase.filter((p) => p.situ === "GE");
      const personasNormales = personasBase.filter((p) => p.situ !== "GE");

      const normales = personasNormales.map((p) => calcular(p, "GUARDIA NORMAL"));
      const especiales = personasGE.map((p) => calcular(p, "GUARDIA ESPECIAL"));

      return { exito: true as const, diasDelMes, normales, especiales };
    }),

  totalAcumulado: publicQuery
    .input(z.object({ mes: z.number().min(1).max(12), anio: z.number(), categoria: z.string() }))
    .query(async ({ input }) => {
      const esActivo = input.categoria.toUpperCase() === "ACTIVO";

      const usuariosData = await obtenerUsuariosComoFilas();
      const personasBase: Array<{ codigo: string; numero: string; nombre: string; categoria: string; situ: string; cuota: string; exencion: string; comisionadoDesde: string }> = [];
      for (let i = 1; i < usuariosData.length; i++) {
        const fila = usuariosData[i];
        const codigo = fila[1] ? String(fila[1]).trim() : "";
        const primerNombre = fila[7] ? String(fila[7]).trim() : "";
        const categoria = String(fila[3] || "").trim().toUpperCase();
        if (!codigo || !primerNombre) continue;
        if (categoria !== input.categoria.toUpperCase()) continue;
        const primerApellido = fila[9] ? String(fila[9]).trim() : "";
        const rango = fila[5] ? String(fila[5]).trim() : "";
        const nombre = formatearNombreCompleto(rango, categoria, primerNombre, primerApellido);
        const situ = String(fila[17] || "RN").trim() || "RN";
        const cuota = normalizarMesAnio(String(fila[18] || "").trim());
        const numero = (codigo.match(/\d+/) || [""])[0];
        personasBase.push({
          codigo,
          numero,
          nombre,
          categoria,
          situ,
          cuota,
          exencion: String(fila[21] || ""),
          comisionadoDesde: String(fila[22] || ""),
        });
      }
      personasBase.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

      const diasDelMes = new Date(input.anio, input.mes, 0).getDate();

      // --- Guardias ---
      const guardiasData = await obtenerGuardiasPersonalComoFilas();
      function porcentajeConSitu(realPercent: number, presentes: number, situ: string): number {
        if (situ === "B10A") return Math.min(100, Math.round((realPercent / 50) * 100));
        if (situ === "B15A") return Math.min(100, Math.round((realPercent / 25) * 100));
        if (situ === "B20A") return presentes >= 1 ? 100 : 0;
        return Math.round(realPercent);
      }
      function enCuadroDeServicio(p: { categoria: string; cuota: string; acumulado: number | string }, mes: number, anio: number): boolean {
        const categoriasPermitidas = ["BOMBERO", "COMBATIENTE", "ACTIVO", "FUNDADOR"];
        if (!categoriasPermitidas.includes(p.categoria)) return false;
        const acumuladoNum = typeof p.acumulado === "string" ? 0 : p.acumulado;
        if (acumuladoNum < 50) return false;
        if (!p.cuota) return false;
        let mesMinimo = mes - 2;
        let anioMinimo = anio;
        if (mesMinimo <= 0) {
          anioMinimo--;
          mesMinimo += 12;
        }
        const cuotaMinima = `${anioMinimo}-${String(mesMinimo).padStart(2, "0")}`;
        return p.cuota >= cuotaMinima;
      }
      function calcularGuardias(p: { numero: string; situ: string; exencion: string; comisionadoDesde: string }, tipoRequerido: string) {
        let total = 0;
        let presentes = 0;
        const diasConGuardia = new Set<number>();
        for (let i = 1; i < guardiasData.length; i++) {
          const fila = guardiasData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const tipoFila = String(fila[5] || "").trim().toUpperCase();
          if (tipoFila !== tipoRequerido) continue;
          const fechaGuardia = String(fila[3] || "").trim();
          const partes = fechaGuardia.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[9] || "").trim().toUpperCase();
          diasConGuardia.add(dia);
          total++;
          if (asistencia === "PRESENTE" || asistencia === "AUSENTE CON REEMPLAZO") {
            presentes++;
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) presentes++;
          }
        }
        // Aplicar exenciones automaticas del personal para dias sin guardia cargada
        for (let dia = 1; dia <= diasDelMes; dia++) {
          if (diasConGuardia.has(dia)) continue;
          const fechaDia = new Date(input.anio, input.mes - 1, dia);
          if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) {
            presentes++;
            total++;
          }
        }
        const realPercent = total > 0 ? (presentes / total) * 100 : 0;
        return porcentajeConSitu(realPercent, presentes, p.situ);
      }

      // --- Practicas / Citaciones ---
      const tipoPorPlanilla = await obtenerTipoPorPlanillaAsistencia();
      const persData = await obtenerAsistenciaPersonalComoFilas();

      const sabados: number[] = [];
      for (let d = 1; d <= diasDelMes; d++) {
        const fecha = new Date(input.anio, input.mes - 1, d);
        if (fecha.getDay() === 6) sabados.push(d);
      }

      const fechasCitacionSet = new Set<number>();
      for (let i = 1; i < persData.length; i++) {
        const fila = persData[i];
        const idPlanilla = String(fila[1] || "").trim();
        const tipo = tipoPorPlanilla.get(idPlanilla) || "";
        if (!tipo.includes("CITACION")) continue;
        const fechaActividad = String(fila[3] || "").trim();
        const partes = fechaActividad.split("/");
        if (partes.length !== 3) continue;
        const dia = parseInt(partes[0], 10);
        const mesFila = parseInt(partes[1], 10);
        const anioFila = parseInt(partes[2], 10);
        if (mesFila !== input.mes || anioFila !== input.anio) continue;
        if (dia >= 1 && dia <= diasDelMes) fechasCitacionSet.add(dia);
      }
      const huboCitaciones = fechasCitacionSet.size > 0;

      function calcularPersAsistencia(p: { numero: string; situ: string; exencion: string; comisionadoDesde: string }, tipoBuscado: string, fechasPermitidas: Set<number> | null) {
        let total = 0;
        let presentes = 0;
        const diasConActividadBombero = new Set<number>();
        for (let i = 1; i < persData.length; i++) {
          const fila = persData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const idPlanilla = String(fila[1] || "").trim();
          const tipo = tipoPorPlanilla.get(idPlanilla) || "";
          if (!tipo.includes(tipoBuscado)) continue;
          const fechaActividad = String(fila[3] || "").trim();
          const partes = fechaActividad.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          if (fechasPermitidas && !fechasPermitidas.has(dia)) continue;
          const asistencia = String(fila[8] || "").trim().toUpperCase();
          diasConActividadBombero.add(dia);
          total++;
          if (asistencia === "PRESENTE") {
            presentes++;
          } else if (tipoBuscado === "PRACTICA") {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) presentes++;
          }
        }
        // Completar practicas: ausente si no figura y no es exento; exento si aplica.
        // Fechas futuras se ignoran para no afectar el porcentaje antes de que pasen.
        if (tipoBuscado === "PRACTICA" && fechasPermitidas) {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          for (const dia of fechasPermitidas) {
            if (diasConActividadBombero.has(dia)) continue;
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            fechaDia.setHours(0, 0, 0, 0);
            if (fechaDia > hoy) continue;
            total++;
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) {
              presentes++;
            }
          }
        }
        const realPercent = total > 0 ? (presentes / total) * 100 : 0;
        return porcentajeConSitu(realPercent, presentes, p.situ);
      }

      const sabadosSet = new Set(sabados);

      function calcularAsistenciaActivo(p: { numero: string; situ: string; exencion: string; comisionadoDesde: string }) {
        // Mismo computo que calcularActivo en asistenciaMensualDetallada:
        // un score por dia del mes, tomando el mejor resultado entre guardia y practica.
        // 0=vacio, 1=A, 2=E, 3=P
        const scores: number[] = new Array(diasDelMes).fill(0);

        // Guardias normales
        for (let i = 1; i < guardiasData.length; i++) {
          const fila = guardiasData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const tipoFila = String(fila[5] || "").trim().toUpperCase();
          if (tipoFila !== "GUARDIA NORMAL") continue;
          const fechaGuardia = String(fila[3] || "").trim();
          const partes = fechaGuardia.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[9] || "").trim().toUpperCase();
          let score = 1;
          if (asistencia === "PRESENTE" || asistencia === "AUSENTE CON REEMPLAZO") {
            score = 3;
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) score = 2;
          }
          if (score > scores[dia - 1]) scores[dia - 1] = score;
        }

        // Practicas
        for (let i = 1; i < persData.length; i++) {
          const fila = persData[i];
          const codigoFila = String(fila[6] || "").trim();
          const numeroFila = (codigoFila.match(/\d+/) || [""])[0];
          if (!numeroFila || numeroFila !== p.numero) continue;
          const idPlanilla = String(fila[1] || "").trim();
          const tipo = tipoPorPlanilla.get(idPlanilla) || "";
          if (!tipo.includes("PRACTICA")) continue;
          const fechaActividad = String(fila[3] || "").trim();
          const partes = fechaActividad.split("/");
          if (partes.length !== 3) continue;
          const dia = parseInt(partes[0], 10);
          const mesFila = parseInt(partes[1], 10);
          const anioFila = parseInt(partes[2], 10);
          if (mesFila !== input.mes || anioFila !== input.anio) continue;
          if (!dia || dia < 1 || dia > diasDelMes) continue;
          const asistencia = String(fila[8] || "").trim().toUpperCase();
          let score = 1;
          if (asistencia === "PRESENTE") {
            score = 3;
          } else {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) score = 2;
          }
          if (score > scores[dia - 1]) scores[dia - 1] = score;
        }

        // Exenciones automaticas para dias sin actividad cargada
        for (let dia = 1; dia <= diasDelMes; dia++) {
          if (scores[dia - 1]) continue;
          const fechaDia = new Date(input.anio, input.mes - 1, dia);
          if (esExentoAutomatico(p, fechaDia, 'GUARDIAS')) {
            scores[dia - 1] = 2;
          }
        }

        let total = 0;
        let presentes = 0;
        for (const s of scores) {
          if (s === 0) continue;
          total++;
          if (s === 3 || s === 2) presentes++;
        }

        const realPercent = total > 0 ? (presentes / total) * 100 : 0;
        return porcentajeConSitu(realPercent, presentes, p.situ);
      }

      const filas = personasBase.map((p) => {
        const esGE = p.situ === "GE";
        let guardiasPercent = esActivo
          ? calcularAsistenciaActivo(p)
          : calcularGuardias(p, esGE ? "GUARDIA ESPECIAL" : "GUARDIA NORMAL");

        let practicasPercent = esActivo ? null : calcularPersAsistencia(p, "PRACTICA", sabadosSet);
        let citacionesPercent = huboCitaciones ? calcularPersAsistencia(p, "CITACION", fechasCitacionSet) : null;

        let acumulado: number | string;
        if (p.situ === "SC") {
          acumulado = "SANCIONADO";
        } else if (p.situ === "LM") {
          guardiasPercent = 100;
          practicasPercent = esActivo ? null : 100;
          citacionesPercent = huboCitaciones ? 100 : null;
          acumulado = 100;
        } else if (p.situ === "LC") {
          acumulado = 0;
        } else {
          const valores: number[] = [guardiasPercent];
          if (practicasPercent !== null) valores.push(practicasPercent);
          if (citacionesPercent !== null) valores.push(citacionesPercent);
          const suma = valores.reduce((acc, v) => acc + v, 0);
          acumulado = Math.round(suma / valores.length);
        }

        const enCuadro = enCuadroDeServicio({ categoria: p.categoria, cuota: p.cuota, acumulado }, input.mes, input.anio);

        return {
          codigo: p.codigo,
          nombre: p.nombre,
          situ: p.situ,
          cuota: p.cuota,
          guardiasPercent,
          practicasPercent,
          citacionesPercent,
          acumulado,
          enCuadro,
        };
      });

      return { exito: true as const, filas, huboCitaciones };
    }),
});
