# Pipeline Page Design

## Context

The KPI Accountability Dashboard currently embeds the pipeline control (3-stage agentic workflow) directly into the Dashboard page. This design extracts it into a dedicated `/pipeline` page to give the agentic workflow more visual weight and clarity, aligning with the project deliverable requirement to demonstrate "agentic extraction and analysis."

The Dashboard (`/`) remains the landing page showing results. The Pipeline page (`/pipeline`) is the "watch the AI work" experience.

## Navigation

A shared top nav bar across all pages:
- Left: app logo + title ("KPI Accountability Dashboard")
- Right: two nav links — **Dashboard** and **Pipeline**
- Active page highlighted with accent-color underline
- Rendered in `App.jsx` above the `<Routes>`, using `NavBar.jsx`

On the Dashboard, the PipelineControl card is replaced with a small inline banner: "Run the agentic pipeline to refresh analysis" with a "Go to Pipeline" link.

## Pipeline Page Layout

Three vertically stacked sections:

### Header
Title "Agentic Analysis Pipeline" + subtitle explaining the three-agent architecture. Matches dashboard header styling.

### Stage Cards
The existing 3-column grid from PipelineControl.jsx — Generate Standups, Extract KPIs, Flag Accountability. Each card has a numbered step indicator, description, and run/locked/complete button. Stage logic unchanged.

### Output Previews
Below the stage cards, a preview panel appears after each stage completes. Three sections that populate as stages finish:

1. **After Generate:** Counter ("5 employees x 5 days = 25 standups generated") + one sample standup per employee in Slack-message style (avatar, name, day, content).

2. **After Extract:** Counter ("15 KPIs extracted across 5 employees") + compact table with one row per employee showing their top KPI: name, target, actual, delta, status badge.

3. **After Reason:** Counter ("5 employees analyzed") + flag summary per employee: name, flag badge, 2-line summary. A "View Full Dashboard" button appears here.

Each preview section animates in when its stage completes. Previews use condensed inline renders, not full existing components.

## Backend

### New Endpoint
`GET /api/pipeline/stage-output/<stage>` — returns lightweight preview data for a completed stage from the current pipeline run.

- `stage=generate` — one sample update per employee (first day's standup): `[{name, role, day, content}]`
- `stage=extract` — one top KPI per employee + submission rate: `[{name, role, kpi_name, target, actual, delta, status, submission_rate}]`
- `stage=reason` — flag summary per employee: `[{name, role, flag_type, flag_label, summary}]`

Returns 404 if the stage hasn't completed yet.

No changes to existing pipeline logic, stage execution, or concurrency guards.

## Frontend Changes

### New Files
- `src/pages/Pipeline.jsx` — pipeline page, composes stage cards + output previews
- `src/components/NavBar.jsx` — shared top nav bar

### Modified Files
- `src/App.jsx` — add NavBar above routes, add `/pipeline` route (lazy-loaded)
- `src/pages/Dashboard.jsx` — remove PipelineControl import, replace with a small "Go to Pipeline" banner
- `src/components/PipelineControl.jsx` — unchanged, imported by Pipeline.jsx instead

### API Client
Add `fetchStageOutput(stage)` to `src/lib/api/pipeline.js`.

### State
No new Jotai atoms. Stage output is fetched on demand after each stage completes.

## File Structure (changes only)

```
src/
  components/
    NavBar.jsx          (new)
  pages/
    Pipeline.jsx        (new)
    Dashboard.jsx       (modified — remove PipelineControl, add banner)
  App.jsx               (modified — add NavBar, add route)
  lib/api/pipeline.js   (modified — add fetchStageOutput)
api/
  routes/pipeline.py    (modified — add stage-output endpoint)
```
