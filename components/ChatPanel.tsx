"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Circle, ImagePlus, Loader2, Send, Sparkles, X } from "lucide-react";
import type {
  ArtifactManifest,
  ChatMessage,
  DatasetMetadata,
  GenerationResult,
  ImageAttachment,
  WorkflowEvent,
} from "@/lib/types";

const starterPrompts = [
  "生成一个经营驾驶舱，先帮我规划再生成。",
  "参考我上传的案例图片，做成 Apple Style。",
  "突出 KPI、趋势、分类对比和关键洞察。",
];

const MAX_IMAGES = 3;
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const friendlyStage: Record<WorkflowEvent["agent"], string> = {
  intent: "正在理解你的业务目标",
  data: "正在分析 Dataset 结构",
  planner: "正在规划 Dashboard 方案",
  builder: "正在生成页面 Artifact",
  review: "正在质量检查",
  artifact: "正在保存并刷新预览",
};

function getFriendlyEvent(event: WorkflowEvent) {
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

export function ChatPanel({
  dataset,
  onArtifact,
}: {
  dataset: DatasetMetadata | null;
  onArtifact: (artifact: ArtifactManifest) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("生成一个销售 Dashboard。");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [timeline, setTimeline] = useState<WorkflowEvent[]>([]);

  async function generate(request: string) {
    if (!dataset || (!request.trim() && images.length === 0)) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setTimeline([]);

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: request }];
    setMessages(nextMessages);

    try {
      const settings = JSON.parse(localStorage.getItem("dashboard-settings") ?? "{}") as {
        theme?: "light" | "dark" | "system";
        promptSettings?: string;
      };

      const response = await fetch("/api/generate/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId: dataset.id,
          userRequest: request,
          history: messages,
          theme: settings.theme ?? "system",
          promptSettings: settings.promptSettings ?? "",
          images,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "生成失败。");
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
        throw new Error("Workflow 没有返回 Artifact。");
      }

      const result = resultRef.current;
      onArtifact(result.artifact);
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `已生成 ${result.artifact.title}。`,
        },
      ]);
      setInput("");
      setImages([]);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "生成失败。");
    } finally {
      setIsGenerating(false);
    }
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
    <div className="apple-card flex min-h-[520px] flex-col p-4">
      <div className="border-b border-black/5 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-sm font-medium">AI BI Consultant</p>
            <p className="mt-1 text-xs text-muted">
              像 Stitch 一样，你可以用文字和案例图片持续 steer 生成方向；每次修改都会生成新的 HTML Artifact。
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-4">
        {timeline.length > 0 ? (
          <div className="rounded-2xl border border-black/5 bg-white/45 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">实时生成进度</p>
              <span className="text-xs text-muted">
                {isGenerating ? "生成中" : error ? "已中断" : "已完成"}
              </span>
            </div>
            <div className="space-y-3">
              {timeline.map((item) => {
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
                  <div key={item.id} className="flex gap-3">
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
                    <div>
                      <p className="text-sm font-medium">{friendlyEvent.title}</p>
                      <p className="text-xs text-muted">{friendlyEvent.summary}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/5 bg-white/45 p-4">
              <p className="text-sm font-medium">可以这样开始</p>
              <p className="mt-1 text-xs text-muted">
                上传 Dataset 后，AI 会先理解业务目标和数据结构，再规划 Dashboard，而不是直接堆图表。
              </p>
            </div>
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                className="w-full rounded-2xl border border-black/5 bg-white/50 px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                disabled={!dataset || isGenerating}
                onClick={() => generate(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.role === "user" ? "bg-black text-white" : "bg-white/60 text-current"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      {error ? <p className="mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p> : null}

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
        className="rounded-3xl border border-black/5 bg-white/45 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          generate(input);
        }}
      >
        <textarea
          className="min-h-20 w-full resize-none rounded-2xl border border-transparent bg-transparent px-3 py-2 text-sm outline-none"
          disabled={!dataset || isGenerating}
          placeholder={dataset ? "描述你想要的 Dashboard，也可以上传案例图让 AI 学习风格..." : "请先上传 Dataset"}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <div className="flex items-center justify-between gap-2 border-t border-black/5 px-2 pt-2">
          <p className="text-xs text-muted">
            {images.length > 0 ? `已附加 ${images.length} 张案例图` : "支持案例截图、参考 UI、草图"}
          </p>
          <div className="flex gap-2">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 text-sm text-muted transition hover:bg-white">
              <ImagePlus size={16} />
              案例图
              <input
                accept="image/*"
                className="hidden"
                disabled={!dataset || isGenerating || images.length >= MAX_IMAGES}
                multiple
                type="file"
                onChange={handleImageUpload}
              />
            </label>
            <button
              className="flex h-10 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white disabled:opacity-40"
              disabled={!dataset || isGenerating || (!input.trim() && images.length === 0)}
              type="submit"
            >
              <Send size={16} />
              生成
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
