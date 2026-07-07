import type {
  DashboardBlueprint,
  DataUnderstanding,
  DatasetMetadata,
  IntentUnderstanding,
  ReviewResult,
} from "@/lib/types";
import { completeJson } from "@/services/deepseek";

export async function runReviewAgent(params: {
  dataset: DatasetMetadata;
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  blueprint: DashboardBlueprint;
  html: string;
}): Promise<ReviewResult> {
  return completeJson<ReviewResult>({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Review Agent，负责 Dashboard Artifact 质量检查。
检查维度：
- Data：指标和维度是否合理，是否明显编造数据
- BI：图表选择和信息层级是否符合业务目标
- Design：是否 Apple Style、简洁、响应式、KPI 顶部
- Technical：是否是完整 HTML，是否可能存在明显 JS 错误
只返回 JSON，不要 Markdown。
JSON schema:
{
  "score": 0,
  "approved": true,
  "issues": [{"category": "data | bi | design | technical", "severity": "low | medium | high", "message": "问题描述"}],
  "summary": "中文总结"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            dataset: {
              name: params.dataset.name,
              columns: params.dataset.columns,
              sampleRows: params.dataset.sampleRows,
            },
            intent: params.intent,
            dataUnderstanding: params.dataUnderstanding,
            blueprint: params.blueprint,
            htmlPreview: params.html.slice(0, 12000),
          },
          null,
          2,
        ),
      },
    ],
  });
}
