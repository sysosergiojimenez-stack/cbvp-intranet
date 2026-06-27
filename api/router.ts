import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./routers/auth";
import { personalRouter } from "./routers/personal";
import { planillasRouter } from "./routers/planillas";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  auth: authRouter,
  personal: personalRouter,
  planillas: planillasRouter,
});

export type AppRouter = typeof appRouter;
