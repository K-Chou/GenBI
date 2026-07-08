import type {
  DashboardBlueprint,
  DashboardSkill,
  DataUnderstanding,
  DesignSpecification,
  DesignSkill,
  IntentUnderstanding,
  ReferenceImageAnalysis,
  ReviewResult,
} from "@/lib/types";
import { designReferencePrompt } from "@/prompts/dashboard-system";
import { completeJson } from "@/services/deepseek";

export async function runDesignerAgent(params: {
  intent: IntentUnderstanding;
  dataUnderstanding: DataUnderstanding;
  skill: DashboardSkill;
  designSkills: DesignSkill[];
  blueprint: DashboardBlueprint;
  imageAnalysis?: ReferenceImageAnalysis;
  review?: ReviewResult;
  theme?: string;
}): Promise<DesignSpecification> {
  return completeJson<DesignSpecification>({
    stage: "planning",
    temperature: 0.12,
    messages: [
      {
        role: "system",
        content: `你是 Designer Agent，也是顶级 SaaS / BI Dashboard 视觉设计专家。
你的任务不是生成 Dashboard JSON，也不是生成 HTML，而是输出可由 Renderer 执行的 DesignSpecification。

设计参考来源应吸收 Dribbble 上成熟 Dashboard/Admin Panel 的通用范式：
- 模块化 card-based layout
- 顶部高优先级 KPI
- 强信息层级和可扫描性
- progressive disclosure
- 柔和中性色背景、精细 border、轻阴影
- 低噪音图表和一致组件节奏
- 对服务运营、产品运营、内容运营、基建服务这类多域运营看板，优先采用 compact operations 风格：紧凑卡片、清晰 section、横向/堆叠柱图、少量 donut 和明确状态色；只有用户明确要求深色或运营大屏时才使用 dark。
- 颜色不要机械套用固定样本。优先使用主流 SaaS/BI 色彩：浅色 white/slate/zinc + indigo/blue/cyan/emerald/amber/rose；深色 slate/navy/neutral + indigo/cyan/emerald/amber/rose。颜色必须服务信息层级、状态和对比。
- 判断设计是否高质量时，优先检查：首屏焦点、KPI 顺序、模块分区、Grid 对齐、数字层级、图表低噪音、标题业务化、口径说明、移动端可读性。

你会收到 designSkillLibrarySelections。必须优先使用这些设计 skill，而不是自由发挥：
- Apple Design Language 是基础层：负责清晰层级、内容优先、熟悉交互、可访问性和克制动效。
- Linear Design 是效率层：负责高密度列表、快捷操作、命令入口、上下文操作、批量处理和状态流转。
- Stripe Dashboard 是可信层：负责强表格、强筛选、清晰状态、严谨格式、高风险确认和数据可追溯。
如果收到多个 design skill，请按场景赋权融合，不要做视觉拼贴：基础层保障体验底线，效率层服务专业工作台，可信层服务数据闭环。
禁止复制 Apple、Linear、Stripe 的品牌视觉、商标、专属组件、具体配色或业务假设；只能抽象原则。

${designReferencePrompt}

只返回 JSON，不要 Markdown。
JSON schema:
{
  "visualStyle": "apple_minimal | executive_premium | operational_command | analytical_editorial",
  "layoutPattern": "executive_overview | kpi_hero_chart | overview_focus_detail | operational_monitoring",
  "density": "comfortable | balanced | dense",
  "designSkillIds": ["apple-design-language"],
  "colorPalette": {
    "background": "#F8FAFC",
    "surface": "#FFFFFF",
    "primary": "#4F46E5",
    "accent": "#06B6D4",
    "success": "#10B981",
    "warning": "#F59E0B",
    "danger": "#F43F5E",
    "text": "#0F172A",
    "muted": "#64748B"
  },
  "typographyScale": {"title": "32px", "sectionTitle": "18px", "body": "14px", "caption": "12px", "numeric": "40px"},
  "cardStyle": {"radius": 18, "shadow": "soft", "border": "rgba(15,23,42,0.08)", "padding": 22},
  "chartStyle": {"gridLine": "subtle", "axis": "minimal", "legend": "compact", "tooltip": "soft", "lineSmooth": true, "barRadius": 10, "donutThickness": "medium"},
  "compositionRules": ["布局规则"],
  "referenceInfluence": ["参考图或设计范式如何影响本次设计"],
  "qualityChecklist": ["首屏重点是否 5 秒可读", "KPI 是否顶部且层级清晰", "图表是否低噪音", "是否有必要的筛选/钻取/明细", "空/错/加载状态是否清楚"]
}`,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            intent: params.intent,
            dataUnderstanding: params.dataUnderstanding,
            dashboardSkill: params.skill,
            designSkillLibrarySelections: params.designSkills,
            blueprint: params.blueprint,
            referenceImageAnalysis: params.imageAnalysis,
            previousReview: params.review,
            preferredTheme: params.theme ?? "system",
            hardConstraints: [
              "Mobile First",
              "KPI first",
              "24px spacing",
              "16px+ card radius",
              "Maximum 5 colors",
              "No gradient background",
              "No 3D charts",
              "No flashy animation",
              "颜色选择采用主流 SaaS/BI palette，不要机械套用固定样本色",
              "浅色优先 white/slate/zinc + indigo/blue/cyan/emerald/amber/rose；深色优先 slate/navy/neutral + indigo/cyan/emerald/amber/rose",
              "服务/产品/内容/基建运营看板优先使用 compact operations 信息密度，但是否 dark 由用户偏好、场景和可读性决定",
              "高质量优先级：信息层级 > Grid 对齐 > 图表可读性 > 颜色细节 > 动效",
              "必须在 designSkillIds 中写入实际采用的 design skill id",
              "必须输出 qualityChecklist，覆盖信息层级、Grid、KPI、图表、Typography、移动端、状态处理、可追溯明细",
              "BI 看板必须优先保证指标可读、口径清楚、明细可追溯，再考虑视觉高级感",
              "必须让 Renderer 能执行，不要输出抽象审美词汇而无具体 token",
            ],
          },
          null,
          2,
        ),
      },
    ],
  });
}
