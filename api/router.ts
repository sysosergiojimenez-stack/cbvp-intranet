import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { personalRouter } from "./routers/personal";
import { planillasRouter } from "./routers/planillas";
import { asistenciaRouter } from "./routers/asistencia";
import { salidaMovilRouter } from "./routers/salidaMovil";
import { rolesGuardiaRouter } from "./routers/rolesGuardia";
import { permisosRouter } from "./routers/permisos";
import { movilesRouter } from "./routers/moviles";
import { materialMenorRouter } from "./routers/materialMenor";
import { controlMovilRouter } from "./routers/controlMovil";
import { rendicionCombustibleRouter } from "./routers/rendicionCombustible";
import { informeIncendioRouter } from "./routers/informeIncendio";
import { notificacionesRouter } from "./routers/notificaciones";
import { cuotasBomberosRouter } from "./routers/cuotasBomberos";
import { ordenesPagoRouter } from "./routers/ordenesPago";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  personal: personalRouter,
  planillas: planillasRouter,
  asistencia: asistenciaRouter,
  salidaMovil: salidaMovilRouter,
  rolesGuardia: rolesGuardiaRouter,
  permisos: permisosRouter,
  moviles: movilesRouter,
  materialMenor: materialMenorRouter,
  controlMovil: controlMovilRouter,
  rendicionCombustible: rendicionCombustibleRouter,
  informeIncendio: informeIncendioRouter,
  notificaciones: notificacionesRouter,
  cuotasBomberos: cuotasBomberosRouter,
  ordenesPago: ordenesPagoRouter,
});

export type AppRouter = typeof appRouter;
