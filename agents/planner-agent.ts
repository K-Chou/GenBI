import type {
  DashboardBlueprint,
  DashboardSkill,
  DataUnderstanding,
  DatasetMetadata,
  IntentUnderstanding,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

export async function runPlannerAgent(params: {
  dataset: DatasetMetadata;
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  skill: DashboardSkill;
  theme?: string;
  promptSettings?: string;
}): Promise<DashboardBlueprint> {
  return completeJson<DashboardBlueprint>({
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content: `你是 Dashboard Planner Agent，也是资深 BI Consultant。
不要生成 HTML。你只负责把业务目标和数据理解转成 Dashboard Blueprint。
必须遵守：
- KPI 在顶部
- 趋势图默认 line
- 分类对比默认 bar
- 占比构成默认 donut
- 不要 3D
- 不要渐变背景
- Apple Style、24px spacing、16px card radius、Dark Mode
必须应用传入的 Dashboard Skill，不要让 LLM 自由决定全部结构。
只返回 JSON，不要 Markdown。
JSON schema:
{
  "title": "中文标题",
  "dashboardType": "类型",
  "audience": "受众",
  "objectives": ["目标"],
  "kpis": [{"label": "KPI 名称", "field": "字段名", "rationale": "选择原因"}],
  "sections": [{"name": "模块名", "purpose": "用途", "chart": "kpi | line | bar | donut | table | insight", "fields": ["字段名"], "priority": 1}],
  "designPlan": {"style": "Apple Style", "layout": "Mobile First", "theme": "主题", "spacing": "24px", "notes": ["设计说明"]},
  "skillId": "使用的 skill id"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            datasetName: params.dataset.name,
            intent: params.intent,
            dataUnderstanding: params.dataUnderstanding,
            dashboardSkill: params.skill,
            preferredTheme: params.theme ?? "system",
            promptSettings: params.promptSettings ?? "",
          },
          null,
          2,
        ),
      },
    ],
  });
}
