import { NextResponse } from "next/server";
import { aggregateRows, queryDetailRows } from "@/lib/dashboard-query";
import { getDataset } from "@/lib/file-store";
import type {
  DashboardDataFilter,
  DashboardDataSource,
  DashboardDataView,
  DashboardDetailView,
  DatasetMetadata,
} from "@/lib/types";
import { syncFeishuBitableToDataset } from "@/services/connectors/feishu";

type MultiDatasetQueryRequest =
  | {
      dataSources: DashboardDataSource[];
      kind: "views";
      syncDue?: boolean;
      views: DashboardDataView[];
    }
  | {
      dataSources: DashboardDataSource[];
      detailView: DashboardDetailView;
      kind: "detail";
      runtimeFilters?: DashboardDataFilter[];
      syncDue?: boolean;
    };

function isSyncDue(dataset: DatasetMetadata) {
  if (dataset.source?.type !== "feishu_bitable" || !dataset.source.syncPolicy?.enabled) {
    return false;
  }

  if (!dataset.source.nextSyncAt) {
    return true;
  }

  return Date.parse(dataset.source.nextSyncAt) <= Date.now();
}

async function maybeSyncDataset(dataset: DatasetMetadata, syncDue?: boolean) {
  if (!syncDue || !isSyncDue(dataset) || dataset.source?.type !== "feishu_bitable") {
    return dataset;
  }

  const result = await syncFeishuBitableToDataset({
    bitableUrl: dataset.source.sourceUrl,
    existingDataset: dataset,
    syncPolicy: dataset.source.syncPolicy,
    tableId: dataset.source.tableId,
    viewId: dataset.source.viewId,
  });

  return result.dataset;
}

async function loadDatasets(dataSources: DashboardDataSource[], syncDue?: boolean) {
  const entries = await Promise.all(
    dataSources.map(async (source) => {
      const datasetId = source.binding?.datasetId;

      if (!datasetId) {
        return null;
      }

      const dataset = await getDataset(datasetId);

      if (!dataset) {
        return null;
      }

      return [source.id, await maybeSyncDataset(dataset, syncDue)] as const;
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, DatasetMetadata] => Boolean(entry)));
}

export async function POST(request: Request) {
  const body = (await request.json()) as MultiDatasetQueryRequest;
  const datasetsBySource = await loadDatasets(body.dataSources, body.syncDue);

  if (body.kind === "detail") {
    const dataset = datasetsBySource.get(body.detailView.dataSourceId);

    if (!dataset) {
      return NextResponse.json({ error: "未找到明细视图对应底表数据。" }, { status: 404 });
    }

    return NextResponse.json({
      rows: queryDetailRows({
        dataset,
        detailView: body.detailView,
        runtimeFilters: body.runtimeFilters,
      }),
    });
  }

  const rowsByView = Object.fromEntries(
    body.views.map((view) => {
      const dataset = datasetsBySource.get(view.dataSourceId);

      if (!dataset) {
        return [view.id, []];
      }

      return [view.id, aggregateRows(dataset.rows ?? dataset.sampleRows, view)];
    }),
  );

  return NextResponse.json({ rowsByView });
}
