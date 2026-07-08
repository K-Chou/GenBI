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

type MetricContractAgentResult = {
  dimensions: DimensionContract[];
  metrics: MetricContract[];
  rationale: string;
};

function getMetricKey(metric: MetricContract) {
  return `${metric.datasetId}:${metric.field}:${metric.op}:${metric.as}`;
}

function sanitizeMetricContracts(metrics: MetricContract[], semanticModel: SemanticModel) {
  const allowedMetrics = new Map(semanticModel.metrics.map((metric) => [getMetricKey(metric), metric]));
  const allowedByField = new Map(
    semanticModel.metrics.map((metric) => [`${metric.datasetId}:${metric.field}:${metric.op}`, metric]),
  );
  const sanitized: MetricContract[] = [];

  for (const metric of metrics) {
    const exact = allowedMetrics.get(getMetricKey(metric));
    if (exact) {
      sanitized.push({ ...exact, ...metric, source: "agent" });
      continue;
    }

    const fieldMatch = allowedByField.get(`${metric.datasetId}:${metric.field}:${metric.op}`);
    if (!fieldMatch) {
      continue;
    }

    sanitized.push({
        ...fieldMatch,
        id: metric.id || fieldMatch.id,
        label: metric.label || fieldMatch.label,
        as: metric.as || fieldMatch.as,
        businessDefinition: metric.businessDefinition || fieldMatch.businessDefinition,
        limitations: metric.limitations?.length ? metric.limitations : fieldMatch.limitations,
        source: "agent",
        confidence: Math.min(0.95, Math.max(0.5, metric.confidence || fieldMatch.confidence)),
    });
  }

  return sanitized;
}

function sanitizeDimensionContracts(dimensions: DimensionContract[], semanticModel: SemanticModel) {
  const allowed = new Map(semanticModel.dimensions.map((dimension) => [`${dimension.datasetId}:${dimension.field}`, dimension]));

  return dimensions
    .map((dimension) => {
      const base = allowed.get(`${dimension.datasetId}:${dimension.field}`);
      if (!base) {
        return null;
      }

      return {
        ...base,
        id: dimension.id || base.id,
        label: dimension.label || base.label,
        role: dimension.role || base.role,
        limitations: dimension.limitations?.length ? dimension.limitations : base.limitations,
      };
    })
    .filter((dimension): dimension is DimensionContract => Boolean(dimension));
}

function fallbackContracts(semanticModel: SemanticModel) {
  return {
    metrics: semanticModel.metrics.slice(0, 4),
    dimensions: semanticModel.dimensions.slice(0, 8),
  };
}

export async function runMetricContractAgent(params: {
  dataUnderstanding: DataUnderstanding;
  intent: IntentUnderstanding;
  metricSystem?: MetricSystem;
  semanticModel: SemanticModel;
  userRequest: string;
}): Promise<MetricContractAgentResult> {
  const metricRecipeHints = getMetricRecipeHints({
    semanticModel: params.semanticModel,
    userRequest: params.userRequest,
  });

  try {
    const result = await completeJson<MetricContractAgentResult>({
      stage: "planning",
      temperature: 0.05,
      messages: [
        {
          role: "system",
          content: `你是 Metric Contract Agent。
你的任务是从 SemanticModel 中选择最能支撑用户需求的可计算指标和维度。
严格规则：
- 只返回 JSON，不要 Markdown。
- metrics[].datasetId、field、op 必须来自 SemanticModel.metrics 中已存在的组合。
- dimensions[].datasetId、field 必须来自 SemanticModel.dimensions。
- 不允许发明字段、指标、数值、同比、环比、趋势结论。
- 如果没有合适数字指标，可以使用 count 指标表达数量或明细规模。
- ID、编号、编码、标识、多维表标识、record key 这类字段只能用于 count 记录数，不允许选择 sum/avg/min/max 来表达业务指标。
- 如果传入 expertMetricSystem，必须优先围绕它的 northStarMetric、primaryMetrics、diagnosticMetrics、actionMetrics 选择可执行口径。
- 对 expertMetricSystem 中当前数据无法支持的指标，不要硬凑；选择 fallback 指标并在 limitations 说明缺口。
- 优先参考 metricRecipeHints 中的成熟 BI 口径；如果当前协议不支持复杂比率，先选择可追溯的分子、分母或状态拆解指标，不要伪造百分比。
- 工单/客服运营场景必须优先选择 count 工单量、状态拆解、时间维度、处理人/客服维度；如果存在响应/处理/解决时长数字字段，必须选择 avg 口径。
- 如果存在 time 维度，必须保留它，用于 Builder 生成最近两期 KPI view 并由渲染层计算较上期变化。
- limitations 必须说明数据不足或口径限制。
JSON schema:
{
  "metrics": [{"id":"metric_id","label":"指标名","datasetId":"dataset id","field":"字段名","op":"sum | avg | count | min | max","as":"别名","format":"number | currency_cny | percent","filters":[],"businessDefinition":"口径","limitations":[],"source":"agent","confidence":0.8}],
  "dimensions": [{"id":"dimension_id","label":"维度名","datasetId":"dataset id","field":"字段名","role":"category | time | status | owner | geo | unknown","limitations":[]}],
  "rationale": "中文选择理由"
}`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              userRequest: params.userRequest,
              intent: params.intent,
              dataUnderstanding: params.dataUnderstanding,
              expertMetricSystem: params.metricSystem,
              semanticModel: params.semanticModel,
              metricRecipeHints,
            },
            null,
            2,
          ),
        },
      ],
    });

    const sanitized = {
      metrics: sanitizeMetricContracts(result.metrics ?? [], params.semanticModel),
      dimensions: sanitizeDimensionContracts(result.dimensions ?? [], params.semanticModel),
    };

    if (sanitized.metrics.length === 0) {
      const fallback = fallbackContracts(params.semanticModel);
      return {
        ...fallback,
        rationale: "模型没有返回合法指标契约，已回退到语义模型中的可计算指标。",
      };
    }

    return {
      metrics: sanitized.metrics.slice(0, 8),
      dimensions: sanitized.dimensions.length ? sanitized.dimensions.slice(0, 12) : params.semanticModel.dimensions.slice(0, 12),
      rationale: result.rationale || "已基于语义模型选择可计算指标和维度。",
    };
  } catch {
    const fallback = fallbackContracts(params.semanticModel);
    return {
      ...fallback,
      rationale: "指标契约模型调用失败，已回退到语义模型中的可计算指标。",
    };
  }
}
