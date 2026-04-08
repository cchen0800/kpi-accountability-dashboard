"""
End-to-end integration tests for pipeline KPI extraction.

Requires OPENAI_API_KEY in environment. Makes real GPT calls.

Usage:
    cd api && python -m pytest ../tests/test_pipeline_extraction.py -v
"""

import os
import sys
import types
import json
import re

import pytest

# Add api/ to path so we can import pipeline modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from pipeline import (
    _generate_updates,
    _extract_kpis,
    _normalize_extracted_kpis,
    _reason_accountability,
    _build_expected_kpis,
    _extract_quarter_progress,
)

# Skip entire module if no API key
pytestmark = pytest.mark.skipif(
    not os.environ.get("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set — skipping live GPT tests",
)


# ---------------------------------------------------------------------------
# Employee fixtures (SimpleNamespace, no DB needed)
# ---------------------------------------------------------------------------

def _make_employee(**kwargs):
    emp = types.SimpleNamespace(**kwargs)
    return emp


AVERY = _make_employee(
    id="emp_002",
    name="Avery Holmseth",
    role="Client Success Manager",
    kpis=json.dumps([
        "Renew 4 enterprise accounts this quarter",
        "Drive 15% expansion revenue from existing book",
    ]),
    writing_style=(
        "Long narrative paragraphs. Buries metrics in prose. Optimistic tone "
        "('great call,' 'positive energy,' 'feeling good'). Avoids numbers and dates."
    ),
    hidden_truth=(
        "OPTIMISM-REALITY GAP. Updates sound great but metrics are slipping. "
        "Northwind Athletics renewal stalled (4 days 'almost there'). "
        "Petalcrest expressed concerns but Avery downplays it."
    ),
)

HANNAH = _make_employee(
    id="emp_005",
    name="Hannah Kargman",
    role="Product Manager",
    kpis=json.dumps([
        "Ship Creator Matching v2 by end of quarter",
        "Run 5 user research sessions/week",
    ]),
    writing_style=(
        "Thoughtful, qualitative. 'Alignment,' 'blockers,' 'stakeholder input,' "
        "'iterating.' Rarely commits to dates. Talks process more than output."
    ),
    hidden_truth=(
        "NO FORWARD MOTION + MISSED KPI. Same blocker (aligning with eng on "
        "matching algorithm) mentioned Mon-Fri with no escalation or progress. "
        "User research KPI: only 2 completed sessions total (Mon, Tue). "
        "Wed-Fri: rescheduling, silence, no recovery to 5."
    ),
)

ADAM = _make_employee(
    id="emp_001",
    name="Adam Ankeny",
    role="Creator Operations Associate",
    kpis=json.dumps([
        "Onboard 25 new creators/week to the platform",
        "Maintain <24hr creator response time",
    ]),
    writing_style=(
        "Concise, numbers-forward. Leads with metrics, short sentences. "
        "Consistent format daily."
    ),
    hidden_truth=(
        "HIGH PERFORMER. Hits or exceeds targets every day. "
        "Control group — should rank #1."
    ),
)


# ---------------------------------------------------------------------------
# Stage 1 tests
# ---------------------------------------------------------------------------

class TestStage1Generation:
    """Stage 1 should produce updates with extractable progress signals."""

    def test_avery_has_extractable_signals(self):
        result = _generate_updates(AVERY)
        updates = result["data"]["updates"]

        status_re = re.compile(
            r"\b(renewed?|stalled|blocked|shipped|delayed|signed|slipping|"
            r"on track|behind|paused|pending|almost)\b",
            re.IGNORECASE,
        )
        signal_count = sum(
            1 for u in updates if status_re.search(u.get("content", ""))
        )
        assert signal_count >= 2, (
            f"Avery's updates should have status signals in >=2 days, found {signal_count}. "
            f"Updates: {json.dumps(updates, indent=2)}"
        )

    def test_hannah_has_extractable_signals(self):
        result = _generate_updates(HANNAH)
        updates = result["data"]["updates"]

        # Should mention matching v2 status and session counts
        matching_mentions = sum(
            1 for u in updates
            if "match" in u.get("content", "").lower()
        )
        assert matching_mentions >= 2, (
            f"Hannah should mention matching v2 in >=2 updates, found {matching_mentions}"
        )


# ---------------------------------------------------------------------------
# Stage 2 tests
# ---------------------------------------------------------------------------

class TestStage2Extraction:
    """Stage 2 should extract non-missing data for quarterly KPIs."""

    def test_avery_no_missing_kpis(self):
        s1 = _generate_updates(AVERY)
        updates = s1["data"]["updates"]
        s2 = _extract_kpis(AVERY, updates)
        normalized = _normalize_extracted_kpis(AVERY, s2["data"], updates)

        for kpi in normalized:
            assert kpi["status"] != "missing", (
                f"Avery KPI '{kpi['name']}' should not be missing. Got: {kpi}"
            )

    def test_hannah_no_missing_quarterly(self):
        s1 = _generate_updates(HANNAH)
        updates = s1["data"]["updates"]
        s2 = _extract_kpis(HANNAH, updates)
        normalized = _normalize_extracted_kpis(HANNAH, s2["data"], updates)

        # "Ship Creator Matching v2" should be at_risk, not missing
        matching_kpis = [
            k for k in normalized
            if "match" in k["name"].lower() or "creator matching" in k["name"].lower()
        ]
        assert matching_kpis, f"Should find matching v2 KPI. Got: {normalized}"
        for kpi in matching_kpis:
            assert kpi["status"] != "missing", (
                f"Hannah's Creator Matching v2 should be at_risk, not missing. Got: {kpi}"
            )


# ---------------------------------------------------------------------------
# Stage 3 tests
# ---------------------------------------------------------------------------

class TestStage3Reasoning:
    """Stage 3 should produce correct flag types."""

    def test_avery_gets_optimism_gap(self):
        s1 = _generate_updates(AVERY)
        updates = s1["data"]["updates"]
        s2 = _extract_kpis(AVERY, updates)
        extraction = s2["data"]
        extraction["kpis"] = _normalize_extracted_kpis(AVERY, extraction, updates)
        s3 = _reason_accountability(AVERY, extraction, updates)

        flag = s3["data"].get("flag_type", "")
        assert flag == "optimism_gap", (
            f"Avery should get optimism_gap, got '{flag}'. "
            f"Full result: {json.dumps(s3['data'], indent=2)}"
        )

    def test_hannah_gets_no_progress(self):
        s1 = _generate_updates(HANNAH)
        updates = s1["data"]["updates"]
        s2 = _extract_kpis(HANNAH, updates)
        extraction = s2["data"]
        extraction["kpis"] = _normalize_extracted_kpis(HANNAH, extraction, updates)
        s3 = _reason_accountability(HANNAH, extraction, updates)

        flag = s3["data"].get("flag_type", "")
        assert flag == "no_progress", (
            f"Hannah should get no_progress, got '{flag}'. "
            f"Full result: {json.dumps(s3['data'], indent=2)}"
        )


# ---------------------------------------------------------------------------
# Regression tests
# ---------------------------------------------------------------------------

class TestRegression:
    """Existing employees should still extract correctly."""

    def test_adam_still_on_track(self):
        s1 = _generate_updates(ADAM)
        updates = s1["data"]["updates"]
        s2 = _extract_kpis(ADAM, updates)
        extraction = s2["data"]
        extraction["kpis"] = _normalize_extracted_kpis(ADAM, extraction, updates)
        s3 = _reason_accountability(ADAM, extraction, updates)

        flag = s3["data"].get("flag_type", "")
        assert flag == "none", (
            f"Adam should get 'none' flag, got '{flag}'. "
            f"Full result: {json.dumps(s3['data'], indent=2)}"
        )


# ---------------------------------------------------------------------------
# Unit tests for _extract_quarter_progress helper
# ---------------------------------------------------------------------------

class TestExtractQuarterProgress:
    """Unit tests for the quarter_outcome fallback scanner."""

    def test_stalled_renewal(self):
        spec = {"source": "Renew 4 enterprise accounts this quarter",
                "name": "Renew enterprise accounts", "target": "4",
                "kind": "quarter_outcome"}
        updates = [
            {"day": "monday", "content": "Great call with Northwind, renewal looking good"},
            {"day": "tuesday", "content": "Northwind renewal stalled in legal"},
            {"day": "wednesday", "content": "Still waiting on Northwind, renewal pending"},
        ]
        result = _extract_quarter_progress(spec, updates)
        assert result is not None
        assert result["status"] == "at_risk"

    def test_no_mentions_returns_none(self):
        spec = {"source": "Renew 4 enterprise accounts this quarter",
                "name": "Renew enterprise accounts", "target": "4",
                "kind": "quarter_outcome"}
        updates = [
            {"day": "monday", "content": "Had a great lunch today"},
        ]
        result = _extract_quarter_progress(spec, updates)
        assert result is None

    def test_blocked_shipping(self):
        spec = {"source": "Ship Creator Matching v2 by end of quarter",
                "name": "Ship Creator Matching v2", "target": "end of quarter",
                "kind": "quarter_outcome"}
        updates = [
            {"day": "monday", "content": "Matching v2 still blocked on eng alignment"},
            {"day": "tuesday", "content": "Creator matching architecture review delayed"},
        ]
        result = _extract_quarter_progress(spec, updates)
        assert result is not None
        assert result["status"] == "at_risk"
        assert "blocked" in result["actual"] or "delayed" in result["actual"]
