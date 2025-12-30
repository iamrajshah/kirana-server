import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import fs from 'fs';

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
 * Parse CSV file
 */
export async function parseCSV(filePath: string): Promise<ParseResult> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

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
 * Parse Excel file
 */
export async function parseExcel(filePath: string): Promise<ParseResult> {
  const workbook = XLSX.readFile(filePath);
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
 * Parse file based on extension
 */
export async function parseFile(filePath: string): Promise<ParseResult> {
  const extension = filePath.toLowerCase().split('.').pop();

  if (extension === 'csv') {
    return parseCSV(filePath);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcel(filePath);
  } else {
    throw new Error(
      `Unsupported file format: ${extension}. Only CSV and Excel files are supported.`
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
