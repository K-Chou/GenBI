import { NextResponse } from "next/server";
import { assertValidDashboardDocument } from "@/lib/dashboard-document-guard";
import { applyDashboardPatch } from "@/lib/dashboard-patch";
import { getArtifactDetails, getDataset, updateArtifactDashboard } from "@/lib/file-store";
import type { DashboardDocument, DashboardPatchSet, DatasetMetadata } from "@/lib/types";
import { refreshArtifactHtmlPresentationById } from "@/services/dashboard-html-presentation";

type ManualPatchRequest = {
  dashboard: DashboardDocument;
  patchSet: DashboardPatchSet;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as ManualPatchRequest;

  if (!body.dashboard || !body.patchSet?.patches?.length) {
    return NextResponse.json({ error: "缺少 dashboard 或 patchSet。" }, { status: 400 });
  }

  const nextDashboard = applyDashboardPatch(body.dashboard, body.patchSet.patches);
  const details = await getArtifactDetails(id);
  if (!details) {
    return NextResponse.json({ error: "未找到 Dashboard JSON Artifact。" }, { status: 404 });
  }
  const datasets = (
    await Promise.all((details.manifest.datasetIds ?? [details.manifest.datasetId]).map((datasetId) => getDataset(datasetId)))
  ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));
  try {
    assertValidDashboardDocument(nextDashboard, datasets, details.workflow?.metricContracts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Patch 后的 DashboardDocument 未通过校验。" },
      { status: 400 },
    );
  }

  await updateArtifactDashboard({
    artifactId: id,
    dashboard: nextDashboard,
    patchSet: body.patchSet,
  });
  const presentation = await refreshArtifactHtmlPresentationById({
    artifactId: id,
    dashboard: nextDashboard,
    userRequest: body.patchSet.intent,
  });

  return NextResponse.json({ dashboard: nextDashboard, html: presentation.html, presentation });
}
