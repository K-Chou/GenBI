import type { ImageAttachment, ReferenceImageAnalysis } from "@/lib/types";
import { completeJson, type LlmMessage } from "@/services/deepseek";

function buildImageAnalysisContent(params: {
  userRequest: string;
  images: ImageAttachment[];
}): LlmMessage["content"] {
  return [
    {
      type: "text",
      text: JSON.stringify(
        {
          task: "拆解用户上传的 Dashboard/UI 案例图，输出可复用于后续 Dashboard 设计的结构化依据。",
          userRequest: params.userRequest,
          imageNames: params.images.map((image) => image.name),
          rules: [
            "不要描述无关背景。",
            "不要把图片原样嵌入最终 Dashboard。",
            "重点提取布局、信息层级、视觉风格、颜色、卡片、图表和交互暗示。",
            "输出必须能直接指导 Planner Agent 和 Builder Agent。",
          ],
        },
        null,
        2,
      ),
    },
    ...params.images.map((image) => ({
      type: "image_url" as const,
      image_url: {
        url: image.dataUrl,
      },
    })),
  ];
}

export async function runImageAnalysisAgent(params: {
  userRequest: string;
  images: ImageAttachment[];
}): Promise<ReferenceImageAnalysis> {
  return completeJson<ReferenceImageAnalysis>({
    stage: "vision",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: `你是 Image Analysis Agent，也是资深 Dashboard Designer。
你的任务是分析用户上传的案例图，并把视觉和交互特征转化为后续 Dashboard 生成可用的设计依据。
只返回 JSON，不要 Markdown。
JSON schema:
{
  "summary": "整体设计总结",
  "images": [
    {
      "name": "图片名",
      "layoutPattern": "布局模式",
      "visualStyle": "视觉风格",
      "colorPalette": ["颜色或色彩语义"],
      "typography": "字体和字号层级观察",
      "componentPatterns": ["卡片、导航、按钮、输入框等组件模式"],
      "chartPatterns": ["图表表达模式"],
      "spacing": "留白与密度",
      "interactionHints": ["可推断的交互方式"],
      "reusableDesignRules": ["可复用设计规则"]
    }
  ],
  "designImplications": ["对本次 Dashboard 设计的影响"],
  "constraints": ["生成时必须遵守或避免的约束"]
}`,
      },
      {
        role: "user",
        content: buildImageAnalysisContent(params),
      },
    ],
  });
}
