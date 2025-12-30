import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, any>;
}

export interface ParseResult {
  rows: ParsedRow[];
  headers: string[];
  totalRows: number;
}

/**
 * Parse CSV from buffer or stream
 */
export async function parseCSV(input: Buffer | Readable): Promise<ParseResult> {
  let fileContent: string;

  if (Buffer.isBuffer(input)) {
    fileContent = input.toString('utf-8');
  } else {
    // Read stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    fileContent = Buffer.concat(chunks).toString('utf-8');
  }

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const headers = Object.keys(records[0] || {});
  const rows: ParsedRow[] = records.map((record: any, index: number) => ({
    rowNumber: index + 2, // +2 because index is 0-based and row 1 is header
    data: record,
  }));

  return {
    rows,
    headers,
    totalRows: rows.length,
  };
}

/**
 * Parse Excel from buffer or stream
 */
export async function parseExcel(input: Buffer | Readable): Promise<ParseResult> {
  let buffer: Buffer;

  if (Buffer.isBuffer(input)) {
    buffer = input;
  } else {
    // Read stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (jsonData.length === 0) {
    return {
      rows: [],
      headers: [],
      totalRows: 0,
    };
  }

  const headers = Object.keys(jsonData[0]);
  const rows: ParsedRow[] = jsonData.map((record, index) => ({
    rowNumber: index + 2, // +2 because index is 0-based and row 1 is header
    data: record,
  }));

  return {
    rows,
    headers,
    totalRows: rows.length,
  };
}

/**
 * Parse file based on extension and mime type
 */
export async function parseFile(
  input: Buffer | Readable,
  fileExtOrMime?: string
): Promise<ParseResult> {
  // Determine file type from extension or mime type
  const fileType = fileExtOrMime?.toLowerCase();
  const isCsv =
    fileType?.includes('csv') ||
    fileType?.endsWith('.csv') ||
    fileType === 'text/csv';
  const isExcel =
    fileType?.includes('xlsx') ||
    fileType?.includes('xls') ||
    fileType?.includes('spreadsheet') ||
    fileType?.endsWith('.xlsx') ||
    fileType?.endsWith('.xls');

  if (isCsv) {
    return parseCSV(input);
  } else if (isExcel) {
    return parseExcel(input);
  } else {
    throw new Error(
      `Unsupported file format: ${fileType}. Only CSV and Excel files are supported.`
    );
  }
}

/**
 * Generate CSV from data
 */
export function generateCSV(
  data: Record<string, any>[],
  headers: string[]
): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }

  const csvRows: string[] = [];

  // Add header
  csvRows.push(headers.join(','));

  // Add data rows
  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header] ?? '';
      // Escape values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Generate Excel from data
 */
export function generateExcel(
  data: Record<string, any>[],
  headers: string[]
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
