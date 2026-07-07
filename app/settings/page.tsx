"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Settings = {
  theme: "light" | "dark" | "system";
  promptSettings: string;
};

const defaultSettings: Settings = {
  theme: "system",
  promptSettings: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-settings");
    if (stored) {
      setSettings({ ...defaultSettings, ...JSON.parse(stored) });
    }
  }, []);

  function saveSettings() {
    localStorage.setItem("dashboard-settings", JSON.stringify(settings));
    document.documentElement.dataset.theme =
      settings.theme === "system" ? "" : settings.theme;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="apple-card p-6">
          <p className="text-sm text-muted">LLM 配置</p>
          <h2 className="mt-1 text-2xl font-semibold">OpenAI-compatible API</h2>
          <div className="mt-6 rounded-2xl border border-black/5 bg-white/50 p-4">
            <p className="font-medium">由后端部署环境管理</p>
            <p className="mt-2 text-sm text-muted">
              请在服务端环境变量中设置 <code>LLM_BASE_URL</code>、<code>LLM_API_KEY</code> 和{" "}
              <code>LLM_MODEL</code>。浏览器不会保存或发送 API Key。
            </p>
            <p className="mt-3 text-sm text-muted">
              当前请求路径使用 <code>/v1/chat/completions</code>，兼容 OpenAI Chat Completions 格式。
            </p>
          </div>
        </section>

        <section className="apple-card p-6">
          <p className="text-sm text-muted">Prompt 偏好</p>
          <h2 className="mt-1 text-2xl font-semibold">主题与生成备注</h2>
          <label className="mt-6 block">
            <span className="text-sm font-medium">主题</span>
            <select
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3"
              value={settings.theme}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  theme: event.target.value as Settings["theme"],
                }))
              }
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium">Prompt 设置</span>
            <textarea
              className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-4 py-3"
              placeholder="可选的生成偏好。核心设计规范会由 system prompt 强制执行。"
              value={settings.promptSettings}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  promptSettings: event.target.value,
                }))
              }
            />
          </label>

          <button
            className="mt-5 rounded-full bg-black px-5 py-3 text-sm font-medium text-white"
            onClick={saveSettings}
          >
            保存设置
          </button>
          {saved ? <p className="mt-3 text-sm text-muted">已保存。</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
