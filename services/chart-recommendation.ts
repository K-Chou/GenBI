import type {
  DashboardComponent,
  DashboardComponentType,
  DashboardDataView,
  DashboardDocument,
  DataUnderstanding,
} from "@/lib/types";

function getFieldRole(dataUnderstanding: DataUnderstanding, fieldName?: string) {
  return dataUnderstanding.fields.find((field) => field.name === fieldName)?.semanticRole;
}

function isHighCardinalityField(params: {
  viewLimit: number;
}) {
  return params.viewLimit > 6;
}

function getRecommendedChartType(params: {
  component: DashboardComponent;
  donutCount: number;
  dataUnderstanding: DataUnderstanding;
  view?: DashboardDataView;
}): {
  confidence: number;
  reason: string;
  selectedType: DashboardComponentType;
} {
  const groupBy = params.view?.transform?.groupBy ?? [];
  const metrics = params.view?.transform?.metrics ?? [];
  const xField = params.component.data?.x?.field ?? groupBy[0];
  const xRole = getFieldRole(params.dataUnderstanding, xField);
  const isDateField = Boolean(xField && (xRole === "date" || params.dataUnderstanding.dateFields.includes(xField)));
  const hasMetric = metrics.length > 0 || Boolean(params.component.data?.series?.length || params.component.data?.value);
  const viewLimit = params.view?.transform?.limit ?? 12;
  const metricCount = metrics.length || params.component.data?.series?.length || 0;
  const highCardinality = isHighCardinalityField({
    viewLimit,
  });

  if (
    params.component.type === "dashboard_title" ||
    params.component.type === "section_title" ||
    params.component.type === "insight" ||
    params.component.type === "empty_state"
  ) {
    return {
      confidence: 0.95,
      reason: "结构组件或说明组件不参与图表类型校准。",
      selectedType: params.component.type,
    };
  }

  if (
    params.component.type === "horizontal_bar" ||
    params.component.type === "stacked_bar" ||
    params.component.type === "horizontal_stacked_bar" ||
    params.component.type === "kpi_group"
  ) {
    return {
      confidence: 0.86,
      reason: "组件已按运营看板范式选择专用表达方式，保留原图表类型。",
      selectedType: params.component.type,
    };
  }

  if (params.component.type === "kpi" || groupBy.length === 0) {
    return {
      confidence: 0.9,
      reason: "无分组维度或组件已规划为 KPI，适合用 KPI 卡片表达单一核心指标。",
      selectedType: "kpi",
    };
  }

  if (isDateField && hasMetric) {
    return {
      confidence: 0.92,
      reason: `维度字段 ${xField} 被识别为日期/时间字段，适合用折线图表达趋势。`,
      selectedType: "line",
    };
  }

  if (metricCount > 1 && groupBy.length >= 1 && hasMetric) {
    return {
      confidence: 0.88,
      reason: "存在多个指标系列，适合用柱状图表达分组对比，避免多系列环图难以阅读。",
      selectedType: "bar",
    };
  }

  if (params.component.type === "donut" && groupBy.length === 1 && metricCount <= 1 && !highCardinality && params.donutCount < 3) {
    return {
      confidence: 0.78,
      reason: "单一分类维度和单一指标可用于构成占比，保留环图表达。",
      selectedType: "donut",
    };
  }

  if (params.component.type === "donut" && (highCardinality || params.donutCount >= 3)) {
    return {
      confidence: 0.88,
      reason: "分类数量较多或当前看板环图已较多，改用柱状图提升可读性。",
      selectedType: "bar",
    };
  }

  if (groupBy.length >= 1 && hasMetric) {
    return {
      confidence: 0.86,
      reason: `维度字段 ${xField} 被识别为分类维度，适合用柱状图做分类对比或 TopN 定位。`,
      selectedType: "bar",
    };
  }

  return {
    confidence: 0.65,
    reason: "缺少明确指标或维度，使用表格保留明细可读性。",
    selectedType: "table",
  };
}

export function applyChartRecommendations(params: {
  dashboard: DashboardDocument;
  dataUnderstanding: DataUnderstanding;
}): DashboardDocument {
  const views = new Map(params.dashboard.views.map((view) => [view.id, view]));
  let acceptedDonutCount = 0;

  return {
    ...params.dashboard,
    components: params.dashboard.components.map((component) => {
      if (
        component.type === "dashboard_title" ||
        component.type === "section_title" ||
        component.type === "insight" ||
        component.type === "empty_state" ||
        component.type === "table"
      ) {
        return component;
      }

      const recommendation = getRecommendedChartType({
        component,
        donutCount: acceptedDonutCount,
        dataUnderstanding: params.dataUnderstanding,
        view: views.get(component.data?.viewId ?? ""),
      });

      if (recommendation.selectedType === "donut") {
        acceptedDonutCount += 1;
      }

      const nextSeries = component.data?.series?.map((series) => ({
        ...series,
        type:
          recommendation.selectedType === "line" || recommendation.selectedType === "bar"
            ? recommendation.selectedType
            : series.type,
      }));

      return {
        ...component,
        chartRecommendation: recommendation,
        data: component.data
          ? {
              ...component.data,
              series: nextSeries,
            }
          : component.data,
        echarts: {
          ...component.echarts,
          horizontal: recommendation.selectedType === "horizontal_bar" || recommendation.selectedType === "horizontal_stacked_bar",
          smooth: recommendation.selectedType === "line" ? true : component.echarts?.smooth,
          stack: recommendation.selectedType === "stacked_bar" || recommendation.selectedType === "horizontal_stacked_bar" ? true : component.echarts?.stack,
        },
        type: recommendation.selectedType,
      };
    }),
  };
}
