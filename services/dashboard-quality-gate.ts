import type {
  DashboardComponent,
  DashboardComponentType,
  DashboardDocument,
  DataUnderstanding,
  DimensionContract,
  MetricContract,
  MetricSystem,
} from "@/lib/types";

type QualityIssue = {
  category: "data" | "bi" | "design" | "technical";
  severity: "low" | "medium" | "high";
  message: string;
};

function getMetricByAlias(metrics: MetricContract[], alias?: string) {
  return metrics.find((metric) => metric.as === alias || metric.id === alias);
}

function getFieldRole(dataUnderstanding: DataUnderstanding, field?: string) {
  return dataUnderstanding.fields.find((item) => item.name === field)?.semanticRole;
}

function getDimensionRole(dimensions: DimensionContract[], field?: string) {
  return dimensions.find((dimension) => dimension.field === field)?.role;
}

function shouldUseDonut(params: {
  component: DashboardComponent;
  dataUnderstanding: DataUnderstanding;
  dimensions: DimensionContract[];
  viewLimit: number;
}) {
  const xField = params.component.data?.x?.field;
  const fieldRole = getFieldRole(params.dataUnderstanding, xField);
  const dimensionRole = getDimensionRole(params.dimensions, xField);
  const text = `${params.component.title} ${params.component.description ?? ""}`;

  return (
    params.viewLimit <= 6 &&
    params.component.type !== "donut" &&
    params.component.data?.series?.length === 1 &&
    (dimensionRole === "status" ||
      /状态|阶段|来源|渠道|构成|占比|分布/.test(text) ||
      (fieldRole === "dimension" && /状态|来源|渠道/.test(xField ?? "")))
  );
}

function withMetricDescription(component: DashboardComponent, metrics: MetricContract[]) {
  const metric = getMetricByAlias(metrics, component.data?.value?.field ?? component.data?.series?.[0]?.field);

  if (!metric) {
    return component;
  }

  const limitation = metric.limitations.length > 0 ? `限制：${metric.limitations.slice(0, 2).join("；")}` : "";
  const descriptionParts = [component.description, `口径：${metric.businessDefinition}`, limitation].filter(Boolean);

  return {
    ...component,
    description: Array.from(new Set(descriptionParts)).join("。"),
  };
}

function createLimitationsInsight(params: {
  metricSystem?: MetricSystem;
  existingComponents: DashboardComponent[];
}) {
  const gaps = params.metricSystem?.metricGaps ?? [];

  if (gaps.length === 0 || params.existingComponents.some((component) => /数据限制|指标缺口|口径限制/.test(component.title))) {
    return undefined;
  }

  return {
    id: "component_metric_limitations",
    type: "insight" as DashboardComponentType,
    title: "数据限制与指标缺口",
    description: "当前看板仅展示可由真实字段支撑的指标，未满足的复杂指标在此说明。",
    layout: {
      colSpan: 12,
      rowSpan: 1,
    },
    insight: gaps
      .slice(0, 3)
      .map((gap) => `${gap.name}：${gap.reason}；当前替代方案：${gap.fallback}`)
      .join("\n"),
  };
}

export function applyDashboardQualityGate(params: {
  dashboard: DashboardDocument;
  dataUnderstanding: DataUnderstanding;
  dimensionContracts: DimensionContract[];
  metricContracts: MetricContract[];
  metricSystem?: MetricSystem;
}) {
  const issues: QualityIssue[] = [];
  const corrections: string[] = [];
  const views = new Map(params.dashboard.views.map((view) => [view.id, view]));
  let donutCount = params.dashboard.components.filter((component) => component.type === "donut").length;

  const components = params.dashboard.components.map((component, index) => {
    let nextComponent = component;

    if (component.type === "kpi" || component.type === "kpi_group") {
      nextComponent = withMetricDescription(nextComponent, params.metricContracts);

      if (!nextComponent.description?.includes("口径")) {
        issues.push({
          category: "bi",
          severity: "medium",
          message: `${component.title} 缺少指标口径说明。`,
        });
      }
    }

    const view = views.get(component.data?.viewId ?? "");
    if (
      view &&
      shouldUseDonut({
        component,
        dataUnderstanding: params.dataUnderstanding,
        dimensions: params.dimensionContracts,
        viewLimit: view.transform?.limit ?? 12,
      }) &&
      donutCount < 2
    ) {
      donutCount += 1;
      corrections.push(`将「${component.title}」从 ${component.type} 校正为 donut，用于少量状态/来源构成。`);
      nextComponent = {
        ...nextComponent,
        chartRecommendation: {
          confidence: 0.86,
          reason: "少量状态/来源构成更适合用环图表达占比。",
          selectedType: "donut",
        },
        type: "donut",
      };
    }

    if (index < 4 && component.type !== "kpi" && component.type !== "kpi_group" && /总览|核心|KPI/i.test(component.title)) {
      issues.push({
        category: "bi",
        severity: "low",
        message: "首屏核心区应优先放置 KPI 或 KPI group。",
      });
    }

    return nextComponent;
  });

  const limitationsInsight = createLimitationsInsight({
    existingComponents: components,
    metricSystem: params.metricSystem,
  });

  if (limitationsInsight) {
    corrections.push("已补充数据限制与指标缺口说明，避免不可执行指标被误读为真实 KPI。");
  }

  const issuePenalty = issues.reduce((sum, issue) => {
    if (issue.severity === "high") return sum + 12;
    if (issue.severity === "medium") return sum + 6;
    return sum + 2;
  }, 0);
  const gapPenalty = params.metricSystem?.metricGaps.length ? 4 : 0;
  const score = Math.max(0, Math.min(100, 96 - issuePenalty - gapPenalty + Math.min(corrections.length * 2, 6)));

  const dashboard: DashboardDocument = {
    ...params.dashboard,
    components: limitationsInsight ? [...components, limitationsInsight] : components,
    insights: [
      ...(params.dashboard.insights ?? []),
      ...(limitationsInsight?.insight
        ? [
            {
              id: "insight_metric_limitations",
              severity: "warning" as const,
              sourceComponentId: limitationsInsight.id,
              text: limitationsInsight.insight,
            },
          ]
        : []),
    ],
  };

  return {
    corrections,
    dashboard,
    issues,
    score,
  };
}
