import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { serve } from "@hono/node-server";
import { serveStaticFiles } from "./lib/vite";
import { getSheetsClient } from "./services/googleAuth";

const app = new Hono<{ Bindings: HttpBindings }>();

// En produccion, primero servir archivos estaticos (antes que API routes)
if (env.isProduction) {
  serveStaticFiles(app);
}

// Health check endpoint
app.get("/health", (c) => c.json({ ok: true, status: "CBVP API running" }, 200));

// Debug: list sheets in the Guardias spreadsheet (rebuild v2)
app.get("/debug/sheets", async (c) => {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: env.SHEET_GUARDIAS_ID,
      fields: "sheets.properties.title,sheets.properties.sheetId",
    });
    const sheetList = response.data.sheets?.map(s => ({
      title: s.properties?.title,
      sheetId: s.properties?.sheetId,
    })) || [];
    return c.json({
      spreadsheetId: env.SHEET_GUARDIAS_ID,
      sheets: sheetList,
    });
  } catch (err: unknown) {
    return c.json({
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  // serveStaticFiles ya se llamo arriba

  const port = parseInt(process.env.PORT || "3000");
  try {
    serve({ fetch: app.fetch, port }, () => {
      console.log(`[CBVP] Server running on port ${port}`);
    });
  } catch (err: unknown) {
    console.error("[CBVP] Failed to start server:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
