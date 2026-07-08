import { runBuilderAgent } from "@/agents/builder-agent";
import { runDesignerAgent } from "@/agents/designer-agent";
import { runImageAnalysisAgent } from "@/agents/image-analysis-agent";
import { runIntentAgent } from "@/agents/intent-agent";
import { runMetricContractAgent } from "@/agents/metric-contract-agent";
import { bindMetricSystemToContracts, runMetricSystemAgent } from "@/agents/metric-system-agent";
import { runPlannerAgent } from "@/agents/planner-agent";
import { runPreferenceAgent } from "@/agents/preference-agent";
import { runDashboardRepairAgent } from "@/agents/dashboard-repair-agent";
import { runReviewAgent } from "@/agents/review-agent";
import { runSkillOptimizerAgent } from "@/agents/skill-optimizer-agent";
import { selectDesignSkills } from "@/design-skills";
import { alignDashboardMetricsWithContracts, validateDashboardDocument } from "@/lib/dashboard-document-guard";
import { applyDashboardPatch } from "@/lib/dashboard-patch";
import { assertValidDesignSpecification, normalizeDesignSpecification } from "@/lib/design-spec-guard";
import {
  getUserPreferenceMemory,
  saveArtifact,
  updateArtifactDashboard,
  updateArtifactManifest,
  updateArtifactReview,
  updateArtifactWorkflow,
} from "@/lib/file-store";
import { applyChartRecommendations } from "@/services/chart-recommendation";
import { applyDashboardQualityGate } from "@/services/dashboard-quality-gate";
import { generateDashboardPresentationHtml, refreshArtifactHtmlPresentation } from "@/services/dashboard-html-presentation";
import { buildSemanticModel } from "@/services/semantic-model";
import { createEffectiveSkill, selectDashboardSkill } from "@/skills";
import type {
  ChatMessage,
  ArtifactManifest,
  DashboardBlueprint,
  DashboardDocument,
  DataUnderstanding,
  DatasetSelection,
  DatasetMetadata,
  DesignSpecification,
  DimensionContract,
  GenerationPlan,
  GenerationResult,
  ImageAttachment,
  IntentUnderstanding,
  MetricContract,
  MetricSystem,
  ReviewResult,
  SemanticModel,
  WorkflowEvent,
  WorkflowRun,
} from "@/lib/types";

type WorkflowTrace = NonNullable<WorkflowEvent["trace"]>;

type WorkflowParams = {
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  datasetSelection?: DatasetSelection;
  userRequest: string;
  userId?: string;
  theme?: "light" | "dark" | "system";
  promptSettings?: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
  plan?: GenerationPlan;
  resumeWorkflow?: WorkflowRun;
  onEvent?: (event: WorkflowEvent, workflow: WorkflowRun) => void | Promise<void>;
};

const MAX_DASHBOARD_REPAIR_ATTEMPTS = 3;

function sanitizeTraceValue(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, nestedValue) => {
      if (key === "dataUrl") {
        return "[image data omitted]";
      }

      if (key === "rows") {
        return Array.isArray(nestedValue) ? `[${nestedValue.length} rows omitted]` : "[rows omitted]";
      }

      if (key === "sampleRows" && Array.isArray(nestedValue)) {
        return nestedValue.slice(0, 3);
      }

      if (Array.isArray(nestedValue) && nestedValue.length > 20) {
        return nestedValue.slice(0, 20);
      }

      if (typeof nestedValue === "string" && nestedValue.length > 4000) {
        return `${nestedValue.slice(0, 4000)}... [truncated]`;
      }

      return nestedValue;
    }),
  );
}

function estimateTokenCount(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return Math.ceil(JSON.stringify(value).length / 4);
}

function hasSkippedLlmMarker(value: unknown): boolean | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if ("skippedLlm" in value && typeof (value as { skippedLlm?: unknown }).skippedLlm === "boolean") {
    return (value as { skippedLlm: boolean }).skippedLlm;
  }

  return undefined;
}

function createEvent(
  workflowId: string,
  agent: WorkflowEvent["agent"],
  label: string,
  status: WorkflowEvent["status"],
  summary: string,
  durationMs?: number,
  trace?: WorkflowTrace,
): WorkflowEvent {
  return {
    id: `${workflowId}-${agent}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agent,
    durationMs,
    label,
    status,
    summary,
    timestamp: new Date().toISOString(),
    trace: trace
      ? {
          checkpointKey: trace.checkpointKey,
          input: trace.input === undefined ? undefined : sanitizeTraceValue(trace.input),
          output: trace.output === undefined ? undefined : sanitizeTraceValue(trace.output),
          metrics: {
            inputTokenEstimate: estimateTokenCount(trace.input),
            outputTokenEstimate: estimateTokenCount(trace.output),
            skippedLlm: hasSkippedLlmMarker(trace.input),
          },
        }
      : undefined,
  };
}

function isPlanCompatible(plan: GenerationPlan | undefined, datasets: DatasetMetadata[], userRequest: string) {
  if (!plan || !plan.ready || plan.userRequest !== userRequest) {
    return false;
  }

  const selectedDatasetIds = new Set(datasets.map((dataset) => dataset.id));
  return plan.datasets.every((dataset) => selectedDatasetIds.has(dataset.id));
}

function hasExplicitQualityRequest(userRequest: string, promptSettings?: string) {
  return /最高质量|极致|高质量|全面优化|重新设计|换风格|dribbble|behance|参考图|视觉体系/i.test(
    `${userRequest}\n${promptSettings ?? ""}`,
  );
}

function shouldRunDesignerAgent(params: {
  userRequest: string;
  promptSettings?: string;
  imageAnalysis?: unknown;
  theme?: "light" | "dark" | "system";
}) {
  return Boolean(params.imageAnalysis) || params.theme === "dark" || hasExplicitQualityRequest(params.userRequest, params.promptSettings);
}

function createDefaultDesignSpecification(params: {
  designSkillIds: NonNullable<DesignSpecification["designSkillIds"]>;
  imageAnalysis?: unknown;
  theme?: "light" | "dark" | "system";
}): DesignSpecification {
  const isDark = params.theme === "dark";

  return {
    visualStyle: "apple_minimal",
    layoutPattern: "operational_monitoring",
    density: "balanced",
    designSkillIds: params.designSkillIds,
    colorPalette: isDark
      ? {
          background: "#0F172A",
          surface: "#111827",
          primary: "#818CF8",
          accent: "#22D3EE",
          success: "#34D399",
          warning: "#FBBF24",
          danger: "#FB7185",
          text: "#F8FAFC",
          muted: "#94A3B8",
        }
      : {
          background: "#F5F5F7",
          surface: "#FFFFFF",
          primary: "#4F46E5",
          accent: "#06B6D4",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#F43F5E",
          text: "#111827",
          muted: "#64748B",
        },
    typographyScale: {
      title: "32px",
      sectionTitle: "18px",
      body: "14px",
      caption: "12px",
      numeric: "40px",
    },
    cardStyle: {
      radius: 18,
      shadow: "soft",
      border: isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)",
      padding: 24,
    },
    chartStyle: {
      gridLine: "subtle",
      axis: "minimal",
      legend: "compact",
      tooltip: "soft",
      lineSmooth: true,
      barRadius: 10,
      donutThickness: "medium",
    },
    compositionRules: [
      "KPI 优先展示，后续按原因分析、责任定位、明细行动组织。",
      "12 栏响应式栅格，KPI 使用 3/4 栏，核心图表使用 6/8 栏。",
      "颜色只用于主指标、状态和风险编码，不做装饰性渐变。",
    ],
    referenceInfluence: params.imageAnalysis ? ["已根据参考图保留给 Builder 执行，不在默认规范中复制具体视觉。"] : [],
    qualityChecklist: [
      "KPI 是否位于顶部且标题业务化",
      "图表是否由真实指标契约和维度契约支撑",
      "Grid colSpan 是否稳定可维护",
      "移动端单列是否可读",
      "空数据和数据限制是否有说明",
    ],
  };
}

function createDataUnderstandingFromSemanticModel(semanticModel: SemanticModel): DataUnderstanding {
  return {
    availableAnalysis: [
      "可基于真实字段生成记录量、分类分布、状态拆解、负责人/团队对比和明细追踪。",
      "复杂比率类指标需要明确分子、分母和状态口径；无法支撑时以指标缺口说明呈现。",
    ],
    dataRisks: semanticModel.dataRisks,
    dateFields: semanticModel.datasets.flatMap((dataset) => dataset.dateFields),
    dimensions: semanticModel.dimensions.map((dimension) => ({
      meaning: `${dimension.label}，可用于${dimension.role === "time" ? "趋势" : dimension.role === "status" ? "状态拆解" : "分组"}分析。`,
      name: dimension.field,
      type: semanticModel.datasets
        .find((dataset) => dataset.id === dimension.datasetId)
        ?.fields.find((field) => field.name === dimension.field)?.type ?? "unknown",
    })),
    fields: semanticModel.datasets.flatMap((dataset) =>
      dataset.fields.map((field) => ({
        analysisHints: field.risks,
        businessMeaning:
          field.semanticRole === "metric"
            ? `可聚合业务字段：${field.name}`
            : field.semanticRole === "date"
              ? `时间字段：${field.name}`
              : `分组或筛选字段：${field.name}`,
        name: field.name,
        semanticRole: field.semanticRole,
        type: field.type,
      })),
    ),
    metrics: semanticModel.metrics.map((metric) => ({
      meaning: metric.businessDefinition,
      name: metric.field,
      type: "number",
    })),
  };
}

function shouldRunLlmReview(params: {
  dashboardComponentCount: number;
  dataRiskCount: number;
  imageAnalysis?: unknown;
  userRequest: string;
  promptSettings?: string;
}) {
  return (
    Boolean(params.imageAnalysis) ||
    params.dashboardComponentCount > 12 ||
    params.dataRiskCount > 0 ||
    hasExplicitQualityRequest(params.userRequest, params.promptSettings)
  );
}

function createDeterministicReviewSummary(): ReviewResult {
  return {
    score: 92,
    approved: true,
    issues: [],
    summary: "已通过确定性数据映射、指标契约和 DashboardDocument 协议校验，跳过 LLM Review。",
  };
}

async function runSavedArtifactQualityOptimization(params: {
  artifact: ArtifactManifest;
  blueprint: DashboardBlueprint;
  dashboard: DashboardDocument;
  dataUnderstanding: DataUnderstanding;
  datasets: DatasetMetadata[];
  designSpec: DesignSpecification;
  dimensionContracts: DimensionContract[];
  imageAnalysis?: unknown;
  intent: IntentUnderstanding;
  metricContracts: MetricContract[];
  metricSystem: MetricSystem;
  promptSettings?: string;
  semanticModel: SemanticModel;
  userRequest: string;
  workflow: WorkflowRun;
}) {
  try {
    const qualityGate = applyDashboardQualityGate({
      dashboard: params.dashboard,
      dataUnderstanding: params.dataUnderstanding,
      dimensionContracts: params.dimensionContracts,
      metricContracts: params.metricContracts,
      metricSystem: params.metricSystem,
    });
    params.workflow.events.push(
      createEvent(
        params.workflow.id,
        "review",
        "Deterministic Quality Gate",
        "done",
        `后台质量门禁 ${qualityGate.score} 分，已自动修正 ${qualityGate.corrections.length} 项。`,
        undefined,
        {
          checkpointKey: "deterministic_quality_gate_background",
          input: {
            artifactId: params.artifact.id,
            metricContracts: params.metricContracts,
            metricSystem: params.metricSystem,
          },
          output: qualityGate,
        },
      ),
    );

    const qualityGateIssues = validateDashboardDocument(qualityGate.dashboard, params.datasets, params.metricContracts);
    if (qualityGateIssues.length === 0) {
      await updateArtifactDashboard({
        artifactId: params.artifact.id,
        dashboard: qualityGate.dashboard,
      });
      const presentation = await refreshArtifactHtmlPresentation({
        artifact: params.artifact,
        dashboard: qualityGate.dashboard,
        datasets: params.datasets,
        userRequest: params.userRequest,
      });
      params.workflow.events.push(
        createEvent(
          params.workflow.id,
          "presentation",
          "HTML Presentation Agent",
          "done",
          presentation.source === "ai"
            ? "后台质量优化后已同步刷新 HTML 展示层。"
            : `后台质量优化后已使用保底 HTML 展示层：${presentation.issues.slice(0, 2).join("；")}`,
          undefined,
          {
            checkpointKey: "html_presentation_background",
            input: {
              artifactId: params.artifact.id,
              dashboard: qualityGate.dashboard,
            },
            output: {
              issues: presentation.issues,
              source: presentation.source,
            },
          },
        ),
      );
    }

    const runLlmReview = shouldRunLlmReview({
      dashboardComponentCount: qualityGate.dashboard.components.length,
      dataRiskCount: params.semanticModel.dataRisks.length,
      imageAnalysis: params.imageAnalysis,
      promptSettings: params.promptSettings,
      userRequest: params.userRequest,
    });
    const review = runLlmReview
      ? await runReviewAgent({
          dataset: params.datasets[0],
          datasets: params.datasets,
          intent: params.intent,
          dataUnderstanding: params.dataUnderstanding,
          dimensionContracts: params.dimensionContracts,
          metricContracts: params.metricContracts,
          semanticModel: params.semanticModel,
          metricSystem: params.metricSystem,
          blueprint: params.blueprint,
          designSpec: params.designSpec,
          dashboard: qualityGate.dashboard,
        })
      : createDeterministicReviewSummary();

    params.workflow.review = review;
    params.workflow.events.push(
      createEvent(
        params.workflow.id,
        "review",
        "Review Agent",
        "done",
        `后台 Review score ${review.score} · ${review.summary}`,
        undefined,
        {
          checkpointKey: runLlmReview ? "review_background" : "review_skipped_after_background_quality_gate",
          input: {
            artifactId: params.artifact.id,
            skippedLlm: !runLlmReview,
          },
          output: review,
        },
      ),
    );

    const manifest = {
      ...params.artifact,
      approved: review.approved,
      reviewScore: review.score,
    };
    await updateArtifactReview({
      artifactId: params.artifact.id,
      review,
    });
    await updateArtifactManifest(manifest);
    await updateArtifactWorkflow(manifest, params.workflow);
  } catch (error) {
    params.workflow.events.push(
      createEvent(
        params.workflow.id,
        "review",
        "Background Quality Optimization",
        "error",
        error instanceof Error ? error.message : "后台质检优化失败。",
        undefined,
        {
          checkpointKey: "background_quality_optimization_failed",
          input: {
            artifactId: params.artifact.id,
          },
          output: {
            ok: false,
          },
        },
      ),
    );
    await updateArtifactWorkflow(params.artifact, params.workflow);
  }
}

function createResumeCheckpointMap(workflow?: WorkflowRun) {
  return new Map(
    (workflow?.events ?? [])
      .filter((event) => event.status === "done" && event.trace?.checkpointKey && event.trace.output !== undefined)
      .map((event) => [event.trace?.checkpointKey ?? "", event.trace?.output] as const),
  );
}

export async function runDashboardWorkflow(params: WorkflowParams): Promise<GenerationResult> {
  const datasets = params.datasets?.length ? params.datasets : [params.dataset];
  const compatiblePlan = isPlanCompatible(params.plan, datasets, params.userRequest) ? params.plan : undefined;
  const resumeCheckpoints = createResumeCheckpointMap(params.resumeWorkflow);
  const stageStartTimes = new Map<string, number>();
  const workflow: WorkflowRun = {
    id: crypto.randomUUID(),
    datasetSelection: params.datasetSelection ?? compatiblePlan?.datasetSelection,
    events: params.resumeWorkflow?.events ?? [],
  };

  function getResumeOutput<T>(...checkpointKeys: string[]): T | undefined {
    for (const checkpointKey of checkpointKeys) {
      if (resumeCheckpoints.has(checkpointKey)) {
        return resumeCheckpoints.get(checkpointKey) as T;
      }
    }

    return undefined;
  }

  async function emit(
    agent: WorkflowEvent["agent"],
    label: string,
    status: WorkflowEvent["status"],
    summary: string,
    trace?: WorkflowTrace,
  ) {
    const stageKey = `${agent}:${label}`;
    let durationMs: number | undefined;

    if (status === "running") {
      stageStartTimes.set(stageKey, Date.now());
    } else {
      const startTime = stageStartTimes.get(stageKey);
      if (startTime) {
        durationMs = Date.now() - startTime;
        stageStartTimes.delete(stageKey);
      }
    }

    const event = createEvent(workflow.id, agent, label, status, summary, durationMs, trace);
    workflow.events.push(event);
    await params.onEvent?.(event, workflow);
  }

  async function validateAndRepairDashboard(params: {
    dashboard: DashboardDocument;
    rawDashboard?: DashboardDocument;
    datasets: DatasetMetadata[];
    dimensionContracts: DimensionContract[];
    metricContracts: MetricContract[];
    checkpointKey: string;
  }) {
    let currentDashboard = alignDashboardMetricsWithContracts(params.dashboard, params.metricContracts);
    const repairErrors: string[] = [];

    for (let attempt = 0; attempt <= MAX_DASHBOARD_REPAIR_ATTEMPTS; attempt += 1) {
      await emit(
        "review",
        "Deterministic Validator",
        "running",
        attempt === 0
          ? "正在校验字段引用、指标契约和真实 rows 聚合结果。"
          : `正在重新校验自动修复后的结果（第 ${attempt} 次）。`,
      );

      const issues = validateDashboardDocument(currentDashboard, params.datasets, params.metricContracts);

      if (issues.length === 0) {
        await emit(
          "review",
          "Deterministic Validator",
          "done",
          attempt === 0
            ? "数据映射、指标契约和视图执行预检已通过。"
            : `自动修复后已通过确定性校验，共修复 ${attempt} 轮。`,
          {
            checkpointKey: attempt === 0 ? params.checkpointKey : `${params.checkpointKey}_after_repair`,
            input: {
              datasets: params.datasets,
              metricContracts: params.metricContracts,
              rawDashboard: params.rawDashboard,
              repairedAttempts: attempt,
            },
            output: {
              ok: true,
              dashboard: currentDashboard,
            },
          },
        );

        return currentDashboard;
      }

      await emit(
        "review",
        "Deterministic Validator",
        "done",
        `发现 ${issues.length} 个可校验问题，准备自动修复。`,
        {
          checkpointKey: `${params.checkpointKey}_issues_${attempt + 1}`,
          input: {
            datasets: params.datasets,
            metricContracts: params.metricContracts,
            dashboard: currentDashboard,
          },
          output: {
            ok: false,
            issues,
          },
        },
      );

      if (attempt >= MAX_DASHBOARD_REPAIR_ATTEMPTS) {
        throw new Error(`仪表盘自动修复后仍未通过校验：${issues.slice(0, 6).join("；")}`);
      }

      await emit(
        "repair",
        "Artifact Repair Agent",
        "running",
        `发现 ${issues.length} 个结构或指标引用问题，正在自动修复第 ${attempt + 1} 次。`,
        {
          checkpointKey: `artifact_repair_${attempt + 1}_input`,
          input: {
            issues,
            previousRepairErrors: repairErrors,
            dashboard: currentDashboard,
            metricContracts: params.metricContracts,
            dimensionContracts: params.dimensionContracts,
          },
        },
      );

      const patchSet = await runDashboardRepairAgent({
        dashboard: currentDashboard,
        datasets: params.datasets,
        dimensionContracts: params.dimensionContracts,
        metricContracts: params.metricContracts,
        issues,
        previousRepairErrors: repairErrors,
      });

      try {
        if (patchSet.patches.length === 0) {
          throw new Error("Repair Agent 返回了空 patch。");
        }

        currentDashboard = alignDashboardMetricsWithContracts(
          applyDashboardPatch(currentDashboard, patchSet.patches),
          params.metricContracts,
        );

        await emit(
          "repair",
          "Artifact Repair Agent",
          "done",
          patchSet.summary || `已应用第 ${attempt + 1} 轮自动修复 patch。`,
          {
            checkpointKey: `artifact_repair_${attempt + 1}`,
            input: {
              issues,
              previousRepairErrors: repairErrors,
            },
            output: {
              patchSet,
              dashboard: currentDashboard,
            },
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "自动修复 patch 应用失败。";
        repairErrors.push(message);
        await emit(
          "repair",
          "Artifact Repair Agent",
          "done",
          `第 ${attempt + 1} 轮修复 patch 未能应用，继续尝试下一轮。`,
          {
            checkpointKey: `artifact_repair_${attempt + 1}_apply_failed`,
            input: {
              issues,
              patchSet,
            },
            output: {
              applied: false,
              error: message,
            },
          },
        );
      }
    }

    return currentDashboard;
  }

  try {
    if (resumeCheckpoints.size > 0) {
      await emit("artifact", "Workflow Resume", "done", `已恢复 ${resumeCheckpoints.size} 个已完成 checkpoint，将从缺失阶段继续。`, {
        checkpointKey: "workflow_resume",
        input: {
          checkpointKeys: Array.from(resumeCheckpoints.keys()),
          skippedLlm: true,
        },
        output: {
          resumed: true,
          checkpointCount: resumeCheckpoints.size,
        },
      });
    }

    const persistedPreferenceMemoryPromise = getUserPreferenceMemory(params.userId);
    const resumedSemanticModel = getResumeOutput<SemanticModel>("semantic_model");
    let semanticModel: SemanticModel;

    if (resumedSemanticModel) {
      semanticModel = resumedSemanticModel;
      await emit("data", "Semantic Model", "done", "已复用上次完成的语义模型。", {
        checkpointKey: "semantic_model_reused_from_resume",
        input: { skippedLlm: true },
        output: semanticModel,
      });
    } else {
      await emit("data", "Semantic Model", "running", "正在基于真实底表构建字段语义、可聚合性和数据风险。");
      semanticModel = buildSemanticModel(datasets);
    }
    workflow.semanticModel = semanticModel;
    if (!resumedSemanticModel) {
      await emit(
        "data",
        "Semantic Model",
        "done",
        `${semanticModel.datasets.length} 个语义数据集，${semanticModel.metrics.length} 个可计算指标候选。`,
        {
          checkpointKey: "semantic_model",
          input: { datasets },
          output: semanticModel,
        },
      );
    }

    const resumedImageAnalysis = getResumeOutput<typeof workflow.imageAnalysis>("image_analysis");
    const imageAnalysis =
      params.images && params.images.length > 0
        ? resumedImageAnalysis
          ? await (async () => {
              workflow.imageAnalysis = resumedImageAnalysis;
              await emit("image", "Image Analysis Agent", "done", "已复用上次完成的参考图分析。", {
                checkpointKey: "image_analysis_reused_from_resume",
                input: { skippedLlm: true },
                output: resumedImageAnalysis,
              });
              return resumedImageAnalysis;
            })()
          : await (async () => {
            await emit("image", "Image Analysis Agent", "running", "正在拆解案例图的布局、视觉风格和可复用设计规则。");
            const analysis = await runImageAnalysisAgent({
              userRequest: params.userRequest,
              images: params.images ?? [],
            });
            workflow.imageAnalysis = analysis;
            await emit("image", "Image Analysis Agent", "done", analysis.summary, {
              checkpointKey: "image_analysis",
              input: {
                images: params.images?.map((image) => ({ mimeType: image.mimeType, name: image.name })),
                userRequest: params.userRequest,
              },
              output: analysis,
            });
            return analysis;
          })()
        : undefined;

    let intent: IntentUnderstanding;

    const resumedIntent = getResumeOutput<IntentUnderstanding>("intent", "intent_reused_from_plan");

    if (resumedIntent) {
      intent = resumedIntent;
      await emit("intent", "Intent Agent", "done", `已复用上次完成的意图理解：${intent.dashboardType}。`, {
        checkpointKey: "intent_reused_from_resume",
        input: { skippedLlm: true },
        output: intent,
      });
    } else if (compatiblePlan?.intent) {
      intent = compatiblePlan.intent;
      await emit("intent", "Intent Agent", "done", `复用已生成计划：${intent.dashboardType}。`, {
        checkpointKey: "intent_reused_from_plan",
        input: { planId: compatiblePlan.id },
        output: intent,
      });
    } else {
      await emit("intent", "Intent Agent", "running", "正在理解用户目标、业务场景和受众。");
      intent = await runIntentAgent({
        userRequest: params.userRequest,
        history: params.history,
        imageAnalysis,
      });
    }
    workflow.intent = intent;
    if (!resumedIntent && !compatiblePlan?.intent) {
      await emit("intent", "Intent Agent", "done", `${intent.dashboardType} · ${intent.goals.join("、")}`, {
        checkpointKey: "intent",
        input: {
          history: params.history,
          imageAnalysis,
          userRequest: params.userRequest,
        },
        output: intent,
      });
    }

    const skill = selectDashboardSkill(intent);
    await emit("planner", "Skill Selector", "done", `已匹配 ${skill.name}。`, {
      checkpointKey: "skill_selector",
      input: { intent },
      output: skill,
    });

    const persistedPreferenceMemory = await persistedPreferenceMemoryPromise;
    const resumedPreferenceMemory = getResumeOutput<typeof workflow.preferenceMemory>("preference_initial", "preference_final");
    const preferenceMemory =
      resumedPreferenceMemory ??
      (await runPreferenceAgent({
        userRequest: params.userRequest,
        history: params.history,
        previousMemory: persistedPreferenceMemory ?? undefined,
      }));
    workflow.preferenceMemory = preferenceMemory;
    await emit("planner", "Preference Agent", "done", resumedPreferenceMemory ? "已复用上次完成的用户偏好总结。" : "已总结本次用户偏好并准备优化 Skill。", {
      checkpointKey: "preference_initial",
      input: {
        history: params.history,
        previousMemory: persistedPreferenceMemory,
        skippedLlm: Boolean(resumedPreferenceMemory),
        userRequest: params.userRequest,
      },
      output: preferenceMemory,
    });

    const resumedSkillOptimizer = getResumeOutput<{
      effectiveSkill: ReturnType<typeof createEffectiveSkill>;
      skillOptimization: WorkflowRun["skillOptimization"];
    }>("skill_optimizer");
    const skillOptimization =
      resumedSkillOptimizer?.skillOptimization ??
      (await runSkillOptimizerAgent({
        baseSkill: skill,
        preferenceMemory,
      }));
    workflow.skillOptimization = skillOptimization;

    const effectiveSkill =
      resumedSkillOptimizer?.effectiveSkill ??
      createEffectiveSkill({
        baseSkill: skill,
        preferenceMemory,
        optimizations: skillOptimization,
      });
    workflow.skill = effectiveSkill;
    await emit("planner", "Skill Optimizer", "done", resumedSkillOptimizer ? `已复用上次生成的 ${effectiveSkill.name}。` : `已生成 ${effectiveSkill.name}。`, {
      checkpointKey: "skill_optimizer",
      input: {
        baseSkill: skill,
        preferenceMemory,
        skippedLlm: Boolean(resumedSkillOptimizer),
      },
      output: {
        effectiveSkill,
        skillOptimization,
      },
    });

    let dataUnderstanding: DataUnderstanding;

    const resumedDataUnderstanding = getResumeOutput<DataUnderstanding>(
      "data_understanding",
      "data_understanding_reused_from_plan",
    );

    if (resumedDataUnderstanding) {
      dataUnderstanding = resumedDataUnderstanding;
      await emit("data", "Data Agent", "done", "已复用上次完成的数据理解结果。", {
        checkpointKey: "data_understanding_reused_from_resume",
        input: { skippedLlm: true },
        output: dataUnderstanding,
      });
    } else if (compatiblePlan?.dataUnderstanding) {
      dataUnderstanding = compatiblePlan.dataUnderstanding;
      await emit("data", "Data Agent", "done", "复用已生成计划中的数据理解结果。", {
        checkpointKey: "data_understanding_reused_from_plan",
        input: { planId: compatiblePlan.id },
        output: dataUnderstanding,
      });
    } else {
      dataUnderstanding = createDataUnderstandingFromSemanticModel(semanticModel);
      await emit("data", "Data Agent", "done", "已基于本地语义模型生成轻量数据理解，跳过 LLM 调用。", {
        checkpointKey: "data_understanding",
        input: {
          semanticModel,
          skippedLlm: true,
        },
        output: dataUnderstanding,
      });
    }
    workflow.dataUnderstanding = dataUnderstanding;

    const resumedExpertMetricSystem = getResumeOutput<MetricSystem>("metric_system_expert");
    let expertMetricSystem: MetricSystem;

    if (resumedExpertMetricSystem) {
      expertMetricSystem = resumedExpertMetricSystem;
      await emit("planner", "Metric System Agent", "done", "已复用上次完成的专家指标体系。", {
        checkpointKey: "metric_system_expert_reused_from_resume",
        input: { skippedLlm: true },
        output: expertMetricSystem,
      });
    } else {
      await emit("planner", "Metric System Agent", "running", "正在从专家视角构建北极星、一级、诊断和行动指标体系。");
      expertMetricSystem = await runMetricSystemAgent({
        dataUnderstanding,
        intent,
        semanticModel,
        userRequest: params.userRequest,
      });
    }
    workflow.metricSystem = expertMetricSystem;
    if (!resumedExpertMetricSystem) {
      await emit(
        "planner",
        "Metric System Agent",
        "done",
        `${expertMetricSystem.title} · 已形成专家指标树，下一步匹配真实数据口径。`,
        {
          checkpointKey: "metric_system_expert",
          input: {
            dataUnderstanding,
            intent,
            semanticModel,
            userRequest: params.userRequest,
          },
          output: expertMetricSystem,
        },
      );
    }

    let contractResult: Awaited<ReturnType<typeof runMetricContractAgent>>;
    const resumedContractResult = getResumeOutput<Awaited<ReturnType<typeof runMetricContractAgent>>>(
      "metric_contracts",
      "metric_contracts_reused_from_plan",
    );

    if (resumedContractResult) {
      contractResult = resumedContractResult;
      await emit(
        "planner",
        "Metric Contract Agent",
        "done",
        `已复用上次完成的 ${contractResult.metrics.length} 个指标契约、${contractResult.dimensions.length} 个维度契约。`,
        {
          checkpointKey: "metric_contracts_reused_from_resume",
          input: { skippedLlm: true },
          output: contractResult,
        },
      );
    } else if (compatiblePlan?.mode !== "feasibility" && compatiblePlan?.metrics.length) {
      contractResult = {
        metrics: compatiblePlan.metrics,
        dimensions: compatiblePlan.dimensions,
        rationale: compatiblePlan.rationale || "复用已生成计划中的指标和维度契约。",
      };
      await emit(
        "planner",
        "Metric Contract Agent",
        "done",
        `复用计划中的 ${contractResult.metrics.length} 个指标契约、${contractResult.dimensions.length} 个维度契约。`,
        {
          checkpointKey: "metric_contracts_reused_from_plan",
          input: { planId: compatiblePlan.id },
          output: contractResult,
        },
      );
    } else {
      await emit("planner", "Metric Contract Agent", "running", "正在基于专家指标体系选择可计算指标口径和维度契约。");
      contractResult = await runMetricContractAgent({
        dataUnderstanding,
        intent,
        metricSystem: expertMetricSystem,
        semanticModel,
        userRequest: params.userRequest,
      });
    }
    const metricContracts: MetricContract[] = contractResult.metrics;
    workflow.metricContracts = metricContracts;
    workflow.dimensionContracts = contractResult.dimensions;
    if (!resumedContractResult && (compatiblePlan?.mode === "feasibility" || !compatiblePlan?.metrics.length)) {
      await emit(
        "planner",
        "Metric Contract Agent",
        "done",
        `${metricContracts.length} 个指标契约，${contractResult.dimensions.length} 个维度契约。${contractResult.rationale}`,
        {
          checkpointKey: "metric_contracts",
          input: {
            dataUnderstanding,
            expertMetricSystem,
            intent,
            semanticModel,
            userRequest: params.userRequest,
          },
          output: contractResult,
        },
      );
    }

    const resumedMetricSystem = getResumeOutput<MetricSystem>("metric_system_binding");
    let metricSystem: MetricSystem;

    if (resumedMetricSystem) {
      metricSystem = resumedMetricSystem;
      await emit("planner", "Metric System Agent", "done", "已复用上次绑定到真实口径的指标体系。", {
        checkpointKey: "metric_system_binding_reused_from_resume",
        input: { skippedLlm: true },
        output: metricSystem,
      });
    } else {
      await emit("planner", "Metric System Agent", "running", "正在把专家指标体系绑定到真实可执行口径。");
      metricSystem = bindMetricSystemToContracts({
        dimensionContracts: contractResult.dimensions,
        metricContracts,
        metricSystem: expertMetricSystem,
      });
    }
    workflow.metricSystem = metricSystem;
    if (!resumedMetricSystem) {
      await emit(
        "planner",
        "Metric System Agent",
        "done",
        `${metricSystem.title} · ${metricSystem.primaryMetrics.length} 个一级指标，${metricSystem.diagnosticMetrics.length} 个诊断指标。`,
        {
          checkpointKey: "metric_system_binding",
          input: {
            dimensionContracts: contractResult.dimensions,
            expertMetricSystem,
            metricContracts,
          },
          output: metricSystem,
        },
      );
    }

    const resumedBlueprint = getResumeOutput<DashboardBlueprint>("blueprint");
    let blueprint: DashboardBlueprint;

    if (resumedBlueprint) {
      blueprint = resumedBlueprint;
      await emit("planner", "Planner Agent", "done", `已复用上次完成的 Blueprint：${blueprint.title}。`, {
        checkpointKey: "blueprint_reused_from_resume",
        input: { skippedLlm: true },
        output: blueprint,
      });
    } else {
      await emit("planner", "Planner Agent", "running", "正在生成 Dashboard Blueprint 和信息层级。");
      blueprint = await runPlannerAgent({
        dataset: params.dataset,
        datasets,
        intent,
        dataUnderstanding,
        metricSystem,
        dimensionContracts: contractResult.dimensions,
        metricContracts,
        skill: effectiveSkill,
        imageAnalysis,
        theme: params.theme,
        promptSettings: params.promptSettings,
      });
    }
    workflow.blueprint = blueprint;
    if (!resumedBlueprint) {
      await emit("planner", "Planner Agent", "done", `${blueprint.title} · ${blueprint.sections.length} 个模块。`, {
        checkpointKey: "blueprint",
        input: {
          dataUnderstanding,
          dimensionContracts: contractResult.dimensions,
          effectiveSkill,
          imageAnalysis,
          intent,
          metricContracts,
          metricSystem,
          promptSettings: params.promptSettings,
          theme: params.theme,
        },
        output: blueprint,
      });
    }

    const resumedDesignSkills = getResumeOutput<WorkflowRun["designSkills"]>("design_skill_library");
    const designSkills =
      resumedDesignSkills ??
      selectDesignSkills({
        intent,
        dashboardSkill: effectiveSkill,
        blueprint,
        preferenceMemory,
      });
    workflow.designSkills = designSkills;
    await emit("designer", "Design Skill Library", "done", resumedDesignSkills ? "已复用上次选择的设计范式库。" : `已选择 ${designSkills.map((item) => item.name).join(" + ")}。`, {
      checkpointKey: "design_skill_library",
      input: {
        blueprint,
        effectiveSkill,
        intent,
        preferenceMemory,
        skippedLlm: Boolean(resumedDesignSkills),
      },
      output: designSkills,
    });

    const runDesigner = shouldRunDesignerAgent({
      userRequest: params.userRequest,
      promptSettings: params.promptSettings,
      imageAnalysis,
      theme: params.theme,
    });
    let designSpec: DesignSpecification;
    const resumedDesignSpec = getResumeOutput<DesignSpecification>("design_spec", "design_spec_default");

    if (resumedDesignSpec) {
      designSpec = resumedDesignSpec;
      await emit("designer", "Designer Agent", "done", "已复用上次完成的 DesignSpecification。", {
        checkpointKey: "design_spec_reused_from_resume",
        input: { skippedLlm: true },
        output: designSpec,
      });
    } else if (runDesigner) {
      await emit("designer", "Designer Agent", "running", "正在把设计范式库、参考图和 Skill 转成可执行设计规范。");
      designSpec = await runDesignerAgent({
        intent,
        dataUnderstanding,
        skill: effectiveSkill,
        designSkills,
        blueprint,
        imageAnalysis,
        theme: params.theme,
      });
    } else {
      designSpec = createDefaultDesignSpecification({
        designSkillIds: designSkills.map((item) => item.id),
        imageAnalysis,
        theme: params.theme,
      });
    }
    designSpec = normalizeDesignSpecification(designSpec, designSkills);
    workflow.designSpec = designSpec;
    assertValidDesignSpecification(designSpec, designSkills);
    if (!resumedDesignSpec) {
      await emit(
        "designer",
        "Designer Agent",
        "done",
        runDesigner
          ? `${designSpec.visualStyle} · ${designSpec.layoutPattern} · ${designSpec.density}`
          : `已使用默认 DesignSpecification：${designSpec.visualStyle} · ${designSpec.layoutPattern}`,
        {
          checkpointKey: runDesigner ? "design_spec" : "design_spec_default",
          input: {
            blueprint,
            dataUnderstanding,
            designSkills,
            effectiveSkill,
            imageAnalysis,
            intent,
            skippedLlm: !runDesigner,
            theme: params.theme,
          },
          output: designSpec,
        },
      );
    }

    const resumedDashboard = getResumeOutput<GenerationResult["dashboard"]>("dashboard_document");
    let rawDashboard = resumedDashboard;
    let dashboard: NonNullable<GenerationResult["dashboard"]>;

    if (resumedDashboard) {
      dashboard = await validateAndRepairDashboard({
        dashboard: resumedDashboard,
        datasets,
        dimensionContracts: contractResult.dimensions,
        metricContracts,
        checkpointKey: "deterministic_validator_reused_from_resume",
      });
      await emit("builder", "Builder Agent", "done", "已复用上次完成的 DashboardDocument。", {
        checkpointKey: "dashboard_document_reused_from_resume",
        input: { skippedLlm: true },
        output: dashboard,
      });
    } else {
      await emit("builder", "Builder Agent", "running", "正在根据 Blueprint 和 DesignSpecification 生成仪表盘。");
      rawDashboard = await runBuilderAgent({
        userRequest: params.userRequest,
        dataset: params.dataset,
        datasets,
        intent,
        dataUnderstanding,
        dimensionContracts: contractResult.dimensions,
        metricContracts,
        semanticModel,
        metricSystem,
        blueprint,
        skill: effectiveSkill,
        designSpec,
        imageAnalysis,
      });
      dashboard = await validateAndRepairDashboard({
        dashboard: applyChartRecommendations({
          dashboard: rawDashboard,
          dataUnderstanding,
        }),
        rawDashboard,
        datasets,
        dimensionContracts: contractResult.dimensions,
        metricContracts,
        checkpointKey: "deterministic_validator",
      });
      await emit("builder", "Builder Agent", "done", "DashboardDocument 已生成并通过确定性数据校验。", {
        checkpointKey: "dashboard_document",
        input: {
          blueprint,
          dataUnderstanding,
          designSpec,
          dimensionContracts: contractResult.dimensions,
          effectiveSkill,
          imageAnalysis,
          intent,
          metricContracts,
          metricSystem,
          semanticModel,
          userRequest: params.userRequest,
        },
        output: dashboard,
      });
    }

    await emit("presentation", "HTML Presentation Agent", "running", "正在把已验证 DashboardDocument 转换成 Tailwind + ECharts 展示层。");
    const presentation = await generateDashboardPresentationHtml({
      dashboard,
      datasets,
      userRequest: params.userRequest,
    });
    await emit(
      "presentation",
      "HTML Presentation Agent",
      "done",
      presentation.source === "ai"
        ? "HTML 展示层已生成，最终预览将使用更高表现力的 Tailwind + ECharts 页面。"
        : `HTML 展示层已使用保底渲染生成：${presentation.issues.slice(0, 2).join("；")}`,
      {
        checkpointKey: "html_presentation",
        input: {
          dashboard,
          designSpec,
        },
        output: {
          issues: presentation.issues,
          source: presentation.source,
        },
      },
    );

    await emit("artifact", "初版预览存储", "running", "DashboardDocument 和 HTML 展示层已就绪，正在保存 Bundle Artifact。");
    const draftArtifact = await saveArtifact({
      dataset: params.dataset,
      datasets,
      dashboard,
      html: presentation.html,
      userRequest: params.userRequest,
      blueprint,
      metricSystem,
      designSpec,
      workflow,
    });
    await emit("artifact", "初版预览存储", "done", `Bundle Artifact V${draftArtifact.version} 已保存，后台继续质检优化。`, {
      checkpointKey: "artifact_draft_saved",
      input: {
        blueprint,
        dashboard,
        designSpec,
        metricSystem,
      },
      output: draftArtifact,
    });
    await updateArtifactWorkflow(draftArtifact, workflow);

    void runSavedArtifactQualityOptimization({
      artifact: draftArtifact,
      blueprint,
      dashboard,
      dataUnderstanding,
      datasets,
      designSpec,
      dimensionContracts: contractResult.dimensions,
      imageAnalysis,
      intent,
      metricContracts,
      metricSystem,
      promptSettings: params.promptSettings,
      semanticModel,
      userRequest: params.userRequest,
      workflow,
    });

    return {
      artifact: draftArtifact,
      dashboard,
      html: presentation.html,
      workflow,
    };
  } catch (error) {
    await emit(
      "artifact",
      "Workflow",
      "error",
      error instanceof Error ? error.message : "Workflow 执行失败。",
      {
        checkpointKey: "workflow_error",
        input: {
          datasetSelection: params.datasetSelection,
          userRequest: params.userRequest,
        },
        output: {
          error: error instanceof Error ? error.message : "Workflow 执行失败。",
          workflow,
        },
      },
    );
    throw error;
  }
}
