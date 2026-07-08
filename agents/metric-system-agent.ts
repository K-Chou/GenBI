import type {
  DataUnderstanding,
  DimensionContract,
  IntentUnderstanding,
  MetricContract,
  MetricSystem,
  SemanticModel,
} from "@/lib/types";
import { getMetricRecipeHints } from "@/lib/metric-recipes";
import { completeJson } from "@/services/deepseek";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[\s_\-:：/\\|]+/g, "");
}

function isIdentifierLikeMetric(metric: MetricContract) {
  return /(^id$|_id$|id$|uuid|guid|token|key|record|编号|编码|标识|唯一|主键|记录id|多维表标识)/i.test(metric.field);
}

function scoreMetricMatch(node: MetricSystem["primaryMetrics"][number], metric: MetricContract) {
  const nodeText = normalizeText([node.name, node.definition, node.businessQuestion, node.formula ?? ""].join(" "));
  const metricText = normalizeText([metric.label, metric.field, metric.as, metric.businessDefinition].join(" "));
  let score = 0;

  if (nodeText.includes(normalizeText(metric.label)) || metricText.includes(normalizeText(node.name))) score += 4;
  if (node.category === "efficiency" && /avg|平均|时长|耗时|响应|处理/.test(metricText)) score += 3;
  if (node.category === "volume" && metric.op === "count" && /count|数量|总量|工单|ticket|记录/.test(metricText)) score += 5;
  if (node.category === "volume" && metric.op === "sum" && !isIdentifierLikeMetric(metric) && /数量|总量|sum/.test(metricText)) score += 2;
  if (node.category === "quality" && /满意|质量|准确|评分|score|rating/.test(metricText)) score += 3;
  if (node.category === "risk" && /bug|风险|异常|投诉|逾期|未/.test(metricText)) score += 3;

  for (const token of normalizeText(node.name).match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{3,}/g) ?? []) {
    if (metricText.includes(token)) score += 1;
  }

  return score;
}

function scoreDimensionMatch(node: MetricSystem["primaryMetrics"][number], dimension: DimensionContract) {
  const nodeText = normalizeText([node.name, node.definition, node.businessQuestion].join(" "));
  const dimensionText = normalizeText([dimension.label, dimension.field, dimension.role].join(" "));
  let score = 0;

  if (nodeText.includes(dimensionText) || dimensionText.includes(normalizeText(node.name))) score += 3;
  if (/状态|status|state|完成|解决|关闭/.test(nodeText) && dimension.role === "status") score += 3;
  if (/负责人|团队|人员|owner|assignee/.test(nodeText) && dimension.role === "owner") score += 3;
  if (/趋势|月|周|日|时间|date|time/.test(nodeText) && dimension.role === "time") score += 3;
  if (/来源|类型|分类|渠道|category|type/.test(nodeText) && dimension.role === "category") score += 2;

  return score;
}

function sanitizeMetricSystem(params: {
  metricSystem: MetricSystem;
  metricContracts?: MetricContract[];
  dimensionContracts?: DimensionContract[];
}) {
  const metricContracts = params.metricContracts ?? [];
  const dimensionContracts = params.dimensionContracts ?? [];
  const metricIds = new Set(metricContracts.map((metric) => metric.id));
  const metricAliases = new Set(metricContracts.map((metric) => metric.as));
  const dimensionIds = new Set(dimensionContracts.map((dimension) => dimension.id));

  function sanitizeNode(node: MetricSystem["primaryMetrics"][number]): MetricSystem["primaryMetrics"][number] {
    return {
      ...node,
      children: node.children?.map(sanitizeNode),
      contractRefs: (node.contractRefs ?? []).filter((ref) => metricIds.has(ref) || metricAliases.has(ref)),
      dimensionRefs: (node.dimensionRefs ?? []).filter((ref) => dimensionIds.has(ref)),
      executable: (node.contractRefs ?? []).some((ref) => metricIds.has(ref) || metricAliases.has(ref)),
      priority: Math.max(1, Math.min(10, Math.round(node.priority || 5))),
      confidence: Math.max(0.1, Math.min(1, node.confidence || 0.6)),
    };
  }

  return {
    ...params.metricSystem,
    actionMetrics: (params.metricSystem.actionMetrics ?? []).map(sanitizeNode),
    diagnosticMetrics: (params.metricSystem.diagnosticMetrics ?? []).map(sanitizeNode),
    northStarMetric: params.metricSystem.northStarMetric ? sanitizeNode(params.metricSystem.northStarMetric) : undefined,
    primaryMetrics: (params.metricSystem.primaryMetrics ?? []).map(sanitizeNode),
    recommendedDimensions: (params.metricSystem.recommendedDimensions ?? []).filter((dimension) => dimensionIds.has(dimension.id)),
  };
}

export function bindMetricSystemToContracts(params: {
  dimensionContracts: DimensionContract[];
  metricContracts: MetricContract[];
  metricSystem: MetricSystem;
}): MetricSystem {
  function bindNode(node: MetricSystem["primaryMetrics"][number]): MetricSystem["primaryMetrics"][number] {
    const metricMatches = params.metricContracts
      .map((metric) => ({ metric, score: scoreMetricMatch(node, metric) }))
      .filter((item) => item.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.metric);
    const dimensionMatches = params.dimensionContracts
      .map((dimension) => ({ dimension, score: scoreDimensionMatch(node, dimension) }))
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.dimension);

    return {
      ...node,
      children: node.children?.map(bindNode),
      contractRefs: metricMatches.map((metric) => metric.as),
      dimensionRefs: dimensionMatches.map((dimension) => dimension.id),
      executable: metricMatches.length > 0,
      limitations: metricMatches.length > 0 ? node.limitations : [...node.limitations, "当前数据契约未找到可直接支撑该专家指标的字段。"],
    };
  }

  const boundSystem: MetricSystem = {
    ...params.metricSystem,
    actionMetrics: params.metricSystem.actionMetrics.map(bindNode),
    diagnosticMetrics: params.metricSystem.diagnosticMetrics.map(bindNode),
    northStarMetric: params.metricSystem.northStarMetric ? bindNode(params.metricSystem.northStarMetric) : undefined,
    primaryMetrics: params.metricSystem.primaryMetrics.map(bindNode),
    recommendedDimensions: params.dimensionContracts.slice(0, 10).map((dimension) => ({
      field: dimension.field,
      id: dimension.id,
      label: dimension.label,
      reason: `可用于${dimension.role === "time" ? "趋势分析" : dimension.role === "status" ? "状态拆解" : "维度分解"}。`,
      role: dimension.role,
    })),
  };

  return sanitizeMetricSystem({
    dimensionContracts: params.dimensionContracts,
    metricContracts: params.metricContracts,
    metricSystem: boundSystem,
  });
}

export async function runMetricSystemAgent(params: {
  dataUnderstanding: DataUnderstanding;
  dimensionContracts?: DimensionContract[];
  intent: IntentUnderstanding;
  metricContracts?: MetricContract[];
  previousMetricSystem?: MetricSystem;
  semanticModel: SemanticModel;
  userRequest: string;
}): Promise<MetricSystem> {
  const metricRecipeHints = getMetricRecipeHints({
    semanticModel: params.semanticModel,
    userRequest: params.userRequest,
  });

  const result = await completeJson<MetricSystem>({
    stage: "planning",
    temperature: 0.08,
    messages: [
      {
        role: "system",
        content: `你是 Metric System Agent，也是资深 BI 指标体系顾问。
你的任务分两种模式：
1. Expert Mode：当没有 metricContracts 时，先从专家视角生成理想指标体系，不被当前字段完全限制。
2. Binding Mode：当有 metricContracts / dimensionContracts 时，把专家指标体系绑定到可执行口径，区分 executable 与 metricGaps。

严格规则：
- 只返回 JSON，不要 Markdown。
- Expert Mode 可以提出专业指标、公式和所需字段，但 contractRefs / dimensionRefs 必须为空，executable=false，不能伪装成已可执行。
- Binding Mode 不能发明字段，contractRefs 只能引用 metricContracts[].id 或 metricContracts[].as；dimensionRefs 只能引用 dimensionContracts[].id。
- 复杂比率、完成率、满意率等如果当前契约不能直接计算，必须标记 executable=false 或用可追溯 fallback，不要伪造成可执行精确指标。
- 指标体系必须分层：north_star、primary、diagnostic、action。
- 每个指标必须回答一个业务问题，而不是只复述字段名。
- metricGaps 必须列出用户想要但当前数据不足的指标、缺失字段和 fallback。
- 指标体系优先于展示：不要选择 ECharts 组件，不要规划页面布局，只定义业务指标树和口径逻辑。
- 工单/客服运营场景必须优先建立四类指标：规模与积压、流转效率、解决质量、人员效率。
- 工单/客服运营的 primaryMetrics 建议包含：工单总量/新增量、关闭/解决量、待处理/未解决量、平均响应/处理/解决时长、客服人员处理量或人均处理效率。
- 如果存在时间字段，必须把趋势变化、较上期变化、近期波动作为 businessQuestion/definition 的一部分；但不要生成具体同比环比数值。
- 如果缺少状态、时间、处理人、响应/解决时长字段，必须在 metricGaps 中明确说明这些缺口会影响闭环率、增长率和人员效率分析。

JSON schema:
{
  "title": "指标体系标题",
  "domain": "业务域",
  "northStarMetric": {"id":"north_star_1","name":"北极星指标","level":"north_star","category":"volume | efficiency | quality | conversion | risk | cost | satisfaction | other","businessQuestion":"回答的问题","definition":"指标定义","formula":"可选公式","contractRefs":["metric id or as"],"dimensionRefs":["dimension id"],"priority":1,"confidence":0.8,"executable":true,"limitations":[],"children":[]},
  "primaryMetrics": [],
  "diagnosticMetrics": [],
  "actionMetrics": [],
  "recommendedDimensions": [{"id":"dimension id","label":"维度名","role":"category | time | status | owner | geo | unknown","field":"字段名","reason":"为什么推荐"}],
  "metricGaps": [{"name":"缺口指标","reason":"为什么缺","requiredFields":["字段"],"fallback":"当前可替代表达"}],
  "narrative": "中文说明：这套指标体系如何支撑决策"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            userRequest: params.userRequest,
            intent: params.intent,
            dataUnderstanding: params.dataUnderstanding,
            semanticModel: params.semanticModel,
            previousMetricSystem: params.previousMetricSystem,
            metricContracts: params.metricContracts ?? [],
            dimensionContracts: params.dimensionContracts ?? [],
            metricRecipeHints,
          },
          null,
          2,
        ),
      },
    ],
  });

  return sanitizeMetricSystem({
    metricSystem: result,
    metricContracts: params.metricContracts,
    dimensionContracts: params.dimensionContracts,
  });
}
