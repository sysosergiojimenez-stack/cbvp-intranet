import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { colUsuarios } from "./services/usuariosFirestore";

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

  const snapshot = await colUsuarios().get();
  for (const doc of snapshot.docs) {
    const fila = doc.data();
    const correoFila = String(fila.correo || "").trim().toLowerCase();
    const passFila = String(fila.contrasena || "").trim();
    if (correoFila === correo.toLowerCase() && passFila === contrasena) {
      const cargo = String(fila.cargo || "").trim().toUpperCase();
      const nivelRaw = parseInt(String(fila.nivelPermiso || ""), 10);
      const nivelPermiso = nivelRaw >= 1 && nivelRaw <= 5 ? nivelRaw : 1;
      if (nivelPermiso >= 5 || cargo === "DESARROLLADOR") {
        return next();
      }
      throw new Error("Prohibido: se requiere nivel 5 o cargo DESARROLLADOR");
    }
  }

  throw new Error("No autorizado: correo o contrasena incorrectos");
});
