import { z } from "zod";
import { formatearNombreCompleto } from "../lib/nombres";
import { normalizarFechaISO, normalizarMesAnio } from "../lib/fechas";
import { createRouter, publicQuery } from "../middleware";
import { readSheet, appendRow, updateRange, findRowIndex, deleteRows, getSheetId } from "../services/sheets";
import { extractGuardiaData } from "../services/gemini";
import { uploadFile } from "../services/storage";
import { env } from "../lib/env";

// Convert Google Sheets serial time (fraction of day) to HH:MM
function serialToTime(serial: unknown): string {
  if (typeof serial === "number" && serial >= 0 && serial < 1) {
    const totalMinutes = Math.round(serial * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return String(serial || "");
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

export const planillasRouter = createRouter({
  historial: publicQuery
    .input(z.object({ codigo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado!A1:K");
      const planillas = [];

      for (let i = 1; i < data.length; i++) {
        planillas.push({
          idPlanilla: String(data[i][0] || ""),
          fechaCarga: String(data[i][1] || ""),
          fechaGuardia: String(data[i][2] || ""),
          grupo: String(data[i][3] || ""),
          inicioGuardia: serialToTime(data[i][4]),
          finalizaGuardia: serialToTime(data[i][5]),
          directorSem: String(data[i][6] || ""),
          comandanteSemana: String(data[i][7] || ""),
          oficialK20: String(data[i][8] || ""),
          novedades: String(data[i][9] || ""),
          urlImagen: String(data[i][10] || ""),
        });
      }

      // If codigo provided (Voluntario), filter planillas where bombero appears
      const searchCode = input?.codigo;
      if (searchCode) {
        const persData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Personal!A1:L");
        const numericSearch = (searchCode.match(/\d+/) || [searchCode])[0];
        const planillaIds = new Set<string>();
        for (let i = 1; i < persData.length; i++) {
          const codigoRaw = String(persData[i][6] || "").trim();
          const codigoMatch = codigoRaw.match(/\d+/);
          const codigo = codigoMatch ? codigoMatch[0] : codigoRaw;
          if (codigo === numericSearch) {
            planillaIds.add(String(persData[i][1] || "").trim());
          }
        }
        const filtered = planillas.filter(p => planillaIds.has(p.idPlanilla));
        filtered.sort((a, b) => {
          const parseFecha = (f: string) => {
            try {
              const parts = f.split(" ");
              const [d, m, y] = parts[0].split("/");
              return new Date(`${y}-${m}-${d}T${parts[1] || "00:00"}`).getTime();
            } catch { return 0; }
          };
          return parseFecha(b.fechaCarga) - parseFecha(a.fechaCarga);
        });
        return { exito: true as const, planillas: filtered };
      }

      planillas.sort((a, b) => {
        const parseFecha = (f: string) => {
          try {
            const parts = f.split(" ");
            const [d, m, y] = parts[0].split("/");
            return new Date(`${y}-${m}-${d}T${parts[1] || "00:00"}`).getTime();
          } catch {
            return 0;
          }
        };
        return parseFecha(b.fechaCarga) - parseFecha(a.fechaCarga);
      });

      return { exito: true as const, planillas };
    }),

  detalle: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .query(async ({ input }) => {
      const data = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:M"
      );
      const personal = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][1] && String(data[i][1]) === input.idPlanilla) {
          personal.push({
            idFila: String(data[i][0] || ""),
            idPlanilla: String(data[i][1] || ""),
            fechaCarga: String(data[i][2] || ""),
            fechaGuardia: String(data[i][3] || ""),
            grupo: String(data[i][4] || ""),
            tipo: String(data[i][5] || ""),
            codigo: String(data[i][6] || ""),
            nombre: String(data[i][7] || ""),
            asignacion: String(data[i][8] || ""),
            asistencia: String(data[i][9] || ""),
            exencion: String(data[i][12] || ""),
            idCargador: String(data[i][10] || ""),
            nombreCargador: String(data[i][11] || ""),
          });
        }
      }

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

        await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado", [
          idPlanilla,
          fechaCargaStr,
          String(datosExtraidos.fechaGuardia || ""),
          String(datosExtraidos.grupo || ""),
          String(datosExtraidos.inicioGuardia || ""),
          String(datosExtraidos.finalizaGuardia || ""),
          String(datosExtraidos.directorSem || ""),
          String(datosExtraidos.comandanteSemana || ""),
          String(datosExtraidos.oficialK20 || ""),
          String(datosExtraidos.novedades || ""),
          urlImagen,
        ]);

        let filaIdx = 1;
        const personal = datosExtraidos.personal || [];
        for (const p of personal) {
          await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
            `${idPlanilla}-${filaIdx}`,
            idPlanilla,
            fechaCargaStr,
            String(datosExtraidos.fechaGuardia || ""),
            String(datosExtraidos.grupo || ""),
            "GUARDIA NORMAL",
            String(p.codigo || ""),
            String(p.nombre || ""),
            String(p.asignacion || ""),
            String(p.asistencia || ""),
            input.user.identificador,
            input.user.nombreCompleto,
            p.exencion || "",
          ]);
          filaIdx++;
        }
        const guardiasEspeciales = datosExtraidos.guardiasEspeciales || [];
        for (const e of guardiasEspeciales) {
          if (e.codigo || e.nombre) {
            await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
              `${idPlanilla}-${filaIdx}`,
              idPlanilla,
              fechaCargaStr,
              String(datosExtraidos.fechaGuardia || ""),
              String(datosExtraidos.grupo || ""),
              "GUARDIA ESPECIAL",
              String(e.codigo || ""),
              String(e.nombre || ""),
              String(e.asignacion || ""),
              "",
              input.user.identificador,
              input.user.nombreCompleto,
            ]);
            filaIdx++;
          }
        }
        const refuerzos = datosExtraidos.refuerzos || [];
        for (const r of refuerzos) {
          if (r.codigo || r.nombre) {
            await appendRow(env.SHEET_GUARDIAS_ID, "Guardias_Personal", [
              `${idPlanilla}-${filaIdx}`,
              idPlanilla,
              fechaCargaStr,
              String(datosExtraidos.fechaGuardia || ""),
              String(datosExtraidos.grupo || ""),
              "REFUERZO",
              String(r.codigo || ""),
              String(r.nombre || ""),
              String(r.asignacion || ""),
              "",
              input.user.identificador,
              input.user.nombreCompleto,
            ]);
            filaIdx++;
          }
        }

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
        const rowIdx = await findRowIndex(
          env.SHEET_GUARDIAS_ID,
          "Guardias_Encabezado!A1:K",
          0,
          input.idPlanilla
        );

        if (rowIdx === -1) {
          return { exito: false as const, mensaje: "Planilla no encontrada" };
        }

        const d = input.datos;
        await updateRange(env.SHEET_GUARDIAS_ID, `Guardias_Encabezado!C${rowIdx}:J${rowIdx}`, [
          [
            d.fechaGuardia || "",
            d.grupo || "",
            d.inicioGuardia || "",
            d.finalizaGuardia || "",
            d.directorSem || "",
            d.comandanteSemana || "",
            d.oficialK20 || "",
            d.novedades || "",
          ],
        ]);

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
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L"
      );

      // Build a map of idFila -> rowIndex (1-based)
      const rowMap = new Map<string, number>();
      for (let i = 1; i < persData.length; i++) {
        const idFila = persData[i][0] ? String(persData[i][0]).trim() : "";
        if (idFila) rowMap.set(idFila, i + 1);
      }

      // Update each person
      for (const p of input.personal) {
        const rowIdx = rowMap.get(p.idFila.trim());
        if (!rowIdx) continue;

        // Columns: I=Asignacion(8), J=Asistencia(9)
        await updateRange(
          env.SHEET_GUARDIAS_ID,
          `Guardias_Personal!I${rowIdx}:J${rowIdx}`,
          [[p.asignacion || "", p.asistencia || ""]]
        );
      }

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
      const data = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Personal!A1:J");
      for (let i = 1; i < data.length; i++) {
        const rowIdPlanilla = String(data[i][1] || "").trim();
        const rowCodigo = String(data[i][6] || "").trim();
        if (rowIdPlanilla === input.idPlanilla.trim() && rowCodigo === input.codigo.trim()) {
          await updateRange(
            env.SHEET_GUARDIAS_ID,
            `Guardias_Personal!J${i + 1}`,
            [[input.nuevaAsistencia]]
          );
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
      const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado!A1:K");
      let encRowIndex = -1;
      for (let i = 1; i < encData.length; i++) {
        if (String(encData[i][0] || "").trim() === input.idPlanilla.trim()) {
          encRowIndex = i;
          break;
        }
      }
      if (encRowIndex === -1) {
        return { exito: false as const, error: "Planilla no encontrada" };
      }

      const existingRow = encData[encRowIndex];
      const updatedRow = [
        existingRow[0],
        existingRow[1],
        input.fechaGuardia ?? existingRow[2] ?? "",
        input.grupo ?? existingRow[3] ?? "",
        input.inicioGuardia ?? existingRow[4] ?? "",
        input.finalizaGuardia ?? existingRow[5] ?? "",
        input.directorSem ?? existingRow[6] ?? "",
        input.comandanteSemana ?? existingRow[7] ?? "",
        input.oficialK20 ?? existingRow[8] ?? "",
        input.novedades ?? existingRow[9] ?? "",
        existingRow[10] ?? "",
      ];

      await updateRange(
        env.SHEET_GUARDIAS_ID,
        `Guardias_Encabezado!A${encRowIndex + 1}:K${encRowIndex + 1}`,
        [updatedRow]
      );

      return { exito: true as const, mensaje: "Planilla actualizada correctamente" };
    }),

  eliminar: publicQuery
    .input(z.object({ idPlanilla: z.string() }))
    .mutation(async ({ input }) => {
      // Delete from Encabezado
      const encData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Encabezado!A1:K"
      );
      const encRowsToDelete: number[] = [];

      for (let i = encData.length - 1; i >= 1; i--) {
        if (encData[i][0] && String(encData[i][0]).trim() === input.idPlanilla.trim()) {
          encRowsToDelete.push(i + 1);
        }
      }

      if (encRowsToDelete.length > 0) {
        const encSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Guardias_Encabezado");
        await deleteRows(env.SHEET_GUARDIAS_ID, encSheetId, encRowsToDelete);
      }

      // Delete from Personal
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:L"
      );
      const persRowsToDelete: number[] = [];

      for (let i = persData.length - 1; i >= 1; i--) {
        if (persData[i][1] && String(persData[i][1]).trim() === input.idPlanilla.trim()) {
          persRowsToDelete.push(i + 1);
        }
      }

      if (persRowsToDelete.length > 0) {
        const persSheetId = await getSheetId(env.SHEET_GUARDIAS_ID, "Guardias_Personal");
        await deleteRows(env.SHEET_GUARDIAS_ID, persSheetId, persRowsToDelete);
      }

      return { exito: true as const, mensaje: "Planilla eliminada" };
    }),

  misMetricas: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:J"
      );
      const searchCodeMatch = input.codigo.match(/\d+/);
      const searchCode = searchCodeMatch ? searchCodeMatch[0] : input.codigo.trim();

      const guardias: Array<{
        idPlanilla: string; fechaGuardia: string; grupo: string;
        tipo: string; asignacion: string; asistencia: string; fechaCarga: string;
      }> = [];

      for (let i = 1; i < persData.length; i++) {
        const row = persData[i];
        const codigoRaw = String(row[6] || "").trim();
        const codigoMatch = codigoRaw.match(/\d+/);
        const codigo = codigoMatch ? codigoMatch[0] : codigoRaw;
        if (codigo !== searchCode) continue;
        guardias.push({
          idPlanilla: String(row[1] || ""),
          fechaCarga: String(row[2] || ""),
          fechaGuardia: String(row[3] || ""),
          grupo: String(row[4] || ""),
          tipo: String(row[5] || "").trim().toUpperCase(),
          asignacion: String(row[8] || ""),
          asistencia: String(row[9] || "").trim().toUpperCase(),
        });
      }

      guardias.sort((a, b) => b.idPlanilla.localeCompare(a.idPlanilla));

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

  debugGuardiasPersonal: publicQuery
    .query(async () => {
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:J"
      );
      return {
        exito: true as const,
        rows: persData,
        columns: ["A-idFila", "B-idPlanilla", "C-fechaCarga", "D-fechaGuardia", "E-grupo", "F-regimen", "G-codigo", "H-personal", "I-asignacion", "J-asistencia"],
      };
    }),

  debugMisMetricas: publicQuery
    .input(z.object({ codigo: z.string() }))
    .query(async ({ input }) => {
      const persData = await readSheet(
        env.SHEET_GUARDIAS_ID,
        "Guardias_Personal!A1:J"
      );

      const searchCode = input.codigo.trim().toUpperCase().replace(/\s+/g, ' ');
      const matches: Array<{ row: number; codigo: string; regimen: string; asistencia: string; personal: string }> = [];
      const allCodigos: string[] = [];

      for (let i = 1; i < persData.length; i++) {
        const row = persData[i];
        const codigo = String(row[6] || "").trim().toUpperCase().replace(/\s+/g, ' ');
        const regimen = String(row[5] || "").trim().toUpperCase();
        const asistencia = String(row[9] || "").trim().toUpperCase();
        const personal = String(row[7] || "").trim();

        if (i <= 15) allCodigos.push(codigo);

        if (codigo === searchCode) {
          matches.push({ row: i + 1, codigo, regimen, asistencia, personal });
        }
      }

      return {
        exito: true as const,
        searchCode,
        originalInput: input.codigo,
        totalRows: persData.length - 1,
        matchesFound: matches.length,
        firstCodigos: allCodigos.slice(0, 15),
        matches,
      };
    }),

  asistenciaMensualDetallada: publicQuery
    .input(z.object({ mes: z.number().min(1).max(12), anio: z.number(), categoria: z.string() }))
    .query(async ({ input }) => {
      const usuariosData = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:W");
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

      const guardiasData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Personal!A1:M");
      const diasDelMes = new Date(input.anio, input.mes, 0).getDate();

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

      if (input.categoria.toUpperCase() === "ACTIVO") {
        const asistencia = personasBase.map((p) => calcular(p, "GUARDIA NORMAL"));
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

      const usuariosData = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:W");
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
      const guardiasData = await readSheet(env.SHEET_GUARDIAS_ID, "Guardias_Personal!A1:M");
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
      const encData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Encabezado!A1:I");
      const tipoPorPlanilla = new Map<string, string>();
      for (let i = 1; i < encData.length; i++) {
        const idPlanilla = String(encData[i][0] || "").trim();
        const tipo = String(encData[i][3] || "").trim().toUpperCase();
        if (idPlanilla) tipoPorPlanilla.set(idPlanilla, tipo);
      }
      const persData = await readSheet(env.SHEET_GUARDIAS_ID, "Asistencia_Personal!A1:L");

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
          if (fechasPermitidas && !fechasPermitidas.has(dia)) continue;
          const asistencia = String(fila[8] || "").trim().toUpperCase();
          diasConActividad.add(dia);
          total++;
          if (asistencia === "PRESENTE") {
            presentes++;
          } else if (tipoBuscado === "PRACTICA") {
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) presentes++;
          }
        }
        // Aplicar exenciones automaticas del personal para practicas en fechas permitidas sin actividad cargada
        if (tipoBuscado === "PRACTICA" && fechasPermitidas) {
          for (const dia of fechasPermitidas) {
            if (diasConActividad.has(dia)) continue;
            const fechaDia = new Date(input.anio, input.mes - 1, dia);
            if (esExentoAutomatico(p, fechaDia, 'PRACTICAS')) {
              presentes++;
              total++;
            }
          }
        }
        const realPercent = total > 0 ? (presentes / total) * 100 : 0;
        return porcentajeConSitu(realPercent, presentes, p.situ);
      }

      const sabadosSet = new Set(sabados);

      const filas = personasBase.map((p) => {
        const esGE = p.situ === "GE";
        let guardiasPercent = esActivo
          ? calcularGuardias(p, "GUARDIA NORMAL")
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
