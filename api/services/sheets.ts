import { getSheetsClient } from "./googleAuth";

/**
 * Reads all data from a sheet range.
 */
function formatDateSerial(value: unknown): unknown {
  if (typeof value === "number" && value > 30000 && value < 80000) {
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + value * 24 * 60 * 60 * 1000);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return value;
}

export async function readSheet(spreadsheetId: string, range: string): Promise<unknown[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = response.data.values || [];
  return rows.map((row) => row.map((cell) => formatDateSerial(cell)));
}

/**
 * Appends a row to a sheet.
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  values: unknown[]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

/**
 * Updates a specific cell range.
 */
export async function updateRange(
  spreadsheetId: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/**
 * Finds a row index by matching a value in a specific column.
 * Returns the 1-based row index, or -1 if not found.
 */
export async function findRowIndex(
  spreadsheetId: string,
  range: string,
  columnIndex: number,
  matchValue: string
): Promise<number> {
  const data = await readSheet(spreadsheetId, range);
  for (let i = 1; i < data.length; i++) {
    const cellValue = data[i][columnIndex];
    if (cellValue && String(cellValue).trim() === matchValue) {
      return i + 1; // 1-based row index
    }
  }
  return -1;
}

/**
 * Deletes rows from a sheet by row number.
 */
export async function deleteRows(
  spreadsheetId: string,
  sheetId: number,
  rowIndices: number[]
): Promise<void> {
  const sheets = getSheetsClient();
  const requests = rowIndices
    .sort((a, b) => b - a) // Delete from bottom to top
    .map((rowIndex) => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS" as const,
          startIndex: rowIndex - 1, // 0-based
          endIndex: rowIndex,       // exclusive
        },
      },
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/**
 * Gets the sheet ID (numeric) by sheet name.
 */
export async function getSheetId(
  spreadsheetId: string,
  sheetName: string
): Promise<number> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const availableSheets = response.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
  const searchName = sheetName.trim();
  const sheet = response.data.sheets?.find(
    (s) => s.properties?.title?.trim() === searchName
  );
  if (!sheet?.properties?.sheetId) {
    throw new Error(
      `Sheet "${searchName}" not found. Available: [${availableSheets.join(", ")}]`
    );
  }
  return sheet.properties.sheetId;
}

/**
 * Clears a range in a sheet.
 */
export async function clearRange(
  spreadsheetId: string,
  range: string
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}
