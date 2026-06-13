"""Command submission, parsing, scoring, and status Pydantic models."""
import re
from pydantic import BaseModel, field_validator
from enum import Enum
from app.models.telemetry import TelemetryState


class CommandStatus(str, Enum):
    SUBMITTED              = "SUBMITTED"
    PARSING                = "PARSING"
    SCORED                 = "SCORED"
    PENDING_SINGLE_APPROVAL = "PENDING_SINGLE_APPROVAL"
    PENDING_DUAL_APPROVAL  = "PENDING_DUAL_APPROVAL"
    AUTO_APPROVED          = "AUTO_APPROVED"
    REJECTED               = "REJECTED"
    BLOCKED                = "BLOCKED"
    DISPATCHED             = "DISPATCHED"
    REPLAY_BLOCKED         = "REPLAY_BLOCKED"
    EMERGENCY_OVERRIDE     = "EMERGENCY_OVERRIDE"


class ParsedCommand(BaseModel):
    apid: int
    subsystem: str
    command_type: str
    sequence_count: int
    parameters: dict
    raw_packet_hex: str
    crc_valid: bool


class ParseResult(BaseModel):
    success: bool
    parsed: ParsedCommand | None = None
    error: str | None = None
    error_code: str | None = None


_UUID4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_HEX_RE = re.compile(r"^[0-9a-fA-F]+$")


class CommandSubmitRequest(BaseModel):
    packet_hex: str
    nonce: str

    @field_validator("packet_hex")
    @classmethod
    def validate_packet_hex(cls, v: str) -> str:
        if not v:
            raise ValueError("packet_hex cannot be empty")
        if len(v) > 2048:
            raise ValueError("packet_hex exceeds 2048 character limit")
        if len(v) % 2 != 0:
            raise ValueError("packet_hex must have even length")
        if not _HEX_RE.match(v):
            raise ValueError("packet_hex must contain only hex characters [0-9a-fA-F]")
        return v

    @field_validator("nonce")
    @classmethod
    def validate_nonce(cls, v: str) -> str:
        if not _UUID4_RE.match(v):
            raise ValueError("nonce must be a valid UUID v4")
        return v


class SequenceAlert(BaseModel):
    """Sequence-rule or behavioral-drift hit attached to a scored command."""
    rule_id: str
    trigger_command: str
    score_elevation: int


class CommandSubmitResponse(BaseModel):
    command_id: str
    status: str
    risk_score: int
    risk_tier: str
    justification: str
    sparta_technique: str | None
    cvss_estimate: str | None
    affected_subsystems: list[str]
    sequence_alerts: list[SequenceAlert]
    demo_mode: bool


class ScoreRequest(BaseModel):
    command_type: str
    subsystem: str
    apid: int
    parameters: dict
    sequence_count: int
    telemetry: TelemetryState
    operator_id: str
    operator_role: str
    session_command_count: int
    session_duration_min: int


class ScoreResponse(BaseModel):
    risk_score: int                     # 0–100
    risk_tier: str                      # LOW | MEDIUM | HIGH
    justification: str
    sparta_technique: str | None = None
    cvss_estimate: str | None    = None
    affected_subsystems: list[str] = []
    recommended_action: str      = ""
    confidence: float            = 1.0
    scored_at: str               = ""
    demo_mode: bool              = False
