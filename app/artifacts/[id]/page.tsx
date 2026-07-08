import { AppShell } from "@/components/AppShell";
import { PreviewFrame } from "@/components/PreviewFrame";
import { listArtifacts } from "@/lib/file-store";

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === id) ?? null;

  return (
    <AppShell>
      <PreviewFrame artifact={artifact} />
    </AppShell>
  );
}
