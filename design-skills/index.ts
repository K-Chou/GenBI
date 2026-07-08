import type { DashboardBlueprint, DashboardSkill, DesignSkill, IntentUnderstanding, UserPreferenceMemory } from "@/lib/types";
import { appleDesignLanguageSkill } from "@/design-skills/apple-design-language";
import { linearDesignSkill } from "@/design-skills/linear-design";
import { stripeDashboardSkill } from "@/design-skills/stripe-dashboard";

export const designSkillLibrary = [
  appleDesignLanguageSkill,
  linearDesignSkill,
  stripeDashboardSkill,
];

function includesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function scoreDesignSkill(params: {
  skill: DesignSkill;
  intent: IntentUnderstanding;
  dashboardSkill: DashboardSkill;
  blueprint?: DashboardBlueprint;
  preferenceMemory?: UserPreferenceMemory;
}) {
  const context = [
    params.intent.domain,
    params.intent.dashboardType,
    params.intent.audience,
    ...params.intent.goals,
    params.dashboardSkill.name,
    ...params.dashboardSkill.domains,
    params.blueprint?.dashboardType ?? "",
    params.blueprint?.audience ?? "",
    ...(params.blueprint?.objectives ?? []),
    ...(params.preferenceMemory?.visualPreferences ?? []),
    ...(params.preferenceMemory?.layoutPreferences ?? []),
  ].join(" ");

  let score = 0;

  if (params.skill.bestFor.some((item) => includesAny(context, item.split(/\s+/)))) {
    score += 2;
  }

  if (
    params.skill.id === "linear-design" &&
    includesAny(context, ["运营", "工单", "bug", "backlog", "任务", "issue", "operation", "support", "monitoring"])
  ) {
    score += 5;
  }

  if (
    params.skill.id === "stripe-dashboard" &&
    includesAny(context, ["财务", "收入", "订单", "支付", "交易", "转化", "revenue", "finance", "payment", "saas"])
  ) {
    score += 5;
  }

  if (
    params.skill.id === "apple-design-language" &&
    includesAny(context, ["管理层", "汇报", "总览", "高层", "executive", "overview", "premium", "美观", "极致"])
  ) {
    score += 5;
  }

  return score;
}

export function selectDesignSkills(params: {
  intent: IntentUnderstanding;
  dashboardSkill: DashboardSkill;
  blueprint?: DashboardBlueprint;
  preferenceMemory?: UserPreferenceMemory;
}) {
  const ranked = designSkillLibrary
    .map((skill) => ({
      score: scoreDesignSkill({ ...params, skill }),
      skill,
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.filter((item) => item.score > 0).slice(0, 2).map((item) => item.skill);

  return selected.length > 0 ? selected : [appleDesignLanguageSkill, stripeDashboardSkill];
}

export {
  appleDesignLanguageSkill,
  linearDesignSkill,
  stripeDashboardSkill,
};
