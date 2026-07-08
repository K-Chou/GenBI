import { AppShell } from "@/components/AppShell";
import { ArtifactOptimizerWorkspace } from "@/components/ArtifactOptimizerWorkspace";
import { listArtifacts } from "@/lib/file-store";

export default async function ArtifactsPage() {
  const artifacts = await listArtifacts();

  return (
    <AppShell>
      <ArtifactOptimizerWorkspace initialArtifacts={artifacts} />
    </AppShell>
  );
}
