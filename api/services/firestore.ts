import { Firestore } from "@google-cloud/firestore";
import { env } from "../lib/env";

let firestoreClient: Firestore | null = null;

// El proyecto de GCP donde vive la base Firestore de esta app. NO se infiere
// del propio JSON de la cuenta de servicio: esa cuenta (GOOGLE_SERVICE_ACCOUNT_JSON)
// pertenece historicamente a otro proyecto GCP ("kompany-377919") reusado
// para Sheets/Drive/Storage via permisos a nivel de archivo/bucket, no de
// proyecto. Firestore si es un recurso de proyecto, asi que la cuenta de
// servicio fue autorizada explicitamente (roles/datastore.user) sobre este
// proyecto, y hay que apuntarle a el a mano.
const FIRESTORE_PROJECT_ID = "cbvp-intranet";

/**
 * Creates an authenticated Firestore client using the same service account
 * JSON key already used for Sheets/Drive/Storage (GOOGLE_SERVICE_ACCOUNT_JSON),
 * pointed explicitly at FIRESTORE_PROJECT_ID.
 */
export function getFirestoreClient(): Firestore {
  if (firestoreClient) return firestoreClient;

  const credentialsJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON not configured. " +
        "Set the service account JSON key in your .env file."
    );
  }

  let raw: { client_email?: string; private_key?: string };
  try {
    raw = JSON.parse(credentialsJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  firestoreClient = new Firestore({
    projectId: FIRESTORE_PROJECT_ID,
    credentials: { client_email: raw.client_email, private_key: raw.private_key },
  });

  return firestoreClient;
}
