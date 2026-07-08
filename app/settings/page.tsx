"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import type { LlmStage, LlmStageConfig, PublicLlmRuntimeConfig, UserPreferenceMemory } from "@/lib/types";

type LlmFormState = {
  apiKey: string;
  baseUrl: string;
  model: string;
  stageConfigs: Partial<Record<LlmStage, LlmStageConfig>>;
  stageModels: Partial<Record<LlmStage, string>>;
  timeoutMs: number;
};

const LEGACY_USER_ID_KEY = "artifactdash-user-id";
const USER_ID_KEY = "genbi-user-id";
const API_KEY_MASK = "••••••••••••••••";
const HYPERGRYPH_BASE_URL = "https://litellm.hypergryph.net";

const stageModelFields: Array<{
  key: LlmStage;
  label: string;
  hint: string;
}> = [
  { key: "fast", label: "Fast / 通用轻任务", hint: "数据选择、偏好、轻量补充，优先低延迟" },
  { key: "intent", label: "Intent / 意图理解", hint: "理解用户目标和业务语境" },
  { key: "planning", label: "Planning / 规划与指标", hint: "Planner、Designer、Metric Contract/System" },
  { key: "builder", label: "Builder / 看板生成", hint: "生成 DashboardDocument，建议使用最强 JSON 稳定模型" },
  { key: "presentation", label: "Presentation / HTML 展示层", hint: "把已验证 JSON 转成 Tailwind + ECharts 高表现页面" },
  { key: "repair", label: "Repair / 补丁修复", hint: "Validator 问题修复和对话修改，优先快且稳" },
  { key: "review", label: "Review / 质量评审", hint: "质量审查，可用更强推理模型" },
  { key: "vision", label: "Vision / 图片理解", hint: "案例图分析；网关模型需支持图片输入" },
];

const recommendedStageModels: Partial<Record<LlmStage, string>> = {
  builder: "hypergryph/deepseek-v3.2",
  fast: "hypergryph/qwen3.5",
  intent: "hypergryph/qwen3.5",
  planning: "hypergryph/qwen3.5",
  presentation: "hypergryph/deepseek-v3.2",
  repair: "hypergryph/qwen3.5",
  review: "vertex_ai/claude-sonnet-4-6",
  vision: "hypergryph/qwen3.5",
};

const recommendedStageConfigs = Object.fromEntries(
  Object.entries(recommendedStageModels).map(([stage, model]) => [stage, { model }]),
) as Partial<Record<LlmStage, LlmStageConfig>>;

const emptyMemory: UserPreferenceMemory = {
  businessPreferences: [],
  chartPreferences: [],
  layoutPreferences: [],
  negativePreferences: [],
  updatedAt: "",
  visualPreferences: [],
};

function PreferenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/60 p-4">
      <p className="font-medium">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {items.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">暂无记录。</p>
      )}
    </div>
  );
}

function getOrCreateUserId() {
  const existing = localStorage.getItem(USER_ID_KEY) ?? localStorage.getItem(LEGACY_USER_ID_KEY);
  if (existing) {
    localStorage.setItem(USER_ID_KEY, existing);
    return existing;
  }

  const next = crypto.randomUUID();
  localStorage.setItem(USER_ID_KEY, next);
  return next;
}

function buildStageConfigForm(llmConfig: PublicLlmRuntimeConfig) {
  return Object.fromEntries(
    stageModelFields.map((field) => {
      const stageConfig = llmConfig.stageConfigs?.[field.key];
      return [
        field.key,
        {
          baseUrl: stageConfig?.baseUrl ?? "",
          apiKey: stageConfig?.hasApiKey ? API_KEY_MASK : "",
          model: stageConfig?.model ?? llmConfig.stageModels?.[field.key] ?? "",
        },
      ];
    }),
  ) as LlmFormState["stageConfigs"];
}

export default function SettingsPage() {
  const [config, setConfig] = useState<PublicLlmRuntimeConfig | null>(null);
  const [form, setForm] = useState<LlmFormState>({
    apiKey: "",
    baseUrl: "",
    model: "",
    stageConfigs: {},
    stageModels: {},
    timeoutMs: 600_000,
  });
  const [memory, setMemory] = useState<UserPreferenceMemory>(emptyMemory);
  const [status, setStatus] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  async function loadSettings() {
    const currentUserId = getOrCreateUserId();
    setUserId(currentUserId);
    const [llmResponse, preferenceResponse] = await Promise.all([
      fetch("/api/settings/llm"),
      fetch("/api/settings/preferences", {
        headers: { "x-genbi-user-id": currentUserId },
      }),
    ]);
    const llmConfig = (await llmResponse.json()) as PublicLlmRuntimeConfig;
    const preferenceMemory = (await preferenceResponse.json()) as UserPreferenceMemory;
    setConfig(llmConfig);
    setForm({
      apiKey: llmConfig.hasApiKey ? API_KEY_MASK : "",
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      stageConfigs: buildStageConfigForm(llmConfig),
      stageModels: llmConfig.stageModels ?? {},
      timeoutMs: llmConfig.timeoutMs ?? 600_000,
    });
    setMemory(preferenceMemory);
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveConfig() {
    setIsSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/settings/llm", {
        body: JSON.stringify({
          ...form,
          apiKey: form.apiKey === API_KEY_MASK ? "" : form.apiKey,
          stageConfigs: Object.fromEntries(
            Object.entries(form.stageConfigs).filter(([, stageConfig]) =>
              Boolean(stageConfig?.baseUrl?.trim() || stageConfig?.model?.trim() || stageConfig?.apiKey?.trim()),
            ),
          ),
          stageModels: Object.fromEntries(
            Object.entries(form.stageConfigs)
              .map(([stage, stageConfig]) => [stage, stageConfig?.model])
              .filter(([, model]) => typeof model === "string" && model.trim()),
          ),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as PublicLlmRuntimeConfig | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "保存失败。");
      }
      setConfig(payload as PublicLlmRuntimeConfig);
      setForm((current) => ({
        ...current,
        apiKey: (payload as PublicLlmRuntimeConfig).hasApiKey ? API_KEY_MASK : "",
        stageConfigs: buildStageConfigForm(payload as PublicLlmRuntimeConfig),
        stageModels: (payload as PublicLlmRuntimeConfig).stageModels ?? current.stageModels,
      }));
      setStatus("已保存。下一次对话会立即使用这套模型配置。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function testConnection() {
    setIsTesting(true);
    setTestStatus("");
    try {
      const response = await fetch("/api/settings/llm/test", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "连接测试失败。");
      }
      setTestStatus("连接测试成功。");
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : "连接测试失败。");
    } finally {
      setIsTesting(false);
    }
  }

  async function resetPreferences() {
    const response = await fetch("/api/settings/preferences", {
      headers: { "x-genbi-user-id": userId || getOrCreateUserId() },
      method: "DELETE",
    });
    setMemory((await response.json()) as UserPreferenceMemory);
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pr-1 pb-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="apple-card p-6">
          <p className="text-sm text-muted">模型连接</p>
          <h2 className="mt-1 text-2xl font-semibold">OpenAI-compatible API</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            配置保存到本地服务端设置文件，下一次对话立即生效。支持 DeepSeek、OpenAI、LiteLLM、OpenRouter 或任意兼容 Chat Completions 的模型网关。
          </p>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Base URL</span>
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/30"
                placeholder="https://api.openai.com 或 https://your-litellm-host"
                value={form.baseUrl}
                onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Model</span>
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/30"
                placeholder="gpt-4o-mini / deepseek-chat / provider/model"
                value={form.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              />
              <span className="text-xs text-muted">默认兜底模型。未单独配置的阶段会使用这个模型。</span>
            </label>
            <div className="rounded-3xl border border-black/5 bg-white/55 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">阶段模型配置</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    配置 Key 为 <code>stageConfigs.&lt;stage&gt;</code>。每阶段可单独配置 Model、Base URL 和 API Key，留空则回退全局配置。
                  </p>
                </div>
                <button
                  className="no-wrap-control rounded-full border border-black/10 px-4 py-2 text-xs font-medium"
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      baseUrl: current.baseUrl || HYPERGRYPH_BASE_URL,
                      model: current.model || "hypergryph/qwen3.5",
                      stageConfigs: { ...current.stageConfigs, ...recommendedStageConfigs },
                      stageModels: { ...current.stageModels, ...recommendedStageModels },
                      timeoutMs: current.timeoutMs || 120_000,
                    }))
                  }
                >
                  填入推荐配置
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                {stageModelFields.map((field) => (
                  <div key={field.key} className="rounded-2xl border border-black/5 bg-white/60 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {field.label}
                      <code className="rounded-full bg-black/[0.04] px-2 py-1 text-xs text-muted">
                        stageConfigs.{field.key}
                      </code>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted">{field.hint}</p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Model</span>
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/30"
                          placeholder={form.model || "默认 Model"}
                          value={form.stageConfigs[field.key]?.model ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              stageConfigs: {
                                ...current.stageConfigs,
                                [field.key]: {
                                  ...current.stageConfigs[field.key],
                                  model: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                        <span className="text-[11px] text-muted">留空则使用默认 Model</span>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">Base URL</span>
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/30"
                          placeholder="默认 Base URL"
                          value={form.stageConfigs[field.key]?.baseUrl ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              stageConfigs: {
                                ...current.stageConfigs,
                                [field.key]: {
                                  ...current.stageConfigs[field.key],
                                  baseUrl: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                        <span className="text-[11px] text-muted">留空则使用默认 Base URL</span>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium">API Key</span>
                        <input
                          className="rounded-2xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/30"
                          placeholder="默认 API Key"
                          type="password"
                          value={form.stageConfigs[field.key]?.apiKey ?? ""}
                          onFocus={() => {
                            if (form.stageConfigs[field.key]?.apiKey === API_KEY_MASK) {
                              setForm((current) => ({
                                ...current,
                                stageConfigs: {
                                  ...current.stageConfigs,
                                  [field.key]: {
                                    ...current.stageConfigs[field.key],
                                    apiKey: "",
                                  },
                                },
                              }));
                            }
                          }}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              stageConfigs: {
                                ...current.stageConfigs,
                                [field.key]: {
                                  ...current.stageConfigs[field.key],
                                  apiKey: event.target.value,
                                },
                              },
                            }))
                          }
                        />
                        <span className="text-[11px] text-muted">留空则使用默认 API Key</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">API Key</span>
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/30"
                placeholder={config?.hasApiKey ? "已保存，留空则继续使用原 Key" : "请输入 API Key"}
                type="password"
                value={form.apiKey}
                onFocus={() => {
                  if (form.apiKey === API_KEY_MASK) {
                    setForm((current) => ({ ...current, apiKey: "" }));
                  }
                }}
                onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Timeout ms</span>
              <input
                className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none focus:border-black/30"
                type="number"
                value={form.timeoutMs}
                onChange={(event) => setForm((current) => ({ ...current, timeoutMs: Number(event.target.value) }))}
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="no-wrap-control rounded-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
              disabled={isSaving}
              type="button"
              onClick={saveConfig}
            >
              {isSaving ? "保存中" : "保存配置"}
            </button>
            <button
              className="no-wrap-control rounded-full border border-black/10 px-5 py-3 text-sm font-medium disabled:opacity-50"
              disabled={isTesting}
              type="button"
              onClick={testConnection}
            >
              {isTesting ? "测试中" : "测试连接"}
            </button>
          </div>

          {status ? <p className="mt-4 rounded-2xl bg-black/[0.04] p-3 text-sm text-muted">{status}</p> : null}
          {testStatus ? <p className="mt-3 rounded-2xl bg-black/[0.04] p-3 text-sm text-muted">{testStatus}</p> : null}

          <div className="mt-6 rounded-2xl border border-black/5 bg-white/50 p-4 text-sm text-muted">
            当前来源：{config?.source === "settings" ? "应用内设置" : "未配置"}
            {" · "}
            API Key：{config?.hasApiKey ? "已保存" : "未配置"}
            {" · "}
            用户记忆：{userId ? userId.slice(0, 8) : "加载中"}
            <br />
            请求路径固定使用 <code>/v1/chat/completions</code>，请确保你的网关兼容该协议。
          </div>
        </section>

        <section className="apple-card p-6">
          <p className="text-sm text-muted">长期记忆</p>
          <h2 className="mt-1 text-2xl font-semibold">系统已学习到的偏好</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            首页偏好用于本次生成；这里展示长期偏好记忆，会影响之后的 Dashboard Skill、Design Skill 和布局约束。
          </p>
          <div className="mt-6 grid gap-3">
            <PreferenceList items={memory.visualPreferences} title="视觉偏好" />
            <PreferenceList items={memory.layoutPreferences} title="布局偏好" />
            <PreferenceList items={memory.chartPreferences} title="图表偏好" />
            <PreferenceList items={memory.businessPreferences} title="业务偏好" />
            <PreferenceList items={memory.negativePreferences} title="避免项" />
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              最近更新：{memory.updatedAt ? new Date(memory.updatedAt).toLocaleString("zh-CN") : "暂无"}
            </p>
            <button
              className="no-wrap-control rounded-full border border-black/10 px-4 py-2 text-sm"
              type="button"
              onClick={resetPreferences}
            >
              重置长期记忆
            </button>
          </div>
        </section>
        </div>
      </div>
    </AppShell>
  );
}
