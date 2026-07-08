import { NextResponse } from "next/server";
import type { DatasetSyncPolicy } from "@/lib/types";
import { syncFeishuBitableToDataset } from "@/services/connectors/feishu";

type FeishuDataSourceRequest = {
  bitableUrl: string;
  syncPolicy?: DatasetSyncPolicy;
  tableId?: string;
  viewId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeishuDataSourceRequest;

    if (!body.bitableUrl?.trim()) {
      return NextResponse.json({ error: "缺少飞书多维表格链接。" }, { status: 400 });
    }

    const result = await syncFeishuBitableToDataset({
      bitableUrl: body.bitableUrl,
      syncPolicy: body.syncPolicy,
      tableId: body.tableId,
      viewId: body.viewId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "飞书数据源同步失败。" },
      { status: 500 },
    );
  }
}
