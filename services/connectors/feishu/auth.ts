import type { FeishuAccessToken } from "@/services/connectors/feishu/types";

type TenantTokenResponse = {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
};

const FEISHU_OPEN_API_BASE_URL = "https://open.feishu.cn/open-apis";

let cachedTenantToken: FeishuAccessToken | null = null;

export async function getFeishuTenantAccessToken(): Promise<FeishuAccessToken> {
  const now = Date.now();

  if (cachedTenantToken?.expiresAt && Date.parse(cachedTenantToken.expiresAt) - now > 30 * 60 * 1000) {
    return cachedTenantToken;
  }

  const appId = process.env.FEISHU_APP_ID ?? process.env.LARK_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET ?? process.env.LARK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET 环境变量。");
  }

  const response = await fetch(`${FEISHU_OPEN_API_BASE_URL}/auth/v3/tenant_access_token/internal`, {
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    method: "POST",
  });
  const payload = (await response.json()) as TenantTokenResponse;

  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(payload.msg ?? "获取飞书 tenant_access_token 失败。");
  }

  cachedTenantToken = {
    expiresAt: new Date(now + (payload.expire ?? 7200) * 1000).toISOString(),
    token: payload.tenant_access_token,
  };

  return cachedTenantToken;
}
