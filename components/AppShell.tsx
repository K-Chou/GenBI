"use client";

import Link from "next/link";
import { BarChart3, Database, FileCode2, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: BarChart3 },
  { href: "/datasets", label: "底表数据", icon: Database },
  { href: "/artifacts", label: "仪表盘", icon: FileCode2 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="h-screen overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 overflow-hidden">
        <header className="shrink-0 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">AI Native BI</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI 仪表盘平台</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              上传底表数据、描述目标，Agent 会先理解和规划，再生成可预览、可下载的仪表盘。
            </p>
          </div>
          <nav className="apple-card flex max-w-full gap-2 overflow-x-auto p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  className="no-wrap-control flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-black/5 hover:text-current"
                  href={item.href}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
