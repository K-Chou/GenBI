import type { DesignSkill } from "@/lib/types";

export const appleDesignLanguageSkill: DesignSkill = {
  id: "apple-design-language",
  name: "Apple Design Language",
  bestFor: ["executive overview", "management report", "premium SaaS", "consumer-grade analytics", "high polish"],
  visualPrinciples: [
    "内容优先，界面退后；每屏只强调一个主要阅读路径。",
    "使用大留白、低噪音边框、柔和阴影和清晰层级，营造轻盈、安静、可信的体验。",
    "KPI 数字要像产品主角一样清晰，大数字、短标题、明确单位和口径说明。",
    "减少装饰性元素，避免为了高级感加入无意义图形、过度图标或强背景。",
    "遵循 Clarity、Deference、Depth、Familiarity、Simplicity、Craft：清晰、内容优先、空间层级、符合直觉、减少摩擦和细节一致。",
  ],
  layoutRules: [
    "适合 executive_overview、kpi_hero_chart 和 overview_focus_detail。",
    "首屏采用宽松节奏：标题区 -> KPI strip -> 主趋势/主分布 -> 辅助诊断。",
    "核心卡片之间保持稳定 gap，桌面 12 栏，移动端单列，避免密集小卡片过多。",
    "主要图表优先 6/8/12 栏，辅助卡片 3/4/6 栏。",
  ],
  colorRules: [
    "浅色优先：#F5F5F7/#F8FAFC 背景，白色或半透明白 surface。",
    "主色使用 indigo/blue/cyan 中的一种，其他颜色只用于状态和分组。",
    "中性色对比要清晰但不刺眼，正文使用 slate-900，辅助文字 slate-500/600。",
    "避免大面积高饱和色块和渐变背景。",
  ],
  typographyRules: [
    "使用 Inter，标题 30-36px，KPI 数字 40-48px，正文 14px，说明 12px。",
    "数字使用 tabular-nums，并保持同一行 KPI 的基线和字号一致。",
    "标题要短、业务化，说明负责解释口径，不堆叠长句。",
  ],
  componentRules: [
    "卡片圆角 18-24px，极浅阴影，细边框。",
    "KPI 卡片要包含标题、数字、单位/口径、趋势或状态，不要堆太多 secondary 文案。",
    "空状态要友好、克制，说明缺少什么数据以及下一步接入方向。",
    "筛选器、按钮、钻取入口应让位于数据本身，不应抢过图表和核心指标。",
  ],
  chartRules: [
    "图表轴线极简，网格线极浅，tooltip 柔和。",
    "折线图可 smooth；柱状图圆角 8-12px；donut 只用于少量构成。",
    "图例尽量 compact 或隐藏，直接通过标题和颜色说明降低认知负担。",
    "图表标题、单位、对比周期和口径必须清楚，避免用户猜测指标含义。",
  ],
  interactionRules: [
    "相同外观的交互元素必须有相同行为。",
    "常见动作使用熟悉模式，例如返回、筛选、展开、确认、撤销。",
    "弹层、抽屉、切换和展开只用短促动效解释上下文变化，不做炫技动画。",
  ],
  dataRules: [
    "首屏重点指标必须高度可读，单位、周期和口径明确。",
    "异常、弹窗和钻取应通过空间层级表达上下文。",
    "不为了简洁删除必要的数据口径和明细入口。",
  ],
  stateRules: [
    "空状态、错误状态和加载状态要保持克制且说明下一步。",
    "状态反馈用空间层级、文案和少量语义色表达，不依赖大面积色块。",
  ],
  avoidRules: ["不要 3D", "不要大面积渐变", "不要玻璃拟态过度", "不要花哨动效", "不要为了高级感牺牲必要数据密度"],
  antiCopyRules: [
    "不复制 Apple 的系统组件外观、品牌资产、图标组合或专属动效。",
    "只抽象清晰层级、内容优先、空间关系和一致性原则。",
  ],
  tokenHints: {
    light: {
      accent: "#06B6D4",
      background: "#F5F5F7",
      border: "rgba(15,23,42,0.08)",
      muted: "#64748B",
      primary: "#4F46E5",
      surface: "rgba(255,255,255,0.92)",
      text: "#0F172A",
    },
    dark: {
      accent: "#22D3EE",
      background: "#0F172A",
      border: "rgba(148,163,184,0.18)",
      muted: "#94A3B8",
      primary: "#818CF8",
      surface: "#111827",
      text: "#F8FAFC",
    },
    density: "comfortable",
    radius: 22,
    shadow: "soft",
  },
};
