"""
SQLAlchemy models for the KPI Accountability Dashboard.
"""

import json
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Text, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    role = db.Column(db.Text, nullable=False)
    manager = db.Column(db.Text, nullable=False)
    kpis = db.Column(db.Text, nullable=False)  # JSON string
    writing_style = db.Column(db.Text, nullable=False)
    hidden_truth = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'manager': self.manager,
            'kpis': json.loads(self.kpis),
            'writing_style': self.writing_style,
        }

    @classmethod
    def seed_from_json(cls, path):
        """Load employee profiles from synthetic_data.json and upsert into the DB."""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for emp in data['employees']:
            existing = cls.query.get(emp['id'])
            if existing:
                existing.name = emp['name']
                existing.role = emp['role']
                existing.manager = emp['manager']
                existing.kpis = json.dumps(emp['kpis'])
                existing.writing_style = emp['writing_style']
                existing.hidden_truth = emp['hidden_truth']
            else:
                db.session.add(cls(
                    id=emp['id'],
                    name=emp['name'],
                    role=emp['role'],
                    manager=emp['manager'],
                    kpis=json.dumps(emp['kpis']),
                    writing_style=emp['writing_style'],
                    hidden_truth=emp['hidden_truth'],
                ))
        db.session.commit()


class PipelineRun(db.Model):
    __tablename__ = 'pipeline_runs'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.Text, default='pending')  # pending/generating/extracting/reasoning/complete/error
    stage = db.Column(db.Text)  # generation/extraction/reasoning
    error = db.Column(db.Text)
    total_tokens = db.Column(db.Integer, default=0)
    total_cost_cents = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'id': self.id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'stage': self.stage,
            'error': self.error,
            'total_tokens': self.total_tokens,
            'total_cost_cents': self.total_cost_cents,
            'duration_seconds': (self.completed_at - self.started_at).total_seconds() if self.completed_at and self.started_at else None,
        }


class GeneratedUpdate(db.Model):
    __tablename__ = 'generated_updates'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Text, db.ForeignKey('employees.id'), nullable=False)
    day = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text, nullable=False)
    pipeline_run_id = db.Column(db.Integer, db.ForeignKey('pipeline_runs.id'), nullable=False)

    def to_dict(self):
        return {
            'day': self.day,
            'content': self.content,
        }


class KpiExtraction(db.Model):
    __tablename__ = 'kpi_extractions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Text, db.ForeignKey('employees.id'), nullable=False)
    kpi_name = db.Column(db.Text, nullable=False)
    target = db.Column(db.Text)
    actual = db.Column(db.Text)
    delta = db.Column(db.Text)
    status = db.Column(db.Text)  # on_track/at_risk/missing
    pipeline_run_id = db.Column(db.Integer, db.ForeignKey('pipeline_runs.id'), nullable=False)

    def to_dict(self):
        return {
            'kpi_name': self.kpi_name,
            'target': self.target,
            'actual': self.actual,
            'delta': self.delta,
            'status': self.status,
        }


class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    employee_id = db.Column(db.Text, db.ForeignKey('employees.id'), nullable=False)
    flag_type = db.Column(db.Text)  # none/optimism_gap/submission_gap/vanity_metrics/no_progress/other
    flag_label = db.Column(db.Text)
    summary = db.Column(db.Text)
    detail = db.Column(db.Text)
    recommended_action = db.Column(db.Text)
    submission_rate = db.Column(db.Text)
    pipeline_run_id = db.Column(db.Integer, db.ForeignKey('pipeline_runs.id'), nullable=False)

    def to_dict(self):
        return {
            'flag_type': self.flag_type,
            'flag_label': self.flag_label,
            'summary': self.summary,
            'detail': self.detail,
            'recommended_action': self.recommended_action,
            'submission_rate': self.submission_rate,
        }


class PageView(db.Model):
    __tablename__ = 'page_views'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime, nullable=False)
    ip = db.Column(db.Text)
    path = db.Column(db.Text)
    user_agent = db.Column(db.Text)
    referer = db.Column(db.Text)
