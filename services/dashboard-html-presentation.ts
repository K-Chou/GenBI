import { runHtmlPresentationAgent, type DashboardPresentationData } from "@/agents/html-presentation-agent";
import { aggregateRows, type DataRow } from "@/lib/dashboard-query";
import type { ArtifactManifest, DashboardComponent, DashboardDocument, DatasetMetadata } from "@/lib/types";
import { getArtifactDetails, getDataset, updateArtifactHtml } from "@/lib/file-store";

const MAX_ROWS_PER_VIEW = 40;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDatasetForSource(document: DashboardDocument, datasets: DatasetMetadata[], dataSourceId?: string) {
  const dataSource = document.dataSources.find((source) => source.id === dataSourceId);
  return datasets.find((dataset) => dataset.id === dataSource?.binding?.datasetId) ?? datasets[0];
}

export function buildDashboardPresentationData(params: {
  dashboard: DashboardDocument;
  datasets: DatasetMetadata[];
}): DashboardPresentationData {
  const rowsByView = Object.fromEntries(
    params.dashboard.views.map((view) => {
      const dataset = getDatasetForSource(params.dashboard, params.datasets, view.dataSourceId);
      const baseRows = ((dataset?.rows ?? dataset?.sampleRows) ?? []) as DataRow[];
      return [view.id, aggregateRows(baseRows, view).slice(0, MAX_ROWS_PER_VIEW)];
    }),
  );

  return {
    datasets: params.datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      rowCount: dataset.rowCount,
      columns: dataset.columns.map((column) => column.name),
    })),
    generatedAt: new Date().toISOString(),
    rowsByView,
  };
}

export function validateHtmlPresentation(html: string) {
  const issues: string[] = [];
  const normalized = html.toLowerCase();

  if (!normalized.includes("<!doctype html")) {
    issues.push("HTML 缺少 <!doctype html>。");
  }
  if (!normalized.includes("<html") || !normalized.includes("</html>")) {
    issues.push("HTML 文档未完整闭合。");
  }
  if (!/tailwindcss|cdn\.tailwindcss\.com/i.test(html)) {
    issues.push("HTML 缺少 TailwindCSS CDN。");
  }
  if (!/echarts/i.test(html)) {
    issues.push("HTML 缺少 ECharts CDN 或初始化代码。");
  }
  if (/(fetch\(|xmlhttprequest|websocket|eventsource)/i.test(html)) {
    issues.push("HTML 包含运行时远程请求，展示制品应只使用内联数据。");
  }
  if (html.length < 1200) {
    issues.push("HTML 内容过短，可能不是完整仪表盘。");
  }

  return issues;
}

function getViewRows(component: DashboardComponent, presentationData: DashboardPresentationData) {
  return component.data?.viewId ? presentationData.rowsByView[component.data.viewId] ?? [] : [];
}

function renderFallbackHtml(params: {
  dashboard: DashboardDocument;
  presentationData: DashboardPresentationData;
}) {
  const palette = params.dashboard.designSpec?.colorPalette ?? {
    accent: "#06B6D4",
    background: "#F5F5F7",
    danger: "#F43F5E",
    muted: "#64748B",
    primary: "#4F46E5",
    success: "#10B981",
    surface: "#FFFFFF",
    text: "#111827",
    warning: "#F59E0B",
  };
  const chartComponents = params.dashboard.components.filter((component) =>
    ["line", "bar", "horizontal_bar", "stacked_bar", "horizontal_stacked_bar", "donut"].includes(component.type),
  );
  const componentCards = params.dashboard.components
    .map((component) => {
      const rows = getViewRows(component, params.presentationData);

      if (component.type === "dashboard_title") {
        return `<section class="lg:col-span-12">
          <p class="text-sm font-medium text-slate-500">AI Native Dashboard</p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">${escapeHtml(component.title || params.dashboard.title)}</h1>
          <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-500">${escapeHtml(component.description ?? params.dashboard.description ?? "")}</p>
        </section>`;
      }

      if (component.type === "section_title") {
        return `<section class="lg:col-span-12 pt-2">
          <h2 class="text-lg font-semibold text-slate-950">${escapeHtml(component.title)}</h2>
          ${component.description ? `<p class="mt-1 text-sm text-slate-500">${escapeHtml(component.description)}</p>` : ""}
        </section>`;
      }

      if (component.type === "kpi") {
        const valueField = component.data?.value?.field;
        const value = rows[0]?.[valueField ?? ""];
        return `<article class="lg:col-span-${Math.min(12, Math.max(2, component.layout.colSpan))} rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.055)]">
          <p class="text-sm font-medium text-slate-500">${escapeHtml(component.title)}</p>
          <p class="mt-3 text-4xl font-semibold tracking-tight text-slate-950">${escapeHtml(value ?? "-")}</p>
          ${component.description ? `<p class="mt-3 text-xs leading-5 text-slate-500">${escapeHtml(component.description)}</p>` : ""}
        </article>`;
      }

      if (component.type === "insight" || component.type === "empty_state") {
        return `<article class="lg:col-span-${Math.min(12, Math.max(3, component.layout.colSpan))} rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.055)]">
          <p class="text-sm font-semibold text-slate-950">${escapeHtml(component.title)}</p>
          <p class="mt-3 text-sm leading-6 text-slate-500">${escapeHtml(component.insight ?? component.description ?? "当前数据不足以支撑该模块。")}</p>
        </article>`;
      }

      if (component.type === "table") {
        const columns = component.data?.columns ?? Object.keys(rows[0] ?? {}).slice(0, 5);
        return `<article class="lg:col-span-${Math.min(12, Math.max(6, component.layout.colSpan))} overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.055)]">
          <div class="p-6">
            <p class="text-sm font-semibold text-slate-950">${escapeHtml(component.title)}</p>
            ${component.description ? `<p class="mt-2 text-xs text-slate-500">${escapeHtml(component.description)}</p>` : ""}
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500"><tr>${columns.map((column) => `<th class="px-4 py-3 font-medium">${escapeHtml(column)}</th>`).join("")}</tr></thead>
              <tbody class="divide-y divide-slate-100">${rows
                .slice(0, 8)
                .map((row) => `<tr>${columns.map((column) => `<td class="px-4 py-3 text-slate-700">${escapeHtml(row[column])}</td>`).join("")}</tr>`)
                .join("")}</tbody>
            </table>
          </div>
        </article>`;
      }

      return `<article class="lg:col-span-${Math.min(12, Math.max(4, component.layout.colSpan))} rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.055)]">
        <div class="mb-4">
          <p class="text-sm font-semibold text-slate-950">${escapeHtml(component.title)}</p>
          ${component.description ? `<p class="mt-2 text-xs text-slate-500">${escapeHtml(component.description)}</p>` : ""}
        </div>
        <div id="chart-${escapeHtml(component.id)}" class="h-72"></div>
      </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.dashboard.title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style>
</head>
<body style="background:${palette.background};color:${palette.text}">
  <main class="mx-auto max-w-7xl p-6 sm:p-8">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      ${componentCards}
    </div>
  </main>
  <script>
    const presentationData = ${JSON.stringify(params.presentationData)};
    const components = ${JSON.stringify(chartComponents)};
    const palette = ${JSON.stringify([
      palette.primary,
      palette.accent,
      palette.success,
      palette.warning,
      palette.danger,
    ])};
    function toNumber(value){ const n = Number(String(value ?? '').replace(/[,¥￥%\\s]/g,'')); return Number.isFinite(n) ? n : 0; }
    for (const component of components) {
      const el = document.getElementById('chart-' + component.id);
      if (!el) continue;
      const rows = presentationData.rowsByView[component.data?.viewId] || [];
      const xField = component.data?.x?.field;
      const series = component.data?.series || [];
      const chart = echarts.init(el);
      if (component.type === 'donut') {
        const valueField = series[0]?.field || component.data?.value?.field;
        chart.setOption({
          color: palette,
          tooltip: { trigger: 'item' },
          legend: { bottom: 0, textStyle: { color: '#64748B', fontSize: 11 } },
          series: [{ type: 'pie', radius: ['52%', '72%'], data: rows.map((row, index) => ({ name: String(row[xField] ?? index + 1), value: toNumber(row[valueField]) })) }]
        });
      } else {
        const horizontal = component.type.includes('horizontal');
        const categories = rows.map((row, index) => String(xField ? row[xField] ?? '未分类' : index + 1));
        const option = {
          color: palette,
          tooltip: { trigger: 'axis' },
          legend: { show: series.length > 1, textStyle: { color: '#64748B', fontSize: 11 } },
          grid: horizontal ? { left: 92, right: 20, top: 28, bottom: 28 } : { left: 42, right: 20, top: 28, bottom: 42 },
          xAxis: horizontal ? { type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.18)', type: 'dashed' } } } : { type: 'category', data: categories, axisTick: { show: false }, axisLabel: { color: '#64748B' } },
          yAxis: horizontal ? { type: 'category', data: categories, axisTick: { show: false }, axisLabel: { color: '#64748B' } } : { type: 'value', splitLine: { lineStyle: { color: 'rgba(148,163,184,.18)', type: 'dashed' } } },
          series: series.map((item) => ({ name: item.name, type: component.type.includes('bar') ? 'bar' : item.type || component.type, smooth: true, barMaxWidth: 34, itemStyle: { borderRadius: component.type.includes('bar') ? 10 : 0 }, data: rows.map((row) => toNumber(row[item.field])) }))
        };
        chart.setOption(option);
      }
      window.addEventListener('resize', () => chart.resize());
    }
  </script>
</body>
</html>`;
}

export async function generateDashboardPresentationHtml(params: {
  dashboard: DashboardDocument;
  datasets: DatasetMetadata[];
  userRequest: string;
}) {
  const presentationData = buildDashboardPresentationData({
    dashboard: params.dashboard,
    datasets: params.datasets,
  });

  try {
    const html = await runHtmlPresentationAgent({
      dashboard: params.dashboard,
      datasets: params.datasets,
      designSpec: params.dashboard.designSpec,
      presentationData,
      userRequest: params.userRequest,
    });
    const issues = validateHtmlPresentation(html);

    if (issues.length === 0) {
      return { html, issues, source: "ai" as const };
    }

    return {
      html: renderFallbackHtml({ dashboard: params.dashboard, presentationData }),
      issues,
      source: "fallback" as const,
    };
  } catch (error) {
    return {
      html: renderFallbackHtml({ dashboard: params.dashboard, presentationData }),
      issues: [error instanceof Error ? error.message : "HTML Presentation Agent 生成失败，已使用保底展示层。"],
      source: "fallback" as const,
    };
  }
}

export async function refreshArtifactHtmlPresentation(params: {
  artifact: ArtifactManifest;
  dashboard: DashboardDocument;
  datasets: DatasetMetadata[];
  userRequest: string;
}) {
  const result = await generateDashboardPresentationHtml({
    dashboard: params.dashboard,
    datasets: params.datasets,
    userRequest: params.userRequest,
  });

  await updateArtifactHtml({
    artifactId: params.artifact.id,
    html: result.html,
  });

  return result;
}

export async function refreshArtifactHtmlPresentationById(params: {
  artifactId: string;
  dashboard: DashboardDocument;
  userRequest?: string;
}) {
  const details = await getArtifactDetails(params.artifactId);

  if (!details) {
    throw new Error("未找到仪表盘。");
  }

  const datasets = (
    await Promise.all((details.manifest.datasetIds ?? [details.manifest.datasetId]).map((datasetId) => getDataset(datasetId)))
  ).filter((dataset): dataset is DatasetMetadata => Boolean(dataset));

  if (datasets.length === 0) {
    throw new Error("未找到可用于刷新 HTML 的底表数据。");
  }

  return refreshArtifactHtmlPresentation({
    artifact: details.manifest,
    dashboard: params.dashboard,
    datasets,
    userRequest: params.userRequest ?? details.manifest.userRequest,
  });
}
