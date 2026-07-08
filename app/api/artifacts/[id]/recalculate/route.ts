import { NextResponse } from "next/server";
import { aggregateRows } from "@/lib/dashboard-query";
import { getArtifactDetails, getDataset, updateArtifactManifest } from "@/lib/file-store";
import type { DatasetMetadata } from "@/lib/types";
import { syncFeishuBitableToDataset } from "@/services/connectors/feishu";

function isSyncDue(dataset: DatasetMetadata) {
  if (dataset.source?.type !== "feishu_bitable" || !dataset.source.syncPolicy?.enabled) {
    return false;
  }

  if (!dataset.source.nextSyncAt) {
    return true;
  }

  return Date.parse(dataset.source.nextSyncAt) <= Date.now();
}

async function syncIfDue(dataset: DatasetMetadata) {
  if (!isSyncDue(dataset) || dataset.source?.type !== "feishu_bitable") {
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const details = await getArtifactDetails(id);

  if (!details?.dashboard) {
    return NextResponse.json({ error: "未找到仪表盘 JSON。" }, { status: 404 });
  }

  const datasetEntries = await Promise.all(
    details.dashboard.dataSources.map(async (source) => {
      const datasetId = source.binding?.datasetId;

      if (!datasetId) {
        return null;
      }

      const dataset = await getDataset(datasetId);

      if (!dataset) {
        return null;
      }

      return [source.id, await syncIfDue(dataset)] as const;
    }),
  );
  const datasetsBySource = new Map(
    datasetEntries.filter((entry): entry is readonly [string, DatasetMetadata] => Boolean(entry)),
  );
  const rowsByView = Object.fromEntries(
    details.dashboard.views.map((view) => {
      const dataset = datasetsBySource.get(view.dataSourceId);

      if (!dataset) {
        return [view.id, []];
      }

      return [view.id, aggregateRows(dataset.rows ?? dataset.sampleRows, view)];
    }),
  );
  const now = new Date().toISOString();
  const manifest = {
    ...details.manifest,
    lastCalculatedAt: now,
    refreshPolicy: details.dashboard.refreshPolicy,
  };

  await updateArtifactManifest(manifest);

  return NextResponse.json({
    dashboard: details.dashboard,
    lastCalculatedAt: now,
    manifest,
    rowsByView,
  });
}
