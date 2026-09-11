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

  eliminar: publicQuery
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await colMaterialMenor().doc(input.id).delete();
      return { exito: true as const, mensaje: "Item eliminado" };
    }),

  // Marca/desmarca el checkbox de verificacion de un item, usado desde el
  // checklist de Control de Movil. No pisa el resto de los campos.
  marcarVerificado: publicQuery
    .input(z.object({ id: z.string(), verificado: z.boolean() }))
    .mutation(async ({ input }) => {
      await colMaterialMenor().doc(input.id).update({ verificado: input.verificado });
      return { exito: true as const };
    }),
});
