import { google } from "googleapis";
import { env } from "../lib/env";

/**
 * Creates an authenticated Google API client using a service account.
 *
 * To set up:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project (or use existing)
 * 3. Enable Google Sheets API and Google Drive API
 * 4. Go to IAM & Admin > Service Accounts
 * 5. Create a service account
 * 6. Generate a JSON key
 * 7. Copy the key JSON content
 * 8. Set it as GOOGLE_SERVICE_ACCOUNT_JSON in your .env file
 * 9. Share your Google Sheets with the service account email
 */

let authClient: google.auth.GoogleAuth | null = null;

export function getGoogleAuth() {
  if (authClient) return authClient;

  const credentialsJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!credentialsJson) {
    // Fallback: try to use API key (read-only, limited)
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON not configured. " +
        "Set the service account JSON key in your .env file."
    );
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/devstorage.full_control",
    ],
  });

  return authClient;
}

export function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

export function getDriveClient() {
  return google.drive({ version: "v3", auth: getGoogleAuth() });
}
