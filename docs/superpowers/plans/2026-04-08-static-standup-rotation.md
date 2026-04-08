# Static Standup Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GPT-powered Stage 1 (standup generation) with 6 pre-written rotating standup sets, keeping Stages 2-3 AI-powered.

**Architecture:** Pre-written standup data lives in `synthetic_data.json` under a `"standup_sets"` array. The pipeline loads the appropriate set based on completed run count mod 6. All GPT generation code is removed.

**Tech Stack:** Python/Flask, SQLAlchemy, JSON

---

### Task 1: Write 5 New Standup Sets in `synthetic_data.json`

**Files:**
- Modify: `synthetic_data.json`

This is the content-heavy task. We restructure the JSON and add 5 new weeks of standups.

- [ ] **Step 1: Restructure `synthetic_data.json` — migrate `"updates"` to `"standup_sets"[0]` and remove old key**

Replace the `"updates": [...]` key with `"standup_sets": [[...existing updates...], ...]`. The existing updates become set index 0. Keep the same object shape: `{ "employee_id", "day", "text" }`.

The final structure:
```json
{
  "company": { ... },
  "fictional_brands": [ ... ],
  "employees": [ ... ],
  "standup_sets": [
    [ /* set 0: existing week 1 updates */ ],
    [ /* set 1: week 2 */ ],
    [ /* set 2: week 3 */ ],
    [ /* set 3: week 4 */ ],
    [ /* set 4: week 5 */ ],
    [ /* set 5: week 6 */ ]
  ]
}
```

- [ ] **Step 2: Write Set 1 (Week 2) standup updates**

Performance profiles for Week 2:
- **Adam (emp_001)**: Slight dip — response time creeps to 22hr, onboarding still solid (~23-26/day)
- **Avery (emp_002)**: Genuine progress — actually closes Northwind renewal, Petalcrest expansion moving with real numbers
- **Sean (emp_003)**: Full submission (all 5 days), but numbers mediocre — CAC flat, only 2 experiments launched
- **Jeff (emp_004)**: Both strong — dials 40-50/day, meetings steady 6-8 range daily
- **Hannah (emp_005)**: Breakthrough — eng alignment achieved, v2 spec locked, 4 research sessions completed

Each employee must match their defined `writing_style`. Each update must contain extractable KPI evidence (numbers, status words, progress indicators).

- [ ] **Step 3: Write Set 2 (Week 3) standup updates**

Performance profiles for Week 3:
- **Adam**: Rough patch — platform outage causes onboarding backlog Tue-Wed (only 10-12/day those days), recovers Thu-Fri. Response time spikes to 28hr mid-week.
- **Avery**: Mixed signals — Harborline renewal signed (concrete win), but Ridgeway going dark (no response since Tuesday). Updates still optimistic about Ridgeway.
- **Sean**: Skips Mon and Tue (different pattern than week 1). Wed-Fri posts strong, 3 experiments launched, CAC down 5%.
- **Jeff**: Both declining — dials drop to 30-35/day, meetings only 1-2/day. Tone still casual/upbeat.
- **Hannah**: Partial progress — ships matching algorithm component, but new blocker on data pipeline. 3 research sessions.

- [ ] **Step 4: Write Set 3 (Week 4) standup updates**

Performance profiles for Week 4:
- **Adam**: Strong rebound — 30+ creators/day, response time back to 15hr. Clears backlog from prior week.
- **Avery**: Strong week — two accounts renewed (Cinderhouse + Northwind), expansion conversation with Harborline includes concrete revenue numbers.
- **Sean**: All days posted, strong numbers — CAC down 12%, 4 experiments launched. Best week yet.
- **Jeff**: Meetings rebound — dials consistent 42-48, meetings climb 3→4→5→6→7 across the week.
- **Hannah**: Strong execution — feature in QA, 5 research sessions hit for first time. Concrete progress language.

- [ ] **Step 5: Write Set 4 (Week 5) standup updates**

Performance profiles for Week 5:
- **Adam**: Mixed — onboarding strong (27-32/day) but response time consistently above 20hr, some at 23hr. Numbers present but response KPI is a concern.
- **Avery**: Stalling again — Ridgeway and Cinderhouse both "almost there" for 5 straight days. Language is pure optimism, zero concrete milestones. Different accounts than week 1 but same pattern.
- **Sean**: Skips Wed only. 4 days posted. 2 experiments launched (below target), one underperforms. CAC flat.
- **Jeff**: Dials inflated — reports 50-55 dials/day but language suggests padding ("including follow-up attempts", "redials counted"). Meetings flat at 3/day.
- **Hannah**: Regression — QA finds critical bugs in matching v2, back to "alignment" meetings with eng. Research drops to 1 session. Same stuck language as week 1.

- [ ] **Step 6: Write Set 5 (Week 6) standup updates**

Performance profiles for Week 6:
- **Adam**: Peak week — 30-35 creators/day, response time 14-16hr. Highest numbers across all sets. Clean confident updates.
- **Avery**: Worst week — Harborline churns (confirmed lost), Petalcrest expansion falls through ("budget freeze"). Updates still try to spin positive but language cracks ("still processing", "unexpected").
- **Sean**: Submission collapse — only posts Mon and Fri. Numbers on those days are decent (ROAS 3.0x, 2 experiments), but 3 missing days is severe.
- **Jeff**: Strong close — best meeting week (8-10 total). Dials solid 45-50. Confident tone is actually backed by results this time.
- **Hannah**: Shipped milestone — v2 beta launched Wed. 4 research sessions. Minor bugs mentioned but clear forward progress. Concrete shipping language.

- [ ] **Step 7: Validate all sets have correct employee_ids, days, and structure**

Verify manually or via quick scan:
- Each set has entries for all 5 employees
- Days match expected patterns (Sean's skip days vary per set)
- All entries have non-empty `text` fields
- Employee writing styles are consistent

- [ ] **Step 8: Commit**

```bash
git add synthetic_data.json
git commit -m "Add 6 rotating standup sets to synthetic_data.json"
```

---

### Task 2: Replace Stage 1 Generation with Static Loading

**Files:**
- Modify: `api/pipeline.py:812-841` (`_run_generate_stage`)
- Modify: `api/pipeline.py:1-18` (imports)

- [ ] **Step 1: Add JSON loading helper at top of `pipeline.py`**

Add after the existing imports (around line 18), before `FICTIONAL_BRANDS`:

```python
import os

def _load_standup_sets():
    """Load pre-written standup sets from synthetic_data.json."""
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'synthetic_data.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('standup_sets', [])
```

- [ ] **Step 2: Rewrite `_run_generate_stage` to use static data**

Replace the function at line 812-841 with:

```python
def _run_generate_stage(run, employees):
    """Stage 1: Load pre-written standup updates. Returns (0, 0) — no API calls."""
    run.status = 'generating'
    run.stage = 'generation'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 1: Loading standup set...", run_id)

    standup_sets = _load_standup_sets()
    if not standup_sets:
        raise ValueError("No standup sets found in synthetic_data.json")

    completed_count = PipelineRun.query.filter_by(status='complete').count()
    set_index = completed_count % len(standup_sets)
    selected_set = standup_sets[set_index]
    log.info("Pipeline [%d] Using standup set %d of %d", run_id, set_index + 1, len(standup_sets))

    for update in selected_set:
        db.session.add(GeneratedUpdate(
            employee_id=update['employee_id'],
            day=update['day'].lower(),
            content=update['text'],
            pipeline_run_id=run_id,
        ))
    db.session.commit()
    return 0, 0
```

- [ ] **Step 3: Run the dev server and trigger a pipeline run to verify Stage 1 loads correctly**

```bash
cd C:/Users/cchen/SN
npm run dev &
FLASK_DEBUG=1 python api/app.py
```

Navigate to the pipeline page, hit Run. Stage 1 should complete instantly. Stages 2-3 should still call GPT normally.

- [ ] **Step 4: Commit**

```bash
git add api/pipeline.py
git commit -m "Replace GPT generation stage with static standup set loading"
```

---

### Task 3: Remove Dead Generation Code

**Files:**
- Modify: `api/pipeline.py`

- [ ] **Step 1: Remove the following functions that were only used by Stage 1 GPT generation**

Delete these functions entirely:
- `_generate_updates()` (line ~1020-1088)
- `_validate_generated_updates()` (line ~602-663)
- `_repair_generated_updates()` (line ~666-674)
- `_infer_expected_submission_days()` (line ~59-89)
- `_normalize_generated_updates()` (line ~92-107)
- `_contains_week_total_language()` (line ~110-116)

Work bottom-up (highest line numbers first) to keep line references stable.

- [ ] **Step 2: Remove unused imports**

Check if these are still needed after deletion:
- `from config import OPENAI_MODEL, OPENAI_TIMEOUT_SECONDS` — `OPENAI_MODEL` is still used in `run_pipeline` for `estimate_cost_cents`. `OPENAI_TIMEOUT_SECONDS` is used for `REASON_WORKER_TIMEOUT_SECONDS`. Keep both.
- `from openai_client import call_gpt, estimate_cost_cents` — `call_gpt` is still used by `_extract_kpis` and `_reason_accountability`. `estimate_cost_cents` still used. Keep both.
- `ThreadPoolExecutor` — still used by Stages 2-3. Keep.
- `_snapshot_employees` — still used by Stages 2-3. Keep.

The only cleanup: remove `FICTIONAL_BRANDS` constant (line 21) if it's not referenced by Stage 2 or 3.

Check with grep: is `FICTIONAL_BRANDS` used anywhere else in the file besides its definition?

- [ ] **Step 3: Verify the app still starts and pipeline runs end-to-end**

```bash
FLASK_DEBUG=1 python api/app.py
```

Trigger a pipeline run from the UI. All 3 stages should complete without errors.

- [ ] **Step 4: Commit**

```bash
git add api/pipeline.py
git commit -m "Remove dead GPT generation code from pipeline"
```

---

### Task 4: Verify Rotation Works Across Multiple Runs

- [ ] **Step 1: Run the pipeline twice and verify different standup sets are used**

Check the logs — first run should say "Using standup set 1 of 6", second run should say "Using standup set 2 of 6" (or similar, depending on existing completed run count).

Alternatively, check the `generated_updates` table content differs between runs.

- [ ] **Step 2: Verify extraction and reasoning produce different results per set**

Compare the KPI extractions and analysis results between the two runs. Since employee performance varies across sets, the flags should differ.

- [ ] **Step 3: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "Verify and polish standup rotation"
```
