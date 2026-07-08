import type { DatasetMetadata } from "@/lib/types";

type CompactDatasetOptions = {
  includeSampleRows?: boolean;
  maxSampleRows?: number;
  maxSampleValues?: number;
};

function compactValue(value: string | number | boolean | null) {
  if (typeof value !== "string") {
    return value;
  }

  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}

export function compactDatasetForAgent(dataset: DatasetMetadata, options: CompactDatasetOptions = {}) {
  const maxSampleValues = options.maxSampleValues ?? 3;
  const maxSampleRows = options.maxSampleRows ?? 3;

  return {
    id: dataset.id,
    name: dataset.name,
    fileName: dataset.fileName,
    sheetName: dataset.sheetName,
    rowCount: dataset.rowCount,
    sourceType: dataset.source?.type ?? "upload",
    columns: dataset.columns.map((column) => ({
      name: column.name,
      type: column.type,
      sampleValues: column.sampleValues.slice(0, maxSampleValues).map(compactValue),
    })),
    sampleRows: options.includeSampleRows
      ? dataset.sampleRows.slice(0, maxSampleRows).map((row) =>
          Object.fromEntries(Object.entries(row).map(([key, value]) => [key, compactValue(value)])),
        )
      : undefined,
  };
}
