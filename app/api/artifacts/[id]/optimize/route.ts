import { NextResponse } from "next/server";
import { runPatchAgent } from "@/agents/patch-agent";
import { assertValidDashboardDocument } from "@/lib/dashboard-document-guard";
import { applyDashboardPatch } from "@/lib/dashboard-patch";
import { getArtifactDetails, getDataset, updateArtifactDashboard } from "@/lib/file-store";
import type { ChatMessage, DashboardDocument, DatasetMetadata } from "@/lib/types";
import { refreshArtifactHtmlPresentationById } from "@/services/dashboard-html-presentation";
import { runDashboardWorkflow } from "@/services/dashboard-workflow";

type OptimizeRequest = {
  userRequest: string;
  history?: ChatMessage[];
  strategy?: "auto" | "patch" | "regenerate";
};

function shouldRegenerate(request: string, dashboard: DashboardDocument | null) {
  if (!dashboard) {
    return true;
  }

  const patchable = /文案|标题|描述|颜色|配色|字号|间距|圆角|排序|移动|删除|隐藏|换成.*图|折线|柱状|条形|环图|面积图|colSpan|布局微调|宽一点|窄一点|改成/i.test(
    request,
  );
  const regenerateOnly = /重做|重新生成|重新设计|信息架构|布局体系|视觉体系|最高质量|极致|高质量|全面优化|换风格|新增多个|增加多个|多个模块|重新规划|换数据|换指标口径|dribbble|behance/i.test(
    request,
  );

  return regenerateOnly && !patchable;
}

function buildRegenerationRequest(params: {
  currentDashboard: DashboardDocument | null;
  originalRequest: string;
  userRequest: string;
}) {
  return `基于已有仪表盘做高质量迭代优化。

原始需求：
${params.originalRequest}

本次优化要求：
${params.userRequest}

优化原则：
- 优先保持已验证的数据口径和业务目标。
- 如果是整体视觉、布局、信息层级或体验优化，请重新规划并生成更高质量的新版本。
- 不要编造数据；所有图表必须通过 DashboardDocument views/metrics 绑定真实字段。
- 输出应继续符合 Apple inspired、minimal、professional、mobile first、KPI first。

当前 DashboardDocument 摘要：
${JSON.stringify(
  params.currentDashboard
    ? {
        title: params.currentDashboard.title,
        description: params.currentDashboard.description,
        metrics: params.currentDashboard.metrics,
        designSpec: params.currentDashboard.designSpec,
        views: params.currentDashboard.views,
        components: params.currentDashboard.components.map((component) => ({
          id: component.id,
          title: component.title,
          type: component.type,
          layout: component.layout,
          data: component.data,
        })),
        insights: params.currentDashboard.insights,
      }
    : null,
  null,
  2,
)}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as OptimizeRequest;

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 userRequest。" }, { status: 400 });
  }

  const details = await getArtifactDetails(id);

  if (!details) {
    return NextResponse.json({ error: "未找到仪表盘。" }, { status: 404 });
  }

  const dataset = await getDataset(details.manifest.datasetId);

  if (!dataset) {
    return NextResponse.json({ error: "未找到底表数据。" }, { status: 404 });
  }
  const relatedDatasets = (
    await Promise.all((details.manifest.datasetIds ?? [details.manifest.datasetId]).map((datasetId) => getDataset(datasetId)))
  ).filter((item): item is DatasetMetadata => Boolean(item));

  const strategy =
    body.strategy === "regenerate" || (body.strategy !== "patch" && shouldRegenerate(body.userRequest, details.dashboard))
      ? "regenerate"
      : "patch";

  if (strategy === "patch") {
    if (!details.dashboard) {
      return NextResponse.json({ error: "当前仪表盘不支持局部 Patch，请使用完整优化。" }, { status: 400 });
    }

    const patchSet = await runPatchAgent({
      dashboard: details.dashboard,
      dataset,
      datasets: relatedDatasets.length ? relatedDatasets : [dataset],
      dimensionContracts: details.workflow?.dimensionContracts,
      metricContracts: details.workflow?.metricContracts,
      history: body.history,
      userRequest: body.userRequest,
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

    return NextResponse.json({
      dashboard,
      html: presentation.html,
      mode: "patch",
      patchSet,
      presentation,
      summary: patchSet.summary,
    });
  }

  const result = await runDashboardWorkflow({
    dataset,
    datasets: relatedDatasets.length ? relatedDatasets : [dataset],
    history: body.history,
    userRequest: buildRegenerationRequest({
      currentDashboard: details.dashboard,
      originalRequest: details.manifest.userRequest,
      userRequest: body.userRequest,
    }),
  });

  return NextResponse.json({
    artifact: result.artifact,
    dashboard: result.dashboard,
    mode: "regenerate",
    summary: `已基于 ${details.manifest.title} 生成优化版本 ${result.artifact.title}。`,
    workflow: result.workflow,
  });
}
