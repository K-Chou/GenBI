import { saveDataset } from "@/lib/file-store";
import type { DatasetMetadata, DatasetSyncPolicy } from "@/lib/types";
import { getFeishuTenantAccessToken } from "@/services/connectors/feishu/auth";
import { FeishuBitableClient } from "@/services/connectors/feishu/client";
import type {
  FeishuBitableField,
  FeishuBitableRecord,
  FeishuSyncResult,
} from "@/services/connectors/feishu/types";
import { parseFeishuBitableUrl } from "@/services/connectors/feishu/url";

const SAMPLE_ROW_LIMIT = 25;
const SAMPLE_VALUE_LIMIT = 6;

function normalizeObjectValue(value: Record<string, unknown>) {
  if ("text" in value && typeof value.text === "string") {
    return value.text;
  }

  if ("name" in value && typeof value.name === "string") {
    return value.name;
  }

  if ("en_name" in value && typeof value.en_name === "string") {
    return value.en_name;
  }

  if ("link" in value && typeof value.link === "string") {
    return value.link;
  }

  return JSON.stringify(value);
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCell(item)).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return normalizeObjectValue(value as Record<string, unknown>);
  }

  return String(value).trim();
}

function buildDatasetMetadataFromBitable(params: {
  appToken: string;
  existingDataset?: DatasetMetadata;
  fields: FeishuBitableField[];
  records: FeishuBitableRecord[];
  sourceUrl: string;
  tableId: string;
  tableName: string;
  viewId?: string;
}): DatasetMetadata {
  const rows = params.records.map((record) => {
    return params.fields.reduce<Record<string, string | number | boolean | null>>((acc, field) => {
      acc[field.fieldName] = normalizeCell(record.fields[field.fieldName]);
      return acc;
    }, {});
  });

  const now = new Date().toISOString();
  const syncPolicy = params.existingDataset?.source?.type === "feishu_bitable" ? params.existingDataset.source.syncPolicy : undefined;
  const intervalSeconds = syncPolicy?.enabled ? syncPolicy.intervalSeconds : undefined;

  return {
    columns: params.fields.map((field) => ({
      name: field.fieldName,
      sampleValues: Array.from(
        new Set(
          rows
            .map((row) => row[field.fieldName])
            .filter((value) => value !== null)
            .map((value) => String(value)),
        ),
      ).slice(0, SAMPLE_VALUE_LIMIT),
      type: field.normalizedType,
    })),
    fileName: `feishu://${params.appToken}/${params.tableId}`,
    id: params.existingDataset?.id ?? crypto.randomUUID(),
    name: params.existingDataset?.name ?? params.tableName,
    rowCount: rows.length,
    rows,
    sampleRows: rows.slice(0, SAMPLE_ROW_LIMIT),
    source: {
      appToken: params.appToken,
      lastSyncedAt: now,
      nextSyncAt: intervalSeconds ? new Date(Date.now() + intervalSeconds * 1000).toISOString() : undefined,
      sourceUrl: params.sourceUrl,
      syncPolicy,
      tableId: params.tableId,
      tableName: params.tableName,
      type: "feishu_bitable",
      viewId: params.viewId,
    },
    sheetName: params.tableId,
    uploadedAt: params.existingDataset?.uploadedAt ?? now,
    updatedAt: now,
  };
}

export async function syncFeishuBitableToDataset(params: {
  bitableUrl: string;
  existingDataset?: DatasetMetadata;
  syncPolicy?: DatasetSyncPolicy;
  tableId?: string;
  viewId?: string;
}): Promise<{ dataset: DatasetMetadata; sync: FeishuSyncResult }> {
  const ref = parseFeishuBitableUrl(params.bitableUrl);
  const accessToken = await getFeishuTenantAccessToken();
  const client = new FeishuBitableClient(accessToken);
  const tables = await client.listTables(ref.appToken);
  const targetTableId = params.tableId ?? ref.tableId;
  const table = targetTableId ? tables.find((item) => item.tableId === targetTableId) : tables[0];

  if (!table) {
    throw new Error("未找到可同步的飞书多维表格数据表。");
  }

  const fields = await client.listFields(ref.appToken, table.tableId);
  const records = await client.listRecords({
    appToken: ref.appToken,
    tableId: table.tableId,
    viewId: params.viewId ?? ref.viewId,
  });
  const dataset = buildDatasetMetadataFromBitable({
    appToken: ref.appToken,
    existingDataset: params.existingDataset
      ? {
          ...params.existingDataset,
          source:
            params.existingDataset.source?.type === "feishu_bitable"
              ? {
                  ...params.existingDataset.source,
                  syncPolicy: params.syncPolicy ?? params.existingDataset.source.syncPolicy,
                }
              : params.existingDataset.source,
        }
      : undefined,
    fields,
    records,
    sourceUrl: ref.sourceUrl,
    tableId: table.tableId,
    tableName: table.name,
    viewId: params.viewId ?? ref.viewId,
  });

  await saveDataset(dataset);

  return {
    dataset,
    sync: {
      appToken: ref.appToken,
      datasetId: dataset.id,
      rowCount: dataset.rowCount,
      syncedAt: dataset.updatedAt ?? dataset.uploadedAt,
      tableId: table.tableId,
      tableName: table.name,
    },
  };
}
