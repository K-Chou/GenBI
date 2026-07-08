import { AppShell } from "@/components/AppShell";
import { DatasetExplorer } from "@/components/DatasetExplorer";
import { listDatasets } from "@/lib/file-store";

export default async function DatasetsPage() {
  const datasets = await listDatasets();

  return (
    <AppShell>
      <DatasetExplorer datasets={datasets} />
    </AppShell>
  );
}
