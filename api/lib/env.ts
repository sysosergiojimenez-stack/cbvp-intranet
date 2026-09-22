import "dotenv/config";

/**
 * Reads an environment variable. Never throws — returns empty string if missing.
 * This prevents the container from crashing on startup due to missing env vars.
 */
function envVar(name: string): string {
  return process.env[name] ?? "";
}

// Valor de respaldo si VAPID_SUBJECT no esta configurado -- mailto es
// obligatorio para el protocolo Web Push, cualquier direccion de contacto
// del cuartel sirve.
const ORGANIZACION_EMAIL_FALLBACK = "k20mercado4.cbvp@gmail.com";

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Google Sheets Configuration
  GOOGLE_SERVICE_ACCOUNT_JSON: envVar("GOOGLE_SERVICE_ACCOUNT_JSON").replace(/^'|'$/g, ""),
  GEMINI_API_KEY: envVar("GEMINI_API_KEY").replace(/^'|'$/g, ""),
  SHEET_USUARIOS_ID: envVar("SHEET_USUARIOS_ID"),
  SHEET_GUARDIAS_ID: envVar("SHEET_GUARDIAS_ID"),
  DRIVE_FOLDER_ID: envVar("DRIVE_FOLDER_ID") || "1RohFxOVDA8XwG4z4d5li-c3a-fAgcrRd",
  GCS_BUCKET_NAME: envVar("GCS_BUCKET_NAME"),

  // Web Push (notificaciones). VAPID_PUBLIC_KEY se expone al cliente para
  // suscribirse; VAPID_PRIVATE_KEY es secreta, solo el servidor la usa para
  // firmar los envios.
  VAPID_PUBLIC_KEY: envVar("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: envVar("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: envVar("VAPID_SUBJECT") || `mailto:${ORGANIZACION_EMAIL_FALLBACK}`,
  // Secreto compartido para autenticar al job de Cloud Scheduler que dispara
  // los recordatorios de guardia (no es un usuario de la app, no tiene JWT).
  CRON_SECRET: envVar("CRON_SECRET"),
};
