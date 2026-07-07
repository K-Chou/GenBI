import type { DashboardSkill } from "@/lib/types";

export const analyticalDashboardSkill: DashboardSkill = {
  id: "analytical-dashboard",
  name: "Analytical Dashboard Skill",
  domains: ["analysis", "analytical", "diagnosis", "insight", "exploration"],
  businessRules: [
    "Dashboard 必须围绕一个清晰分析问题展开。",
    "结构应遵循：发生了什么、为什么发生、下一步看哪里。",
    "优先解释驱动因素，而不是只展示结果。",
  ],
  kpiRules: [
    "KPI 用于给出问题背景，不宜超过 4 个。",
    "KPI 必须与后续趋势、分类或构成图形成解释关系。",
    "如果缺少对比基准，应在文案中说明 sample 限制。",
  ],
  chartRules: [
    "趋势用 line chart，必要时加入移动平均或趋势说明。",
    "分类对比用 bar chart，优先水平条形图展示 Top N。",
    "构成用 donut chart，但只在分类数量较少时使用。",
    "需要精确值或样例时使用 table，不把 table 放在首屏核心。",
  ],
  layoutRules: [
    "采用 Overview + Focus + Detail 结构。",
    "顶部概览，中部解释性图表，底部细节和洞察。",
    "每个 section 必须有 purpose，不允许无意义图表。",
  ],
  designRules: [
    "视觉层级清晰，图表标题必须描述业务问题。",
    "使用注释、短句和 insight card 帮助理解。",
    "颜色用于强调异常、趋势和分组，不做装饰。",
  ],
  promptExtension: "生成结果应像分析师写给业务方的可视化分析报告，必须体现分析路径。",
};
