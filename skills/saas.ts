import type { DashboardSkill } from "@/lib/types";

export const saasDashboardSkill: DashboardSkill = {
  id: "saas-metrics",
  name: "SaaS Metrics Dashboard Skill",
  domains: ["saas", "subscription", "mrr", "arr", "churn", "retention", "product"],
  businessRules: [
    "必须关注增长、留存、流失、转化和收入健康度。",
    "优先回答：增长是否健康、用户是否留存、收入风险在哪里。",
    "如果存在漏斗字段或阶段字段，应规划转化分析。",
  ],
  kpiRules: [
    "顶部 KPI 优先包括 MRR/ARR、Active Users、Conversion、Churn、Retention。",
    "KPI 必须带趋势或目标上下文。",
    "对越低越好的指标，如 churn，应使用正确的正负语义。",
  ],
  chartRules: [
    "增长趋势使用 line chart。",
    "渠道、计划、地区或产品模块对比使用 bar chart。",
    "收入构成、用户来源或计划占比使用 donut chart。",
    "漏斗可用 bar/step-like section 表达，MVP 不强制复杂 funnel chart。",
  ],
  layoutRules: [
    "采用 Growth Health：增长 KPI + 趋势 + 分群对比 + 留存/流失洞察。",
    "不要把 SaaS Dashboard 做成纯财务报表。",
    "底部应给出增长机会和风险提示。",
  ],
  designRules: [
    "适合 SaaS 产品内嵌分析体验。",
    "现代、清晰、轻量，避免传统企业报表感。",
    "Dark Mode 下必须保持对比度和可读性。",
  ],
  promptExtension: "生成结果应像 SaaS 创始人或增长负责人查看的业务健康 Dashboard。",
};
