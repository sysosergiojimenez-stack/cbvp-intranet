import { getGoogleAuth } from "./googleAuth";

/**
 * Uploads a file to Google Drive using REST API multipart upload.
 */
export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  base64Content: string
): Promise<string> {
  // Get access token from service account
  const auth = getGoogleAuth();
  const token = await auth.getAccessToken();
  if (!token) {
    throw new Error("Failed to get access token for Drive upload");
  }

  // Decode base64 to binary
  const fileBuffer = Buffer.from(base64Content, "base64");

  // Build multipart/related body following Google Drive API spec
  const boundary = "cbvp_boundary_" + Date.now();

  const metadataPart = JSON.stringify({
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  });

  // Build multipart body as Buffers to handle binary correctly
  const crlf = Buffer.from("\r\n");
  const dashBoundary = Buffer.from(`--${boundary}`);
  const metadataHeaders = Buffer.from(
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}`
  );
  const fileHeaders = Buffer.from(
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const closeDelimiter = Buffer.from(`--${boundary}--`);

  const multipartBody = Buffer.concat([
    dashBoundary, crlf,
    metadataHeaders, crlf,
    dashBoundary, crlf,
    fileHeaders,
    fileBuffer, crlf,
    closeDelimiter,
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive upload failed: ${response.status} - ${errorText}`);
  }

  const result = (await response.json()) as { id: string };
  const fileId = result.id;

  // Make the file viewable by anyone with the link
  const permResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    }
  );

  if (!permResponse.ok) {
    console.warn("[Drive] Failed to set permission:", await permResponse.text());
  }

  return `https://drive.google.com/file/d/${fileId}/view`;
}
