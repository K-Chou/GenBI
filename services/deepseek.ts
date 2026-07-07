export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | {
            type: "text";
            text: string;
          }
        | {
            type: "image_url";
            image_url: {
              url: string;
            };
          }
      >;
};

type LlmResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";

export async function completeChat(params: {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}) {
  const apiKey = process.env.LLM_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_LLM_BASE_URL;
  const model = process.env.LLM_MODEL ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

  if (!apiKey) {
    throw new Error("缺少 LLM_API_KEY 环境变量。");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      stream: false,
    }),
  });

  const payload = (await response.json()) as LlmResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "LLM 请求失败。");
  }

  const html = payload.choices?.[0]?.message?.content;

  if (!html) {
    throw new Error("LLM 返回了空响应。");
  }

  return html;
}

function stripCodeFence(content: string) {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function completeJson<T>(params: {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const content = stripCodeFence(await completeChat(params));

  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("LLM 没有返回可解析的 JSON。");
    }

    return JSON.parse(match[0]) as T;
  }
}

export async function completeHtml(params: {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}) {
  return stripCodeFence(await completeChat(params));
}

export async function generateDashboardHtml(messages: LlmMessage[]) {
  return completeHtml({
    messages,
    temperature: 0.35,
  });
}
