import type {
  DashboardSkill,
  ReviewResult,
  SkillOptimization,
  UserPreferenceMemory,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

function deriveLocalOptimization(params: {
  preferenceMemory?: UserPreferenceMemory;
}): SkillOptimization {
  const memory = params.preferenceMemory;

  return {
    businessRules: memory?.businessPreferences.map((item) => `优先体现用户长期业务偏好：${item}`) ?? [],
    chartRules: memory?.chartPreferences.map((item) => `优先体现用户长期图表偏好：${item}`) ?? [],
    confidence: memory ? 0.72 : 0.6,
    designRules: memory?.visualPreferences.map((item) => `优先体现用户长期视觉偏好：${item}`) ?? [],
    kpiRules: [],
    layoutRules: memory?.layoutPreferences.map((item) => `优先体现用户长期布局偏好：${item}`) ?? [],
    rationale: ["无 Review 输入时使用本地偏好合成，避免额外模型调用。"],
  };
}

export async function runSkillOptimizerAgent(params: {
  baseSkill: DashboardSkill;
  preferenceMemory?: UserPreferenceMemory;
  review?: ReviewResult;
}): Promise<SkillOptimization> {
  if (!params.review) {
    return deriveLocalOptimization(params);
  }

  return completeJson<SkillOptimization>({
    stage: "fast",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Skill Optimizer Agent。
你的任务不是改代码，而是基于用户偏好和 Review，生成本次运行时可叠加到基础 Skill 的优化约束。
只返回 JSON，不要 Markdown。
输出必须克制、可执行、可用于 Planner/Builder。
JSON schema:
{
  "kpiRules": ["KPI 优化规则"],
  "chartRules": ["图表优化规则"],
  "layoutRules": ["布局优化规则"],
  "designRules": ["设计优化规则"],
  "businessRules": ["业务优化规则"],
  "rationale": ["为什么这样优化"],
  "confidence": 0.8
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            baseSkill: params.baseSkill,
            preferenceMemory: params.preferenceMemory,
            review: params.review,
          },
          null,
          2,
        ),
      },
    ],
  });
}
