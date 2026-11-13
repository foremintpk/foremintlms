import { describe, expect, it } from "vitest";
import { csvFileName, escapeCsvCell, toCsv } from "@/lib/services/admin/csv";

describe("escapeCsvCell", () => {
  it("leaves plain text untouched", () => {
    expect(escapeCsvCell("Amazon FBA")).toBe("Amazon FBA");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(escapeCsvCell("+1 555")).toBe("'+1 555");
    expect(escapeCsvCell("-cmd")).toBe("'-cmd");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("\tx")).toBe("'\tx");
  });

  it("keeps numbers numeric, including negatives", () => {
    expect(escapeCsvCell(-1250)).toBe("-1250");
    expect(escapeCsvCell(49.5)).toBe("49.5");
    expect(escapeCsvCell(Number.NaN)).toBe("");
  });

  it("formats null, booleans and dates", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
});

describe("toCsv", () => {
  it("writes a BOM, header and CRLF rows", () => {
    const csv = toCsv(
      [
        { header: "Name", value: (r: { name: string; n: number }) => r.name },
        { header: "Count", value: (r: { name: string; n: number }) => r.n },
      ],
      [
        { name: "Ada, L.", n: 3 },
        { name: "=evil", n: -2 },
      ],
    );
    expect(csv).toBe('﻿Name,Count\r\n"Ada, L.",3\r\n\'=evil,-2\r\n');
  });
});

describe("csvFileName", () => {
  it("includes the date range when given", () => {
    expect(csvFileName("payments", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T23:59:59Z"))).toBe(
      "foremint-payments-2026-01-01-to-2026-01-31.csv",
    );
    expect(csvFileName("students", null, null)).toBe("foremint-students.csv");
  });
});
