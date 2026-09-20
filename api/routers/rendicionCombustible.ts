import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { colUsuarios } from "../services/usuariosFirestore";
import { MOVILES_VALIDOS } from "@contracts/moviles";

function salidasMovilCollection() {
  return getFirestoreClient().collection("salidasMovil");
}

function cargasCombustibleCollection() {
  return getFirestoreClient().collection("cargasCombustible");
}

function movilesCollection() {
  return getFirestoreClient().collection("moviles");
}

// Igual que en salidaMovil.ts: algunos registros viejos tienen el anio de
// fechaSalida en 2 digitos.
function normalizarAnio(y: string): string {
  return y.length === 2 ? `20${y}` : y;
}

function fechaISO(fecha: string): string {
  const partes = fecha.split("/");
  if (partes.length !== 3) return "";
  const [d, m, y] = partes;
  return `${normalizarAnio(y)}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Los km de odometro vienen con "." como separador de miles (ej. "70.480"),
// nunca con decimales -- se descarta cualquier caracter no numerico en vez
// de parsear como float, que interpretaria el punto como coma decimal.
function parseKm(valor: string): number | null {
  const limpio = String(valor || "").replace(/[^\d]/g, "");
  return limpio ? parseInt(limpio, 10) : null;
}

function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export const rendicionCombustibleRouter = createRouter({
  datos: publicQuery
    .input(
      z.object({
        movil: z.enum(MOVILES_VALIDOS),
        mes: z.number().min(1).max(12),
        anio: z.number(),
      })
    )
    .query(async ({ input }) => {
      const mesStr = String(input.mes).padStart(2, "0");
      const desde = `${input.anio}-${mesStr}-01`;
      const ultimoDia = new Date(input.anio, input.mes, 0).getDate();
      const hasta = `${input.anio}-${mesStr}-${String(ultimoDia).padStart(2, "0")}`;

      // Datos fijos del movil (encabezado de la planilla)
      const movilesSnap = await movilesCollection().where("codificacion", "==", input.movil).limit(1).get();
      const movilData = movilesSnap.docs[0]?.data() || {};

      // Salidas del movil dentro del mes seleccionado
      const salidasSnap = await salidasMovilCollection().where("movil", "==", input.movil).get();
      const salidas = salidasSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, any>))
        .filter((s) => {
          const f = fechaISO(String(s.fechaSalida || ""));
          return f !== "" && f >= desde && f <= hasta;
        });

      // Cargas de combustible ya guardadas para esas salidas (1 doc por salida)
      const db = getFirestoreClient();
      const cargasPorSalida = new Map<string, Record<string, any>>();
      if (salidas.length > 0) {
        const refs = salidas.map((s) => cargasCombustibleCollection().doc(s.id));
        const snaps = await db.getAll(...refs);
        snaps.forEach((snap) => {
          if (snap.exists) cargasPorSalida.set(snap.id, snap.data() || {});
        });
      }

      // CI por nombre de conductor: coincidencia por primerNombre+primerApellido
      // contra Listado de Personal (unico lugar donde existe la cedula, campo nroDoc).
      const personalSnap = await colUsuarios().get();
      const ciPorNombre = new Map<string, string>();
      personalSnap.forEach((doc) => {
        const fila = doc.data();
        const nombre = normalizarNombre(`${fila.primerNombre || ""} ${fila.primerApellido || ""}`);
        if (nombre) ciPorNombre.set(nombre, String(fila.nroDoc || ""));
      });

      const filas = salidas
        .map((s) => {
          const carga = cargasPorSalida.get(s.id) || {};
          const kmSalida = parseKm(s.kilometrajeSalida);
          const kmLlegada = parseKm(s.kilometrajeLlegada);
          const kmRecorridos = kmSalida !== null && kmLlegada !== null ? Math.max(0, kmLlegada - kmSalida) : null;
          const ciAuto = ciPorNombre.get(normalizarNombre(String(s.conductor || ""))) || "";
          return {
            salidaId: s.id,
            fechaSalida: String(s.fechaSalida || ""),
            conductor: String(s.conductor || ""),
            ci: String(carga.ciManual || ciAuto || ""),
            kilometrajeSalida: String(s.kilometrajeSalida || ""),
            direccion: String(s.direccion || ""),
            kilometrajeLlegada: String(s.kilometrajeLlegada || ""),
            kmRecorridos,
            tipoServicio: String(s.tipoServicio || ""),
            factura: String(carga.factura || ""),
            litros: String(carga.litros || ""),
            importe: String(carga.importe || ""),
          };
        })
        .sort((a, b) => fechaISO(a.fechaSalida).localeCompare(fechaISO(b.fechaSalida)));

      return {
        exito: true as const,
        movil: {
          codificacion: String(movilData.codificacion || input.movil),
          tipo: String(movilData.tipo || ""),
          tipoCombustible: String(movilData.tipoCombustible || ""),
          numeroTarjetaFlota: String(movilData.numeroTarjetaFlota || ""),
          proveedorCombustible: String(movilData.proveedorCombustible || ""),
        },
        filas,
      };
    }),

  guardarCarga: publicQuery
    .input(
      z.object({
        salidaId: z.string().min(1),
        factura: z.string(),
        litros: z.string(),
        importe: z.string(),
        ciManual: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { salidaId, ...datos } = input;
      await cargasCombustibleCollection().doc(salidaId).set(datos, { merge: true });
      return { exito: true as const };
    }),
});
