import { NextResponse } from "next/server";
import { runPatchAgent } from "@/agents/patch-agent";
import { assertValidDashboardDocument } from "@/lib/dashboard-document-guard";
import { applyDashboardPatch } from "@/lib/dashboard-patch";
import { getArtifactDetails, getDataset, updateArtifactDashboard } from "@/lib/file-store";
import type { ChatMessage, DatasetMetadata } from "@/lib/types";
import { refreshArtifactHtmlPresentationById } from "@/services/dashboard-html-presentation";

type PatchRequest = {
  userRequest: string;
  history?: ChatMessage[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as PatchRequest;

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 userRequest。" }, { status: 400 });
  }

  const details = await getArtifactDetails(id);

  if (!details?.dashboard) {
    return NextResponse.json({ error: "未找到 Dashboard JSON Artifact。" }, { status: 404 });
  }

  const dataset = await getDataset(details.manifest.datasetId);

  if (!dataset) {
    return NextResponse.json({ error: "未找到 Dataset。" }, { status: 404 });
  }

  const relatedDatasets = (
    await Promise.all((details.manifest.datasetIds ?? [details.manifest.datasetId]).map((datasetId) => getDataset(datasetId)))
  ).filter((item): item is DatasetMetadata => Boolean(item));

  const patchSet = await runPatchAgent({
    dashboard: details.dashboard,
    dataset,
    datasets: relatedDatasets.length ? relatedDatasets : [dataset],
    dimensionContracts: details.workflow?.dimensionContracts,
    metricContracts: details.workflow?.metricContracts,
    userRequest: body.userRequest,
    history: body.history,
  });
  const dashboard = applyDashboardPatch(details.dashboard, patchSet.patches);

  try {
    assertValidDashboardDocument(dashboard, relatedDatasets.length ? relatedDatasets : [dataset], details.workflow?.metricContracts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Patch 后的 DashboardDocument 未通过校验。" },
      { status: 400 },
    );
  }

  await updateArtifactDashboard({
    artifactId: id,
    dashboard,
    patchSet,
  });
  const presentation = await refreshArtifactHtmlPresentationById({
    artifactId: id,
    dashboard,
    userRequest: body.userRequest,
  });

  return NextResponse.json({ dashboard, html: presentation.html, patchSet, presentation });
}
