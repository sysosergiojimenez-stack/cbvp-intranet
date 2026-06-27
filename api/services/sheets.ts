import { getSheetsClient } from "./googleAuth";

/**
 * Reads all data from a sheet range.
 */
export async function readSheet(spreadsheetId: string, range: string): Promise<unknown[][]> {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return response.data.values || [];
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
  const sheet = response.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId) {
    throw new Error(`Sheet "${sheetName}" not found`);
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
