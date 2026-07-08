export type ColumnType = "string" | "number" | "date" | "boolean" | "unknown";

export type DatasetColumn = {
  name: string;
  type: ColumnType;
  sampleValues: string[];
};

export type DatasetSyncPolicy = {
  enabled: boolean;
  intervalSeconds?: number;
};

export type DatasetSource =
  | {
      type: "upload";
      originalFileName: string;
    }
  | {
      type: "feishu_bitable";
      sourceUrl: string;
      appToken: string;
      tableId: string;
      tableName?: string;
      viewId?: string;
      syncPolicy?: DatasetSyncPolicy;
      lastSyncedAt?: string;
      nextSyncAt?: string;
      lastSyncError?: string;
    };

export type DatasetMetadata = {
  id: string;
  name: string;
  fileName: string;
  sheetName: string;
  uploadedAt: string;
  updatedAt?: string;
  rowCount: number;
  columns: DatasetColumn[];
  source?: DatasetSource;
  rows?: Record<string, string | number | boolean | null>[];
  sampleRows: Record<string, string | number | boolean | null>[];
};

export type DatasetSelection = {
  datasetIds: string[];
  rationale: string;
  joinHints?: Array<{
    leftDatasetId: string;
    leftField: string;
    rightDatasetId: string;
    rightField: string;
    confidence: number;
    reason: string;
  }>;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ImageAttachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type ReferenceImageAnalysis = {
  summary: string;
  images: Array<{
    name: string;
    layoutPattern: string;
    visualStyle: string;
    colorPalette: string[];
    typography: string;
    componentPatterns: string[];
    chartPatterns: string[];
    spacing: string;
    interactionHints: string[];
    reusableDesignRules: string[];
  }>;
  designImplications: string[];
  constraints: string[];
};

export type IntentUnderstanding = {
  domain: string;
  audience: string;
  goals: string[];
  dashboardType: string;
  userRole: string;
  clarity: "low" | "medium" | "high";
  assumptions: string[];
};

export type DataUnderstanding = {
  fields: Array<{
    name: string;
    type: ColumnType;
    businessMeaning: string;
    semanticRole: "metric" | "dimension" | "date" | "unknown";
    analysisHints: string[];
  }>;
  metrics: Array<{
    name: string;
    meaning: string;
    type: ColumnType;
  }>;
  dimensions: Array<{
    name: string;
    meaning: string;
    type: ColumnType;
  }>;
  dateFields: string[];
  availableAnalysis: string[];
  dataRisks: string[];
};

export type DashboardSkill = {
  id: string;
  name: string;
  domains: string[];
  businessRules: string[];
  kpiRules: string[];
  chartRules: string[];
  layoutRules: string[];
  designRules: string[];
  promptExtension: string;
};

export type UserPreferenceMemory = {
  visualPreferences: string[];
  layoutPreferences: string[];
  chartPreferences: string[];
  businessPreferences: string[];
  negativePreferences: string[];
  updatedAt: string;
};

export type LlmStage =
  | "fast"
  | "intent"
  | "planning"
  | "presentation"
  | "builder"
  | "review"
  | "repair"
  | "vision"
  | "embedding";

export type LlmStageConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
};

export type PublicLlmStageConfig = Omit<LlmStageConfig, "apiKey"> & {
  hasApiKey?: boolean;
};

export type LlmRuntimeConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  stageConfigs?: Partial<Record<LlmStage, LlmStageConfig>>;
  stageModels?: Partial<Record<LlmStage, string>>;
};

export type PublicLlmRuntimeConfig = Omit<LlmRuntimeConfig, "apiKey" | "stageConfigs"> & {
  hasApiKey: boolean;
  stageConfigs?: Partial<Record<LlmStage, PublicLlmStageConfig>>;
  source: "settings" | "none";
};

export type SkillOptimization = {
  kpiRules: string[];
  chartRules: string[];
  layoutRules: string[];
  designRules: string[];
  businessRules: string[];
  rationale: string[];
  confidence: number;
};

export type EffectiveDashboardSkill = DashboardSkill & {
  baseSkillId: string;
  preferenceMemory?: UserPreferenceMemory;
  optimizations?: SkillOptimization;
};

export type DesignSkill = {
  id: "apple-design-language" | "linear-design" | "stripe-dashboard";
  name: string;
  bestFor: string[];
  visualPrinciples: string[];
  layoutRules: string[];
  colorRules: string[];
  typographyRules: string[];
  componentRules: string[];
  chartRules: string[];
  interactionRules: string[];
  dataRules: string[];
  stateRules: string[];
  avoidRules: string[];
  antiCopyRules: string[];
  tokenHints: {
    light: {
      background: string;
      surface: string;
      primary: string;
      accent: string;
      text: string;
      muted: string;
      border: string;
    };
    dark?: {
      background: string;
      surface: string;
      primary: string;
      accent: string;
      text: string;
      muted: string;
      border: string;
    };
    radius: number;
    shadow: "none" | "subtle" | "soft";
    density: "comfortable" | "balanced" | "dense";
  };
};

export type DashboardBlueprint = {
  title: string;
  dashboardType: string;
  audience: string;
  objectives: string[];
  kpis: Array<{
    label: string;
    field: string;
    rationale: string;
  }>;
  sections: Array<{
    name: string;
    purpose: string;
    chart:
      | "dashboard_title"
      | "section_title"
      | "kpi"
      | "kpi_group"
      | "line"
      | "bar"
      | "horizontal_bar"
      | "stacked_bar"
      | "horizontal_stacked_bar"
      | "donut"
      | "table"
      | "insight"
      | "empty_state";
    fields: string[];
    priority: number;
  }>;
  designPlan: {
    style: string;
    layout: string;
    theme: string;
    spacing: string;
    notes: string[];
  };
  skillId?: string;
};

export type DesignSpecification = {
  visualStyle: "apple_minimal" | "executive_premium" | "operational_command" | "analytical_editorial";
  layoutPattern: "executive_overview" | "kpi_hero_chart" | "overview_focus_detail" | "operational_monitoring";
  density: "comfortable" | "balanced" | "dense";
  designSkillIds?: DesignSkill["id"][];
  colorPalette: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    text: string;
    muted: string;
  };
  typographyScale: {
    title: string;
    sectionTitle: string;
    body: string;
    caption: string;
    numeric: string;
  };
  cardStyle: {
    radius: number;
    shadow: "none" | "subtle" | "soft";
    border: string;
    padding: number;
  };
  chartStyle: {
    gridLine: "none" | "subtle";
    axis: "minimal" | "standard";
    legend: "hidden" | "compact";
    tooltip: "soft";
    lineSmooth: boolean;
    barRadius: number;
    donutThickness: "thin" | "medium";
  };
  compositionRules: string[];
  referenceInfluence: string[];
  qualityChecklist?: string[];
};

export type DashboardComponentType =
  | "dashboard_title"
  | "section_title"
  | "kpi"
  | "kpi_group"
  | "line"
  | "bar"
  | "horizontal_bar"
  | "stacked_bar"
  | "horizontal_stacked_bar"
  | "donut"
  | "table"
  | "insight"
  | "empty_state";

export type DashboardDataSource = {
  id: string;
  kind: "inline" | "managed_dataset";
  label: string;
  binding?: {
    datasetId?: string;
    tableRef?: string;
  };
  freshness?: {
    mode: "static" | "scheduled";
    intervalMinutes?: number;
    lastSyncedAt?: string;
  };
};

export type DashboardMetricDefinition = {
  id: string;
  label: string;
  field?: string;
  op?: "sum" | "avg" | "count" | "min" | "max";
  expression?: string;
  format?: "number" | "currency_cny" | "percent";
  description?: string;
};

export type DashboardDataFilter = {
  field: string;
  op: "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte";
  value: string | number | boolean | null;
};

export type SemanticField = {
  datasetId: string;
  name: string;
  type: ColumnType;
  semanticRole: "metric" | "dimension" | "date" | "unknown";
  canAggregate: boolean;
  allowedOps: Array<"sum" | "avg" | "count" | "min" | "max">;
  sampleValues: Array<string | number | boolean | null>;
  uniqueValueCount: number;
  nonEmptyRate: number;
  dateRole?: "primary" | "created" | "updated" | "closed" | "due" | "unknown";
  enumValues?: Array<string | number | boolean | null>;
  risks: string[];
};

export type SemanticDataset = {
  id: string;
  name: string;
  rowCount: number;
  sourceType: DatasetSource["type"] | "unknown";
  fields: SemanticField[];
  metricFields: string[];
  dimensionFields: string[];
  dateFields: string[];
  risks: string[];
};

export type MetricContract = {
  id: string;
  label: string;
  datasetId: string;
  field: string;
  op: "sum" | "avg" | "count" | "min" | "max";
  as: string;
  format?: "number" | "currency_cny" | "percent";
  filters?: DashboardDataFilter[];
  businessDefinition: string;
  limitations: string[];
  source: "semantic" | "agent";
  confidence: number;
};

export type DimensionContract = {
  id: string;
  label: string;
  datasetId: string;
  field: string;
  role: "category" | "time" | "status" | "owner" | "geo" | "unknown";
  limitations: string[];
};

export type SemanticModel = {
  datasets: SemanticDataset[];
  metrics: MetricContract[];
  dimensions: DimensionContract[];
  dataRisks: string[];
  generatedAt: string;
};

export type MetricSystemNode = {
  id: string;
  name: string;
  level: "north_star" | "primary" | "diagnostic" | "action";
  category: "volume" | "efficiency" | "quality" | "conversion" | "risk" | "cost" | "satisfaction" | "other";
  businessQuestion: string;
  definition: string;
  formula?: string;
  contractRefs: string[];
  dimensionRefs: string[];
  priority: number;
  confidence: number;
  executable: boolean;
  limitations: string[];
  children?: MetricSystemNode[];
};

export type MetricSystem = {
  title: string;
  domain: string;
  northStarMetric?: MetricSystemNode;
  primaryMetrics: MetricSystemNode[];
  diagnosticMetrics: MetricSystemNode[];
  actionMetrics: MetricSystemNode[];
  recommendedDimensions: Array<{
    id: string;
    label: string;
    role: DimensionContract["role"];
    field: string;
    reason: string;
  }>;
  metricGaps: Array<{
    name: string;
    reason: string;
    requiredFields: string[];
    fallback: string;
  }>;
  narrative: string;
};

export type DashboardDataView = {
  id: string;
  dataSourceId: string;
  transform?: {
    filters?: DashboardDataFilter[];
    groupBy?: string[];
    metrics?: Array<{
      field: string;
      op: "sum" | "avg" | "count" | "min" | "max";
      as: string;
    }>;
    sort?: Array<{
      field: string;
      direction: "asc" | "desc";
    }>;
    limit?: number;
  };
};

export type DashboardRefreshPolicy = {
  mode: "auto" | "manual" | "scheduled" | "on_demand";
  intervalSeconds?: number;
  lastCalculatedAt?: string;
};

export type DashboardDetailView = {
  id: string;
  title: string;
  dataSourceId: string;
  columns: string[];
  baseViewId?: string;
  filters?: DashboardDataFilter[];
  limit?: number;
};

export type DashboardComponent = {
  id: string;
  type: DashboardComponentType;
  title: string;
  description?: string;
  layout: {
    colSpan: number;
    rowSpan?: number;
  };
  data?: {
    viewId: string;
    value?: {
      field: string;
      format?: "number" | "currency_cny" | "percent";
    };
    x?: {
      field: string;
      type?: "category" | "time";
    };
    series?: Array<{
      name: string;
      field: string;
      type?: "line" | "bar";
      area?: boolean;
      stack?: string;
    }>;
    columns?: string[];
  };
  refreshPolicy?: DashboardRefreshPolicy;
  interactions?: Array<{
    type: "drilldown";
    detailViewId: string;
    filterField?: string;
  }>;
  style?: {
    tone?: "default" | "primary" | "success" | "warning" | "danger";
  };
  insight?: string;
  echarts?: {
    smooth?: boolean;
    stack?: boolean;
    legend?: boolean;
    horizontal?: boolean;
  };
  chartRecommendation?: {
    selectedType: DashboardComponentType;
    reason: string;
    confidence: number;
  };
};

export type DashboardDocument = {
  schemaVersion: "1.0.0";
  id: string;
  title: string;
  description?: string;
  locale: "zh-CN";
  theme: {
    mode: "light" | "dark" | "system";
    style: "apple-minimal";
    radius: 16;
    spacing: 24;
    maxColors: 5;
  };
  layout: {
    type: "grid";
    columns: 12;
    gap: 24;
  };
  designSpec?: DesignSpecification;
  dataSources: DashboardDataSource[];
  metrics?: DashboardMetricDefinition[];
  refreshPolicy?: DashboardRefreshPolicy;
  views: DashboardDataView[];
  detailViews?: DashboardDetailView[];
  components: DashboardComponent[];
  insights?: Array<{
    id: string;
    text: string;
    severity: "info" | "warning" | "critical";
    sourceComponentId?: string;
  }>;
  meta: {
    generatedBy: "genbi-workflow";
    createdAt: string;
    revision?: number;
    updatedAt?: string;
    blueprintTitle?: string;
  };
};

export type JsonPatchOperation =
  | {
      op: "add" | "replace";
      path: string;
      value: unknown;
    }
  | {
      op: "remove";
      path: string;
    };

export type DashboardPatchSource = "ai" | "manual" | "system";

export type DashboardPatchSet = {
  baseDocumentId: string;
  baseRevision: number;
  source: DashboardPatchSource;
  intent: string;
  patches: JsonPatchOperation[];
  summary: string;
  createdAt: string;
};

export type ReviewResult = {
  score: number;
  approved: boolean;
  issues: Array<{
    category: "data" | "bi" | "design" | "technical";
    severity: "low" | "medium" | "high";
    message: string;
  }>;
  summary: string;
};

export type WorkflowEvent = {
  id: string;
  agent:
    | "intent"
    | "image"
    | "data"
    | "planner"
    | "designer"
    | "builder"
    | "presentation"
    | "repair"
    | "review"
    | "artifact";
  label: string;
  status: "pending" | "running" | "done" | "error";
  summary: string;
  timestamp: string;
  durationMs?: number;
  trace?: {
    checkpointKey?: string;
    input?: unknown;
    output?: unknown;
    metrics?: {
      inputTokenEstimate?: number;
      outputTokenEstimate?: number;
      skippedLlm?: boolean;
    };
  };
};

export type WorkflowRun = {
  id: string;
  datasetSelection?: DatasetSelection;
  imageAnalysis?: ReferenceImageAnalysis;
  intent?: IntentUnderstanding;
  semanticModel?: SemanticModel;
  metricContracts?: MetricContract[];
  dimensionContracts?: DimensionContract[];
  metricSystem?: MetricSystem;
  dataUnderstanding?: DataUnderstanding;
  blueprint?: DashboardBlueprint;
  designSpec?: DesignSpecification;
  designSkills?: DesignSkill[];
  review?: ReviewResult;
  events: WorkflowEvent[];
  skill?: DashboardSkill | EffectiveDashboardSkill;
  preferenceMemory?: UserPreferenceMemory;
  skillOptimization?: SkillOptimization;
};

export type ArtifactManifest = {
  id: string;
  datasetId: string;
  datasetIds?: string[];
  datasetName: string;
  version: number;
  artifactType?: "html" | "dashboard_json" | "dashboard_bundle";
  title: string;
  createdAt: string;
  lastCalculatedAt?: string;
  refreshPolicy?: DashboardRefreshPolicy;
  userRequest: string;
  path: string;
  reviewScore?: number;
  approved?: boolean;
};

export type GenerationRequest = {
  datasetId?: string;
  datasetIds?: string[];
  autoSelectDatasets?: boolean;
  plan?: GenerationPlan;
  resumeWorkflow?: WorkflowRun;
  userId?: string;
  userRequest: string;
  theme?: "light" | "dark" | "system";
  promptSettings?: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
};

export type GenerationPlan = {
  id: string;
  mode?: "feasibility" | "full";
  userRequest: string;
  ready: boolean;
  clarificationQuestion?: string;
  datasetSelection: DatasetSelection;
  datasets: Array<{
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
    sourceType: DatasetSource["type"] | "unknown";
  }>;
  metrics: MetricContract[];
  dimensions: DimensionContract[];
  intent?: IntentUnderstanding;
  dataUnderstanding?: DataUnderstanding;
  semanticModel?: SemanticModel;
  dataRisks: string[];
  rationale: string;
  createdAt: string;
};

export type GenerationResult = {
  artifact: ArtifactManifest;
  dashboard?: DashboardDocument;
  html?: string;
  workflow: WorkflowRun;
};
