"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Code2, Copy, Eye, Maximize2, RefreshCcw, Save, Sparkles } from "lucide-react";
import { DashboardRenderer } from "@/components/dashboard-renderer/DashboardRenderer";
import type { ArtifactManifest, ChatMessage, DashboardDocument, DatasetMetadata } from "@/lib/types";

type PreviewMode = "preview" | "code";
type ArtifactFormat = "dashboard" | "html";

export function PreviewFrame({ artifact }: { artifact: ArtifactManifest | null }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PreviewMode>("preview");
  const [format, setFormat] = useState<ArtifactFormat>("dashboard");
  const [codeFormat, setCodeFormat] = useState<ArtifactFormat>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardDocument | null>(null);
  const [dataset, setDataset] = useState<DatasetMetadata | null>(null);
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [html, setHtml] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [patchPrompt, setPatchPrompt] = useState("");
  const [patchHistory, setPatchHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPatching, setIsPatching] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!artifact) {
      setDashboard(null);
      setDataset(null);
      setDatasets([]);
      setHtml("");
      setDraftCode("");
      setPatchPrompt("");
      setPatchHistory([]);
      setError("");
      setMode("preview");
      return;
    }

    let isCurrent = true;
    const currentArtifact = artifact;

    async function loadArtifact() {
      setIsLoading(true);
      setError("");
      setMode("preview");

      try {
        const shouldLoadDashboard = currentArtifact.artifactType !== "html";
        const documentResponse = shouldLoadDashboard
          ? await fetch(`/api/artifacts/${currentArtifact.id}/document`, {
              cache: "no-store",
            })
          : null;
        let loadedDashboard: DashboardDocument | null = null;
        let loadedDatasets: DatasetMetadata[] = [];

        if (documentResponse?.ok) {
          const { dashboard: nextDashboard } = (await documentResponse.json()) as { dashboard: DashboardDocument };
          const datasetIds = Array.from(
            new Set(
              nextDashboard.dataSources
                .map((source) => source.binding?.datasetId)
                .filter((datasetId): datasetId is string => Boolean(datasetId)),
            ),
          );
          const nextDatasets = await Promise.all(
            (datasetIds.length ? datasetIds : [currentArtifact.datasetId]).map(async (datasetId) => {
              const response = await fetch(`/api/datasets/${datasetId}`, { cache: "no-store" });

              if (!response.ok) {
                throw new Error("底表数据加载失败。");
              }

              const payload = (await response.json()) as { dataset: DatasetMetadata };
              return payload.dataset;
            }),
          );

          loadedDashboard = nextDashboard;
          loadedDatasets = nextDatasets;

          if (currentArtifact.artifactType !== "dashboard_bundle") {
            if (!isCurrent) {
              return;
            }

            setFormat("dashboard");
          setCodeFormat("dashboard");
            setDashboard(nextDashboard);
            setDataset(nextDatasets[0] ?? null);
            setDatasets(nextDatasets);
            setHtml("");
            setDraftCode(JSON.stringify(nextDashboard, null, 2));
            return;
          }
        }

        const htmlResponse = await fetch(`/api/artifacts/${currentArtifact.id}/html`, {
          cache: "no-store",
        });

        if (!htmlResponse.ok) {
          const payload = (await htmlResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "仪表盘加载失败。");
        }

        const nextHtml = await htmlResponse.text();

        if (!isCurrent) {
          return;
        }

        setFormat("html");
        setCodeFormat("html");
        setDashboard(loadedDashboard);
        setDataset(loadedDatasets[0] ?? null);
        setDatasets(loadedDatasets);
        setHtml(nextHtml);
        setDraftCode(nextHtml);
      } catch (loadError) {
        if (!isCurrent) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "预览加载失败。");
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadArtifact();

    return () => {
      isCurrent = false;
    };
  }, [artifact, reloadKey]);

  async function copyCode() {
    if (!draftCode) {
      return;
    }

    await navigator.clipboard.writeText(draftCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function switchCodeFormat(nextFormat: ArtifactFormat) {
    setCodeFormat(nextFormat);
    setDraftCode(nextFormat === "dashboard" && dashboard ? JSON.stringify(dashboard, null, 2) : html);
  }

  function resetCode() {
    setDraftCode(codeFormat === "dashboard" && dashboard ? JSON.stringify(dashboard, null, 2) : html);
    setMode("preview");
  }

  function applyDraftPreview() {
    setError("");

    if (codeFormat === "dashboard") {
      try {
        setDashboard(JSON.parse(draftCode) as DashboardDocument);
        setFormat("dashboard");
      } catch {
        setError("JSON 格式有误，无法应用到预览。");
        return;
      }
    } else {
      setHtml(draftCode);
      setFormat("html");
    }

    setMode("preview");
  }

  async function enterFullscreen() {
    await frameRef.current?.requestFullscreen();
  }

  async function saveJsonDocument() {
    if (!artifact || !dashboard) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const nextDashboard = JSON.parse(draftCode) as DashboardDocument;
      const response = await fetch(`/api/artifacts/${artifact.id}/document`, {
        body: JSON.stringify({ dashboard: nextDashboard }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "保存 Dashboard JSON 失败。");
      }

      const payload = (await response.json()) as { dashboard: DashboardDocument; html?: string };
      setDashboard(payload.dashboard);
      if (payload.html) {
        setHtml(payload.html);
        setDraftCode(payload.html);
        setFormat("html");
      } else {
        setDraftCode(JSON.stringify(payload.dashboard, null, 2));
      }
      setSaved(true);
      setMode("preview");
      window.setTimeout(() => setSaved(false), 1400);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败，请检查 JSON 格式。");
    } finally {
      setIsSaving(false);
    }
  }

  async function patchWithConversation() {
    if (!artifact || !dashboard || !patchPrompt.trim()) {
      return;
    }

    try {
      setIsPatching(true);
      setError("");
      const response = await fetch(`/api/artifacts/${artifact.id}/patch`, {
        body: JSON.stringify({
          history: patchHistory,
          userRequest: patchPrompt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "对话修改失败。");
      }

      const payload = (await response.json()) as { dashboard: DashboardDocument; html?: string; patchSet: { summary: string } };
      setDashboard(payload.dashboard);
      if (payload.html) {
        setHtml(payload.html);
        setDraftCode(payload.html);
        setFormat("html");
      } else {
        setDraftCode(JSON.stringify(payload.dashboard, null, 2));
      }
      setPatchHistory((current) => [
        ...current,
        { role: "user", content: patchPrompt },
        { role: "assistant", content: payload.patchSet.summary },
      ]);
      setPatchPrompt("");
      setMode("preview");
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "对话修改失败。");
    } finally {
      setIsPatching(false);
    }
  }

  return (
    <div ref={frameRef} className="preview-fullscreen apple-card flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="preview-toolbar flex flex-col gap-3 border-b border-black/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">预览</p>
          <p className="truncate text-xs text-muted">
            {artifact
              ? `${artifact.title} · ${format === "dashboard" ? "Dashboard JSON" : "HTML"} · V${artifact.version}`
              : "还没有生成仪表盘"}
          </p>
        </div>
        {artifact ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <div className="flex rounded-full border border-black/10 bg-white/70 p-1">
              <button
                className={`no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  mode === "preview" ? "bg-black text-white" : "text-muted hover:bg-black/5"
                }`}
                onClick={applyDraftPreview}
                type="button"
              >
                <Eye size={15} />
                预览
              </button>
              <button
                className={`no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                  mode === "code" ? "bg-black text-white" : "text-muted hover:bg-black/5"
                }`}
                onClick={() => setMode("code")}
                type="button"
              >
                <Code2 size={15} />
                代码
              </button>
            </div>
            <button
              className="no-wrap-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
              onClick={enterFullscreen}
              type="button"
            >
              <Maximize2 size={15} />
              全屏
            </button>
          </div>
        ) : null}
      </div>
      {artifact ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-muted">正在加载仪表盘...</div>
          ) : error ? (
            <div className="border-b border-red-500/15 bg-red-500/10 p-4 text-sm text-red-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>{error}</p>
                <button
                  className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white"
                  onClick={() => setReloadKey((key) => key + 1)}
                  type="button"
                >
                  <RefreshCcw size={14} />
                  重新加载
                </button>
              </div>
            </div>
          ) : null}

          {mode === "code" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-col gap-3 border-b border-black/5 bg-black/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  {codeFormat === "dashboard"
                    ? "代码模式下可直接修改 Dashboard JSON，保存后立即回到结构化预览。"
                    : dashboard
                      ? "当前为 HTML 展示层源码；如需修改源制品，请切换到 JSON。"
                      : "旧 HTML 仪表盘支持本地代码预览，不会写回文件。"}
                </p>
                <div className="flex gap-2">
                  {dashboard && html ? (
                    <div className="flex rounded-full border border-black/10 bg-white/80 p-1">
                      <button
                        className={`rounded-full px-3 py-1.5 text-sm ${codeFormat === "html" ? "bg-black text-white" : "text-muted"}`}
                        onClick={() => switchCodeFormat("html")}
                        type="button"
                      >
                        HTML
                      </button>
                      <button
                        className={`rounded-full px-3 py-1.5 text-sm ${codeFormat === "dashboard" ? "bg-black text-white" : "text-muted"}`}
                        onClick={() => switchCodeFormat("dashboard")}
                        type="button"
                      >
                        JSON
                      </button>
                    </div>
                  ) : null}
                  <button
                    className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black px-3 py-2 text-sm text-white"
                    onClick={applyDraftPreview}
                    type="button"
                  >
                    <Eye size={15} />
                    应用预览
                  </button>
                  <button
                    className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white/80 px-3 py-2 text-sm"
                    onClick={copyCode}
                    type="button"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "已复制" : "复制代码"}
                  </button>
                  {codeFormat === "dashboard" ? (
                    <button
                      className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={isSaving}
                      onClick={saveJsonDocument}
                      type="button"
                    >
                      {saved ? <Check size={15} /> : <Save size={15} />}
                      {saved ? "已保存" : isSaving ? "保存中" : "保存 JSON"}
                    </button>
                  ) : null}
                  <button
                    className="no-wrap-control inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white/80 px-3 py-2 text-sm"
                    onClick={resetCode}
                    type="button"
                  >
                    <RefreshCcw size={15} />
                    恢复原始
                  </button>
                </div>
              </div>
              <textarea
                className="min-h-0 flex-1 resize-none bg-[#0f172a] p-4 font-mono text-xs leading-5 text-slate-100 outline-none"
                spellCheck={false}
                value={draftCode}
                onChange={(event) => setDraftCode(event.target.value)}
              />
            </div>
          ) : format === "dashboard" && dashboard && dataset ? (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <DashboardRenderer artifactId={artifact.id} document={dashboard} dataset={dataset} datasets={datasets} />
              <div className="sticky bottom-0 border-t border-black/5 bg-white/90 p-3 backdrop-blur">
                <div className="mx-auto flex max-w-5xl flex-col gap-2 rounded-full border border-black/10 bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center">
                  <input
                    className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2 text-sm outline-none"
                    placeholder="对这个仪表盘说一句修改要求，例如：第二个图换成折线图、KPI 更紧凑..."
                    value={patchPrompt}
                    onChange={(event) => setPatchPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void patchWithConversation();
                      }
                    }}
                  />
                  <button
                    className="no-wrap-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={isPatching || !patchPrompt.trim()}
                    type="button"
                    onClick={patchWithConversation}
                  >
                    <Sparkles size={15} />
                    {isPatching ? "修改中" : "对话修改"}
                  </button>
                </div>
                {patchHistory.length > 0 ? (
                  <p className="mx-auto mt-2 max-w-5xl truncate px-3 text-xs text-muted">
                    最近修改：{patchHistory.at(-1)?.content}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <iframe
                key={`${artifact.id}-${draftCode.length}`}
                className="min-h-0 w-full flex-1 bg-white"
                sandbox="allow-scripts allow-popups"
                srcDoc={draftCode}
                title={artifact.title}
              />
              {dashboard ? (
                <div className="sticky bottom-0 border-t border-black/5 bg-white/90 p-3 backdrop-blur">
                  <div className="mx-auto flex max-w-5xl flex-col gap-2 rounded-full border border-black/10 bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center">
                    <input
                      className="min-w-0 flex-1 rounded-full bg-transparent px-4 py-2 text-sm outline-none"
                      placeholder="对这个仪表盘说一句修改要求，例如：KPI 更精致、图表更紧凑、换成深色风格..."
                      value={patchPrompt}
                      onChange={(event) => setPatchPrompt(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void patchWithConversation();
                        }
                      }}
                    />
                    <button
                      className="no-wrap-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      disabled={isPatching || !patchPrompt.trim()}
                      type="button"
                      onClick={patchWithConversation}
                    >
                      <Sparkles size={15} />
                      {isPatching ? "修改中" : "对话修改"}
                    </button>
                  </div>
                  {patchHistory.length > 0 ? (
                    <p className="mx-auto mt-2 max-w-5xl truncate px-3 text-xs text-muted">
                      最近修改：{patchHistory.at(-1)?.content}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted">
          上传底表数据后，用 Chat 描述需求，AI 会生成仪表盘。
        </div>
      )}
    </div>
  );
}
