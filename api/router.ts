import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { personalRouter } from "./routers/personal";
import { planillasRouter } from "./routers/planillas";
import { asistenciaRouter } from "./routers/asistencia";
import { salidaMovilRouter } from "./routers/salidaMovil";
import { rolesGuardiaRouter } from "./routers/rolesGuardia";
import { permisosRouter } from "./routers/permisos";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  personal: personalRouter,
  planillas: planillasRouter,
  asistencia: asistenciaRouter,
  salidaMovil: salidaMovilRouter,
  rolesGuardia: rolesGuardiaRouter,
  permisos: permisosRouter,
});

export type AppRouter = typeof appRouter;
