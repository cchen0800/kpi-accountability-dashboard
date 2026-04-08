"""Employee list and detail endpoints."""

from flask import Blueprint, jsonify

from models import Employee, PipelineRun, GeneratedUpdate, KpiExtraction, AnalysisResult

employees_bp = Blueprint('employees', __name__)


@employees_bp.route('/api/employees')
def list_employees():
    # Find the latest completed pipeline run
    latest_run = PipelineRun.query.filter_by(status='complete').order_by(PipelineRun.id.desc()).first()

    employees = Employee.query.all()
    result = []

    for emp in employees:
        data = emp.to_dict()

        if latest_run:
            analysis = AnalysisResult.query.filter_by(
                employee_id=emp.id, pipeline_run_id=latest_run.id
            ).first()
            data['analysis'] = analysis.to_dict() if analysis else None

            kpis = KpiExtraction.query.filter_by(
                employee_id=emp.id, pipeline_run_id=latest_run.id
            ).all()
            data['kpi_extractions'] = [k.to_dict() for k in kpis]
        else:
            data['analysis'] = None
            data['kpi_extractions'] = []

        result.append(data)

    return jsonify(result)


@employees_bp.route('/api/updates')
def all_updates():
    """All employee updates from latest run — for the combined Slack feed."""
    latest_run = PipelineRun.query.filter_by(status='complete').order_by(PipelineRun.id.desc()).first()
    if not latest_run:
        return jsonify([])

    employees = Employee.query.all()
    result = []
    for emp in employees:
        updates = GeneratedUpdate.query.filter_by(
            employee_id=emp.id, pipeline_run_id=latest_run.id
        ).all()
        if updates:
            result.append({
                'id': emp.id,
                'name': emp.name,
                'role': emp.role,
                'updates': [u.to_dict() for u in updates],
            })
    return jsonify(result)


@employees_bp.route('/api/employees/<employee_id>')
def get_employee(employee_id):
    emp = Employee.query.get(employee_id)
    if not emp:
        return jsonify({'error': 'Employee not found'}), 404

    data = emp.to_dict()

    latest_run = PipelineRun.query.filter_by(status='complete').order_by(PipelineRun.id.desc()).first()

    if latest_run:
        # Generated updates
        updates = GeneratedUpdate.query.filter_by(
            employee_id=emp.id, pipeline_run_id=latest_run.id
        ).all()
        data['updates'] = [u.to_dict() for u in updates]

        # KPI extractions
        kpis = KpiExtraction.query.filter_by(
            employee_id=emp.id, pipeline_run_id=latest_run.id
        ).all()
        data['kpi_extractions'] = [k.to_dict() for k in kpis]

        # Analysis result
        analysis = AnalysisResult.query.filter_by(
            employee_id=emp.id, pipeline_run_id=latest_run.id
        ).first()
        data['analysis'] = analysis.to_dict() if analysis else None
    else:
        data['updates'] = []
        data['kpi_extractions'] = []
        data['analysis'] = None

    return jsonify(data)
