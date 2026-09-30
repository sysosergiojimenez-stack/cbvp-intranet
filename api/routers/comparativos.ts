import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

function colComparativos() {
  return getFirestoreClient().collection("comparativos");
}

function generateId(): string {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0") +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

const itemSchema = z.object({
  id: z.string().min(1),
  item: z.string(),
  cantidad: z.number().nullable(),
  precios: z.array(z.number().nullable()).length(3),
});

const hojaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  proveedores: z.array(z.string()).length(3),
  items: z.array(itemSchema),
});

function hojaVacia(nombre: string): z.infer<typeof hojaSchema> {
  return {
    id: generateId(),
    nombre,
    proveedores: ["Proveedor 1", "Proveedor 2", "Proveedor 3"],
    items: [],
  };
}

export const comparativosRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await colComparativos().get();
    const comparativos = snapshot.docs
      .map((doc) => {
        const fila = doc.data();
        const hojas = Array.isArray(fila.hojas) ? fila.hojas : [];
        return {
          id: doc.id,
          nombre: String(fila.nombre || ""),
          fechaCreacion: String(fila.fechaCreacion || ""),
          creadoPor: String(fila.creadoPor || ""),
          cantidadHojas: hojas.length,
        };
      })
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
    return { exito: true as const, comparativos };
  }),

  obtener: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const doc = await colComparativos().doc(input.id).get();
      if (!doc.exists) {
        return { exito: false as const, error: "Comparativo no encontrado" };
      }
      const fila = doc.data()!;
      return {
        exito: true as const,
        id: doc.id,
        nombre: String(fila.nombre || ""),
        fechaCreacion: String(fila.fechaCreacion || ""),
        creadoPor: String(fila.creadoPor || ""),
        hojas: Array.isArray(fila.hojas) ? fila.hojas : [],
      };
    }),

  crear: publicQuery
    .input(
      z.object({
        nombre: z.string().min(1),
        nombrePrimeraHoja: z.string().min(1),
        creadoPor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = generateId();
      await colComparativos()
        .doc(id)
        .set({
          nombre: input.nombre.trim(),
          fechaCreacion: new Date().toISOString(),
          creadoPor: input.creadoPor || "",
          hojas: [hojaVacia(input.nombrePrimeraHoja.trim())],
        });
      return { exito: true as const, id };
    }),

  renombrar: publicQuery
    .input(z.object({ id: z.string().min(1), nombre: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colComparativos().doc(input.id).update({ nombre: input.nombre.trim() });
      return { exito: true as const };
    }),

  // Reemplaza el arreglo de hojas completo (pestañas, proveedores, items y
  // precios). Se guarda todo junto desde el cliente, como con una planilla
  // que se edita localmente y se guarda al terminar.
  guardarHojas: publicQuery
    .input(z.object({ id: z.string().min(1), hojas: z.array(hojaSchema) }))
    .mutation(async ({ input }) => {
      await colComparativos().doc(input.id).update({ hojas: input.hojas });
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colComparativos().doc(input.id).delete();
      return { exito: true as const };
    }),
});
