"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ArtifactManifest,
  ChatMessage,
  GenerationPlan,
  GenerationResult,
  ImageAttachment,
  WorkflowEvent,
  WorkflowRun,
} from "@/lib/types";

const starterPrompts = [
  "生成一个经营驾驶舱，先帮我规划再生成。",
  "参考我上传的案例图片，做成 Apple Style。",
  "突出 KPI、趋势、分类对比和关键洞察。",
];

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const LEGACY_CHAT_SESSION_KEYS = ["artifactdash-chat-session-v2", "artifactdash-chat-session"];
const CHAT_SESSION_KEY = "genbi-chat-session-v2";
const DASHBOARD_SETTINGS_KEY = "dashboard-settings";
const LEGACY_USER_ID_KEY = "artifactdash-user-id";
const USER_ID_KEY = "genbi-user-id";
const INTERRUPTED_MESSAGE = "上次生成在中途断开，已保留请求和进度。你可以继续生成。";

type DashboardSettings = {
  theme: "light" | "dark" | "system";
  promptSettings: string;
};

type ChatSessionSnapshot = {
  messages: ChatMessage[];
  input: string;
  images: ImageAttachment[];
  isGenerating: boolean;
  isPlanning: boolean;
  pendingPlan: GenerationPlan | null;
  timeline: WorkflowEvent[];
  error: string;
  lastRequest: string;
  artifacts: ArtifactManifest[];
};

const defaultSettings: DashboardSettings = {
  theme: "system",
  promptSettings: "",
};

function readSettings() {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  return {
    ...defaultSettings,
    ...JSON.parse(localStorage.getItem(DASHBOARD_SETTINGS_KEY) ?? "{}"),
  } as DashboardSettings;
}

function compactWorkflowEventForStorage(event: WorkflowEvent): WorkflowEvent {
  return {
    ...event,
    trace: event.trace
      ? {
          checkpointKey: event.trace.checkpointKey,
          metrics: event.trace.metrics,
        }
      : undefined,
  };
}

function compactPlanForStorage(plan: GenerationPlan | null): GenerationPlan | null {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    dataUnderstanding: undefined,
    dimensions: plan.dimensions.slice(0, 20),
    intent: undefined,
    metrics: plan.metrics.slice(0, 20),
    semanticModel: undefined,
  };
}

function compactPlanForRequest(plan?: GenerationPlan): GenerationPlan | undefined {
  if (!plan) {
    return undefined;
  }

  return {
    ...plan,
    dataUnderstanding: undefined,
    semanticModel: undefined,
  };
}

function compactWorkflowEventForRequest(event: WorkflowEvent): WorkflowEvent {
  return {
    ...event,
    trace: event.trace
      ? {
          checkpointKey: event.trace.checkpointKey,
          output: event.trace.output,
        }
      : undefined,
  };
}

function compactResumeWorkflowForRequest(workflow?: WorkflowRun): WorkflowRun | undefined {
  if (!workflow) {
    return undefined;
  }

  const reusableCheckpointKeys = new Set([
    "intent",
    "semantic_model",
    "data_understanding",
    "data_understanding_reused_from_plan",
    "metric_system_expert",
    "metric_contracts",
    "metric_system_binding",
    "blueprint",
    "design_spec",
    "design_spec_default",
    "dashboard_document",
    "review",
    "review_skipped_after_deterministic_validation",
  ]);
  const events = workflow.events
    .filter((event) => event.status === "done" && event.trace?.checkpointKey && reusableCheckpointKeys.has(event.trace.checkpointKey))
    .map(compactWorkflowEventForRequest);

  return events.length > 0
    ? {
        datasetSelection: workflow.datasetSelection,
        events,
        id: workflow.id,
      }
    : undefined;
}

function compactChatSessionForStorage(snapshot: ChatSessionSnapshot, options: { includeImages?: boolean } = {}): ChatSessionSnapshot {
  return {
    ...snapshot,
    images: options.includeImages ? snapshot.images.slice(0, MAX_IMAGES) : [],
    messages: snapshot.messages.slice(-20).map((message) => ({
      ...message,
      content: message.content.length > 2000 ? `${message.content.slice(0, 2000)}...` : message.content,
    })),
    pendingPlan: compactPlanForStorage(snapshot.pendingPlan),
    timeline: snapshot.timeline.slice(-80).map(compactWorkflowEventForStorage),
  };
}

function writeChatSession(snapshot: ChatSessionSnapshot) {
  try {
    localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(compactChatSessionForStorage(snapshot, { includeImages: true })));
    window.dispatchEvent(new Event("genbi-chat-session-updated"));
  } catch (error) {
    try {
      localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(compactChatSessionForStorage(snapshot)));
      window.dispatchEvent(new Event("genbi-chat-session-updated"));
    } catch (fallbackError) {
      console.warn("[chat] failed to persist session, clearing local cache", error, fallbackError);
      localStorage.removeItem(CHAT_SESSION_KEY);
    }
  }
}

function getOrCreateUserId() {
  const existing = localStorage.getItem(USER_ID_KEY) ?? localStorage.getItem(LEGACY_USER_ID_KEY);
  if (existing) {
    localStorage.setItem(USER_ID_KEY, existing);
    return existing;
  }

  const next = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, next);
  return next;
}

function getErrorGuidance(error: string) {
  if (error === INTERRUPTED_MESSAGE) {
    return {
      title: "可以继续生成",
      description: "上一次生成没有完成，但请求、图片、历史和时间线已经保留。",
      action: "点击“继续生成”会基于同一需求重新进入生成链路，不会重复追加一条用户消息。",
    };
  }

  if (/找不到相关数据|还没有可用底表数据/i.test(error)) {
    return {
      title: "找不到相关数据",
      description: "当前底表无法支撑这个分析目标。可以换成数量/分布类分析，或到底表数据页补充相关字段。",
      action: "建议上传包含金额、时间、状态、负责人等字段的底表后再试。",
    };
  }

  if (/数据映射校验失败|指标契约|非数字字段/i.test(error)) {
    return {
      title: "数据口径没有通过校验",
      description: "系统已阻止保存可能不真实的看板，通常是字段不匹配、文本字段被当作数字聚合，或视图没有返回真实数据。",
      action: "可以调整需求为更明确的数量、分布、趋势，或检查底表字段类型。",
    };
  }

  if (/LLM|fetch failed|网络请求失败|timeout|超时/i.test(error)) {
    return {
      title: "模型服务暂时不可用",
      description: "数据集和当前输入已保留。通常是模型网关、网络连通性或模型响应超时导致，不是你的操作问题。",
      action: "稍后可以直接点“重试生成”，或到设置页确认服务端 LLM 配置。",
    };
  }

  return {
    title: "生成被中断",
    description: "当前流程没有完成仪表盘保存，请根据错误信息调整输入后重试。",
    action: "如果多次出现，可以先减少生成要求或移除过大的参考图片。",
  };
}

const friendlyStage: Record<WorkflowEvent["agent"], string> = {
  intent: "正在理解你的业务目标",
  image: "正在拆解案例图",
  data: "正在分析底表数据结构",
  planner: "正在规划 Dashboard 方案",
  designer: "正在生成视觉设计规范",
  builder: "正在生成仪表盘",
  presentation: "正在生成 HTML 展示层",
  repair: "正在自动修复生成问题",
  review: "正在质量检查",
  artifact: "正在保存并刷新预览",
};

function getFriendlyEvent(event: WorkflowEvent) {
  if (event.label === "Semantic Model") {
    return {
      title: "正在构建语义模型",
      summary: event.summary,
    };
  }

  if (event.label === "Metric Contract Agent") {
    return {
      title: "正在确认指标口径",
      summary: event.summary,
    };
  }

  if (event.label === "Deterministic Validator") {
    return {
      title: "正在校验真实数据映射",
      summary: event.summary,
    };
  }

  if (event.label === "Skill Selector") {
    return {
      title: "正在匹配 BI 经验",
      summary: event.summary.replace("已匹配", "匹配到"),
    };
  }

  if (event.label === "Preference Agent") {
    return {
      title: "正在学习你的偏好",
      summary: event.summary,
    };
  }

  if (event.label === "Skill Optimizer") {
    return {
      title: "正在优化生成约束",
      summary: event.summary,
    };
  }

  return {
    title: friendlyStage[event.agent],
    summary: event.summary,
  };
}

function formatDuration(durationMs?: number) {
  if (!durationMs) {
    return "";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${(durationMs / 60_000).toFixed(1)}min`;
}

function readImageAsDataUrl(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}

function getLatestUserRequest(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function formatTraceValue(value: unknown) {
  if (value === undefined) {
    return "暂无";
  }

  return JSON.stringify(value, null, 2);
}

export function ChatPanel({
  onArtifact,
}: {
  onArtifact: (artifact: ArtifactManifest) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("生成一个销售 Dashboard。");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<GenerationPlan | null>(null);
  const [confirmedPlanId, setConfirmedPlanId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<WorkflowEvent[]>([]);
  const [lastRequest, setLastRequest] = useState("");
  const [generatedArtifacts, setGeneratedArtifacts] = useState<ArtifactManifest[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [settings, setSettings] = useState<DashboardSettings>(defaultSettings);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [selectedTraceEvent, setSelectedTraceEvent] = useState<WorkflowEvent | null>(null);
  const recoverableRequest = lastRequest || getLatestUserRequest(messages) || input;
  const visibleTimeline = useMemo(() => {
    const eventsByStage = new Map<string, WorkflowEvent>();

    timeline.forEach((event) => {
      const stageKey = `${event.agent}:${event.label}`;
      eventsByStage.set(stageKey, event);
    });

    return Array.from(eventsByStage.values());
  }, [timeline]);

  useEffect(() => {
    const storedSession =
      localStorage.getItem(CHAT_SESSION_KEY) ??
      LEGACY_CHAT_SESSION_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);

    if (storedSession) {
      try {
        const snapshot = JSON.parse(storedSession) as Partial<ChatSessionSnapshot>;
        setMessages(snapshot.messages ?? []);
        setInput(snapshot.input ?? "");
        setImages(snapshot.images ?? []);
        setTimeline(snapshot.timeline ?? []);
        setPendingPlan(snapshot.pendingPlan ?? null);
        setError(snapshot.isGenerating || snapshot.isPlanning ? INTERRUPTED_MESSAGE : snapshot.error ?? "");
        setLastRequest(snapshot.lastRequest ?? "");
        setGeneratedArtifacts(snapshot.artifacts ?? []);
        setIsGenerating(false);
        setIsPlanning(false);

        if (snapshot.artifacts?.[0]) {
          onArtifact(snapshot.artifacts[0]);
        }
        localStorage.setItem(CHAT_SESSION_KEY, storedSession);
      } catch {
        localStorage.removeItem(CHAT_SESSION_KEY);
      }
    }

    setSettings(readSettings());
    setHasRestoredSession(true);
  }, [onArtifact]);

  useEffect(() => {
    if (!hasRestoredSession) {
      return;
    }

    writeChatSession({
      artifacts: generatedArtifacts,
      error,
      images,
      input,
      isGenerating,
      isPlanning,
      lastRequest,
      messages,
      pendingPlan,
      timeline,
    });
  }, [error, generatedArtifacts, hasRestoredSession, images, input, isGenerating, isPlanning, lastRequest, messages, pendingPlan, timeline]);

  async function generate(
    request: string,
    options: { appendUserMessage?: boolean; datasetIds?: string[]; plan?: GenerationPlan; resumeWorkflow?: WorkflowRun } = {},
  ) {
    if (!request.trim() && images.length === 0) {
      return;
    }

    setIsGenerating(true);
    setError("");
    if (!options.resumeWorkflow) {
      setTimeline([]);
    }
    setLastRequest(request);
    if (!options.plan) {
      setPendingPlan(null);
      setConfirmedPlanId(null);
    }

    const shouldAppendUserMessage = options.appendUserMessage ?? true;
    const nextMessages: ChatMessage[] = shouldAppendUserMessage
      ? [...messages, { role: "user", content: request }]
      : messages;
    if (shouldAppendUserMessage) {
      setMessages(nextMessages);
      setInput("");
    }

    const timelineBuffer: WorkflowEvent[] = options.resumeWorkflow?.events ? [...options.resumeWorkflow.events] : [];

    try {
      const generationSettings = readSettings();
      const requestPlan = compactPlanForRequest(options.plan);
      const requestResumeWorkflow = compactResumeWorkflowForRequest(options.resumeWorkflow);
      const requestImages = options.plan || requestResumeWorkflow ? [] : images;

      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          autoSelectDatasets: !options.datasetIds?.length,
          datasetIds: options.datasetIds,
          plan: requestPlan,
          resumeWorkflow: requestResumeWorkflow,
          userId: getOrCreateUserId(),
          userRequest: request,
          history: messages,
          theme: generationSettings.theme ?? "system",
          promptSettings: generationSettings.promptSettings ?? "",
          images: requestImages,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let payload: { error?: string } | null = null;

        try {
          payload = text ? (JSON.parse(text) as { error?: string }) : null;
        } catch {
          payload = null;
        }

        throw new Error(payload?.error ?? (text || "生成失败。"));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取 Workflow 进度。");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const resultRef: { current: GenerationResult | null } = { current: null };

      function handleSseBlock(block: string) {
        const event = block
          .split("\n")
          .find((line) => line.startsWith("event: "))
          ?.replace("event: ", "")
          .trim();
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.replace("data: ", ""))
          .join("\n");

        if (!event || !data) {
          return;
        }

        const payload = JSON.parse(data) as
          | { workflowEvent: WorkflowEvent }
          | GenerationResult
          | { error: string };

        if (event === "workflow-event" && "workflowEvent" in payload) {
          timelineBuffer.push(payload.workflowEvent);
          writeChatSession({
            artifacts: generatedArtifacts,
            error: "",
            images,
            input: "",
            isGenerating: true,
            isPlanning: false,
            lastRequest: request,
            messages: nextMessages,
            pendingPlan: options.plan ?? pendingPlan,
            timeline: timelineBuffer,
          });
          setTimeline((current) => [...current, payload.workflowEvent]);
        }

        if (event === "complete" && "artifact" in payload) {
          resultRef.current = payload;
        }

        if (event === "error" && "error" in payload) {
          throw new Error(payload.error);
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        blocks.forEach(handleSseBlock);

        if (done) {
          if (buffer.trim()) {
            handleSseBlock(buffer);
          }
          break;
        }
      }

      if (!resultRef.current) {
        throw new Error("Workflow 没有返回仪表盘。");
      }

      const result = resultRef.current;
      const nextArtifacts = [result.artifact, ...generatedArtifacts.filter((item) => item.id !== result.artifact.id)].slice(0, 8);
      const finalMessages: ChatMessage[] = [
        ...nextMessages,
        {
          role: "assistant",
          content: `已生成 ${result.artifact.title}。`,
        },
      ];
      onArtifact(result.artifact);
      setGeneratedArtifacts(nextArtifacts);
      setMessages(finalMessages);
      writeChatSession({
        artifacts: nextArtifacts,
        error: "",
        images,
        input,
        isGenerating: false,
        isPlanning: false,
        lastRequest: request,
        messages: finalMessages,
        pendingPlan: options.plan ?? pendingPlan,
        timeline: timelineBuffer,
      });
    } catch (generationError) {
      const nextError = generationError instanceof Error ? generationError.message : "生成失败。";
      setError(nextError);
      writeChatSession({
        artifacts: generatedArtifacts,
        error: nextError,
        images,
        input,
        isGenerating: false,
        isPlanning: false,
        lastRequest: request,
        messages: nextMessages,
        pendingPlan: options.plan ?? pendingPlan,
        timeline: timelineBuffer,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function createGenerationPlan(request: string) {
    if (!request.trim() && images.length === 0) {
      return;
    }

    setIsPlanning(true);
    setError("");
    setTimeline([]);
    setPendingPlan(null);
    setConfirmedPlanId(null);
    setLastRequest(request);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: request }];
    setMessages(nextMessages);
    setInput("");
    writeChatSession({
      artifacts: generatedArtifacts,
      error: "",
      images,
      input: "",
      isGenerating: false,
      isPlanning: true,
      lastRequest: request,
      messages: nextMessages,
      pendingPlan: null,
      timeline: [],
    });

    const timelineBuffer: WorkflowEvent[] = [];

    try {
      const response = await fetch("/api/generate/plan/stream", {
        body: JSON.stringify({
          autoSelectDatasets: true,
          history: messages,
          images,
          userRequest: request,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "数据预检失败。");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法读取规划进度。");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const planRef: { current: GenerationPlan | null } = { current: null };

      function handleSseBlock(block: string) {
        const event = block
          .split("\n")
          .find((line) => line.startsWith("event: "))
          ?.replace("event: ", "")
          .trim();
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.replace("data: ", ""))
          .join("\n");

        if (!event || !data) {
          return;
        }

        const payload = JSON.parse(data) as { workflowEvent: WorkflowEvent } | { plan: GenerationPlan } | { error: string };

        if (event === "workflow-event" && "workflowEvent" in payload) {
          timelineBuffer.push(payload.workflowEvent);
          setTimeline((current) => [...current, payload.workflowEvent]);
          writeChatSession({
            artifacts: generatedArtifacts,
            error: "",
            images,
            input: "",
            isGenerating: false,
            isPlanning: true,
            lastRequest: request,
            messages: nextMessages,
            pendingPlan: null,
            timeline: timelineBuffer,
          });
        }

        if (event === "complete" && "plan" in payload) {
          planRef.current = payload.plan;
        }

        if (event === "error" && "error" in payload) {
          throw new Error(payload.error);
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        blocks.forEach(handleSseBlock);

        if (done) {
          if (buffer.trim()) {
            handleSseBlock(buffer);
          }
          break;
        }
      }

      if (!planRef.current) {
        throw new Error("规划没有返回结果。");
      }

      const plan = planRef.current;
      setPendingPlan(plan);
      const plannedMessages: ChatMessage[] = [
        ...nextMessages,
        {
          role: "assistant",
          content: plan.clarificationQuestion
            ? `我先确认一个关键问题：${plan.clarificationQuestion}`
            : "我已完成数据可行性预检，请确认后生成仪表盘。",
        },
      ];
      setMessages(plannedMessages);
      writeChatSession({
        artifacts: generatedArtifacts,
        error: "",
        images,
        input: "",
        isGenerating: false,
        isPlanning: false,
        lastRequest: request,
        messages: plannedMessages,
        pendingPlan: plan,
        timeline: timelineBuffer,
      });
    } catch (planError) {
      const nextError = planError instanceof Error ? planError.message : "数据预检失败。";
      setError(nextError);
      writeChatSession({
        artifacts: generatedArtifacts,
        error: nextError,
        images,
        input: "",
        isGenerating: false,
        isPlanning: false,
        lastRequest: request,
        messages: nextMessages,
        pendingPlan: null,
        timeline: timelineBuffer,
      });
    } finally {
      setIsPlanning(false);
    }
  }

  function confirmGenerationPlan() {
    if (!pendingPlan) {
      return;
    }

    setConfirmedPlanId(pendingPlan.id);
    void generate(pendingPlan.userRequest, {
      appendUserMessage: false,
      datasetIds: pendingPlan.datasetSelection.datasetIds,
      plan: pendingPlan,
      resumeWorkflow: createResumeWorkflow(),
    });
  }

  function createResumeWorkflow(): WorkflowRun | undefined {
    const resumableEvents = timeline.filter((event) => event.status === "done" && event.trace?.checkpointKey);

    if (resumableEvents.length === 0) {
      return undefined;
    }

    return {
      id: crypto.randomUUID(),
      datasetSelection: pendingPlan?.datasetSelection,
      events: resumableEvents,
    };
  }

  async function copyTraceValue(value: unknown) {
    await navigator.clipboard.writeText(formatTraceValue(value));
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const remainingSlots = MAX_IMAGES - images.length;
    const selectedFiles = files.slice(0, remainingSlots);

    if (remainingSlots <= 0) {
      setError(`最多只能上传 ${MAX_IMAGES} 张图片。`);
      return;
    }

    const invalidFile = selectedFiles.find(
      (file) => !file.type.startsWith("image/") || file.size > MAX_IMAGE_SIZE,
    );

    if (invalidFile) {
      setError("仅支持单张 4MB 以内的图片。");
      return;
    }

    try {
      const nextImages = await Promise.all(selectedFiles.map(readImageAsDataUrl));
      setImages((current) => [...current, ...nextImages]);
      setError("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "图片上传失败。");
    }
  }

  return (
    <div className="apple-card relative z-30 flex h-full min-h-0 flex-col overflow-visible p-4">
      <div className="border-b border-black/5 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">AI BI Consultant</p>
            <p className="mt-1 text-xs text-muted">
              只需要描述目标，AI 会自动从已上传和已同步的底表数据中选择相关表组合生成仪表盘。
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                aria-label={`使用模板：${prompt}`}
                className="w-full rounded-2xl border border-black/5 bg-white/50 px-4 py-3 text-left text-sm leading-6 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                disabled={isGenerating || isPlanning}
                onClick={() => createGenerationPlan(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[86%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-br-md bg-black text-white"
                    : "rounded-bl-md border border-black/5 bg-white/70 text-current"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {timeline.length > 0 ? (
          <div className="rounded-2xl border border-black/5 bg-white/45 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">实时生成进度</p>
              <span className="whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-xs text-muted">
                {isGenerating ? "生成中" : error ? "已中断" : "已完成"}
              </span>
            </div>
            <div className="space-y-3">
              {visibleTimeline.map((item) => {
                const friendlyEvent = getFriendlyEvent(item);
                const Icon =
                  item.status === "done"
                    ? CheckCircle2
                    : item.status === "running"
                      ? Loader2
                      : item.status === "error"
                        ? AlertCircle
                        : Circle;

                return (
                  <div
                    key={item.id}
                    className="flex cursor-pointer gap-3 rounded-2xl p-2 transition hover:bg-white/70"
                    onClick={() => {
                      setSelectedTraceEvent(item);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTraceEvent(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="查看该节点的输入/输出"
                  >
                    <Icon
                      className={`mt-0.5 shrink-0 ${
                        item.status === "running" ? "animate-spin" : ""
                      } ${
                        item.status === "error"
                          ? "text-red-500"
                          : item.status === "done"
                            ? "text-emerald-600"
                            : "text-muted"
                      }`}
                      size={16}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{friendlyEvent.title}</p>
                        {item.durationMs ? (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
                            {formatDuration(item.durationMs)}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
                          查看输入/输出
                        </span>
                      </div>
                      <p className="break-words text-xs text-muted">{friendlyEvent.summary}</p>
                      {pendingPlan && item.trace?.checkpointKey === "plan_feasibility" ? (
                        <div
                          className="mt-3 rounded-3xl border border-black/5 bg-white/70 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">数据可行性预检结果</p>
                              <p className="mt-1 text-xs leading-5 text-muted">{pendingPlan.rationale}</p>
                            </div>
                            <span className="no-wrap-control rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700">
                              真实数据
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <div className="rounded-2xl bg-black/[0.025] p-3">
                              <p className="text-xs font-medium text-muted">选中的底表</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {pendingPlan.datasets.map((dataset) => (
                                  <span key={dataset.id} className="rounded-full bg-white px-3 py-1 text-xs">
                                    {dataset.name} · {dataset.rowCount} 行 · {dataset.columnCount} 列
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-black/[0.025] p-3">
                              <p className="text-xs font-medium text-muted">可用指标候选</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {pendingPlan.metrics.slice(0, 5).map((metric) => (
                                  <span key={metric.id} className="rounded-full bg-white px-3 py-1 text-xs">
                                    {metric.label} · {metric.op}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-black/[0.025] p-3">
                              <p className="text-xs font-medium text-muted">可用维度候选</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {pendingPlan.dimensions.slice(0, 6).map((dimension) => (
                                  <span key={dimension.id} className="rounded-full bg-white px-3 py-1 text-xs">
                                    {dimension.label}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {pendingPlan.dataRisks.length > 0 || pendingPlan.clarificationQuestion ? (
                              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800">
                                {pendingPlan.clarificationQuestion ? <p>{pendingPlan.clarificationQuestion}</p> : null}
                                {pendingPlan.dataRisks.slice(0, 2).map((risk) => (
                                  <p key={risk}>{risk}</p>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {confirmedPlanId !== pendingPlan.id ? (
                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                              <button
                                className="no-wrap-control rounded-full border border-black/10 bg-white px-4 py-2 text-sm"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPendingPlan(null);
                                  setConfirmedPlanId(null);
                                  setInput(pendingPlan.userRequest);
                                }}
                              >
                                调整计划
                              </button>
                              <button
                                className="no-wrap-control rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                                disabled={!pendingPlan.ready || isGenerating}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  confirmGenerationPlan();
                                }}
                              >
                                确认生成
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {item.status === "error" && recoverableRequest ? (
                        <button
                          className="no-wrap-control mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-black px-4 py-2 text-xs font-medium text-white transition hover:bg-black/85 disabled:opacity-50"
                          disabled={isGenerating}
                          onClick={(event) => {
                            event.stopPropagation();
                            generate(recoverableRequest, {
                              appendUserMessage: false,
                              resumeWorkflow: createResumeWorkflow(),
                            });
                          }}
                          type="button"
                        >
                          继续生成
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {!isGenerating && !isPlanning && generatedArtifacts.length > 0 ? (
          <div className="min-w-0 rounded-2xl border border-black/5 bg-white/45 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-medium">已生成仪表盘</p>
            <div className="mt-3 grid gap-2">
              {generatedArtifacts.slice(0, 4).map((artifact) => (
                <a
                  key={artifact.id}
                  className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl bg-white/70 px-3 py-2 text-sm transition hover:bg-white"
                  href={`/artifacts/${artifact.id}`}
                >
                  <span className="min-w-0 flex-1 truncate">{artifact.title}</span>
                  <ExternalLink className="shrink-0 text-muted" size={15} />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-3xl border border-red-500/15 bg-red-500/10 p-4 text-sm text-red-700">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{getErrorGuidance(error).title}</p>
              <p className="mt-1 break-words text-red-700/85">{error}</p>
              <p className="mt-2 text-red-700/75">{getErrorGuidance(error).description}</p>
              <p className="mt-1 text-red-700/75">{getErrorGuidance(error).action}</p>
              {recoverableRequest ? (
                <button
                  className="no-wrap-control mt-3 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                  disabled={isGenerating}
                  onClick={() =>
                    generate(recoverableRequest, {
                      appendUserMessage: false,
                      resumeWorkflow: createResumeWorkflow(),
                    })
                  }
                  type="button"
                >
                  继续生成
                </button>
              ) : (
                <p className="mt-3 text-xs text-red-700/70">没有找到上一次请求，请在输入框重新提交。</p>
              )}
            </div>
          </div>
          </div>
        ) : null}
      </div>

      {images.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <div key={`${image.name}-${index}`} className="relative overflow-hidden rounded-2xl border border-black/10">
              <img alt={image.name} className="h-24 w-full object-cover" src={image.dataUrl} />
              <button
                className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"
                disabled={isGenerating}
                onClick={() => setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <form
        className="relative rounded-3xl border border-black/5 bg-white/45 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          createGenerationPlan(input);
        }}
      >
        {showPreferences ? (
          <div className="absolute bottom-[calc(100%+10px)] left-0 right-0 z-20 rounded-3xl border border-black/10 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">生成偏好</p>
                <p className="mt-1 text-xs text-muted">保存后会作为之后生成仪表盘的默认偏好输入。</p>
              </div>
              <button className="rounded-full p-1 text-muted hover:bg-black/5" type="button" onClick={() => setShowPreferences(false)}>
                <X size={16} />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-muted">主题</span>
              <select
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                value={settings.theme}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    theme: event.target.value as DashboardSettings["theme"],
                  }))
                }
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-muted">偏好说明</span>
              <textarea
                className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
                placeholder="例如：优先浅色管理汇报风格、KPI 放首屏、减少环图、多用横向条形图..."
                value={settings.promptSettings}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    promptSettings: event.target.value,
                  }))
                }
              />
            </label>
            <div className="mt-3 flex justify-end">
              <button
                className="no-wrap-control rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
                type="button"
                onClick={() => {
                  localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(settings));
                  document.documentElement.dataset.theme = settings.theme === "system" ? "" : settings.theme;
                  setShowPreferences(false);
                }}
              >
                保存偏好
              </button>
            </div>
          </div>
        ) : null}
        <textarea
          className="scrollbar-hidden min-h-16 max-h-24 w-full resize-none rounded-2xl border border-transparent bg-transparent px-3 py-2 text-xs leading-5 outline-none placeholder:text-xs placeholder:leading-5"
          disabled={isGenerating || isPlanning}
          placeholder="描述你想要的 Dashboard，AI 会自动从底表数据中选择相关表，也可以附加案例图学习风格..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <div className="flex flex-col gap-3 border-t border-black/5 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {images.length > 0 ? <span className="text-xs text-muted">已附加 {images.length} 张案例图</span> : null}
            <button
              className="no-wrap-control inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 text-xs text-muted transition hover:bg-white hover:text-current"
              type="button"
              onClick={() => setShowPreferences(true)}
            >
              <Settings2 size={14} />
              偏好
            </button>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <label className="no-wrap-control flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-muted transition hover:bg-white">
              <ImagePlus size={16} />
              案例图
              <input
                accept="image/*"
                className="hidden"
                disabled={isGenerating || isPlanning || images.length >= MAX_IMAGES}
                multiple
                type="file"
                onChange={handleImageUpload}
              />
            </label>
            <button
              aria-label="生成"
              className="no-wrap-control flex h-10 items-center gap-2 whitespace-nowrap rounded-2xl bg-black px-4 text-sm font-medium text-white disabled:opacity-40"
              disabled={isGenerating || isPlanning || (!input.trim() && images.length === 0)}
              type="submit"
            >
              {isPlanning ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {isPlanning ? "预检中" : "数据预检"}
            </button>
          </div>
        </div>
      </form>
      {selectedTraceEvent ? (
        <div className="fixed inset-4 z-[80] flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[32px] border border-black/10 bg-[#f8fafc] shadow-[0_30px_90px_rgba(15,23,42,0.28)] lg:absolute lg:inset-auto lg:left-[calc(100%+16px)] lg:top-0 lg:h-full lg:w-[min(500px,max(360px,calc(100vw-480px)))]">
          <div className="flex items-center justify-between gap-4 border-b border-black/5 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Trace Input / Output</p>
              <h3 className="mt-1 truncate text-lg font-semibold tracking-tight">{getFriendlyEvent(selectedTraceEvent).title}</h3>
            </div>
            <button
              className="rounded-full p-2 text-muted transition hover:bg-black/5 hover:text-current"
              type="button"
              onClick={() => setSelectedTraceEvent(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid min-h-0 min-w-0 flex-1 grid-rows-2 gap-4 overflow-hidden p-4">
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">输入</p>
                <button
                  className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium"
                  type="button"
                  onClick={() => copyTraceValue(selectedTraceEvent.trace?.input)}
                >
                  <Copy size={14} />
                  复制输入
                </button>
              </div>
              <pre className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto whitespace-pre-wrap break-words rounded-3xl border border-black/5 bg-[#0f172a] p-5 font-mono text-xs leading-6 text-slate-100 shadow-inner">
                {formatTraceValue(selectedTraceEvent.trace?.input)}
              </pre>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">输出</p>
                <button
                  className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium"
                  type="button"
                  onClick={() => copyTraceValue(selectedTraceEvent.trace?.output)}
                >
                  <Copy size={14} />
                  复制输出
                </button>
              </div>
              <pre className="min-h-0 min-w-0 max-w-full flex-1 overflow-auto whitespace-pre-wrap break-words rounded-3xl border border-black/5 bg-[#0f172a] p-5 font-mono text-xs leading-6 text-slate-100 shadow-inner">
                {formatTraceValue(selectedTraceEvent.trace?.output)}
              </pre>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
