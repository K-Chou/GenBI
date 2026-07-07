import Link from "next/link";
import { BarChart3, Database, FileCode2, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "首页", icon: BarChart3 },
  { href: "/datasets", label: "Dataset", icon: Database },
  { href: "/artifacts", label: "Artifact", icon: FileCode2 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">AI Native BI</p>
            <h1 className="text-3xl font-semibold tracking-tight">AI Dashboard Artifact 平台</h1>
          </div>
          <nav className="apple-card flex flex-wrap gap-2 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-black/5 hover:text-current"
                  href={item.href}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
