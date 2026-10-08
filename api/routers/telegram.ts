import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { generarCodigoVinculacion } from "../services/telegram";

export const telegramRouter = createRouter({
  // El usuario ya logueado (codigo viene del AuthContext del frontend, igual
  // que en el resto de la app -- ver ej. rolesGuardia.obtenerParaMiGuardia)
  // pide un codigo de un solo uso para vincular su Telegram: lo envia al bot
  // con /vincular <codigo>.
  generarCodigoVinculacion: publicQuery
    .input(z.object({ codigo: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const codigo = await generarCodigoVinculacion(input.codigo);
      return { exito: true as const, codigo };
    }),
});
