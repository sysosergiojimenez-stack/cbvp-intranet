import { getFirestoreClient } from "./firestore";
import type { TipoNotificacion } from "@contracts/notificaciones";

export function colNotificaciones() {
  return getFirestoreClient().collection("notificaciones");
}

/**
 * Crea una notificacion nueva. destinatarioCodigo vacio ("") significa
 * "para todos" (broadcast) -- se resuelve al leer, no al escribir, para no
 * tener que conocer de antemano el listado completo de personal.
 *
 * Los errores se capturan y se ignoran silenciosamente: crear una
 * notificacion es un efecto secundario de otra accion (guardar una salida,
 * asignar un rol, etc.) y nunca debe hacer fallar esa accion principal si
 * Firestore tiene un problema puntual.
 */
export async function crearNotificacion(opts: {
  destinatarioCodigo?: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  link?: string;
  creadaPor?: string;
}): Promise<void> {
  try {
    await colNotificaciones().add({
      destinatarioCodigo: (opts.destinatarioCodigo || "").trim(),
      tipo: opts.tipo,
      titulo: opts.titulo,
      mensaje: opts.mensaje,
      link: opts.link || "",
      creadaPor: opts.creadaPor || "sistema",
      fechaCreacion: new Date().toISOString(),
      leidoPor: [] as string[],
    });
  } catch (err) {
    console.error("[notificaciones] No se pudo crear la notificacion:", err instanceof Error ? err.message : err);
  }
}
