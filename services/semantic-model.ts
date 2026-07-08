import type {
  ColumnType,
  DatasetMetadata,
  DimensionContract,
  MetricContract,
  SemanticDataset,
  SemanticField,
  SemanticModel,
} from "@/lib/types";

type RowValue = string | number | boolean | null;

function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function getRows(dataset: DatasetMetadata) {
  return dataset.rows?.length ? dataset.rows : dataset.sampleRows;
}

function inferDateRole(fieldName: string): SemanticField["dateRole"] {
  const normalized = fieldName.toLowerCase();

  if (/create|created|创建|提交|发起/.test(normalized)) return "created";
  if (/update|updated|修改|更新/.test(normalized)) return "updated";
  if (/close|closed|finish|完成|关闭|解决/.test(normalized)) return "closed";
  if (/due|deadline|截止|到期/.test(normalized)) return "due";
  if (/date|time|日期|时间/.test(normalized)) return "primary";

  return "unknown";
}

function inferDimensionRole(fieldName: string): DimensionContract["role"] {
  const normalized = fieldName.toLowerCase();

  if (/date|time|日期|时间|month|year|day/.test(normalized)) return "time";
  if (/status|state|状态|阶段/.test(normalized)) return "status";
  if (/owner|assignee|person|user|负责人|处理人|用户|人员/.test(normalized)) return "owner";
  if (/country|city|region|province|area|城市|地区|区域|省/.test(normalized)) return "geo";
  if (/type|category|class|分类|类型|业务线/.test(normalized)) return "category";

  return "unknown";
}

function isIdentifierLikeField(fieldName: string) {
  const normalized = fieldName.toLowerCase();

  return /(^id$|_id$|id$|uuid|guid|token|key|record|编号|编码|标识|唯一|主键|记录id|多维表标识)/i.test(normalized);
}

function inferSemanticRole(type: ColumnType, fieldName: string): SemanticField["semanticRole"] {
  if (type === "date") return "date";
  if (isIdentifierLikeField(fieldName)) return "dimension";
  if (type === "number") return "metric";
  if (inferDimensionRole(fieldName) !== "unknown") return "dimension";
  if (type === "string" || type === "boolean") return "dimension";

  return "unknown";
}

function inferFormat(fieldName: string): MetricContract["format"] {
  const normalized = fieldName.toLowerCase();

  if (/amount|revenue|gmv|cost|price|费用|金额|收入|营收|销售额/.test(normalized)) return "currency_cny";
  if (/rate|ratio|percent|率|占比|比例/.test(normalized)) return "percent";

  return "number";
}

function createField(dataset: DatasetMetadata, fieldName: string, type: ColumnType): SemanticField {
  const rows = getRows(dataset);
  const values = rows.map((row) => (row[fieldName] ?? null) as RowValue);
  const nonEmptyValues = values.filter((value) => value !== null && value !== "");
  const uniqueValues = Array.from(new Set(nonEmptyValues.map((value) => String(value)))).slice(0, 20);
  const semanticRole = inferSemanticRole(type, fieldName);
  const risks: string[] = [];
  const nonEmptyRate = values.length > 0 ? nonEmptyValues.length / values.length : 0;

  if (nonEmptyRate < 0.5) {
    risks.push("字段空值较多，作为核心指标或筛选条件时需要谨慎。");
  }

  if (type === "number" && nonEmptyValues.length === 0) {
    risks.push("数字字段没有可用样例值，聚合结果可能为空。");
  }

  if (semanticRole === "dimension" && uniqueValues.length > 50) {
    risks.push("维度基数较高，不适合直接做占比或普通分类图。");
  }

  return {
    datasetId: dataset.id,
    name: fieldName,
    type,
    semanticRole,
    canAggregate: type === "number" && !isIdentifierLikeField(fieldName),
    allowedOps: type === "number" && !isIdentifierLikeField(fieldName) ? ["sum", "avg", "count", "min", "max"] : ["count"],
    sampleValues: values.slice(0, 6),
    uniqueValueCount: new Set(nonEmptyValues.map((value) => String(value))).size,
    nonEmptyRate: Number(nonEmptyRate.toFixed(4)),
    dateRole: type === "date" ? inferDateRole(fieldName) : undefined,
    enumValues:
      semanticRole === "dimension" && uniqueValues.length > 0 && uniqueValues.length <= 20
        ? uniqueValues
        : undefined,
    risks,
  };
}

function buildMetricContract(dataset: DatasetMetadata, field: SemanticField, index: number): MetricContract {
  const op = field.canAggregate ? "sum" : "count";
  const as = `metric_${normalizeId(field.name) || index}`;

  return {
    id: `${normalizeId(dataset.id)}_${as}`,
    label: field.canAggregate ? `${field.name}合计` : `${field.name}数量`,
    datasetId: dataset.id,
    field: field.name,
    op,
    as,
    format: field.canAggregate ? inferFormat(field.name) : "number",
    businessDefinition:
      field.canAggregate
        ? `对底表字段「${field.name}」执行 ${op} 聚合。`
        : `对底表字段「${field.name}」执行 count 计数。`,
    limitations: field.risks,
    source: "semantic",
    confidence: field.canAggregate ? 0.82 : 0.72,
  };
}

function buildRecordCountContract(dataset: DatasetMetadata, field: SemanticField): MetricContract {
  const normalizedDatasetName = normalizeId(dataset.name) || normalizeId(dataset.id) || "dataset";

  return {
    id: `${normalizeId(dataset.id)}_record_count`,
    label: `${dataset.name}记录数`,
    datasetId: dataset.id,
    field: field.name,
    op: "count",
    as: `${normalizedDatasetName}_record_count`.slice(0, 64),
    format: "number",
    businessDefinition: `对底表「${dataset.name}」执行记录数 count，用于表达工单量、记录量、明细规模等总量类指标。`,
    limitations: field.risks,
    source: "semantic",
    confidence: 0.9,
  };
}

function buildDimensionContract(dataset: DatasetMetadata, field: SemanticField, index: number): DimensionContract {
  return {
    id: `${normalizeId(dataset.id)}_dim_${normalizeId(field.name) || index}`,
    label: field.name,
    datasetId: dataset.id,
    field: field.name,
    role: inferDimensionRole(field.name),
    limitations: field.risks,
  };
}

function getDimensionPriority(field: SemanticField) {
  const roleWeight: Record<DimensionContract["role"], number> = {
    time: 100,
    status: 90,
    owner: 80,
    category: 70,
    geo: 50,
    unknown: 10,
  };

  return roleWeight[inferDimensionRole(field.name)] + (field.nonEmptyRate >= 0.8 ? 5 : 0) - Math.min(field.uniqueValueCount, 30) / 100;
}

function buildSemanticDataset(dataset: DatasetMetadata): SemanticDataset {
  const fields = dataset.columns.map((column) => createField(dataset, column.name, column.type));
  const metricFields = fields.filter((field) => field.semanticRole === "metric").map((field) => field.name);
  const dimensionFields = fields
    .filter((field) => (field.semanticRole === "dimension" || field.semanticRole === "date") && !isIdentifierLikeField(field.name))
    .map((field) => field.name);
  const dateFields = fields.filter((field) => field.semanticRole === "date").map((field) => field.name);
  const risks: string[] = [];

  if (fields.length === 0) risks.push("底表没有可分析字段。");
  if (metricFields.length === 0) risks.push("未识别到数字指标字段，只能做数量、分布或明细分析。");
  if (dateFields.length === 0) risks.push("未识别到日期字段，趋势分析能力受限。");

  return {
    id: dataset.id,
    name: dataset.name,
    rowCount: dataset.rowCount,
    sourceType: dataset.source?.type ?? "unknown",
    fields,
    metricFields,
    dimensionFields,
    dateFields,
    risks,
  };
}

export function buildSemanticModel(datasets: DatasetMetadata[]): SemanticModel {
  const semanticDatasets = datasets.map(buildSemanticDataset);
  const metrics = semanticDatasets.flatMap((semanticDataset) => {
    const dataset = datasets.find((item) => item.id === semanticDataset.id);
    if (!dataset) return [];

    const metricFields = semanticDataset.fields.filter((field) => field.semanticRole === "metric" && field.canAggregate);
    const countField =
      semanticDataset.fields.find((field) => isIdentifierLikeField(field.name) && field.nonEmptyRate > 0) ??
      semanticDataset.fields.find((field) => field.nonEmptyRate > 0) ??
      semanticDataset.fields[0];
    const countMetric = countField ? [buildRecordCountContract(dataset, countField)] : [];

    return [...countMetric, ...metricFields.slice(0, 7).map((field, index) => buildMetricContract(dataset, field, index))];
  });
  const dimensions = semanticDatasets.flatMap((semanticDataset) => {
    const dataset = datasets.find((item) => item.id === semanticDataset.id);
    if (!dataset) return [];

    return semanticDataset.fields
      .filter((field) => (field.semanticRole === "dimension" || field.semanticRole === "date") && !isIdentifierLikeField(field.name))
      .sort((a, b) => getDimensionPriority(b) - getDimensionPriority(a))
      .slice(0, 12)
      .map((field, index) => buildDimensionContract(dataset, field, index));
  });

  return {
    datasets: semanticDatasets,
    metrics,
    dimensions,
    dataRisks: semanticDatasets.flatMap((dataset) => dataset.risks.map((risk) => `${dataset.name}: ${risk}`)),
    generatedAt: new Date().toISOString(),
  };
}
