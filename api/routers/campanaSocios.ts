import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { env } from "../lib/env";
import { extractCampanaSociosData } from "../services/gemini";
import { uploadFile as uploadToGCS } from "../services/storage";
import { normalizarFechaISO, normalizarMesAnio } from "../lib/fechas";

// Reparto fijo entre Compania y Administracion para cada rubro de la
// Campana de Socios (ver planilla "Resumen de Movimiento Campana de
// Socios" que reparte los mismos porcentajes todos los meses).
const PORCENTAJE_COMPANIA = { cobranza: 0.6, primerAporte: 0, reasociacion: 0.5, aporteUnico: 0.5 };
const PORCENTAJE_ADMINISTRACION = { cobranza: 0.4, primerAporte: 1, reasociacion: 0.5, aporteUnico: 0.5 };

interface MontosBase {
  totalCobranzasMensuales: number;
  totalPrimerAporte: number;
  reasociacion: number;
  aporteUnico: number;
}

function calcularGanancias(montos: MontosBase) {
  const gananciaCompania = {
    cobranzasMensuales: montos.totalCobranzasMensuales * PORCENTAJE_COMPANIA.cobranza,
    primerAporte: montos.totalPrimerAporte * PORCENTAJE_COMPANIA.primerAporte,
    reasociacion: montos.reasociacion * PORCENTAJE_COMPANIA.reasociacion,
    aporteUnico: montos.aporteUnico * PORCENTAJE_COMPANIA.aporteUnico,
  };
  const gananciaAdministrativa = {
    cobranzasMensuales: montos.totalCobranzasMensuales * PORCENTAJE_ADMINISTRACION.cobranza,
    primerAporte: montos.totalPrimerAporte * PORCENTAJE_ADMINISTRACION.primerAporte,
    reasociacion: montos.reasociacion * PORCENTAJE_ADMINISTRACION.reasociacion,
    aporteUnico: montos.aporteUnico * PORCENTAJE_ADMINISTRACION.aporteUnico,
  };
  const netoCuartelGral =
    gananciaCompania.cobranzasMensuales + gananciaCompania.primerAporte + gananciaCompania.reasociacion + gananciaCompania.aporteUnico;
  const netoAdministrativo =
    gananciaAdministrativa.cobranzasMensuales +
    gananciaAdministrativa.primerAporte +
    gananciaAdministrativa.reasociacion +
    gananciaAdministrativa.aporteUnico;
  return { gananciaCompania, gananciaAdministrativa, netoCuartelGral, netoAdministrativo };
}

function colCampanaSocios() {
  return getFirestoreClient().collection("campanaSocios");
}

function generateId(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

const montosBaseSchema = z.object({
  mes: z.string(),
  totalDepositado: z.number().min(0),
  totalCobranzasMensuales: z.number().min(0),
  totalPrimerAporte: z.number().min(0),
  reasociacion: z.number().min(0),
  aporteUnico: z.number().min(0),
  directorAdministrativo: z.string(),
  administradorCampana: z.string(),
});

export const campanaSociosRouter = createRouter({
  // Extrae los montos del "Resumen de Movimiento Campana de Socios"
  // escaneado con IA -- todo como sugerencia, se puede corregir antes de
  // guardar en la pantalla de confirmacion.
  extraer: publicQuery
    .input(
      z.object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const extraido = await extractCampanaSociosData(input.base64, input.mimeType);

      const fechaDesdeISO = normalizarFechaISO(String((extraido as any).fechaDesde || ""));
      const mes = fechaDesdeISO ? normalizarMesAnio(fechaDesdeISO.slice(0, 7)) : "";

      let urlDocumento = "";
      let uploadError = "";
      const bucketName = env.GCS_BUCKET_NAME;
      if (bucketName && bucketName !== "dummy-bucket") {
        try {
          urlDocumento = await uploadToGCS(
            bucketName,
            `campana_socios_${generateId()}.${input.mimeType.split("/")[1] || "pdf"}`,
            input.mimeType,
            input.base64
          );
        } catch (err) {
          uploadError = err instanceof Error ? err.message : String(err);
        }
      } else {
        uploadError = "GCS_BUCKET_NAME no configurado";
      }

      return {
        exito: true as const,
        mes,
        totalDepositado: Number((extraido as any).totalDepositado) || 0,
        totalCobranzasMensuales: Number((extraido as any).totalCobranzasMensuales) || 0,
        totalPrimerAporte: Number((extraido as any).totalPrimerAporte) || 0,
        reasociacion: Number((extraido as any).reasociacion) || 0,
        aporteUnico: Number((extraido as any).aporteUnico) || 0,
        directorAdministrativo: String((extraido as any).directorAdministrativo || "").trim(),
        administradorCampana: String((extraido as any).administradorCampana || "").trim(),
        urlDocumento,
        uploadError: uploadError || undefined,
      };
    }),

  guardar: publicQuery
    .input(montosBaseSchema.extend({ urlDocumento: z.string(), cargadoPor: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { gananciaCompania, gananciaAdministrativa, netoCuartelGral, netoAdministrativo } = calcularGanancias(input);
      const id = generateId();
      await colCampanaSocios()
        .doc(id)
        .set({
          mes: normalizarMesAnio(input.mes),
          totalDepositado: input.totalDepositado,
          totalCobranzasMensuales: input.totalCobranzasMensuales,
          totalPrimerAporte: input.totalPrimerAporte,
          reasociacion: input.reasociacion,
          aporteUnico: input.aporteUnico,
          directorAdministrativo: input.directorAdministrativo,
          administradorCampana: input.administradorCampana,
          gananciaCompania,
          gananciaAdministrativa,
          netoCuartelGral,
          netoAdministrativo,
          urlDocumento: input.urlDocumento,
          cargadoPor: input.cargadoPor || "",
          fechaCarga: new Date().toISOString(),
        });
      return { exito: true as const, id };
    }),

  editar: publicQuery
    .input(montosBaseSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...campos } = input;
      const { gananciaCompania, gananciaAdministrativa, netoCuartelGral, netoAdministrativo } = calcularGanancias(campos);
      await colCampanaSocios()
        .doc(id)
        .update({
          ...campos,
          mes: normalizarMesAnio(campos.mes),
          gananciaCompania,
          gananciaAdministrativa,
          netoCuartelGral,
          netoAdministrativo,
        });
      return { exito: true as const };
    }),

  listado: publicQuery.query(async () => {
    const snapshot = await colCampanaSocios().get();
    const reportes = snapshot.docs
      .map((doc) => {
        const fila = doc.data();
        return {
          id: doc.id,
          mes: String(fila.mes || ""),
          totalDepositado: Number(fila.totalDepositado) || 0,
          totalCobranzasMensuales: Number(fila.totalCobranzasMensuales) || 0,
          totalPrimerAporte: Number(fila.totalPrimerAporte) || 0,
          reasociacion: Number(fila.reasociacion) || 0,
          aporteUnico: Number(fila.aporteUnico) || 0,
          directorAdministrativo: String(fila.directorAdministrativo || ""),
          administradorCampana: String(fila.administradorCampana || ""),
          gananciaCompania: {
            cobranzasMensuales: Number(fila.gananciaCompania?.cobranzasMensuales) || 0,
            primerAporte: Number(fila.gananciaCompania?.primerAporte) || 0,
            reasociacion: Number(fila.gananciaCompania?.reasociacion) || 0,
            aporteUnico: Number(fila.gananciaCompania?.aporteUnico) || 0,
          },
          gananciaAdministrativa: {
            cobranzasMensuales: Number(fila.gananciaAdministrativa?.cobranzasMensuales) || 0,
            primerAporte: Number(fila.gananciaAdministrativa?.primerAporte) || 0,
            reasociacion: Number(fila.gananciaAdministrativa?.reasociacion) || 0,
            aporteUnico: Number(fila.gananciaAdministrativa?.aporteUnico) || 0,
          },
          netoCuartelGral: Number(fila.netoCuartelGral) || 0,
          netoAdministrativo: Number(fila.netoAdministrativo) || 0,
          urlDocumento: String(fila.urlDocumento || ""),
          fechaCarga: String(fila.fechaCarga || ""),
        };
      })
      .sort((a, b) => b.mes.localeCompare(a.mes));
    return { exito: true as const, reportes };
  }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colCampanaSocios().doc(input.id).delete();
      return { exito: true as const };
    }),
});
