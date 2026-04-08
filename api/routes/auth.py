import hashlib
import hmac
import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from config import APP_PASSWORD, SECRET_KEY, AUTH_SESSION_MINUTES
from models import db, PageView

auth_bp = Blueprint("auth", __name__)

TOKEN_LIFETIME = AUTH_SESSION_MINUTES * 60  # seconds


def _make_token(issued_at: int) -> str:
    payload = f"{issued_at}".encode()
    sig = hmac.new(SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()
    return f"{issued_at}.{sig}"


def _verify_token(token: str) -> bool:
    try:
        issued_str, sig = token.split(".", 1)
        issued_at = int(issued_str)
    except (ValueError, AttributeError):
        return False

    if time.time() - issued_at > TOKEN_LIFETIME:
        return False

    expected = hmac.new(SECRET_KEY.encode(), issued_str.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected)


def require_auth():
    """Call from before_request to enforce auth on /api routes."""
    if not APP_PASSWORD:
        return None  # no password set, skip auth

    # Allow auth endpoints, health check, and tracking through
    if request.path in ("/api/auth/login", "/api/auth/check", "/api/health", "/api/track"):
        return None

    # Non-API routes (SPA serving) don't need auth
    if not request.path.startswith("/api/"):
        return None

    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token or not _verify_token(token):
        return jsonify({"error": "Unauthorized"}), 401

    return None


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    if not APP_PASSWORD:
        return jsonify({"token": "none", "expires_in": 0})

    data = request.get_json(silent=True) or {}
    password = data.get("password", "")

    if not hmac.compare_digest(password, APP_PASSWORD):
        return jsonify({"error": "Invalid password"}), 401

    issued_at = int(time.time())
    token = _make_token(issued_at)
    return jsonify({"token": token, "expires_in": TOKEN_LIFETIME})


@auth_bp.route("/api/auth/check")
def check():
    if not APP_PASSWORD:
        return jsonify({"authenticated": True, "auth_required": False})

    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    valid = bool(token and _verify_token(token))
    return jsonify({"authenticated": valid, "auth_required": True})


@auth_bp.route("/api/track", methods=["POST"])
def track():
    data = request.get_json(silent=True) or {}
    view = PageView(
        timestamp=datetime.now(timezone.utc),
        ip=request.headers.get("X-Real-IP", request.remote_addr),
        path=data.get("path", "/"),
        user_agent=request.headers.get("User-Agent", ""),
        referer=request.headers.get("Referer", ""),
    )
    db.session.add(view)
    db.session.commit()
    return jsonify({"ok": True})


@auth_bp.route("/api/views")
def views():
    rows = PageView.query.order_by(PageView.timestamp.desc()).limit(100).all()
    # Group by unique IP
    unique_ips = set()
    visits = []
    for r in rows:
        unique_ips.add(r.ip)
        visits.append({
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "ip": r.ip,
            "path": r.path,
            "user_agent": r.user_agent,
            "referer": r.referer,
        })
    return jsonify({
        "total_views": PageView.query.count(),
        "unique_visitors": len(unique_ips),
        "recent": visits,
    })
