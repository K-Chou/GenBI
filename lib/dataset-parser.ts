import * as XLSX from "xlsx";
import type { ColumnType, DatasetColumn, DatasetMetadata } from "@/lib/types";

const SAMPLE_ROW_LIMIT = 25;
const SAMPLE_VALUE_LIMIT = 6;

type CellValue = string | number | boolean | null;

function normalizeCell(value: unknown): CellValue {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).trim();
}

function inferType(values: CellValue[]): ColumnType {
  const presentValues = values.filter((value) => value !== null);

  if (presentValues.length === 0) {
    return "unknown";
  }

  const isBoolean = presentValues.every(
    (value) =>
      typeof value === "boolean" ||
      ["true", "false", "yes", "no"].includes(String(value).toLowerCase()),
  );

  if (isBoolean) {
    return "boolean";
  }

  const isNumber = presentValues.every((value) => {
    if (typeof value === "number") {
      return Number.isFinite(value);
    }

    return String(value).trim() !== "" && Number.isFinite(Number(value));
  });

  if (isNumber) {
    return "number";
  }

  const isDate = presentValues.every((value) => {
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) && /[-/年月日]|^\d{4}\d{2}\d{2}$/.test(String(value));
  });

  if (isDate) {
    return "date";
  }

  return "string";
}

function getColumns(rows: Record<string, unknown>[]): string[] {
  const names = new Set<string>();

  for (const row of rows) {
    Object.keys(row).forEach((key) => {
      if (key.trim()) {
        names.add(key.trim());
      }
    });
  }

  return Array.from(names);
}

function buildColumns(rows: Record<string, CellValue>[], columnNames: string[]): DatasetColumn[] {
  return columnNames.map((name) => {
    const values = rows.map((row) => row[name] ?? null);
    const sampleValues = Array.from(
      new Set(
        values
          .filter((value) => value !== null)
          .map((value) => String(value))
          .filter(Boolean),
      ),
    ).slice(0, SAMPLE_VALUE_LIMIT);

    return {
      name,
      type: inferType(values),
      sampleValues,
    };
  });
}

export async function parseDatasetFile(file: File): Promise<DatasetMetadata> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, {
    cellDates: true,
    raw: false,
    type: "buffer",
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("上传文件中没有找到 sheet。");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const columnNames = getColumns(rawRows);
  const normalizedRows = rawRows.map((row) => {
    return columnNames.reduce<Record<string, CellValue>>((acc, column) => {
      acc[column] = normalizeCell(row[column]);
      return acc;
    }, {});
  });

  const id = crypto.randomUUID();

  return {
    id,
    name: file.name.replace(/\.(xlsx|xls|csv)$/i, ""),
    fileName: file.name,
    sheetName,
    uploadedAt: new Date().toISOString(),
    rowCount: normalizedRows.length,
    columns: buildColumns(normalizedRows, columnNames),
    sampleRows: normalizedRows.slice(0, SAMPLE_ROW_LIMIT),
  };
}
