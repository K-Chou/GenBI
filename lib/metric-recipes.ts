import type { SemanticModel } from "@/lib/types";

export type MetricRecipeHint = {
  id: string;
  label: string;
  intentKeywords: string[];
  preferredFields: string[];
  preferredOps: Array<"sum" | "avg" | "count" | "min" | "max">;
  dimensionKeywords: string[];
  businessDefinition: string;
  limitation: string;
};

export const metricRecipeLibrary: MetricRecipeHint[] = [
  {
    id: "ticket_volume",
    label: "工单量",
    intentKeywords: ["工单", "ticket", "case", "服务"],
    preferredFields: ["工单", "ticket", "id", "编号", "数量"],
    preferredOps: ["count", "sum"],
    dimensionKeywords: ["状态", "类型", "来源", "团队", "负责人"],
    businessDefinition: "统计工单或服务请求规模，优先 count 唯一记录或 sum 数量字段。",
    limitation: "如果缺少唯一工单标识，只能按行数近似统计。",
  },
  {
    id: "response_time",
    label: "响应时长",
    intentKeywords: ["响应", "时长", "耗时", "response"],
    preferredFields: ["响应时长", "response", "耗时", "时长", "duration"],
    preferredOps: ["avg", "max"],
    dimensionKeywords: ["服务组", "团队", "负责人", "类型"],
    businessDefinition: "衡量服务响应效率，优先使用平均响应时长。",
    limitation: "需要确认单位是秒、分钟还是小时。",
  },
  {
    id: "ticket_backlog",
    label: "待处理/未解决工单",
    intentKeywords: ["待处理", "未解决", "积压", "backlog", "处理中", "未关闭", "工单"],
    preferredFields: ["状态", "阶段", "处理状态", "关闭", "解决", "完成", "status"],
    preferredOps: ["count"],
    dimensionKeywords: ["状态", "优先级", "类型", "处理人", "客服", "团队"],
    businessDefinition: "用状态字段拆解未关闭、待处理、处理中等工单规模，衡量当前服务积压和风险。",
    limitation: "需要明确哪些状态属于未解决或积压；当前只能先做状态拆解和数量口径。",
  },
  {
    id: "agent_efficiency",
    label: "客服人员处理效率",
    intentKeywords: ["客服", "人员", "处理人", "效率", "人效", "agent", "assignee", "owner"],
    preferredFields: ["工单", "编号", "处理时长", "响应时长", "解决时长", "数量"],
    preferredOps: ["count", "avg", "sum"],
    dimensionKeywords: ["客服", "处理人", "负责人", "人员", "团队", "owner", "assignee"],
    businessDefinition: "按客服人员/处理人统计处理量、未解决量或平均处理时长，用于评估个人和团队效率。",
    limitation: "如果缺少处理人字段，只能按团队、状态或类型做替代拆解。",
  },
  {
    id: "period_change",
    label: "较上期变化",
    intentKeywords: ["增长", "变化", "趋势", "环比", "同比", "最近", "本期", "上期"],
    preferredFields: ["创建时间", "提交时间", "关闭时间", "解决时间", "日期", "时间", "date", "time"],
    preferredOps: ["count", "sum", "avg"],
    dimensionKeywords: ["日期", "时间", "月份", "周", "创建时间", "关闭时间"],
    businessDefinition: "基于时间维度返回最近两期聚合结果，由渲染层计算较上期变化，避免模型手写增长率。",
    limitation: "需要可用时间字段；如果只有静态截面数据，不能计算真实增长率。",
  },
  {
    id: "completion_rate",
    label: "完成率/解决率",
    intentKeywords: ["完成率", "解决率", "完结率", "关闭率", "达成率", "率"],
    preferredFields: ["状态", "完成", "解决", "关闭", "完结", "status"],
    preferredOps: ["count"],
    dimensionKeywords: ["状态", "类型", "来源", "月份"],
    businessDefinition: "用完成/解决/关闭状态记录数除以总记录数表达完成率；当前协议不足时先提供状态拆解和数量口径。",
    limitation: "当前 MetricContract 仅支持单字段聚合，复杂比率需由后续 expression recipe 支持。",
  },
  {
    id: "satisfaction",
    label: "满意度/满意率",
    intentKeywords: ["满意", "评分", "score", "rating", "评价"],
    preferredFields: ["满意", "评分", "评价", "score", "rating"],
    preferredOps: ["avg", "count"],
    dimensionKeywords: ["渠道", "服务组", "类型", "月份"],
    businessDefinition: "衡量用户反馈质量，数值评分优先 avg，枚举满意状态优先 count 后做状态拆解。",
    limitation: "如果满意度是文本枚举，不能直接平均。",
  },
  {
    id: "bug_resolution",
    label: "BUG 解决情况",
    intentKeywords: ["bug", "缺陷", "问题", "解决"],
    preferredFields: ["bug", "缺陷", "状态", "解决", "数量"],
    preferredOps: ["count", "sum"],
    dimensionKeywords: ["状态", "类型", "来源", "优先级", "负责人"],
    businessDefinition: "统计 BUG 总量、状态分布和解决情况。",
    limitation: "解决率需要明确已解决状态和总量分母。",
  },
];

function includesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function getMetricRecipeHints(params: {
  semanticModel: SemanticModel;
  userRequest: string;
}) {
  const fieldNames = [
    ...params.semanticModel.metrics.map((metric) => metric.field),
    ...params.semanticModel.dimensions.map((dimension) => dimension.field),
  ].join(" ");

  return metricRecipeLibrary
    .filter((recipe) => includesAny(params.userRequest, recipe.intentKeywords) || includesAny(fieldNames, recipe.preferredFields))
    .map((recipe) => ({
      ...recipe,
      matchedMetricCandidates: params.semanticModel.metrics
        .filter((metric) => includesAny(metric.field, recipe.preferredFields) && recipe.preferredOps.includes(metric.op))
        .slice(0, 5),
      matchedDimensionCandidates: params.semanticModel.dimensions
        .filter((dimension) => includesAny(dimension.field, recipe.dimensionKeywords))
        .slice(0, 5),
    }));
}
