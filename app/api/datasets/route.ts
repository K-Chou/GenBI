import { NextResponse } from "next/server";
import { parseDatasetFile } from "@/lib/dataset-parser";
import { listDatasets, saveDataset } from "@/lib/file-store";

export async function GET() {
  const datasets = await listDatasets();
  return NextResponse.json({ datasets });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少上传文件。" }, { status: 400 });
  }

  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return NextResponse.json({ error: "仅支持 xlsx、xls 和 csv 文件。" }, { status: 400 });
  }

  const dataset = await parseDatasetFile(file);
  await saveDataset(dataset);

  return NextResponse.json({ dataset });
}
