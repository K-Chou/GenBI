import type {
  ChatMessage,
  DashboardBlueprint,
  ReviewResult,
  UserPreferenceMemory,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

export async function runPreferenceAgent(params: {
  userRequest: string;
  history?: ChatMessage[];
  previousMemory?: UserPreferenceMemory;
  blueprint?: DashboardBlueprint;
  review?: ReviewResult;
}): Promise<UserPreferenceMemory> {
  return completeJson<UserPreferenceMemory>({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Preference Agent。
你的任务是从用户请求、历史对话、Dashboard Blueprint 和 Review 中总结用户偏好。
不要输出解释，只返回 JSON。
偏好必须是可用于提升下一次 Dashboard 生成质量的约束。
不要记录一次性事实，不要记录敏感信息。
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
}
