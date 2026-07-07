import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type {
  ArtifactManifest,
  DashboardBlueprint,
  DatasetMetadata,
  ReviewResult,
  WorkflowRun,
} from "@/lib/types";

const uploadsDir = path.join(process.cwd(), "uploads");
const artifactsDir = path.join(process.cwd(), "artifacts");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function saveDataset(dataset: DatasetMetadata) {
  await ensureDir(uploadsDir);
  await writeFile(
    path.join(uploadsDir, `${dataset.id}.json`),
    JSON.stringify(dataset, null, 2),
    "utf8",
  );
}

export async function listDatasets(): Promise<DatasetMetadata[]> {
  await ensureDir(uploadsDir);
  const files = await readdir(uploadsDir);
  const datasets = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJsonFile<DatasetMetadata>(path.join(uploadsDir, file))),
  );

  return datasets
    .filter((dataset): dataset is DatasetMetadata => Boolean(dataset))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getDataset(datasetId: string): Promise<DatasetMetadata | null> {
  return readJsonFile<DatasetMetadata>(path.join(uploadsDir, `${datasetId}.json`));
}

export async function listArtifacts(): Promise<ArtifactManifest[]> {
  await ensureDir(artifactsDir);
  const datasetDirs = await readdir(artifactsDir, { withFileTypes: true });
  const manifests: ArtifactManifest[] = [];

  for (const datasetDir of datasetDirs) {
    if (!datasetDir.isDirectory()) {
      continue;
    }

    const versionsDir = path.join(artifactsDir, datasetDir.name);
    const versions = await readdir(versionsDir, { withFileTypes: true });

    for (const version of versions) {
      if (!version.isDirectory()) {
        continue;
      }

      const manifest = await readJsonFile<ArtifactManifest>(
        path.join(versionsDir, version.name, "manifest.json"),
      );

      if (manifest) {
        manifests.push(manifest);
      }
    }
  }

  return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listArtifactsByDataset(datasetId: string): Promise<ArtifactManifest[]> {
  const artifacts = await listArtifacts();
  return artifacts
    .filter((artifact) => artifact.datasetId === datasetId)
    .sort((a, b) => b.version - a.version);
}

export async function saveArtifact(params: {
  dataset: DatasetMetadata;
  html: string;
  userRequest: string;
  blueprint?: DashboardBlueprint;
  review?: ReviewResult;
  workflow?: WorkflowRun;
}): Promise<ArtifactManifest> {
  const existing = await listArtifactsByDataset(params.dataset.id);
  const version = existing.length > 0 ? Math.max(...existing.map((item) => item.version)) + 1 : 1;
  const id = `${params.dataset.id}-v${version}`;
  const artifactDir = path.join(artifactsDir, params.dataset.id, `v${version}`);

  await ensureDir(artifactDir);

  const manifest: ArtifactManifest = {
    id,
    datasetId: params.dataset.id,
    datasetName: params.dataset.name,
    version,
    title: `${params.dataset.name} Dashboard Artifact V${version}`,
    createdAt: new Date().toISOString(),
    userRequest: params.userRequest,
    path: path.join("artifacts", params.dataset.id, `v${version}`),
    reviewScore: params.review?.score,
    approved: params.review?.approved,
  };

  await writeFile(path.join(artifactDir, "index.html"), params.html, "utf8");
  await writeFile(
    path.join(artifactDir, "metadata.json"),
    JSON.stringify(
      {
        dataset: params.dataset,
        generatedAt: manifest.createdAt,
        userRequest: params.userRequest,
        blueprint: params.blueprint,
        review: params.review,
      },
      null,
      2,
    ),
    "utf8",
  );
  if (params.blueprint) {
    await writeFile(
      path.join(artifactDir, "blueprint.json"),
      JSON.stringify(params.blueprint, null, 2),
      "utf8",
    );
  }
  if (params.review) {
    await writeFile(
      path.join(artifactDir, "review.json"),
      JSON.stringify(params.review, null, 2),
      "utf8",
    );
  }
  if (params.workflow) {
    await writeFile(
      path.join(artifactDir, "workflow.json"),
      JSON.stringify(params.workflow, null, 2),
      "utf8",
    );
  }
  await writeFile(path.join(artifactDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return manifest;
}

export async function getArtifactHtml(id: string): Promise<string | null> {
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === id);

  if (!artifact) {
    return null;
  }

  return readFile(path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`, "index.html"), "utf8");
}

export async function getArtifactDetails(id: string): Promise<{
  manifest: ArtifactManifest;
  blueprint: DashboardBlueprint | null;
  review: ReviewResult | null;
  workflow: WorkflowRun | null;
} | null> {
  const artifacts = await listArtifacts();
  const manifest = artifacts.find((item) => item.id === id);

  if (!manifest) {
    return null;
  }

  const artifactDir = path.join(artifactsDir, manifest.datasetId, `v${manifest.version}`);

  return {
    manifest,
    blueprint: await readJsonFile<DashboardBlueprint>(path.join(artifactDir, "blueprint.json")),
    review: await readJsonFile<ReviewResult>(path.join(artifactDir, "review.json")),
    workflow: await readJsonFile<WorkflowRun>(path.join(artifactDir, "workflow.json")),
  };
}

export async function updateArtifactWorkflow(manifest: ArtifactManifest, workflow: WorkflowRun) {
  await writeFile(
    path.join(artifactsDir, manifest.datasetId, `v${manifest.version}`, "workflow.json"),
    JSON.stringify(workflow, null, 2),
    "utf8",
  );
}
