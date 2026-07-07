# ArtifactDash

AI Native Dashboard Agent Platform for generating decision-ready dashboard artifacts from natural language and datasets.

ArtifactDash is not a traditional BI builder. Users describe business intent, upload a dataset, and the system runs an agent workflow to understand the goal, analyze the dataset, plan the dashboard, generate an HTML artifact, and review its quality.

## Product Philosophy

Everything is generated. Everything is an Artifact.

ArtifactDash optimizes for generation instead of manual configuration. It does not aim to become a drag-and-drop dashboard builder, widget editor, SQL builder, or traditional BI modeling tool.

## Core Workflow

```text
User Intent
  -> Intent Understanding
  -> Dataset Understanding
  -> Dashboard Planning
  -> Design Application
  -> Artifact Generation
  -> Quality Review
```

The system intentionally avoids a direct `User Request -> LLM -> HTML` flow. Dashboard generation is decomposed into explicit agents, services, skills, prompts, and review steps.

## Features

- Natural language dashboard generation.
- Dataset upload and metadata extraction from spreadsheet files.
- Multi-agent dashboard workflow:
  - Intent Agent
  - Data Agent
  - Skill Selector
  - Preference Agent
  - Skill Optimizer Agent
  - Planner Agent
  - Builder Agent
  - Review Agent
- Versioned dashboard artifacts saved as standalone HTML.
- Artifact metadata, blueprint, review result, and workflow trace persistence.
- Dashboard preview, dataset view, artifact history, and settings pages.
- Backend-only LLM calls through a provider service abstraction.

## Architecture

```text
app/          Next.js routes, pages, and API endpoints
components/   User interaction, upload, chat, preview, and UI shell
agents/       Intent, data, planning, building, preference, and review agents
services/     Dashboard workflow and model provider integration
skills/       Dashboard domain skills and skill selection
prompts/      System prompts for dashboard generation
lib/          Dataset parsing, file storage, types, and prompt helpers
docs/         Product and system specification documents
```

Frontend code is responsible for user interaction, file upload, chat UI, and preview. AI workflow logic belongs in `agents/`, `services/`, `skills/`, and `prompts/`.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- XLSX
- DeepSeek-compatible chat completions API

## Getting Started

### Requirements

- Node.js
- npm
- An LLM API key compatible with the configured chat completions endpoint

### Install

```bash
npm install
```

### Configure Environment

Create a local environment file:

```bash
cp .env.example .env.local
```

If `.env.example` does not exist yet, create `.env.local` manually:

```bash
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

`LLM_API_KEY` is required. `LLM_BASE_URL` and `LLM_MODEL` are optional and default to DeepSeek-compatible settings.

Legacy variable names are also supported:

```bash
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### Run Development Server

```bash
npm run dev
```

Open the local Next.js URL printed by the dev server.

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm run start
```

### Check Code

```bash
npm run lint
npm run typecheck
```

## Generated Artifacts

Uploaded dataset metadata is stored under `uploads/`.

Generated dashboard artifacts are stored under `artifacts/` with versioned outputs:

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

Each generated dashboard is treated as an artifact, not as a manually edited dashboard configuration.

## Dashboard Design Principles

Generated dashboards should be:

- Apple inspired
- Minimal
- Professional
- Responsive
- Mobile first
- KPI first
- Based on 24px spacing
- Based on 16px card radius
- Limited to a maximum of 5 colors
- Free of gradient backgrounds
- Free of 3D charts

## Development Principles

- Keep LLM calls in the backend.
- Never expose API keys to frontend code.
- Use service abstractions for model providers.
- Keep business workflow logic out of React components.
- Prefer generated artifacts over manual dashboard configuration.
- Preserve the workflow trace so artifacts can be reviewed and improved.

## Documentation

See `docs/` for the product vision, system architecture, dataset semantic layer, artifact specification, and deployment notes.

