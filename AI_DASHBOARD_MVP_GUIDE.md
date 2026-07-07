# AI Dashboard Platform MVP Guide

## 0. Core Product Philosophy

This project is NOT building a traditional BI system.

This project is an AI Native Dashboard Artifact Generator.

The core principle:

> Everything is generated.
> Everything is an Artifact.

Users should never configure dashboards manually.

Users only describe business intent through natural language.

The AI is responsible for:

- Understanding data
- Understanding business questions
- Selecting visualization
- Designing layout
- Generating dashboard
- Iterating through conversation

---

# 1. MVP Goal

Validate the following experience:

```
Upload Excel / CSV

↓

AI understands dataset

↓

User describes dashboard requirement

↓

AI generates beautiful dashboard HTML

↓

User modifies through conversation

↓

AI creates new artifact version
```

The MVP success criteria:

A user can create a professional dashboard within 3 minutes without touching BI configuration.

---

# 2. Product Boundary

## Must NOT become a traditional BI product

Do NOT implement:

- Drag and drop dashboard builder
- Widget editor
- Chart configuration panel
- Layout designer
- SQL editor
- Cube modeling
- Report designer
- Complex permission system

Avoid all concepts that require users to manually construct dashboards.

---

# 3. Architecture Overview

```
                    User

                     |

                Chat Interface

                     |

              Dashboard Agent

                     |

        +------------+------------+

        |                         |

 Dataset Understanding      Design Skills

        |                         |

        +------------+------------+

                     |

            Dashboard Artifact

                     |

        HTML + Metadata + Manifest

                     |

               iframe Preview

```

---

# 4. Core Objects

The system only has three important objects.

---

# Object 1: Dataset

Represents business data.

Sources:

MVP:

- Excel
- CSV


Future:

- API
- Database
- SaaS system
- Real-time stream


Dataset contains:

```
name

columns

data types

sample values

semantic description

sample rows
```

Example:

```json
{
"name":"sales",

"columns":[

{
"name":"amount",
"type":"number",
"description":"销售金额"
},

{
"name":"region",
"type":"category",
"description":"销售区域"
}

]
}
```

Important:

Never send complete files to LLM.

Only send:

- metadata
- sample rows
- user question

---

# Object 2: Dashboard Artifact

Dashboard is NOT a database configuration.

Dashboard is a generated artifact.

Structure:

```
artifacts/

sales-dashboard/

v1/

index.html

metadata.json

manifest.json


v2/

index.html

metadata.json

manifest.json

```

---

## index.html

Requirements:

- Direct browser execution
- Responsive
- Beautiful UI
- Self contained
- iframe compatible

Libraries:

- TailwindCSS CDN
- Apache ECharts CDN
- Inter Font

---

## metadata.json

Stores:

- Dataset
- User request
- Generated time
- Model
- Style

---

## manifest.json

Reserved for future rendering engine.

Example:

```json
{
"type":"executive_dashboard",
"style":"apple",
"charts":[
"trend",
"ranking",
"kpi"
]
}
```

---

# Object 3: Conversation

Conversation drives dashboard evolution.

Example:

```
User:

Generate sales dashboard


AI:

Create Artifact V1


User:

Use Apple style


AI:

Create Artifact V2


User:

Add profit analysis


AI:

Create Artifact V3

```

Conversation history must be stored.

Reason:

User modification behavior becomes future Skill data.

---

# 5. LLM Architecture

## Current Model

DeepSeek API.

Backend manages API Key.

The frontend MUST NOT store API Key.

---

## Configuration

Use:

Environment variable

Example:

```
DEEPSEEK_API_KEY=xxxx
```

Create abstraction:

```
services/llm.ts
```

Future support:

- OpenAI
- Claude
- Gemini
- Local models

---

# 6. Dashboard Generation Flow

```
User Request

↓

Dataset Metadata

↓

Prompt Builder

↓

DeepSeek

↓

HTML Artifact

↓

Validation

↓

Save Version

↓

Preview

```

---

# 7. Prompt Rules

System prompt must enforce:

You are a professional dashboard designer.

Generate only complete HTML.

Do not output:

- Markdown
- Explanation
- Code block

HTML requirements:

- Modern
- Minimal
- Professional
- Responsive
- Apple inspired

---

# 8. Dashboard Design System

All generated dashboards follow these rules.

## Style

Apple inspired.

Characteristics:

- Minimal
- Elegant
- Professional
- Large whitespace


## Layout

Rules:

- Mobile First
- Responsive
- 24px spacing rhythm
- KPI on top


## Cards

Rules:

- 16px radius
- Light shadow
- Clean spacing


## Colors

Rules:

- Maximum 5 colors
- No gradient background


## Charts

Default:

Trend:

Line chart


Category comparison:

Bar chart


Distribution:

Donut chart


Avoid:

- 3D charts
- Excessive animation
- Decorative effects

---

# 9. Pages

Only implement four pages.

---

## Home

Main experience.

Contains:

- Upload file
- Chat
- Dashboard preview


---

## Dataset

Display:

- Dataset list
- Columns
- Sample rows


---

## Artifact

Display:

- Generated versions
- Preview
- Download HTML


---

## Settings

Display:

- System configuration

Do NOT ask users for API Key.

---

# 10. Storage Strategy

MVP does not use database.

Use local filesystem.

```
uploads/

datasets/


artifacts/

dashboard versions/


conversations/

sessions/

```

Future can migrate to:

- PostgreSQL
- Object Storage
- Vector Database

---

# 11. Validation

Before saving artifact:

Check:

- HTML exists
- ECharts loaded
- Responsive layout exists
- KPI section exists
- No obvious generation errors


---

# 12. Technology Stack

Frontend:

- Next.js App Router
- TypeScript
- TailwindCSS


Backend:

- Next.js API Routes


Libraries:

- xlsx
- lucide-react


Visualization:

- Apache ECharts


AI:

- DeepSeek OpenAI Compatible API


---

# 13. Development Principle

Prioritize:

1. Generated dashboard quality

2. Simple architecture

3. Maintainability

4. AI experience


Do NOT prioritize:

- Feature completeness
- Traditional BI compatibility
- Configuration flexibility


---

# Final Statement

The product is not:

"AI assisted BI"

The product is:

"AI generated Dashboard Artifact Platform"


Traditional BI:

```
User builds dashboard
```

AI Dashboard:

```
User describes intention

AI generates artifact
```

Everything is generated.

Everything is an Artifact.