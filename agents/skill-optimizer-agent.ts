import type {
  DashboardSkill,
  ReviewResult,
  SkillOptimization,
  UserPreferenceMemory,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

export async function runSkillOptimizerAgent(params: {
  baseSkill: DashboardSkill;
  preferenceMemory?: UserPreferenceMemory;
  review?: ReviewResult;
}): Promise<SkillOptimization> {
  return completeJson<SkillOptimization>({
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
