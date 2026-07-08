import type { ChatMessage, DatasetMetadata, DatasetSelection } from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { completeJson } from "@/services/deepseek";

function buildDatasetCatalog(datasets: DatasetMetadata[]) {
  return datasets.map((dataset) => compactDatasetForAgent(dataset, { maxSampleValues: 2 }));
}

function fallbackSelection(datasets: DatasetMetadata[]): DatasetSelection {
  return {
    datasetIds: datasets.slice(0, 5).map((dataset) => dataset.id),
    rationale: "未能调用模型选择底表数据，已回退选择最近的可用底表数据。",
    joinHints: [],
  };
}

export async function runDatasetSelectorAgent(params: {
  datasets: DatasetMetadata[];
  history?: ChatMessage[];
  preferredDatasetIds?: string[];
  userRequest: string;
}): Promise<DatasetSelection> {
  try {
    const selection = await completeJson<DatasetSelection>({
      stage: "fast",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `你是 Dataset Selector Agent。
你的任务是根据用户的看板需求，从可用 Dataset Catalog 中自动选择最相关的数据表。
用户不需要手动选择关联字段；如果发现疑似关联字段，请输出 joinHints 作为后续分析提示。
规则：
- 只返回 JSON，不要 Markdown。
- datasetIds 必须来自 catalog 中存在的 id。
- 只选择真正相关的 Dataset，通常 1-5 个。
- 如果用户需求宽泛，可以选择多个互补 Dataset。
- 如果所有 Dataset 都无法支撑用户需求，datasetIds 返回空数组，并在 rationale 中说明缺少什么数据。
- 如果 preferredDatasetIds 有值，它只是最近上下文提示，不是强制选择。
JSON schema:
{
  "datasetIds": ["dataset id"],
  "rationale": "中文选择理由",
  "joinHints": [{"leftDatasetId":"id","leftField":"字段","rightDatasetId":"id","rightField":"字段","confidence":0.8,"reason":"原因"}]
}`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              userRequest: params.userRequest,
              history: (params.history ?? []).slice(-6),
              preferredDatasetIds: params.preferredDatasetIds ?? [],
              catalog: buildDatasetCatalog(params.datasets),
            },
            null,
            2,
          ),
        },
      ],
    });

    const validIds = new Set(params.datasets.map((dataset) => dataset.id));
    const datasetIds = selection.datasetIds.filter((id) => validIds.has(id));

    if (datasetIds.length === 0) {
      return fallbackSelection(params.datasets);
    }

    return {
      ...selection,
      datasetIds,
      joinHints: selection.joinHints?.filter(
        (hint) => validIds.has(hint.leftDatasetId) && validIds.has(hint.rightDatasetId),
      ),
    };
  } catch {
    return fallbackSelection(params.datasets);
  }
}
