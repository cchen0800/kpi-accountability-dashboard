"""
Three-stage agentic pipeline: Generate → Extract → Reason

Stage 1 (Generation): GPT generates 5 daily standup updates per employee
Stage 2 (Extraction): GPT extracts structured KPI data from updates (no hidden_truth)
Stage 3 (Reasoning): GPT reasons over extracted data to assign flags + narrative (no hidden_truth)
"""

import json
import logging
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

            # Clean previous run data
            _clear_previous_data(run.id)

            # Stage 1: Generation
            run.status = 'generating'
            run.stage = 'generation'
            db.session.commit()
            log.info("Pipeline [%d] Stage 1: Generating updates...", run.id)

            generated = {}
            for emp in employees:
                result = _generate_updates(emp)
                total_prompt += result['prompt_tokens']
                total_completion += result['completion_tokens']

                updates = result['data'].get('updates', result['data'].get('days', []))
                generated[emp.id] = updates

                for update in updates:
                    db.session.add(GeneratedUpdate(
                        employee_id=emp.id,
                        day=update.get('day', '').lower(),
                        content=update.get('content', ''),
                        pipeline_run_id=run.id,
                    ))
                db.session.commit()

            # Stage 2: Extraction
            run.status = 'extracting'
            run.stage = 'extraction'
            db.session.commit()
            log.info("Pipeline [%d] Stage 2: Extracting KPIs...", run.id)

            extractions = {}
            for emp in employees:
                updates = generated.get(emp.id, [])
                result = _extract_kpis(emp, updates)
                total_prompt += result['prompt_tokens']
                total_completion += result['completion_tokens']

                data = result['data']
                extractions[emp.id] = data

                for kpi in data.get('kpis', []):
                    db.session.add(KpiExtraction(
                        employee_id=emp.id,
                        kpi_name=kpi.get('name', ''),
                        target=kpi.get('target', ''),
                        actual=kpi.get('actual', ''),
                        delta=kpi.get('delta', ''),
                        status=kpi.get('status', 'missing'),
                        pipeline_run_id=run.id,
                    ))
                db.session.commit()

            # Stage 3: Reasoning
            run.status = 'reasoning'
            run.stage = 'reasoning'
            db.session.commit()
            log.info("Pipeline [%d] Stage 3: Reasoning about accountability...", run.id)

            for emp in employees:
                updates = generated.get(emp.id, [])
                extraction = extractions.get(emp.id, {})
                result = _reason_accountability(emp, extraction, updates)
                total_prompt += result['prompt_tokens']
                total_completion += result['completion_tokens']

                data = result['data']
                db.session.add(AnalysisResult(
                    employee_id=emp.id,
                    flag_type=data.get('flag_type', 'none'),
                    flag_label=data.get('flag_label', ''),
                    summary=data.get('summary', ''),
                    detail=data.get('detail', ''),
                    recommended_action=data.get('recommended_action', ''),
                    submission_rate=extraction.get('submission_rate', ''),
                    pipeline_run_id=run.id,
                ))
                db.session.commit()

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


def is_pipeline_running():
    """Check if a pipeline run is currently in progress."""
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
