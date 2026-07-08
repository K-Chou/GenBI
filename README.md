# GenBI

GenBI 是一个 AI 原生 Dashboard Agent 平台，用于通过自然语言和数据集生成可决策的看板 Artifact。

它不是传统 BI 工具。用户只需要描述业务目标并上传数据集，系统会通过 Agent 工作流完成意图理解、数据理解、看板规划、Artifact 生成和质量检查。

## 产品理念

一切都是生成的。一切都是 Artifact。

GenBI 优先优化“生成体验”，而不是“手动配置体验”。项目不面向拖拽式看板搭建、组件编辑器、SQL 构建器或传统 BI 建模。

## 核心流程

```text
用户意图
  -> 意图理解
  -> 语义模型构建
  -> 底表数据理解
  -> 指标体系规划
  -> 指标口径契约
  -> Dashboard Blueprint
  -> Design Skill / DesignSpecification
  -> DashboardDocument 生成
  -> 真实数据映射校验
  -> 质量 Review
  -> Artifact 保存
```

系统不会采用简单的 `用户请求 -> LLM -> HTML` 路径，而是先生成可校验、可修复的 `DashboardDocument`，再由渲染层转换成 Tailwind + ECharts 的 Dashboard Artifact。

## 功能特性

- 通过自然语言生成业务看板。
- 支持上传表格文件并提取数据集元信息。
- 支持通过飞书多维表格链接在线抽取 Dataset。
- 内置多 Agent 看板生成工作流。
- 根据业务意图选择并优化 Dashboard Skill。
- 生成版本化的 Dashboard Bundle Artifact：`dashboard.json` 负责数据口径和结构，`index.html` 负责最终视觉展示。
- 保存 Artifact 的元信息、Blueprint、Review 结果和 Workflow Trace。
- 时间线支持点击查看每个 Agent / 阶段的输入、输出、耗时和 checkpoint。
- 支持中断后基于保留的会话与 Workflow Trace 继续生成。
- 支持在设置页管理 OpenAI-compatible 模型连接和分阶段模型配置。
- 提供看板预览、数据集列表、Artifact 历史和设置页面。
- LLM 调用只发生在后端，并通过服务抽象接入模型提供商。

## 工作流 Agent

- `Intent Agent`：理解用户目标、业务场景、受众和约束。
- `Semantic Model`：本地构建字段语义、可聚合性、指标候选和数据风险。
- `Data Agent`：分析数据集字段、指标、维度和可用分析方式，简单场景走本地快速路径。
- `Skill Selector`：根据意图匹配合适的 Dashboard Skill。
- `Preference Agent`：总结用户偏好并形成偏好记忆。
- `Skill Optimizer Agent`：基于偏好优化当前 Skill。
- `Metric System Agent`：先生成专家指标体系，再绑定真实可执行口径。
- `Metric Contract Agent`：确定可计算指标、维度和字段契约。
- `Planner Agent`：生成 Dashboard Blueprint 和信息层级。
- `Designer Agent`：结合 Apple、Linear、Stripe 等 Design Skill 生成 DesignSpecification。
- `Builder Agent`：根据 Blueprint 生成 DashboardDocument JSON Artifact。
- `Deterministic Validator`：校验字段引用、指标契约和真实 rows 聚合结果。
- `Review Agent`：检查数据、BI、设计和技术质量。

## 项目结构

```text
app/          Next.js 页面、路由和 API
components/   用户交互、上传、聊天、预览和应用外壳
agents/       意图、数据、规划、生成、偏好和审查 Agent
services/     Dashboard 工作流和模型服务集成
skills/       Dashboard 领域 Skill 与选择逻辑
design-skills/ Apple、Linear、Stripe 等可组合 Design Skill
prompts/      Dashboard 生成相关系统提示词
lib/          数据集解析、文件存储、类型和 Prompt 工具
docs/         系统规格文档
```

前端只负责用户交互、文件上传、聊天 UI 和预览。AI 工作流逻辑应放在 `agents/`、`services/`、`skills/` 和 `prompts/` 中。

## 技术栈

- Next.js
- React
- TypeScript
- Tailwind CSS
- XLSX
- ECharts
- OpenAI-compatible Chat Completions API

## 快速开始

### 环境要求

- Node.js
- npm
- 可用于 OpenAI-compatible Chat Completions API 的 LLM API Key

### 安装依赖

```bash
npm install
```

### 配置模型连接

LLM 配置不再从 `.env.local` 读取。请启动应用后进入 `设置` 页面，填写并保存：

```text
Base URL: 你的 OpenAI-compatible 网关地址
Model: 生成链路默认模型
API Key: 你的模型 API Key
Timeout ms: 600000
```

保存后配置会写入本地服务端文件：

```text
settings/llm.json
```

该文件已被 `.gitignore` 忽略，不应提交到仓库。

推荐模型组合：

```text
默认 / Builder / Presentation: hypergryph/deepseek-v3.2
Fast / Intent / Repair: hypergryph/qwen3.5
Review: vertex_ai/claude-sonnet-4-6
```

如果需要使用飞书多维表格在线抽取，请额外配置：

```bash
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
```

飞书应用需要具备读取对应多维表格的权限。

### 启动开发环境

```bash
npm run dev
```

启动后打开终端输出的本地 Next.js 地址。

如果需要使用 80 端口：

```bash
npm run dev -- --port 80
```

然后访问：

```text
http://localhost
```

### 构建

```bash
npm run build
```

### 启动生产服务

```bash
npm run start
```

### 代码检查

```bash
npm run lint
npm run typecheck
```

## Artifact 存储

上传后的数据集元信息会存储在 `uploads/`。

长期偏好记忆会存储在 `preferences/`。

应用内模型配置会存储在 `settings/llm.json`。

生成后的 Dashboard Artifact 会按数据集和版本存储在 `artifacts/`：

```text
artifacts/
  <dataset-id>/
    v1/
      dashboard.json
      index.html
      manifest.json
      metadata.json
      blueprint.json
      metric-system.json
      design-spec.json
      review.json
      workflow.json
```

每个生成结果都是一个 Artifact Bundle，而不是一份需要用户手动维护的看板配置。后续对话修改优先 patch `dashboard.json`，再同步刷新 `index.html`。

## Dashboard 设计原则

生成的看板应遵循：

- Apple inspired，必要时融合 Linear Design 和 Stripe Dashboard 的设计原则。
- Minimal、Professional、Responsive、Mobile first。
- KPI first，核心指标优先放在首屏。
- 24px spacing，卡片圆角默认 16px，阴影极浅。
- 最多 5 种核心颜色，图表颜色克制且语义明确。
- 趋势默认折线图，分类默认柱状图，占比默认环图。
- 不使用 3D 图表、渐变背景和花哨动画。
- Dashboard 设计必须服务业务决策，不做纯装饰型视觉。

## 开发原则

- LLM 调用必须发生在后端。
- 不要在前端暴露 API Key。
- 使用服务抽象接入模型提供商。
- 模型连接配置只通过设置页管理，不依赖 `.env.local`。
- 不要把业务工作流逻辑写进 React 组件。
- 优先生成 Artifact，而不是实现手动配置看板。
- 保留 Workflow Trace，方便审查和持续优化。

## 文档

系统规格见 `docs/AI_DASHBOARD_AGENT_SYSTEM_SPEC.md`。

