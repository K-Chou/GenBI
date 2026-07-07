export type ColumnType = "string" | "number" | "date" | "boolean" | "unknown";

export type DatasetColumn = {
  name: string;
  type: ColumnType;
  sampleValues: string[];
};

export type DatasetMetadata = {
  id: string;
  name: string;
  fileName: string;
  sheetName: string;
  uploadedAt: string;
  rowCount: number;
  columns: DatasetColumn[];
  sampleRows: Record<string, string | number | boolean | null>[];
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
    chart: "kpi" | "line" | "bar" | "donut" | "table" | "insight";
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
  agent: "intent" | "data" | "planner" | "builder" | "review" | "artifact";
  label: string;
  status: "pending" | "running" | "done" | "error";
  summary: string;
  timestamp: string;
};

export type WorkflowRun = {
  id: string;
  intent?: IntentUnderstanding;
  dataUnderstanding?: DataUnderstanding;
  blueprint?: DashboardBlueprint;
  review?: ReviewResult;
  events: WorkflowEvent[];
  skill?: DashboardSkill | EffectiveDashboardSkill;
  preferenceMemory?: UserPreferenceMemory;
  skillOptimization?: SkillOptimization;
};

export type ArtifactManifest = {
  id: string;
  datasetId: string;
  datasetName: string;
  version: number;
  title: string;
  createdAt: string;
  userRequest: string;
  path: string;
  reviewScore?: number;
  approved?: boolean;
};

export type GenerationRequest = {
  datasetId: string;
  userRequest: string;
  theme?: "light" | "dark" | "system";
  promptSettings?: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
};

export type GenerationResult = {
  artifact: ArtifactManifest;
  workflow: WorkflowRun;
};
