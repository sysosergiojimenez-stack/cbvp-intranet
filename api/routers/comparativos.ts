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
  // Nombre generico del item, el mismo para los 3 proveedores (para poder
  // compararlos). itemProveedor es el codigo/descripcion que usa CADA
  // proveedor para ese item, que puede ser distinto entre ellos.
  item: z.string(),
  itemProveedor: z.array(z.string()).length(3),
  cantidad: z.number().nullable(),
  precios: z.array(z.number().nullable()).length(3),
  // Indice (0, 1 o 2) del proveedor marcado para comprar este item, o null
  // si todavia no se eligio. Solo los items marcados entran en la orden de
  // compra y suman al resumen de totales.
  seleccionado: z.number().int().min(0).max(2).nullable(),
});

const proveedorSchema = z.object({
  nombre: z.string(),
  ruc: z.string(),
  telefono: z.string(),
  direccion: z.string(),
  contacto: z.string(),
});

const hojaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  proveedores: z.array(proveedorSchema).length(3),
  items: z.array(itemSchema),
});

function proveedorVacio(nombre: string): z.infer<typeof proveedorSchema> {
  return { nombre, ruc: "", telefono: "", direccion: "", contacto: "" };
}

// Registro de una orden de compra generada (una por proveedor, ya que cada
// una se envia/ejecuta de forma independiente). "ejecutada" es lo que ya se
// efectivamente compro/pago; "pendiente" todavia no.
const ordenCompraItemSchema = z.object({
  grupo: z.string(),
  item: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  subtotal: z.number(),
});

const ordenCompraSchema = z.object({
  id: z.string().min(1),
  // Numero correlativo dentro del comparativo (1, 2, 3...), para poder
  // identificar cada orden facilmente.
  numero: z.number().int().min(1),
  proveedor: z.string(),
  monto: z.number(),
  fechaGeneracion: z.string(),
  estado: z.enum(["pendiente", "ejecutada"]),
  items: z.array(ordenCompraItemSchema),
});

function hojaVacia(nombre: string): z.infer<typeof hojaSchema> {
  return {
    id: generateId(),
    nombre,
    proveedores: [proveedorVacio("Proveedor 1"), proveedorVacio("Proveedor 2"), proveedorVacio("Proveedor 3")],
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
        presupuesto: typeof fila.presupuesto === "number" ? fila.presupuesto : null,
        ordenesCompra: Array.isArray(fila.ordenesCompra) ? fila.ordenesCompra : [],
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

  actualizarPresupuesto: publicQuery
    .input(z.object({ id: z.string().min(1), presupuesto: z.number().nullable() }))
    .mutation(async ({ input }) => {
      await colComparativos().doc(input.id).update({ presupuesto: input.presupuesto });
      return { exito: true as const };
    }),

  // Agrega nuevas ordenes de compra generadas a la lista existente (no la
  // reemplaza), para no perder el estado ejecutada/pendiente de las que ya
  // estaban guardadas.
  agregarOrdenesCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenes: z.array(ordenCompraSchema) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativos().doc(input.id).get();
      const existentes = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      await colComparativos()
        .doc(input.id)
        .update({ ordenesCompra: [...existentes, ...input.ordenes] });
      return { exito: true as const };
    }),

  actualizarEstadoOrdenCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenId: z.string().min(1), estado: z.enum(["pendiente", "ejecutada"]) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativos().doc(input.id).get();
      const existentes: z.infer<typeof ordenCompraSchema>[] = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      const actualizadas = existentes.map((o) => (o.id === input.ordenId ? { ...o, estado: input.estado } : o));
      await colComparativos().doc(input.id).update({ ordenesCompra: actualizadas });
      return { exito: true as const };
    }),

  eliminarOrdenCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativos().doc(input.id).get();
      const existentes: z.infer<typeof ordenCompraSchema>[] = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      await colComparativos()
        .doc(input.id)
        .update({ ordenesCompra: existentes.filter((o) => o.id !== input.ordenId) });
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colComparativos().doc(input.id).delete();
      return { exito: true as const };
    }),
});
