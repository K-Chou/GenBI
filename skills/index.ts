import type {
  DashboardSkill,
  EffectiveDashboardSkill,
  IntentUnderstanding,
  SkillOptimization,
  UserPreferenceMemory,
} from "@/lib/types";
import { analyticalDashboardSkill } from "@/skills/analytical-dashboard";
import { commonDashboardSkill } from "@/skills/common-dashboard";
import { executiveOverviewSkill } from "@/skills/executive-overview";
import { financeDashboardSkill } from "@/skills/finance";
import { operationalMonitoringSkill } from "@/skills/operational-monitoring";
import { salesDashboardSkill } from "@/skills/sales";
import { saasDashboardSkill } from "@/skills/saas";

const skills = [
  salesDashboardSkill,
  financeDashboardSkill,
  saasDashboardSkill,
  executiveOverviewSkill,
  operationalMonitoringSkill,
  analyticalDashboardSkill,
  commonDashboardSkill,
];

export function selectDashboardSkill(intent: IntentUnderstanding): DashboardSkill {
  const normalizedDomain = intent.domain.toLowerCase();
  const normalizedType = intent.dashboardType.toLowerCase();

  return (
    skills.find((skill) =>
      skill.domains.some(
        (domain) =>
          normalizedDomain.includes(domain) ||
          normalizedType.includes(domain),
      ),
    ) ?? commonDashboardSkill
  );
}

export function createEffectiveSkill(params: {
  baseSkill: DashboardSkill;
  preferenceMemory?: UserPreferenceMemory;
  optimizations?: SkillOptimization;
}): EffectiveDashboardSkill {
  const preferenceRules = params.preferenceMemory
    ? {
        businessRules: params.preferenceMemory.businessPreferences.map(
          (preference) => `用户业务偏好：${preference}`,
        ),
        kpiRules: [],
        chartRules: params.preferenceMemory.chartPreferences.map(
          (preference) => `用户图表偏好：${preference}`,
        ),
        layoutRules: params.preferenceMemory.layoutPreferences.map(
          (preference) => `用户布局偏好：${preference}`,
        ),
        designRules: [
          ...params.preferenceMemory.visualPreferences.map(
            (preference) => `用户视觉偏好：${preference}`,
          ),
          ...params.preferenceMemory.negativePreferences.map(
            (preference) => `避免：${preference}`,
          ),
        ],
      }
    : {
        businessRules: [],
        kpiRules: [],
        chartRules: [],
        layoutRules: [],
        designRules: [],
      };

  return {
    ...params.baseSkill,
    id: `${params.baseSkill.id}-effective`,
    name: `${params.baseSkill.name}（已叠加偏好）`,
    baseSkillId: params.baseSkill.id,
    preferenceMemory: params.preferenceMemory,
    optimizations: params.optimizations,
    businessRules: [
      ...params.baseSkill.businessRules,
      ...preferenceRules.businessRules,
      ...(params.optimizations?.businessRules ?? []),
    ],
    kpiRules: [
      ...params.baseSkill.kpiRules,
      ...preferenceRules.kpiRules,
      ...(params.optimizations?.kpiRules ?? []),
    ],
    chartRules: [
      ...params.baseSkill.chartRules,
      ...preferenceRules.chartRules,
      ...(params.optimizations?.chartRules ?? []),
    ],
    layoutRules: [
      ...params.baseSkill.layoutRules,
      ...preferenceRules.layoutRules,
      ...(params.optimizations?.layoutRules ?? []),
    ],
    designRules: [
      ...params.baseSkill.designRules,
      ...preferenceRules.designRules,
      ...(params.optimizations?.designRules ?? []),
    ],
    promptExtension: [
      params.baseSkill.promptExtension,
      ...(params.optimizations?.rationale ?? []).map((item) => `优化原因：${item}`),
    ].join("\n"),
  };
}

export {
  analyticalDashboardSkill,
  commonDashboardSkill,
  executiveOverviewSkill,
  financeDashboardSkill,
  operationalMonitoringSkill,
  salesDashboardSkill,
  saasDashboardSkill,
};
