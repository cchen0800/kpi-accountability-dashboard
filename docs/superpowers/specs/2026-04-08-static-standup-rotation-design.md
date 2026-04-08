# Static Standup Rotation — Design Spec

## Summary

Replace the GPT-powered Stage 1 (standup generation) with 6 pre-written standup sets that rotate each pipeline run. Stages 2 (extraction) and 3 (reasoning) remain AI-powered. This eliminates the OpenAI dependency for generation, makes the demo free to run repeatedly, and produces more consistent input for the agentic analysis stages.

## Data Structure

`synthetic_data.json` changes:

- The existing `"updates"` array is migrated into `"standup_sets"[0]` and removed.
- A new top-level `"standup_sets"` key holds an array of 6 sets.
- Each set is an array of objects: `{ "employee_id": "emp_001", "day": "monday", "text": "..." }`.

```json
{
  "company": { ... },
  "employees": [ ... ],
  "standup_sets": [
    [ { "employee_id": "emp_001", "day": "monday", "text": "..." }, ... ],
    [ ... ],
    [ ... ],
    [ ... ],
    [ ... ],
    [ ... ]
  ]
}
```

## Rotation Logic

When Stage 1 runs:

```python
num_sets = len(standup_sets)
set_index = PipelineRun.query.filter_by(status='complete').count() % num_sets
```

Each successive run picks the next set. After 6 runs it cycles back.

## Pipeline Code Changes

### `_run_generate_stage()`

Replace the current implementation (GPT calls + ThreadPoolExecutor + validation/retry) with:

1. Load `synthetic_data.json` and read `standup_sets`.
2. Compute `set_index` from completed run count.
3. Filter the selected set by employee, insert `GeneratedUpdate` rows.
4. Return `(0, 0)` for token counts (no API call).

### Dead Code Removal

Remove these functions (only used by Stage 1 generation):

- `_generate_updates()`
- `_validate_generated_updates()`
- `_repair_generated_updates()`
- `_infer_expected_submission_days()`
- `_normalize_generated_updates()`
- `_contains_week_total_language()`

Keep all Stage 2/3 functions, `openai_client` import, and cost tracking infrastructure.

### Status Flow

No change. Stage 1 still sets `run.status = 'generating'` and `run.stage = 'generation'`, then transitions to `stage_generate_done`. The frontend polling behavior is unchanged — Stage 1 just completes instantly.

## Standup Content — 6 Sets with Varying Performance

Each employee's performance varies across weeks so the AI flags differ per run.

### Adam Ankeny (emp_001) — Creator Ops Associate
KPIs: 25 creators/week, <24hr response time

| Set | Performance | Notes |
|-----|------------|-------|
| 1 | High performer | Exceeds all targets. Clean week. (Existing data) |
| 2 | Slight dip | Response time creeps to 22hr, onboarding still solid |
| 3 | Rough patch | Platform outage causes onboarding backlog, misses daily targets Tue-Wed, recovers |
| 4 | Strong rebound | Overperforms after prior week, clears backlog |
| 5 | Mixed | Onboarding strong but response time consistently above 20hr |
| 6 | Peak week | Personal best numbers, everything clicking |

### Avery Holmseth (emp_002) — Client Success Manager
KPIs: Renew 4 enterprise accounts/quarter, 15% expansion revenue

| Set | Performance | Notes |
|-----|------------|-------|
| 1 | Optimism gap | Updates sound great but Northwind stalled, Petalcrest concerned. (Existing data) |
| 2 | Genuine progress | Actually closes Northwind renewal, Petalcrest expansion moving |
| 3 | Mixed signals | One renewal signed, another going dark. Optimistic language masks the loss |
| 4 | Strong week | Two accounts renewed, expansion conversations concrete with numbers |
| 5 | Stalling again | Different accounts, same pattern — "almost there" language, no closes |
| 6 | Worst week | Account churns, expansion deal falls through, updates still spin positive |

### Sean Cretti (emp_003) — Performance Marketing Analyst
KPIs: Reduce CAC 20%, 3 experiments/week

| Set | Performance | Notes |
|-----|------------|-------|
| 1 | Submission gap | Skips Tue/Wed, numbers solid. (Existing data) |
| 2 | Full submission | Posts all 5 days, numbers are mediocre — CAC flat |
| 3 | Skips Mon + Tue | Different skip pattern, experiments strong |
| 4 | All days, strong | Best week — full cadence, CAC down, experiments exceeding target |
| 5 | Skips Wed only | 4 days posted, one experiment underperforms |
| 6 | Submission collapse | Only posts Mon and Fri, numbers still decent but major cadence issue |

### Jeff Collard (emp_004) — Sales Development Rep
KPIs: 200 dials/week, 8 meetings/week

| Set | Performance | Notes |
|-----|------------|-------|
| 1 | Vanity metrics | Dials strong, meetings declining 5-4-3-2-2. (Existing data) |
| 2 | Both strong | Dials and meetings both on target, clean week |
| 3 | Both declining | Dials drop below target too, meetings cratering |
| 4 | Meetings rebound | Dials consistent, meetings climb back 3-4-5-6-7 |
| 5 | Dials inflated | Reports high dials but language suggests padding. Meetings flat |
| 6 | Strong close | Best meeting week (10+), dials solid, confident tone backed by numbers |

### Hannah Kargman (emp_005) — Product Manager
KPIs: Ship Creator Matching v2 by EOQ, 5 research sessions/week

| Set | Performance | Notes |
|-----|------------|-------|
| 1 | No forward motion | Same blocker all week, only 2 research sessions. (Existing data) |
| 2 | Breakthrough | Eng alignment achieved, v2 spec locked, 4 research sessions |
| 3 | Partial progress | Ships a component, but new blocker emerges. Research at 3 sessions |
| 4 | Strong execution | Feature in QA, 5 research sessions hit for first time |
| 5 | Regression | QA finds issues, back to alignment meetings. Research drops to 1 |
| 6 | Shipped milestone | v2 beta launched, research at 4 sessions. Minor bugs but forward progress |

## Writing Style Consistency

Each employee's writing style (defined in `synthetic_data.json` employee profiles) must be preserved across all 6 sets:

- **Adam**: Concise, numbers-forward, short sentences
- **Avery**: Long narrative paragraphs, buries metrics, optimistic tone
- **Sean**: Dry, table-like, metrics-heavy
- **Jeff**: Short, breezy, casual one-liners
- **Hannah**: Thoughtful, qualitative, process-oriented

## What Does NOT Change

- Employee profiles in `synthetic_data.json`
- `GeneratedUpdate` model schema
- Stage 2 (extraction) and Stage 3 (reasoning) — still GPT-powered
- Frontend polling and status display
- Pipeline run tracking (PipelineRun model)
- API routes
