"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCcw, Sparkles, X } from "lucide-react";
import { PreviewFrame } from "@/components/PreviewFrame";
import type { ArtifactManifest, ChatMessage } from "@/lib/types";

type OptimizeResponse = {
  artifact?: ArtifactManifest;
  mode: "patch" | "regenerate";
  summary: string;
};

const quickPrompts = [
  "整体优化视觉层级和留白，让它更像高质量 SaaS 数据产品。",
  "检查图表和 KPI 的信息层级，优化成更适合管理层阅读。",
  "把布局改得更紧凑，避免按钮或卡片在窄屏换行。",
];

export function ArtifactOptimizerWorkspace({ initialArtifacts }: { initialArtifacts: ArtifactManifest[] }) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactManifest | null>(initialArtifacts[0] ?? null);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [prompt, setPrompt] = useState("整体优化这个看板的视觉层级、布局和用户体验，追求最高质量效果。");
  const [strategy, setStrategy] = useState<"auto" | "patch" | "regenerate">("auto");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState("");
  const [previewVersion, setPreviewVersion] = useState(0);

  const selectedId = selectedArtifact?.id;
  const selectedHistory = useMemo(() => history.slice(-6), [history]);

  async function optimizeArtifact() {
    if (!selectedArtifact || !prompt.trim()) {
      return;
    }

    try {
      setIsOptimizing(true);
      setError("");

      const response = await fetch(`/api/artifacts/${selectedArtifact.id}/optimize`, {
        body: JSON.stringify({
          history: selectedHistory,
          strategy,
          userRequest: prompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "优化失败。");
      }

      const payload = (await response.json()) as OptimizeResponse;

      setHistory((current) => [
        ...current,
        { role: "user", content: prompt },
        {
          role: "assistant",
          content: `${payload.mode === "patch" ? "已局部优化" : "已生成新版本"}：${payload.summary}`,
        },
      ]);

      if (payload.artifact) {
        setArtifacts((current) => [payload.artifact!, ...current.filter((item) => item.id !== payload.artifact!.id)]);
        setSelectedArtifact(payload.artifact);
      } else {
        setSelectedArtifact((current) => (current ? { ...current } : current));
        setPreviewVersion((current) => current + 1);
      }

      setPrompt("");
    } catch (optimizeError) {
      setError(optimizeError instanceof Error ? optimizeError.message : "优化失败。");
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="apple-card overflow-hidden">
        <div className="border-b border-black/5 p-6">
          <p className="text-sm text-muted">生成历史</p>
          <h2 className="mt-1 text-2xl font-semibold">{artifacts.length} 个仪表盘</h2>
          <p className="mt-2 text-sm leading-6 text-muted">选择任意历史版本后，可直接唤起对话进行局部 Patch 或完整高质量优化。</p>
        </div>
        <div className="divide-y divide-black/5">
          {artifacts.length === 0 ? (
            <p className="p-6 text-sm text-muted">还没有仪表盘。</p>
          ) : (
            artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className={`p-5 transition ${artifact.id === selectedId ? "bg-black/[0.04]" : "hover:bg-black/[0.025]"}`}
              >
                <button className="block w-full text-left" type="button" onClick={() => setSelectedArtifact(artifact)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{artifact.title}</p>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-xs">
                      V{artifact.version}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="whitespace-nowrap rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-700">
                      {artifact.artifactType === "dashboard_bundle"
                        ? "Bundle"
                        : artifact.artifactType === "dashboard_json"
                          ? "仪表盘 JSON"
                          : "HTML"}
                    </span>
                    <span className="whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-xs text-muted">
                      {artifact.datasetIds?.length ?? 1} 个底表数据
                    </span>
                    {artifact.reviewScore !== undefined ? (
                      <span className="whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-xs text-muted">
                        Review {artifact.reviewScore}
                      </span>
                    ) : null}
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs ${
                        artifact.approved ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                      }`}
                    >
                      {artifact.approved ? "已通过" : "需优化"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{artifact.userRequest}</p>
                  <p className="mt-2 text-xs text-muted">
                    创建 {new Date(artifact.createdAt).toLocaleString()}
                    {artifact.lastCalculatedAt ? ` · 最近计算 ${new Date(artifact.lastCalculatedAt).toLocaleString()}` : ""}
                  </p>
                </button>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
                    type="button"
                    onClick={() => {
                      setSelectedArtifact(artifact);
                      setIsOptimizerOpen(true);
                    }}
                  >
                    <Sparkles size={15} />
                    优化
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <PreviewFrame key={`${selectedArtifact?.id ?? "empty"}-${previewVersion}`} artifact={selectedArtifact} />
      </div>

      {isOptimizerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/5 p-5">
              <div className="min-w-0">
                <p className="text-sm text-muted">仪表盘优化对话</p>
                <h3 className="mt-1 truncate text-xl font-semibold">{selectedArtifact?.title ?? "未选择仪表盘"}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Auto 会自动判断：小改动走 Patch，整体体验和高质量请求走完整多 Agent 优化并生成新版本。
                </p>
              </div>
              <button
                className="rounded-full border border-black/10 p-2 text-muted hover:bg-black/5"
                type="button"
                onClick={() => setIsOptimizerOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {history.length > 0 ? (
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl bg-black/[0.025] p-3">
                  {history.slice(-6).map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        message.role === "user" ? "bg-black text-white" : "bg-white text-muted"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((item) => (
                  <button
                    key={item}
                    className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-muted transition hover:bg-black/5"
                    type="button"
                    onClick={() => setPrompt(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <textarea
                className="min-h-32 w-full resize-none rounded-3xl border border-black/10 bg-white p-4 text-sm leading-6 outline-none focus:border-black/30"
                placeholder="描述你想优化的方向，例如：整体更高级、优化移动端、增加下钻、把趋势图改成面积图..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex rounded-full border border-black/10 bg-black/[0.02] p-1">
                  {(["auto", "patch", "regenerate"] as const).map((item) => (
                    <button
                      key={item}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        strategy === item ? "bg-black text-white" : "text-muted hover:bg-black/5"
                      }`}
                      type="button"
                      onClick={() => setStrategy(item)}
                    >
                      {item === "auto" ? "Auto" : item === "patch" ? "快速 Patch" : "完整优化"}
                    </button>
                  ))}
                </div>
                <button
                  className="no-wrap-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                  disabled={isOptimizing || !selectedArtifact || !prompt.trim()}
                  type="button"
                  onClick={optimizeArtifact}
                >
                  {isOptimizing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                  {isOptimizing ? "优化中" : "开始优化"}
                </button>
              </div>

              {error ? <p className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
