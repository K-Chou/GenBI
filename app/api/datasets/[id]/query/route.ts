import { NextResponse } from "next/server";
import { aggregateRows, queryDetailRows } from "@/lib/dashboard-query";
import { getDataset } from "@/lib/file-store";
import type { DashboardDataFilter, DashboardDataView, DashboardDetailView } from "@/lib/types";

type DatasetQueryRequest =
  | {
      kind: "view";
      view: DashboardDataView;
    }
  | {
      detailView: DashboardDetailView;
      kind: "detail";
      runtimeFilters?: DashboardDataFilter[];
    };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dataset = await getDataset(id);

  if (!dataset) {
    return NextResponse.json({ error: "未找到 Dataset。" }, { status: 404 });
  }

  const body = (await request.json()) as DatasetQueryRequest;

  if (body.kind === "detail") {
    return NextResponse.json({
      rows: queryDetailRows({
        dataset,
        detailView: body.detailView,
        runtimeFilters: body.runtimeFilters,
      }),
    });
  }

  return NextResponse.json({
    rows: aggregateRows(dataset.rows ?? dataset.sampleRows, body.view),
  });
}
