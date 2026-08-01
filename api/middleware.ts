import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { readSheet } from "./services/sheets";
import { env } from "./lib/env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

// Verifica que el caller sea un usuario registrado con nivel 5 o cargo DESARROLLADOR.
// Espera el header Authorization: Basic base64(correo:contrasena).
export const adminProcedure = publicQuery.use(async ({ ctx, next }) => {
  const auth = ctx.req.headers.get("Authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Basic" || !token) {
    throw new Error("No autorizado: se requiere autenticacion de administrador");
  }

  let decoded = "";
  try {
    decoded = typeof Buffer !== "undefined"
      ? Buffer.from(token, "base64").toString("utf-8")
      : atob(token);
  } catch {
    throw new Error("No autorizado: token invalido");
  }

  const [correo, contrasena] = decoded.split(":");
  if (!correo || !contrasena) {
    throw new Error("No autorizado: credenciales incompletas");
  }

  const data = await readSheet(env.SHEET_USUARIOS_ID, "USUARIOS!A1:U");
  for (let i = 1; i < data.length; i++) {
    const fila = data[i];
    const correoFila = String(fila[13] || "").trim().toLowerCase();
    const passFila = String(fila[14] || "").trim();
    if (correoFila === correo.toLowerCase() && passFila === contrasena) {
      const cargo = String(fila[4] || "").trim().toUpperCase();
      const nivelRaw = parseInt(String(fila[15] || ""), 10);
      const nivelPermiso = nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1;
      if (nivelPermiso >= 5 || cargo === "DESARROLLADOR") {
        return next();
      }
      throw new Error("Prohibido: se requiere nivel 5 o cargo DESARROLLADOR");
    }
  }

  throw new Error("No autorizado: correo o contrasena incorrectos");
});
