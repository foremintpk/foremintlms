/**
 * CSV generation for admin exports. Pure — unit tested.
 *
 * Spreadsheet apps execute cells that start with = + - @ (and tab/CR) as
 * formulas ("CSV injection"). Text values starting with those characters are
 * prefixed with a single quote so they open as plain text. Numbers are left
 * untouched so negative amounts stay numeric.
 */

export type CsvValue = string | number | boolean | null | undefined | Date;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(values: CsvValue[]): string {
  return values.map(escapeCsvCell).join(",");
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [csvRow(columns.map((c) => c.header))];
  for (const row of rows) lines.push(csvRow(columns.map((c) => c.value(row))));
  // BOM so Excel reads UTF-8 names correctly; CRLF per RFC 4180.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvFileName(report: string, from: Date | null, to: Date | null): string {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const range = from && to ? `-${d(from)}-to-${d(to)}` : "";
  return `foremint-${report}${range}.csv`;
}
