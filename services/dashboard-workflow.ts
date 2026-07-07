import { runBuilderAgent } from "@/agents/builder-agent";
import { runDataAgent } from "@/agents/data-agent";
import { runIntentAgent } from "@/agents/intent-agent";
import { runPlannerAgent } from "@/agents/planner-agent";
import { runPreferenceAgent } from "@/agents/preference-agent";
import { runReviewAgent } from "@/agents/review-agent";
import { runSkillOptimizerAgent } from "@/agents/skill-optimizer-agent";
import { saveArtifact, updateArtifactWorkflow } from "@/lib/file-store";
import { createEffectiveSkill, selectDashboardSkill } from "@/skills";
import type {
  ChatMessage,
  DashboardBlueprint,
  DataUnderstanding,
  DatasetMetadata,
  GenerationResult,
  ImageAttachment,
  IntentUnderstanding,
  ReviewResult,
  WorkflowEvent,
  WorkflowRun,
} from "@/lib/types";

type WorkflowParams = {
  dataset: DatasetMetadata;
  userRequest: string;
  theme?: "light" | "dark" | "system";
  promptSettings?: string;
  history?: ChatMessage[];
  images?: ImageAttachment[];
  onEvent?: (event: WorkflowEvent, workflow: WorkflowRun) => void | Promise<void>;
};

function createEvent(
  workflowId: string,
  agent: WorkflowEvent["agent"],
  label: string,
  status: WorkflowEvent["status"],
  summary: string,
): WorkflowEvent {
  return {
    id: `${workflowId}-${agent}-${status}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agent,
    label,
    status,
    summary,
    timestamp: new Date().toISOString(),
  };
}

export async function runDashboardWorkflow(params: WorkflowParams): Promise<GenerationResult> {
  const workflow: WorkflowRun = {
    id: crypto.randomUUID(),
    events: [],
  };

  async function emit(
    agent: WorkflowEvent["agent"],
    label: string,
    status: WorkflowEvent["status"],
    summary: string,
  ) {
    const event = createEvent(workflow.id, agent, label, status, summary);
    workflow.events.push(event);
    await params.onEvent?.(event, workflow);
  }

  try {
    await emit("intent", "Intent Agent", "running", "正在理解用户目标、业务场景和受众。");
    const intent: IntentUnderstanding = await runIntentAgent({
      userRequest: params.userRequest,
      history: params.history,
      images: params.images,
    });
    workflow.intent = intent;
    await emit("intent", "Intent Agent", "done", `${intent.dashboardType} · ${intent.goals.join("、")}`);

    const skill = selectDashboardSkill(intent);
    await emit("planner", "Skill Selector", "done", `已匹配 ${skill.name}。`);

    const preferenceMemory = await runPreferenceAgent({
      userRequest: params.userRequest,
      history: params.history,
    });
    workflow.preferenceMemory = preferenceMemory;
    await emit("planner", "Preference Agent", "done", "已总结本次用户偏好并准备优化 Skill。");

    const skillOptimization = await runSkillOptimizerAgent({
      baseSkill: skill,
      preferenceMemory,
    });
    workflow.skillOptimization = skillOptimization;

    const effectiveSkill = createEffectiveSkill({
      baseSkill: skill,
      preferenceMemory,
      optimizations: skillOptimization,
    });
    workflow.skill = effectiveSkill;
    await emit("planner", "Skill Optimizer", "done", `已生成 ${effectiveSkill.name}。`);

    await emit("data", "Data Agent", "running", "正在分析 Dataset metadata、指标、维度和可用分析方式。");
    const dataUnderstanding: DataUnderstanding = await runDataAgent({
      dataset: params.dataset,
      intent,
    });
    workflow.dataUnderstanding = dataUnderstanding;
    await emit(
      "data",
      "Data Agent",
      "done",
      `${dataUnderstanding.metrics.length} 个指标，${dataUnderstanding.dimensions.length} 个维度。`,
    );

    await emit("planner", "Planner Agent", "running", "正在生成 Dashboard Blueprint 和信息层级。");
    const blueprint: DashboardBlueprint = await runPlannerAgent({
      dataset: params.dataset,
      intent,
      dataUnderstanding,
      skill: effectiveSkill,
      theme: params.theme,
      promptSettings: params.promptSettings,
    });
    workflow.blueprint = blueprint;
    await emit("planner", "Planner Agent", "done", `${blueprint.title} · ${blueprint.sections.length} 个模块。`);

    await emit("builder", "Builder Agent", "running", "正在根据 Blueprint 生成单文件 HTML Artifact。");
    const html = await runBuilderAgent({
      userRequest: params.userRequest,
      dataset: params.dataset,
      intent,
      dataUnderstanding,
      blueprint,
      skill: effectiveSkill,
      images: params.images,
    });
    await emit("builder", "Builder Agent", "done", "HTML Artifact 已生成，准备进入质量检查。");

    await emit("review", "Review Agent", "running", "正在检查 Data、BI、Design 和 Technical 质量。");
    const review: ReviewResult = await runReviewAgent({
      dataset: params.dataset,
      intent,
      dataUnderstanding,
      blueprint,
      html,
    });
    workflow.review = review;
    await emit("review", "Review Agent", "done", `Review score ${review.score} · ${review.summary}`);

    const updatedPreferenceMemory = await runPreferenceAgent({
      userRequest: params.userRequest,
      history: params.history,
      previousMemory: preferenceMemory,
      blueprint,
      review,
    });
    workflow.preferenceMemory = updatedPreferenceMemory;
    await emit("review", "Preference Agent", "done", "已根据 Blueprint 和 Review 更新偏好记忆。");

    await emit("artifact", "Artifact Store", "running", "正在保存 index.html、blueprint、review 和 workflow trace。");
    const artifact = await saveArtifact({
      dataset: params.dataset,
      html,
      userRequest: params.userRequest,
      blueprint,
      review,
      workflow,
    });
    await emit("artifact", "Artifact Store", "done", `Artifact V${artifact.version} 已保存。`);
    await updateArtifactWorkflow(artifact, workflow);

    return {
      artifact,
      workflow,
    };
  } catch (error) {
    await emit(
      "artifact",
      "Workflow",
      "error",
      error instanceof Error ? error.message : "Workflow 执行失败。",
    );
    throw error;
  }
}
