import type {
  DashboardDocument,
  DashboardPatchSet,
  DatasetMetadata,
  DimensionContract,
  JsonPatchOperation,
  MetricContract,
} from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { completeJson } from "@/services/deepseek";

type DashboardRepairAgentResult = {
  diagnosis: string;
  patches: JsonPatchOperation[];
  summary: string;
};

export async function runDashboardRepairAgent(params: {
  dashboard: DashboardDocument;
  datasets: DatasetMetadata[];
  dimensionContracts: DimensionContract[];
  metricContracts: MetricContract[];
  issues: string[];
  previousRepairErrors?: string[];
}): Promise<DashboardPatchSet> {
  const result = await completeJson<DashboardRepairAgentResult>({
    stage: "repair",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 GenBI Repair Agent。

你的任务是根据确定性 validator issues 修复 DashboardDocument。
你只能输出最小 JSON Patch，不允许重写整份 dashboard，不允许生成 HTML。

严格规则：
- 只返回 JSON，不要 Markdown。
- patches 只允许 op: add | replace | remove。
- path 必须使用 RFC 6902 JSON Pointer。
- 不允许修改 /schemaVersion、/id、/dataSources。
- 优先修复 /views、/components、/detailViews、/metrics 下的错误引用。
- views[].transform.metrics 必须逐字复制 metricContracts 中的 field/op/as。
- views[].transform.groupBy、filters.field 必须来自对应 dataset 的真实 columns，优先使用 dimensionContracts。
- components[].data.viewId 必须引用已有或本次新增 view。
- components[].data.value.field、series[].field、columns[] 必须来自对应 view 的输出字段：原始字段、groupBy 字段或 metrics[].as。
- 如果某个组件无法被真实数据支撑，优先改为 empty_state 或删除该组件，而不是编造字段或指标。
- 不要新增任何手写指标数值、趋势数值、同比环比数值。

输出 JSON schema:
{
  "diagnosis": "你对 validator issues 的简短诊断",
  "patches": [
    {"op": "replace", "path": "/components/2/data/value/field", "value": "真实指标别名"}
  ],
  "summary": "中文摘要，说明修复了什么"
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            validatorIssues: params.issues,
            previousRepairErrors: params.previousRepairErrors ?? [],
            datasets: params.datasets.map((dataset) => compactDatasetForAgent(dataset, { maxSampleValues: 3 })),
            metricContracts: params.metricContracts,
            dimensionContracts: params.dimensionContracts,
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
    intent: result.diagnosis,
    patches: result.patches,
    source: "ai",
    summary: result.summary,
  };
}
