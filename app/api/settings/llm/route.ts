import { NextResponse } from "next/server";
import { getPublicLlmConfig, saveLlmConfig } from "@/lib/file-store";
import type { LlmRuntimeConfig } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getPublicLlmConfig());
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<LlmRuntimeConfig>;

  if (!body.baseUrl?.trim() || !body.model?.trim()) {
    return NextResponse.json({ error: "请填写 Base URL 和 Model。" }, { status: 400 });
  }

  await saveLlmConfig({
    apiKey: body.apiKey,
    baseUrl: body.baseUrl,
    model: body.model,
    stageConfigs: body.stageConfigs,
    stageModels: body.stageModels,
    timeoutMs: body.timeoutMs,
  });

  return NextResponse.json(await getPublicLlmConfig());
}
