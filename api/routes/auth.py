import hashlib
import hmac
import logging
import time
import threading
from datetime import datetime, timezone

import requests as http_requests
from flask import Blueprint, jsonify, request

from config import APP_PASSWORD, SECRET_KEY, AUTH_SESSION_MINUTES
from models import db, PageView

log = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = "8768789762:AAF7WmVWD0eoSt1g3qfHA_CJprCcpRNcCOU"
TELEGRAM_CHAT_ID = "7477285272"


def _send_telegram(message):
    """Send a Telegram message in a background thread so it doesn't block the request."""
    def _do():
        try:
            http_requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "HTML"},
                timeout=5,
            )
        except Exception as e:
            log.warning(f"Telegram send failed: {e}")
    threading.Thread(target=_do, daemon=True).start()

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

    ip = request.headers.get("X-Real-IP", request.remote_addr)

    if not hmac.compare_digest(password, APP_PASSWORD):
        _send_telegram(
            f"🔴 <b>Failed Login</b>\n"
            f"IP: <code>{ip}</code>\n"
            f"Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
        )
        return jsonify({"error": "Invalid password"}), 401

    issued_at = int(time.time())
    token = _make_token(issued_at)
    _send_telegram(
        f"🟢 <b>User Logged In</b>\n"
        f"IP: <code>{ip}</code>\n"
        f"Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
    )
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
    ip = request.headers.get("X-Real-IP", request.remote_addr)
    path = data.get("path", "/")
    ua = request.headers.get("User-Agent", "")
    view = PageView(
        timestamp=datetime.now(timezone.utc),
        ip=ip,
        path=path,
        user_agent=ua,
        referer=request.headers.get("Referer", ""),
    )
    db.session.add(view)
    db.session.commit()

    # Telegram notification
    short_ua = ua[:60] + "..." if len(ua) > 60 else ua
    _send_telegram(
        f"📊 <b>Page View</b>\n"
        f"Path: <code>{path}</code>\n"
        f"IP: <code>{ip}</code>\n"
        f"UA: <code>{short_ua}</code>\n"
        f"Time: {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
    )
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
