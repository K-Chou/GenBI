import type { DashboardDocument, DashboardPatchSet, JsonPatchOperation } from "@/lib/types";

function decodePathSegment(segment: string) {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function getPathSegments(path: string) {
  if (!path.startsWith("/")) {
    throw new Error(`无效 JSON Patch path: ${path}`);
  }

  const segments = path.slice(1).split("/").map(decodePathSegment);

  if (segments.some((segment) => segment === "__proto__" || segment === "constructor" || segment === "prototype")) {
    throw new Error("JSON Patch path 包含不安全字段。");
  }

  return segments;
}

function cloneDocument(document: DashboardDocument): DashboardDocument {
  return JSON.parse(JSON.stringify(document)) as DashboardDocument;
}

function applyOperation(target: Record<string, unknown>, operation: JsonPatchOperation) {
  const segments = getPathSegments(operation.path);
  const key = segments.at(-1);

  if (!key) {
    throw new Error("JSON Patch 不支持替换整个文档。");
  }

  let cursor: unknown = target;

  for (const segment of segments.slice(0, -1)) {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(segment)];
    } else if (cursor && typeof cursor === "object") {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      throw new Error(`JSON Patch path 不存在: ${operation.path}`);
    }
  }

  if (Array.isArray(cursor)) {
    const index = key === "-" ? cursor.length : Number(key);

    if (!Number.isInteger(index) || index < 0 || index > cursor.length) {
      throw new Error(`JSON Patch 数组索引无效: ${operation.path}`);
    }

    if (operation.op === "remove") {
      if (index >= cursor.length) {
        throw new Error(`JSON Patch remove 数组索引不存在: ${operation.path}`);
      }
      cursor.splice(index, 1);
    } else if (operation.op === "add") {
      cursor.splice(index, 0, operation.value);
    } else {
      if (index >= cursor.length) {
        throw new Error(`JSON Patch replace 数组索引不存在: ${operation.path}`);
      }
      cursor[index] = operation.value;
    }

    return;
  }

  if (!cursor || typeof cursor !== "object") {
    throw new Error(`JSON Patch path 不存在: ${operation.path}`);
  }

  const objectCursor = cursor as Record<string, unknown>;

  if (operation.op === "remove") {
    if (!(key in objectCursor)) {
      throw new Error(`JSON Patch remove path 不存在: ${operation.path}`);
    }
    delete objectCursor[key];
    return;
  }

  if (operation.op === "replace" && !(key in objectCursor)) {
    throw new Error(`JSON Patch replace path 不存在: ${operation.path}`);
  }

  objectCursor[key] = operation.value;
}

function isProtectedPath(path: string) {
  return (
    path === "/schemaVersion" ||
    path.startsWith("/schemaVersion/") ||
    path === "/id" ||
    path.startsWith("/id/") ||
    path === "/dataSources" ||
    path.startsWith("/dataSources/")
  );
}

function isAllowedPatchPath(path: string) {
  return [
    "/title",
    "/description",
    "/theme",
    "/layout",
    "/designSpec",
    "/metrics",
    "/views",
    "/detailViews",
    "/components",
    "/insights",
    "/refreshPolicy",
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function assertSafeDashboardPatch(document: DashboardDocument, patches: JsonPatchOperation[]) {
  if (patches.length === 0) {
    throw new Error("Patch 为空，无法更新仪表盘。");
  }

  const probe = cloneDocument(document) as unknown as Record<string, unknown>;

  for (const patch of patches) {
    if (!["add", "replace", "remove"].includes(patch.op)) {
      throw new Error(`不支持的 JSON Patch op: ${patch.op}`);
    }

    if (isProtectedPath(patch.path)) {
      throw new Error(`Patch 不允许修改受保护字段: ${patch.path}`);
    }

    if (!isAllowedPatchPath(patch.path)) {
      throw new Error(`Patch path 不在允许范围内: ${patch.path}`);
    }

    applyOperation(probe, patch);
  }
}

export function applyDashboardPatch(document: DashboardDocument, patches: JsonPatchOperation[]): DashboardDocument {
  assertSafeDashboardPatch(document, patches);
  const nextDocument = cloneDocument(document);

  for (const patch of patches) {
    applyOperation(nextDocument as unknown as Record<string, unknown>, patch);
  }

  return {
    ...nextDocument,
    meta: {
      ...nextDocument.meta,
      revision: (document.meta.revision ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function createManualPatchSet(params: {
  document: DashboardDocument;
  intent: string;
  patches: JsonPatchOperation[];
}): DashboardPatchSet {
  return {
    baseDocumentId: params.document.id,
    baseRevision: params.document.meta.revision ?? 1,
    createdAt: new Date().toISOString(),
    intent: params.intent,
    patches: params.patches,
    source: "manual",
    summary: params.intent,
  };
}
