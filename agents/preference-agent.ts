import type {
  ChatMessage,
  DashboardBlueprint,
  ReviewResult,
  UserPreferenceMemory,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

function compactList(items: string[] = []) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 8);
}

function compactMemory(memory: UserPreferenceMemory): UserPreferenceMemory {
  return {
    businessPreferences: compactList(memory.businessPreferences),
    chartPreferences: compactList(memory.chartPreferences),
    layoutPreferences: compactList(memory.layoutPreferences),
    negativePreferences: compactList(memory.negativePreferences),
    updatedAt: memory.updatedAt || new Date().toISOString(),
    visualPreferences: compactList(memory.visualPreferences),
  };
}

export async function runPreferenceAgent(params: {
  userRequest: string;
  history?: ChatMessage[];
  previousMemory?: UserPreferenceMemory;
  blueprint?: DashboardBlueprint;
  review?: ReviewResult;
}): Promise<UserPreferenceMemory> {
  const memory = await completeJson<UserPreferenceMemory>({
    stage: "fast",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Preference Agent。
你的任务是从用户每一轮对话输入、历史对话、Dashboard Blueprint 和 Review 中总结长期个人偏好。
不要输出解释，只返回 JSON。
偏好必须是可用于提升下一次 Dashboard 生成质量的约束。
只记录稳定偏好，不记录一次性事实、具体数据值、API Key、文件名、敏感信息。
每类最多保留 8 条，表达要短、可执行、可复用。
如果用户本轮只是普通需求，也可以不新增偏好，但要保留 previousMemory 中仍有效的内容。
JSON schema:
{
  "visualPreferences": ["视觉偏好"],
  "layoutPreferences": ["布局偏好"],
  "chartPreferences": ["图表偏好"],
  "businessPreferences": ["业务关注点"],
  "negativePreferences": ["用户明确不喜欢或应避免的内容"],
  "updatedAt": "ISO 时间"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            userRequest: params.userRequest,
            history: (params.history ?? []).slice(-8),
            previousMemory: params.previousMemory,
            blueprint: params.blueprint,
            review: params.review,
            now: new Date().toISOString(),
          },
          null,
          2,
        ),
      },
    ],
  });

  return compactMemory(memory);
}
