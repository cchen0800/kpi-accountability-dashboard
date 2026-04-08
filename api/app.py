"""KPI Accountability Dashboard — Flask API

Application factory. Registers blueprints, initializes DB, and handles SPA serving.
"""

import os
import logging
import threading

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from config import FLASK_DEBUG, CORS_ORIGIN, SECRET_KEY, SQLALCHEMY_DATABASE_URI, SYNTHETIC_DATA_PATH, DB_DIR
from models import db, Employee, PipelineRun

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)

    app.secret_key = SECRET_KEY

    # Database config
    os.makedirs(DB_DIR, exist_ok=True)
    app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # CORS
    origins = [CORS_ORIGIN]
    if FLASK_DEBUG:
        origins.extend(["http://localhost:3100", "http://localhost:5100"])
    CORS(app, origins=origins, supports_credentials=True)

    # Proxy fix for nginx
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Init extensions
    db.init_app(app)

    # Register blueprints
    from routes.pipeline import pipeline_bp
    from routes.employees import employees_bp
    app.register_blueprint(pipeline_bp)
    app.register_blueprint(employees_bp)

    # Health check
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok"})

    # SPA serving (production)
    _register_spa_routes(app)

    # Init DB and seed employees
    with app.app_context():
        db.create_all()
        log.info("Syncing employee data from synthetic_data.json...")
        Employee.seed_from_json(SYNTHETIC_DATA_PATH)
        log.info("Employee data synced.")

        # Auto-run pipeline if no analysis data exists (safety net)
        has_data = PipelineRun.query.filter_by(status='complete').first() is not None
        if not has_data:
            if not FLASK_DEBUG or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
                log.info("No analysis data found. Auto-running pipeline...")
                from pipeline import run_pipeline
                t = threading.Thread(target=run_pipeline, args=(app,), daemon=True)
                t.start()

    return app


def _register_spa_routes(app):
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')
    if not os.path.isdir(dist_dir):
        return

    @app.route("/assets/<path:filename>")
    def serve_assets(filename):
        return send_from_directory(os.path.join(dist_dir, "assets"), filename)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        return send_from_directory(dist_dir, "index.html")


app = create_app()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5100"))
    app.run(debug=FLASK_DEBUG, port=port, host=host)
