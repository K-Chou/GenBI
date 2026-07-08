"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  Loader2,
  RefreshCcw,
  Search,
  Table2,
  Upload,
  X,
} from "lucide-react";
import type { DatasetMetadata } from "@/lib/types";

type DatasetRow = Record<string, string | number | boolean | null>;

const typeLabels: Record<string, string> = {
  string: "文本",
  number: "数字",
  date: "日期",
  boolean: "布尔值",
  unknown: "未知",
};

const LIST_PAGE_SIZE = 8;
const DETAIL_PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(value));
}

function getRows(dataset: DatasetMetadata): DatasetRow[] {
  return dataset.rows?.length ? dataset.rows : dataset.sampleRows;
}

function stringifyCell(value: string | number | boolean | null) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function includesText(value: string, keyword: string) {
  return value.toLowerCase().includes(keyword.trim().toLowerCase());
}

export function DatasetExplorer({ datasets }: { datasets: DatasetMetadata[] }) {
  const [localDatasets, setLocalDatasets] = useState(datasets);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingFeishu, setIsSyncingFeishu] = useState(false);
  const [error, setError] = useState("");
  const [feishuUrl, setFeishuUrl] = useState("");
  const [datasetQuery, setDatasetQuery] = useState("");
  const [datasetPage, setDatasetPage] = useState(1);
  const [selectedDataset, setSelectedDataset] = useState<DatasetMetadata | null>(null);
  const [rowQuery, setRowQuery] = useState("");
  const [columnQuery, setColumnQuery] = useState("");
  const [detailPage, setDetailPage] = useState(1);

  const filteredDatasets = useMemo(() => {
    const keyword = datasetQuery.trim().toLowerCase();

    if (!keyword) {
      return localDatasets;
    }

    return localDatasets.filter((dataset) =>
      [dataset.name, dataset.fileName, dataset.sheetName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [datasetQuery, localDatasets]);

  const datasetPageCount = Math.max(1, Math.ceil(filteredDatasets.length / LIST_PAGE_SIZE));
  const pagedDatasets = filteredDatasets.slice((datasetPage - 1) * LIST_PAGE_SIZE, datasetPage * LIST_PAGE_SIZE);

  const selectedRows = selectedDataset ? getRows(selectedDataset) : [];
  const visibleColumns = useMemo(() => {
    if (!selectedDataset) {
      return [];
    }

    const keyword = columnQuery.trim();
    if (!keyword) {
      return selectedDataset.columns;
    }

    return selectedDataset.columns.filter((column) => includesText(column.name, keyword));
  }, [columnQuery, selectedDataset]);

  const filteredRows = useMemo(() => {
    const keyword = rowQuery.trim().toLowerCase();

    if (!keyword) {
      return selectedRows;
    }

    return selectedRows.filter((row) =>
      visibleColumns.some((column) => stringifyCell(row[column.name]).toLowerCase().includes(keyword)),
    );
  }, [rowQuery, selectedRows, visibleColumns]);

  const detailPageCount = Math.max(1, Math.ceil(filteredRows.length / DETAIL_PAGE_SIZE));
  const pagedRows = filteredRows.slice((detailPage - 1) * DETAIL_PAGE_SIZE, detailPage * DETAIL_PAGE_SIZE);

  function openDataset(dataset: DatasetMetadata) {
    setSelectedDataset(dataset);
    setRowQuery("");
    setColumnQuery("");
    setDetailPage(1);
  }

  function upsertDataset(dataset: DatasetMetadata) {
    setLocalDatasets((current) =>
      (current.some((item) => item.id === dataset.id)
        ? current.map((item) => (item.id === dataset.id ? dataset : item))
        : [dataset, ...current]
      ).sort((a, b) => (b.updatedAt ?? b.uploadedAt).localeCompare(a.updatedAt ?? a.uploadedAt)),
    );
    setSelectedDataset((current) => (current?.id === dataset.id ? dataset : current));
  }

  async function uploadNewDataset(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    setError("");

    try {
      const response = await fetch("/api/datasets", {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

      if (!response.ok || !payload.dataset) {
        throw new Error(payload.error ?? "底表数据上传失败。");
      }

      upsertDataset(payload.dataset);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "底表数据上传失败。");
    } finally {
      setIsUploading(false);
    }
  }

  async function syncNewFeishuDataset(event: React.FormEvent<HTMLFormElement>) {
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
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

      if (!response.ok || !payload.dataset) {
        throw new Error(payload.error ?? "飞书 Base 在线抽取失败。");
      }

      upsertDataset(payload.dataset);
      setFeishuUrl("");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "飞书 Base 在线抽取失败。");
    } finally {
      setIsSyncingFeishu(false);
    }
  }

  async function uploadDatasetUpdate(dataset: DatasetMetadata, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/datasets/${dataset.id}`, {
      body: formData,
      method: "PUT",
    });
    const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

    if (!response.ok || !payload.dataset) {
        throw new Error(payload.error ?? "底表数据更新失败。");
    }

    upsertDataset(payload.dataset);
  }

  async function syncDataset(dataset: DatasetMetadata) {
    const response = await fetch(`/api/datasets/${dataset.id}/sync`, {
      method: "POST",
    });
    const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

    if (!response.ok || !payload.dataset) {
        throw new Error(payload.error ?? "底表数据同步失败。");
    }

    upsertDataset(payload.dataset);
  }

  async function updateFeishuSyncPolicy(dataset: DatasetMetadata, intervalSeconds: number | null) {
    const response = await fetch(`/api/datasets/${dataset.id}`, {
      body: JSON.stringify({
        syncPolicy:
          intervalSeconds === null
            ? { enabled: false }
            : {
                enabled: true,
                intervalSeconds,
              },
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const payload = (await response.json()) as { dataset?: DatasetMetadata; error?: string };

    if (!response.ok || !payload.dataset) {
      throw new Error(payload.error ?? "同步策略更新失败。");
    }

    upsertDataset(payload.dataset);
  }

  function updateDatasetQuery(value: string) {
    setDatasetQuery(value);
    setDatasetPage(1);
  }

  function updateRowQuery(value: string) {
    setRowQuery(value);
    setDetailPage(1);
  }

  function updateColumnQuery(value: string) {
    setColumnQuery(value);
    setDetailPage(1);
  }

  return (
    <>
      <section className="apple-card overflow-hidden">
        <div className="border-b border-black/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-muted">已上传的底表数据</p>
              <h2 className="mt-1 text-2xl font-semibold">{localDatasets.length} 个底表数据</h2>
              <p className="mt-2 text-sm text-muted">
                在这里新增、更新和同步底表数据；AI 生成看板时会自动选择相关表组合分析。
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-[520px]">
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="no-wrap-control inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-black/90">
                  {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                  {isUploading ? "上传中" : "上传 Excel / CSV"}
                  <input
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={isUploading || isSyncingFeishu}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) {
                        void uploadNewDataset(file);
                      }
                    }}
                  />
                </label>
                <form className="flex min-w-0 flex-1 gap-2" onSubmit={syncNewFeishuDataset}>
                  <div className="relative min-w-0 flex-1">
                    <Cloud className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-700" size={16} />
                    <input
                      className="w-full rounded-2xl border border-black/10 bg-white/70 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/25 focus:bg-white"
                      disabled={isUploading || isSyncingFeishu}
                      placeholder="飞书 Base 链接"
                      value={feishuUrl}
                      onChange={(event) => setFeishuUrl(event.target.value)}
                    />
                  </div>
                  <button
                    className="no-wrap-control inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-sky-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
                    disabled={isUploading || isSyncingFeishu || !feishuUrl.trim()}
                    type="submit"
                  >
                    {isSyncingFeishu ? <Loader2 className="animate-spin" size={16} /> : <Cloud size={16} />}
                    在线抽取
                  </button>
                </form>
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white/70 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-black/25 focus:bg-white"
                  placeholder="搜索文件名、底表数据、Sheet"
                  value={datasetQuery}
                  onChange={(event) => updateDatasetQuery(event.target.value)}
                />
              </label>
            </div>
          </div>
          {error ? (
            <div className="mt-4 flex gap-2 rounded-2xl bg-red-500/10 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span className="break-words">{error}</span>
            </div>
          ) : null}
        </div>

        {filteredDatasets.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5">
              <Database size={20} />
            </div>
            <p className="mt-4 font-medium">没有匹配的底表数据</p>
            <p className="mt-1 text-sm text-muted">清空筛选条件，或回到首页上传新的 Excel / CSV。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="bg-black/[0.02] text-xs text-muted">
                <tr>
                  <th className="whitespace-nowrap px-6 py-3 font-medium">底表数据</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">文件名</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Sheet</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">规模</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">来源</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">同步</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">上传时间</th>
                  <th className="whitespace-nowrap px-6 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {pagedDatasets.map((dataset) => (
                  <tr
                    key={dataset.id}
                    className="cursor-pointer transition hover:bg-white/60"
                    onClick={() => openDataset(dataset)}
                  >
                    <td className="max-w-72 px-6 py-4">
                      <p className="truncate whitespace-nowrap font-medium" title={dataset.name}>
                        {dataset.name}
                      </p>
                    </td>
                    <td className="max-w-80 px-4 py-4">
                      <p className="truncate" title={dataset.fileName}>
                        {dataset.fileName}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">{dataset.sheetName}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {dataset.rowCount} 行 · {dataset.columns.length} 列
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {dataset.source?.type === "feishu_bitable" ? "飞书 Base" : "上传文件"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">
                      {dataset.source?.type === "feishu_bitable"
                        ? dataset.source.lastSyncedAt
                          ? `已同步 ${formatDate(dataset.source.lastSyncedAt)} · ${
                              dataset.source.syncPolicy?.enabled
                                ? `${dataset.source.syncPolicy.intervalSeconds ?? 60} 秒自动`
                                : "自动关闭"
                            }`
                          : "可同步"
                        : "手动更新"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDate(dataset.uploadedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="group relative inline-flex justify-end" onClick={(event) => event.stopPropagation()}>
                        <button
                          className="no-wrap-control inline-flex items-center justify-center whitespace-nowrap rounded-full bg-black px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-black/90"
                          type="button"
                        >
                          操作
                        </button>
                        <div className="invisible absolute right-0 top-10 z-30 flex w-40 translate-y-1 flex-col gap-1 rounded-2xl border border-black/10 bg-white p-2 text-left opacity-0 shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                          <button
                            className="no-wrap-control inline-flex w-full items-center justify-start whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-black/5"
                            onClick={() => openDataset(dataset)}
                            type="button"
                          >
                            查看内容
                          </button>
                          <label className="no-wrap-control inline-flex w-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-black/5">
                            <Upload size={13} />
                            上传更新
                            <input
                              accept=".xlsx,.xls,.csv"
                              className="hidden"
                              type="file"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) {
                                  void uploadDatasetUpdate(dataset, file);
                                }
                              }}
                            />
                          </label>
                          {dataset.source?.type === "feishu_bitable" ? (
                            <>
                              <button
                                className="no-wrap-control inline-flex w-full items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50"
                                type="button"
                                onClick={() => void syncDataset(dataset)}
                              >
                                <RefreshCcw size={13} />
                                立即同步
                              </button>
                              <button
                                className="no-wrap-control inline-flex w-full items-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-black/5"
                                type="button"
                                onClick={() => void updateFeishuSyncPolicy(dataset, 60)}
                              >
                                60 秒自动同步
                              </button>
                              <button
                                className="no-wrap-control inline-flex w-full items-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-black/5"
                                type="button"
                                onClick={() => void updateFeishuSyncPolicy(dataset, 300)}
                              >
                                5 分钟自动同步
                              </button>
                              <button
                                className="no-wrap-control inline-flex w-full items-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition hover:bg-black/5"
                                type="button"
                                onClick={() => void updateFeishuSyncPolicy(dataset, null)}
                              >
                                关闭自动同步
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-black/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            共 {filteredDatasets.length} 条记录 · 第 {datasetPage} / {datasetPageCount} 页
          </p>
          <div className="flex gap-2">
            <button
              className="no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm disabled:opacity-40"
              disabled={datasetPage <= 1}
              onClick={() => setDatasetPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              <ChevronLeft size={16} />
              上一页
            </button>
            <button
              className="no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 py-2 text-sm disabled:opacity-40"
              disabled={datasetPage >= datasetPageCount}
              onClick={() => setDatasetPage((page) => Math.min(datasetPageCount, page + 1))}
              type="button"
            >
              下一页
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {selectedDataset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-md sm:p-6">
          <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/60 bg-[#f8fafc] shadow-[0_32px_90px_rgba(15,23,42,0.25)]">
            <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-white px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  <Table2 size={14} />
                  底表数据明细
                </div>
                <h3 className="mt-3 truncate text-2xl font-semibold tracking-tight text-slate-950">{selectedDataset.name}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{selectedDataset.rowCount} 行</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{selectedDataset.columns.length} 列</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">Sheet {selectedDataset.sheetName}</span>
                  <span className="max-w-xl truncate rounded-full bg-slate-100 px-3 py-1">{selectedDataset.fileName}</span>
                </div>
                {!selectedDataset.rows?.length ? (
                  <p className="mt-2 text-xs text-amber-700">
                    这条记录来自旧版本上传，仅保存了 sample rows；重新上传后可查看完整行明细。
                  </p>
                ) : null}
              </div>
              <button
                className="no-wrap-control inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => setSelectedDataset(null)}
                type="button"
              >
                <X size={16} />
                关闭
              </button>
            </div>

            <div className="grid gap-3 px-6 py-5 lg:grid-cols-2">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="筛选行内容，例如工单编号、负责人、状态"
                  value={rowQuery}
                  onChange={(event) => updateRowQuery(event.target.value)}
                />
              </label>
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="筛选列名，例如状态、处理人、时间"
                  value={columnQuery}
                  onChange={(event) => updateColumnQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="scrollbar-hidden min-h-0 flex-1 overflow-auto px-6 pb-5">
              <div className="inline-block min-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="w-max min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-4 font-medium">#</th>
                    {visibleColumns.map((column) => (
                      <th key={column.name} className="whitespace-nowrap px-4 py-4 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{column.name}</span>
                          <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-500">
                            {typeLabels[column.type] ?? column.type}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pagedRows.map((row, rowIndex) => (
                    <tr key={`${detailPage}-${rowIndex}`} className="transition hover:bg-slate-50">
                      <td className="sticky left-0 bg-white px-4 py-4 text-xs text-slate-400">
                        {(detailPage - 1) * DETAIL_PAGE_SIZE + rowIndex + 1}
                      </td>
                      {visibleColumns.map((column) => (
                        <td key={column.name} className="max-w-80 whitespace-nowrap px-4 py-4 text-slate-600">
                          <span className="block truncate" title={stringifyCell(row[column.name])}>
                            {stringifyCell(row[column.name])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {filteredRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500">没有匹配的行，请调整筛选条件。</div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                已筛选 {filteredRows.length} 行 · 显示 {visibleColumns.length} 列 · 第 {detailPage} / {detailPageCount} 页
              </p>
              <div className="flex gap-2">
                <button
                  className="no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm disabled:opacity-40"
                  disabled={detailPage <= 1}
                  onClick={() => setDetailPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  <ChevronLeft size={16} />
                  上一页
                </button>
                <button
                  className="no-wrap-control inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm disabled:opacity-40"
                  disabled={detailPage >= detailPageCount}
                  onClick={() => setDetailPage((page) => Math.min(detailPageCount, page + 1))}
                  type="button"
                >
                  下一页
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
