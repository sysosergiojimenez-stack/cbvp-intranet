import { Readable } from "stream";
import { getDriveClient } from "./googleAuth";

/**
 * Uploads a file to Google Drive and returns its public URL.
 */
export async function uploadFile(
  folderId: string,
  fileName: string,
  mimeType: string,
  base64Content: string
): Promise<string> {
  const drive = getDriveClient();

  const buffer = Buffer.from(base64Content, "base64");
  const stream = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id, webViewLink",
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error("Failed to upload file to Drive");
  }

  // Make the file viewable by anyone with the link
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return `https://drive.google.com/file/d/${fileId}/view`;
}
