import type {
  DashboardBlueprint,
  DashboardSkill,
  DataUnderstanding,
  DatasetMetadata,
  DimensionContract,
  IntentUnderstanding,
  MetricSystem,
  MetricContract,
  ReferenceImageAnalysis,
} from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { designReferencePrompt, internalDashboardReferencePrompt } from "@/prompts/dashboard-system";
import { completeJson } from "@/services/deepseek";

export async function runPlannerAgent(params: {
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  dimensionContracts?: DimensionContract[];
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  metricSystem?: MetricSystem;
  metricContracts?: MetricContract[];
  skill: DashboardSkill;
  imageAnalysis?: ReferenceImageAnalysis;
  theme?: string;
  promptSettings?: string;
}): Promise<DashboardBlueprint> {
  const datasets = params.datasets?.length ? params.datasets : [params.dataset];

  return completeJson<DashboardBlueprint>({
    stage: "planning",
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
- 参考内部运营看板结构：总览 KPI -> 原因分析 -> 责任定位 -> 明细/行动建议
- 首屏 KPI 尽量覆盖总量、效率、质量、达标率；标题必须业务化，不能只用字段名
- 工单运营场景的首屏 KPI 不只是当前值，必须优先规划“本期 + 较上期变化”的可比较 KPI；如果存在时间字段，KPI 相关 fields 必须同时包含核心指标字段和时间维度字段。
- 工单运营场景首屏 KPI 建议覆盖：工单总量、新增/关闭规模、待处理/未解决规模、平均响应/处理时长、客服人员处理效率；没有字段支撑时用 empty_state/insight 说明缺口。
- 必须优先使用 metricSystem 中的 northStarMetric、primaryMetrics、diagnosticMetrics 和 actionMetrics 来组织 KPI 与模块。
- 如果 metricSystem 标记某指标 executable=false，只能作为 empty_state、insight 或 metricGaps 说明，不要生成可执行 KPI。
- 分类超过 6 项时优先规划 bar，不要规划 donut；donut 只用于少量状态/构成占比
- 服务运营/AI 服务/质量运营/人员效率场景要优先形成模块分区，而不是平均铺图
- 如果识别到服务运营、产品运营、内容运营、基建服务、VOC、工单、需求 Backlog、BUG、人工干预等场景，优先使用多域运营范式：dashboard_title -> section_title -> KPI/KPI group -> donut/bar/horizontal_bar/stacked_bar -> empty_state。
- 栅格要可执行：dashboard_title/section_title 使用 12 栏；密集运营 KPI 可使用 2 栏；主图/堆叠图使用 4/6/8 栏；不要使用 1/5/7/9/10/11 这类难维护 span。
- designPlan 必须体现更偏 Dribbble / Behance 的现代数据产品视觉方向，但不要复制具体作品
如果存在 referenceImageAnalysis，必须把其中的布局、视觉风格、组件模式和约束转化为 designPlan.notes 与 sections 规划依据。
必须应用传入的 Dashboard Skill，不要让 LLM 自由决定全部结构。
${designReferencePrompt}
${internalDashboardReferencePrompt}
只返回 JSON，不要 Markdown。
JSON schema:
{
  "title": "中文标题",
  "dashboardType": "类型",
  "audience": "受众",
  "objectives": ["目标"],
  "kpis": [{"label": "KPI 名称", "field": "字段名", "rationale": "选择原因"}],
  "sections": [{"name": "模块名", "purpose": "用途", "chart": "dashboard_title | section_title | kpi | kpi_group | line | bar | horizontal_bar | stacked_bar | horizontal_stacked_bar | donut | table | insight | empty_state", "fields": ["字段名"], "priority": 1}],
  "designPlan": {"style": "Apple Style", "layout": "Mobile First", "theme": "主题", "spacing": "24px", "notes": ["设计说明"]},
  "skillId": "使用的 skill id"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            datasetName: params.dataset.name,
            datasets: datasets.map((dataset) => compactDatasetForAgent(dataset, { maxSampleValues: 2 })),
            intent: params.intent,
            dataUnderstanding: params.dataUnderstanding,
            metricSystem: params.metricSystem,
            metricContracts: params.metricContracts ?? [],
            dimensionContracts: params.dimensionContracts ?? [],
            dashboardSkill: params.skill,
            referenceImageAnalysis: params.imageAnalysis,
            preferredTheme: params.theme ?? "system",
            promptSettings: params.promptSettings ?? "",
            instruction:
              "如果存在多个 Dataset，规划时可以把不同模块分配给不同数据源；fields 必须使用 metricContracts / dimensionContracts 中存在的字段。Blueprint 只规划字段和分析口径，不要写任何具体数值。优先规划运营监控式信息路径：KPI 总览、原因分析、责任定位、明细行动。对于服务/产品/内容/基建运营类看板，必须 section 化组织，不要平均铺图；数据缺失模块用 empty_state 规划待接入说明。若存在 time 维度，顶部 KPI 必须规划最近两期对比口径，用于展示较上期变化。",
          },
          null,
          2,
        ),
      },
    ],
  });
}
