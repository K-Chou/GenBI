import type { FeishuBitableRef } from "@/services/connectors/feishu/types";

export function parseFeishuBitableUrl(input: string): FeishuBitableRef {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("请输入有效的飞书多维表格链接。");
  }

  if (/\/wiki\//.test(url.pathname)) {
    throw new Error("当前请输入飞书多维表格 Base 原始链接，而不是知识库 Wiki 链接。请在多维表格中复制以 /base/ 开头的链接。");
  }

  const appToken =
    url.pathname.match(/\/base\/([^/?#]+)/)?.[1] ??
    url.pathname.match(/\/base\/app([^/?#]+)/)?.[1] ??
    url.searchParams.get("app_token") ??
    undefined;
  const tableId =
    url.searchParams.get("table") ??
    url.searchParams.get("table_id") ??
    url.pathname.match(/\/table\/([^/?#]+)/)?.[1] ??
    undefined;
  const viewId = url.searchParams.get("view") ?? url.searchParams.get("view_id") ?? undefined;

  if (!appToken) {
    throw new Error("无法从链接中解析飞书 Base app_token。");
  }

  return {
    appToken,
    sourceUrl: input,
    tableId,
    viewId,
  };
}
