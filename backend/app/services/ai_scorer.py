"""Gemini 2.5 Flash risk scoring engine (gemini-2.5-flash; use gemini-2.5-flash-lite for higher free-tier rate limits) with DEMO_MODE fixture fallback."""
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.models.command import ScoreRequest, ScoreResponse  # re-exported for callers

# ── Fixtures ──────────────────────────────────────────────────────────────────

_FIXTURES_PATH = Path(__file__).parent.parent.parent / "fixtures" / "demo_scores.json"
_FIXTURES: dict = {}

def _load_fixtures() -> dict:
    global _FIXTURES
    if not _FIXTURES:
        with open(_FIXTURES_PATH) as f:
            _FIXTURES = json.load(f)
    return _FIXTURES

_MEDIUM_KEY = "UPDATE_PARAMETER"  # safe default for unknown command types


# ── Exceptions ────────────────────────────────────────────────────────────────

class ScoringError(RuntimeError):
    """Raised when Gemini scoring fails and DEMO_MODE=false."""


# ── Tier derivation ──────────────────────────────────────────────────────────

def _derive_tier(score: int) -> str:
    """Derive risk tier from numeric score using env thresholds. Never trusts model output."""
    if score <= settings.risk_low_max:
        return "LOW"
    if score <= settings.risk_medium_max:
        return "MEDIUM"
    return "HIGH"


# ── Demo path ─────────────────────────────────────────────────────────────────

def _demo_response(command_type: str) -> ScoreResponse:
    """Return a fixture-based ScoreResponse for the given command type.

    Unknown command types fall back to the MEDIUM (UPDATE_PARAMETER) fixture.
    Tier is always re-derived from score to enforce threshold consistency.
    """
    fixtures = _load_fixtures()
    raw = fixtures.get(command_type) or fixtures[_MEDIUM_KEY]
    score = max(0, min(100, int(raw["risk_score"])))
    return ScoreResponse(
        risk_score=score,
        risk_tier=_derive_tier(score),
        justification=raw["justification"],
        sparta_technique=raw.get("sparta_technique"),
        cvss_estimate=raw.get("cvss_estimate"),
        affected_subsystems=raw.get("affected_subsystems", []),
        recommended_action=raw.get("recommended_action", ""),
        confidence=float(raw.get("confidence", 1.0)),
        scored_at=datetime.now(timezone.utc).isoformat(),
        demo_mode=True,
    )


# ── Gemini client (lazy) ──────────────────────────────────────────────────────

_model = None  # initialized on first live call

def _get_model():
    global _model
    if _model is None:
        import google.generativeai as genai
        genai.configure(api_key=settings.gemini_api_key)
        _model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                max_output_tokens=settings.gemini_max_output_tokens,
                temperature=settings.gemini_temperature,
            ),
        )
    return _model


# ── Prompt builder ────────────────────────────────────────────────────────────

_SCORING_PROMPT_TEMPLATE = """\
You are a satellite command security analyst (CCSDS / SPARTA expertise).
Score the risk of the command below given live satellite state. Output ONLY valid JSON.

COMMAND: {command_type} | Subsystem: {subsystem} | APID: {apid_hex}
Parameters: {parameters_json}

TELEMETRY: battery={battery_percent}% safe_mode={safe_mode_active} thermal={thermal_status} \
orbit={orbital_phase} link={link_margin_db}dB last_contact={last_contact_min}min

OPERATOR: role={operator_role} cmds_this_session={session_command_count} session_min={session_duration_min}

SAFETY RULES (hard constraints):
SR-001 No DISABLE_SAFE_MODE below 15% battery
SR-002 Attitude manoeuvres during ECLIPSE require dual approval
SR-003 RESET_OBC always requires approval
SR-004 UPDATE_AUTH_KEY always HIGH
SR-005 THRUSTER_FIRE during PENUMBRA requires dual approval

SCORING: 0-30=LOW(read-only/nominal), 31-70=MEDIUM(non-critical state change), \
71-100=HIGH(safety-critical/irreversible/rule violation)
Always HIGH: UPDATE_AUTH_KEY, THRUSTER_FIRE, RESET_OBC, DISABLE_WATCHDOG, \
ATTITUDE_MANOEUVRE in ECLIPSE.
Safe mode ENABLE is always LOW.

SPARTA refs: T0836 Modify Param | T0855 Unauth Cmd | T0869 Point&Shoot | \
T0862 Spoof Telemetry | T0800 Firmware Update

Respond ONLY with this JSON (no markdown):
{{
  "risk_score": <int 0-100>,
  "risk_tier": "<LOW|MEDIUM|HIGH>",
  "justification": "<2-3 sentences citing specific telemetry values and rules>",
  "sparta_technique": "<T-id or null>",
  "cvss_estimate": "<score or null>",
  "affected_subsystems": ["<subsystem>"],
  "recommended_action": "<AUTO_APPROVE|SINGLE_APPROVAL|DUAL_APPROVAL|BLOCK>",
  "confidence": <float 0.0-1.0>
}}
"""


def _build_prompt(request: ScoreRequest) -> str:
    return _SCORING_PROMPT_TEMPLATE.format(
        command_type=request.command_type,
        subsystem=request.subsystem,
        apid_hex=f"0x{request.apid:03X}",
        parameters_json=json.dumps(request.parameters),
        battery_percent=request.telemetry.battery_percent,
        safe_mode_active=request.telemetry.safe_mode_active,
        thermal_status=request.telemetry.thermal_status.value,
        orbital_phase=request.telemetry.orbital_phase.value,
        link_margin_db=request.telemetry.link_margin_db,
        last_contact_min=request.telemetry.last_contact_min,
        operator_role=request.operator_role,
        session_command_count=request.session_command_count,
        session_duration_min=request.session_duration_min,
    )


# ── Validator ─────────────────────────────────────────────────────────────────

def _normalise_cvss(raw: str | None) -> str | None:
    """Model output varies ("8.4", "CVSS 8.4", "8.4 (High)"); the DB column is
    VARCHAR(8). Extract the first numeric token; drop anything unparseable."""
    if not raw:
        return None
    match = re.search(r"\d{1,2}(?:\.\d)?", str(raw))
    return match.group(0)[:8] if match else None


def _validate_and_normalise(parsed: ScoreResponse) -> ScoreResponse:
    """Clamp score, re-derive tier from thresholds, set timestamp."""
    score = max(0, min(100, parsed.risk_score))
    return ScoreResponse(
        risk_score=score,
        risk_tier=_derive_tier(score),
        justification=parsed.justification,
        sparta_technique=(parsed.sparta_technique or None) and parsed.sparta_technique[:32],
        cvss_estimate=_normalise_cvss(parsed.cvss_estimate),
        affected_subsystems=parsed.affected_subsystems,
        recommended_action=parsed.recommended_action,
        confidence=parsed.confidence,
        scored_at=datetime.now(timezone.utc).isoformat(),
        demo_mode=False,
    )


# ── Public API ────────────────────────────────────────────────────────────────

_GEMINI_TIMEOUT = 10.0
_GEMINI_RETRY_DELAY = 2.0
_GEMINI_MAX_ATTEMPTS = 2


async def score_command(request: ScoreRequest) -> ScoreResponse:
    """Score a satellite command for security risk.

    DEMO_MODE: returns fixture score immediately without Gemini call.
    Live mode: calls Gemini with a 10s timeout and one retry (2s backoff)
    before raising ScoringError — handles transient 503/429 responses.
    """
    if settings.demo_mode:
        return _demo_response(request.command_type)

    model = _get_model()
    prompt = _build_prompt(request)
    last_exc: Exception | None = None

    for attempt in range(1, _GEMINI_MAX_ATTEMPTS + 1):
        try:
            raw_response = await asyncio.wait_for(
                asyncio.to_thread(model.generate_content, prompt),
                timeout=_GEMINI_TIMEOUT,
            )
            parsed = ScoreResponse.model_validate_json(raw_response.text)
            return _validate_and_normalise(parsed)
        except asyncio.TimeoutError as exc:
            last_exc = exc
        except Exception as exc:
            last_exc = exc

        if attempt < _GEMINI_MAX_ATTEMPTS:
            await asyncio.sleep(_GEMINI_RETRY_DELAY)

    raise ScoringError(f"Gemini scoring failed after {_GEMINI_MAX_ATTEMPTS} attempts: {last_exc}") from last_exc
