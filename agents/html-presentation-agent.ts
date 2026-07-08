import { designReferencePrompt, internalDashboardReferencePrompt } from "@/prompts/dashboard-system";
import { completeHtml } from "@/services/deepseek";
import type { DashboardDocument, DatasetMetadata, DesignSpecification } from "@/lib/types";
import type { DataRow } from "@/lib/dashboard-query";

export type DashboardPresentationData = {
  generatedAt: string;
  datasets: Array<{
    id: string;
    name: string;
    rowCount: number;
    columns: string[];
  }>;
  rowsByView: Record<string, DataRow[]>;
};

export async function runHtmlPresentationAgent(params: {
  dashboard: DashboardDocument;
  datasets: DatasetMetadata[];
  designSpec?: DesignSpecification;
  presentationData: DashboardPresentationData;
  userRequest: string;
}) {
  return completeHtml({
    stage: "presentation",
    temperature: 0.18,
    messages: [
      {
        role: "system",
        content: `你是 HTML Presentation Agent，负责把已验证的 DashboardDocument 转换成高质量单文件 HTML 展示制品。

重要边界：
- 你不是 Planner，不允许重新规划指标。
- 你不是 Data Agent，不允许发明字段、指标、趋势、同比、环比或结论。
- 所有 KPI、图表、表格和洞察必须来自 dashboard.components 与 presentationData.rowsByView。
- 可以提升视觉表现、布局细节、Tailwind 结构、ECharts option 质感。

输出要求：
- 只输出完整 HTML，不要 Markdown，不要 code fence。
- 使用 TailwindCSS CDN 和 Apache ECharts CDN。
- 单文件可直接打开，不需要 build step。
- 必须包含 <!doctype html>、<html lang="zh-CN">、闭合 </html>。
- 除专业术语外，界面文案使用中文。
- 使用 Inter 字体。
- Apple inspired、minimal、professional、mobile first、KPI first。
- 24px spacing rhythm，16px 左右卡片圆角，最多 5 种主色。
- 不要渐变背景，不要 3D 图，不要花哨动画。
- 图表低噪音：细网格、紧凑 legend、柔和 tooltip、合适留白。
- 把 presentationData 以内联 JSON 常量写入脚本，ECharts 只能使用这些数据。
- HTML 内不要发起任何 fetch/XMLHttpRequest/WebSocket 请求。

${designReferencePrompt}
${internalDashboardReferencePrompt}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            userRequest: params.userRequest,
            dashboard: params.dashboard,
            designSpec: params.designSpec ?? params.dashboard.designSpec,
            presentationData: params.presentationData,
          },
          null,
          2,
        ),
      },
    ],
  });
}
