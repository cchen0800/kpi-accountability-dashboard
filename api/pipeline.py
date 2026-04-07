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

BRANDS = "Unilever, Adidas, L'Oréal, Crocs, Nestlé"


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
    """Stage 1: Generate 5 daily standup updates for an employee."""
    system = (
        "You are generating realistic daily end-of-day Slack standup updates. "
        "Return valid JSON with an 'updates' array of objects, each with 'day' and 'content' keys."
    )
    user = (
        f"Generate 5 daily standup updates (Monday through Friday) for {emp.name}, "
        f"a {emp.role} at Lumen Collective (Series C UGC marketplace, 180 employees).\n\n"
        f"Writing style: {emp.writing_style}\n"
        f"KPIs: {emp.kpis}\n"
        f"Hidden truth to embed subtly: {emp.hidden_truth}\n\n"
        f"Each update should:\n"
        f"- Match the writing style exactly\n"
        f"- Reference these brand clients naturally: {BRANDS}\n"
        f"- Embed the hidden truth subtly — don't make it obvious\n"
        f"- Include realistic metrics that trend according to the hidden truth\n\n"
        f"Return JSON: {{\"updates\": [{{\"day\": \"monday\", \"content\": \"...\"}}]}}"
    )
    return call_gpt(system, user)


def _extract_kpis(emp, updates):
    """Stage 2: Extract structured KPI data. Does NOT receive hidden_truth."""
    updates_text = "\n\n".join(
        f"**{u.get('day', 'unknown').title()}**: {u.get('content', '')}" for u in updates
    )
    system = (
        "You are a data extraction agent. Parse daily standup updates and extract "
        "structured KPI performance data. Do not interpret or judge — just extract. "
        "Return valid JSON."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"KPI targets: {emp.kpis}\n\n"
        f"Updates:\n{updates_text}\n\n"
        f"Extract:\n"
        f"1. For each KPI: what metric values can you find in the updates? Compare to target.\n"
        f"2. Submission compliance: which days (Mon-Fri) have an update, which are missing?\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"kpis\": [{{\"name\": \"...\", \"target\": \"...\", \"actual\": \"...\", \"delta\": \"...\", \"status\": \"on_track|at_risk|missing\"}}],\n"
        f"  \"submission_rate\": \"X/5\",\n"
        f"  \"days_submitted\": [\"monday\", \"tuesday\", ...]\n"
        f"}}"
    )
    return call_gpt(system, user)


def _reason_accountability(emp, extraction, updates):
    """Stage 3: Reason over extracted data. Does NOT receive hidden_truth."""
    updates_text = "\n\n".join(
        f"**{u.get('day', 'unknown').title()}**: {u.get('content', '')}" for u in updates
    )
    kpi_summary = json.dumps(extraction.get('kpis', []), indent=2)
    submission_rate = extraction.get('submission_rate', 'unknown')

    system = (
        "You are an AI operations analyst. Reason about what extracted KPI data "
        "reveals about an employee's performance and accountability. "
        "Return valid JSON."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"Extracted KPI data: {kpi_summary}\n"
        f"Submission rate: {submission_rate}\n\n"
        f"Raw updates (for context):\n{updates_text}\n\n"
        f"Look for patterns like:\n"
        f"- Optimistic language masking declining metrics\n"
        f"- High activity metrics but declining outcome metrics\n"
        f"- Repeated blockers without escalation\n"
        f"- Irregular submission cadence\n"
        f"- Any other accountability gap you observe\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"flag_type\": \"none|optimism_gap|submission_gap|vanity_metrics|no_progress|other\",\n"
        f"  \"flag_label\": \"Human-readable label (required if flag_type is 'other')\",\n"
        f"  \"summary\": \"2-line summary for dashboard card\",\n"
        f"  \"detail\": \"3-5 paragraph analysis with evidence from the data\",\n"
        f"  \"recommended_action\": \"One specific CEO-level next step\"\n"
        f"}}"
    )
    return call_gpt(system, user)
