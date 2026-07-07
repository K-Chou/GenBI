# AI Dashboard Agent System Specification

Version: MVP Architecture v2

---

# 1. Product Definition


## Product Identity


This project is an AI Native Dashboard Agent Platform.


It is NOT a traditional BI system.


The product acts as:


- BI Consultant
- Data Analyst
- Dashboard Designer
- Frontend Engineer


The user describes business intent.

The AI understands, plans, designs and generates dashboards.



## Core Philosophy


Everything is generated.

Everything is an Artifact.



Traditional BI:


```
User configures dashboard

↓

Charts

↓

Report
```


AI Dashboard:


```
User expresses business intent

↓

AI understands

↓

AI generates Dashboard Artifact

```


---

# 2. Product Goal


Enable users to create professional business dashboards through natural language.


Example:


User:

```
帮我生成销售经营驾驶舱
```


AI:

```
理解业务目标

分析数据

匹配行业经验

设计Dashboard方案

生成Dashboard

持续优化
```


---

# 3. Core Architecture


The system follows AI BI Consultant Workflow.


```
User

↓

Conversation Layer

↓

Dashboard Agent Workflow

↓

Intent Agent

↓

Dataset Semantic Agent

↓

Skill Selector

↓

Dashboard Planner

↓

Designer Agent

↓

Builder Agent

↓

Review Agent

↓

Artifact Store

↓

Dashboard Preview

```


---

# 4. Agent Workflow


## 4.1 Intent Agent


Purpose:


Understand user intention.


Input:

User natural language.


Output:


```json
{
"domain":"sales",

"audience":"executive",

"goal":"performance analysis",

"dashboard_type":"sales_dashboard"

}
```


Responsibilities:


Identify:

- Business domain
- User role
- Analysis purpose
- Dashboard type


---

## 4.2 Dataset Semantic Agent


Purpose:


Understand uploaded or connected data.


Dataset sources:


MVP:

- Excel
- CSV


Future:

- API
- Database
- Real-time stream


The AI should understand business meaning, not only column names.


Example:


```json
{
"name":"sales_amount",

"type":"number",

"businessMeaning":"销售金额",

"semanticRole":"metric",

"analysisHints":[
"trend",
"comparison"
]

}
```


Dataset Semantic Layer replaces traditional BI semantic modeling.


---

## 4.3 Skill Selector


Purpose:


Select business expertise.


Skill is NOT a prompt.


Skill contains:


```
Business Knowledge

+

KPI Rules

+

Chart Rules

+

Layout Rules

+

Design Rules

+

Prompt Extension

```


Example:


Sales Dashboard Skill:


Business Rules:


Must analyze:


- Revenue
- Growth
- Region
- Product
- Profit



Visualization Rules:


Trend:

Line Chart


Ranking:

Bar Chart


Contribution:

Donut Chart



---

# 5. Dashboard Planner Agent


Purpose:


Act as senior BI consultant.


Generate Dashboard Blueprint.


Example:


```json
{

"type":"Executive Sales Dashboard",


"sections":[


{

"name":"KPI",

"components":[

"Revenue",

"Profit",

"Growth"

]

},


{

"name":"Trend",

"chart":"line"

},


{

"name":"Region",

"chart":"bar"

}


]

}

```


Blueprint is the bridge between AI reasoning and HTML generation.


---

# 6. Designer Agent


Purpose:


Apply design system.


Design principles:


## Style

Apple inspired:

- Minimal
- Professional
- Elegant


## Layout

Rules:


- Mobile First
- Responsive
- KPI first
- 24px spacing


## Card


- 16px radius
- Light shadow
- Clean whitespace


## Color


- Maximum 5 colors
- No gradient background


## Charts


Allowed:


- Line chart
- Bar chart
- Donut chart


Forbidden:


- 3D charts
- Excessive animation
- Decorative effects


---

# 7. Builder Agent


Purpose:


Generate Dashboard Artifact.


Input:


```
Intent

+

Dataset Understanding

+

Skill

+

Blueprint

+

Design Specification

```


Output:


```
index.html

metadata.json

manifest.json

blueprint.json

workflow.json

review.json

```


HTML requirements:


- TailwindCSS CDN
- Apache ECharts CDN
- Inter font
- Responsive
- Dark mode support
- iframe compatible


---

# 8. Review Agent


Purpose:


Quality validation.


Check:


## Data

- Correct metrics
- Correct dimensions
- No invented data


## BI

- Appropriate visualization
- Logical hierarchy


## Design

- Consistent style
- Responsive


## Technical

- HTML valid
- JS works


Output:


```json
{
"score":92,

"approved":true,

"issues":[]

}

```


---

# 9. Artifact System


Dashboard is not configuration.


Dashboard is generated artifact.


Structure:


```
artifacts/


datasetId/


v1/

index.html

metadata.json

manifest.json

blueprint.json

workflow.json

review.json


v2/

...

```


Every modification creates a new version.


Example:


```
V1:

Generate sales dashboard


V2:

Use Apple style


V3:

Add profit analysis

```


---

# 10. Conversation Experience


The system should not expose technical agents.


Do not show:


```
Running Intent Agent

Running Builder Agent
```


Show:


```
正在理解你的业务目标

正在分析你的数据

正在匹配分析方案

正在设计Dashboard结构

正在生成页面

正在质量检查
```


---

# 11. Conversation Progress Layer


Architecture:


```
Workflow Event

↓

Event Translator

↓

User Friendly Message

↓

Streaming UI

```


Workflow events:


```json
{
"type":"progress",

"stage":"data_analysis",

"message":"正在分析你的数据结构"

}
```


---

# 12. Streaming Experience


Do not:


```
等待30秒

↓

显示结果

```


Use:


```
用户请求

↓

Workflow启动

↓

实时推送进度

↓

生成Artifact

↓

刷新Preview

```


Recommended:


Server Sent Events (SSE)



---

# 13. User Confirmation Flow


The AI should not always immediately generate.


For complex scenarios:


AI:


```
我分析你的销售数据。


建议生成：

CEO销售驾驶舱


包含：

KPI

趋势

区域

产品


是否生成？
```


User:


```
生成

```


Then Builder starts.



---

# 14. Code Architecture


Recommended:


```
agents/

intent-agent.ts

data-agent.ts

planner-agent.ts

designer-agent.ts

builder-agent.ts

review-agent.ts



skills/

sales.ts

finance.ts

common-dashboard.ts



workflow/

orchestrator.ts

events.ts

event-translator.ts



services/

llm.ts

artifact-store.ts

dataset-service.ts


```


Frontend should only handle:


- User interaction
- Upload
- Chat
- Preview



Never put business logic into React components.



---

# 15. Deployment Principle


The product must run independently after deployment.


Cursor is only a development tool.


Production:


```
Browser

↓

Frontend

↓

Backend API

↓

Agent Workflow Engine

↓

LLM Provider

↓

Artifact Storage

```


API Key:


Backend only.


Use:


```
DEEPSEEK_API_KEY
```


Never expose secrets to frontend.



---

# 16. Development Rules


Always prioritize:


1. Dashboard quality

2. Business understanding

3. Agent workflow

4. Simple architecture

5. Maintainability


Avoid:


- Traditional BI builder
- Drag and drop
- Widget configuration
- Manual chart editing


---

# Final Vision


The product is:


Not:

"AI generates charts."


It is:


"An AI BI consultant that understands business goals, analyzes data, designs dashboards and produces decision-ready artifacts."