"""
Per-session SQLite database isolation.

Each browser session gets its own SQLite file under data/sessions/.
This prevents concurrent users from interfering with each other's pipeline runs.
"""

import os
import time
import uuid
import json
import logging

from flask import g, request
from sqlalchemy import create_engine

from config import DB_DIR, SYNTHETIC_DATA_PATH

log = logging.getLogger(__name__)

SESSIONS_DIR = os.path.join(DB_DIR, 'sessions')
SESSION_COOKIE = 'sid'
SESSION_MAX_AGE = 86400  # 24 hours

# Cache of session_id -> SQLAlchemy engine
_engines = {}

# Set of session IDs that have already been initialized (tables created + seeded)
_initialized_sessions = set()


def get_engine(session_id):
    """Get or create a SQLAlchemy engine for the given session."""
    if session_id in _engines:
        return _engines[session_id]

    os.makedirs(SESSIONS_DIR, exist_ok=True)
    db_path = os.path.join(SESSIONS_DIR, f'{session_id}.db')
    engine = create_engine(f'sqlite:///{db_path}')
    _engines[session_id] = engine

    return engine


def _seed_employees(session_id, engine):
    """Seed employees into a new session database."""
    from models import Employee
    from sqlalchemy.orm import Session as SASession
    with SASession(engine) as sess:
        existing = sess.query(Employee).first()
        if not existing:
            with open(SYNTHETIC_DATA_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for emp in data['employees']:
                sess.add(Employee(
                    id=emp['id'],
                    name=emp['name'],
                    role=emp['role'],
                    manager=emp['manager'],
                    kpis=json.dumps(emp['kpis']),
                    writing_style=emp['writing_style'],
                    hidden_truth=emp['hidden_truth'],
                ))
            sess.commit()
            log.info("Seeded employees for session %s", session_id)


def _patch_session_get_bind(db):
    """Patch get_bind on ALL Session classes to resolve engine from g.session_id."""
    if getattr(db, '_session_bind_patched', False):
        return

    # Patch both Flask-SQLAlchemy's Session and base SQLAlchemy Session
    from flask_sqlalchemy.session import Session as FSASession
    from sqlalchemy.orm.session import Session as SASession

    for cls in (FSASession, SASession):
        original = cls.get_bind

        def make_patched(orig):
            def session_get_bind(self, mapper=None, clause=None, bind=None, **kwargs):
                if bind is not None:
                    return bind
                # Check Flask request context
                try:
                    sid = g.session_id
                    return get_engine(sid)
                except (AttributeError, RuntimeError):
                    pass
                # Check thread-local for background threads
                local = getattr(bind_session_in_thread, '_local', None)
                if local and hasattr(local, 'session_id'):
                    return get_engine(local.session_id)
                # Fallback to original
                return orig(self, mapper=mapper, clause=clause, bind=bind, **kwargs)
            return session_get_bind

        cls.get_bind = make_patched(original)

    db._session_bind_patched = True


def before_request_handler(db):
    """Assign a session ID and bind db to the session's engine."""
    # Skip session DB setup for auth/health endpoints — they don't need it
    if request.path in ("/api/auth/login", "/api/auth/check", "/api/health", "/api/track"):
        return

    _patch_session_get_bind(db)

    session_id = request.cookies.get(SESSION_COOKIE)
    is_new = False

    if not session_id:
        session_id = uuid.uuid4().hex[:12]
        is_new = True

    g.session_id = session_id
    g.session_is_new = is_new

    engine = get_engine(session_id)

    # Only run create_all + seed once per session per process lifetime
    if session_id not in _initialized_sessions:
        db.metadata.create_all(engine)
        _seed_employees(session_id, engine)
        _initialized_sessions.add(session_id)

    db.session.remove()


def after_request_handler(response):
    """Set the session cookie if this is a new session."""
    if getattr(g, 'session_is_new', False):
        response.set_cookie(
            SESSION_COOKIE,
            g.session_id,
            max_age=None,  # session cookie — expires when browser closes
            httponly=True,
            samesite='Lax',
        )
    return response


def bind_session_in_thread(session_id, db):
    """Bind db to the correct engine inside a background thread."""
    import threading
    if not hasattr(bind_session_in_thread, '_local'):
        bind_session_in_thread._local = threading.local()
    bind_session_in_thread._local.session_id = session_id
    db.session.remove()


def cleanup_old_sessions(max_age=SESSION_MAX_AGE):
    """Delete session DB files older than max_age seconds."""
    if not os.path.isdir(SESSIONS_DIR):
        return

    now = time.time()
    for fname in os.listdir(SESSIONS_DIR):
        if not fname.endswith('.db'):
            continue
        fpath = os.path.join(SESSIONS_DIR, fname)
        try:
            age = now - os.path.getmtime(fpath)
            if age > max_age:
                session_id = fname.replace('.db', '')
                if session_id in _engines:
                    _engines[session_id].dispose()
                    del _engines[session_id]
                os.remove(fpath)
                log.info("Cleaned up session DB: %s (age: %.0fs)", fname, age)
        except OSError:
            pass
