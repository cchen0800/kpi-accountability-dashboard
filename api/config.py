"""
Environment variables and Flask configuration.
"""

import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Core secrets
SECRET_KEY = os.environ.get("SECRET_KEY") or os.environ.get("FLASK_SECRET_KEY")
FLASK_DEBUG = os.environ.get("FLASK_DEBUG")

if not SECRET_KEY:
    if FLASK_DEBUG:
        SECRET_KEY = "kpi-dash-dev-key-change-me"
    else:
        raise RuntimeError(
            "SECRET_KEY environment variable is required in production. "
            "Set FLASK_DEBUG=1 for development or provide a secure SECRET_KEY."
        )

# Auth
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")
AUTH_SESSION_MINUTES = int(os.environ.get("AUTH_SESSION_MINUTES", "40"))

# CORS
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:3100")

# OpenAI
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = float(os.environ.get("OPENAI_TIMEOUT_SECONDS", "45"))

# Database
DB_DIR = os.environ.get("DB_DIR", os.path.join(os.path.dirname(__file__), '..', 'data'))
DB_PATH = os.path.join(DB_DIR, "data.db")
SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_PATH}"

# Synthetic data path - check sibling (Docker) then parent (local dev)
_here = os.path.dirname(__file__)
_candidate = os.path.join(_here, 'synthetic_data.json')
SYNTHETIC_DATA_PATH = _candidate if os.path.exists(_candidate) else os.path.join(_here, '..', 'synthetic_data.json')
