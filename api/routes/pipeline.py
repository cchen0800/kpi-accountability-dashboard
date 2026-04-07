"""Pipeline trigger and status endpoints."""

import threading
from flask import Blueprint, jsonify

from models import PipelineRun
from pipeline import run_pipeline, is_pipeline_running

pipeline_bp = Blueprint('pipeline', __name__)


@pipeline_bp.route('/api/pipeline/run', methods=['POST'])
def trigger_pipeline():
    if is_pipeline_running():
        return jsonify({'error': 'Pipeline already running'}), 409

    from flask import current_app
    app = current_app._get_current_object()
    t = threading.Thread(target=run_pipeline, args=(app,), daemon=True)
    t.start()
    return jsonify({'message': 'Pipeline started'}), 202


@pipeline_bp.route('/api/pipeline/status')
def pipeline_status():
    run = PipelineRun.query.order_by(PipelineRun.id.desc()).first()
    if not run:
        return jsonify({'status': 'idle', 'stage': None})

    return jsonify({
        'status': run.status,
        'stage': run.stage,
        'error': run.error,
    })


@pipeline_bp.route('/api/pipeline/last-run')
def last_run():
    run = PipelineRun.query.filter_by(status='complete').order_by(PipelineRun.id.desc()).first()
    if not run:
        return jsonify({'has_run': False})

    return jsonify({
        'has_run': True,
        **run.to_dict(),
    })
