import { NextRequest, NextResponse } from "next/server";
import { getArtifactHtml, listArtifacts } from "@/lib/file-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const html = await getArtifactHtml(id);

  if (!html) {
    return NextResponse.json({ error: "未找到 Artifact。" }, { status: 404 });
  }

  const isDownload = request.nextUrl.searchParams.get("download") === "1";
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === id);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(isDownload
        ? {
            "Content-Disposition": `attachment; filename="${artifact?.title ?? id}.html"`,
          }
        : {}),
    },
  });
}
