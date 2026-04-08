"""Pipeline trigger and status endpoints."""

import threading
from flask import Blueprint, jsonify, g

from models import PipelineRun
from pipeline import run_pipeline, run_stage, is_pipeline_running

pipeline_bp = Blueprint('pipeline', __name__)


@pipeline_bp.route('/api/pipeline/run', methods=['POST'])
def trigger_pipeline():
    if is_pipeline_running():
        return jsonify({'error': 'Pipeline already running'}), 409

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

    # Validate stage ordering
    run = PipelineRun.query.order_by(PipelineRun.id.desc()).first()
    if stage == 'extract' and (not run or run.status != 'stage_generate_done'):
        return jsonify({'error': 'Must run Generate stage first'}), 400
    if stage == 'reason' and (not run or run.status != 'stage_extract_done'):
        return jsonify({'error': 'Must run Extract stage first'}), 400

    from flask import current_app
    app = current_app._get_current_object()
    session_id = g.session_id
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
