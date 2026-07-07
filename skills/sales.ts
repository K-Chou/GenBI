import type { DashboardSkill } from "@/lib/types";

export const salesDashboardSkill: DashboardSkill = {
  id: "sales-executive",
  name: "Sales Executive Dashboard Skill",
  domains: ["sales", "revenue", "retail", "commerce"],
  businessRules: [
    "必须优先分析 Revenue、Growth、Region、Product、Profit。",
    "关注销售表现、区域机会、产品贡献和盈利质量。",
    "如果存在日期字段，必须规划趋势分析。",
    "如果存在区域或产品字段，必须规划分类对比或贡献分析。",
  ],
  kpiRules: [
    "顶部 KPI 优先包括销售额、利润、订单/数量、增长或客单价。",
    "如果字段不足，以最接近的数值字段替代，并保持命名克制。",
    "KPI 文案必须面向经营决策。",
  ],
  chartRules: [
    "销售趋势使用 line chart。",
    "区域、渠道、产品排名使用 bar chart。",
    "产品或区域贡献使用 donut chart。",
    "风险和机会可以使用 insight card。",
  ],
  layoutRules: [
    "第一屏必须先展示 Executive KPI。",
    "第二层展示销售趋势。",
    "第三层展示区域/产品表现和贡献结构。",
    "最后可展示关键洞察或明细摘要。",
  ],
  designRules: [
    "Apple Style。",
    "高管可读，少颜色，强层级。",
    "数字要大，解释要短。",
    "避免复杂筛选器和传统 BI 控件。",
  ],
  promptExtension: "Dashboard 应像销售负责人每天查看的经营驾驶舱，突出表现、机会和风险。",
};
