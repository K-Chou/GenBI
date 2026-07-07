import type { DataUnderstanding, DatasetMetadata, IntentUnderstanding } from "@/lib/types";
import { completeJson } from "@/services/deepseek";

export async function runDataAgent(params: {
  dataset: DatasetMetadata;
  intent: IntentUnderstanding;
}): Promise<DataUnderstanding> {
  return completeJson<DataUnderstanding>({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Dataset Understanding Agent。
你的职责是基于 Dataset metadata 理解可用指标、维度、日期字段和分析机会。
这一步替代传统 BI semantic model。
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
            dataset: {
              name: params.dataset.name,
              rowCount: params.dataset.rowCount,
              columns: params.dataset.columns,
              sampleRows: params.dataset.sampleRows,
            },
          },
          null,
          2,
        ),
      },
    ],
  });
}
