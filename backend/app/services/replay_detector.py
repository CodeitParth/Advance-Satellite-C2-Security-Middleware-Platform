"""Nonce replay detection and command sequence anomaly rules.

Performance notes
-----------------
check_replay  — O(1) average (dict lookup + ordered-dict FIFO eviction)
check_sequence — O(W) where W = entries in the sequence window (bounded by
                 max_window_s * peak_commands_per_second).  Rule lookup is
                 O(1) via _RULES_BY_NEXT dict instead of a linear scan.
"""
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from app.config import settings


class _Rule(NamedTuple):
    id: str
    trigger: str
    next_cmd: str | None   # None = fires on any command after trigger
    window_s: int
    elevation: int


_SEQUENCE_RULES: list[_Rule] = [
    _Rule("SEQ-001", "DISABLE_SAFE_MODE",  "ATTITUDE_MANOEUVRE",  60,  20),
    _Rule("SEQ-002", "DISABLE_SAFE_MODE",  "THRUSTER_FIRE",       60,  25),
    _Rule("SEQ-003", "DISABLE_ENCRYPTION", None,                  120, 30),
    _Rule("SEQ-004", "RESET_OBC",          "DISABLE_WATCHDOG",    30,  35),
    _Rule("SEQ-005", "UPDATE_AUTH_KEY",    None,                  300, 40),
]

# O(1) lookup: next_cmd → list of rules that fire when that command is seen
# None-next rules are in the special "_ANY_" bucket.
_RULES_BY_NEXT: dict[str, list[_Rule]] = {}
for _r in _SEQUENCE_RULES:
    _key = _r.next_cmd if _r.next_cmd else "_ANY_"
    _RULES_BY_NEXT.setdefault(_key, []).append(_r)

_MAX_WINDOW_S = max(r.window_s for r in _SEQUENCE_RULES)


class ReplayDetector:
    """In-process singleton for replay and sequence anomaly detection."""

    _nonce_window: OrderedDict[str, datetime] = OrderedDict()
    _sequence_window: list[tuple[str, datetime]] = []

    @classmethod
    def check_replay(cls, nonce: str) -> bool:
        """O(1) — True if nonce is a duplicate."""
        if nonce in cls._nonce_window:
            return True
        cls._nonce_window[nonce] = datetime.now(timezone.utc)
        if len(cls._nonce_window) > settings.replay_nonce_window_size:
            cls._nonce_window.popitem(last=False)
        return False

    @classmethod
    def check_sequence(cls, command_type: str) -> list[dict]:
        """O(W) scan where W = live entries in window.  Rule lookup is O(1).

        Returns list of triggered rule dicts: {rule_id, score_elevation, trigger_command}.
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=_MAX_WINDOW_S)

        # Evict expired entries once per call
        cls._sequence_window = [
            (ct, ts) for ct, ts in cls._sequence_window if ts > cutoff
        ]

        # Gather candidate rules: those that fire on this specific command_type + ANY-next rules
        candidate_rules: list[_Rule] = (
            _RULES_BY_NEXT.get(command_type, []) + _RULES_BY_NEXT.get("_ANY_", [])
        )

        triggered: list[dict] = []
        for rule in candidate_rules:
            # Check whether the trigger command was seen within this rule's window
            rule_cutoff = now - timedelta(seconds=rule.window_s)
            trigger_seen = any(
                ct == rule.trigger and ts > rule_cutoff
                for ct, ts in cls._sequence_window
            )
            if trigger_seen:
                triggered.append({
                    "rule_id": rule.id,
                    "score_elevation": rule.elevation,
                    "trigger_command": rule.trigger,
                })

        cls._sequence_window.append((command_type, now))
        return triggered
