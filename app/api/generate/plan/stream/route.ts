import { NextResponse } from "next/server";
import { runDatasetSelectorAgent } from "@/agents/dataset-selector-agent";
import { runIntentAgent } from "@/agents/intent-agent";
import { getDataset, listDatasets } from "@/lib/file-store";
import type { DatasetMetadata, DatasetSelection, GenerationPlan, GenerationRequest, WorkflowEvent } from "@/lib/types";
import { buildSemanticModel } from "@/services/semantic-model";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

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

function createPlanEvent(params: {
  agent: WorkflowEvent["agent"];
  checkpointKey: string;
  durationMs?: number;
  input?: unknown;
  label: string;
  output?: unknown;
  status: WorkflowEvent["status"];
  summary: string;
}): WorkflowEvent {
  return {
    agent: params.agent,
    durationMs: params.durationMs,
    id: `plan-${params.agent}-${params.status}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: params.label,
    status: params.status,
    summary: params.summary,
    timestamp: new Date().toISOString(),
    trace: {
      checkpointKey: params.checkpointKey,
      input: params.input,
      output: params.output,
    },
  };
}

export async function POST(request: Request) {
  let body: GenerationRequest;

  try {
    body = (await request.json()) as GenerationRequest;
  } catch {
    return NextResponse.json(
      {
        error: "数据预检请求体过大或 JSON 不完整。请减少参考图片数量/大小后重试。",
      },
      { status: 400 },
    );
  }

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 userRequest。" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      async function emit(params: Parameters<typeof createPlanEvent>[0]) {
        controller.enqueue(encoder.encode(encodeSse("workflow-event", { workflowEvent: createPlanEvent(params) })));
      }

      async function runStep<T>(
        params: Omit<Parameters<typeof createPlanEvent>[0], "durationMs" | "output" | "status" | "summary"> & {
          doneSummary: (output: T) => string;
          runningSummary: string;
          task: () => Promise<T> | T;
        },
      ) {
        await emit({ ...params, status: "running", summary: params.runningSummary });
        const startedAt = Date.now();
        const output = await params.task();
        await emit({
          ...params,
          durationMs: Date.now() - startedAt,
          output,
          status: "done",
          summary: params.doneSummary(output),
        });
        return output;
      }

      try {
        const allDatasets = await runStep({
          agent: "data",
          checkpointKey: "plan_dataset_inventory",
          doneSummary: (datasets: DatasetMetadata[]) => `已读取 ${datasets.length} 个可用底表。`,
          input: {},
          label: "Dataset Inventory",
          runningSummary: "正在读取可用底表列表。",
          task: listDatasets,
        });

        if (allDatasets.length === 0) {
          throw new Error("还没有可用底表数据，请先上传文件或同步飞书多维表格。");
        }

        const selection = await runStep({
          agent: "planner",
          checkpointKey: "plan_dataset_selection",
          doneSummary: (result: DatasetSelection) => `已选择 ${result.datasetIds.length} 个相关底表。`,
          input: {
            datasetCount: allDatasets.length,
            userRequest: body.userRequest,
          },
          label: "Dataset Selector Agent",
          runningSummary: "正在选择最相关的底表。",
          task: () => resolveSelection(body, allDatasets),
        });

        const selectedDatasets = (
          await Promise.all(selection.datasetIds.map((datasetId) => getDataset(datasetId)))
        ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));

        if (selectedDatasets.length === 0) {
          throw new Error(`找不到相关数据。${selection.rationale ? `原因：${selection.rationale}` : ""}`);
        }

        const intent = await runStep({
          agent: "intent",
          checkpointKey: "intent",
          doneSummary: (result) => `${result.dashboardType} · ${result.goals.join("、")}`,
          input: {
            history: body.history,
            userRequest: body.userRequest,
          },
          label: "Intent Agent",
          runningSummary: "正在理解业务目标和分析意图。",
          task: () =>
            runIntentAgent({
              history: body.history,
              userRequest: body.userRequest,
            }),
        });

        const semanticModel = await runStep({
          agent: "data",
          checkpointKey: "semantic_model",
          doneSummary: (result) => `${result.datasets.length} 个语义数据集，${result.metrics.length} 个可计算指标候选。`,
          input: {
            datasetIds: selectedDatasets.map((dataset) => dataset.id),
          },
          label: "Semantic Model",
          runningSummary: "正在构建字段语义和可聚合性。",
          task: () => buildSemanticModel(selectedDatasets),
        });

        const feasibility = await runStep({
          agent: "planner",
          checkpointKey: "plan_feasibility",
          doneSummary: (result: { metrics: unknown[]; dimensions: unknown[] }) =>
            `${result.metrics.length} 个可用指标候选，${result.dimensions.length} 个维度候选。`,
          input: {
            intent,
            semanticModel,
            userRequest: body.userRequest,
          },
          label: "Data Feasibility",
          runningSummary: "正在检查数据可行性和候选字段。",
          task: () => ({
            dimensions: semanticModel.dimensions.slice(0, 10),
            metrics: semanticModel.metrics.slice(0, 6),
            risks: semanticModel.dataRisks,
          }),
        });

        const clarificationQuestion = getClarificationQuestion({
          clarity: intent.clarity,
          hasDateField: semanticModel.datasets.some((dataset) => dataset.dateFields.length > 0),
          hasDimension: semanticModel.dimensions.length > 0,
          metricCount: semanticModel.metrics.length,
        });
        const plan: GenerationPlan = {
          clarificationQuestion,
          createdAt: new Date().toISOString(),
          dataRisks: semanticModel.dataRisks,
          datasetSelection: selection,
          datasets: selectedDatasets.map((dataset) => ({
            columnCount: dataset.columns.length,
            id: dataset.id,
            name: dataset.name,
            rowCount: dataset.rowCount,
            sourceType: dataset.source?.type ?? "unknown",
          })),
          dimensions: semanticModel.dimensions.slice(0, 10),
          id: crypto.randomUUID(),
          intent,
          metrics: semanticModel.metrics.slice(0, 6),
          mode: "feasibility",
          rationale:
            selectedDatasets.length > 0
              ? `已完成数据可行性预检：${selection.rationale || "已选择相关底表"}。正式生成时会继续确认指标口径和看板结构。`
              : selection.rationale,
          ready: feasibility.metrics.length > 0 && selectedDatasets.length > 0,
          semanticModel,
          userRequest: body.userRequest,
        };

        controller.enqueue(encoder.encode(encodeSse("complete", { plan })));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeSse("error", {
              error: error instanceof Error ? error.message : "数据预检失败。",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
