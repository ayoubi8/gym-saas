// SheetJS glue (dynamic import so `xlsx` stays out of the first-load bundle).
// The client parses the workbook ONLY to drive mapping + stage raw rows;
// validation/commit truth is server-side (migration 0007).

import { AppError } from '../../lib/pg-errors';

export interface ParsedWorkbook {
  headers: string[];
  rows: Record<string, string>[];
}

type Cell = string | number | boolean | null | undefined;

/** First sheet -> trimmed headers + raw cell text (keyed by header). */
export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const XLSX = await import('xlsx');
  let matrix: Cell[][];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new AppError('BAD_FILE');
    matrix = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      raw: false,
      defval: '',
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('BAD_FILE');
  }

  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (headerIndex === -1) throw new AppError('BAD_FILE');

  const headers = matrix[headerIndex].map((cell) => String(cell ?? '').trim());
  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row.some((cell) => String(cell ?? '').trim() !== '')) continue;
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = String(row[index] ?? '').trim();
    });
    rows.push(record);
  }
  return { headers, rows };
}

/** Build + download the import template (localized headers, one empty row). */
export async function downloadTemplate(headers: string[], filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([headers, headers.map(() => '')]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Members');
  XLSX.writeFile(book, filename);
}

/** Failed-rows workbook as bytes (for the Storage upload + local download). */
export async function buildRowsBlob(
  headers: string[],
  rows: Record<string, string>[],
): Promise<Blob> {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Rows');
  const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Trigger a browser download for an in-memory file. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
