"""Pipeline trigger and status endpoints."""

import os
import threading
import time
from collections import deque
from flask import Blueprint, jsonify, g, request

from models import PipelineRun
from pipeline import run_pipeline, run_stage, is_pipeline_running
from routes.auth import _send_telegram

pipeline_bp = Blueprint('pipeline', __name__)


# Per-IP rate limit on pipeline triggers. Each /api/pipeline/run* hit is 3-12+
# GPT calls, so unguarded this is a budget hole on a public demo. Defaults are
# tuned for "curious visitor pokes around once or twice" — override via env on
# trusted environments.
_PIPELINE_RATE_WINDOW_SEC = int(os.environ.get("PIPELINE_RATE_WINDOW_SEC", "3600"))
_PIPELINE_RATE_MAX = int(os.environ.get("PIPELINE_RATE_MAX", "5"))
_pipeline_hits: dict[str, deque[float]] = {}
_pipeline_hits_lock = threading.Lock()


def _client_ip() -> str:
    return request.headers.get("X-Real-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or request.remote_addr or "unknown"


def _check_pipeline_rate_limit():
    """Return a Flask error response if the client IP is over the limit, else None."""
    if _PIPELINE_RATE_MAX <= 0:  # disabled
        return None
    ip = _client_ip()
    now = time.monotonic()
    cutoff = now - _PIPELINE_RATE_WINDOW_SEC
    with _pipeline_hits_lock:
        hits = _pipeline_hits.setdefault(ip, deque())
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= _PIPELINE_RATE_MAX:
            retry_after = int(hits[0] + _PIPELINE_RATE_WINDOW_SEC - now) + 1
            return jsonify({
                'error': 'Demo rate limit reached. The pipeline is expensive to run — try again later.',
                'retry_after_seconds': retry_after,
            }), 429
        hits.append(now)
    return None


@pipeline_bp.route('/api/pipeline/run', methods=['POST'])
def trigger_pipeline():
    if is_pipeline_running():
        return jsonify({'error': 'Pipeline already running'}), 409

    limited = _check_pipeline_rate_limit()
    if limited is not None:
        return limited

    from flask import current_app
    app = current_app._get_current_object()
    session_id = g.session_id
    t = threading.Thread(target=run_pipeline, args=(app, session_id), daemon=True)
    t.start()
    return jsonify({'message': 'Pipeline started'}), 202


@pipeline_bp.route('/api/pipeline/run/<stage>', methods=['POST'])
def trigger_stage(stage):
    if stage not in ('generate', 'extract', 'reason'):
        return jsonify({'error': 'Invalid stage'}), 400

    if is_pipeline_running():
        return jsonify({'error': 'Pipeline already running'}), 409

    limited = _check_pipeline_rate_limit()
    if limited is not None:
        return limited

    # Validate stage ordering
    run = PipelineRun.query.order_by(PipelineRun.id.desc()).first()
    if stage == 'extract' and (not run or run.status != 'stage_generate_done'):
        return jsonify({'error': 'Must run Generate stage first'}), 400
    if stage == 'reason' and (not run or run.status != 'stage_extract_done'):
        return jsonify({'error': 'Must run Extract stage first'}), 400

    from flask import current_app
    app = current_app._get_current_object()
    session_id = g.session_id
    ip = request.headers.get("X-Real-IP", request.remote_addr)
    stage_labels = {'generate': 'Generate Standups', 'extract': 'Extract KPIs', 'reason': 'Flag Accountability'}
    _send_telegram(
        f"⚡ <b>Pipeline Stage Started</b>\n"
        f"Stage: <code>{stage_labels.get(stage, stage)}</code>\n"
        f"IP: <code>{ip}</code>"
    )
    t = threading.Thread(target=run_stage, args=(app, stage, session_id), daemon=True)
    t.start()
    return jsonify({'message': f'Stage {stage} started'}), 202


@pipeline_bp.route('/api/pipeline/status')
def pipeline_status():
    # Re-use zombie cleanup on every poll so stale in-progress runs don't linger forever.
    is_pipeline_running()
    run = PipelineRun.query.order_by(PipelineRun.id.desc()).first()
    if not run:
        return jsonify({'status': 'idle', 'stage': None})

    return jsonify({
        'status': run.status,
        'stage': run.stage,
        'error': run.error,
    })


@pipeline_bp.route('/api/pipeline/stage-output/<stage>')
def stage_output(stage):
    if stage not in ('generate', 'extract', 'reason'):
        return jsonify({'error': 'Invalid stage'}), 400

    from models import Employee, GeneratedUpdate, KpiExtraction, AnalysisResult

    # Find the latest run that has completed at least this stage
    run = PipelineRun.query.order_by(PipelineRun.id.desc()).first()
    if not run:
        return jsonify({'error': 'No pipeline run found'}), 404

    employees = {e.id: e for e in Employee.query.all()}

    if stage == 'generate':
        if run.status not in ('stage_generate_done', 'stage_extract_done', 'extracting',
                               'reasoning', 'complete'):
            return jsonify({'error': 'Generate stage not complete'}), 404

        # One sample update per employee (first day)
        previews = []
        for emp_id, emp in employees.items():
            update = GeneratedUpdate.query.filter_by(
                employee_id=emp_id, pipeline_run_id=run.id
            ).first()
            if update:
                previews.append({
                    'name': emp.name, 'role': emp.role,
                    'day': update.day, 'content': update.content,
                })

        total = GeneratedUpdate.query.filter_by(pipeline_run_id=run.id).count()
        return jsonify({'previews': previews, 'total': total, 'employee_count': len(employees)})

    elif stage == 'extract':
        if run.status not in ('stage_extract_done', 'reasoning', 'complete'):
            return jsonify({'error': 'Extract stage not complete'}), 404

        previews = []
        for emp_id, emp in employees.items():
            kpis = KpiExtraction.query.filter_by(
                employee_id=emp_id, pipeline_run_id=run.id
            ).all()
            updates_count = GeneratedUpdate.query.filter_by(
                employee_id=emp_id, pipeline_run_id=run.id
            ).count()
            for kpi in kpis:
                previews.append({
                    'name': emp.name, 'role': emp.role,
                    'kpi_name': kpi.kpi_name, 'target': kpi.target,
                    'actual': kpi.actual, 'delta': kpi.delta,
                    'status': kpi.status,
                    'submission_rate': f"{updates_count}/5",
                })

        total = KpiExtraction.query.filter_by(pipeline_run_id=run.id).count()
        return jsonify({'previews': previews, 'total': total, 'employee_count': len(employees)})

    elif stage == 'reason':
        if run.status not in ('complete',):
            return jsonify({'error': 'Reason stage not complete'}), 404

        previews = []
        for emp_id, emp in employees.items():
            analysis = AnalysisResult.query.filter_by(
                employee_id=emp_id, pipeline_run_id=run.id
            ).first()
            if analysis:
                previews.append({
                    'name': emp.name, 'role': emp.role,
                    'flag_type': analysis.flag_type,
                    'flag_label': analysis.flag_label,
                    'summary': analysis.summary,
                })

        return jsonify({'previews': previews, 'employee_count': len(employees)})


@pipeline_bp.route('/api/pipeline/reset', methods=['POST'])
def reset_pipeline():
    if is_pipeline_running():
        return jsonify({'error': 'Pipeline is running'}), 409

    from models import db, GeneratedUpdate, KpiExtraction, AnalysisResult
    GeneratedUpdate.query.delete()
    KpiExtraction.query.delete()
    AnalysisResult.query.delete()
    PipelineRun.query.delete()
    db.session.commit()
    return jsonify({'message': 'Pipeline data cleared'}), 200


@pipeline_bp.route('/api/pipeline/last-run')
def last_run():
    run = PipelineRun.query.filter_by(status='complete').order_by(PipelineRun.id.desc()).first()
    if not run:
        return jsonify({'has_run': False})

    return jsonify({
        'has_run': True,
        **run.to_dict(),
    })
