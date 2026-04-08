"""
Three-stage agentic pipeline: Generate → Extract → Reason

Stage 1 (Generation): Loads pre-written standup sets from synthetic_data.json (rotating)
Stage 2 (Extraction): GPT extracts structured KPI data from updates (no hidden_truth)
Stage 3 (Reasoning): GPT reasons over extracted data to assign flags + narrative (no hidden_truth)
"""

import json
import logging
import os
import random
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone

from models import db, Employee, PipelineRun, GeneratedUpdate, KpiExtraction, AnalysisResult
from openai_client import call_gpt, estimate_cost_cents
from config import OPENAI_MODEL, OPENAI_TIMEOUT_SECONDS, SYNTHETIC_DATA_PATH

log = logging.getLogger(__name__)

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]
MISSING_TOKENS = {"", "-", "-", "n/a", "na", "unknown", "none", "not provided"}
REASON_WORKER_TIMEOUT_SECONDS = max(OPENAI_TIMEOUT_SECONDS + 5.0, 30.0)


def _load_standup_sets():
    """Load pre-written standup sets from synthetic_data.json."""
    json_path = SYNTHETIC_DATA_PATH
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('standup_sets', [])


def _as_kpi_list(raw_kpis):
    if isinstance(raw_kpis, list):
        return [str(k).strip() for k in raw_kpis if str(k).strip()]
    if raw_kpis is None:
        return []
    if isinstance(raw_kpis, str):
        text = raw_kpis.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(k).strip() for k in parsed if str(k).strip()]
        except Exception:
            pass
        return [text]
    return [str(raw_kpis).strip()]



def _clean_str(value):
    return str(value or "").strip()


def _coerce_text(value):
    """Normalize GPT output fields to plain text for DB storage."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = [_coerce_text(item) for item in value]
        return "\n".join(part for part in parts if part)
    if isinstance(value, dict):
        try:
            return json.dumps(value, ensure_ascii=False)
        except Exception:
            return str(value)
    return str(value).strip()


def _is_missing_value(value):
    return _clean_str(value).lower() in MISSING_TOKENS


def _extract_first_number(text):
    match = re.search(r"-?\d+(?:\.\d+)?", _clean_str(text))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def _format_number(value):
    if value is None:
        return "-"
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.1f}"


def _normalize_status(status):
    s = _clean_str(status).lower().replace("-", "_")
    if s in ("on_track", "ontrack"):
        return "on_track"
    if s in ("at_risk", "atrisk"):
        return "at_risk"
    if s == "missing":
        return "missing"
    return ""


def _delta_valid(delta):
    d = _clean_str(delta)
    if _is_missing_value(d):
        return False
    return re.match(r"^[+-]?\d+(?:\.\d+)?(?:\s?(?:%|x|hours?|hrs?|hr))?$", d.lower()) is not None


def _target_number(target):
    return _extract_first_number(target)


def _kpi_kind(kpi_text):
    text = (kpi_text or "").lower()
    if "/week" in text and "response time" not in text:
        return "count_week"
    if "response time" in text or "hr" in text:
        return "duration_threshold"
    if "quarter" in text or "end of quarter" in text:
        return "quarter_outcome"
    return "generic"


def _kpi_display_name(kpi_text):
    text = (kpi_text or "").strip()
    lower = text.lower()
    if "response time" in lower:
        return "Creator response time"
    if "renew" in lower and "account" in lower:
        return "Renew enterprise accounts"
    if "expansion revenue" in lower:
        return "Expansion revenue from existing book"
    if "creator matching" in lower:
        return "Ship Creator Matching v2"
    if "user research" in lower and "session" in lower:
        return "Run user research sessions"
    if "outbound dials" in lower:
        return "Outbound dials"
    if "meetings" in lower and "booked" in lower:
        return "Qualified meetings booked"
    if "experiments" in lower:
        return "Paid social experiments launched"
    if "cac" in lower:
        return "Reduce CAC"
    if "onboard" in lower and "creator" in lower:
        return "Onboard new creators"

    cleaned = re.sub(r"<\s*\d+\s*hr", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b\d+(?:\.\d+)?%?\b", "", cleaned)
    cleaned = cleaned.replace("/week", "")
    cleaned = re.sub(r"\b(this|the)?\s*quarter\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -/")
    return cleaned or text


def _kpi_target_value(kpi_text):
    text = (kpi_text or "").strip()
    lower = text.lower()

    hr = re.search(r"<\s*(\d+(?:\.\d+)?)\s*hr", lower)
    if hr:
        return f"<{_format_number(float(hr.group(1)))}hr"

    pct = re.search(r"(\d+(?:\.\d+)?)\s*%", lower)
    if pct:
        return f"{_format_number(float(pct.group(1)))}%"

    num = re.search(r"(\d+(?:\.\d+)?)", lower)
    if "/week" in lower and num:
        return f"{_format_number(float(num.group(1)))}/week"
    if "end of quarter" in lower:
        return "end of quarter"
    if "quarter" in lower and num:
        return _format_number(float(num.group(1)))
    return text


def _build_expected_kpis(raw_kpis):
    expected = []
    for source in _as_kpi_list(raw_kpis):
        expected.append({
            "source": source,
            "name": _kpi_display_name(source),
            "target": _kpi_target_value(source),
            "kind": _kpi_kind(source),
        })
    return expected


def _tokenize(text):
    return {
        token
        for token in re.findall(r"[a-z0-9]+", (text or "").lower())
        if len(token) > 2 and token not in {"with", "from", "this", "that", "week", "quarter"}
    }


def _kpi_similarity(a, b):
    ta, tb = _tokenize(a), _tokenize(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def _match_extracted_kpi_rows(expected_kpis, extracted_rows):
    row_by_idx = {}
    if not isinstance(extracted_rows, list):
        return row_by_idx

    used = set()
    for row in extracted_rows:
        if not isinstance(row, dict):
            continue
        row_text = f"{row.get('name', '')} {row.get('target', '')}"
        best_idx, best_score = None, 0.0
        for idx, spec in enumerate(expected_kpis):
            if idx in used:
                continue
            score = max(
                _kpi_similarity(row_text, spec["name"]),
                _kpi_similarity(row_text, spec["source"]),
            )
            if score > best_score:
                best_idx, best_score = idx, score
        if best_idx is not None and best_score >= 0.20:
            row_by_idx[best_idx] = row
            used.add(best_idx)
    return row_by_idx


def _extract_count_total_for_kpi(kpi_text, updates):
    text = (kpi_text or "").lower()
    if "creator" in text and "onboard" in text:
        numeric_pattern = r"(\d+(?:\.\d+)?)\s+(?:new\s+)?creators?"
        another_pattern = r"\banother\s+(?:new\s+)?creators?\b"
        zero_pattern = r"\b(?:0|zero|no)\s+(?:new\s+)?creators?\b"
    elif "experiment" in text:
        numeric_pattern = r"(\d+(?:\.\d+)?)\s+(?:new\s+)?(?:paid\s+social\s+)?experiments?"
        another_pattern = r"\banother\s+(?:new\s+)?(?:paid\s+social\s+)?experiment\b"
        zero_pattern = r"\b(?:0|zero|no)\s+(?:new\s+)?(?:paid\s+social\s+)?experiments?\b"
    elif "dial" in text:
        numeric_pattern = r"(\d+(?:\.\d+)?)\s+(?:outbound\s+)?dials?"
        another_pattern = r"\banother\s+(?:outbound\s+)?dial\b"
        zero_pattern = r"\b(?:0|zero|no)\s+(?:outbound\s+)?dials?\b"
    elif "meeting" in text and "book" in text:
        numeric_pattern = r"(\d+(?:\.\d+)?)\s+(?:qualified\s+)?meetings?(?:\s+booked)?"
        another_pattern = r"\banother\s+(?:qualified\s+)?meeting(?:\s+booked)?\b"
        zero_pattern = r"\b(?:0|zero|no)\s+(?:qualified\s+)?meetings?(?:\s+booked)?\b"
    elif "research" in text and "session" in text:
        numeric_pattern = r"(\d+(?:\.\d+)?)\s+(?:user\s+research\s+)?sessions?"
        another_pattern = r"\banother\s+(?:user\s+research\s+)?session\b"
        zero_pattern = r"\b(?:0|zero|no)\s+(?:additional\s+)?(?:user\s+research\s+)?sessions?\b"
    else:
        return None

    def parse_value(content):
        m = re.search(numeric_pattern, content)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                return None
        if re.search(another_pattern, content):
            return 1.0
        if re.search(zero_pattern, content):
            return 0.0
        return None

    total = 0.0
    seen = 0
    for update in updates:
        content = (update.get("content") or "").lower()
        value = parse_value(content)
        if value is None:
            continue
        total += value
        seen += 1
    return total if seen else None


def _count_metric_coverage(kpi_text, updates):
    text = (kpi_text or "").lower()
    if "creator" in text and "onboard" in text:
        patterns = (
            r"(\d+(?:\.\d+)?)\s+(?:new\s+)?creators?",
            r"\banother\s+(?:new\s+)?creators?\b",
            r"\b(?:0|zero|no)\s+(?:new\s+)?creators?\b",
        )
    elif "experiment" in text:
        patterns = (
            r"(\d+(?:\.\d+)?)\s+(?:new\s+)?(?:paid\s+social\s+)?experiments?",
            r"\banother\s+(?:new\s+)?(?:paid\s+social\s+)?experiment\b",
            r"\b(?:0|zero|no)\s+(?:new\s+)?(?:paid\s+social\s+)?experiments?\b",
        )
    elif "dial" in text:
        patterns = (
            r"(\d+(?:\.\d+)?)\s+(?:outbound\s+)?dials?",
            r"\banother\s+(?:outbound\s+)?dial\b",
            r"\b(?:0|zero|no)\s+(?:outbound\s+)?dials?\b",
        )
    elif "meeting" in text and "book" in text:
        patterns = (
            r"(\d+(?:\.\d+)?)\s+(?:qualified\s+)?meetings?(?:\s+booked)?",
            r"\banother\s+(?:qualified\s+)?meeting(?:\s+booked)?\b",
            r"\b(?:0|zero|no)\s+(?:qualified\s+)?meetings?(?:\s+booked)?\b",
        )
    elif "research" in text and "session" in text:
        patterns = (
            r"(\d+(?:\.\d+)?)\s+(?:user\s+research\s+)?sessions?",
            r"\banother\s+(?:user\s+research\s+)?session\b",
            r"\b(?:0|zero|no)\s+(?:additional\s+)?(?:user\s+research\s+)?sessions?\b",
        )
    else:
        return 0

    covered = 0
    for update in updates:
        content = (update.get("content") or "").lower()
        if any(re.search(pattern, content) for pattern in patterns):
            covered += 1
    return covered


def _extract_duration_avg_hours(updates):
    hours = []
    for update in updates:
        content = (update.get("content") or "").lower()
        for match in re.findall(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b", content):
            try:
                hours.append(float(match))
            except ValueError:
                pass
    if not hours:
        return None
    return sum(hours) / len(hours)


def _has_numeric_evidence(kpi_text, updates):
    keywords = _tokenize(kpi_text)
    for update in updates:
        content = (update.get("content") or "").lower()
        if not re.search(r"\d", content):
            continue
        if any(keyword in content for keyword in keywords):
            return True
    return False


def _missing_kpi_row(spec):
    return {
        "name": spec["name"],
        "target": spec["target"],
        "actual": "-",
        "delta": "-",
        "status": "missing",
    }


def _derive_delta(target, actual, kind):
    t = _target_number(target)
    a = _extract_first_number(actual)
    if t is None or a is None:
        return "-"

    diff = a - t
    if kind == "duration_threshold":
        return f"{_format_number(diff)} hours" if diff < 0 else f"+{_format_number(diff)} hours"
    if "%" in (target or ""):
        sign = "+" if diff >= 0 else ""
        return f"{sign}{_format_number(diff)}%"
    sign = "+" if diff >= 0 else ""
    return f"{sign}{_format_number(diff)}"


def _normalize_actual(actual_str, spec):
    """Clean GPT actual values to a consistent numeric format."""
    actual = _clean_str(actual_str)
    if _is_missing_value(actual):
        return actual

    # Normalize to clean numeric format matching target style
    n = _extract_first_number(actual)
    if n is not None:
        if "%" in spec["target"]:
            return f"{_format_number(n)}%"
        if spec["kind"] == "duration_threshold":
            return f"{_format_number(n)} hours"
        if "/week" in spec["target"]:
            return _format_number(n)
        return _format_number(n)

    return actual


def _normalize_model_row(spec, row, updates):
    if not isinstance(row, dict):
        return _missing_kpi_row(spec)

    actual = _normalize_actual(row.get("actual"), spec)

    if _is_missing_value(actual):
        return _missing_kpi_row(spec)

    # Always recalculate delta from actual vs target (GPT deltas are unreliable)
    delta = _derive_delta(spec["target"], actual, spec["kind"])

    # Always recalculate status from actual vs target
    t = _target_number(spec["target"])
    a = _extract_first_number(actual)
    if a is None:
        status = "missing"
    elif spec["kind"] == "duration_threshold" and t is not None:
        status = "on_track" if a <= t else "at_risk"
    elif t is not None:
        status = "on_track" if a >= t else "at_risk"
    else:
        status = "at_risk"

    return {
        "name": spec["name"],
        "target": spec["target"],
        "actual": actual,
        "delta": delta if not _is_missing_value(delta) else "-",
        "status": status,
    }


def _extract_quarter_progress(spec, updates):
    """Scan updates for qualitative progress signals for quarter_outcome KPIs.
    Returns a normalized row dict or None if no signals found."""
    kpi_tokens = _tokenize(spec["source"])
    status_re = re.compile(
        r"\b(renewed?|stalled|blocked|shipped|delayed|signed|slipping|on track|behind|paused|pending|no progress)\b",
        re.IGNORECASE,
    )
    statuses_found = []
    for update in updates:
        content = (update.get("content") or "").lower()
        if not any(tok in content for tok in kpi_tokens):
            continue
        matches = status_re.findall(content)
        statuses_found.extend(matches)

    if not statuses_found:
        return None

    negative = {"stalled", "blocked", "delayed", "slipping", "behind", "paused", "no progress"}
    has_negative = any(s.lower() in negative for s in statuses_found)
    status = "at_risk" if has_negative else "on_track"

    target_num = _target_number(spec["target"])
    status_summary = ", ".join(dict.fromkeys(s.lower() for s in statuses_found))
    actual = status_summary if not target_num else f"0/{int(target_num)} - {status_summary}"
    delta = "behind schedule" if has_negative else "progressing"

    return {
        "name": spec["name"],
        "target": spec["target"],
        "actual": actual,
        "delta": delta,
        "status": status,
    }


def _normalize_extracted_kpis(emp, raw_data, updates):
    expected = _build_expected_kpis(emp.kpis)
    extracted_rows = (raw_data or {}).get("kpis", [])
    by_expected_idx = _match_extracted_kpi_rows(expected, extracted_rows)

    normalized = []
    for idx, spec in enumerate(expected):
        row = by_expected_idx.get(idx)

        if spec["kind"] == "count_week":
            # Prefer GPT-extracted values; fall back to regex parsing
            if row and not _is_missing_value(_clean_str(row.get("actual"))):
                normalized.append(_normalize_model_row(spec, row, updates))
                continue
            total = _extract_count_total_for_kpi(spec["source"], updates)
            target = _target_number(spec["target"])
            if total is None or target is None:
                normalized.append(_missing_kpi_row(spec))
                continue
            delta = total - target
            normalized.append({
                "name": spec["name"],
                "target": spec["target"],
                "actual": _format_number(total),
                "delta": f"+{_format_number(delta)}" if delta >= 0 else _format_number(delta),
                "status": "on_track" if total >= target else "at_risk",
            })
            continue

        if spec["kind"] == "duration_threshold":
            # Prefer GPT-extracted values; fall back to regex parsing
            if row and not _is_missing_value(_clean_str(row.get("actual"))):
                normalized.append(_normalize_model_row(spec, row, updates))
                continue
            avg_hours = _extract_duration_avg_hours(updates)
            target = _target_number(spec["target"])
            if avg_hours is None or target is None:
                normalized.append(_missing_kpi_row(spec))
                continue
            delta = avg_hours - target
            normalized.append({
                "name": spec["name"],
                "target": spec["target"],
                "actual": f"{_format_number(avg_hours)} hours",
                "delta": f"+{_format_number(delta)} hours" if delta >= 0 else f"{_format_number(delta)} hours",
                "status": "on_track" if avg_hours <= target else "at_risk",
            })
            continue

        if spec["kind"] == "quarter_outcome":
            # Prefer GPT-extracted values; fall back to qualitative scan
            if row and not _is_missing_value(_clean_str(row.get("actual"))):
                normalized.append(_normalize_model_row(spec, row, updates))
                continue
            fallback = _extract_quarter_progress(spec, updates)
            if fallback:
                normalized.append(fallback)
                continue
            normalized.append(_missing_kpi_row(spec))
            continue

        normalized.append(_normalize_model_row(spec, row, updates))

    return normalized



def run_pipeline(app, session_id=None):
    """Main pipeline orchestrator. Runs in a background thread."""
    with app.app_context():
        if session_id:
            from session_db import bind_session_in_thread
            bind_session_in_thread(session_id, db)

        run = PipelineRun(started_at=datetime.now(timezone.utc), status='pending')
        db.session.add(run)
        db.session.commit()

        total_prompt = 0
        total_completion = 0

        try:
            employees = Employee.query.all()
            _clear_previous_data(run.id)

            # Stage 1: Generation
            p, c = _run_generate_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Stage 2: Extraction
            p, c = _run_extract_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Stage 3: Reasoning
            p, c = _run_reason_stage(run, employees)
            total_prompt += p
            total_completion += c

            # Complete
            run.status = 'complete'
            run.stage = None
            run.completed_at = datetime.now(timezone.utc)
            run.total_tokens = total_prompt + total_completion
            run.total_cost_cents = estimate_cost_cents(OPENAI_MODEL, total_prompt, total_completion)
            db.session.commit()
            log.info("Pipeline [%d] Complete. Tokens: %d, Cost: $%.4f",
                     run.id, run.total_tokens, run.total_cost_cents / 100)

        except Exception as e:
            db.session.rollback()
            run_id = getattr(run, 'id', 'unknown')
            log.exception("Pipeline [%s] failed: %s", run_id, e)
            if isinstance(run_id, int):
                run = db.session.get(PipelineRun, run_id)
            if run is None:
                return
            run.status = 'error'
            run.error = str(e)
            run.completed_at = datetime.now(timezone.utc)
            run.total_tokens = total_prompt + total_completion
            run.total_cost_cents = estimate_cost_cents(OPENAI_MODEL, total_prompt, total_completion)
            db.session.commit()


def run_stage(app, stage, session_id=None):
    """Run a single pipeline stage. Called from per-stage API endpoints."""
    with app.app_context():
        if session_id:
            from session_db import bind_session_in_thread
            bind_session_in_thread(session_id, db)

        # Get or create a pipeline run
        run = PipelineRun.query.filter(
            PipelineRun.status.in_(['stage_generate_done', 'stage_extract_done', 'pending'])
        ).order_by(PipelineRun.id.desc()).first()

        if stage == 'generate':
            # Always start a fresh run for generate
            run = PipelineRun(started_at=datetime.now(timezone.utc), status='pending')
            db.session.add(run)
            db.session.commit()
            _clear_previous_data(run.id)

        if not run:
            log.error("No active pipeline run found for stage %s", stage)
            return

        total_prompt = 0
        total_completion = 0

        try:
            employees = Employee.query.all()

            if stage == 'generate':
                p, c = _run_generate_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'stage_generate_done'
                run.stage = None

            elif stage == 'extract':
                p, c = _run_extract_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'stage_extract_done'
                run.stage = None

            elif stage == 'reason':
                p, c = _run_reason_stage(run, employees)
                total_prompt += p
                total_completion += c
                run.status = 'complete'
                run.stage = None
                run.completed_at = datetime.now(timezone.utc)

            run.total_tokens = (run.total_tokens or 0) + total_prompt + total_completion
            run.total_cost_cents = (run.total_cost_cents or 0) + estimate_cost_cents(
                OPENAI_MODEL, total_prompt, total_completion
            )
            db.session.commit()
            log.info("Pipeline [%d] Stage '%s' complete.", run.id, stage)

        except Exception as e:
            db.session.rollback()
            run_id = getattr(run, 'id', 'unknown')
            log.exception("Pipeline [%s] stage '%s' failed: %s", run_id, stage, e)
            if isinstance(run_id, int):
                run = db.session.get(PipelineRun, run_id)
            if run is None:
                return
            run.status = 'error'
            run.error = str(e)
            run.completed_at = datetime.now(timezone.utc)
            db.session.commit()


def _snapshot_employees(employees):
    """Snapshot SQLAlchemy employee objects to plain dicts for thread safety."""
    snaps = []
    for emp in employees:
        snaps.append(type('Emp', (), {
            'id': emp.id, 'name': emp.name, 'role': emp.role,
            'kpis': emp.kpis, 'writing_style': emp.writing_style,
            'hidden_truth': emp.hidden_truth,
        })())
    return snaps


def _run_generate_stage(run, employees):
    """Stage 1: Load pre-written standup updates. Returns (0, 0) — no API calls."""
    run.status = 'generating'
    run.stage = 'generation'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 1: Loading standup set...", run_id)

    standup_sets = _load_standup_sets()
    if not standup_sets:
        raise ValueError("No standup sets found in synthetic_data.json")

    set_index = random.randrange(len(standup_sets))
    selected_set = standup_sets[set_index]
    log.info("Pipeline [%d] Using standup set %d of %d (random)", run_id, set_index + 1, len(standup_sets))

    for update in selected_set:
        db.session.add(GeneratedUpdate(
            employee_id=update['employee_id'],
            day=update['day'].lower(),
            content=update['text'],
            pipeline_run_id=run_id,
        ))
    db.session.commit()
    return 0, 0


def _run_extract_stage(run, employees):
    """Stage 2: Extract KPIs from generated updates. Returns (prompt_tokens, completion_tokens)."""
    run.status = 'extracting'
    run.stage = 'extraction'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 2: Extracting KPIs...", run_id)

    emps = _snapshot_employees(employees)

    # Pre-fetch updates for all employees
    emp_updates = {}
    for emp in emps:
        updates_db = GeneratedUpdate.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        emp_updates[emp.id] = [{'day': u.day, 'content': u.content} for u in updates_db]

    # Parallelize GPT calls
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_extract_kpis, emp, emp_updates[emp.id]): emp for emp in emps}

    total_p, total_c = 0, 0
    for future, emp in futures.items():
        try:
            result = future.result()
            total_p += result['prompt_tokens']
            total_c += result['completion_tokens']

            data = result['data']
            normalized_kpis = _normalize_extracted_kpis(emp, data, emp_updates[emp.id])
        except Exception:
            log.exception("Stage 2 extraction failed for %s - inserting missing KPI rows", emp.name)
            expected = _build_expected_kpis(emp.kpis)
            normalized_kpis = [_missing_kpi_row(spec) for spec in expected]

        for kpi in normalized_kpis:
            db.session.add(KpiExtraction(
                employee_id=emp.id,
                kpi_name=kpi.get('name', ''),
                target=kpi.get('target', ''),
                actual=kpi.get('actual', ''),
                delta=kpi.get('delta', ''),
                status=kpi.get('status', 'missing'),
                pipeline_run_id=run_id,
            ))
    db.session.commit()
    return total_p, total_c


def _run_reason_stage(run, employees):
    """Stage 3: Reason about accountability. Returns (prompt_tokens, completion_tokens)."""
    run.status = 'reasoning'
    run.stage = 'reasoning'
    run_id = run.id
    db.session.commit()
    log.info("Pipeline [%d] Stage 3: Reasoning about accountability...", run_id)

    emps = _snapshot_employees(employees)

    # Pre-fetch data for all employees
    emp_data = {}
    for emp in emps:
        updates_db = GeneratedUpdate.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        updates = [{'day': u.day, 'content': u.content} for u in updates_db]

        kpis_db = KpiExtraction.query.filter_by(employee_id=emp.id, pipeline_run_id=run_id).all()
        extraction = {
            'kpis': [{'name': k.kpi_name, 'target': k.target, 'actual': k.actual,
                       'delta': k.delta, 'status': k.status} for k in kpis_db],
            'submission_rate': f"{len(updates)}/5",
        }
        emp_data[emp.id] = (extraction, updates)

    total_p, total_c = 0, 0
    pool = ThreadPoolExecutor(max_workers=5)
    futures = {
        pool.submit(_reason_accountability, emp, emp_data[emp.id][0], emp_data[emp.id][1]): emp
        for emp in emps
    }

    try:
        for future, emp in futures.items():
            extraction = emp_data[emp.id][0]
            try:
                result = future.result(timeout=REASON_WORKER_TIMEOUT_SECONDS)
                total_p += result['prompt_tokens']
                total_c += result['completion_tokens']
                data = result['data']
            except FuturesTimeoutError:
                log.error(
                    "Stage 3 reasoning timed out for %s after %.1fs - inserting fallback result",
                    emp.name,
                    REASON_WORKER_TIMEOUT_SECONDS,
                )
                future.cancel()
                data = {
                    'flag_type': 'none',
                    'flag_label': 'Timed Out',
                    'summary': 'Reasoning stage timed out for this employee.',
                    'detail': '',
                    'recommended_action': '',
                }
            except Exception:
                log.exception("Stage 3 reasoning failed for %s - inserting fallback result", emp.name)
                data = {
                    'flag_type': 'none',
                    'flag_label': 'Error',
                    'summary': 'Reasoning stage failed for this employee.',
                    'detail': '',
                    'recommended_action': '',
                }

            if not isinstance(data, dict):
                data = {}
            flag_type = _clean_str(data.get('flag_type', 'none')).lower() or 'none'
            if flag_type not in {'none', 'no_progress', 'vanity_metrics', 'optimism_gap', 'submission_gap', 'other'}:
                flag_type = 'none'

            db.session.add(AnalysisResult(
                employee_id=emp.id,
                flag_type=flag_type,
                flag_label=_coerce_text(data.get('flag_label', '')),
                summary=_coerce_text(data.get('summary', '')),
                detail=_coerce_text(data.get('detail', '')),
                recommended_action=_coerce_text(data.get('recommended_action', '')),
                submission_rate=extraction.get('submission_rate', ''),
                pipeline_run_id=run_id,
            ))
    finally:
        # Do not block forever on executor shutdown if a worker got stuck in an external call.
        pool.shutdown(wait=False, cancel_futures=True)

    db.session.commit()
    return total_p, total_c


def is_pipeline_running():
    """Check if a pipeline run is currently in progress. Cleans up zombies older than 5 min."""
    stuck = PipelineRun.query.filter(
        PipelineRun.status.in_(['pending', 'generating', 'extracting', 'reasoning'])
    ).all()

    now = datetime.now(timezone.utc)
    for run in stuck:
        try:
            started = run.started_at
            if started and started.tzinfo is None:
                # SQLite commonly returns naive datetimes. In this app, run timestamps are
                # written as UTC, so treat naive values as UTC for timeout checks.
                started = started.replace(tzinfo=timezone.utc)
            age = (now - started).total_seconds() if started else 999
        except Exception:
            age = 999
        if age > 300:  # 5 minute timeout
            log.warning("Pipeline [%d] stuck for %.0fs - marking as error", run.id, age)
            run.status = 'error'
            run.error = 'Timed out'
            run.completed_at = datetime.now(timezone.utc)
            db.session.commit()

    return PipelineRun.query.filter(
        PipelineRun.status.in_(['pending', 'generating', 'extracting', 'reasoning'])
    ).first() is not None


def _clear_previous_data(current_run_id):
    """Remove data from previous runs (keep current)."""
    GeneratedUpdate.query.filter(GeneratedUpdate.pipeline_run_id != current_run_id).delete()
    KpiExtraction.query.filter(KpiExtraction.pipeline_run_id != current_run_id).delete()
    AnalysisResult.query.filter(AnalysisResult.pipeline_run_id != current_run_id).delete()
    PipelineRun.query.filter(
        PipelineRun.id != current_run_id,
        PipelineRun.status.in_(['complete', 'error'])
    ).delete()
    db.session.commit()



def _extract_kpis(emp, updates):
    """Stage 2: Extract structured KPI data. Does NOT receive hidden_truth."""
    updates_text = "\n\n".join(
        f"{u.get('day', 'unknown').title()}: {u.get('content', '')}" for u in updates
    )
    system = (
        "You are a data extraction agent. Parse daily standup updates and extract "
        "structured KPI performance data. Do not interpret or judge - just extract. "
        "Return valid JSON.\n\n"
        "IMPORTANT EXTRACTION RULES:\n"
        "- 'target', 'actual', and 'delta' must each be a short scalar string.\n"
        "- Do not output per-day breakdowns in KPI rows.\n"
        "- For '/week' COUNT KPIs: infer daily increments and return WEEKLY SUM as actual.\n"
        "- For duration KPIs (like response time): return the WEEKLY AVERAGE as actual.\n"
        "- For quarterly or outcome KPIs (e.g., 'renew N accounts', 'ship feature by date'):\n"
        "  * Extract progress from qualitative signals: count items by status (e.g., '0 renewed, 1 stalled').\n"
        "  * actual = current state summary (e.g., '0/4 renewed', 'blocked - no progress').\n"
        "  * delta = distance to target (e.g., '-4 renewals', 'behind schedule').\n"
        "  * status = 'at_risk' if behind/stalled/blocked, 'on_track' if progressing on schedule.\n"
        "  * Only use status='missing' if updates contain ZERO mention of the KPI topic.\n"
        "- Missing means insufficient evidence, not zero performance.\n\n"
        "SUBMISSION COUNTING:\n"
        "- Count exactly which days (Monday through Friday) have an update present.\n"
        "- If only 3 out of 5 days have an update, submission_rate must be '3/5'.\n"
        "- Do not assume missing days were submitted."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"KPI targets: {emp.kpis}\n\n"
        f"Updates provided:\n{updates_text}\n\n"
        f"Extract:\n"
        f"1. For each KPI target, produce one KPI row with deterministic aggregation rules from system prompt.\n"
        f"2. Submission compliance: count exactly which days (Mon-Fri) have an update above. "
        f"If a day is not listed, it is MISSING - the employee did not submit that day.\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"kpis\": [{{\"name\": \"short KPI name (use names closely matching the KPI targets above)\", \"target\": \"single value\", \"actual\": \"single value\", \"delta\": \"+/- single value or -\", \"status\": \"on_track|at_risk|missing\"}}],\n"
        f"  \"submission_rate\": \"X/5\",\n"
        f"  \"days_submitted\": [\"monday\", \"tuesday\", ...]\n"
        f"}}"
    )
    return call_gpt(system, user)


def _condense_updates(updates):
    """Trim each update to first 400 chars for Stage 3 - KPIs already extracted."""
    lines = []
    for u in updates:
        day = u.get('day', 'unknown').title()
        content = (u.get('content') or '')[:400]
        if len(u.get('content', '')) > 400:
            content += '...'
        lines.append(f"{day}: {content}")
    return "\n".join(lines)


def _reason_accountability(emp, extraction, updates):
    """Stage 3: Reason over extracted data. Does NOT receive hidden_truth."""
    updates_text = _condense_updates(updates)
    kpi_summary = json.dumps(extraction.get('kpis', []), indent=2)
    submission_rate = extraction.get('submission_rate', 'unknown')

    system = (
        "You are an AI operations analyst advising a CEO. Your job is to classify "
        "exactly ONE accountability flag for this employee using the ordered rules below. "
        "Check each rule IN ORDER and assign the FIRST one that matches. Return valid JSON.\n\n"
        "Focus your summary on METRIC PERFORMANCE: how far the employee is from their KPI targets "
        "and trajectory. Submission cadence is secondary context.\n\n"
        "CLASSIFICATION RULES (check in this exact order):\n"
        "1. no_progress - The same blocker, task, or issue is repeated across 3+ days with no "
        "escalation, resolution, or meaningful forward movement. The employee is stuck.\n"
        "2. vanity_metrics - Activity/effort metrics (calls made, emails sent, tasks completed) "
        "look strong, BUT outcome metrics (revenue, meetings booked, deals closed) are declining "
        "or flat. The employee emphasizes activity to mask poor outcomes.\n"
        "3. optimism_gap - The employee uses consistently positive/optimistic language ('feeling good,' "
        "'great call,' 'almost there') but the underlying metrics are declining, stalled, or absent.\n"
        "4. submission_gap - The employee submitted fewer than 5/5 daily updates, OR there are "
        "multi-day gaps in their submission cadence. This is a process issue, not a performance issue.\n"
        "5. none - The employee is genuinely on track. Metrics meet or exceed targets, submissions "
        "are consistent, and there are no red flags.\n\n"
        "You MUST pick exactly one. Do NOT default to optimism_gap - only use it if the other "
        "flags above genuinely do not apply."
    )
    user = (
        f"Employee: {emp.name} ({emp.role})\n"
        f"Extracted KPI data: {kpi_summary}\n"
        f"Submission rate: {submission_rate}\n\n"
        f"Raw updates (for context):\n{updates_text}\n\n"
        f"ANALYSIS STEPS (you must do each one):\n"
        f"Step 1: Is the same blocker or task mentioned 3+ days without resolution or escalation? "
        f"If yes → no_progress.\n"
        f"Step 2: Compare activity metrics vs outcome metrics. Are activity numbers strong but "
        f"outcomes declining day-over-day? If yes → vanity_metrics.\n"
        f"Step 3: Is the language positive but metrics declining/stalled/absent? If yes → optimism_gap.\n"
        f"Step 4: Check submission_rate. Is it less than 5/5? Are any weekdays missing? "
        f"If yes → submission_gap.\n"
        f"Step 5: If none of the above apply → none.\n\n"
        f"Return JSON:\n"
        f"{{\n"
        f"  \"flag_type\": \"none|no_progress|vanity_metrics|optimism_gap|submission_gap\",\n"
        f"  \"flag_label\": \"Human-readable label\",\n"
        f"  \"summary\": \"2-line summary focused on metric performance and distance to targets. Lead with numbers.\",\n"
        f"  \"detail\": \"Single string field. Include concise evidence points separated by newlines (can use • within the string).\",\n"
        f"  \"recommended_action\": \"One specific action the CEO should take THIS WEEK (e.g., 'Pull Sean into a 1:1 Monday to discuss daily submission commitment' - not vague advice)\"\n"
        f"}}"
    )
    return call_gpt(system, user, temperature=0.3)
