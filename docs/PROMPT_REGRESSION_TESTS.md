# SCSP — Gemini Prompt Regression Tests
# Run: python backend/scripts/test_prompt.py
# All 10 cases must pass before wiring Gemini into the command pipeline.

---

## How to Run

```bash
cd backend
export GEMINI_API_KEY=your_key_here
python scripts/test_prompt.py
```

Expected output:
```
[PASS] TC-P-001 REQUEST_TELEMETRY nominal          → LOW   (score: 5)
[PASS] TC-P-002 DISABLE_SAFE_MODE low_power        → HIGH  (score: 87)
...
10/10 passed  ·  avg latency 1.2s  ·  max latency 2.1s
```

---

## Test Cases

### TC-P-001 — Read-only command, nominal state → LOW

```json
{
  "id": "TC-P-001",
  "description": "Read-only telemetry request in fully nominal satellite state",
  "input": {
    "command_type": "REQUEST_TELEMETRY",
    "subsystem": "TM",
    "apid": 256,
    "parameters": {},
    "sequence_count": 100,
    "telemetry": {
      "battery_percent": 78.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 12.5,
      "last_contact_min": 4
    },
    "operator_role": "operator",
    "session_command_count": 5,
    "session_duration_min": 30
  },
  "expected_tier": "LOW",
  "expected_score_max": 20,
  "rationale": "Telemetry request is read-only with no state change. Nominal satellite state."
}
```

---

### TC-P-002 — Safety-critical command, low battery eclipse → HIGH

```json
{
  "id": "TC-P-002",
  "description": "Disable safe mode during low battery eclipse — should be HIGH",
  "input": {
    "command_type": "DISABLE_SAFE_MODE",
    "subsystem": "EPS",
    "apid": 398,
    "parameters": {},
    "sequence_count": 1042,
    "telemetry": {
      "battery_percent": 9.0,
      "safe_mode_active": true,
      "thermal_status": "ELEVATED",
      "orbital_phase": "ECLIPSE",
      "link_margin_db": 3.2,
      "last_contact_min": 18
    },
    "operator_role": "operator",
    "session_command_count": 14,
    "session_duration_min": 47
  },
  "expected_tier": "HIGH",
  "expected_score_min": 75,
  "rationale": "SR-001 violation (battery < 15%), eclipse phase, thermal stress — all HIGH risk factors."
}
```

---

### TC-P-003 — Same command, nominal state → LOW

```json
{
  "id": "TC-P-003",
  "description": "Disable safe mode with healthy battery, sunlit, nominal — should be LOW",
  "input": {
    "command_type": "DISABLE_SAFE_MODE",
    "subsystem": "EPS",
    "apid": 398,
    "parameters": {},
    "sequence_count": 200,
    "telemetry": {
      "battery_percent": 82.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 18.0,
      "last_contact_min": 2
    },
    "operator_role": "operator",
    "session_command_count": 3,
    "session_duration_min": 15
  },
  "expected_tier": "LOW",
  "expected_score_max": 30,
  "rationale": "This is the key dynamic scoring test. Same command type as TC-P-002 but healthy state = LOW."
}
```

---

### TC-P-004 — Auth key update, any state → HIGH

```json
{
  "id": "TC-P-004",
  "description": "Authentication key update is always HIGH regardless of satellite state",
  "input": {
    "command_type": "UPDATE_AUTH_KEY",
    "subsystem": "OBC",
    "apid": 514,
    "parameters": { "key_slot": 0, "key_material": "AABBCCDD" },
    "sequence_count": 500,
    "telemetry": {
      "battery_percent": 90.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 20.0,
      "last_contact_min": 1
    },
    "operator_role": "operator",
    "session_command_count": 2,
    "session_duration_min": 10
  },
  "expected_tier": "HIGH",
  "expected_score_min": 72,
  "rationale": "Security-critical key update maps to SPARTA T0836. Should be HIGH even in optimal state."
}
```

---

### TC-P-005 — Parameter update, nominal → MEDIUM

```json
{
  "id": "TC-P-005",
  "description": "Non-critical parameter update in nominal state — should be MEDIUM",
  "input": {
    "command_type": "UPDATE_PARAMETER",
    "subsystem": "OBC",
    "apid": 512,
    "parameters": { "param_id": 5, "value": 10 },
    "sequence_count": 300,
    "telemetry": {
      "battery_percent": 65.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 14.0,
      "last_contact_min": 6
    },
    "operator_role": "operator",
    "session_command_count": 8,
    "session_duration_min": 45
  },
  "expected_tier": "MEDIUM",
  "expected_score_min": 31,
  "expected_score_max": 70,
  "rationale": "Parameter update is a state change but non-safety-critical in nominal conditions."
}
```

---

### TC-P-006 — Thruster fire, any state → HIGH

```json
{
  "id": "TC-P-006",
  "description": "Thruster fire is always irreversible — should be HIGH in any state",
  "input": {
    "command_type": "THRUSTER_FIRE",
    "subsystem": "ADCS",
    "apid": 770,
    "parameters": { "thrust_ms": 10, "thrust_axis": 20 },
    "sequence_count": 750,
    "telemetry": {
      "battery_percent": 75.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 15.0,
      "last_contact_min": 3
    },
    "operator_role": "operator",
    "session_command_count": 6,
    "session_duration_min": 35
  },
  "expected_tier": "HIGH",
  "expected_score_min": 71,
  "rationale": "Thruster fire is irreversible orbital change, maps to SPARTA T0869. Always HIGH."
}
```

---

### TC-P-007 — Enable safe mode, any state → LOW

```json
{
  "id": "TC-P-007",
  "description": "Enabling safe mode is a protective action — should be LOW",
  "input": {
    "command_type": "ENABLE_SAFE_MODE",
    "subsystem": "EPS",
    "apid": 399,
    "parameters": {},
    "sequence_count": 400,
    "telemetry": {
      "battery_percent": 15.0,
      "safe_mode_active": false,
      "thermal_status": "ELEVATED",
      "orbital_phase": "PENUMBRA",
      "link_margin_db": 5.0,
      "last_contact_min": 12
    },
    "operator_role": "operator",
    "session_command_count": 10,
    "session_duration_min": 50
  },
  "expected_tier": "LOW",
  "expected_score_max": 30,
  "rationale": "Safe mode activation is protective — reduces risk regardless of current state."
}
```

---

### TC-P-008 — Attitude manoeuvre, eclipse → HIGH

```json
{
  "id": "TC-P-008",
  "description": "Attitude manoeuvre during eclipse violates SR-002 — should be HIGH",
  "input": {
    "command_type": "ATTITUDE_MANOEUVRE",
    "subsystem": "ADCS",
    "apid": 769,
    "parameters": { "delta_yaw_deg": 15, "delta_pitch_deg": 30 },
    "sequence_count": 600,
    "telemetry": {
      "battery_percent": 35.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "ECLIPSE",
      "link_margin_db": 8.0,
      "last_contact_min": 9
    },
    "operator_role": "operator",
    "session_command_count": 7,
    "session_duration_min": 40
  },
  "expected_tier": "HIGH",
  "expected_score_min": 71,
  "rationale": "SR-002: attitude manoeuvres prohibited during eclipse phase without dual approval."
}
```

---

### TC-P-009 — OBC reset → HIGH regardless of state

```json
{
  "id": "TC-P-009",
  "description": "OBC reset causes service disruption — should be HIGH even in optimal state",
  "input": {
    "command_type": "RESET_OBC",
    "subsystem": "OBC",
    "apid": 515,
    "parameters": {},
    "sequence_count": 800,
    "telemetry": {
      "battery_percent": 95.0,
      "safe_mode_active": false,
      "thermal_status": "NOMINAL",
      "orbital_phase": "SUNLIT",
      "link_margin_db": 22.0,
      "last_contact_min": 1
    },
    "operator_role": "operator",
    "session_command_count": 2,
    "session_duration_min": 8
  },
  "expected_tier": "HIGH",
  "expected_score_min": 71,
  "rationale": "OBC reset maps to SPARTA T0800. Loss of service risk always HIGH per SR-003."
}
```

---

### TC-P-010 — Payload activate, critical state → MEDIUM or HIGH boundary

```json
{
  "id": "TC-P-010",
  "description": "Payload activation in critical thermal state — context should elevate to MEDIUM/HIGH boundary",
  "input": {
    "command_type": "PAYLOAD_ACTIVATE",
    "subsystem": "PAYLOAD",
    "apid": 1024,
    "parameters": { "payload_id": 1 },
    "sequence_count": 900,
    "telemetry": {
      "battery_percent": 22.0,
      "safe_mode_active": false,
      "thermal_status": "CRITICAL",
      "orbital_phase": "PENUMBRA",
      "link_margin_db": 2.5,
      "last_contact_min": 28
    },
    "operator_role": "operator",
    "session_command_count": 12,
    "session_duration_min": 60
  },
  "expected_tier_options": ["MEDIUM", "HIGH"],
  "expected_score_min": 45,
  "rationale": "Payload activation adds power draw in critical thermal + low battery state. Context elevates from baseline MEDIUM. Accept MEDIUM or HIGH — both are correct given the scoring rubric."
}
```

---

## Test Script Template

```python
#!/usr/bin/env python3
"""
Gemini prompt regression tests for SCSP AI scoring engine.
Run: python backend/scripts/test_prompt.py
"""

import sys
import json
import time
import asyncio
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.services.ai_scorer import score_command, ScoreRequest
from app.models.telemetry import TelemetryState

TEST_CASES = [
    # paste the 10 JSON test cases above as Python dicts
]

async def run_tests():
    passed = 0
    failed = 0
    latencies = []

    for tc in TEST_CASES:
        start = time.time()
        try:
            req = ScoreRequest(**tc["input"])
            result = await score_command(req)
            elapsed = time.time() - start
            latencies.append(elapsed)

            # Check tier
            expected_tiers = tc.get("expected_tier_options", [tc.get("expected_tier")])
            tier_ok = result.risk_tier in expected_tiers

            # Check score bounds
            score_ok = True
            if "expected_score_max" in tc:
                score_ok = score_ok and result.risk_score <= tc["expected_score_max"]
            if "expected_score_min" in tc:
                score_ok = score_ok and result.risk_score >= tc["expected_score_min"]

            if tier_ok and score_ok:
                print(f"[PASS] {tc['id']} {tc['description'][:50]:<50} → {result.risk_tier:<6} (score: {result.risk_score}, {elapsed:.1f}s)")
                passed += 1
            else:
                print(f"[FAIL] {tc['id']} {tc['description'][:50]:<50} → got {result.risk_tier} score {result.risk_score}, expected tier {expected_tiers}")
                failed += 1

        except Exception as e:
            elapsed = time.time() - start
            latencies.append(elapsed)
            print(f"[ERROR] {tc['id']}: {e}")
            failed += 1

    avg_lat = sum(latencies) / len(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    print(f"\n{'─' * 60}")
    print(f"{passed}/{len(TEST_CASES)} passed  ·  avg latency {avg_lat:.1f}s  ·  max latency {max_lat:.1f}s")

    if failed > 0:
        print(f"\n⚠ {failed} test(s) failed — adjust prompt template before proceeding")
        sys.exit(1)
    else:
        print("\n✓ All tests passed — prompt is ready for pipeline integration")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(run_tests())
```

---

## Prompt Adjustment Guide

If test cases fail, adjust these aspects of the prompt in `ai_scorer.py`:

**TC-P-003 fails (DISABLE_SAFE_MODE nominal → not LOW)**:
→ Add to rubric: "Safe mode disable with battery > 50% in SUNLIT is LOW risk"

**TC-P-004 fails (UPDATE_AUTH_KEY → not HIGH)**:
→ Add to rubric: "Any authentication key modification is always HIGH regardless of state"

**TC-P-007 fails (ENABLE_SAFE_MODE → not LOW)**:
→ Add: "Safe mode ENABLE is always a protective action — minimum score 0, maximum 30"

**TC-P-008 fails (ATTITUDE_MANOEUVRE eclipse → not HIGH)**:
→ Ensure SR-002 is in mission rules section verbatim

**Score range failures (score outside expected bounds)**:
→ Adjust the rubric boundary descriptions — be more explicit about numeric thresholds
→ Example: "0–30 LOW: battery > 40%, thermal NOMINAL, orbital SUNLIT, no state change"
