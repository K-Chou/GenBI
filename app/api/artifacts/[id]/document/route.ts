import { NextResponse } from "next/server";
import { assertValidDashboardDocument } from "@/lib/dashboard-document-guard";
import { getArtifactDashboard, getArtifactDetails, getDataset, updateArtifactDashboard } from "@/lib/file-store";
import type { DashboardDocument, DatasetMetadata } from "@/lib/types";
import { refreshArtifactHtmlPresentationById } from "@/services/dashboard-html-presentation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dashboard = await getArtifactDashboard(id);

  if (!dashboard) {
    return NextResponse.json({ error: "未找到 Dashboard JSON Artifact。" }, { status: 404 });
  }

  return NextResponse.json({ dashboard });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { dashboard?: DashboardDocument };

  if (!body.dashboard) {
    return NextResponse.json({ error: "缺少 dashboard。" }, { status: 400 });
  }

  const dashboard: DashboardDocument = {
    ...body.dashboard,
    meta: {
      ...body.dashboard.meta,
      revision: (body.dashboard.meta.revision ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    },
  };
  const details = await getArtifactDetails(id);
  if (!details) {
    return NextResponse.json({ error: "未找到 Dashboard JSON Artifact。" }, { status: 404 });
  }
  const datasetIds = details.manifest.datasetIds ?? [details.manifest.datasetId];
  const datasets = (
    await Promise.all(datasetIds.map((datasetId) => getDataset(datasetId)))
  ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));

  try {
    assertValidDashboardDocument(dashboard, datasets, details.workflow?.metricContracts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DashboardDocument 未通过校验。" },
      { status: 400 },
    );
  }

  await updateArtifactDashboard({
    artifactId: id,
    dashboard,
  });
  const presentation = await refreshArtifactHtmlPresentationById({
    artifactId: id,
    dashboard,
  });

  return NextResponse.json({ dashboard, html: presentation.html, presentation });
}
