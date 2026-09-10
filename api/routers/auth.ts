import { z } from "zod";
import { formatearNombreCompleto } from "../lib/nombres";
import { createRouter, publicQuery } from "../middleware";
import { colUsuarios, colRoles } from "../services/usuariosFirestore";

async function obtenerNivelPermiso(cargo: string) {
  try {
    const cargoBusqueda = cargo.toString().trim();
    const doc = await colRoles().doc(cargoBusqueda).get();
    if (!doc.exists) return { exito: false, nivel: 1, descripcion: "", accesos: "" };
    const fila = doc.data()!;
    return {
      exito: true,
      nivel: parseInt(String(fila.nivel)) || 1,
      descripcion: fila.descripcion ? String(fila.descripcion) : "",
      accesos: fila.accesos ? String(fila.accesos) : "",
    };
  } catch {
    return { exito: false, nivel: 1, descripcion: "", accesos: "" };
  }
}

export const authRouter = createRouter({
  login: publicQuery
    .input(
      z.object({
        correo: z.string().email(),
        contrasena: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const correoInput = input.correo.trim().toLowerCase();
      const passInput = input.contrasena.trim();

      const snapshot = await colUsuarios().get();

      for (const doc of snapshot.docs) {
        const fila = doc.data();
        const correoFila = fila.correo ? String(fila.correo).trim().toLowerCase() : "";
        const passFila = fila.contrasena ? String(fila.contrasena).trim() : "";

        if (correoFila === correoInput && passFila === passInput) {
          const cargo = fila.cargo ? String(fila.cargo).trim() : "Voluntario(a)";
          const permiso = await obtenerNivelPermiso(cargo);
          const nivelColP = parseInt(String(fila.nivelPermiso || ""), 10);
          const nivelPermiso =
            nivelColP >= 1 && nivelColP <= 5
              ? nivelColP
              : permiso.exito
                ? permiso.nivel
                : 2;

          const primerNombre = fila.primerNombre ? String(fila.primerNombre).trim() : "";
          const primerApellido = fila.primerApellido ? String(fila.primerApellido).trim() : "";
          const rango = fila.rango ? String(fila.rango).trim() : "";
          const categoriaFila = fila.categoria ? String(fila.categoria).trim() : "";
          const nombreCompleto = formatearNombreCompleto(rango, categoriaFila, primerNombre, primerApellido);

          return {
            exito: true as const,
            identificador: doc.id,
            codigo: String(fila.codigo || ""),
            anioJuramento: String(fila.anioJuramento || ""),
            categoria: String(fila.categoria || ""),
            cargo,
            rango: String(fila.rango || ""),
            nivelPermiso,
            descripcionPermiso: permiso.exito ? permiso.descripcion : "",
            accesosPermiso: permiso.exito ? permiso.accesos : "",
            nombreCompleto,
            correo: correoFila,
          };
        }
      }

      return {
        exito: false as const,
        mensaje: "Correo o contrasena incorrectos",
      };
    }),

  ficha: publicQuery
    .input(z.object({ correo: z.string().email() }))
    .query(async ({ input }) => {
      const correoBusqueda = input.correo.trim().toLowerCase();
      const snapshot = await colUsuarios().get();

      for (const doc of snapshot.docs) {
        const fila = doc.data();
        const correoFila = fila.correo ? String(fila.correo).trim().toLowerCase() : "";
        if (correoFila === correoBusqueda) {
          const primerNombre = fila.primerNombre ? String(fila.primerNombre).trim() : "";
          const primerApellido = fila.primerApellido ? String(fila.primerApellido).trim() : "";
          const rango = fila.rango ? String(fila.rango).trim() : "";
          const categoriaFila = fila.categoria ? String(fila.categoria).trim() : "";
          const nombreCompleto = formatearNombreCompleto(rango, categoriaFila, primerNombre, primerApellido);

          return {
            exito: true as const,
            identificador: doc.id,
            codigo: String(fila.codigo || ""),
            anioJuramento: String(fila.anioJuramento || ""),
            categoria: String(fila.categoria || ""),
            cargo: String(fila.cargo || ""),
            rango: String(fila.rango || ""),
            codigoRadial: String(fila.codigoRadial || ""),
            nombreCompleto,
            nroDoc: String(fila.nroDoc || ""),
            fechaNacimiento: String(fila.fechaNacimiento || ""),
            correo: correoFila,
          };
        }
      }

      return { exito: false as const, mensaje: "Usuario no encontrado" };
    }),
});
