export const TIPOS_NOTIFICACION = [
  "sistema",
  "rol_guardia",
  "informe_incendio",
  "anuncio",
] as const;

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export interface NotificacionResumen {
  id: string;
  tipo: TipoNotificacion | string;
  titulo: string;
  mensaje: string;
  link: string;
  fechaCreacion: string;
  leida: boolean;
}
