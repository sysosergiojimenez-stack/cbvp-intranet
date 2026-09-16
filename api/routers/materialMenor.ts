import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getFirestoreClient } from "../services/firestore";
import { uploadFile } from "../services/storage";
import { env } from "../lib/env";
import { CATEGORIAS_MATERIAL_MENOR } from "@contracts/materialMenor";

function colMaterialMenor() {
  return getFirestoreClient().collection("materialMenor");
}

function generateId(): string {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
}

async function subirImagenSiCorresponde(
  imagenBase64: string | undefined,
  imagenMimeType: string | undefined
): Promise<string | undefined> {
  if (!imagenBase64 || !env.GCS_BUCKET_NAME) return undefined;
  const ext = (imagenMimeType || "image/jpeg").split("/")[1] || "jpg";
  return uploadFile(
    env.GCS_BUCKET_NAME,
    `material_menor_${generateId()}.${ext}`,
    imagenMimeType || "image/jpeg",
    imagenBase64
  );
}

const camposMaterial = z.object({
  categoria: z.enum(CATEGORIAS_MATERIAL_MENOR),
  usuario: z.string(),
  fecha: z.string(),
  item: z.string(),
  marca: z.string(),
  modelo: z.string(),
  cantidad: z.string(),
  precioUnitario: z.string(),
  especificaciones: z.string(),
  serialCodigo: z.string(),
  ubicacion: z.string(),
  observaciones: z.string(),
  // esKit marca un item como contenedor (bolson/kit) que agrupa otros
  // materiales; kitPadreId, cuando esta seteado, indica que este material
  // vive dentro de ese kit (en vez de suelto en un sitio). Un item nunca
  // es ambas cosas a la vez.
  esKit: z.boolean().optional().default(false),
  kitPadreId: z.string().optional().default(''),
});

export const materialMenorRouter = createRouter({
  listado: publicQuery.query(async () => {
    const snapshot = await colMaterialMenor().get();
    const items = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.marcaTemporal || "").localeCompare(String(a.marcaTemporal || "")));
    return { exito: true as const, items };
  }),

  crear: publicQuery
    .input(
      camposMaterial.extend({
        imagenBase64: z.string().optional(),
        imagenMimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { imagenBase64, imagenMimeType, ...campos } = input;
      const imagen = await subirImagenSiCorresponde(imagenBase64, imagenMimeType);
      const ahora = new Date();
      const marcaTemporal = `${ahora.toLocaleDateString("es-ES")} ${ahora.toLocaleTimeString("es-ES")}`;

      const ref = await colMaterialMenor().add({
        ...campos,
        imagen: imagen || "",
        marcaTemporal,
      });
      return { exito: true as const, id: ref.id };
    }),

  editar: publicQuery
    .input(
      camposMaterial.extend({
        id: z.string(),
        imagenBase64: z.string().optional(),
        imagenMimeType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, imagenBase64, imagenMimeType, ...campos } = input;
      const imagenNueva = await subirImagenSiCorresponde(imagenBase64, imagenMimeType);
      const actualizacion: Record<string, unknown> = { ...campos };
      if (imagenNueva) actualizacion.imagen = imagenNueva;

      await colMaterialMenor().doc(id).update(actualizacion);
      return { exito: true as const, mensaje: "Item actualizado" };
    }),

  // Si el item es un kit, borra tambien los materiales que viven dentro
  // (kitPadreId apuntando a este id) en la misma operacion.
  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const hijosSnapshot = await colMaterialMenor().where("kitPadreId", "==", input.id).get();
      if (hijosSnapshot.empty) {
        await colMaterialMenor().doc(input.id).delete();
      } else {
        const batch = getFirestoreClient().batch();
        hijosSnapshot.forEach((doc) => batch.delete(doc.ref));
        batch.delete(colMaterialMenor().doc(input.id));
        await batch.commit();
      }
      return { exito: true as const, mensaje: "Item eliminado" };
    }),
});
