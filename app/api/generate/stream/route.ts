import { NextResponse } from "next/server";
import { getDataset } from "@/lib/file-store";
import type { GenerationRequest } from "@/lib/types";
import { runDashboardWorkflow } from "@/services/dashboard-workflow";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerationRequest;

  if (!body.datasetId || !body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 datasetId 或 userRequest。" }, { status: 400 });
  }

  const dataset = await getDataset(body.datasetId);

  if (!dataset) {
    return NextResponse.json({ error: "未找到 Dataset。" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runDashboardWorkflow({
          dataset,
          userRequest: body.userRequest,
          theme: body.theme,
          promptSettings: body.promptSettings,
          history: body.history,
          images: body.images,
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
