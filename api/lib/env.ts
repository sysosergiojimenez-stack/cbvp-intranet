import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),

  // Google Sheets Configuration
  GOOGLE_SERVICE_ACCOUNT_JSON: required("GOOGLE_SERVICE_ACCOUNT_JSON").replace(/^'|'$/g, ""),
  GEMINI_API_KEY: required("GEMINI_API_KEY").replace(/^'|'$/g, ""),
  SHEET_USUARIOS_ID: required("SHEET_USUARIOS_ID"),
  SHEET_GUARDIAS_ID: required("SHEET_GUARDIAS_ID"),
  DRIVE_FOLDER_ID: required("DRIVE_FOLDER_ID"),
  GCS_BUCKET_NAME: required("GCS_BUCKET_NAME"),
};
