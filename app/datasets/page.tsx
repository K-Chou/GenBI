import { AppShell } from "@/components/AppShell";
import { DatasetPreview } from "@/components/DatasetPreview";
import { listDatasets } from "@/lib/file-store";

export default async function DatasetsPage() {
  const datasets = await listDatasets();

  return (
    <AppShell>
      <div className="grid gap-6">
        <div className="apple-card p-6">
          <p className="text-sm text-muted">已上传的 Dataset</p>
          <h2 className="mt-1 text-2xl font-semibold">{datasets.length} 个 Dataset</h2>
          <p className="mt-2 text-sm text-muted">
            metadata、字段类型和 sample rows 会保存在本地，用于 Dashboard 生成。
          </p>
        </div>
        {datasets.length === 0 ? (
          <div className="apple-card p-6 text-sm text-muted">还没有 Dataset。请回到首页上传文件。</div>
        ) : (
          datasets.map((dataset) => <DatasetPreview key={dataset.id} dataset={dataset} />)
        )}
      </div>
    </AppShell>
  );
}
