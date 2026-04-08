# Agentic KPI Accountability Dashboard — Writeup

## The Problem

A CEO mandates daily Slack standups for a 180-person company. Five direct reports submit updates every day. The updates sound great — "crushing it," "great calls," "strong pipeline." But are the numbers actually moving? A CEO reading these in real time would catch maybe 1 in 3 accountability gaps. The rest get buried in optimistic language, inconsistent formatting, and the sheer volume of status noise.

This dashboard asks: **can AI catch what a CEO would miss?**

## The Approach

I built a 3-stage agentic pipeline where each AI agent operates in isolation — no agent sees the full picture, yet together they surface accountability gaps that would take a human manager hours of cross-referencing to detect.

### Stage 1: Generate (the only stage that "knows the truth")

Five synthetic employees are seeded with hidden performance issues — an optimism gap, vanity metrics, a submission gap, stalled progress, and one genuine high performer as a control. GPT generates a week of realistic Slack standups for each, embedding the issues naturally into their writing style. This stage sees the `hidden_truth` field. **No other stage does.**

### Stage 2: Extract (blind analysis)

A separate GPT call parses the raw standup text and extracts structured KPI data: actuals vs. targets, deltas, submission rates. It has no idea what problems were planted. It just reads the updates like a human analyst would — counting dials, tracking renewals, measuring response times.

### Stage 3: Reason (blind diagnosis)

A third GPT call analyzes the extracted data and flags exactly one accountability pattern per employee from a defined taxonomy:

- **No Progress** — same blocker repeated daily with no escalation
- **Vanity Metrics** — activity numbers strong, outcome metrics declining
- **Optimism Gap** — positive language masking stalled or missing metrics
- **Submission Gap** — missing standup days entirely

The system consistently identifies 4 out of 5 planted issues without ever seeing the hidden truth.

## Tools Used

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite 6, Jotai (state), Framer Motion |
| Backend | Flask, SQLAlchemy, SQLite |
| AI | OpenAI GPT-4o-mini via Python SDK, JSON response mode |
| Concurrency | ThreadPoolExecutor (5 workers per stage) |
| Visualizations | Hand-rolled SVG (scatter plot, sparklines, stacked bars) |
| Infrastructure | Docker multi-stage build, Nginx, Gunicorn, Docker Compose |

Total cost per pipeline run: ~$0.02 (gpt-4o-mini). Full analysis in ~30 seconds.

## What the Dashboard Shows

- **Team Rollup** — KPI health bar, biggest gaps, flag distribution at a glance
- **Sentiment vs. Reality** — scatter plot mapping what employees *say* (language positivity) against what they *deliver* (KPI attainment). Optimism gaps show up in the bottom-right quadrant.
- **Employee Cards** — per-person KPI progress bars, AI-generated summaries, and recommended manager actions
- **KPI Sparklines** — inline trend lines extracted from daily standup text via regex
- **Pipeline Control** — run each stage independently, watch results populate in real time

## What I'd Build Next

**With more time:**
- Integrate real Slack data via OAuth instead of synthetic generation
- Add week-over-week trend tracking (is this person improving or declining?)
- Build a Slack bot that delivers the weekly accountability digest directly to the CEO
- Add team-level rollups for department heads (not just individual contributors)
- Swap SQLite for Postgres and add multi-tenant support

**With more ambition:**
- Feed the reasoning stage historical context ("Hannah has been flagged No Progress for 3 consecutive weeks")
- Add a calibration loop where the CEO marks flags as accurate/inaccurate, fine-tuning the prompt over time
- Build an n8n/Make workflow that triggers automatically every Friday at 5pm and posts results to a leadership channel

## Development Complexity

This wasn't a clean build-once project. Across 11 commits and ~9,000 lines changed, the majority of iteration was wrangling GPT output into a reliable, deterministic pipeline.

**The core challenge: GPT doesn't return consistent data.** The pipeline file alone (`api/pipeline.py`) was modified in 7 of 11 commits, growing from 114 lines to over 1,200. Most of that growth was defensive:

- **Output normalization** — GPT returns deltas as "+50", "50 above target", or "-50" for the same scenario. Every extraction now runs through `_normalize_actual()` and `_derive_delta()` to recalculate from raw values, because GPT's own math is unreliable. One employee showed a delta of -50 when the actual was 250 vs. a target of 200.
- **Stage cohesion** — Stage 1 generates updates mentioning "28 creators onboarded." Stage 2 sometimes extracts "28", sometimes "25-30", sometimes ignores it entirely. Built regex fallback extraction (`_extract_count_total_for_kpi()`, `_extract_duration_avg_hours()`) as a safety net when GPT extraction fails.
- **KPI type handling** — Count-per-week KPIs (dials, meetings) need daily values summed. Duration KPIs (response time) need averaging. Quarterly KPIs (ship feature by Q4) are qualitative. Each required different extraction logic, different validation, and different prompt engineering. This alone was 360+ lines added in one commit.
- **Timeout and zombie detection** — GPT calls occasionally hang. Added per-worker timeouts, fallback results for timed-out workers, and a zombie detection check that marks pipeline runs stuck for 5+ minutes as errored.
- **Validation and repair loops** — Stage 1 output is validated for expected days, extractable metrics, and no duplicates. If validation fails, it retries with feedback or auto-repairs with generic content to prevent downstream stages from breaking.

The frontend iteration (5 commits, ~2,200 lines) was comparatively straightforward — the hard part was getting reliable, consistent data out of GPT to display.

## Why This Architecture

The 3-stage isolation isn't just a demo trick — it's the whole point. In a real deployment, Stage 1 doesn't exist. Real employees write real standups. The value is in Stages 2 and 3: can AI extract signal from unstructured daily updates and surface patterns a busy CEO would miss?

The answer, even with $0.02 worth of GPT-4o-mini, is yes.
