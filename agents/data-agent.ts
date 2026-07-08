import type { DataUnderstanding, DatasetMetadata, IntentUnderstanding, SemanticModel } from "@/lib/types";
import { completeJson } from "@/services/deepseek";

function getAnalysisHints(role: string, fieldName: string) {
  const normalized = fieldName.toLowerCase();
  const hints: string[] = [];

  if (role === "metric") hints.push("可作为 KPI 或聚合指标");
  if (role === "dimension") hints.push("可用于分类对比、来源分布或责任定位");
  if (role === "date") hints.push("可用于趋势分析、周期对比或时间筛选");
  if (/状态|status|state/.test(normalized)) hints.push("适合做状态拆解、完成率或风险队列");
  if (/负责人|owner|assignee|人员|团队/.test(normalized)) hints.push("适合做责任定位或团队对比");
  if (/类型|分类|type|category/.test(normalized)) hints.push("适合做问题类型、需求类型或业务分类分析");

  return hints.length ? hints : ["可作为辅助分析字段"];
}

function buildLocalDataUnderstanding(semanticModel: SemanticModel): DataUnderstanding {
  const fields = semanticModel.datasets.flatMap((dataset) =>
    dataset.fields.map((field) => ({
      analysisHints: getAnalysisHints(field.semanticRole, field.name),
      businessMeaning: field.name,
      name: field.name,
      semanticRole: field.semanticRole,
      type: field.type,
    })),
  );

  return {
    availableAnalysis: [
      ...(semanticModel.datasets.some((dataset) => dataset.dateFields.length > 0) ? ["trend" as const] : []),
      "ranking",
      "comparison",
      "contribution",
      "anomaly",
    ],
    dataRisks: semanticModel.dataRisks,
    dateFields: semanticModel.datasets.flatMap((dataset) => dataset.dateFields),
    dimensions: fields
      .filter((field) => field.semanticRole === "dimension" || field.semanticRole === "date")
      .map((field) => ({ name: field.name, meaning: field.businessMeaning, type: field.type })),
    fields,
    metrics: fields
      .filter((field) => field.semanticRole === "metric")
      .map((field) => ({ name: field.name, meaning: field.businessMeaning, type: field.type })),
  };
}

function shouldUseLlmDataAgent(params: {
  intent: IntentUnderstanding;
  semanticModel: SemanticModel;
}) {
  const fieldCount = params.semanticModel.datasets.reduce((sum, dataset) => sum + dataset.fields.length, 0);
  return params.intent.clarity === "low" || fieldCount > 80 || params.semanticModel.dataRisks.length > 8;
}

export async function runDataAgent(params: {
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  intent: IntentUnderstanding;
  semanticModel: SemanticModel;
}): Promise<DataUnderstanding> {
  if (!shouldUseLlmDataAgent(params)) {
    return buildLocalDataUnderstanding(params.semanticModel);
  }

  return completeJson<DataUnderstanding>({
    stage: "fast",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Dataset Understanding Agent。
你的职责是基于系统已经确定性生成的 SemanticModel 补充业务语义说明。
你不能计算指标、不能生成具体数值、不能新增不存在的字段。
metrics/dimensions/dateFields 必须来自 SemanticModel 中已经存在的字段。
只返回 JSON，不要 Markdown。
JSON schema:
{
  "fields": [{"name": "字段名", "type": "string | number | date | boolean | unknown", "businessMeaning": "业务含义", "semanticRole": "metric | dimension | date | unknown", "analysisHints": ["可用于什么分析"]}],
  "metrics": [{"name": "字段名", "meaning": "业务含义", "type": "string | number | date | boolean | unknown"}],
  "dimensions": [{"name": "字段名", "meaning": "业务含义", "type": "string | number | date | boolean | unknown"}],
  "dateFields": ["字段名"],
  "availableAnalysis": ["trend | ranking | comparison | contribution | profitability | anomaly"],
  "dataRisks": ["数据风险或限制"]
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            intent: params.intent,
            semanticModel: params.semanticModel,
            instruction:
              "只补充字段业务含义、语义角色、分析机会和数据风险。不要输出任何计算后的业务数值；不要把非数字字段标为可 sum/avg 的指标。",
          },
          null,
          2,
        ),
      },
    ],
  });
}
