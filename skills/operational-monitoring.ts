import type { DashboardSkill } from "@/lib/types";

export const operationalMonitoringSkill: DashboardSkill = {
  id: "operational-monitoring",
  name: "Operational Monitoring Dashboard Skill",
  domains: ["operations", "operational", "monitoring", "ops", "support", "status"],
  businessRules: [
    "Dashboard 必须回答当前运行状态是否正常。",
    "优先展示异常、风险、瓶颈和需要行动的指标。",
    "使用短周期视角，避免过宽时间范围稀释监控价值。",
  ],
  kpiRules: [
    "顶部 KPI 应包含状态、总量、异常量、变化率或健康度。",
    "KPI 必须有状态提示：正常、关注、风险。",
    "高风险 KPI 应优先排序。",
  ],
  chartRules: [
    "趋势用 line chart，突出异常波动。",
    "分类问题定位用 bar chart。",
    "状态分布或占比用 donut chart。",
    "底部可使用 table 展示最近异常或 Top issues。",
  ],
  layoutRules: [
    "采用 Status First：状态 KPI + trend monitoring + issue breakdown + recent details。",
    "关键状态必须在首屏可见。",
    "Insight card 应给出下一步行动建议。",
  ],
  designRules: [
    "视觉要稳定、低噪音、可长时间查看。",
    "语义色必须一致：绿色正常，黄色关注，红色风险，灰色中性。",
    "不要用大面积红色或强动画制造焦虑。",
  ],
  promptExtension: "生成结果应像一个运营值班看板，帮助用户快速判断状态并定位问题。",
};
