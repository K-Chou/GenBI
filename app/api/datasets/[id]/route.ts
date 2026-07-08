import { NextResponse } from "next/server";
import { parseDatasetFile } from "@/lib/dataset-parser";
import { getDataset, saveDataset } from "@/lib/file-store";
import type { DatasetMetadata, DatasetSyncPolicy } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const dataset = await getDataset(id);

  if (!dataset) {
    return NextResponse.json({ error: "未找到底表数据。" }, { status: 404 });
  }

  return NextResponse.json({ dataset });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getDataset(id);

  if (!existing) {
    return NextResponse.json({ error: "未找到底表数据。" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少上传文件。" }, { status: 400 });
  }

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: "仅支持 xlsx、xls 和 csv 文件。" }, { status: 400 });
  }

  const parsed = await parseDatasetFile(file);
  const dataset: DatasetMetadata = {
    ...parsed,
    id: existing.id,
    name: existing.name,
    uploadedAt: existing.uploadedAt,
    updatedAt: new Date().toISOString(),
    source: {
      originalFileName: file.name,
      type: "upload",
    },
  };

  await saveDataset(dataset);

  return NextResponse.json({ dataset });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getDataset(id);

  if (!existing) {
    return NextResponse.json({ error: "未找到底表数据。" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    syncPolicy?: DatasetSyncPolicy;
  };

  const dataset: DatasetMetadata = {
    ...existing,
    name: body.name?.trim() || existing.name,
    source:
      existing.source?.type === "feishu_bitable"
        ? {
            ...existing.source,
            nextSyncAt:
              body.syncPolicy?.enabled && body.syncPolicy.intervalSeconds
                ? new Date(Date.now() + body.syncPolicy.intervalSeconds * 1000).toISOString()
                : undefined,
            syncPolicy: body.syncPolicy ?? existing.source.syncPolicy,
          }
        : existing.source,
    updatedAt: new Date().toISOString(),
  };

  await saveDataset(dataset);

  return NextResponse.json({ dataset });
}
