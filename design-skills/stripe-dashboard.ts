import type { DesignSkill } from "@/lib/types";

export const stripeDashboardSkill: DesignSkill = {
  id: "stripe-dashboard",
  name: "Stripe Dashboard",
  bestFor: ["finance dashboard", "revenue analytics", "SaaS metrics", "payments", "business operations"],
  visualPrinciples: [
    "信息架构强，页面像一个可信的业务控制台：清晰导航、指标摘要、趋势、明细。",
    "使用精细的中性色系统、专业蓝紫主色和非常克制的辅助色，强调信任感。",
    "Dashboard 要支持业务决策：每个模块都要说明口径、周期、维度和行动含义。",
    "设计要像 production-grade SaaS console，而不是演示模板。",
    "遵循 Trust、Precision、Financial-grade forms、Data table first、Clear states、Progressive workflow。",
  ],
  layoutRules: [
    "适合 executive_overview、overview_focus_detail 和 analytical_editorial。",
    "结构优先：PageHeader -> Metric Summary -> Trend / Breakdown -> Table / Detail。",
    "财务、交易、转化、收入类指标优先主趋势图 + KPI summary + 明细表。",
    "表格和筛选区域要清晰，数值右对齐，列名简洁。",
  ],
  colorRules: [
    "浅色优先，背景使用 #F6F9FC 或 slate-50，surface 使用白色。",
    "主色使用 blue/indigo/violet，辅助色使用 cyan/emerald/amber/rose。",
    "使用 very subtle tinted surfaces 区分区域，但不要大面积彩色背景。",
    "风险、成功、关注状态使用语义色，不能混用。",
  ],
  typographyRules: [
    "标题清晰但不过大：Page title 28-34px，卡片标题 15-18px，正文 14px。",
    "金额、百分比、数量必须使用 tabular-nums，表格数字右对齐。",
    "指标说明应包含周期和口径，例如“近 30 天 · 基于真实底表聚合”。",
  ],
  componentRules: [
    "卡片圆角 12-18px，边框精细，阴影轻。",
    "KPI 卡片可以带小型 trend marker，但不要用花哨动画。",
    "表格、明细和 drilldown 是重要组成，不能只生成图表墙。",
    "表格应支持筛选、排序、分页、状态标签、导出和批量操作的设计暗示。",
    "金额、比例、日期、枚举、状态等字段要有明确格式。",
  ],
  chartRules: [
    "收入/转化/交易趋势优先 line 或 area line。",
    "来源、渠道、产品对比优先 bar；构成占比少量使用 donut。",
    "图表 tooltip 要明确单位和指标名；轴线保持专业、低噪音。",
  ],
  interactionRules: [
    "筛选器服务表格和图表，筛选项命名应与表格列名一致。",
    "激活筛选项应可见，并提供清除入口。",
    "高风险操作需要确认、预览后果或二次输入。",
    "长流程应拆成步骤、摘要确认和可返回入口，不把复杂任务塞进单个弹窗。",
  ],
  dataRules: [
    "KPI 之后必须有可追溯明细。",
    "每个图表最好能 drilldown 到对应记录。",
    "数字字段右对齐，状态字段标签化，重要字段可固定列。",
    "异常数据要能进入处理流程；报表导出、筛选持久化和权限边界应在设计中留出位置。",
  ],
  stateRules: [
    "必须考虑 loading、empty、error、processing、success、failed 状态。",
    "空状态要告诉用户下一步，而不是只显示“暂无数据”。",
    "错误提示应靠近发生问题的输入或组件。",
  ],
  avoidRules: ["不要使用粗重阴影", "不要高饱和大色块", "不要无口径指标", "不要只做视觉卡片而缺少明细", "不要把普通任务过度流程化"],
  antiCopyRules: [
    "不复制 Stripe 的品牌视觉、专属组件、金融业务假设或具体配色。",
    "只抽象强表格、强筛选、清晰状态、严谨表单和可追溯业务闭环。",
  ],
  tokenHints: {
    light: {
      accent: "#06B6D4",
      background: "#F6F9FC",
      border: "rgba(15,23,42,0.08)",
      muted: "#64748B",
      primary: "#635BFF",
      surface: "#FFFFFF",
      text: "#0F172A",
    },
    dark: {
      accent: "#22D3EE",
      background: "#0B1220",
      border: "rgba(148,163,184,0.18)",
      muted: "#94A3B8",
      primary: "#7C3AED",
      surface: "#111827",
      text: "#F8FAFC",
    },
    density: "balanced",
    radius: 16,
    shadow: "subtle",
  },
};
