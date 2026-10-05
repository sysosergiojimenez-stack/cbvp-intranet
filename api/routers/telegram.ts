import { createRouter, authedProcedure } from "../middleware";
import { generarCodigoVinculacion } from "../services/telegram";

export const telegramRouter = createRouter({
  // El usuario ya logueado pide un codigo de un solo uso para vincular su
  // Telegram: lo envia al bot con /vincular <codigo>.
  generarCodigoVinculacion: authedProcedure.mutation(async ({ ctx }) => {
    const codigo = await generarCodigoVinculacion(ctx.codigoUsuario);
    return { exito: true as const, codigo };
  }),
});
