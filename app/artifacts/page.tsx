import { AppShell } from "@/components/AppShell";
import { PreviewFrame } from "@/components/PreviewFrame";
import { getArtifactDetails, listArtifacts } from "@/lib/file-store";

export default async function ArtifactsPage() {
  const artifacts = await listArtifacts();
  const latest = artifacts[0] ?? null;
  const latestDetails = latest ? await getArtifactDetails(latest.id) : null;

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="apple-card overflow-hidden">
          <div className="border-b border-black/5 p-6">
            <p className="text-sm text-muted">生成历史</p>
            <h2 className="mt-1 text-2xl font-semibold">{artifacts.length} 个 Artifact</h2>
          </div>
          <div className="divide-y divide-black/5">
            {artifacts.length === 0 ? (
              <p className="p-6 text-sm text-muted">还没有 Dashboard Artifact。</p>
            ) : (
              artifacts.map((artifact) => (
                <a
                  key={artifact.id}
                  className="block p-5 transition hover:bg-black/5"
                  href={`/api/artifacts/${artifact.id}/html`}
                  target="artifact-preview"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{artifact.title}</p>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs">V{artifact.version}</span>
                  </div>
                  {artifact.reviewScore !== undefined ? (
                    <p className="mt-2 text-xs text-muted">
                      Review score {artifact.reviewScore} · {artifact.approved ? "已通过" : "需优化"}
                    </p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{artifact.userRequest}</p>
                  <p className="mt-2 text-xs text-muted">
                    {new Date(artifact.createdAt).toLocaleString()}
                  </p>
                </a>
              ))
            )}
          </div>
        </aside>
        {latest ? (
          <div className="apple-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/5 p-4">
              <div>
                <p className="text-sm font-medium">预览</p>
                <p className="text-xs text-muted">点击任意版本即可在这里加载。</p>
              </div>
              <a
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
                href={`/api/artifacts/${latest.id}/html?download=1`}
              >
                下载最新 HTML
              </a>
            </div>
            <iframe
              className="h-[760px] w-full bg-white"
              name="artifact-preview"
              sandbox="allow-scripts"
              src={`/api/artifacts/${latest.id}/html`}
              title="Artifact 预览"
            />
          </div>
        ) : (
          <PreviewFrame artifact={null} />
        )}
      </div>
      {latestDetails ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="apple-card p-6">
            <p className="text-sm text-muted">Dashboard Blueprint</p>
            <h3 className="mt-1 text-xl font-semibold">
              {latestDetails.blueprint?.title ?? "暂无 Blueprint"}
            </h3>
            <div className="mt-4 space-y-3">
              {(latestDetails.blueprint?.sections ?? []).slice(0, 5).map((section) => (
                <div key={section.name} className="rounded-2xl border border-black/5 bg-white/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{section.name}</p>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs">{section.chart}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{section.purpose}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-card p-6">
            <p className="text-sm text-muted">Quality Review</p>
            <h3 className="mt-1 text-xl font-semibold">
              {latestDetails.review ? `${latestDetails.review.score} 分` : "暂无 Review"}
            </h3>
            <p className="mt-3 text-sm text-muted">{latestDetails.review?.summary ?? "暂无质量检查结果。"}</p>
            <div className="mt-4 space-y-2">
              {(latestDetails.review?.issues ?? []).slice(0, 4).map((issue) => (
                <div key={`${issue.category}-${issue.message}`} className="rounded-2xl border border-black/5 bg-white/40 p-3">
                  <p className="text-sm font-medium">
                    {issue.category} · {issue.severity}
                  </p>
                  <p className="mt-1 text-xs text-muted">{issue.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-card p-6">
            <p className="text-sm text-muted">Workflow Trace</p>
            <h3 className="mt-1 text-xl font-semibold">
              {latestDetails.workflow?.skill?.name ?? "Agent Workflow"}
            </h3>
            <div className="mt-4 space-y-3">
              {(latestDetails.workflow?.events ?? []).slice(-8).map((event) => (
                <div key={event.id} className="rounded-2xl border border-black/5 bg-white/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{event.label}</p>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs">{event.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{event.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
