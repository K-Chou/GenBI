import { NextResponse } from "next/server";
import { getDataset } from "@/lib/file-store";
import { syncFeishuBitableToDataset } from "@/services/connectors/feishu";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const dataset = await getDataset(id);

    if (!dataset) {
      return NextResponse.json({ error: "未找到底表数据。" }, { status: 404 });
    }

    if (dataset.source?.type !== "feishu_bitable") {
      return NextResponse.json({ error: "当前底表数据不是飞书多维表格数据源。" }, { status: 400 });
    }

    const result = await syncFeishuBitableToDataset({
      bitableUrl: dataset.source.sourceUrl,
      existingDataset: dataset,
      syncPolicy: dataset.source.syncPolicy,
      tableId: dataset.source.tableId,
      viewId: dataset.source.viewId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "底表数据同步失败。" },
      { status: 500 },
    );
  }
}
