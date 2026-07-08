const SENSITIVE_PARAM_PATTERN = /key|token|secret|password|authorization|credential/i;

export type ApiLogDirection = "client" | "incoming" | "server";

export function sanitizeApiUrl(input: string) {
  try {
    const url = new URL(input, "http://localhost");
    const params = Array.from(url.searchParams.entries());

    for (const [key] of params) {
      if (SENSITIVE_PARAM_PATTERN.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return input.split("?")[0] || input;
  }
}

export function formatApiDuration(startedAt: number) {
  const durationMs = Math.round(performance.now() - startedAt);

  return durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`;
}

export function logApiCall(params: {
  direction: ApiLogDirection;
  method: string;
  url: string;
  status?: number | string;
  duration?: string;
  note?: string;
}) {
  const status = params.status === undefined ? "" : ` ${params.status}`;
  const duration = params.duration ? ` ${params.duration}` : "";
  const note = params.note ? ` ${params.note}` : "";

  console.info(`[api] ${params.direction} ${params.method.toUpperCase()} ${sanitizeApiUrl(params.url)}${status}${duration}${note}`);
}
