# KPI Accountability Dashboard — Design Spec

## Context

Social Native take-home project: build a dashboard that demonstrates agentic AI generating synthetic employee data, extracting KPIs, and flagging accountability gaps. The deliverable is a working dashboard deployed via Docker on a VPS with a URL, plus a short writeup on tools/approach.

## Architecture

**Three-stage agentic pipeline (GPT via OpenAI API):**

1. **Generation Stage**: Read employee profiles from `synthetic_data.json` (name, role, KPIs, writing style, hidden truth). Call GPT for each employee to generate 5 daily standup updates (Mon–Fri). Store in SQLite.
2. **Extraction Stage**: For each employee, send their 5 generated updates + KPI targets to GPT. GPT returns structured KPI data only: actuals vs targets, submission rate. Store in SQLite. **Important: do NOT pass hidden_truth to this or the next stage — the agent must rediscover gaps from the data alone.**
3. **Reasoning Stage**: For each employee, send the extracted KPI data + submission rate to GPT. GPT reasons over the structured data to assign a flag_type and produce a narrative summary + detail. Store in SQLite.

This three-stage split makes the pipeline visibly agentic in the UI: "Generating updates → Extracting KPIs → Reasoning about accountability → Complete."

**Startup behavior**: Ship with a pre-seeded `data.db` in the Docker volume (generated once during development) so the dashboard loads instantly on cold start. "Run Analysis" button is the live demo moment — re-runs all three stages and overwrites. Auto-run only triggers as a safety net if the DB is truly empty (no seeded data found).

**Progress tracking**: `pipeline_runs` table tracks stage + status. Frontend polls `/api/pipeline/status` every 2s during active runs.

**Concurrency guard**: `POST /api/pipeline/run` returns 409 if a run is already in progress. Prevents credit burn and state corruption from button spam.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 6 + Jotai (state) + React Router 7 |
| Backend | Flask 3.0 + Gunicorn |
| AI | OpenAI API (gpt-4o-mini) |
| Database | SQLite |
| Infra | Docker Compose + Nginx (Alpine) |
| Styling | Pure CSS + CSS variables (CRM 2.5 pattern) |

Reference codebase for patterns: `C:\Users\cchen\CRM 2.5`

## Data Model

```sql
employees
  id TEXT PRIMARY KEY
  name TEXT
  role TEXT
  manager TEXT
  kpis JSON        -- [{name, target, unit}]
  writing_style TEXT
  hidden_truth TEXT

pipeline_runs
  id INTEGER PRIMARY KEY AUTOINCREMENT
  started_at TIMESTAMP
  completed_at TIMESTAMP
  status TEXT       -- pending / generating / extracting / reasoning / complete / error
  stage TEXT        -- generation / extraction / reasoning
  error TEXT
  total_tokens INTEGER  -- sum of all GPT calls in this run
  total_cost_cents REAL -- estimated cost based on model pricing

generated_updates
  id INTEGER PRIMARY KEY AUTOINCREMENT
  employee_id TEXT REFERENCES employees(id)
  day TEXT          -- monday, tuesday, etc.
  content TEXT
  pipeline_run_id INTEGER REFERENCES pipeline_runs(id)

kpi_extractions
  id INTEGER PRIMARY KEY AUTOINCREMENT
  employee_id TEXT REFERENCES employees(id)
  kpi_name TEXT
  target TEXT
  actual TEXT
  delta TEXT
  status TEXT       -- on_track / at_risk / missing
  pipeline_run_id INTEGER REFERENCES pipeline_runs(id)

analysis_results
  id INTEGER PRIMARY KEY AUTOINCREMENT
  employee_id TEXT REFERENCES employees(id)
  flag_type TEXT    -- none / optimism_gap / submission_gap / vanity_metrics / no_progress / other
  flag_label TEXT   -- human-readable label, especially for flag_type="other" (e.g. "Escalation Avoidance")
  summary TEXT      -- 2-line summary for card
  detail TEXT       -- full narrative analysis
  recommended_action TEXT -- CEO-level next step (e.g. "Schedule a 1:1", "Audit client health", "Automate the data source")
  submission_rate TEXT -- e.g. "3/5"
  pipeline_run_id INTEGER REFERENCES pipeline_runs(id)
```

## API Endpoints

```
POST /api/pipeline/run          — trigger full three-stage pipeline (returns 409 if already running)
GET  /api/pipeline/status       — current run stage + status (polled by frontend)
GET  /api/employees             — all employees with latest analysis + flag
GET  /api/employees/<id>        — employee detail: updates, KPIs, analysis
GET  /api/pipeline/last-run     — metadata (timestamp, duration, tokens, cost_cents)
```

## Frontend

### Views

**Dashboard (`/`)**
- Header: "Lumen Collective — KPI Accountability Dashboard" + last run timestamp
- "Run Analysis" button with live progress bar (stage labels: "Generating updates..." → "Extracting KPIs..." → "Reasoning about accountability..." → "Complete"). Button disabled while pipeline is running.
- 5 employee cards in a grid:
  - Name, role
  - Flag badge (green = none, yellow = at_risk, red = flagged)
  - Flag type label (e.g. "Submission Gap", "Vanity Metrics")
  - Submission rate (e.g. "3/5 days")
  - 2-line AI summary
  - Recommended action (one-liner)
  - Click → navigates to detail
- Run metadata footer: tokens used, estimated cost (cents), duration — shows AI cost-efficiency at a glance

**Employee Detail (`/employees/:id`)**
- Back button to dashboard
- Employee header: name, role, flag badge
- KPI table: KPI name | Target | Actual | Delta | Status
- Submission calendar: Mon–Fri grid (filled = submitted, empty = missed)
- Full AI analysis narrative
- Week of updates: accordion/timeline, one per submitted day

### State (Jotai atoms)
- `employeesAtom` — list with latest analysis
- `pipelineStatusAtom` — current run state
- `selectedEmployeeAtom` — detail view data

### Styling
- Pure CSS + CSS custom properties (no Tailwind, no component library)
- Dark/light theme toggle via `data-theme` attribute
- Font: Plus Jakarta Sans + JetBrains Mono
- Color-coded status badges (green/yellow/red)

## Infrastructure

**Docker Compose:**
```yaml
services:
  app:
    # Multi-stage: Node 22-slim builds React, Python 3.13-slim runs Flask
    ports: ["5000:5000"]
    volumes: [sqlite_data:/app/data]
    env_file: .env

  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    # Proxies /api/* → app:5000, serves /dist static files
```

**Environment (`.env`):**
```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
FLASK_SECRET_KEY=...
```

## GPT Prompt Design

**Generation prompt** (per employee):
```
You are generating realistic daily end-of-day Slack standup updates for {name},
a {role} at Lumen Collective (Series C UGC marketplace, 180 employees).

Writing style: {writing_style}
KPIs: {kpis}
Hidden truth to embed subtly: {hidden_truth}

Generate 5 daily updates (Monday through Friday). Each update should:
- Match the writing style exactly
- Reference these brand clients naturally: Unilever, Adidas, L'Oréal, Crocs, Nestlé
- Embed the hidden truth subtly — don't make it obvious
- Include realistic metrics that trend according to the hidden truth

Return JSON: [{day, content}]
```

**Extraction prompt** (per employee — Stage 2):
```
You are a data extraction agent. Parse these daily standup updates and extract
structured KPI performance data. Do not interpret or judge — just extract.

Employee: {name} ({role})
KPI targets: {kpis}
Updates: {updates}

Extract:
1. For each KPI: what metric values can you find in the updates? Compare to target.
2. Submission compliance: which days (Mon-Fri) have an update, which are missing?

Return JSON:
{
  kpis: [{name, target, actual, delta, status}],
  submission_rate: "X/5",
  days_submitted: ["monday", "tuesday", ...]
}
```

**NOTE: hidden_truth is NOT passed to this prompt or the reasoning prompt.
The agent must rediscover accountability gaps from the data alone.**

**Reasoning prompt** (per employee — Stage 3):
```
You are an AI operations analyst. You have been given structured KPI data
extracted from an employee's weekly standup updates. Reason about what
this data reveals about the employee's performance and accountability.

Employee: {name} ({role})
Extracted KPI data: {kpi_extractions}
Submission rate: {submission_rate}
Raw updates (for context): {updates}

Look for patterns like:
- Optimistic language masking declining metrics
- High activity metrics but declining outcome metrics
- Repeated blockers without escalation
- Irregular submission cadence
- Any other accountability gap you observe

Return JSON:
{
  flag_type: "none|optimism_gap|submission_gap|vanity_metrics|no_progress|other",
  flag_label: "Human-readable label (required if flag_type is 'other')",
  summary: "2-line summary for dashboard card",
  detail: "3-5 paragraph analysis with evidence from the data",
  recommended_action: "One specific CEO-level next step (e.g. 'Schedule a 1:1 to review renewal pipeline', 'Audit Adidas UGC delivery health', 'Automate standup submission tracking')"
}
```

## Directory Structure

```
SN/
├── api/
│   ├── app.py              — Flask factory + startup pipeline trigger
│   ├── config.py           — env config
│   ├── models.py           — SQLAlchemy models
│   ├── pipeline.py         — three-stage GPT pipeline (generate + extract + reason)
│   ├── openai_client.py    — OpenAI API wrapper
│   └── routes/
│       ├── employees.py    — employee list + detail endpoints
│       └── pipeline.py     — pipeline trigger + status endpoints
├── src/
│   ├── App.jsx             — routes
│   ├── main.jsx            — entry point
│   ├── index.css           — global styles + CSS variables
│   ├── components/
│   │   ├── EmployeeCard.jsx
│   │   ├── KpiTable.jsx
│   │   ├── SubmissionCalendar.jsx
│   │   ├── AnalysisDetail.jsx
│   │   ├── PipelineControl.jsx
│   │   └── UpdateTimeline.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   └── EmployeeDetail.jsx
│   └── lib/
│       ├── api/
│       │   ├── employees.js
│       │   └── pipeline.js
│       └── store/
│           ├── employees.js
│           └── pipeline.js
├── synthetic_data.json     — employee profiles (input to pipeline)
├── data/
│   └── data.db             — pre-seeded SQLite (committed, used on cold start)
├── nginx/
│   └── nginx.conf
├── Dockerfile              — multi-stage (Node + Python)
├── docker-compose.yml
├── package.json
├── requirements.txt
├── .env
├── Project_Overview.txt
└── SyntheticData_Instructions.txt
```

## Verification

1. `docker compose up --build` — app starts, loads pre-seeded data.db, dashboard is immediately available
2. Visit `http://localhost` — dashboard loads with 5 employee cards from seeded data, each showing flag badge + summary
3. Click an employee card → detail view shows KPIs, submission calendar, full analysis, and generated updates
4. Click "Run Analysis" → progress bar animates through 3 stages ("Generating updates..." → "Extracting KPIs..." → "Reasoning about accountability..." → "Complete") → dashboard refreshes with fresh GPT-generated data
5. Click "Run Analysis" again while running → button is disabled, POST returns 409
6. Verify each employee's flag type is reasonable given their updates (agent may discover different patterns than expected — flag_type="other" is valid)
7. Verify hidden_truth is never passed to extraction or reasoning prompts (check pipeline.py)
