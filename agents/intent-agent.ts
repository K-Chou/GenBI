import type { ChatMessage, IntentUnderstanding, ReferenceImageAnalysis } from "@/lib/types";
import { completeJson } from "@/services/deepseek";

function buildUserContent(params: {
  userRequest: string;
  history?: ChatMessage[];
  imageAnalysis?: ReferenceImageAnalysis;
}) {
  return JSON.stringify(
    {
      userRequest: params.userRequest,
      conversationHistory: (params.history ?? []).slice(-6),
      referenceImageAnalysis: params.imageAnalysis,
    },
    null,
    2,
  );
}

export async function runIntentAgent(params: {
  userRequest: string;
  history?: ChatMessage[];
  imageAnalysis?: ReferenceImageAnalysis;
}): Promise<IntentUnderstanding> {
  return completeJson<IntentUnderstanding>({
    stage: "intent",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Intent Understanding Agent，像资深 BI Consultant 一样理解用户为什么要这个 Dashboard。
只返回 JSON，不要 Markdown。
JSON schema:
{
  "domain": "sales | finance | operations | marketing | general",
  "audience": "目标受众，未知则写 unknown",
  "goals": ["业务目标"],
  "dashboardType": "Dashboard 类型",
  "userRole": "用户角色，未知则写 unknown",
  "clarity": "low | medium | high",
  "assumptions": ["必要假设"]
}`,
      },
      {
        role: "user",
        content: buildUserContent(params),
      },
    ],
  });
}
