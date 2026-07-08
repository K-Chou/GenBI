import type { DashboardSkill } from "@/lib/types";

export const serviceProductOperationsSkill: DashboardSkill = {
  id: "service-product-operations",
  name: "Service & Product Operations Dashboard Skill",
  domains: [
    "服务运营",
    "产品运营",
    "内容运营",
    "基建服务",
    "voc",
    "工单",
    "投诉",
    "需求",
    "backlog",
    "bug",
    "ai服务",
    "客服",
    "operation",
    "support",
  ],
  businessRules: [
    "优先按多域运营总览组织：服务运营、产品运营、内容运营、基建服务；如果数据只覆盖其中一部分，只生成可由真实字段支撑的模块。",
    "服务运营关注 AI 问答响应时长、问题解决率、推荐准确率、回答满意率、服务机器人工单数、工单完结率、状态分布、投诉类型和 VOC 来源。",
    "产品运营关注运营任务完成率、任务数量、任务类型分布、人工干预次数、需求完成率、需求类型、需求来源和状态拆解。",
    "质量/研发运营关注 BUG 解决率、BUG 类型分布、BUG 来源分布、状态拆解和待处理风险。",
    "内容运营和基建服务数据不足时允许生成 empty_state，但必须说明缺少哪些数据，不允许用 0 或虚构值冒充真实指标。",
  ],
  kpiRules: [
    "首屏优先放 5 个以内核心 KPI；多域运营密集屏可扩展到 6 个，但必须保持同一行节奏。",
    "KPI 候选优先级：响应时长、解决率、准确率、满意率、工单数、完结率、任务完成率、需求完成率、BUG 解决率。",
    "比率类指标必须来自明确的分子/分母或状态字段；没有分母时不要生成百分比 KPI。",
    "KPI 卡片标题使用业务语义，不直接暴露字段名；description 必须写明单位、统计周期或口径。",
  ],
  chartRules: [
    "少量状态/构成使用 donut；同一屏 donut 不超过 2 个，超过后改用 bar。",
    "来源分布、类型分布、任务/需求/BUG 分类优先使用 bar 或 horizontal_bar。",
    "按状态拆解的任务、需求、BUG 来源分布优先使用 stacked_bar 或 horizontal_stacked_bar。",
    "月度趋势必须有真实月份/日期字段；否则不要生成累计趋势图。",
    "人工干预、责任定位、来源渠道对比优先使用 horizontal_bar，便于长标签阅读。",
  ],
  layoutRules: [
    "使用 12 栏 Grid；dashboard_title 和 section_title 固定 span 12；双域并排标题可 span 6。",
    "紧凑运营看板中 KPI 可使用 span 2；默认管理汇报看板中 KPI 使用 span 3 或 4。",
    "每个模块采用：section_title -> KPI/KPI group -> distribution charts；不要把所有图表平铺在一个无层级区域。",
    "服务运营模块建议：5 个顶部 KPI -> VOC/工单发现 section -> 工单完结率/关闭量/状态统计 -> 工单分布/投诉类型/VOC 来源。",
    "产品运营模块建议：运营任务 section -> 任务完成率/KPI group -> 任务类型分布/人工干预；Backlog section -> 完成率/KPI group -> 类型/来源状态；BUG section 同理。",
    "数据缺失模块用 empty_state 卡片占位，展示待接入主题，不生成空白图表。",
  ],
  designRules: [
    "颜色采用主流 SaaS/BI Dashboard palette，不绑定固定样本色：浅色用 white/slate/zinc + indigo/blue/cyan/emerald/amber/rose；深色用 slate/navy/neutral + indigo/cyan/emerald/amber/rose。",
    "颜色只承担三类职责：主指标强调、状态语义、分组区分；不要为了装饰增加高饱和颜色。",
    "紧凑运营密度使用 compact：卡片 padding 16-20px、圆角 12-18px、标题更短、图表高度统一。",
    "深色看板只有在用户偏好 dark、运营大屏、监控值班或参考图明显为深色时使用；深色可以有 soft glow，但不要霓虹化或大面积渐变。",
    "图表 palette 控制在 5 种以内，语义稳定：indigo/blue 表示主指标，cyan/emerald 表示正常或达标，amber 表示关注，rose/red 表示风险，slate/gray 表示中性。",
  ],
  promptExtension:
    "该 Skill 来源于多域运营看板样本：服务运营、产品运营、内容运营、基建服务。生成链路应先确认真实字段能支持哪些指标，再按 section 化 Grid Blueprint 组织组件，最后由 Designer 输出主流高质量 SaaS/BI 风格 token；颜色可变，但信息层级、Grid 节奏和图表可读性必须稳定。",
};
