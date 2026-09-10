import { z } from "zod";
import { formatearNombreCompleto } from "../lib/nombres";
import { normalizarFechaISO } from "../lib/fechas";
import { createRouter, publicQuery } from "../middleware";
import { colAsistenciaEncabezado, colAsistenciaPersonal, obtenerTipoPorPlanillaAsistencia, obtenerAsistenciaPersonalComoFilas } from "../services/asistenciaFirestore";
import { obtenerUsuariosComoFilas } from "../services/usuariosFirestore";
import { getFirestoreClient } from "../services/firestore";
import { env } from "../lib/env";
import { extractAsistenciaData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

function toTitleCase(str: string): string {
  return str.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function parseDate(value: string): number {
  if (!value) return 0;
  const partes = value.split("/");
  if (partes.length === 3) {
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10);
    const anio = parseInt(partes[2], 10);
    if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
      return new Date(anio, mes - 1, dia).getTime();
    }
  }
  const ts = Date.parse(value);
  return isNaN(ts) ? 0 : ts;
}

interface PersonalAsistencia {
  codigo: string;
  nombre: string;
  asistencia: string;
}

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

export const asistenciaRouter = createRouter({
  extraer: publicQuery
    .input(
      z.object({
        images: z
          .array(
            z.object({
              base64: z.string().min(1),
              mimeType: z.string().min(1),
            })
          )
          .min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extractedData = await extractAsistenciaData(
        input.images.map(img => ({ base64Content: img.base64, mimeType: img.mimeType }))
      );

      if (!extractedData || typeof extractedData !== "object") {
        return { exito: false as const, error: "No se pudieron extraer datos de las imagenes" };
      }

      const tipoActividad = String(extractedData.tipoActividad || "").trim().toUpperCase();
      const otroTipo = String(extractedData.otroTipo || "").trim();
      const fechaActividad = String(extractedData.fechaActividad || "").trim();
      const inicioActividad = String(extractedData.inicioActividad || "").trim();
      const finalizaActividad = String(extractedData.finalizaActividad || "").trim();
      const acargoActividad = String(extractedData.acargoActividad || "").trim();
      const detalles = String(extractedData.detalles || "").trim();

      const validTypes = ["PRACTICA", "CITACION", "REUNION DE Cia", "OTRO"];
      const tipoNormalizado = tipoActividad === "REUNION DE CIA" ? "REUNION DE Cia" : tipoActividad;
      if (!validTypes.includes(tipoNormalizado)) {
        return { exito: false as const, error: `Tipo de actividad no reconocido: ${tipoActividad}` };
      }
      const tipoFinal = tipoNormalizado === "OTRO" && otroTipo ? `OTRO: ${otroTipo}` : tipoNormalizado;

      const imageUrls: string[] = [];
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        for (let i = 0; i < input.images.length; i++) {
          try {
            const img = input.images[i];
            const url = await uploadToGCS(
              bucketName,
              `asistencia_${generateId()}_${i}.${img.mimeType.split("/")[1] || "jpg"}`,
              img.mimeType,
              img.base64
            );
            imageUrls.push(url);
            console.log("[Asistencia] Imagen subida a GCS:", url);
          } catch (err) {
            uploadError = err instanceof Error ? err.message : String(err);
            console.error("[Asistencia] Error subiendo imagen a GCS:", uploadError);
          }
        }
      } else {
        uploadError = "GCS_BUCKET_NAME no configurado";
        console.error("[Asistencia] GCS_BUCKET_NAME no configurado");
      }

      const secciones = ["combatientes", "activos", "especiales"] as const;
      const allPersonnel: PersonalAsistencia[] = [];

      for (const seccion of secciones) {
        const lista = extractedData[seccion];
        if (Array.isArray(lista)) {
          for (const item of lista) {
            if (!item || typeof item !== "object") continue;
            const codigoRaw = String((item as Record<string, unknown>).codigo || "").trim();
            const nombreRaw = String((item as Record<string, unknown>).nombre || "").trim();
            if (!codigoRaw && !nombreRaw) continue;

            const asistenciaRaw = String((item as Record<string, unknown>).asistencia || "AUSENTE").trim().toUpperCase();
            const asistenciaNormalizada = asistenciaRaw === "COMISIONADO" || asistenciaRaw === "COMISIONADA" ? "COMISIONADO" :
              asistenciaRaw === "PRESENTE" ? "PRESENTE" : "AUSENTE";

            allPersonnel.push({
              codigo: codigoRaw,
              nombre: nombreRaw ? toTitleCase(nombreRaw) : "",
              asistencia: asistenciaNormalizada,
            });
          }
        }
      }

      return {
        exito: true as const,
        imageUrls,
        uploadError: uploadError || undefined,
        datos: {
          tipoActividad: tipoFinal,
          fechaActividad,
          inicioActividad,
          finalizaActividad,
          acargoActividad,
          detalles,
          personal: allPersonnel,
        },
      };
    }),

  guardar: publicQuery
    .input(
      z.object({
        imageUrls: z.array(z.string()),
        datos: z.object({
          tipoActividad: z.string(),
          fechaActividad: z.string(),
          inicioActividad: z.string(),
          finalizaActividad: z.string(),
          acargoActividad: z.string(),
          detalles: z.string(),
          personal: z.array(
            z.object({
              codigo: z.string(),
              nombre: z.string(),
              asistencia: z.string(),
              exencion: z.string().optional(),
            })
          ),
        }),
        usuarioId: z.string(),
        usuarioNombre: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const idPlanilla = generateId();
      const fechaCarga = new Date().toLocaleDateString("es-ES");
      const d = input.datos;

      const db = getFirestoreClient();
      const batch = db.batch();
      batch.set(colAsistenciaEncabezado().doc(idPlanilla), {
        fechaCarga,
        fechaActividad: d.fechaActividad,
        tipoActividad: d.tipoActividad,
        inicioActividad: d.inicioActividad,
        finalizaActividad: d.finalizaActividad,
        acargoActividad: d.acargoActividad,
        detalles: d.detalles,
        urlImagenes: input.imageUrls,
      });

      for (const p of d.personal) {
        batch.set(colAsistenciaPersonal().doc(), {
          idPlanilla,
          fechaCarga,
          fechaActividad: d.fechaActividad,
          codigo: p.codigo,
          nombre: p.nombre,
          asistencia: p.asistencia,
          cargadoPorId: input.usuarioId,
          cargadoPorNombre: input.usuarioNombre,
          exencion: p.exencion || "",
        });
      }
      await batch.commit();

      return {
        exito: true as const,
        idPlanilla,
        totalPersonnel: d.personal.length,
        presentes: d.personal.filter(p => p.asistencia === "PRESENTE").length,
      };
    }),

  historial: publicQuery
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        tipo: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const snapshot = await colAsistenciaEncabezado().get();
      const planillas: Array<{
        idPlanilla: string;
        fechaCarga: string;
        fechaActividad: string;
        tipoActividad: string;
        inicioActividad: string;
        finalizaActividad: string;
        acargoActividad: string;
        detalles: string;
        urlImagenes: string[];
      }> = [];

      snapshot.forEach((doc) => {
        const fila = doc.data();
        const tipo = String(fila.tipoActividad || "").trim();
        if (input.tipo && !tipo.toUpperCase().includes(input.tipo.toUpperCase())) return;

        planillas.push({
          idPlanilla: doc.id,
          fechaCarga: String(fila.fechaCarga || ""),
          fechaActividad: String(fila.fechaActividad || ""),
          tipoActividad: tipo,
          inicioActividad: String(fila.inicioActividad || ""),
          finalizaActividad: String(fila.finalizaActividad || ""),
          acargoActividad: String(fila.acargoActividad || ""),
          detalles: String(fila.detalles || ""),
          urlImagenes: Array.isArray(fila.urlImagenes) ? fila.urlImagenes : [],
        });
      });

      planillas.sort((a, b) => {
        const dateA = parseDate(a.fechaActividad);
        const dateB = parseDate(b.fechaActividad);
        return dateB - dateA;
      });

      const start = (input.page - 1) * input.limit;
      const end = start + input.limit;
      const paginated = planillas.slice(start, end);

      return {
        exito: true as const,
        planillas: paginated,
        total: planillas.length,
        page: input.page,
        totalPages: Math.ceil(planillas.length / input.limit),
      };
    }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const snapshot = await colAsistenciaPersonal().where("idPlanilla", "==", input.idPlanilla.trim()).get();
      const personal = snapshot.docs.map((doc) => {
        const fila = doc.data();
        return {
          idFila: doc.id,
          idPlanilla: String(fila.idPlanilla || ""),
          fechaCarga: String(fila.fechaCarga || ""),
          fechaActividad: String(fila.fechaActividad || ""),
          codigo: String(fila.codigo || ""),
          nombre: String(fila.nombre || ""),
          asistencia: String(fila.asistencia || ""),
          exencion: String(fila.exencion || ""),
          cargadoPorId: String(fila.cargadoPorId || ""),
          cargadoPorNombre: String(fila.cargadoPorNombre || ""),
        };
      });

      return { exito: true as const, personal };
    }),

  editarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        codigo: z.string(),
        nuevaAsistencia: z.enum(["PRESENTE", "AUSENTE", "COMISIONADO"]),
      })
    )
    .mutation(async ({ input }) => {
      const snapshot = await colAsistenciaPersonal().where("idPlanilla", "==", input.idPlanilla.trim()).get();
      for (const doc of snapshot.docs) {
        if (String(doc.data().codigo || "").trim() === input.codigo.trim()) {
          await colAsistenciaPersonal().doc(doc.id).update({ asistencia: input.nuevaAsistencia });
          return { exito: true as const, mensaje: "Asistencia actualizada" };
        }
      }
      return { exito: false as const, error: "Bombero no encontrado en la planilla" };
    }),

  eliminarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        codigo: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const snapshot = await colAsistenciaPersonal().where("idPlanilla", "==", input.idPlanilla.trim()).get();
      for (const doc of snapshot.docs) {
        if (String(doc.data().codigo || "").trim() === input.codigo.trim()) {
          await colAsistenciaPersonal().doc(doc.id).delete();
          return { exito: true as const, mensaje: "Asistencia eliminada correctamente" };
        }
      }
      return { exito: false as const, error: "Bombero no encontrado en la planilla" };
    }),

  agregarPersonal: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        codigo: z.string(),
        nombre: z.string(),
        asistencia: z.enum(["PRESENTE", "AUSENTE", "COMISIONADO"]),
        usuarioId: z.string(),
        usuarioNombre: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const encDoc = await colAsistenciaEncabezado().doc(input.idPlanilla.trim()).get();
      if (!encDoc.exists) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }
      const fechaActividad = String(encDoc.data()!.fechaActividad || "");

      const fechaCarga = new Date().toLocaleDateString("es-ES");
      await colAsistenciaPersonal().add({
        idPlanilla: input.idPlanilla,
        fechaCarga,
        fechaActividad,
        codigo: input.codigo,
        nombre: input.nombre,
        asistencia: input.asistencia,
        cargadoPorId: input.usuarioId,
        cargadoPorNombre: input.usuarioNombre,
        exencion: "",
      });

      return { exito: true as const, mensaje: "Bombero agregado correctamente" };
    }),

  misMetricas: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const searchCode = extractNumber(input.codigo);
      const snapshot = await colAsistenciaPersonal().get();
      const asistencias: Array<{
        idPlanilla: string;
        fechaActividad: string;
        asistencia: string;
        exencion: string;
      }> = [];

      snapshot.forEach((doc) => {
        const fila = doc.data();
        const codigoFila = String(fila.codigo || "").trim();
        const numFila = extractNumber(codigoFila);
        if (numFila === searchCode) {
          asistencias.push({
            idPlanilla: String(fila.idPlanilla || ""),
            fechaActividad: String(fila.fechaActividad || ""),
            asistencia: String(fila.asistencia || ""),
            exencion: String(fila.exencion || ""),
          });
        }
      });

      const stats = {
        totalActividades: asistencias.length,
        presentes: asistencias.filter(a => a.asistencia === "PRESENTE").length,
        ausentes: asistencias.filter(a => a.asistencia === "AUSENTE").length,
        comisionados: asistencias.filter(a => a.asistencia === "COMISIONADO").length,
      };

      return { exito: true as const, asistencias, stats };
    }),

  eliminar: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .mutation(async ({ input }) => {
      const idPlanilla = input.idPlanilla.trim();
      const encDoc = await colAsistenciaEncabezado().doc(idPlanilla).get();
      if (!encDoc.exists) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      await colAsistenciaEncabezado().doc(idPlanilla).delete();

      const persSnapshot = await colAsistenciaPersonal().where("idPlanilla", "==", idPlanilla).get();
      if (!persSnapshot.empty) {
        const batch = getFirestoreClient().batch();
        persSnapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      return { exito: true as const, mensaje: "Planilla eliminada correctamente" };
    }),

  editar: publicQuery
    .input(
      z.object({
        idPlanilla: z.string(),
        fechaActividad: z.string().optional(),
        tipoActividad: z.string().optional(),
        inicioActividad: z.string().optional(),
        finalizaActividad: z.string().optional(),
        acargoActividad: z.string().optional(),
        detalles: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const idPlanilla = input.idPlanilla.trim();
      const encDoc = await colAsistenciaEncabezado().doc(idPlanilla).get();
      if (!encDoc.exists) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      const campos: Record<string, string> = {};
      if (input.fechaActividad !== undefined) campos.fechaActividad = input.fechaActividad;
      if (input.tipoActividad !== undefined) campos.tipoActividad = input.tipoActividad;
      if (input.inicioActividad !== undefined) campos.inicioActividad = input.inicioActividad;
      if (input.finalizaActividad !== undefined) campos.finalizaActividad = input.finalizaActividad;
      if (input.acargoActividad !== undefined) campos.acargoActividad = input.acargoActividad;
      if (input.detalles !== undefined) campos.detalles = input.detalles;

      await colAsistenciaEncabezado().doc(idPlanilla).update(campos);

      return { exito: true as const, mensaje: "Planilla actualizada correctamente" };
    }),

  mensualDetallada: publicQuery
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
          comisionadoDesde: normalizarFechaISO(String(fila[22] || "")),
        });
      }
      personasBase.sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

      const tipoPorPlanilla = await obtenerTipoPorPlanillaAsistencia();
      const persData = await obtenerAsistenciaPersonalComoFilas();
      const diasDelMes = new Date(input.anio, input.mes, 0).getDate();

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
      const fechasCitacion = Array.from(fechasCitacionSet).sort((a, b) => a - b);

      function calcularParaFechas(p: { codigo: string; numero: string; nombre: string; situ: string; exencion: string; comisionadoDesde: string }, fechasColumnas: number[], tipoBuscado: string) {
        if (p.situ === "LM") {
          const dias = new Array(fechasColumnas.length).fill("E");
          return { codigo: p.codigo, nombre: p.nombre, dias, total: fechasColumnas.length, presentes: fechasColumnas.length, porcentaje: 100 };
        }
        const dias: string[] = new Array(fechasColumnas.length).fill("");
        let total = 0;
        let presentes = 0;
        const diasConActividad = new Set<number>();
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
          const idxCol = fechasColumnas.indexOf(dia);
          if (idxCol === -1) continue;
          const asistencia = String(fila[8] || "").trim().toUpperCase();
          diasConActividad.add(dia);
          total++;
          if (asistencia === "PRESENTE") {
            presentes++;
            dias[idxCol] = "P";
          } else if (tipoBuscado === "PRACTICA") {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) {
              presentes++;
              dias[idxCol] = "E";
            } else {
              dias[idxCol] = "A";
            }
          } else {
            dias[idxCol] = "A";
          }
        }
        // Completar practicas: ausente (A) si no figura y no es exento; exento (E) si aplica.
        // Las fechas futuras se dejan vacias para no afectar el porcentaje antes de que pasen.
        if (tipoBuscado === "PRACTICA") {
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          for (let idxCol = 0; idxCol < fechasColumnas.length; idxCol++) {
            if (dias[idxCol]) continue;
            const dia = fechasColumnas[idxCol];
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            fechaDia.setHours(0, 0, 0, 0);
            if (fechaDia > hoy) continue;
            total++;
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) {
              presentes++;
              dias[idxCol] = "E";
            } else {
              dias[idxCol] = "A";
            }
          }
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
        return { codigo: p.codigo, nombre: p.nombre, dias, total, presentes, porcentaje: Math.round(porcentaje) };
      }

      const esActivo = input.categoria.toUpperCase() === "ACTIVO";

      const practicas = esActivo ? [] : personasBase.map((p) => calcularParaFechas(p, sabados, "PRACTICA"));
      // Citaciones siempre se devuelve poblado (con todos los nombres), aunque no haya
      // habido citaciones ese mes (en ese caso fechasCitacion esta vacio y cada persona
      // queda con dias:[] y 0%, para poder mostrar igual la planilla con los nombres).
      const citaciones = personasBase.map((p) => calcularParaFechas(p, fechasCitacion, "CITACION"));

      return {
        exito: true as const,
        sabados,
        practicas,
        fechasCitacion,
        citaciones,
        sinCitaciones: fechasCitacion.length === 0,
      };
    }),
});
