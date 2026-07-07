import { NextResponse } from "next/server";
import { getDataset } from "@/lib/file-store";
import type { GenerationRequest } from "@/lib/types";
import { runDashboardWorkflow } from "@/services/dashboard-workflow";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerationRequest;

  if (!body.datasetId || !body.userRequest?.trim()) {
    return NextResponse.json({ error: "缺少 datasetId 或 userRequest。" }, { status: 400 });
  }

  const dataset = await getDataset(body.datasetId);

  if (!dataset) {
    return NextResponse.json({ error: "未找到 Dataset。" }, { status: 404 });
  }

  const result = await runDashboardWorkflow({
    dataset,
    userRequest: body.userRequest,
    theme: body.theme,
    promptSettings: body.promptSettings,
    history: body.history,
    images: body.images,
  });

  return NextResponse.json(result);
}
