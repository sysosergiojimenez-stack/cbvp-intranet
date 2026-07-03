import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Google Sheets Configuration
  GOOGLE_SERVICE_ACCOUNT_JSON: required("GOOGLE_SERVICE_ACCOUNT_JSON").replace(/^'|'$/g, ""),
  GEMINI_API_KEY: required("GEMINI_API_KEY").replace(/^'|'$/g, ""),
  SHEET_USUARIOS_ID: required("SHEET_USUARIOS_ID"),
  SHEET_GUARDIAS_ID: required("SHEET_GUARDIAS_ID"),
  DRIVE_FOLDER_ID: process.env.DRIVE_FOLDER_ID || "1RohFxOVDA8XwG4z4d5li-c3a-fAgcrRd",
  GCS_BUCKET_NAME: required("GCS_BUCKET_NAME"),
};
