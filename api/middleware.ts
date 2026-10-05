import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { colUsuarios } from "./services/usuariosFirestore";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

function extractNumber(code: string): string {
  const match = code.match(/\d+/);
  return match ? match[0] : "";
}

// Decodifica el header Authorization: Basic base64(codigo:contrasena) y
// busca el codigo de usuario correspondiente en Firestore. Comun a
// adminProcedure y authedProcedure.
async function resolverCodigoUsuario(ctx: TrpcContext): Promise<string> {
  const auth = ctx.req.headers.get("Authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Basic" || !token) {
    throw new Error("No autorizado: se requiere autenticacion");
  }

  let decoded = "";
  try {
    decoded = typeof Buffer !== "undefined"
      ? Buffer.from(token, "base64").toString("utf-8")
      : atob(token);
  } catch {
    throw new Error("No autorizado: token invalido");
  }

  const [codigo, contrasena] = decoded.split(":");
  if (!codigo || !contrasena) {
    throw new Error("No autorizado: credenciales incompletas");
  }

  const numeroBuscado = extractNumber(codigo);
  const snapshot = await colUsuarios().get();
  for (const doc of snapshot.docs) {
    const fila = doc.data();
    const codigoFila = String(fila.codigo || "").trim();
    const passFila = String(fila.contrasena || "").trim();
    if (numeroBuscado && extractNumber(codigoFila) === numeroBuscado && passFila === contrasena) {
      return codigoFila;
    }
  }

  throw new Error("No autorizado: codigo o contrasena incorrectos");
}

// Verifica que el caller sea un usuario registrado con nivel 5 o cargo DESARROLLADOR.
// Espera el header Authorization: Basic base64(codigo:contrasena).
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

  const [codigo, contrasena] = decoded.split(":");
  if (!codigo || !contrasena) {
    throw new Error("No autorizado: credenciales incompletas");
  }

  const numeroBuscado = extractNumber(codigo);
  const snapshot = await colUsuarios().get();
  for (const doc of snapshot.docs) {
    const fila = doc.data();
    const codigoFila = String(fila.codigo || "").trim();
    const passFila = String(fila.contrasena || "").trim();
    if (numeroBuscado && extractNumber(codigoFila) === numeroBuscado && passFila === contrasena) {
      const cargo = String(fila.cargo || "").trim().toUpperCase();
      const nivelRaw = parseInt(String(fila.nivelPermiso || ""), 10);
      const nivelPermiso = nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1;
      if (nivelPermiso >= 5 || cargo === "DESARROLLADOR") {
        return next();
      }
      throw new Error("Prohibido: se requiere nivel 5 o cargo DESARROLLADOR");
    }
  }

  throw new Error("No autorizado: codigo o contrasena incorrectos");
});

// Cualquier usuario logueado (sin exigir nivel de permiso), con su codigo
// disponible en ctx.codigoUsuario. Usado por acciones que son "sobre mi
// propia cuenta", como vincular Telegram.
export const authedProcedure = publicQuery.use(async ({ ctx, next }) => {
  const codigoUsuario = await resolverCodigoUsuario(ctx);
  return next({ ctx: { ...ctx, codigoUsuario } });
});
