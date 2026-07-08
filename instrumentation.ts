import { formatApiDuration, logApiCall } from "@/lib/api-log";

const PATCHED_FLAG = "__genbiServerFetchLoggerPatched";

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

export async function register() {
  const globalState = globalThis as unknown as Record<string, unknown>;

  if (globalState[PATCHED_FLAG]) {
    return;
  }

  globalState[PATCHED_FLAG] = true;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const url = getFetchUrl(input);
    const method = getFetchMethod(input, init);
    const startedAt = performance.now();

    try {
      const response = await originalFetch(input, init);
      logApiCall({
        direction: "server",
        duration: formatApiDuration(startedAt),
        method,
        status: response.status,
        url,
      });
      return response;
    } catch (error) {
      logApiCall({
        direction: "server",
        duration: formatApiDuration(startedAt),
        method,
        note: error instanceof Error ? error.message : "failed",
        status: "ERR",
        url,
      });
      throw error;
    }
  };
}
