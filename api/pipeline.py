"""
Three-stage agentic pipeline: Generate → Extract → Reason

Stage 1 (Generation): GPT generates 5 daily standup updates per employee
Stage 2 (Extraction): GPT extracts structured KPI data from updates (no hidden_truth)
Stage 3 (Reasoning): GPT reasons over extracted data to assign flags + narrative (no hidden_truth)
"""

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from models import db, Employee, PipelineRun, GeneratedUpdate, KpiExtraction, AnalysisResult
from openai_client import call_gpt, estimate_cost_cents
from config import OPENAI_MODEL

log = logging.getLogger(__name__)

FICTIONAL_BRANDS = "Northwind Athletics, Petalcrest Beauty, Harborline Foods, Ridgeway Outdoors, Cinderhouse Coffee"


def run_pipeline(app):
    """Main pipeline orchestrator. Runs in a background thread."""
    with app.app_context():
        run = PipelineRun(started_at=datetime.now(timezone.utc), status='pending')
        db.session.add(run)
        db.session.commit()

        total_prompt = 0
        total_completion = 0

        try:
            employees = Employee.query.all()
            _clear_previous_data(run.id)

            # Stage 1: Generation
            p, c = _run_generate_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Stage 2: Extraction
            p, c = _run_extract_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Stage 3: Reasoning
            p, c = _run_reason_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Complete
            run.status = 'complete'
            run.stage = None
            run.completed_at = datetime.now(timezone.utc)
            run.total_tokens = total_prompt + total_completion
            run.total_cost_cents = estimate_cost_cents(OPENAI_MODEL, total_prompt, total_completion)
            db.session.commit()
            log.info("Pipeline [%d] Complete. Tokens: %d, Cost: $%.4f",
                     run.id, run.total_tokens, run.total_cost_cents / 100)

        except Exception as e:
            log.exception("Pipeline [%d] failed: %s", run.id, e)
            run.status = 'error'
            run.error = str(e)
            run.completed_at = datetime.now(timezone.utc)
            run.total_tokens = total_prompt + total_completion
            run.total_cost_cents = estimate_cost_cents(OPENAI_MODEL, total_prompt, total_completion)
            db.session.commit()


def run_stage(app, stage):
    """Run a single pipeline stage. Called from per-stage API endpoints."""
    with app.app_context():
        # Get or create a pipeline run
        run = PipelineRun.query.filter(
            PipelineRun.status.in_(['stage_generate_done', 'stage_extract_done', 'pending'])
        ).order_by(PipelineRun.id.desc()).first()

        if stage == 'generate':
            # Always start a fresh run for generate
            run = PipelineRun(started_at=datetime.now(timezone.utc), status='pending')
            db.session.add(run)
            db.session.commit()
            _clear_previous_data(run.id)

        if not run:
            log.error("No active pipeline run found for stage %s", stage)
            return

        total_prompt = 0
        total_completion = 0

        try:
            employees = Employee.query.all()

            if stage == 'generate':
                p, c = _run_generate_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'stage_generate_done'
                run.stage = None

            elif stage == 'extract':
                p, c = _run_extract_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'stage_extract_done'
                run.stage = None

            elif stage == 'reason':
                p, c = _run_reason_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'complete'
                run.stage = None
                run.completed_at = datetime.now(timezone.utc)

            run.total_tokens = (run.total_tokens or 0) + total_prompt + total_completion
            run.total_cost_cents = (run.total_cost_cents or 0) + estimate_cost_cents(
                OPENAI_MODEL, total_prompt, total_completion
            )
            db.session.commit()
            log.info("Pipeline [%d] Stage '%s' complete.", run.id, stage)

        except Exception as e:
            log.exception("Pipeline [%d] stage '%s' failed: %s", run.id, stage, e)
            run.status = 'error'
            run.error = str(e)
            run.completed_at = datetime.now(timezone.utc)
            db.session.commit()


def _snapshot_employees(employees):
    """Snapshot SQLAlchemy employee objects to plain dicts for thread safety."""
    snaps = []
    for emp in employees:
        snaps.append(type('Emp', (), {
            'id': emp.id, 'name': emp.name, 'role': emp.role,
            'kpis': emp.kpis, 'writing_style': emp.writing_style,
            'hidden_truth': emp.hidden_truth,
        })())
    return snaps


def _run_generate_stage(run, employees):
    """Stage 1: Generate standup updates. Returns (prompt_tokens, completion_tokens)."""
    run.status = 'generating'
    run.stage = 'generation'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 1: Generating updates...", run_id)

    emps = _snapshot_employees(employees)

    # Parallelize GPT calls across employees
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_generate_updates, emp): emp for emp in emps}

    total_p, total_c = 0, 0
    for future, emp in futures.items():
        result = future.result()
        total_p += result['prompt_tokens']
        total_c += result['completion_tokens']

        updates = result['data'].get('updates', result['data'].get('days', []))
        for update in updates:
            db.session.add(GeneratedUpdate(
                employee_id=emp.id,
                day=update.get('day', '').lower(),
                content=update.get('content', ''),
                pipeline_run_id=run_id,
            ))
    db.session.commit()
    return total_p, total_c


def _run_extract_stage(run, employees):
    """Stage 2: Extract KPIs from generated updates. Returns (prompt_tokens, completion_tokens)."""
    run.status = 'extracting'
    run.stage = 'extraction'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 2: Extracting KPIs...", run_id)

    emps = _snapshot_employees(employees)

    # Pre-fetch updates for all employees
    emp_updates = {}
    for emp in emps:
        updates_db = GeneratedUpdate.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        emp_updates[emp.id] = [{'day': u.day, 'content': u.content} for u in updates_db]

    # Parallelize GPT calls
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_extract_kpis, emp, emp_updates[emp.id]): emp for emp in emps}

    total_p, total_c = 0, 0
    for future, emp in futures.items():
        result = future.result()
        total_p += result['prompt_tokens']
        total_c += result['completion_tokens']

        data = result['data']
        for kpi in data.get('kpis', []):
            db.session.add(KpiExtraction(
                employee_id=emp.id,
                kpi_name=kpi.get('name', ''),
                target=kpi.get('target', ''),
                actual=kpi.get('actual', ''),
                delta=kpi.get('delta', ''),
                status=kpi.get('status', 'missing'),
                pipeline_run_id=run_id,
            ))
    db.session.commit()
    return total_p, total_c


def _run_reason_stage(run, employees):
    """Stage 3: Reason about accountability. Returns (prompt_tokens, completion_tokens)."""
    run.status = 'reasoning'
    run.stage = 'reasoning'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 3: Reasoning about accountability...", run_id)

    emps = _snapshot_employees(employees)

    # Pre-fetch data for all employees
    emp_data = {}
    for emp in emps:
        updates_db = GeneratedUpdate.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        updates = [{'day': u.day, 'content': u.content} for u in updates_db]

        kpis_db = KpiExtraction.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        extraction = {
            'kpis': [{'name': k.kpi_name, 'target': k.target, 'actual': k.actual,
                       'delta': k.delta, 'status': k.status} for k in kpis_db],
            'submission_rate': f"{len(updates)}/5",
        }
        emp_data[emp.id] = (extraction, updates)

    # Parallelize GPT calls
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            pool.submit(_reason_accountability, emp, emp_data[emp.id][0], emp_data[emp.id][1]): emp
            for emp in emps
        }

    total_p, total_c = 0, 0
    for future, emp in futures.items():
        result = future.result()
        total_p += result['prompt_tokens']
        total_c += result['completion_tokens']

        extraction = emp_data[emp.id][0]
        data = result['data']
        db.session.add(AnalysisResult(
            employee_id=emp.id,
            flag_type=data.get('flag_type', 'none'),
            flag_label=data.get('flag_label', ''),
            summary=data.get('summary', ''),
            detail=data.get('detail', ''),
            recommended_action=data.get('recommended_action', ''),
            submission_rate=extraction.get('submission_rate', ''),
            pipeline_run_id=run_id,
        ))
    db.session.commit()
    return total_p, total_c


def is_pipeline_running():
    """Check if a pipeline run is currently in progress. Cleans up zombies older than 5 min."""
    stuck = PipelineRun.query.filter(
        PipelineRun.status.in_(['pending', 'generating', 'extracting', 'reasoning'])
    ).all()

    now = datetime.now()
    for run in stuck:
        try:
            started = run.started_at.replace(tzinfo=None) if run.started_at else None
            age = (now - started).total_seconds() if started else 999
        except Exception:
            age = 999
        if age > 300:  # 5 minute timeout
            log.warning("Pipeline [%d] stuck for %.0fs — marking as error", run.id, age)
            run.status = 'error'
            run.error = 'Timed out'
            run.completed_at = datetime.now(timezone.utc)
            db.session.commit()

    return PipelineRun.query.filter(
        PipelineRun.status.in_(['pending', 'generating', 'extracting', 'reasoning'])
    ).first() is not None


def _clear_previous_data(current_run_id):
    """Remove data from previous runs (keep current)."""
    GeneratedUpdate.query.filter(GeneratedUpdate.pipeline_run_id != current_run_id).delete()
    KpiExtraction.query.filter(KpiExtraction.pipeline_run_id != current_run_id).delete()
    AnalysisResult.query.filter(AnalysisResult.pipeline_run_id != current_run_id).delete()
    PipelineRun.query.filter(
        PipelineRun.id != current_run_id,
        PipelineRun.status.in_(['complete', 'error'])
    ).delete()
    db.session.commit()


def _generate_updates(emp):
    """Stage 1: Generate daily standup updates for an employee."""
    system = (
        "You are writing casual Slack messages for a fictional company's #daily-standup channel.\n\n"
        "FORMATTING RULES (non-negotiable):\n"
        "- Plain text ONLY. No markdown. No **bold**, no ## headers, no [links](url), no ```code```.\n"
        "- Do NOT use emojis as section headers or bullet prefixes (no '✅ Topic:', no '🚧 Topic:').\n"
        "- Emojis are fine sprinkled naturally mid-sentence, just not as structural formatting.\n"
        "- No bullet points. No numbered lists. Write in flowing sentences/short paragraphs.\n"
        "- 1-4 sentences per update for most people. Match the stated writing style for length/tone "
        "but OVERRIDE any formatting instructions in the writing style — plain text always wins.\n\n"
        "BRAND RULES (non-negotiable):\n"
        "- The ONLY client brand names that exist in this fictional universe are: "
        "Northwind Athletics, Petalcrest Beauty, Harborline Foods, Ridgeway Outdoors, Cinderhouse Coffee.\n"
        "- Do NOT use any real-world company names. No Unilever, no Adidas, no Crocs, no Nike, "
        "no L'Oréal, no Nestlé, no Social Native. These do not exist in this world.\n"
        "- If the writing style or KPIs mention real brands, ignore those brand names and substitute "
        "from the fictional list above.\n\n"
        "SUBMISSION RULES:\n"
        "- The number of updates MUST equal the number of days the employee actually submits.\n"
        "- If the hidden truth says they skip certain days, return FEWER than 5 updates.\n"
        "- Only include days they actually post.\n\n"
        "Return valid JSON: {\"updates\": [{\"day\": \"monday\", \"content\": \"...\"}]}"
    )
    user = (
        f"Generate daily standup Slack messages for {emp.name}, "
        f"a {emp.role} at Lumen Collective (Series C UGC marketplace, 180 employees).\n\n"
        f"Writing style: {emp.writing_style}\n"
        f"KPIs: {emp.kpis}\n"
        f"Hidden truth to embed subtly: {emp.hidden_truth}\n\n"
        f"Each update should:\n"
        f"- Sound like a real Slack message, not a report\n"
        f"- Match the writing style exactly\n"
        f"- Reference fictional brand clients naturally (listed in system prompt)\n"
        f"- Embed the hidden truth subtly — don't make it obvious\n"
        f"- Include realistic metrics that trend according to the hidden truth\n\n"
        f"IMPORTANT: If the hidden truth says the employee skips certain days, "
        f"do NOT generate updates for those days. Return ONLY the days they actually post.\n\n"
        f"Return JSON: {{\"updates\": [{{\"day\": \"monday\", \"content\": \"...\"}}]}}"
    )
    return call_gpt(system, user)


def _extract_kpis(emp, updates):
    """Stage 2: Extract structured KPI data. Does NOT receive hidden_truth."""
    updates_text = "\n\n".join(
        f"{u.get('day', 'unknown').title()}: {u.get('content', '')}" for u in updates
    )
    system = (
        "You are a data extraction agent. Parse daily standup updates and extract "
        "structured KPI performance data. Do not interpret or judge — just extract. "
        "Return valid JSON.\n\n"
        "IMPORTANT FORMATTING RULES:\n"
        "- 'target', 'actual', and 'delta' must each be a SHORT string — a single number or "
        "brief phrase. Examples: '25/week', '30', '+5', '-2', '3.2x', '85%'.\n"
        "- Do NOT list per-day breakdowns in these fields. Summarize into one weekly figure.\n"
        "- For 'actual': use the weekly total, weekly average, or latest value — whichever "
        "matches how the target is expressed.\n"
        "- For 'delta': the difference between actual and target as a single number (e.g. '+5', '-20%').\n\n"
        "SUBMISSION COUNTING:\n"
        "- Count exactly which days (Monday through Friday) have an update present.\n"
        "- If only 3 out of 5 days have an update, submission_rate must be '3/5'.\n"
        "- Do not assume missing days were submitted."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"KPI targets: {emp.kpis}\n\n"
        f"Updates provided:\n{updates_text}\n\n"
        f"Extract:\n"
        f"1. For each KPI: find the best single summary value from the updates and compare to target.\n"
        f"2. Submission compliance: count exactly which days (Mon-Fri) have an update above. "
        f"If a day is not listed, it is MISSING — the employee did not submit that day.\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"kpis\": [{{\"name\": \"short KPI name\", \"target\": \"single value\", \"actual\": \"single value\", \"delta\": \"+/- single value\", \"status\": \"on_track|at_risk|missing\"}}],\n"
        f"  \"submission_rate\": \"X/5\",\n"
        f"  \"days_submitted\": [\"monday\", \"tuesday\", ...]\n"
        f"}}"
    )
    return call_gpt(system, user)


def _reason_accountability(emp, extraction, updates):
    """Stage 3: Reason over extracted data. Does NOT receive hidden_truth."""
    updates_text = "\n\n".join(
        f"{u.get('day', 'unknown').title()}: {u.get('content', '')}" for u in updates
    )
    kpi_summary = json.dumps(extraction.get('kpis', []), indent=2)
    submission_rate = extraction.get('submission_rate', 'unknown')

    system = (
        "You are an AI operations analyst advising a CEO. Your job is to classify "
        "exactly ONE accountability flag for this employee using the ordered rules below. "
        "Check each rule IN ORDER and assign the FIRST one that matches. Return valid JSON.\n\n"
        "CLASSIFICATION RULES (check in this exact order):\n"
        "1. submission_gap — The employee submitted fewer than 5/5 daily updates, OR there are "
        "multi-day gaps in their submission cadence. CHECK THIS FIRST by looking at submission_rate.\n"
        "2. vanity_metrics — Activity/effort metrics (calls made, emails sent, tasks completed) "
        "look strong, BUT outcome metrics (revenue, meetings booked, deals closed) are declining "
        "or flat. The employee emphasizes activity to mask poor outcomes.\n"
        "3. no_progress — The same blocker, task, or issue is repeated across 3+ days with no "
        "escalation, resolution, or meaningful forward movement. The employee is stuck.\n"
        "4. optimism_gap — The employee uses consistently positive/optimistic language ('feeling good,' "
        "'great call,' 'almost there') but the underlying metrics are declining, stalled, or absent.\n"
        "5. none — The employee is genuinely on track. Metrics meet or exceed targets, submissions "
        "are consistent, and there are no red flags.\n\n"
        "You MUST pick exactly one. Do NOT default to optimism_gap — only use it if the other "
        "flags above genuinely do not apply."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"Extracted KPI data: {kpi_summary}\n"
        f"Submission rate: {submission_rate}\n\n"
        f"Raw updates (for context):\n{updates_text}\n\n"
        f"ANALYSIS STEPS (you must do each one):\n"
        f"Step 1: Check submission_rate. Is it less than 5/5? Are any weekdays missing? "
        f"If yes → submission_gap.\n"
        f"Step 2: Compare activity metrics vs outcome metrics. Are activity numbers strong but "
        f"outcomes declining day-over-day? If yes → vanity_metrics.\n"
        f"Step 3: Is the same blocker or task mentioned 3+ days without resolution or escalation? "
        f"If yes → no_progress.\n"
        f"Step 4: Is the language positive but metrics declining/stalled/absent? If yes → optimism_gap.\n"
        f"Step 5: If none of the above apply → none.\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"flag_type\": \"none|optimism_gap|submission_gap|vanity_metrics|no_progress\",\n"
        f"  \"flag_label\": \"Human-readable label\",\n"
        f"  \"summary\": \"2-line summary for dashboard card\",\n"
        f"  \"detail\": \"3-5 paragraph analysis with specific evidence from the data\",\n"
        f"  \"recommended_action\": \"One specific action the CEO should take THIS WEEK (e.g., 'Pull Sean into a 1:1 Monday to discuss daily submission commitment' — not vague advice)\"\n"
        f"}}"
    )
    return call_gpt(system, user, temperature=0.3)
