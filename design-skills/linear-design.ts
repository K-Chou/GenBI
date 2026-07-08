import type { DesignSkill } from "@/lib/types";

export const linearDesignSkill: DesignSkill = {
  id: "linear-design",
  name: "Linear Design",
  bestFor: ["operational dashboard", "issue tracking", "workflow analytics", "product operations", "engineering metrics"],
  visualPrinciples: [
    "速度和清晰度优先，界面密度可以更高，但必须保持对齐和低噪音。",
    "通过细边框、明确分组、状态 badge 和紧凑列表帮助用户快速定位问题。",
    "强调工作流状态、责任定位、优先级和下一步行动，而不是纯展示。",
    "视觉克制、锐利、工程化，避免传统后台的厚重和杂乱。",
    "遵循 Keyboard-first、High-density、Speed、Restraint、Command palette、Contextual action。",
  ],
  layoutRules: [
    "适合 operational_monitoring 和 overview_focus_detail。",
    "使用 section 化布局：状态总览 -> 队列/分类 -> 责任定位 -> 明细行动。",
    "可使用 compact density；KPI 可 2/3/4 栏，图表多用 4/6 栏，表格和队列 12 栏。",
    "横向柱图、堆叠柱图和表格适合作为核心组件。",
  ],
  colorRules: [
    "主色克制，优先 neutral/slate/zinc + indigo/blue。",
    "状态色稳定：emerald 正常，amber 关注，rose 风险，slate 中性。",
    "允许轻微深色模式，但背景应保持可长时间阅读，不做霓虹风。",
    "颜色用于状态和优先级，不用于装饰。",
  ],
  typographyRules: [
    "字体层级紧凑：标题 24-30px，section 15-18px，正文 13-14px，说明 11-12px。",
    "数字和表格字段使用 tabular-nums；列表和表格要保证行高一致。",
    "标题直接表达业务对象，例如“未关闭 BUG 来源分布”，不要泛泛写“来源图表”。",
  ],
  componentRules: [
    "卡片圆角 10-16px，边框清晰，阴影极弱或无阴影。",
    "多使用 badge、pill、状态标签、紧凑 toolbar 和表格明细。",
    "KPI group 适合表达已完成/总数、待处理/处理中等成组状态。",
    "运营台、任务台和工单台应优先提供列表、队列、筛选、状态切换和行内操作。",
  ],
  chartRules: [
    "分类和责任定位优先 horizontal_bar。",
    "状态拆解优先 stacked_bar 或 horizontal_stacked_bar。",
    "趋势图只在真实日期字段存在时使用；不要为了美观伪造趋势。",
    "图表标签要短，长标签优先横向图。",
  ],
  interactionRules: [
    "高频操作应为快捷键、命令菜单、右键菜单或行内操作预留入口。",
    "支持 Cmd/Ctrl + K 式全局命令入口的设计暗示，可在工具栏或提示文案中表达。",
    "用户选中某条数据时，只展示与该数据相关的上下文操作。",
    "批量处理、快速筛选、状态切换和更多菜单应优先服务工作流效率。",
    "动效短促精确，建议 100-300ms，只表达完成、移动、展开或重排。",
  ],
  dataRules: [
    "表格、列表、队列和任务状态应支持高密度扫描。",
    "状态字段应标签化；优先级、负责人、截止时间和状态变化应便于定位。",
    "不要让用户为了定位问题在多个页面之间反复跳转。",
  ],
  stateRules: [
    "深色主题可采用多层深色面板和细边框，不使用重阴影。",
    "选中态、焦点态、hover 态和批量选择态必须清楚。",
  ],
  avoidRules: ["不要过大留白导致监控效率低", "不要卡片阴影过重", "不要过多 donut", "不要将状态色用于装饰", "不要过度紧凑到新手无法扫读"],
  antiCopyRules: [
    "不复制 Linear 的深色品牌、紫色风格、商标或具体产品结构。",
    "只抽象高密度、命令入口、上下文操作、状态流转和视觉克制。",
  ],
  tokenHints: {
    light: {
      accent: "#0891B2",
      background: "#FAFAFA",
      border: "rgba(24,24,27,0.10)",
      muted: "#71717A",
      primary: "#4F46E5",
      surface: "#FFFFFF",
      text: "#18181B",
    },
    dark: {
      accent: "#22D3EE",
      background: "#09090B",
      border: "rgba(244,244,245,0.12)",
      muted: "#A1A1AA",
      primary: "#818CF8",
      surface: "#18181B",
      text: "#FAFAFA",
    },
    density: "dense",
    radius: 14,
    shadow: "subtle",
  },
};
