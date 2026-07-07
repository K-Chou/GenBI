# ArtifactDash

ArtifactDash 是一个 AI 原生 Dashboard Agent 平台，用于通过自然语言和数据集生成可决策的看板 Artifact。

它不是传统 BI 工具。用户只需要描述业务目标并上传数据集，系统会通过 Agent 工作流完成意图理解、数据理解、看板规划、Artifact 生成和质量检查。

## 产品理念

一切都是生成的。一切都是 Artifact。

ArtifactDash 优先优化“生成体验”，而不是“手动配置体验”。项目不面向拖拽式看板搭建、组件编辑器、SQL 构建器或传统 BI 建模。

## 核心流程

```text
用户意图
  -> 意图理解
  -> 数据集理解
  -> 看板规划
  -> 设计应用
  -> Artifact 生成
  -> 质量检查
```

系统不会采用简单的 `用户请求 -> LLM -> HTML` 路径，而是把看板生成拆解为明确的 Agent、Service、Skill、Prompt 和 Review 步骤。

## 功能特性

- 通过自然语言生成业务看板。
- 支持上传表格文件并提取数据集元信息。
- 内置多 Agent 看板生成工作流。
- 根据业务意图选择并优化 Dashboard Skill。
- 生成版本化的单文件 HTML Dashboard Artifact。
- 保存 Artifact 的元信息、Blueprint、Review 结果和 Workflow Trace。
- 提供看板预览、数据集列表、Artifact 历史和设置页面。
- LLM 调用只发生在后端，并通过服务抽象接入模型提供商。

## 工作流 Agent

- `Intent Agent`：理解用户目标、业务场景、受众和约束。
- `Data Agent`：分析数据集字段、指标、维度和可用分析方式。
- `Skill Selector`：根据意图匹配合适的 Dashboard Skill。
- `Preference Agent`：总结用户偏好并形成偏好记忆。
- `Skill Optimizer Agent`：基于偏好优化当前 Skill。
- `Planner Agent`：生成 Dashboard Blueprint 和信息层级。
- `Builder Agent`：根据 Blueprint 生成 HTML Artifact。
- `Review Agent`：检查数据、BI、设计和技术质量。

## 项目结构

```text
app/          Next.js 页面、路由和 API
components/   用户交互、上传、聊天、预览和应用外壳
agents/       意图、数据、规划、生成、偏好和审查 Agent
services/     Dashboard 工作流和模型服务集成
skills/       Dashboard 领域 Skill 与选择逻辑
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
- DeepSeek 兼容的 Chat Completions API

## 快速开始

### 环境要求

- Node.js
- npm
- 可用于 Chat Completions API 的 LLM API Key

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境变量示例：

```bash
cp .env.example .env.local
```

也可以手动创建 `.env.local`：

```bash
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

`LLM_API_KEY` 必填。`LLM_BASE_URL` 和 `LLM_MODEL` 可选，默认使用 DeepSeek 兼容配置。

项目也兼容旧变量名：

```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 启动开发环境

```bash
npm run dev
```

启动后打开终端输出的本地 Next.js 地址。

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

生成后的 Dashboard Artifact 会按数据集和版本存储在 `artifacts/`：

```text
artifacts/
  <dataset-id>/
    v1/
      index.html
      manifest.json
      metadata.json
      blueprint.json
      review.json
      workflow.json
```

每个生成结果都是一个 Artifact，而不是一份需要用户手动维护的看板配置。

## Dashboard 设计原则

生成的看板应遵循：

- Apple inspired
- Minimal
- Professional
- Responsive
- Mobile first
- KPI first
- 24px spacing
- 16px card radius
- 最多 5 种颜色
- 不使用渐变背景
- 不使用 3D 图表

## 开发原则

- LLM 调用必须发生在后端。
- 不要在前端暴露 API Key。
- 使用服务抽象接入模型提供商。
- 不要把业务工作流逻辑写进 React 组件。
- 优先生成 Artifact，而不是实现手动配置看板。
- 保留 Workflow Trace，方便审查和持续优化。

## 文档

系统规格见 `docs/AI_DASHBOARD_AGENT_SYSTEM_SPEC.md`。

