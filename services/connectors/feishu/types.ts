import type { ColumnType } from "@/lib/types";

export type FeishuAccessToken = {
  token: string;
  expiresAt?: string;
};

export type FeishuBitableRef = {
  appToken: string;
  sourceUrl: string;
  tableId?: string;
  viewId?: string;
};

export type FeishuBitableTable = {
  tableId: string;
  name: string;
  revision?: number;
};

export type FeishuBitableField = {
  fieldId: string;
  fieldName: string;
  type: number;
  normalizedType: ColumnType;
};

export type FeishuBitableRecord = {
  recordId: string;
  fields: Record<string, unknown>;
};

export type FeishuSyncResult = {
  datasetId: string;
  appToken: string;
  tableId: string;
  tableName: string;
  rowCount: number;
  syncedAt: string;
};
