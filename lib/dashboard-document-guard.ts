import { aggregateRows, type DataRow } from "@/lib/dashboard-query";
import type { DashboardComponentType, DashboardDataView, DashboardDocument, DatasetMetadata, MetricContract } from "@/lib/types";

const structuralComponentTypes = new Set<DashboardComponentType>([
  "dashboard_title",
  "section_title",
  "insight",
  "empty_state",
]);

function getColumnMaps(datasets: DatasetMetadata[], document: DashboardDocument) {
  const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));

  return new Map(
    document.dataSources.map((source) => {
      const dataset = source.binding?.datasetId ? datasetsById.get(source.binding.datasetId) : undefined;
      return [
        source.id,
        {
          dataset,
          fields: new Set(dataset?.columns.map((column) => column.name) ?? []),
          numericFields: new Set(
            dataset?.columns.filter((column) => column.type === "number").map((column) => column.name) ?? [],
          ),
        },
      ] as const;
    }),
  );
}

function getViewOutputFields(view: DashboardDataView, sourceFields: Set<string>) {
  const groupBy = view.transform?.groupBy ?? [];
  const metrics = view.transform?.metrics ?? [];

  if (!view.transform || (groupBy.length === 0 && metrics.length === 0)) {
    return sourceFields;
  }

  return new Set([...groupBy, ...metrics.map((metric) => metric.as)]);
}

function requireField(issues: string[], field: string | undefined, fields: Set<string>, context: string) {
  if (field && !fields.has(field)) {
    issues.push(`${context} 引用了不存在字段：${field}`);
  }
}

function getMetricContractKey(metric: { datasetId: string; field: string; op: string; as: string }) {
  return `${metric.datasetId}:${metric.field}:${metric.op}:${metric.as}`;
}

function isIdentifierLikeField(field: string) {
  return /(^id$|_id$|id$|uuid|guid|token|key|record|编号|编码|标识|唯一|主键|记录id|多维表标识)/i.test(field);
}

function getRows(dataset: DatasetMetadata) {
  return (dataset.rows?.length ? dataset.rows : dataset.sampleRows) as DataRow[];
}

function getDatasetIdByDataSource(document: DashboardDocument) {
  return new Map(
    document.dataSources
      .filter((source) => source.binding?.datasetId)
      .map((source) => [source.id, source.binding?.datasetId ?? ""]),
  );
}

function isGenericMetricAlias(alias: string) {
  return /total|count|sum|avg|average|metric|value|ticket|tickets|rate|ratio|minute|minutes|工单|数量|合计|平均|时长|占比|率/i.test(alias);
}

function replaceAlias(field: string | undefined, rewrites: Map<string, string>) {
  if (!field) {
    return field;
  }

  return rewrites.get(field) ?? field;
}

export function alignDashboardMetricsWithContracts(
  document: DashboardDocument,
  metricContracts: MetricContract[] = [],
): DashboardDocument {
  if (metricContracts.length === 0) {
    return document;
  }

  const datasetIdByDataSource = getDatasetIdByDataSource(document);
  const contractsByDatasetAndAlias = new Map<string, MetricContract[]>();
  const contractsByDatasetFieldOp = new Map<string, MetricContract>();
  const contractsByDataset = new Map<string, MetricContract[]>();

  for (const contract of metricContracts) {
    const aliasKey = `${contract.datasetId}:${contract.as}`;
    contractsByDatasetAndAlias.set(aliasKey, [
      ...(contractsByDatasetAndAlias.get(aliasKey) ?? []),
      contract,
    ]);
    contractsByDatasetFieldOp.set(`${contract.datasetId}:${contract.field}:${contract.op}`, contract);
    contractsByDataset.set(contract.datasetId, [...(contractsByDataset.get(contract.datasetId) ?? []), contract]);
  }

  const aliasRewritesByViewId = new Map<string, Map<string, string>>();
  const alignedViews = document.views.map((view) => {
    const datasetId = datasetIdByDataSource.get(view.dataSourceId);

    if (!datasetId || !view.transform?.metrics?.length) {
      return view;
    }

    const viewAliasRewrites = new Map<string, string>();
    const datasetContracts = contractsByDataset.get(datasetId) ?? [];

    const alignedMetrics = view.transform.metrics.map((metric) => {
      const exact = contractsByDatasetFieldOp.get(`${datasetId}:${metric.field}:${metric.op}`);
      const aliasMatches = contractsByDatasetAndAlias.get(`${datasetId}:${metric.as}`) ?? [];
      const opMatches = datasetContracts.filter((item) => item.op === metric.op);
      const contract =
        exact ??
        (aliasMatches.length === 1 ? aliasMatches[0] : undefined) ??
        (opMatches.length === 1 ? opMatches[0] : undefined) ??
        (isGenericMetricAlias(metric.as) && opMatches.length > 0 ? opMatches[0] : undefined) ??
        (opMatches.length > 0 ? opMatches[0] : undefined) ??
        (isGenericMetricAlias(metric.as) && datasetContracts.length > 0 ? datasetContracts[0] : undefined) ??
        datasetContracts[0];

      if (!contract) {
        return metric;
      }

      if (metric.as !== contract.as) {
        viewAliasRewrites.set(metric.as, contract.as);
      }

      return {
        field: contract.field,
        op: contract.op,
        as: contract.as,
      };
    });

    if (viewAliasRewrites.size > 0) {
      aliasRewritesByViewId.set(view.id, viewAliasRewrites);
    }

    return {
      ...view,
      transform: {
        ...view.transform,
        metrics: alignedMetrics,
        sort: view.transform.sort?.map((sort) => ({
          ...sort,
          field: replaceAlias(sort.field, viewAliasRewrites) ?? sort.field,
        })),
      },
    };
  });

  return {
    ...document,
    metrics: document.metrics?.map((metric) => {
      const contract = metricContracts.find(
        (item) =>
          item.id === metric.id ||
          (item.field === metric.field && item.op === metric.op && item.as === metric.id),
      );

      if (!contract) {
        return metric;
      }

      return {
        ...metric,
        id: contract.as,
        label: metric.label || contract.label,
        field: contract.field,
        op: contract.op,
        format: metric.format ?? contract.format,
        description: metric.description ?? contract.businessDefinition,
      };
    }),
    views: alignedViews,
    components: document.components.map((component) => {
      const viewId = component.data?.viewId;
      const rewrites = viewId ? aliasRewritesByViewId.get(viewId) : undefined;

      if (!rewrites || rewrites.size === 0 || !component.data) {
        return component;
      }

      return {
        ...component,
        data: {
          ...component.data,
          columns: component.data.columns?.map((column) => replaceAlias(column, rewrites) ?? column),
          series: component.data.series?.map((series) => ({
            ...series,
            field: replaceAlias(series.field, rewrites) ?? series.field,
          })),
          value: component.data.value
            ? {
                ...component.data.value,
                field: replaceAlias(component.data.value.field, rewrites) ?? component.data.value.field,
              }
            : undefined,
        },
      };
    }),
  };
}

export function validateDashboardDocument(
  document: DashboardDocument,
  datasets: DatasetMetadata[],
  metricContracts: MetricContract[] = [],
) {
  const issues: string[] = [];
  const columnsBySource = getColumnMaps(datasets, document);
  const viewsById = new Map(document.views.map((view) => [view.id, view]));
  const outputFieldsByView = new Map<string, Set<string>>();
  const contractKeys = new Set(metricContracts.map(getMetricContractKey));

  for (const source of document.dataSources) {
    const columnMap = columnsBySource.get(source.id);

    if (!source.binding?.datasetId) {
      issues.push(`dataSource ${source.id} 缺少绑定的底表数据。`);
    } else if (!columnMap?.dataset) {
      issues.push(`dataSource ${source.id} 绑定了不存在的底表数据：${source.binding.datasetId}`);
    }
  }

  for (const view of document.views) {
    const columnMap = columnsBySource.get(view.dataSourceId);

    if (!columnMap) {
      issues.push(`view ${view.id} 引用了不存在的 dataSource：${view.dataSourceId}`);
      continue;
    }

    for (const field of view.transform?.groupBy ?? []) {
      requireField(issues, field, columnMap.fields, `view ${view.id} groupBy`);
    }

    for (const filter of view.transform?.filters ?? []) {
      requireField(issues, filter.field, columnMap.fields, `view ${view.id} filter`);
    }

    for (const metric of view.transform?.metrics ?? []) {
      requireField(issues, metric.field, columnMap.fields, `view ${view.id} metric`);
      if (metric.op !== "count" && isIdentifierLikeField(metric.field)) {
        issues.push(`view ${view.id} 对标识类字段 ${metric.field} 使用了 ${metric.op} 聚合，应使用 count 或替换为真实业务指标。`);
      }
      if (metric.op !== "count" && columnMap.fields.has(metric.field) && !columnMap.numericFields.has(metric.field)) {
        issues.push(`view ${view.id} 对非数字字段 ${metric.field} 使用了 ${metric.op} 聚合。`);
      }
      if (metricContracts.length > 0 && columnMap.dataset) {
        const contractKey = getMetricContractKey({
          datasetId: columnMap.dataset.id,
          field: metric.field,
          op: metric.op,
          as: metric.as,
        });

        if (!contractKeys.has(contractKey)) {
          issues.push(`view ${view.id} metric ${metric.as} 没有匹配的指标契约。`);
        }
      }
    }

    const outputFields = getViewOutputFields(view, columnMap.fields);
    outputFieldsByView.set(view.id, outputFields);

    for (const sort of view.transform?.sort ?? []) {
      requireField(issues, sort.field, outputFields, `view ${view.id} sort`);
    }

    if (columnMap.dataset) {
      const previewRows = aggregateRows(getRows(columnMap.dataset), view);

      if (previewRows.length === 0) {
        issues.push(`view ${view.id} 基于当前底表执行后没有返回数据。`);
      }

      for (const metric of view.transform?.metrics ?? []) {
        if (previewRows.length > 0 && !(metric.as in previewRows[0])) {
          issues.push(`view ${view.id} 执行结果缺少指标别名：${metric.as}`);
        }
      }
    }
  }

  for (const detailView of document.detailViews ?? []) {
    const columnMap = columnsBySource.get(detailView.dataSourceId);

    if (!columnMap) {
      issues.push(`detailView ${detailView.id} 引用了不存在的 dataSource：${detailView.dataSourceId}`);
      continue;
    }

    for (const column of detailView.columns) {
      requireField(issues, column, columnMap.fields, `detailView ${detailView.id} columns`);
    }

    for (const filter of detailView.filters ?? []) {
      requireField(issues, filter.field, columnMap.fields, `detailView ${detailView.id} filter`);
    }
  }

  for (const component of document.components) {
    const viewId = component.data?.viewId;

    if (!viewId) {
      if (!structuralComponentTypes.has(component.type)) {
        issues.push(`component ${component.id} 缺少 viewId。`);
      }
      continue;
    }

    if (!viewsById.has(viewId)) {
      issues.push(`component ${component.id} 引用了不存在的 view：${viewId}`);
      continue;
    }

    const outputFields = outputFieldsByView.get(viewId) ?? new Set<string>();
    requireField(issues, component.data?.value?.field, outputFields, `component ${component.id} value`);
    requireField(issues, component.data?.x?.field, outputFields, `component ${component.id} x`);

    for (const series of component.data?.series ?? []) {
      requireField(issues, series.field, outputFields, `component ${component.id} series`);
    }

    for (const column of component.data?.columns ?? []) {
      requireField(issues, column, outputFields, `component ${component.id} columns`);
    }
  }

  return issues;
}

export function assertValidDashboardDocument(
  document: DashboardDocument,
  datasets: DatasetMetadata[],
  metricContracts: MetricContract[] = [],
) {
  const issues = validateDashboardDocument(document, datasets, metricContracts);

  if (issues.length > 0) {
    throw new Error(`仪表盘数据映射校验失败：${issues.slice(0, 6).join("；")}`);
  }
}
