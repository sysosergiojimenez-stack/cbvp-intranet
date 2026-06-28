import { getGoogleAuth } from "./googleAuth";

/**
 * Uploads a file to Google Cloud Storage (GCS) using REST API.
 * GCS works perfectly with service accounts (unlike Drive which requires user quota).
 */
export async function uploadFile(
  bucketName: string,
  fileName: string,
  mimeType: string,
  base64Content: string
): Promise<string> {
  // Get access token from service account
  const auth = getGoogleAuth();
  const token = await auth.getAccessToken();
  if (!token) {
    throw new Error("Failed to get access token for GCS upload");
  }

  // Decode base64 to binary
  const fileBuffer = Buffer.from(base64Content, "base64");

  // Upload to GCS via REST API
  const encodedFileName = encodeURIComponent(fileName);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodedFileName}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GCS upload failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as { name: string };

  // Make the file publicly readable
  const aclUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodedFileName}/acl`;
  await fetch(aclUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity: "allUsers", role: "READER" }),
  });

  // Return public URL
  return `https://storage.googleapis.com/${bucketName}/${encodedFileName}`;
}
