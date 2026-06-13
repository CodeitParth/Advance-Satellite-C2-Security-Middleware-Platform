"""Unit tests — DEMO_MODE fixtures, tier derivation, prompt, validation, live path. TRD §16.1"""
import json
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.config import settings
from app.models.command import ScoreRequest, ScoreResponse
from app.models.telemetry import OrbitalPhase, TelemetryState, ThermalStatus
from app.services.ai_scorer import (
    _build_prompt,
    _demo_response,
    _derive_tier,
    _normalise_cvss,
    _validate_and_normalise,
)


class TestTierDerivation:
    """Tier is ALWAYS derived from score via thresholds — never trusted from model."""

    @pytest.mark.parametrize("score,tier", [
        (0, "LOW"),
        (30, "LOW"),                                  # boundary: <= low_max
        (31, "MEDIUM"),
        (70, "MEDIUM"),                               # boundary: <= medium_max
        (71, "HIGH"),
        (100, "HIGH"),
    ])
    def test_thresholds(self, score, tier):
        assert _derive_tier(score) == tier

    def test_thresholds_match_settings(self):
        assert _derive_tier(settings.risk_low_max) == "LOW"
        assert _derive_tier(settings.risk_medium_max) == "MEDIUM"
        assert _derive_tier(settings.risk_medium_max + 1) == "HIGH"


class TestDemoFixtures:
    def test_known_fixture(self):
        resp = _demo_response("DISABLE_SAFE_MODE")
        assert resp.risk_score == 87
        assert resp.risk_tier == "HIGH"
        assert resp.sparta_technique == "T0836"
        assert resp.demo_mode is True

    def test_low_fixture_auto_approve_range(self):
        resp = _demo_response("REQUEST_TELEMETRY")
        assert resp.risk_score <= settings.risk_low_max
        assert resp.risk_tier == "LOW"

    def test_unknown_command_falls_back_to_medium(self):
        resp = _demo_response("TOTALLY_UNKNOWN_COMMAND")
        assert resp.risk_tier == "MEDIUM"

    def test_tier_recomputed_not_trusted(self):
        """Even if a fixture lied about its tier, the score decides."""
        resp = _demo_response("THRUSTER_FIRE")
        assert resp.risk_tier == _derive_tier(resp.risk_score)


# ── _normalise_cvss ───────────────────────────────────────────────────────────

class TestNormaliseCvss:
    @pytest.mark.parametrize("raw,expected", [
        ("8.4",          "8.4"),
        ("CVSS 8.4",     "8.4"),
        ("8.4 (High)",   "8.4"),
        ("9.8",          "9.8"),
        (None,           None),
        ("N/A",          None),
        ("critical",     None),
        ("",             None),
    ])
    def test_various_formats(self, raw, expected):
        assert _normalise_cvss(raw) == expected

    def test_truncated_to_8_chars(self):
        # "10.0" is 4 chars — within limit; verify the cap logic doesn't break normal values
        assert _normalise_cvss("10.0") == "10.0"


# ── _validate_and_normalise ───────────────────────────────────────────────────

def _raw_response(
    risk_score: int = 50,
    risk_tier: str = "HIGH",
    justification: str = "test justification",
    affected_subsystems: list[str] | None = None,
    sparta_technique: str | None = None,
    cvss_estimate: str | None = None,
    demo_mode: bool = False,
) -> ScoreResponse:
    return ScoreResponse(
        risk_score=risk_score,
        risk_tier=risk_tier,
        justification=justification,
        affected_subsystems=affected_subsystems if affected_subsystems is not None else ["OBC"],
        scored_at=datetime.now(timezone.utc).isoformat(),
        demo_mode=demo_mode,
        sparta_technique=sparta_technique,
        cvss_estimate=cvss_estimate,
    )


class TestValidateAndNormalise:
    def test_score_clamped_above_100(self):
        result = _validate_and_normalise(_raw_response(risk_score=150))
        assert result.risk_score == 100

    def test_score_clamped_below_0(self):
        result = _validate_and_normalise(_raw_response(risk_score=-10))
        assert result.risk_score == 0

    def test_tier_recomputed_from_score_not_model_output(self):
        result = _validate_and_normalise(_raw_response(risk_score=15, risk_tier="HIGH"))
        assert result.risk_tier == "LOW"   # 15 ≤ 30 → LOW

    def test_demo_mode_always_false(self):
        result = _validate_and_normalise(_raw_response(risk_score=50, demo_mode=True))
        assert result.demo_mode is False

    def test_sparta_technique_truncated_at_32(self):
        result = _validate_and_normalise(_raw_response(sparta_technique="T" * 50))
        assert result.sparta_technique == "T" * 32

    def test_none_sparta_technique_stays_none(self):
        result = _validate_and_normalise(_raw_response(sparta_technique=None))
        assert result.sparta_technique is None

    def test_cvss_normalised(self):
        result = _validate_and_normalise(_raw_response(cvss_estimate="CVSS 7.5"))
        assert result.cvss_estimate == "7.5"

    def test_scored_at_set_to_now(self):
        before = datetime.now(timezone.utc)
        result = _validate_and_normalise(_raw_response())
        after = datetime.now(timezone.utc)
        scored = datetime.fromisoformat(result.scored_at)
        assert before <= scored <= after


# ── _build_prompt ─────────────────────────────────────────────────────────────

def _score_request(**overrides) -> ScoreRequest:
    defaults = dict(
        command_type="DISABLE_SAFE_MODE",
        subsystem="OBC",
        apid=0x18,
        parameters={"enabled": False},
        sequence_count=3,
        operator_id=str(uuid4()),
        operator_role="OPERATOR",
        session_command_count=5,
        session_duration_min=30,
        telemetry=TelemetryState(
            battery_percent=9.0,
            safe_mode_active=False,
            thermal_status=ThermalStatus.ELEVATED,
            orbital_phase=OrbitalPhase.ECLIPSE,
            link_margin_db=6.0,
            last_contact_min=2,
        ),
    )
    defaults.update(overrides)
    return ScoreRequest(**defaults)


class TestBuildPrompt:
    def test_contains_command_type(self):
        assert "DISABLE_SAFE_MODE" in _build_prompt(_score_request())

    def test_contains_battery_level(self):
        assert "9" in _build_prompt(_score_request())

    def test_contains_orbital_phase(self):
        assert "ECLIPSE" in _build_prompt(_score_request())

    def test_contains_thermal_status(self):
        assert "ELEVATED" in _build_prompt(_score_request())

    def test_contains_operator_role(self):
        assert "OPERATOR" in _build_prompt(_score_request())

    def test_different_telemetry_changes_prompt(self):
        p1 = _build_prompt(_score_request())
        p2 = _build_prompt(_score_request(
            telemetry=TelemetryState(battery_percent=78.0, orbital_phase=OrbitalPhase.SUNLIT)
        ))
        assert p1 != p2


# ── score_command live path ───────────────────────────────────────────────────

class TestScoreCommandLive:
    @pytest.mark.asyncio
    async def test_demo_mode_returns_fixture(self):
        from app.services.ai_scorer import score_command
        req = _score_request()
        result = await score_command(req)   # conftest pins DEMO_MODE=true
        assert result.demo_mode is True
        assert result.risk_score == 87

    @pytest.mark.asyncio
    async def test_live_success_normalises_response(self, monkeypatch):
        from app.services import ai_scorer
        fake_json = json.dumps({
            "risk_score": 55,
            "risk_tier": "HIGH",       # will be overridden → MEDIUM
            "justification": "mid-risk command",
            "sparta_technique": "T0836",
            "cvss_estimate": "5.5",
            "affected_subsystems": ["OBC"],
            "recommended_action": "SINGLE_APPROVAL",
            "confidence": 0.9,
        })
        mock_resp = MagicMock()
        mock_resp.text = fake_json
        mock_model = MagicMock()
        mock_model.generate_content.return_value = mock_resp

        monkeypatch.setattr(ai_scorer, "_model", mock_model)
        monkeypatch.setattr(ai_scorer.settings, "demo_mode", False)

        result = await ai_scorer.score_command(_score_request())
        assert result.risk_score == 55
        assert result.risk_tier == "MEDIUM"   # 55 re-derived → MEDIUM
        assert result.demo_mode is False

    @pytest.mark.asyncio
    async def test_live_retries_once_on_exception(self, monkeypatch):
        from app.services import ai_scorer
        fake_json = json.dumps({
            "risk_score": 20, "risk_tier": "LOW", "justification": "ok",
            "sparta_technique": None, "cvss_estimate": None,
            "affected_subsystems": [], "recommended_action": "AUTO_APPROVE",
            "confidence": 0.95,
        })
        mock_resp = MagicMock()
        mock_resp.text = fake_json
        mock_model = MagicMock()
        mock_model.generate_content.side_effect = [RuntimeError("503"), mock_resp]

        monkeypatch.setattr(ai_scorer, "_model", mock_model)
        monkeypatch.setattr(ai_scorer.settings, "demo_mode", False)
        monkeypatch.setattr(ai_scorer, "_GEMINI_RETRY_DELAY", 0.01)

        result = await ai_scorer.score_command(_score_request())
        assert result.risk_score == 20
        assert mock_model.generate_content.call_count == 2

    @pytest.mark.asyncio
    async def test_live_raises_scoring_error_after_max_attempts(self, monkeypatch):
        from app.services import ai_scorer
        from app.services.ai_scorer import ScoringError
        mock_model = MagicMock()
        mock_model.generate_content.side_effect = RuntimeError("persistent failure")

        monkeypatch.setattr(ai_scorer, "_model", mock_model)
        monkeypatch.setattr(ai_scorer.settings, "demo_mode", False)
        monkeypatch.setattr(ai_scorer, "_GEMINI_RETRY_DELAY", 0.01)
        monkeypatch.setattr(ai_scorer, "_GEMINI_MAX_ATTEMPTS", 2)

        with pytest.raises(ScoringError):
            await ai_scorer.score_command(_score_request())

        assert mock_model.generate_content.call_count == 2
