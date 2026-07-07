import { dashboardSystemPrompt } from "@/prompts/dashboard-system";
import type { ChatMessage, DatasetMetadata, ImageAttachment } from "@/lib/types";

export function buildDashboardMessages(params: {
  dataset: DatasetMetadata;
  userRequest: string;
  theme?: string;
  promptSettings?: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
}) {
  const promptText = JSON.stringify(
    {
      task: params.userRequest,
      preferredTheme: params.theme ?? "system",
      additionalPromptSettings: params.promptSettings ?? "",
      dataset: {
        name: params.dataset.name,
        fileName: params.dataset.fileName,
        sheetName: params.dataset.sheetName,
        rowCount: params.dataset.rowCount,
        columns: params.dataset.columns,
        sampleRows: params.dataset.sampleRows,
      },
      referenceImages:
        params.images && params.images.length > 0
          ? "用户上传了参考图片或案例截图。请结合图片中的布局、视觉风格、信息层级和图表表达来生成 Dashboard。"
          : "无参考图片。",
      dashboardRules: {
        language: "除专业术语外，所有界面文案必须使用中文",
        output: "单文件 standalone HTML Artifact",
        kpis: "KPI 必须放在顶部",
        trendChart: "趋势图默认使用折线图",
        categoryChart: "分类对比默认使用柱状图",
        proportionChart: "占比或构成默认使用环图",
        forbidden: ["3D 图", "渐变背景", "花哨动画"],
      },
    },
    null,
    2,
  );

  const userPrompt = {
    role: "user" as const,
    content:
      params.images && params.images.length > 0
        ? [
            {
              type: "text" as const,
              text: promptText,
            },
            ...params.images.map((image) => ({
              type: "image_url" as const,
              image_url: {
                url: image.dataUrl,
              },
            })),
          ]
        : promptText,
  };

  return [
    {
      role: "system" as const,
      content: dashboardSystemPrompt,
    },
    ...(params.history ?? []).slice(-8),
    userPrompt,
  ];
}

export function stripHtmlResponse(content: string) {
  return content
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}
