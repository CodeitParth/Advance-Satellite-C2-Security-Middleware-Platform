"""Unit tests — replay nonce window + all 5 sequence rules. TRD §16.1"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.services.replay_detector import ReplayDetector


@pytest.fixture(autouse=True)
def reset_detector():
    ReplayDetector._nonce_window.clear()
    ReplayDetector._sequence_window.clear()
    yield
    ReplayDetector._nonce_window.clear()
    ReplayDetector._sequence_window.clear()


class TestNonceReplay:
    def test_fresh_nonce_passes(self):
        assert ReplayDetector.check_replay(str(uuid.uuid4())) is False

    def test_duplicate_nonce_detected(self):
        nonce = str(uuid.uuid4())
        assert ReplayDetector.check_replay(nonce) is False
        assert ReplayDetector.check_replay(nonce) is True

    def test_window_eviction(self):
        """Oldest nonce falls out once the window exceeds its max size."""
        first = str(uuid.uuid4())
        ReplayDetector.check_replay(first)
        for _ in range(settings.replay_nonce_window_size):
            ReplayDetector.check_replay(str(uuid.uuid4()))
        # first was evicted — replaying it is no longer detected
        assert ReplayDetector.check_replay(first) is False
        assert len(ReplayDetector._nonce_window) <= settings.replay_nonce_window_size


class TestSequenceRules:
    """SEQ-001..005 from replay_detector._SEQUENCE_RULES."""

    @pytest.mark.parametrize("trigger,next_cmd,rule_id,elevation", [
        ("DISABLE_SAFE_MODE",  "ATTITUDE_MANOEUVRE", "SEQ-001", 20),
        ("DISABLE_SAFE_MODE",  "THRUSTER_FIRE",      "SEQ-002", 25),
        ("RESET_OBC",          "DISABLE_WATCHDOG",   "SEQ-004", 35),
    ])
    def test_pair_rules_fire(self, trigger, next_cmd, rule_id, elevation):
        assert ReplayDetector.check_sequence(trigger) == []
        hits = ReplayDetector.check_sequence(next_cmd)
        assert any(h["rule_id"] == rule_id and h["score_elevation"] == elevation for h in hits), hits

    @pytest.mark.parametrize("trigger,rule_id,elevation", [
        ("DISABLE_ENCRYPTION", "SEQ-003", 30),
        ("UPDATE_AUTH_KEY",    "SEQ-005", 40),
    ])
    def test_any_followup_rules_fire(self, trigger, rule_id, elevation):
        ReplayDetector.check_sequence(trigger)
        hits = ReplayDetector.check_sequence("REQUEST_TELEMETRY")
        assert any(h["rule_id"] == rule_id and h["score_elevation"] == elevation for h in hits), hits

    def test_no_rule_without_trigger(self):
        assert ReplayDetector.check_sequence("THRUSTER_FIRE") == []

    def test_window_expiry(self):
        """A trigger older than the rule window must not fire."""
        ReplayDetector.check_sequence("DISABLE_SAFE_MODE")
        # Backdate the recorded trigger beyond SEQ-002's 60s window
        ReplayDetector._sequence_window = [
            (cmd, ts - timedelta(seconds=120))
            for cmd, ts in ReplayDetector._sequence_window
        ]
        assert ReplayDetector.check_sequence("THRUSTER_FIRE") == []
