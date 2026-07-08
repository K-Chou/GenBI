"use client";

import { AlertCircle, CheckCircle2, Cloud, FileSpreadsheet, Loader2, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import type { DatasetMetadata } from "@/lib/types";

export function UploadPanel({
  dataset,
  onDataset,
}: {
  dataset: DatasetMetadata | null;
  onDataset: (dataset: DatasetMetadata) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingFeishu, setIsSyncingFeishu] = useState(false);
  const [error, setError] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/datasets", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "上传失败。");
      }

      onDataset(payload.dataset);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败。");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleFeishuSync(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!feishuUrl.trim()) {
      setError("请输入飞书多维表格链接。");
      return;
    }

    setIsSyncingFeishu(true);
    setError("");

    try {
      const response = await fetch("/api/data-sources/feishu", {
        body: JSON.stringify({ bitableUrl: feishuUrl }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

      if (!response.ok || !payload.dataset) {
        throw new Error(payload.error ?? "飞书数据源同步失败。");
      }

      onDataset(payload.dataset);
      setFeishuUrl("");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "飞书数据源同步失败。");
    } finally {
      setIsSyncingFeishu(false);
    }
  }

  return (
    <div className="apple-card overflow-hidden">
      <label className="flex cursor-pointer flex-col gap-4 p-6 transition hover:bg-white/35">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-white">
            {isUploading ? <Loader2 className="animate-spin" size={22} /> : <Upload size={22} />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{isUploading ? "正在解析底表数据" : "上传 Excel 或 CSV"}</p>
            <p className="mt-1 text-sm text-muted">
              像 Lightdash preview 一样，先理解字段、类型和样例，再进入 Agent Workflow。
            </p>
          </div>
        </div>
        <input
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={isUploading}
          type="file"
          onChange={handleUpload}
        />
      </label>

      <form className="border-t border-black/5 p-6" onSubmit={handleFeishuSync}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700">
            {isSyncingFeishu ? <Loader2 className="animate-spin" size={22} /> : <Cloud size={22} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{isSyncingFeishu ? "正在在线抽取飞书 Base" : "飞书 Base 在线抽取"}</p>
            <p className="mt-1 text-sm text-muted">
              输入飞书多维表格链接，后端实时读取字段和记录，并转换成底表数据。
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                className="min-w-0 flex-1 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-black/25 focus:bg-white"
                disabled={isSyncingFeishu || isUploading}
                placeholder="https://*.feishu.cn/base/..."
                value={feishuUrl}
                onChange={(event) => setFeishuUrl(event.target.value)}
              />
              <button
                className="no-wrap-control inline-flex items-center justify-center whitespace-nowrap rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                disabled={isSyncingFeishu || isUploading || !feishuUrl.trim()}
                type="submit"
              >
                在线抽取
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">
              需要服务端配置 <code>FEISHU_APP_ID</code> 和 <code>FEISHU_APP_SECRET</code>，且应用有对应 Base 访问权限。
            </p>
          </div>
        </div>
      </form>

      {error ? (
        <div className="mx-6 mb-6 flex gap-2 rounded-2xl bg-red-500/10 p-3 text-sm text-red-600">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          <span className="break-words">{error}</span>
        </div>
      ) : null}

      {dataset ? (
        <div className="border-t border-black/5 p-6">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-1 shrink-0 text-emerald-600" size={20} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{dataset.name}</p>
                <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700">
                  <CheckCircle2 size={12} />
                  已完成 metadata preview
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                {dataset.rowCount} 行 · {dataset.columns.length} 列 · 已准备进入 BI Consultant Workflow
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-center text-xs sm:grid-cols-3">
                <div className="rounded-2xl bg-white/45 p-3">
                  <p className="font-medium">字段识别</p>
                  <p className="mt-1 text-muted">已完成</p>
                </div>
                <div className="rounded-2xl bg-white/45 p-3">
                  <p className="font-medium">样例预览</p>
                  <p className="mt-1 text-muted">已完成</p>
                </div>
                <div className="rounded-2xl bg-white/45 p-3">
                  <p className="font-medium">下一步</p>
                  <p className="mt-1 text-muted">发起 Chat</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-black/[0.03] p-3 text-sm text-muted">
                <Sparkles className="shrink-0" size={16} />
                可以直接说：“生成经营驾驶舱”，AI 会先规划再生成仪表盘。
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
