import type {
  ChatMessage,
  DashboardDocument,
  DashboardPatchSet,
  DatasetMetadata,
  DimensionContract,
  JsonPatchOperation,
  MetricContract,
} from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { completeJson } from "@/services/deepseek";

type PatchAgentResult = {
  intent: string;
  patches: JsonPatchOperation[];
  summary: string;
};

export async function runPatchAgent(params: {
  dashboard: DashboardDocument;
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  dimensionContracts?: DimensionContract[];
  metricContracts?: MetricContract[];
  userRequest: string;
  history?: ChatMessage[];
}): Promise<DashboardPatchSet> {
  const result = await completeJson<PatchAgentResult>({
    stage: "repair",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 GenBI Patch Agent。

你的任务是基于用户的微调请求，对现有 DashboardDocument 输出最小 JSON Patch。
只允许输出局部 patch，不允许重写整份 dashboard。

严格规则：
- 只返回 JSON，不要 Markdown。
- patches 只允许 op: add | replace | remove。
- path 必须使用 RFC 6902 JSON Pointer。
- 优先修改 /components 下的 title、type、layout/colSpan、data/series、echarts、insight。
- 不要修改 schemaVersion、id、dataSources，除非用户明确要求。
- 不要引用 dataset.columns 中不存在的字段。
- 不要新增任何手写数值；KPI、图表和表格必须继续引用已有或真实字段生成的 view。
- 新增 view 时，transform.metrics 必须逐字复制 metricContracts 中的 field/op/as；groupBy 必须来自 dimensionContracts。
- 新增 component 时，data.viewId 必须引用已有或本次新增的 view；优先复用已有 view。
- 如果用户说“折线图换成面积图”，通常 replace /components/N/data/series/0/area 为 true。
- 如果用户说“柱状图换成折线图”，同时替换 /components/N/type 和 /components/N/data/series/0/type。
- 若无法安全判断目标组件，选择最相关的组件并在 summary 说明。

输出 JSON schema:
{
  "intent": "用户微调意图",
  "patches": [
    {"op": "replace", "path": "/components/1/type", "value": "line"}
  ],
  "summary": "中文摘要"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            userRequest: params.userRequest,
            history: (params.history ?? []).slice(-8),
            datasets: (params.datasets?.length ? params.datasets : [params.dataset]).map((dataset) =>
              compactDatasetForAgent(dataset, { maxSampleValues: 3 }),
            ),
            metricContracts: params.metricContracts ?? [],
            dimensionContracts: params.dimensionContracts ?? [],
            currentDashboard: params.dashboard,
          },
          null,
          2,
        ),
      },
    ],
  });

  return {
    baseDocumentId: params.dashboard.id,
    baseRevision: params.dashboard.meta.revision ?? 1,
    createdAt: new Date().toISOString(),
    intent: result.intent,
    patches: result.patches,
    source: "ai",
    summary: result.summary,
  };
}
