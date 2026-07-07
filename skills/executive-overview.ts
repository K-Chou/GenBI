import type { DashboardSkill } from "@/lib/types";

export const executiveOverviewSkill: DashboardSkill = {
  id: "executive-overview",
  name: "Executive Overview Dashboard Skill",
  domains: ["executive", "overview", "management", "ceo", "vp", "leadership"],
  businessRules: [
    "Dashboard 必须服务高层决策，而不是展示所有可用数据。",
    "优先回答：当前表现如何、变化趋势如何、哪里需要关注。",
    "所有模块都必须围绕经营状态、增长、风险和机会组织。",
  ],
  kpiRules: [
    "顶部展示 3 到 5 个最关键 KPI。",
    "主 KPI 放在左上或顶部第一个位置。",
    "KPI 必须包含上下文：环比、同比、目标差距或趋势方向。",
    "KPI 文案要短，数字要大，解释要克制。",
  ],
  chartRules: [
    "核心趋势使用 line chart，放在 KPI 下方。",
    "关键业务拆解使用 bar chart，优先 Top N。",
    "构成类信息使用 donut chart，分类不超过 6 个。",
    "避免把明细表作为主要视觉元素。",
  ],
  layoutRules: [
    "使用 Executive Summary：KPI strip + trend focus + breakdown grid。",
    "遵循 F-pattern：最重要信息放在顶部和左侧。",
    "首屏必须能看懂整体经营状态。",
    "底部使用 insight card 总结机会、风险和建议。",
  ],
  designRules: [
    "Apple inspired、简洁、高端、克制。",
    "保留大量留白，避免信息密度过高。",
    "最多使用 5 种颜色，强调色只用于关键状态。",
    "适合投屏、汇报和高层快速阅读。",
  ],
  promptExtension: "生成结果应像高管每日经营简报，优先呈现结论和异常，而不是图表堆叠。",
};
