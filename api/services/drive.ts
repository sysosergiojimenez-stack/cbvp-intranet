import { getGoogleAuth } from "./googleAuth";

/**
 * Uploads a file to Google Drive using REST API directly.
 * Avoids googleapis streaming issues in bundled environments.
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

  const buffer = Buffer.from(base64Content, "base64");

  // Build multipart request body manually
  const boundary = "-------314159265358979323846";
  const metadata = JSON.stringify({
    name: fileName,
    mimeType,
    parents: folderId ? [folderId] : undefined,
  });

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(`${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`),
    Buffer.from(`${delimiter}Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
    buffer,
    Buffer.from(closeDelimiter),
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
  await fetch(
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

  return `https://drive.google.com/file/d/${fileId}/view`;
}
