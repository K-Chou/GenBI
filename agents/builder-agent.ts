import type {
  DashboardBlueprint,
  DashboardDocument,
  DashboardSkill,
  DataUnderstanding,
  DatasetMetadata,
  DesignSpecification,
  DimensionContract,
  IntentUnderstanding,
  MetricContract,
  MetricSystem,
  ReferenceImageAnalysis,
  SemanticModel,
} from "@/lib/types";
import { compactDatasetForAgent } from "@/lib/dataset-agent-context";
import { dashboardDocumentSystemPrompt } from "@/prompts/dashboard-system";
import { completeJson } from "@/services/deepseek";

function stringifyValue(value: string | number | boolean | null) {
  if (value === null || value === undefined || value === "") {
    return "空值";
  }

  return String(value);
}

function getTopValues(values: Array<string | number | boolean | null>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const key = stringifyValue(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));
}

function buildDatasetEvidence(dataset: DatasetMetadata) {
  const sampleRows = dataset.sampleRows.slice(0, 20);
  const sampleRowCount = sampleRows.length;

  return {
    rowCount: dataset.rowCount,
    sampleRowCount,
    sampleScope:
      dataset.rowCount === sampleRowCount
        ? "当前 sampleRows 覆盖完整数据集。"
        : `当前 sampleRows 仅 ${sampleRowCount} 条，完整数据集 ${dataset.rowCount} 行。优先通过 views 让 Renderer/API 基于完整 rows 聚合。`,
    fieldEvidence: dataset.columns.map((column) => {
      const values = sampleRows.map((row) => row[column.name] ?? null);
      const presentValues = values.filter((value) => value !== null && value !== "");
      const numericValues = presentValues
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      return {
        name: column.name,
        type: column.type,
        sampleValues: column.sampleValues.slice(0, 3),
        nonEmptySampleCount: presentValues.length,
        missingSampleCount: sampleRowCount - presentValues.length,
        topValues: getTopValues(values),
        numericSummary:
          column.type === "number" && numericValues.length > 0
            ? {
                min: Math.min(...numericValues),
                max: Math.max(...numericValues),
                average: Number(
                  (numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2),
                ),
              }
            : null,
      };
    }),
  };
}

function buildUserContent(params: {
  userRequest: string;
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  dimensionContracts: DimensionContract[];
  metricContracts: MetricContract[];
  semanticModel: SemanticModel;
  metricSystem?: MetricSystem;
  blueprint: DashboardBlueprint;
  skill: DashboardSkill;
  designSpec?: DesignSpecification;
  imageAnalysis?: ReferenceImageAnalysis;
}) {
  const datasets = params.datasets?.length ? params.datasets : [params.dataset];

  return JSON.stringify(
    {
      userRequest: params.userRequest,
      intent: params.intent,
      dataUnderstanding: params.dataUnderstanding,
      semanticModel: params.semanticModel,
      metricSystem: params.metricSystem,
      metricContracts: params.metricContracts,
      allowedMetricAliases: params.metricContracts.map((metric) => ({
        as: metric.as,
        datasetId: metric.datasetId,
        field: metric.field,
        label: metric.label,
        op: metric.op,
      })),
      dimensionContracts: params.dimensionContracts,
      dashboardBlueprint: params.blueprint,
      dashboardSkill: params.skill,
      designSpecification: params.designSpec,
      referenceImageAnalysis: params.imageAnalysis,
      datasets: datasets.map((dataset, index) => ({
        ...compactDatasetForAgent(dataset, { maxSampleValues: 3 }),
        dataSourceId: `dataset_${index + 1}`,
        datasetEvidence: buildDatasetEvidence(dataset),
      })),
      dataIntegrityRules: [
        "最高优先级是数据准确性：如果真实字段、真实 rows、指标契约无法支撑某个组件，必须删掉或换成可支撑的组件，不允许为了美观保留。",
        "不要编造同比、环比、昨日、上周、平均时长、风险数量或趋势数据。",
        "DashboardDocument 只定义 dataSources、views、metrics、components 的引用关系；所有展示数值必须由 Renderer/API 基于用户底表 rows 计算。",
        "必须优先遵守 metricSystem：north_star/primary 用于 KPI 或顶部摘要，diagnostic 用于分解图，action 用于明细、责任定位或行动洞察。",
        "metricSystem 中 executable=false 的指标不能生成可执行 KPI，只能作为数据缺口说明、empty_state 或 insight。",
        "views[].transform.metrics 只能来自 metricContracts：field/op/as 必须完全匹配某个 metricContract。",
        "views[].transform.groupBy 只能来自 dimensionContracts。",
        "components[].data.viewId 必须引用 views 中存在的 id；字段名必须来自对应 dataSourceId 绑定 Dataset 的 columns。",
        "工单总量、记录量、明细规模等总量类 KPI 优先使用 op=count 的记录数指标，不允许对 ID、编号、标识、多维表标识执行 sum 来伪装总量。",
        "闭环率、超时率、SLA 达标率等比率指标只有在 metricContracts 或可验证 filters 同时支撑分子分母时才可展示；当前协议无法真实计算时必须改成状态拆解图、empty_state 或 insight 限制说明。",
        "平均解决时长、平均响应时长等效率指标只有存在明确时长数字字段时才可展示；不要用无关数字字段替代。",
        "如果存在时间维度，顶部 KPI 必须优先使用最近两期对比 view：groupBy 使用该时间字段，metrics 使用对应 metricContract，sort 按时间字段 desc，limit=2；KPICard 会基于 rows[0] 与 rows[1] 自动计算较上期变化。",
        "不要手写增长率、同比、环比数值；增长/变化只能通过上述最近两期 KPI view 的真实聚合结果计算。",
      ],
      dashboardCompositionRules: [
        "你只执行 dashboardBlueprint 和 designSpecification，不要重新规划新的信息架构或视觉体系。",
        "每个组件必须能映射为 CardHeader/CardTitle/CardDescription/CardContent 结构；title 写业务问题，description 写口径/单位/用途，data 写真实字段引用。",
        "允许使用 dashboard_title、section_title、empty_state 作为无数据绑定的结构组件；它们不需要 viewId，但必须有清晰 title/description。",
        "优先按 总览 KPI -> 原因分析 -> 责任定位 -> 明细/行动建议 组织组件。",
        "工单运营看板顶部必须是 4-6 个 KPI：工单总量/新增、待处理或未解决、关闭/解决规模、平均响应或处理时长、客服人员效率；若数据无法支持某项，用 empty_state 说明缺口，不要用无关字段替代。",
        "客服人员效率必须优先使用 owner/处理人/客服人员维度做 horizontal_bar 或 table，展示人均/个人处理量、未解决量或处理时长。",
        "工单情况分析必须包含状态、类型/来源、优先级/业务线、时间趋势中的至少 3 类维度；不要只生成图表墙。",
        "分类超过 6 项时优先使用 bar，不要使用 donut；donut 只用于少量状态/构成占比。",
        "排版必须对齐：KPI 卡片尽量使用相同 colSpan；同一行组件高度和语义层级保持一致；不要出现 5、7、9、10、11 这类难对齐 colSpan。",
        "必须执行 designSpecification 中的 layoutPattern、density、compositionRules、chartStyle 和 cardStyle；不要再自由发明新的视觉系统。",
      ],
      output: "生成 DashboardDocument JSON。只返回 JSON，不要 HTML、Markdown 或 code fence。",
    },
    null,
    2,
  );
}

function normalizeColSpan(componentType: string, colSpan: number) {
  const safeSpan = Math.max(1, Math.min(12, Math.round(colSpan || 12)));

  if (componentType === "dashboard_title" || componentType === "section_title") {
    return safeSpan <= 6 ? 6 : 12;
  }

  if (componentType === "kpi") {
    if (safeSpan <= 2) return 2;
    return safeSpan <= 4 ? 3 : 4;
  }

  if (componentType === "kpi_group" || componentType === "empty_state") {
    if (safeSpan <= 2) return 2;
    if (safeSpan <= 4) return 4;
    return 6;
  }

  if (componentType === "table" || componentType === "insight") {
    return safeSpan < 8 ? 6 : 12;
  }

  if (safeSpan <= 4) return 4;
  if (safeSpan <= 6) return 6;
  if (safeSpan <= 8) return 8;
  return 12;
}

export async function runBuilderAgent(params: {
  userRequest: string;
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  dimensionContracts: DimensionContract[];
  metricContracts: MetricContract[];
  semanticModel: SemanticModel;
  metricSystem?: MetricSystem;
  blueprint: DashboardBlueprint;
  skill: DashboardSkill;
  designSpec?: DesignSpecification;
  imageAnalysis?: ReferenceImageAnalysis;
}): Promise<DashboardDocument> {
  const datasets = params.datasets?.length ? params.datasets : [params.dataset];

  const dashboard = await completeJson<DashboardDocument>({
    stage: "builder",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `${dashboardDocumentSystemPrompt}

你现在是 Builder Agent。
你必须严格按照 Dashboard Blueprint 生成结构化 DashboardDocument JSON，不要生成 HTML。
你必须应用 Dashboard Skill 中的业务规则、KPI 规则、图表规则、布局规则和设计规则。
你必须应用 Designer Agent 给出的 DesignSpecification，并把它原样写入 DashboardDocument.designSpec。
如果传入 referenceImageAnalysis，必须把它作为视觉设计依据，但不要把参考图原样复制或嵌入。

执行边界：
- 前端渲染引擎负责 Tailwind + ECharts 渲染，你只负责 DashboardDocument JSON 协议。
- dashboardBlueprint 决定信息架构和组件意图；designSpecification 决定视觉 tokens 与布局范式；你只把它们落成 dataSources、views、metrics、components。
- 不要重新发明 KPI、模块、视觉体系或新指标口径；无法由契约支撑的组件改为 empty_state 或删除。
- 控制复杂度：默认 4 个 KPI、3-5 个核心图表、最多 1 个表格和 1 个洞察区。
- colSpan 只使用 2、3、4、6、8、12，并保证移动端单列可读。

数据规则：
- dataSources 必须覆盖用户需求相关 Dataset。多表时使用 id: "dataset_1"、"dataset_2"...，binding.datasetId 使用传入 Dataset id。
- dataSources[].kind 使用 "inline"。
- views 表达数据映射和聚合口径；Renderer/API 会基于完整 rows 或 sampleRows 执行 groupBy/metrics。
- views[].transform.metrics 必须从 metricContracts 选择，field/op/as 必须完全一致。
- views[].transform.groupBy 必须从 dimensionContracts 选择，并且 dataSourceId 必须和所选 metricContract/dimensionContract 的 datasetId 对应。
- DashboardDocument.metrics 必须来自 metricContracts，不要新增模型自由定义的指标。
- components[].data.viewId 必须引用 views 中存在的 id。
- 每个 view 的 dataSourceId 必须引用 dataSources 中存在的 id。
- 字段名只能引用对应 dataSourceId 绑定 Dataset 的 columns 中存在的字段名。
- 不要在 JSON 内做跨表 join；如果需要组合分析，用不同组件分别引用不同 dataSource。
- metrics 用于表达指标口径，简单指标用 field + op，复合指标用 expression。
- detailViews 用于定义点击图表后的明细表字段。
- components[].interactions 用于定义 drilldown，filterField 应与图表 x 字段或分组维度一致。

只返回 JSON，不要 Markdown。
JSON schema:
{
  "schemaVersion": "1.0.0",
  "id": "dashboard_xxx",
  "title": "中文标题",
  "description": "一句话说明",
  "locale": "zh-CN",
  "theme": {"mode": "light | dark | system", "style": "apple-minimal", "radius": 16, "spacing": 24, "maxColors": 5},
  "layout": {"type": "grid", "columns": 12, "gap": 24},
  "designSpec": {"visualStyle": "apple_minimal | executive_premium | operational_command | analytical_editorial", "layoutPattern": "executive_overview | kpi_hero_chart | overview_focus_detail | operational_monitoring", "density": "comfortable | balanced | dense", "designSkillIds": ["apple-design-language", "linear-design", "stripe-dashboard"], "colorPalette": {"background": "#F5F5F7", "surface": "rgba(255,255,255,0.86)", "primary": "#4F46E5", "accent": "#06B6D4", "success": "#10B981", "warning": "#F59E0B", "danger": "#F43F5E", "text": "#111827", "muted": "#64748B"}, "typographyScale": {"title": "32px", "sectionTitle": "18px", "body": "14px", "caption": "12px", "numeric": "40px"}, "cardStyle": {"radius": 22, "shadow": "soft", "border": "rgba(15,23,42,0.08)", "padding": 24}, "chartStyle": {"gridLine": "subtle", "axis": "minimal", "legend": "compact", "tooltip": "soft", "lineSmooth": true, "barRadius": 10, "donutThickness": "medium"}, "compositionRules": ["布局规则"], "referenceInfluence": ["设计依据"], "qualityChecklist": ["质量检查项"]},
  "dataSources": [{"id": "dataset_1", "kind": "inline", "label": "Dataset 名称", "binding": {"datasetId": "dataset id"}, "freshness": {"mode": "static"}}],
  "metrics": [{"id": "metric_id", "label": "指标名", "field": "字段名", "op": "sum | avg | count | min | max", "format": "number | currency_cny | percent", "description": "指标口径"}],
  "refreshPolicy": {"mode": "manual"},
  "views": [{"id": "view_id", "dataSourceId": "dataset_1", "transform": {"filters": [], "groupBy": ["维度字段"], "metrics": [{"field": "指标字段", "op": "sum | avg | count | min | max", "as": "别名"}], "sort": [{"field": "字段或别名", "direction": "asc | desc"}], "limit": 12}}],
  "detailViews": [{"id": "detail_view", "title": "明细", "dataSourceId": "dataset_1", "columns": ["字段名"], "baseViewId": "view_id", "limit": 50}],
  "components": [{"id": "component_id", "type": "dashboard_title | section_title | kpi | kpi_group | line | bar | horizontal_bar | stacked_bar | horizontal_stacked_bar | donut | table | insight | empty_state", "title": "标题", "description": "说明", "layout": {"colSpan": 3, "rowSpan": 1}, "interactions": [{"type": "drilldown", "detailViewId": "detail_view", "filterField": "维度字段"}], "data": {"viewId": "view_id", "value": {"field": "指标别名或字段名", "format": "number | currency_cny | percent"}, "x": {"field": "维度字段", "type": "category | time"}, "series": [{"name": "系列名", "field": "指标别名或字段名", "type": "line | bar", "area": false, "stack": "状态"}], "columns": ["字段名"]}, "style": {"tone": "default | primary | success | warning | danger"}, "insight": "洞察文本", "echarts": {"smooth": true, "legend": false, "stack": false, "horizontal": false}}],
  "insights": [{"id": "insight_1", "text": "洞察", "severity": "info | warning | critical", "sourceComponentId": "component_id"}],
  "meta": {"generatedBy": "genbi-workflow", "createdAt": "ISO 时间", "blueprintTitle": "Blueprint 标题"}
}`,
      },
      {
        role: "user",
        content: buildUserContent(params),
      },
    ],
  });

  return {
    ...dashboard,
    schemaVersion: "1.0.0",
    locale: "zh-CN",
    theme: {
      mode: dashboard.theme?.mode ?? "system",
      style: "apple-minimal",
      radius: 16,
      spacing: 24,
      maxColors: 5,
    },
    layout: {
      type: "grid",
      columns: 12,
      gap: 24,
    },
    designSpec: dashboard.designSpec ?? params.designSpec,
    dataSources:
      dashboard.dataSources?.length > 0
        ? dashboard.dataSources
        : datasets.map((dataset, index) => ({
            id: `dataset_${index + 1}`,
            kind: "inline",
            label: dataset.name,
            binding: { datasetId: dataset.id },
            freshness: { mode: dataset.source?.type === "feishu_bitable" ? "scheduled" : "static" },
          })),
    refreshPolicy: dashboard.refreshPolicy ?? {
      mode: "manual",
    },
    components: (dashboard.components ?? []).map((component) => ({
      ...component,
      layout: {
        ...component.layout,
        colSpan: normalizeColSpan(component.type, component.layout?.colSpan ?? 12),
      },
    })),
    meta: {
      generatedBy: "genbi-workflow",
      createdAt: dashboard.meta?.createdAt ?? new Date().toISOString(),
      revision: dashboard.meta?.revision ?? 1,
      blueprintTitle: params.blueprint.title,
    },
  };
}
