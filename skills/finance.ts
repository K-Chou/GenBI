import type { DashboardSkill } from "@/lib/types";

export const financeDashboardSkill: DashboardSkill = {
  id: "finance-performance",
  name: "Finance Performance Dashboard Skill",
  domains: ["finance", "financial", "cost", "budget", "margin", "profit"],
  businessRules: [
    "必须关注收入、成本、利润、利润率、预算或目标差距。",
    "优先解释财务表现变化和结构性原因。",
    "所有金额指标必须尽量标注单位或币种。",
  ],
  kpiRules: [
    "顶部 KPI 优先包括 Revenue、Cost、Profit、Margin、Budget Variance。",
    "KPI 必须提供目标、环比、同比或差异解释。",
    "利润率、成本率等比例指标应与金额指标搭配展示。",
  ],
  chartRules: [
    "财务趋势使用 line chart。",
    "费用、成本中心、区域或产品对比使用 bar chart。",
    "成本结构或收入构成使用 donut chart。",
    "预算 vs 实际可用 bar 或 insight card 表达。",
  ],
  layoutRules: [
    "采用 Profitability First：财务 KPI + 收入/利润趋势 + 结构拆解 + 风险洞察。",
    "高层财务 Dashboard 不应塞入过多明细表。",
    "底部可展示预算偏差、异常成本或利润风险。",
  ],
  designRules: [
    "保持严肃、可信、简洁。",
    "颜色语义必须稳定：增长/改善为正向，亏损/超支为风险。",
    "避免使用装饰性图标或花哨动效。",
  ],
  promptExtension: "生成结果应帮助管理者快速理解盈利质量、成本压力和预算风险。",
};
