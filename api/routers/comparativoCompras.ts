import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";

// Submodulo de PRUEBA paralelo a "comparativos": misma idea de pestañas +
// items, pero cada item tiene su propia lista libre de cotizaciones de
// proveedor (nombre, codigo, nombre de producto, precio y URL), en vez de
// columnas fijas de proveedor por pestaña. Coleccion de Firestore separada
// para no mezclar datos con el modulo original.
function colComparativoCompras() {
  return getFirestoreClient().collection("comparativoCompras");
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

const cotizacionSchema = z.object({
  id: z.string().min(1),
  proveedor: z.string(),
  ruc: z.string(),
  telefono: z.string(),
  direccion: z.string(),
  contacto: z.string(),
  codigoProducto: z.string(),
  nombreProducto: z.string(),
  precio: z.number().nullable(),
  url: z.string(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  item: z.string(),
  cantidad: z.number().nullable(),
  // Cantidad libre de cotizaciones de proveedor para este item (no hay un
  // numero fijo de proveedores por pestaña como en el modulo original).
  cotizaciones: z.array(cotizacionSchema),
  // Id de la cotizacion marcada para comprar (dentro de "cotizaciones"), o
  // null si todavia no se eligio.
  seleccionada: z.string().nullable(),
});

const hojaSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  items: z.array(itemSchema),
});

const ordenCompraItemSchema = z.object({
  itemId: z.string(),
  cotizacionId: z.string(),
  grupo: z.string(),
  item: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  subtotal: z.number(),
});

const ordenCompraSchema = z.object({
  id: z.string().min(1),
  numero: z.number().int().min(1),
  proveedor: z.string(),
  proveedorRuc: z.string(),
  proveedorTelefono: z.string(),
  proveedorDireccion: z.string(),
  proveedorContacto: z.string(),
  monto: z.number(),
  fechaGeneracion: z.string(),
  estado: z.enum(["pendiente", "ejecutada", "anulada"]),
  items: z.array(ordenCompraItemSchema),
});

function hojaVacia(nombre: string): z.infer<typeof hojaSchema> {
  return { id: generateId(), nombre, items: [] };
}

export const comparativoComprasRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await colComparativoCompras().get();
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

  // Proveedores ya cargados en cualquier cotizacion de cualquier comparativo
  // (no solo el que se esta editando), para sugerirlos al cargar uno nuevo y
  // autocompletar sus datos de contacto si todavia no se cargaron.
  sugerenciasProveedores: publicQuery.query(async () => {
    const snapshot = await colComparativoCompras().get();
    const porNombre = new Map<string, { nombre: string; ruc: string; telefono: string; direccion: string; contacto: string }>();
    for (const doc of snapshot.docs) {
      const hojas = Array.isArray(doc.data().hojas) ? doc.data().hojas : [];
      for (const hoja of hojas) {
        for (const item of hoja.items || []) {
          for (const cot of item.cotizaciones || []) {
            const nombre = String(cot.proveedor || "").trim();
            if (!nombre) continue;
            porNombre.set(nombre.toLowerCase(), {
              nombre,
              ruc: String(cot.ruc || ""),
              telefono: String(cot.telefono || ""),
              direccion: String(cot.direccion || ""),
              contacto: String(cot.contacto || ""),
            });
          }
        }
      }
    }
    const proveedores = Array.from(porNombre.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { exito: true as const, proveedores };
  }),

  obtener: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const doc = await colComparativoCompras().doc(input.id).get();
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
      await colComparativoCompras()
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
      await colComparativoCompras().doc(input.id).update({ nombre: input.nombre.trim() });
      return { exito: true as const };
    }),

  guardarHojas: publicQuery
    .input(z.object({ id: z.string().min(1), hojas: z.array(hojaSchema) }))
    .mutation(async ({ input }) => {
      await colComparativoCompras().doc(input.id).update({ hojas: input.hojas });
      return { exito: true as const };
    }),

  actualizarPresupuesto: publicQuery
    .input(z.object({ id: z.string().min(1), presupuesto: z.number().nullable() }))
    .mutation(async ({ input }) => {
      await colComparativoCompras().doc(input.id).update({ presupuesto: input.presupuesto });
      return { exito: true as const };
    }),

  agregarOrdenesCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenes: z.array(ordenCompraSchema) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativoCompras().doc(input.id).get();
      const existentes = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      await colComparativoCompras()
        .doc(input.id)
        .update({ ordenesCompra: [...existentes, ...input.ordenes] });
      return { exito: true as const };
    }),

  actualizarEstadoOrdenCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenId: z.string().min(1), estado: z.enum(["pendiente", "ejecutada", "anulada"]) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativoCompras().doc(input.id).get();
      const existentes: z.infer<typeof ordenCompraSchema>[] = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      const actualizadas = existentes.map((o) => (o.id === input.ordenId ? { ...o, estado: input.estado } : o));
      await colComparativoCompras().doc(input.id).update({ ordenesCompra: actualizadas });
      return { exito: true as const };
    }),

  eliminarOrdenCompra: publicQuery
    .input(z.object({ id: z.string().min(1), ordenId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const doc = await colComparativoCompras().doc(input.id).get();
      const existentes: z.infer<typeof ordenCompraSchema>[] = Array.isArray(doc.data()?.ordenesCompra) ? doc.data()!.ordenesCompra : [];
      await colComparativoCompras()
        .doc(input.id)
        .update({ ordenesCompra: existentes.filter((o) => o.id !== input.ordenId) });
      return { exito: true as const };
    }),

  eliminar: publicQuery
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await colComparativoCompras().doc(input.id).delete();
      return { exito: true as const };
    }),
});
