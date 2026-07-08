import type { DesignSkill, DesignSpecification } from "@/lib/types";

const validHexOrCssColor = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(.+\)|hsla?\(.+\)|[a-zA-Z]+)$/;

function requireString(issues: string[], value: string | undefined, label: string) {
  if (!value || !value.trim()) {
    issues.push(`${label} 不能为空。`);
  }
}

function requireColor(issues: string[], value: string | undefined, label: string) {
  if (!value || !validHexOrCssColor.test(value.trim())) {
    issues.push(`${label} 不是可执行的颜色 token。`);
  }
}

export function normalizeDesignSpecification(
  designSpec: DesignSpecification,
  designSkills: DesignSkill[] = [],
): DesignSpecification {
  const primarySkill = designSkills[0];
  const cardStyle = designSpec.cardStyle ?? {
    border: primarySkill?.tokenHints.light.border ?? "rgba(15,23,42,0.08)",
    padding: primarySkill?.tokenHints.density === "dense" ? 16 : 22,
    radius: primarySkill?.tokenHints.radius ?? 18,
    shadow: primarySkill?.tokenHints.shadow ?? "subtle",
  };
  const chartStyle = designSpec.chartStyle ?? {
    axis: "minimal",
    barRadius: 10,
    donutThickness: "medium",
    gridLine: "subtle",
    legend: "compact",
    lineSmooth: true,
    tooltip: "soft",
  };

  return {
    ...designSpec,
    designSkillIds: designSpec.designSkillIds?.length
      ? designSpec.designSkillIds
      : designSkills.map((skill) => skill.id),
    cardStyle: {
      ...cardStyle,
      padding: Math.max(12, Math.min(32, cardStyle.padding)),
      radius: Math.max(8, Math.min(28, cardStyle.radius)),
    },
    chartStyle: {
      ...chartStyle,
      barRadius: Math.max(0, Math.min(16, chartStyle.barRadius)),
    },
    compositionRules: designSpec.compositionRules?.length
      ? designSpec.compositionRules
      : [
          "首屏优先呈现 Dashboard 标题、核心 KPI 和一个主分析模块。",
          "同一模块内保持卡片 colSpan、标题层级和图表高度一致。",
          "先用 Typography、spacing 和对齐建立层级，再使用颜色强调状态。",
        ],
    qualityChecklist: designSpec.qualityChecklist?.length
      ? designSpec.qualityChecklist
      : [
          "首屏重点是否 5 秒可读。",
          "KPI 是否位于顶部或模块首位且口径清楚。",
          "Grid 是否使用可维护 colSpan 并保持对齐。",
          "图表是否低噪音且没有错误类型。",
          "移动端单列是否仍可读。",
          "是否提供必要明细、筛选或钻取入口。",
        ],
    referenceInfluence: designSpec.referenceInfluence?.length
      ? designSpec.referenceInfluence
      : primarySkill
        ? [`采用 ${primarySkill.name} 的通用设计原则，不复制品牌视觉。`]
        : designSpec.referenceInfluence,
  };
}

export function validateDesignSpecification(
  designSpec: DesignSpecification | undefined,
  designSkills: DesignSkill[] = [],
) {
  const issues: string[] = [];

  if (!designSpec) {
    return ["缺少 DesignSpecification。"];
  }

  const normalizedDesignSpec = normalizeDesignSpecification(designSpec, designSkills);
  const selectedIds = new Set(designSkills.map((skill) => skill.id));
  for (const id of normalizedDesignSpec.designSkillIds ?? []) {
    if (selectedIds.size > 0 && !selectedIds.has(id)) {
      issues.push(`designSkillIds 包含未选择的设计范式：${id}`);
    }
  }

  requireString(issues, normalizedDesignSpec.visualStyle, "visualStyle");
  requireString(issues, normalizedDesignSpec.layoutPattern, "layoutPattern");
  requireString(issues, normalizedDesignSpec.density, "density");

  requireColor(issues, normalizedDesignSpec.colorPalette.background, "colorPalette.background");
  requireColor(issues, normalizedDesignSpec.colorPalette.surface, "colorPalette.surface");
  requireColor(issues, normalizedDesignSpec.colorPalette.primary, "colorPalette.primary");
  requireColor(issues, normalizedDesignSpec.colorPalette.accent, "colorPalette.accent");
  requireColor(issues, normalizedDesignSpec.colorPalette.text, "colorPalette.text");
  requireColor(issues, normalizedDesignSpec.colorPalette.muted, "colorPalette.muted");

  if (normalizedDesignSpec.cardStyle.radius < 8 || normalizedDesignSpec.cardStyle.radius > 28) {
    issues.push("cardStyle.radius 应保持在 8-28px，避免过硬或过度胶囊化。");
  }

  if (normalizedDesignSpec.cardStyle.padding < 12 || normalizedDesignSpec.cardStyle.padding > 32) {
    issues.push("cardStyle.padding 应保持在 12-32px，兼顾密度和可读性。");
  }

  if (normalizedDesignSpec.chartStyle.barRadius < 0 || normalizedDesignSpec.chartStyle.barRadius > 16) {
    issues.push("chartStyle.barRadius 应保持在 0-16px。");
  }

  if ((normalizedDesignSpec.compositionRules ?? []).length < 3) {
    issues.push("compositionRules 至少需要 3 条可执行构图规则。");
  }

  if ((normalizedDesignSpec.qualityChecklist ?? []).length < 5) {
    issues.push("qualityChecklist 至少需要覆盖信息层级、KPI、图表、移动端和数据追溯。");
  }

  return issues;
}

export function assertValidDesignSpecification(
  designSpec: DesignSpecification | undefined,
  designSkills: DesignSkill[] = [],
) {
  const issues = validateDesignSpecification(designSpec, designSkills);

  if (issues.length > 0) {
    throw new Error(`设计规范校验失败：${issues.slice(0, 6).join("；")}`);
  }
}
