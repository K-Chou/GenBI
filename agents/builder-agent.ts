import { dashboardSystemPrompt } from "@/prompts/dashboard-system";
import type {
  DashboardBlueprint,
  DashboardSkill,
  DataUnderstanding,
  DatasetMetadata,
  ImageAttachment,
  IntentUnderstanding,
} from "@/lib/types";
import { completeHtml, type LlmMessage } from "@/services/deepseek";

function buildUserContent(params: {
  userRequest: string;
  dataset: DatasetMetadata;
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  blueprint: DashboardBlueprint;
  skill: DashboardSkill;
  images?: ImageAttachment[];
}): LlmMessage["content"] {
  const text = JSON.stringify(
    {
      userRequest: params.userRequest,
      intent: params.intent,
      dataUnderstanding: params.dataUnderstanding,
      dashboardBlueprint: params.blueprint,
      dashboardSkill: params.skill,
      dataset: {
        name: params.dataset.name,
        fileName: params.dataset.fileName,
        sheetName: params.dataset.sheetName,
        rowCount: params.dataset.rowCount,
        columns: params.dataset.columns,
        sampleRows: params.dataset.sampleRows,
      },
      output: "生成完整单文件 HTML Artifact。只返回 HTML。",
    },
    null,
    2,
  );

  if (!params.images?.length) {
    return text;
  }

  return [
    { type: "text", text },
    ...params.images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.dataUrl },
    })),
  ];
}

export async function runBuilderAgent(params: {
  userRequest: string;
  dataset: DatasetMetadata;
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  blueprint: DashboardBlueprint;
  skill: DashboardSkill;
  images?: ImageAttachment[];
}) {
  return completeHtml({
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `${dashboardSystemPrompt}

你现在是 Builder Agent。
你必须严格按照 Dashboard Blueprint 生成 HTML，不要重新发明 dashboard 结构。
你必须应用 Dashboard Skill 中的业务规则、KPI 规则、图表规则、布局规则和设计规则。
如果 Blueprint 与数据不完全匹配，优先保持业务逻辑清晰，并在界面中使用克制的说明文字。`,
      },
      {
        role: "user",
        content: buildUserContent(params),
      },
    ],
  });
}
