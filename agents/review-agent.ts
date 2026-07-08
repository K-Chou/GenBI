import type {
  DashboardBlueprint,
  DashboardDocument,
  DataUnderstanding,
  DatasetMetadata,
  DesignSpecification,
  DimensionContract,
  IntentUnderstanding,
  MetricContract,
  MetricSystem,
  ReviewResult,
  SemanticModel,
} from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { designReferencePrompt } from "@/prompts/dashboard-system";
import { completeJson } from "@/services/deepseek";

export async function runReviewAgent(params: {
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  dimensionContracts?: DimensionContract[];
  metricContracts?: MetricContract[];
  metricSystem?: MetricSystem;
  semanticModel?: SemanticModel;
  blueprint: DashboardBlueprint;
  designSpec?: DesignSpecification;
  dashboard: DashboardDocument;
}): Promise<ReviewResult> {
  const datasets = params.datasets?.length ? params.datasets : [params.dataset];

  return completeJson<ReviewResult>({
    stage: "review",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Review Agent，负责 Dashboard JSON Artifact 质量检查。
检查维度：
- Data：指标和维度是否合理，是否明显编造数据
- BI：图表选择和信息层级是否符合业务目标
- Metric System：是否遵守指标树，是否把 primary / diagnostic / action 指标放在合适位置，是否说明不可执行指标缺口
- Design：是否执行 DesignSpecification，是否 Apple Style、简洁、响应式、KPI 顶部，并具备 Dribbble / Behance 高质量数据产品的视觉完成度
- Technical：是否符合 DashboardDocument JSON 协议，组件引用的 viewId 和字段是否一致
${designReferencePrompt}
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
            datasets: datasets.map((dataset) => compactDatasetForAgent(dataset, { maxSampleValues: 2 })),
            intent: params.intent,
            semanticModel: params.semanticModel,
            metricContracts: params.metricContracts ?? [],
            metricSystem: params.metricSystem,
            dimensionContracts: params.dimensionContracts ?? [],
            dataUnderstanding: params.dataUnderstanding,
            blueprint: params.blueprint,
            designSpec: params.designSpec,
            dashboard: params.dashboard,
          },
          null,
          2,
        ),
      },
    ],
  });
}
