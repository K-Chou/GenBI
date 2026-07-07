import type { DatasetMetadata } from "@/lib/types";

const typeLabels: Record<string, string> = {
  string: "文本",
  number: "数字",
  date: "日期",
  boolean: "布尔值",
  unknown: "未知",
};

export function DatasetPreview({ dataset }: { dataset: DatasetMetadata | null }) {
  if (!dataset) {
    return (
      <div className="apple-card p-6">
        <p className="text-sm text-muted">上传 Excel 或 CSV 文件后，这里会展示 metadata。</p>
      </div>
    );
  }

  return (
    <div className="apple-card overflow-hidden">
      <div className="border-b border-black/5 p-6">
        <p className="text-sm text-muted">{dataset.fileName}</p>
        <h2 className="mt-1 text-xl font-semibold">{dataset.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {dataset.rowCount} 行 · {dataset.columns.length} 列 · sheet {dataset.sheetName}
        </p>
      </div>
      <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {dataset.columns.map((column) => (
          <div key={column.name} className="rounded-2xl border border-black/5 bg-white/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{column.name}</p>
              <span className="rounded-full bg-black/5 px-2 py-1 text-xs text-muted">
                {typeLabels[column.type] ?? column.type}
              </span>
            </div>
            <p className="mt-3 truncate text-sm text-muted">
              {column.sampleValues.length > 0 ? column.sampleValues.join(", ") : "暂无样例"}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto border-t border-black/5 p-6">
        <table className="min-w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              {dataset.columns.slice(0, 8).map((column) => (
                <th key={column.name} className="whitespace-nowrap px-3 py-2 font-medium">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.sampleRows.slice(0, 8).map((row, index) => (
              <tr key={index} className="border-t border-black/5">
                {dataset.columns.slice(0, 8).map((column) => (
                  <td key={column.name} className="max-w-48 truncate px-3 py-2 text-muted">
                    {row[column.name] === null ? "-" : String(row[column.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
