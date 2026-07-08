import { getStoredLlmConfig } from "@/lib/file-store";
import type { LlmStage } from "@/lib/types";

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

const DEFAULT_LLM_TIMEOUT_MS = 120_000;
const DEFAULT_LLM_RETRIES = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function completeChat(params: {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  stage?: LlmStage;
}) {
  const storedConfig = await getStoredLlmConfig();
  const stageConfig = params.stage ? storedConfig?.stageConfigs?.[params.stage] : undefined;
  const apiKey = params.stage ? (stageConfig?.apiKey ?? storedConfig?.apiKey) : storedConfig?.apiKey;
  const baseUrl = params.stage ? (stageConfig?.baseUrl ?? storedConfig?.baseUrl) : storedConfig?.baseUrl;
  const defaultModel = storedConfig?.model;
  const model = params.stage ? (stageConfig?.model ?? storedConfig?.stageModels?.[params.stage] ?? defaultModel) : defaultModel;
  const timeoutMs = Number(storedConfig?.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS);

  if (!baseUrl || !model || !apiKey) {
    throw new Error("缺少模型连接配置。请到设置页保存 Base URL、Model 和 API Key 后再生成。");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= DEFAULT_LLM_RETRIES; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
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
        signal: AbortSignal.timeout(timeoutMs),
      });

      const payload = (await response.json()) as LlmResponse;

      if (!response.ok) {
        const message = payload.error?.message ?? `HTTP ${response.status}`;
        if (attempt < DEFAULT_LLM_RETRIES && response.status >= 500) {
          lastError = new Error(message);
          await sleep(800);
          continue;
        }

        throw new Error(`LLM 请求失败：${message}`);
      }

      const html = payload.choices?.[0]?.message?.content;

      if (!html) {
        throw new Error("LLM 返回了空响应。");
      }

      return html;
    } catch (error) {
      lastError = error;

      if (attempt < DEFAULT_LLM_RETRIES) {
        await sleep(800);
        continue;
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : "未知网络错误";
  throw new Error(`LLM 网络请求失败：${reason}。请检查 LLM_BASE_URL=${baseUrl}、LLM_MODEL=${model} 或网络连通性。`);
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
  stage?: LlmStage;
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
  stage?: LlmStage;
}) {
  return stripCodeFence(await completeChat(params));
}
