import type { ArtifactManifest } from "@/lib/types";

export function PreviewFrame({ artifact }: { artifact: ArtifactManifest | null }) {
  return (
    <div className="apple-card flex min-h-[640px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-black/5 p-4">
        <div>
          <p className="text-sm font-medium">预览</p>
          <p className="text-xs text-muted">
            {artifact ? `${artifact.title} · Artifact V${artifact.version}` : "还没有生成 Artifact"}
          </p>
        </div>
        {artifact ? (
          <a
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white"
            href={`/api/artifacts/${artifact.id}/html?download=1`}
          >
            下载 HTML
          </a>
        ) : null}
      </div>
      {artifact ? (
        <iframe
          className="h-[720px] w-full flex-1 bg-white"
          sandbox="allow-scripts"
          src={`/api/artifacts/${artifact.id}/html`}
          title={artifact.title}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-muted">
          上传数据后，用 Chat 描述需求，AI 会生成 Dashboard Artifact。
        </div>
      )}
    </div>
  );
}
