import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type {
  ArtifactManifest,
  DashboardBlueprint,
  DashboardDocument,
  DashboardPatchSet,
  DatasetMetadata,
  DesignSpecification,
  LlmRuntimeConfig,
  LlmStage,
  PublicLlmRuntimeConfig,
  MetricSystem,
  ReviewResult,
  UserPreferenceMemory,
  WorkflowRun,
} from "@/lib/types";

const uploadsDir = path.join(process.cwd(), "uploads");
const artifactsDir = path.join(process.cwd(), "artifacts");
const preferencesDir = path.join(process.cwd(), "preferences");
const settingsDir = path.join(process.cwd(), "settings");
const llmSettingsPath = path.join(settingsDir, "llm.json");

function toPublicStageConfigs(configs?: LlmRuntimeConfig["stageConfigs"]) {
  if (!configs) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(configs).map(([stage, config]) => [
      stage,
      {
        baseUrl: config.baseUrl,
        hasApiKey: Boolean(config.apiKey),
        model: config.model,
      },
    ]),
  ) as PublicLlmRuntimeConfig["stageConfigs"];
}

function normalizeSecret(incoming?: string, existing?: string) {
  const trimmed = incoming?.trim();
  if (!trimmed || trimmed.includes("•")) {
    return existing;
  }

  return trimmed;
}

function normalizeStageConfigs(config: LlmRuntimeConfig, existing?: LlmRuntimeConfig | null) {
  const stages = new Set([
    ...Object.keys(config.stageConfigs ?? {}),
    ...Object.keys(existing?.stageConfigs ?? {}),
    ...Object.keys(config.stageModels ?? {}),
  ] as LlmStage[]);

  const stageConfigs = Object.fromEntries(
    Array.from(stages)
      .map((stage) => {
        const incoming = config.stageConfigs?.[stage];
        const previous = existing?.stageConfigs?.[stage];
        const model = incoming?.model?.trim() || config.stageModels?.[stage]?.trim();
        const baseUrl = incoming?.baseUrl?.trim().replace(/\/$/, "");
        const apiKey = normalizeSecret(incoming?.apiKey, previous?.apiKey);

        return [
          stage,
          {
            ...(baseUrl ? { baseUrl } : previous?.baseUrl ? { baseUrl: previous.baseUrl } : {}),
            ...(apiKey ? { apiKey } : {}),
            ...(model ? { model } : previous?.model ? { model: previous.model } : {}),
          },
        ];
      })
      .filter(([, stageConfig]) => Object.keys(stageConfig).length),
  ) as LlmRuntimeConfig["stageConfigs"];

  return Object.keys(stageConfigs ?? {}).length ? stageConfigs : undefined;
}

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

export async function getUserPreferenceMemory(userId = "default"): Promise<UserPreferenceMemory | null> {
  await ensureDir(preferencesDir);
  return readJsonFile<UserPreferenceMemory>(path.join(preferencesDir, `${userId}.json`));
}

export async function saveUserPreferenceMemory(memory: UserPreferenceMemory, userId = "default") {
  await ensureDir(preferencesDir);
  await writeFile(path.join(preferencesDir, `${userId}.json`), JSON.stringify(memory, null, 2), "utf8");
}

export async function getStoredLlmConfig(): Promise<LlmRuntimeConfig | null> {
  return readJsonFile<LlmRuntimeConfig>(llmSettingsPath);
}

export async function getPublicLlmConfig(): Promise<PublicLlmRuntimeConfig> {
  const stored = await getStoredLlmConfig();

  if (stored?.baseUrl && stored.model) {
    return {
      baseUrl: stored.baseUrl,
      hasApiKey: Boolean(stored.apiKey),
      model: stored.model,
      source: "settings",
      stageConfigs: toPublicStageConfigs(stored.stageConfigs),
      stageModels: stored.stageModels,
      timeoutMs: stored.timeoutMs,
    };
  }

  return {
    baseUrl: "",
    hasApiKey: false,
    model: "",
    source: "none",
    stageConfigs: undefined,
    stageModels: undefined,
    timeoutMs: undefined,
  };
}

export async function saveLlmConfig(config: LlmRuntimeConfig) {
  await ensureDir(settingsDir);
  const existing = await getStoredLlmConfig();
  const stageConfigs = normalizeStageConfigs(config, existing);
  const nextConfig: LlmRuntimeConfig = {
    apiKey: normalizeSecret(config.apiKey, existing?.apiKey),
    baseUrl: config.baseUrl.trim().replace(/\/$/, ""),
    model: config.model.trim(),
    stageConfigs,
    stageModels: config.stageModels,
    timeoutMs: config.timeoutMs,
  };
  await writeFile(llmSettingsPath, JSON.stringify(nextConfig, null, 2), "utf8");
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
    .filter((artifact) => artifact.datasetId === datasetId || artifact.datasetIds?.includes(datasetId))
    .sort((a, b) => b.version - a.version);
}

export async function saveArtifact(params: {
  dataset: DatasetMetadata;
  datasets?: DatasetMetadata[];
  html?: string;
  dashboard?: DashboardDocument;
  userRequest: string;
  blueprint?: DashboardBlueprint;
  metricSystem?: MetricSystem;
  designSpec?: DesignSpecification;
  review?: ReviewResult;
  workflow?: WorkflowRun;
}): Promise<ArtifactManifest> {
  const relatedDatasets = params.datasets?.length ? params.datasets : [params.dataset];
  const existing = await listArtifactsByDataset(params.dataset.id);
  const version = existing.length > 0 ? Math.max(...existing.map((item) => item.version)) + 1 : 1;
  const id = `${params.dataset.id}-v${version}`;
  const artifactDir = path.join(artifactsDir, params.dataset.id, `v${version}`);

  await ensureDir(artifactDir);

  const manifest: ArtifactManifest = {
    id,
    datasetId: params.dataset.id,
    datasetIds: relatedDatasets.map((dataset) => dataset.id),
    datasetName: params.dataset.name,
    version,
    artifactType: params.dashboard && params.html ? "dashboard_bundle" : params.dashboard ? "dashboard_json" : "html",
    title: `${relatedDatasets.map((dataset) => dataset.name).join(" + ")} 仪表盘 V${version}`,
    createdAt: new Date().toISOString(),
    lastCalculatedAt: new Date().toISOString(),
    refreshPolicy: params.dashboard?.refreshPolicy,
    userRequest: params.userRequest,
    path: path.join("artifacts", params.dataset.id, `v${version}`),
    reviewScore: params.review?.score,
    approved: params.review?.approved,
  };

  if (params.html) {
    await writeFile(path.join(artifactDir, "index.html"), params.html, "utf8");
  }
  if (params.dashboard) {
    await writeFile(path.join(artifactDir, "dashboard.json"), JSON.stringify(params.dashboard, null, 2), "utf8");
  }
  await writeFile(
    path.join(artifactDir, "metadata.json"),
    JSON.stringify(
      {
        dataset: params.dataset,
        datasets: relatedDatasets,
        generatedAt: manifest.createdAt,
        userRequest: params.userRequest,
        blueprint: params.blueprint,
        metricSystem: params.metricSystem,
        designSpec: params.designSpec,
        dashboard: params.dashboard,
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
  if (params.metricSystem) {
    await writeFile(
      path.join(artifactDir, "metric-system.json"),
      JSON.stringify(params.metricSystem, null, 2),
      "utf8",
    );
  }
  if (params.designSpec) {
    await writeFile(
      path.join(artifactDir, "design-spec.json"),
      JSON.stringify(params.designSpec, null, 2),
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

  try {
    return await readFile(path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`, "index.html"), "utf8");
  } catch {
    return null;
  }
}

export async function getArtifactDashboard(id: string): Promise<DashboardDocument | null> {
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === id);

  if (!artifact) {
    return null;
  }

  return readJsonFile<DashboardDocument>(path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`, "dashboard.json"));
}

export async function getArtifactDetails(id: string): Promise<{
  manifest: ArtifactManifest;
  blueprint: DashboardBlueprint | null;
  metricSystem: MetricSystem | null;
  designSpec: DesignSpecification | null;
  dashboard: DashboardDocument | null;
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
    metricSystem: await readJsonFile<MetricSystem>(path.join(artifactDir, "metric-system.json")),
    designSpec: await readJsonFile<DesignSpecification>(path.join(artifactDir, "design-spec.json")),
    dashboard: await readJsonFile<DashboardDocument>(path.join(artifactDir, "dashboard.json")),
    review: await readJsonFile<ReviewResult>(path.join(artifactDir, "review.json")),
    workflow: await readJsonFile<WorkflowRun>(path.join(artifactDir, "workflow.json")),
  };
}

export async function updateArtifactDashboard(params: {
  artifactId: string;
  dashboard: DashboardDocument;
  patchSet?: DashboardPatchSet;
}) {
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === params.artifactId);

  if (!artifact) {
    throw new Error("未找到仪表盘。");
  }

  const artifactDir = path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`);
  await writeFile(path.join(artifactDir, "dashboard.json"), JSON.stringify(params.dashboard, null, 2), "utf8");

  if (params.patchSet) {
    const patchLogPath = path.join(artifactDir, "patches.json");
    const existing = (await readJsonFile<DashboardPatchSet[]>(patchLogPath)) ?? [];
    await writeFile(patchLogPath, JSON.stringify([...existing, params.patchSet], null, 2), "utf8");
  }
}

export async function updateArtifactHtml(params: {
  artifactId: string;
  html: string;
}) {
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === params.artifactId);

  if (!artifact) {
    throw new Error("未找到仪表盘。");
  }

  const artifactDir = path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`);
  await writeFile(path.join(artifactDir, "index.html"), params.html, "utf8");

  if (artifact.artifactType !== "dashboard_bundle") {
    await updateArtifactManifest({
      ...artifact,
      artifactType: artifact.artifactType === "dashboard_json" ? "dashboard_bundle" : artifact.artifactType,
    });
  }
}

export async function updateArtifactReview(params: {
  artifactId: string;
  review: ReviewResult;
}) {
  const artifacts = await listArtifacts();
  const artifact = artifacts.find((item) => item.id === params.artifactId);

  if (!artifact) {
    throw new Error("未找到仪表盘。");
  }

  const artifactDir = path.join(artifactsDir, artifact.datasetId, `v${artifact.version}`);
  await writeFile(path.join(artifactDir, "review.json"), JSON.stringify(params.review, null, 2), "utf8");
}

export async function updateArtifactManifest(manifest: ArtifactManifest) {
  await writeFile(
    path.join(artifactsDir, manifest.datasetId, `v${manifest.version}`, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

export async function updateArtifactWorkflow(manifest: ArtifactManifest, workflow: WorkflowRun) {
  await writeFile(
    path.join(artifactsDir, manifest.datasetId, `v${manifest.version}`, "workflow.json"),
    JSON.stringify(workflow, null, 2),
    "utf8",
  );
}
