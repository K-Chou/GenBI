import { NextResponse } from "next/server";
import { runDatasetSelectorAgent } from "@/agents/dataset-selector-agent";
import { runIntentAgent } from "@/agents/intent-agent";
import { getDataset, listDatasets } from "@/lib/file-store";
import type { DatasetMetadata, DatasetSelection, GenerationPlan, GenerationRequest } from "@/lib/types";
import { buildSemanticModel } from "@/services/semantic-model";

function getClarificationQuestion(params: {
  metricCount: number;
  hasDateField: boolean;
  hasDimension: boolean;
  clarity: "low" | "medium" | "high";
}) {
  if (params.metricCount === 0) {
    return "当前底表没有识别到可直接聚合的数字指标。你希望先做数量分布和明细分析，还是补充包含金额、时长、评分等数字字段的底表？";
  }

  if (!params.hasDateField) {
    return "当前选中的底表没有明显日期字段。如果要做趋势分析，请确认是否有时间字段；否则我会先生成分类对比和 KPI 看板。";
  }

  if (!params.hasDimension) {
    return "当前底表缺少稳定的分类维度。你希望按哪个字段做分组，还是先生成整体 KPI 和明细表？";
  }

  if (params.clarity === "low") {
    return "你的需求比较宽泛。你更希望优先看经营概览、异常风险，还是明细追踪？";
  }

  return undefined;
}

async function resolveSelection(body: GenerationRequest, allDatasets: DatasetMetadata[]): Promise<DatasetSelection> {
  if (body.datasetIds?.length) {
    return {
      datasetIds: body.datasetIds,
      rationale: "使用请求中指定的底表数据。",
      joinHints: [],
    };
  }

  return runDatasetSelectorAgent({
    datasets: allDatasets,
    history: body.history,
    preferredDatasetIds: body.datasetId ? [body.datasetId] : undefined,
    userRequest: body.userRequest,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerationRequest;

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 userRequest。" }, { status: 400 });
  }

  const allDatasets = await listDatasets();

  if (allDatasets.length === 0) {
    return NextResponse.json(
      {
        error: "还没有可用底表数据，请先上传文件或同步飞书多维表格。",
        action: "去底表数据页维护数据后再生成。",
      },
      { status: 400 },
    );
  }

  const selection = await resolveSelection(body, allDatasets);
  const selectedDatasets = (
    await Promise.all(selection.datasetIds.map((datasetId) => getDataset(datasetId)))
  ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));

  if (selectedDatasets.length === 0) {
    return NextResponse.json(
      {
        error: `找不到相关数据。当前已维护的底表数据无法支撑这个分析需求。${selection.rationale ? `原因：${selection.rationale}` : ""}`,
        action: "可以换一个分析目标，或到底表数据页上传/同步相关表。",
      },
      { status: 422 },
    );
  }

  const intent = await runIntentAgent({
    history: body.history,
    userRequest: body.userRequest,
  });
  const semanticModel = buildSemanticModel(selectedDatasets);
  const clarificationQuestion = getClarificationQuestion({
    clarity: intent.clarity,
    hasDateField: semanticModel.datasets.some((dataset) => dataset.dateFields.length > 0),
    hasDimension: semanticModel.dimensions.length > 0,
    metricCount: semanticModel.metrics.length,
  });
  const plan: GenerationPlan = {
    id: crypto.randomUUID(),
    mode: "feasibility",
    userRequest: body.userRequest,
    ready: semanticModel.metrics.length > 0 && selectedDatasets.length > 0,
    clarificationQuestion,
    datasetSelection: selection,
    datasets: selectedDatasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      rowCount: dataset.rowCount,
      columnCount: dataset.columns.length,
      sourceType: dataset.source?.type ?? "unknown",
    })),
    metrics: semanticModel.metrics.slice(0, 6),
    dimensions: semanticModel.dimensions.slice(0, 10),
    intent,
    semanticModel,
    dataRisks: semanticModel.dataRisks,
    rationale: `已完成数据可行性预检：${selection.rationale || "已选择相关底表"}。正式生成时会继续确认指标口径和看板结构。`,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json({ plan });
}
