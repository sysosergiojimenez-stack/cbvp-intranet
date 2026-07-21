import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  // Use process.cwd() for compatibility with bundled (esbuild) and Docker environments
  const distPath = path.resolve(process.cwd(), "dist/public");

  app.use(
    "*",
    serveStatic({
      root: "./dist/public",
      onFound: (filePath, c) => {
        if (filePath.endsWith("index.html")) {
          // index.html debe revalidarse siempre: es el que referencia los archivos
          // con hash del build actual. Si el navegador lo cachea, se queda pegado
          // en una version vieja del sitio (con endpoints que ya no existen).
          c.header("Cache-Control", "no-cache");
        } else {
          // Los archivos dentro de /assets/ tienen hash en el nombre (cambia en
          // cada build), asi que son seguros para cachear por mucho tiempo.
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      return c.json({ error: "index.html not found. Build may be incomplete." }, 500);
    }
    const content = fs.readFileSync(indexPath, "utf-8");
    c.header("Cache-Control", "no-cache");
    return c.html(content);
  });
}
