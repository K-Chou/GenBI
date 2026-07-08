import type { DashboardDataFilter, DashboardDataView, DashboardDetailView, DatasetMetadata } from "@/lib/types";

export type RowValue = string | number | boolean | null;
export type DataRow = Record<string, RowValue>;

export function toNumber(value: RowValue) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[,¥￥%\s]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function matchesFilter(row: DataRow, filter: DashboardDataFilter) {
  const value = row[filter.field];

  if (filter.op === "eq") {
    return String(value ?? "") === String(filter.value ?? "");
  }

  if (filter.op === "neq") {
    return String(value ?? "") !== String(filter.value ?? "");
  }

  if (filter.op === "contains") {
    return String(value ?? "").includes(String(filter.value ?? ""));
  }

  const left = toNumber(value ?? null);
  const right = toNumber(filter.value);

  if (filter.op === "gt") {
    return left > right;
  }

  if (filter.op === "gte") {
    return left >= right;
  }

  if (filter.op === "lt") {
    return left < right;
  }

  return left <= right;
}

export function filterRows(rows: DataRow[], filters?: DashboardDataFilter[]) {
  if (!filters?.length) {
    return rows;
  }

  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

export function aggregateRows(rows: DataRow[], view: DashboardDataView): DataRow[] {
  const transform = view.transform;

  if (!transform) {
    return rows;
  }

  const filteredRows = filterRows(rows, transform.filters);
  const groupBy = transform.groupBy ?? [];
  const metrics = transform.metrics ?? [];

  if (groupBy.length === 0 && metrics.length === 0) {
    return filteredRows.slice(0, transform.limit ?? filteredRows.length);
  }

  const groups = new Map<string, DataRow & { __count?: number }>();

  for (const row of filteredRows) {
    const groupKey = groupBy.length > 0 ? groupBy.map((field) => String(row[field] ?? "未分类")).join(" / ") : "all";
    const current =
      groups.get(groupKey) ??
      groupBy.reduce<DataRow & { __count?: number }>(
        (acc, field) => {
          acc[field] = row[field] ?? "未分类";
          return acc;
        },
        { __count: 0 },
      );

    current.__count = (current.__count ?? 0) + 1;

    for (const metric of metrics) {
      const value = toNumber(row[metric.field] ?? null);
      const previous = toNumber(current[metric.as] ?? null);

      if (metric.op === "count") {
        current[metric.as] = current.__count;
      } else if (metric.op === "avg") {
        current[metric.as] = previous + value;
      } else if (metric.op === "min") {
        current[metric.as] = current[metric.as] === undefined ? value : Math.min(previous, value);
      } else if (metric.op === "max") {
        current[metric.as] = current[metric.as] === undefined ? value : Math.max(previous, value);
      } else {
        current[metric.as] = previous + value;
      }
    }

    groups.set(groupKey, current);
  }

  let result = Array.from(groups.values()).map((row) => {
    const next: DataRow = { ...row };
    const count = row.__count ?? 1;
    delete next.__count;

    for (const metric of metrics) {
      if (metric.op === "avg") {
        next[metric.as] = toNumber(next[metric.as] ?? null) / count;
      }
    }

    return next;
  });

  for (const sort of transform.sort ?? []) {
    result = result.sort((a, b) => {
      const left = a[sort.field];
      const right = b[sort.field];
      const direction = sort.direction === "asc" ? 1 : -1;

      if (typeof left === "number" || typeof right === "number") {
        return (toNumber(left ?? null) - toNumber(right ?? null)) * direction;
      }

      return String(left ?? "").localeCompare(String(right ?? ""), "zh-CN") * direction;
    });
  }

  return result.slice(0, transform.limit ?? result.length);
}

export function queryDetailRows(params: {
  dataset: DatasetMetadata;
  detailView: DashboardDetailView;
  runtimeFilters?: DashboardDataFilter[];
}) {
  const rows = (params.dataset.rows ?? params.dataset.sampleRows) as DataRow[];
  const filteredRows = filterRows(rows, [...(params.detailView.filters ?? []), ...(params.runtimeFilters ?? [])]);
  const columns = params.detailView.columns.length > 0 ? params.detailView.columns : Object.keys(filteredRows[0] ?? {});

  return filteredRows.slice(0, params.detailView.limit ?? 50).map((row) => {
    return columns.reduce<DataRow>((acc, column) => {
      acc[column] = row[column] ?? null;
      return acc;
    }, {});
  });
}
