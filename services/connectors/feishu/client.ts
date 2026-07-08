import type {
  FeishuAccessToken,
  FeishuBitableField,
  FeishuBitableRecord,
  FeishuBitableTable,
} from "@/services/connectors/feishu/types";

const FEISHU_OPEN_API_BASE_URL = "https://open.feishu.cn/open-apis";

type FeishuListResponse<T> = {
  code: number;
  msg?: string;
  data?: {
    has_more?: boolean;
    items?: T[];
    page_token?: string;
    total?: number;
  };
};

function getFriendlyFeishuError(message?: string) {
  if (!message) {
    return "飞书 Bitable API 请求失败。";
  }

  if (/NOTEXIST/i.test(message)) {
    return [
      "飞书 Base 不存在或当前应用没有访问权限。",
      "请确认：1. 链接是飞书多维表格原始链接；2. .env.local 中的 FEISHU_APP_ID/FEISHU_APP_SECRET 属于同一租户；3. 该飞书应用已被添加为这个 Base 的协作者，且应用权限包含 bitable 读权限。",
    ].join("");
  }

  if (/permission|forbidden|denied|no auth/i.test(message)) {
    return "飞书应用权限不足，请在飞书开放平台为应用开通多维表格读取权限，并把应用添加为目标 Base 的协作者。";
  }

  return message;
}

type RawTable = {
  name: string;
  revision?: number;
  table_id: string;
};

type RawField = {
  field_id: string;
  field_name: string;
  type: number;
};

type RawRecord = {
  fields: Record<string, unknown>;
  record_id: string;
};

function normalizeFieldType(type: number): FeishuBitableField["normalizedType"] {
  if (type === 2) {
    return "number";
  }

  if ([5, 1001, 1002].includes(type)) {
    return "date";
  }

  if (type === 7) {
    return "boolean";
  }

  return "string";
}

export class FeishuBitableClient {
  constructor(private readonly accessToken: FeishuAccessToken) {}

  private async get<T>(path: string, searchParams?: Record<string, string | number | undefined>) {
    const url = new URL(`${FEISHU_OPEN_API_BASE_URL}${path}`);

    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken.token}`,
      },
    });
    const payload = (await response.json()) as FeishuListResponse<T>;

    if (!response.ok || payload.code !== 0) {
      throw new Error(getFriendlyFeishuError(payload.msg));
    }

    return payload.data ?? {};
  }

  async listTables(appToken: string): Promise<FeishuBitableTable[]> {
    const tables: FeishuBitableTable[] = [];
    let pageToken: string | undefined;

    do {
      const data = await this.get<RawTable>(`/bitable/v1/apps/${appToken}/tables`, {
        page_size: 100,
        page_token: pageToken,
      });

      tables.push(
        ...(data.items ?? []).map((item) => ({
          name: item.name,
          revision: item.revision,
          tableId: item.table_id,
        })),
      );
      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);

    return tables;
  }

  async listFields(appToken: string, tableId: string): Promise<FeishuBitableField[]> {
    const fields: FeishuBitableField[] = [];
    let pageToken: string | undefined;

    do {
      const data = await this.get<RawField>(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        page_size: 100,
        page_token: pageToken,
      });

      fields.push(
        ...(data.items ?? []).map((item) => ({
          fieldId: item.field_id,
          fieldName: item.field_name,
          normalizedType: normalizeFieldType(item.type),
          type: item.type,
        })),
      );
      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);

    return fields;
  }

  async listRecords(params: {
    appToken: string;
    tableId: string;
    pageSize?: number;
    viewId?: string;
  }): Promise<FeishuBitableRecord[]> {
    const records: FeishuBitableRecord[] = [];
    let pageToken: string | undefined;

    do {
      const data = await this.get<RawRecord>(
        `/bitable/v1/apps/${params.appToken}/tables/${params.tableId}/records`,
        {
          page_size: params.pageSize ?? 500,
          page_token: pageToken,
          view_id: params.viewId,
        },
      );

      records.push(
        ...(data.items ?? []).map((item) => ({
          fields: item.fields,
          recordId: item.record_id,
        })),
      );
      pageToken = data.has_more ? data.page_token : undefined;
    } while (pageToken);

    return records;
  }
}
