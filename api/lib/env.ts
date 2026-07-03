import "dotenv/config";

/**
 * Reads an environment variable. Never throws — returns empty string if missing.
 * This prevents the container from crashing on startup due to missing env vars.
 */
function envVar(name: string): string {
  return process.env[name] ?? "";
}

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
};
