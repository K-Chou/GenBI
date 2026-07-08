"use client";

import { useEffect } from "react";
import { formatApiDuration, logApiCall } from "@/lib/api-log";

const PATCHED_FLAG = "__genbiClientFetchLoggerPatched";

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getFetchMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method;
  if (typeof input === "object" && "method" in input && input.method) return input.method;
  return "GET";
}

function isInternalApiCall(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return url.startsWith("/api/");
  }
}

export function ApiConsoleLogger() {
  useEffect(() => {
    const globalState = window as unknown as Record<string, unknown>;

    if (globalState[PATCHED_FLAG]) {
      return;
    }

    globalState[PATCHED_FLAG] = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url = getFetchUrl(input);
      const method = getFetchMethod(input, init);

      if (!isInternalApiCall(url)) {
        return originalFetch(input, init);
      }

      const startedAt = performance.now();

      try {
        const response = await originalFetch(input, init);
        logApiCall({
          direction: "client",
          duration: formatApiDuration(startedAt),
          method,
          status: response.status,
          url,
        });
        return response;
      } catch (error) {
        logApiCall({
          direction: "client",
          duration: formatApiDuration(startedAt),
          method,
          note: error instanceof Error ? error.message : "failed",
          status: "ERR",
          url,
        });
        throw error;
      }
    };
  }, []);

  return null;
}
