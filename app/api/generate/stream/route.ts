import { NextResponse } from "next/server";
import { runDatasetSelectorAgent } from "@/agents/dataset-selector-agent";
import { getDataset, listDatasets } from "@/lib/file-store";
import type { DatasetMetadata, DatasetSelection, GenerationRequest } from "@/lib/types";
import { runDashboardWorkflow } from "@/services/dashboard-workflow";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  let body: GenerationRequest;

  try {
    body = (await request.json()) as GenerationRequest;
  } catch {
    return NextResponse.json(
      {
        error: "生成请求体过大或 JSON 不完整。请减少参考图片数量/大小，或重新进行数据预检后再确认生成。",
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
      try {
        const allDatasets = await listDatasets();

        if (allDatasets.length === 0) {
          throw new Error("还没有可用底表数据，请先上传文件或同步飞书多维表格。");
        }

        let selection: DatasetSelection;

        if (body.plan?.datasetSelection.datasetIds.length) {
          selection = body.plan.datasetSelection;
        } else if (body.datasetIds?.length) {
          selection = {
            datasetIds: body.datasetIds,
            rationale: "使用请求中指定的底表数据。",
            joinHints: [],
          };
        } else if (body.autoSelectDatasets !== false) {
          selection = await runDatasetSelectorAgent({
            datasets: allDatasets,
            history: body.history,
            preferredDatasetIds: body.datasetId ? [body.datasetId] : undefined,
            userRequest: body.userRequest,
          });
        } else if (body.datasetId) {
          selection = {
            datasetIds: [body.datasetId],
            rationale: "使用当前选中的底表数据。",
            joinHints: [],
          };
        } else {
          selection = await runDatasetSelectorAgent({
            datasets: allDatasets,
            history: body.history,
            userRequest: body.userRequest,
          });
        }

        const selectedDatasets = (
          await Promise.all(selection.datasetIds.map((datasetId) => getDataset(datasetId)))
        ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));

        if (selectedDatasets.length === 0) {
          throw new Error(
            `找不到相关数据。当前已维护的底表数据无法支撑这个分析需求，请先到底表数据页上传或同步相关表。${selection.rationale ? `原因：${selection.rationale}` : ""}`,
          );
        }

        const result = await runDashboardWorkflow({
          dataset: selectedDatasets[0],
          datasetSelection: selection,
          datasets: selectedDatasets,
          userId: body.userId,
          userRequest: body.userRequest,
          theme: body.theme,
          promptSettings: body.promptSettings,
          history: body.history,
          images: body.images,
          plan: body.plan,
          resumeWorkflow: body.resumeWorkflow,
          onEvent: async (workflowEvent, workflow) => {
            controller.enqueue(encoder.encode(encodeSse("workflow-event", { workflowEvent, workflow })));
          },
        });

        controller.enqueue(encoder.encode(encodeSse("complete", result)));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeSse("error", {
              error: error instanceof Error ? error.message : "Workflow 执行失败。",
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
