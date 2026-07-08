import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ApiConsoleLogger } from "@/components/ApiConsoleLogger";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Dashboard 平台",
  description: "上传底表数据，用 Chat 生成仪表盘。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.variable}>
        <ApiConsoleLogger />
        {children}
      </body>
    </html>
  );
}
