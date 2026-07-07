import type { DashboardSkill } from "@/lib/types";

export const commonDashboardSkill: DashboardSkill = {
  id: "common-dashboard",
  name: "通用 Dashboard Skill",
  domains: ["general", "operations", "marketing", "unknown"],
  businessRules: [
    "优先回答用户的业务目标，而不是堆叠图表。",
    "如果用户意图不清晰，基于 Dataset 字段做最合理的经营分析假设。",
    "避免声明无法从 sample rows 支撑的精确结论。",
  ],
  kpiRules: [
    "顶部必须放 KPI。",
    "KPI 应优先选择可聚合的数值字段。",
    "KPI 数量控制在 3 到 5 个。",
  ],
  chartRules: [
    "趋势分析默认使用 line chart。",
    "分类对比默认使用 bar chart。",
    "占比构成默认使用 donut chart。",
    "明细或异常解释可以使用 table 或 insight card。",
  ],
  layoutRules: [
    "Mobile First。",
    "KPI first，趋势 second，分类/贡献 third。",
    "使用 24px spacing rhythm。",
  ],
  designRules: [
    "Apple inspired style。",
    "Minimal、Professional、Responsive。",
    "16px card radius。",
    "最多 5 种主色。",
    "不要渐变背景，不要 3D 图。",
  ],
  promptExtension: "生成结果应像一份决策型 Dashboard，而不是图表样例集合。",
};
