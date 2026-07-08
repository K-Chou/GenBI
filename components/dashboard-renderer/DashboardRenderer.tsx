"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import * as echarts from "echarts";
import { aggregateRows, toNumber, type DataRow, type RowValue } from "@/lib/dashboard-query";
import type {
  DashboardComponent,
  DashboardDataFilter,
  DashboardDetailView,
  DashboardDocument,
  DesignSpecification,
  DatasetMetadata,
} from "@/lib/types";

function getResolvedDesignSpec(document: DashboardDocument, isDark: boolean): DesignSpecification {
  return (
    document.designSpec ?? {
      visualStyle: isDark ? "operational_command" : "executive_premium",
      layoutPattern: "executive_overview",
      density: "balanced",
      colorPalette: {
        accent: "#06B6D4",
        background: isDark ? "#0F172A" : "#F8FAFC",
        danger: "#F43F5E",
        muted: isDark ? "#94A3B8" : "#64748B",
        primary: "#4F46E5",
        success: "#10B981",
        surface: isDark ? "#111827" : "rgba(255,255,255,0.92)",
        text: isDark ? "#F8FAFC" : "#111827",
        warning: "#F59E0B",
      },
      typographyScale: {
        body: "14px",
        caption: "12px",
        numeric: isDark ? "34px" : "40px",
        sectionTitle: isDark ? "16px" : "18px",
        title: isDark ? "30px" : "32px",
      },
      cardStyle: {
        border: isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)",
        padding: isDark ? 18 : 24,
        radius: isDark ? 12 : 22,
        shadow: "soft",
      },
      chartStyle: {
        axis: "minimal",
        barRadius: 10,
        donutThickness: "medium",
        gridLine: "subtle",
        legend: "compact",
        lineSmooth: true,
        tooltip: "soft",
      },
      compositionRules: [],
      referenceInfluence: [],
    }
  );
}

function getCardStyle(designSpec: DesignSpecification, isDark: boolean): CSSProperties {
  const shadow =
    designSpec.cardStyle.shadow === "soft"
      ? isDark
        ? "0 18px 50px rgba(0,0,0,0.28)"
        : "0 18px 45px rgba(15,23,42,0.055)"
      : designSpec.cardStyle.shadow === "subtle"
        ? "0 10px 28px rgba(15,23,42,0.045)"
        : "none";

  return {
    background: designSpec.colorPalette.surface,
    borderColor: designSpec.cardStyle.border,
    borderRadius: designSpec.cardStyle.radius,
    boxShadow: shadow,
    padding: designSpec.density === "dense" ? 18 : designSpec.cardStyle.padding,
  };
}

function getToneClass(tone: string | undefined, isDark: boolean) {
  const lightToneClass: Record<string, string> = {
    default: "border-slate-200/70 bg-white/85",
    primary: "border-indigo-500/10 bg-indigo-50/80",
    success: "border-emerald-500/10 bg-emerald-50/80",
    warning: "border-amber-500/10 bg-amber-50/80",
    danger: "border-rose-500/10 bg-rose-50/80",
  };
  const darkToneClass: Record<string, string> = {
    default: "border-white/10 bg-white/[0.06]",
    primary: "border-indigo-300/15 bg-indigo-400/[0.12]",
    success: "border-emerald-300/15 bg-emerald-400/[0.12]",
    warning: "border-amber-300/15 bg-amber-400/[0.12]",
    danger: "border-rose-300/15 bg-rose-400/[0.12]",
  };
  const tones = isDark ? darkToneClass : lightToneClass;
  return tones[tone ?? "default"] ?? tones.default;
}

function colSpanClass(span: number) {
  const safeSpan = Math.max(1, Math.min(12, Math.round(span)));
  const classes: Record<number, string> = {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
    5: "lg:col-span-5",
    6: "lg:col-span-6",
    7: "lg:col-span-7",
    8: "lg:col-span-8",
    9: "lg:col-span-9",
    10: "lg:col-span-10",
    11: "lg:col-span-11",
    12: "lg:col-span-12",
  };

  return classes[safeSpan];
}

function formatValue(value: RowValue, format?: string) {
  const numberValue = toNumber(value);

  if (format === "currency_cny") {
    return new Intl.NumberFormat("zh-CN", {
      currency: "CNY",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(numberValue);
  }

  if (format === "percent") {
    return `${(numberValue * 100).toFixed(1)}%`;
  }

  if (typeof value === "number" || Number.isFinite(Number(value))) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(numberValue);
  }

  return value === null || value === undefined ? "-" : String(value);
}

function formatSignedValue(value: number, format?: string) {
  const sign = value > 0 ? "+" : "";

  if (format === "currency_cny") {
    return `${sign}${new Intl.NumberFormat("zh-CN", {
      currency: "CNY",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(value)}`;
  }

  if (format === "percent") {
    return `${sign}${(value * 100).toFixed(1)}pp`;
  }

  return `${sign}${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)}`;
}

function getKpiTrend(rows: DataRow[], field?: string) {
  if (!field || rows.length < 2) {
    return null;
  }

  const current = toNumber(rows[0]?.[field] ?? null);
  const previous = toNumber(rows[1]?.[field] ?? null);
  const delta = current - previous;
  const deltaRate = previous === 0 ? null : delta / Math.abs(previous);

  return {
    delta,
    deltaRate,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function escapeCsvCell(value: RowValue) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function filterRowsByKeyword(rows: DataRow[], keyword: string) {
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return rows;
  }

  return rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalized)),
  );
}

function EmptyState({
  description = "当前组件没有可展示的数据，请检查底表字段、筛选条件或指标口径。",
  isDark,
}: {
  description?: string;
  isDark: boolean;
}) {
  return (
    <div
      className={`flex min-h-40 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm ${
        isDark ? "border-white/10 bg-white/[0.03] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {description}
    </div>
  );
}

function getDatasetForSource(document: DashboardDocument, datasets: DatasetMetadata[], dataSourceId?: string) {
  const dataSource = document.dataSources.find((source) => source.id === dataSourceId);
  return datasets.find((dataset) => dataset.id === dataSource?.binding?.datasetId) ?? datasets[0];
}

function useResolvedViews(document: DashboardDocument, datasets: DatasetMetadata[], refreshKey: number) {
  const [remoteViews, setRemoteViews] = useState<Map<string, DataRow[]>>(new Map());
  const fallbackViews = useMemo(() => {
    const views = new Map<string, DataRow[]>();

    for (const view of document.views) {
      const dataset = getDatasetForSource(document, datasets, view.dataSourceId);
      const baseRows = ((dataset?.rows ?? dataset?.sampleRows) ?? []) as DataRow[];
      views.set(view.id, aggregateRows(baseRows, view));
    }

    return views;
  }, [datasets, document]);

  const refreshViews = useCallback(async () => {
    const response = await fetch("/api/datasets/query", {
      body: JSON.stringify({
        dataSources: document.dataSources,
        kind: "views",
        syncDue: true,
        views: document.views,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      setRemoteViews(fallbackViews);
      return;
    }

    const payload = (await response.json()) as { rowsByView: Record<string, DataRow[]> };
    setRemoteViews(new Map(Object.entries(payload.rowsByView)));
  }, [document.dataSources, document.views, fallbackViews]);

  useEffect(() => {
    void refreshViews();
  }, [refreshKey, refreshViews]);

  useEffect(() => {
    const policy = document.refreshPolicy;

    if (policy?.mode !== "auto" || !policy.intervalSeconds) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshViews();
    }, policy.intervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [document.refreshPolicy, refreshViews]);

  return remoteViews.size > 0 ? remoteViews : fallbackViews;
}

function ChartCard({
  component,
  designSpec,
  isDark,
  onDrilldown,
  rows,
}: {
  component: DashboardComponent;
  designSpec: DesignSpecification;
  isDark: boolean;
  onDrilldown?: (filter: DashboardDataFilter) => void;
  rows: DataRow[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const series = useMemo(() => component.data?.series ?? [], [component.data?.series]);
  const hasNoChartData = rows.length === 0 || (component.type !== "donut" && series.length === 0);

  useEffect(() => {
    if (!chartRef.current || hasNoChartData) {
      return;
    }

    const chart = echarts.init(chartRef.current);
    const xField = component.data?.x?.field;
    const categories = xField ? rows.map((row) => String(row[xField] ?? "未分类")) : rows.map((_, index) => `${index + 1}`);
    const palette = [
      designSpec.colorPalette.primary,
      designSpec.colorPalette.accent,
      designSpec.colorPalette.success,
      designSpec.colorPalette.warning,
      designSpec.colorPalette.danger,
    ];
    const axisColor = designSpec.colorPalette.muted;
    const lineColor = isDark ? "rgba(148,163,184,0.18)" : "rgba(148,163,184,0.16)";
    const tooltip = {
      backgroundColor: isDark ? "rgba(15,23,42,0.94)" : "rgba(255,255,255,0.96)",
      borderColor: designSpec.cardStyle.border,
      borderWidth: 1,
      textStyle: { color: designSpec.colorPalette.text, fontSize: 12 },
    };

    if (component.type === "donut") {
      const valueField = series[0]?.field ?? component.data?.value?.field;

      chart.setOption({
        color: palette,
        legend: { bottom: 0, itemGap: 14, textStyle: { color: axisColor, fontSize: 11 }, type: "scroll" },
        series: [
          {
            data: rows.map((row, index) => ({
              name: xField ? String(row[xField] ?? "未分类") : categories[index],
              value: toNumber(valueField ? row[valueField] ?? null : null),
            })),
            radius: designSpec.chartStyle.donutThickness === "thin" ? ["58%", "76%"] : ["48%", "72%"],
            avoidLabelOverlap: true,
            label: { color: axisColor, fontSize: 11 },
            type: "pie",
          },
        ],
        tooltip: { ...tooltip, trigger: "item" },
      });
    } else {
      const isHorizontal =
        component.type === "horizontal_bar" ||
        component.type === "horizontal_stacked_bar" ||
        component.echarts?.horizontal;
      const isStacked =
        component.type === "stacked_bar" ||
        component.type === "horizontal_stacked_bar" ||
        component.echarts?.stack;
      const valueAxis = {
        axisLabel: { color: axisColor },
        splitLine: { show: designSpec.chartStyle.gridLine !== "none", lineStyle: { color: lineColor, type: "dashed" } },
        type: "value",
      };
      const categoryAxis = {
        axisLine: { show: designSpec.chartStyle.axis !== "minimal", lineStyle: { color: lineColor } },
        axisLabel: { color: axisColor, interval: 0, overflow: "truncate", width: 88 },
        axisTick: { show: false },
        data: categories,
        type: "category",
      };

      chart.setOption({
        color: palette,
        grid: isHorizontal ? { bottom: 28, left: 88, right: 18, top: 28 } : { bottom: 36, left: 42, right: 18, top: 28 },
        legend: {
          show: component.echarts?.legend ?? (isStacked || (designSpec.chartStyle.legend !== "hidden" && series.length > 1)),
          textStyle: { color: axisColor, fontSize: 11 },
        },
        series: series.map((item) => ({
          areaStyle: item.area ? { opacity: 0.1 } : undefined,
          barMaxWidth: 34,
          itemStyle: { borderRadius: component.type.includes("bar") ? designSpec.chartStyle.barRadius : 0 },
          data: rows.map((row) => toNumber(row[item.field] ?? null)),
          name: item.name,
          smooth: component.echarts?.smooth ?? designSpec.chartStyle.lineSmooth,
          stack: isStacked ? item.stack ?? "total" : undefined,
          type: component.type.includes("bar") ? "bar" : item.type ?? component.type,
        })),
        tooltip: { ...tooltip, trigger: "axis" },
        xAxis: isHorizontal ? valueAxis : categoryAxis,
        yAxis: isHorizontal ? categoryAxis : valueAxis,
      });
    }

    chart.off("click");
    chart.on("click", (event) => {
      const drilldown = component.interactions?.find((interaction) => interaction.type === "drilldown");
      const filterField = drilldown?.filterField ?? component.data?.x?.field;

      if (!filterField || event.name === undefined) {
        return;
      }

      onDrilldown?.({
        field: filterField,
        op: "eq",
        value: String(event.name),
      });
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [component, designSpec, hasNoChartData, isDark, onDrilldown, rows, series]);

  if (hasNoChartData) {
    return <EmptyState description={component.description} isDark={isDark} />;
  }

  return <div ref={chartRef} className="h-72 w-full" />;
}

function KpiCard({
  component,
  designSpec,
  isDark,
  rows,
}: {
  component: DashboardComponent;
  designSpec: DesignSpecification;
  isDark: boolean;
  rows: DataRow[];
}) {
  const valueField = component.data?.value?.field;
  const value = valueField ? rows[0]?.[valueField] : null;
  const format = component.data?.value?.format;
  const unit = format === "percent" ? "当前占比" : format === "currency_cny" ? "人民币口径" : "真实底表聚合";
  const trend = getKpiTrend(rows, valueField);
  const trendColor =
    trend?.direction === "up"
      ? designSpec.colorPalette.success
      : trend?.direction === "down"
        ? designSpec.colorPalette.danger
        : designSpec.colorPalette.muted;

  return (
    <div>
      <p
        className={`font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}
        style={{ color: designSpec.colorPalette.text, fontSize: designSpec.typographyScale.numeric }}
      >
        {formatValue(value ?? null, format)}
      </p>
      {trend ? (
        <p className="mt-2 text-xs font-medium" style={{ color: trendColor }}>
          较上期 {formatSignedValue(trend.delta, format)}
          {trend.deltaRate !== null ? ` · ${trend.deltaRate > 0 ? "+" : ""}${(trend.deltaRate * 100).toFixed(1)}%` : ""}
        </p>
      ) : null}
      {component.description ? <p className="mt-2 text-sm text-muted">{component.description}</p> : null}
      <p className="mt-2 text-xs text-muted">{unit}</p>
    </div>
  );
}

function KpiGroupCard({
  component,
  designSpec,
  rows,
}: {
  component: DashboardComponent;
  designSpec: DesignSpecification;
  rows: DataRow[];
}) {
  const values = component.data?.series?.length
    ? component.data.series
    : component.data?.value
      ? [{ field: component.data.value.field, name: component.title }]
      : [];

  return (
    <div className="grid gap-3">
      {values.map((item) => (
        <div key={`${component.id}-${item.field}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="min-w-0 truncate text-xs text-muted">{item.name}</span>
          <span className="font-semibold tabular-nums" style={{ color: designSpec.colorPalette.text }}>
            {formatValue(rows[0]?.[item.field] ?? null, component.data?.value?.format)}
          </span>
        </div>
      ))}
      {values.length === 0 ? <p className="text-sm text-muted">{component.description ?? "当前缺少可展示的分组指标。"}</p> : null}
    </div>
  );
}

function TableCard({ component, isDark, rows }: { component: DashboardComponent; isDark: boolean; rows: DataRow[] }) {
  const [sortState, setSortState] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const columns = component.data?.columns?.length ? component.data.columns : Object.keys(rows[0] ?? {}).slice(0, 5);
  const sortedRows = useMemo(() => {
    if (!sortState) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aValue = a[sortState.column];
      const bValue = b[sortState.column];
      const aNumber = toNumber(aValue);
      const bNumber = toNumber(bValue);
      const result =
        Number.isFinite(aNumber) && Number.isFinite(bNumber)
          ? aNumber - bNumber
          : String(aValue ?? "").localeCompare(String(bValue ?? ""), "zh-CN");

      return sortState.direction === "asc" ? result : -result;
    });
  }, [rows, sortState]);

  function toggleSort(column: string) {
    setSortState((current) =>
      current?.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  function exportCsv() {
    const csv = [
      columns.map((column) => escapeCsvCell(column)).join(","),
      ...sortedRows.map((row) => columns.map((column) => escapeCsvCell(row[column] ?? null)).join(",")),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${component.title || "dashboard-table"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0 || columns.length === 0) {
    return <EmptyState description={component.description} isDark={isDark} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">共 {rows.length} 行 · 点击列名排序</p>
        <button
          className={`no-wrap-control rounded-full border px-3 py-1.5 text-xs ${isDark ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-black/10 bg-white/70"}`}
          type="button"
          onClick={exportCsv}
        >
          导出 CSV
        </button>
      </div>
      <div className={`overflow-x-auto rounded-2xl border ${isDark ? "border-white/10 bg-white/[0.04]" : "border-slate-200/70 bg-white/70"}`}>
        <table className="min-w-full text-left text-sm">
          <thead className={isDark ? "bg-white/[0.04] text-slate-300" : "bg-slate-50 text-muted"}>
            <tr>
              {columns.map((column) => (
                <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">
                  <button className="inline-flex items-center gap-1" type="button" onClick={() => toggleSort(column)}>
                    {column}
                    {sortState?.column === column ? <span>{sortState.direction === "asc" ? "↑" : "↓"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.slice(0, 12).map((row, index) => (
              <tr key={index} className={isDark ? "border-t border-white/10" : "border-t border-slate-100"}>
                {columns.map((column) => (
                  <td key={column} className={`max-w-48 truncate px-3 py-2 tabular-nums ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {formatValue(row[column] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardCard({
  component,
  designSpec,
  isDark,
  onOpenDetail,
  onDrilldown,
  rows,
}: {
  component: DashboardComponent;
  designSpec: DesignSpecification;
  isDark: boolean;
  onOpenDetail?: (component: DashboardComponent) => void;
  onDrilldown?: (component: DashboardComponent, filter: DashboardDataFilter) => void;
  rows: DataRow[];
}) {
  const tone = getToneClass(component.style?.tone, isDark);
  const [assistantNote, setAssistantNote] = useState("");
  const valueField = component.data?.value?.field ?? component.data?.series?.[0]?.field;
  const xField = component.data?.x?.field;
  const sampleValue = valueField ? rows[0]?.[valueField] : null;

  if (component.type === "dashboard_title" || component.type === "section_title") {
    const isDashboardTitle = component.type === "dashboard_title";

    return (
      <section className={`${colSpanClass(component.layout.colSpan)} ${isDashboardTitle ? "pt-2" : "pt-4"}`}>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">{isDashboardTitle ? "Dashboard" : "Section"}</p>
        <h2
          className={`${isDashboardTitle ? "mt-2 font-semibold tracking-tight" : "mt-1 text-lg font-semibold"}`}
          style={{
            color: designSpec.colorPalette.text,
            fontSize: isDashboardTitle ? designSpec.typographyScale.title : designSpec.typographyScale.sectionTitle,
          }}
        >
          {component.title}
        </h2>
        {component.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{component.description}</p> : null}
      </section>
    );
  }

  if (component.type === "empty_state") {
    return (
      <section className={`${colSpanClass(component.layout.colSpan)} border border-dashed`} style={getCardStyle(designSpec, isDark)}>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">待接入</p>
        <h3 className="mt-2 font-semibold" style={{ color: designSpec.colorPalette.text, fontSize: designSpec.typographyScale.sectionTitle }}>
          {component.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">{component.description ?? "当前数据集中缺少该模块所需字段，已保留为后续接入占位。"}</p>
      </section>
    );
  }

  return (
    <section className={`${colSpanClass(component.layout.colSpan)} border ${tone}`} style={getCardStyle(designSpec, isDark)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={isDark ? "text-xs font-medium uppercase tracking-[0.18em] text-slate-500" : "text-xs font-medium uppercase tracking-[0.18em] text-slate-400"}>{component.type}</p>
          <h3
            className={`mt-1 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            style={{ color: designSpec.colorPalette.text, fontSize: designSpec.typographyScale.sectionTitle }}
          >
            {component.title}
          </h3>
          {component.description && component.type !== "kpi" ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{component.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <button
            className={`no-wrap-control rounded-full border px-3 py-1.5 text-xs ${isDark ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-black/10 bg-white/70"}`}
            type="button"
            onClick={() =>
              setAssistantNote(
                `这个组件使用 view「${component.data?.viewId ?? "未绑定"}」；${
                  xField ? `按「${xField}」分组，` : ""
                }展示「${valueField ?? component.data?.columns?.join("、") ?? "明细字段"}」。当前首条结果为 ${
                  sampleValue === null || sampleValue === undefined ? "空" : formatValue(sampleValue)
                }。`,
              )
            }
          >
            解释
          </button>
          {component.interactions?.some((interaction) => interaction.type === "drilldown") ? (
            <button
              className={`no-wrap-control rounded-full border px-3 py-1.5 text-xs ${isDark ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-black/10 bg-white/70"}`}
              type="button"
              onClick={() => onOpenDetail?.(component)}
            >
              明细
            </button>
          ) : null}
          <button
            className={`no-wrap-control rounded-full border px-3 py-1.5 text-xs ${isDark ? "border-white/10 bg-white/[0.06] text-slate-200" : "border-black/10 bg-white/70"}`}
            type="button"
            onClick={() => setAssistantNote(`可以在底部对话框输入：把「${component.title}」改成更适合的图表或调整布局。`)}
          >
            修改
          </button>
        </div>
      </div>
      {assistantNote ? (
        <div className={`mb-4 rounded-2xl border p-3 text-xs leading-5 text-muted ${isDark ? "border-white/10 bg-white/[0.06]" : "border-black/5 bg-white/75"}`}>
          <div className="flex items-start justify-between gap-3">
            <p>{assistantNote}</p>
            <button className="shrink-0 text-current" type="button" onClick={() => setAssistantNote("")}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      {component.type === "kpi" ? <KpiCard component={component} designSpec={designSpec} isDark={isDark} rows={rows} /> : null}
      {component.type === "kpi_group" ? <KpiGroupCard component={component} designSpec={designSpec} rows={rows} /> : null}
      {component.type === "line" ||
      component.type === "bar" ||
      component.type === "horizontal_bar" ||
      component.type === "stacked_bar" ||
      component.type === "horizontal_stacked_bar" ||
      component.type === "donut" ? (
        <ChartCard component={component} designSpec={designSpec} isDark={isDark} rows={rows} onDrilldown={(filter) => onDrilldown?.(component, filter)} />
      ) : null}
      {component.type === "table" ? <TableCard component={component} isDark={isDark} rows={rows} /> : null}
      {component.type === "insight" ? (
        <p className={`rounded-2xl p-4 text-sm leading-6 text-muted ${isDark ? "bg-white/[0.06]" : "bg-black/[0.03]"}`}>{component.insight ?? component.description}</p>
      ) : null}
      {component.chartRecommendation ? (
        <p className="mt-4 text-xs leading-5 text-muted">图表校准：{component.chartRecommendation.reason}</p>
      ) : null}
    </section>
  );
}

export function DashboardRenderer({
  artifactId,
  dataset,
  datasets,
  document,
}: {
  artifactId?: string;
  dataset?: DatasetMetadata;
  datasets?: DatasetMetadata[];
  document: DashboardDocument;
}) {
  const resolvedDatasets = datasets?.length ? datasets : dataset ? [dataset] : [];
  const [detailRows, setDetailRows] = useState<DataRow[]>([]);
  const [activeDetailView, setActiveDetailView] = useState<DashboardDetailView | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState(document.refreshPolicy?.lastCalculatedAt ?? document.meta.updatedAt);
  const [refreshKey, setRefreshKey] = useState(0);
  const [globalKeyword, setGlobalKeyword] = useState("");
  const views = useResolvedViews(document, resolvedDatasets, refreshKey);
  const isDark = document.theme.mode === "dark";
  const designSpec = getResolvedDesignSpec(document, isDark);

  function getRowsForComponent(component: DashboardComponent) {
    const rows =
      views.get(component.data?.viewId ?? "") ??
      (((getDatasetForSource(
        document,
        resolvedDatasets,
        document.views.find((view) => view.id === component.data?.viewId)?.dataSourceId,
      )?.rows ??
        getDatasetForSource(
          document,
          resolvedDatasets,
          document.views.find((view) => view.id === component.data?.viewId)?.dataSourceId,
        )?.sampleRows) ??
        []) as DataRow[]);

    if (component.type === "kpi" || component.type === "kpi_group") {
      return rows;
    }

    return filterRowsByKeyword(rows, globalKeyword);
  }

  async function recalculate() {
    if (!artifactId) {
      setRefreshKey((current) => current + 1);
      setLastCalculatedAt(new Date().toISOString());
      return;
    }

    setIsRecalculating(true);
    try {
      const response = await fetch(`/api/artifacts/${artifactId}/recalculate`, {
        method: "POST",
      });

      if (response.ok) {
        const payload = (await response.json()) as { lastCalculatedAt?: string };
        setLastCalculatedAt(payload.lastCalculatedAt ?? new Date().toISOString());
      }

      setRefreshKey((current) => current + 1);
    } finally {
      setIsRecalculating(false);
    }
  }

  async function handleDrilldown(component: DashboardComponent, filter: DashboardDataFilter) {
    const interaction = component.interactions?.find((item) => item.type === "drilldown");
    const detailView = document.detailViews?.find((item) => item.id === interaction?.detailViewId);

    if (!detailView) {
      return;
    }

    const response = await fetch("/api/datasets/query", {
      body: JSON.stringify({
        dataSources: document.dataSources,
        detailView,
        kind: "detail",
        runtimeFilters: [filter],
        syncDue: true,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { rows: DataRow[] };
    setActiveDetailView(detailView);
    setDetailRows(payload.rows);
  }

  async function openComponentDetail(component: DashboardComponent) {
    const interaction = component.interactions?.find((item) => item.type === "drilldown");
    const detailView = document.detailViews?.find((item) => item.id === interaction?.detailViewId);

    if (!detailView) {
      return;
    }

    const response = await fetch("/api/datasets/query", {
      body: JSON.stringify({
        dataSources: document.dataSources,
        detailView,
        kind: "detail",
        runtimeFilters: [],
        syncDue: true,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { rows: DataRow[] };
    setActiveDetailView(detailView);
    setDetailRows(payload.rows);
  }

  return (
    <div
      className={`min-h-[720px] p-4 sm:p-6 ${isDark ? "text-slate-100" : "text-[#111827]"}`}
      style={{ background: designSpec.colorPalette.background, color: designSpec.colorPalette.text }}
    >
      <div className="mx-auto max-w-7xl">
        <header
          className={`mb-6 border ${isDark ? "border-white/10 bg-white/[0.06]" : "border-black/5 bg-white/80"}`}
          style={getCardStyle(designSpec, isDark)}
        >
          <p className="text-sm text-muted">仪表盘 JSON · {document.schemaVersion}</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
            <h2 className="font-semibold tracking-tight" style={{ fontSize: designSpec.typographyScale.title }}>
              {document.title}
            </h2>
            <button
              className={`no-wrap-control rounded-full px-4 py-2 text-sm font-medium ${isDark ? "bg-white text-slate-950" : "bg-black text-white"}`}
              type="button"
              onClick={() => void recalculate()}
            >
              {isRecalculating ? "重新计算中" : "重新计算"}
            </button>
          </div>
          {document.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{document.description}</p> : null}
          <div className="mt-4 flex flex-col gap-2 sm:max-w-md">
            <label className="text-xs font-medium text-muted" htmlFor="dashboard-global-search">
              全局筛选
            </label>
            <input
              id="dashboard-global-search"
              className={`rounded-2xl border px-4 py-2 text-sm outline-none transition ${
                isDark ? "border-white/10 bg-white/[0.06] text-white placeholder:text-slate-500" : "border-black/10 bg-white/80"
              }`}
              placeholder="输入关键词过滤当前看板数据"
              value={globalKeyword}
              onChange={(event) => setGlobalKeyword(event.target.value)}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            刷新策略：{document.refreshPolicy?.mode ?? "manual"}
            {document.refreshPolicy?.intervalSeconds ? ` · ${document.refreshPolicy.intervalSeconds}s` : ""}
            {lastCalculatedAt ? ` · 最近计算 ${new Date(lastCalculatedAt).toLocaleString()}` : ""}
          </p>
        </header>
        <main className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {document.components.map((component) => (
            <DashboardCard
              key={component.id}
              component={component}
              isDark={isDark}
              onOpenDetail={openComponentDetail}
              onDrilldown={handleDrilldown}
              rows={getRowsForComponent(component)}
              designSpec={designSpec}
            />
          ))}
        </main>
        {document.insights?.length ? (
          <section className="mt-6 grid gap-3">
            {document.insights.map((insight) => (
              <p key={insight.id} className={`rounded-2xl border p-4 text-sm leading-6 text-muted ${isDark ? "border-white/10 bg-white/[0.06]" : "border-black/5 bg-white/70"}`}>
                {insight.text}
              </p>
            ))}
          </section>
        ) : null}
        {activeDetailView ? (
          <section className={`mt-6 rounded-3xl border p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${isDark ? "border-white/10 bg-white/[0.06]" : "border-black/5 bg-white/80"}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Drilldown</p>
                <h3 className="text-xl font-semibold">{activeDetailView.title}</h3>
              </div>
              <button
                className={`no-wrap-control rounded-full border px-4 py-2 text-sm ${isDark ? "border-white/10 text-slate-200" : "border-black/10"}`}
                type="button"
                onClick={() => setActiveDetailView(null)}
              >
                关闭
              </button>
            </div>
            <TableCard
              component={{
                data: { columns: activeDetailView.columns, viewId: activeDetailView.baseViewId ?? "" },
                id: activeDetailView.id,
                layout: { colSpan: 12 },
                title: activeDetailView.title,
                type: "table",
              }}
              isDark={isDark}
              rows={detailRows}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
