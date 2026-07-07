import type { ChatMessage, ImageAttachment, IntentUnderstanding } from "@/lib/types";
import { completeJson, type LlmMessage } from "@/services/deepseek";

function buildUserContent(params: {
  userRequest: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
}): LlmMessage["content"] {
  const text = JSON.stringify(
    {
      userRequest: params.userRequest,
      conversationHistory: (params.history ?? []).slice(-6),
      referenceImages:
        params.images && params.images.length > 0
          ? "用户上传了参考图片，请结合图片判断用户想要的 Dashboard 类型、受众和业务目标。"
          : "无参考图片。",
    },
    null,
    2,
  );

  if (!params.images?.length) {
    return text;
  }

  return [
    { type: "text", text },
    ...params.images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl },
    })),
  ];
}

export async function runIntentAgent(params: {
  userRequest: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
}): Promise<IntentUnderstanding> {
  return completeJson<IntentUnderstanding>({
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
