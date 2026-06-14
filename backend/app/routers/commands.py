"""Commands router: full pipeline — parse → score → authorize → dispatch."""
import json
import logging
import types
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import get_current_operator, require_role
from app.models.approval import ApprovalRequest
from app.models.command import (
    CommandStatus,
    CommandSubmitRequest,
    CommandSubmitResponse,
    ScoreRequest,
    SequenceAlert,
)
from app.models.operator import Role, TokenPayload
from app.services.ai_scorer import ScoringError, score_command
from app.services.auth_chain import determine_initial_status, process_approval
from app.services.ccsds_parser import parse_ccsds_packet
from app.services.constellation import apply_constellation_elevation, constellation_hub
from app.services.drift_detector import check_drift
from app.services.ledger_service import append as ledger_append
from app.services.obc_client import dispatch_to_obc
from app.services.override_service import is_override_active
from app.services.replay_detector import ReplayDetector
from app.services.telemetry_service import TelemetryService
from app.services.ws_manager import ws_manager
from app.utils.errors import error_dict, http_error
from app.utils.logging_utils import sanitize
from app.utils.serialization import row_to_dict

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _recalculate_tier(risk_score: int) -> str:
    if risk_score <= settings.risk_low_max:
        return "LOW"
    if risk_score <= settings.risk_medium_max:
        return "MEDIUM"
    return "HIGH"


async def _store_command(parsed, score, operator: TokenPayload, nonce: str,
                         initial_status: CommandStatus, sequence_hits: list,
                         telemetry, db) -> UUID:
    alert_ids = [h["rule_id"] for h in sequence_hits]
    try:
        row = await db.fetchrow(
            """
            INSERT INTO commands (
                nonce, ccsds_apid, command_type, subsystem, parameters,
                sequence_count, raw_packet_hex, risk_score, risk_tier,
                ai_justification, sparta_technique, cvss_estimate,
                affected_subsystems, sequence_alerts, telemetry_snapshot,
                status, submitter_id, scored_at, demo_mode
            ) VALUES (
                $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15::jsonb,
                $16, $17, NOW(), $18
            )
            RETURNING id
            """,
            nonce,
            f"{parsed.apid:#05x}",
            parsed.command_type,
            parsed.subsystem,
            json.dumps(parsed.parameters),
            parsed.sequence_count,
            parsed.raw_packet_hex,
            score.risk_score,
            score.risk_tier,
            score.justification,
            score.sparta_technique,
            score.cvss_estimate,
            score.affected_subsystems,
            alert_ids,
            json.dumps(telemetry.model_dump()),
            initial_status.value,
            UUID(operator.sub),
            score.demo_mode,
        )
    except asyncpg.ForeignKeyViolationError:
        # operator.sub UUID not in the operators table — DB was re-seeded while
        # the client held an old token. Force re-login.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error_dict("TOKEN_INVALID", "Session invalidated — please log in again"),
        )
    return row["id"]


async def _store_replay_blocked(nonce: str, db) -> UUID | None:
    # nonce is UNIQUE in commands table — look up the original rather than re-inserting
    row = await db.fetchrow("SELECT id FROM commands WHERE nonce = $1", nonce)
    return UUID(str(row["id"])) if row else None


async def _get_session_context(operator_id: str, db) -> tuple[int, int]:
    """Return (command_count, session_duration_min) for the last hour — one query."""
    row = await db.fetchrow(
        """
        SELECT
            COUNT(*) AS cnt,
            COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(submitted_at))) / 60, 0) AS mins
        FROM commands
        WHERE submitter_id = $1 AND submitted_at > NOW() - INTERVAL '1 hour'
        """,
        UUID(operator_id),
    )
    if not row:
        return 0, 0
    return int(row["cnt"]), int(row["mins"] or 0)


# ── Submit pipeline ───────────────────────────────────────────────────────────

@router.post("", response_model=CommandSubmitResponse)
async def submit_command(
    body: CommandSubmitRequest,
    operator: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    return await run_submit_pipeline(body, operator, db)


async def run_submit_pipeline(
    body: CommandSubmitRequest,
    operator: TokenPayload,
    db,
) -> CommandSubmitResponse:
    """Full submit pipeline: parse → replay/sequence/drift → score → authorize
    → store → ledger → dispatch. Shared by the operator endpoint and the C2
    proxy adapter so both ingestion paths behave identically."""
    # 1. Parse CCSDS packet
    parse_result = parse_ccsds_packet(body.packet_hex)
    if not parse_result.success:
        raise HTTPException(
            status_code=400,
            detail=error_dict("INVALID_CCSDS_PACKET",
                              f"CCSDS parse failed: {parse_result.error}",
                              {"error_code": parse_result.error_code}),
        )
    if parse_result.parsed is None:
        raise HTTPException(
            status_code=500,
            detail=error_dict("INTERNAL_ERROR", "Parser returned success with no parsed result"),
        )
    parsed = parse_result.parsed

    # 2. Replay check
    if ReplayDetector.check_replay(body.nonce):
        try:
            replay_cmd_id = await _store_replay_blocked(body.nonce, db)
            await ledger_append(
                command_id=replay_cmd_id,
                event_type="REPLAY_BLOCKED",
                event_detail={"nonce": body.nonce, "command_type": parsed.command_type},
                operator_id=UUID(operator.sub),
                approver_ids=[],
                db_pool=db,
            )
        except Exception as exc:
            logger.error("Replay-blocked record failed — nonce=%s: %s",
                         sanitize(body.nonce), exc)
        raise HTTPException(
            status_code=409,
            detail=error_dict("REPLAY_DETECTED", "Duplicate nonce — possible replay attack"),
        )

    # 3. Sequence anomaly check
    sequence_hits = ReplayDetector.check_sequence(parsed.command_type)

    # 4. Current telemetry context
    telemetry = await TelemetryService.get_current()

    # 5. AI scoring
    session_count, session_mins = await _get_session_context(operator.sub, db)

    # 5b. Behavioral drift check (Phase 2 F-10) — non-blocking; rides the
    # sequence-alert path so elevation, storage, and UI are shared
    drift_hit = await check_drift(operator.sub, session_count, session_mins, db)
    if drift_hit:
        sequence_hits = [*sequence_hits, drift_hit]

    try:
        score = await score_command(ScoreRequest(
            command_type=parsed.command_type,
            subsystem=parsed.subsystem,
            apid=parsed.apid,
            parameters=parsed.parameters,
            sequence_count=parsed.sequence_count,
            telemetry=telemetry,
            operator_id=operator.sub,
            operator_role=operator.role,
            session_command_count=session_count,
            session_duration_min=session_mins,
        ))
    except ScoringError as exc:
        raise HTTPException(
            status_code=422,
            detail=error_dict("SCORING_FAILED", str(exc)),
        )

    # 6. Apply sequence score elevation
    elevated = score.risk_score
    for hit in sequence_hits:
        elevated = min(100, elevated + hit["score_elevation"])
    if elevated != score.risk_score:
        score = score.model_copy(
            update={"risk_score": elevated, "risk_tier": _recalculate_tier(elevated)}
        )

    # 7. Override + initial status (+ constellation elevation, Phase 2 F-11)
    override_active = is_override_active()
    initial_status = await determine_initial_status(score.risk_tier, override_active)
    if not override_active:
        initial_status = CommandStatus(apply_constellation_elevation(initial_status.value))

    # 7b. Broadcast local HIGH-risk detections to the constellation bus
    if score.risk_tier == "HIGH":
        try:
            await constellation_hub.publish_local_high_risk(parsed.command_type, score.risk_score)
        except Exception as exc:
            logger.debug("Constellation publish skipped: %s", exc)

    # 8. Store command
    cmd_id = await _store_command(parsed, score, operator, body.nonce,
                                  initial_status, sequence_hits, telemetry, db)

    # 9. Ledger entry — failure logged, not fatal (command already stored)
    try:
        await ledger_append(
            command_id=cmd_id,
            event_type="COMMAND_SUBMITTED",
            event_detail={"risk_score": score.risk_score, "risk_tier": score.risk_tier,
                          "status": initial_status.value},
            operator_id=UUID(operator.sub),
            approver_ids=[],
            db_pool=db,
        )
    except Exception as exc:
        logger.error("Ledger append failed for COMMAND_SUBMITTED command_id=%s: %s", cmd_id, exc)

    # 10. Immediate dispatch for AUTO_APPROVED / EMERGENCY_OVERRIDE
    if initial_status in (CommandStatus.AUTO_APPROVED, CommandStatus.EMERGENCY_OVERRIDE):
        parsed_ns = types.SimpleNamespace(
            command_type=parsed.command_type,
            subsystem=parsed.subsystem,
            parameters=parsed.parameters,
        )
        await dispatch_to_obc(parsed_ns, cmd_id, db)

    # 11. Broadcast PENDING state to approvers
    if initial_status in (CommandStatus.PENDING_SINGLE_APPROVAL, CommandStatus.PENDING_DUAL_APPROVAL):
        try:
            await ws_manager.broadcast_approver({
                "type": "COMMAND_PENDING",
                "command_id": str(cmd_id),
                "risk_tier": score.risk_tier,
                "command_type": parsed.command_type,
                "submitted_by": operator.username,
            })
        except Exception as exc:
            logger.warning("WS broadcast failed for COMMAND_PENDING command_id=%s: %s", cmd_id, exc)

    logger.info(
        "Command submitted — id=%s type=%s tier=%s status=%s operator=%s",
        cmd_id, parsed.command_type, score.risk_tier,
        initial_status.value, sanitize(operator.username),
    )

    return CommandSubmitResponse(
        command_id=str(cmd_id),
        status=initial_status.value,
        risk_score=score.risk_score,
        risk_tier=score.risk_tier,
        justification=score.justification,
        sparta_technique=score.sparta_technique,
        cvss_estimate=score.cvss_estimate,
        affected_subsystems=score.affected_subsystems,
        sequence_alerts=[SequenceAlert(**hit) for hit in sequence_hits],
        demo_mode=score.demo_mode,
    )


# ── Query endpoints ───────────────────────────────────────────────────────────

@router.get("/pending")
async def get_pending(
    _: TokenPayload = Depends(require_role(Role.APPROVER, Role.ADMIN)),
    db=Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT c.*, o.username AS submitter_username
        FROM commands c
        JOIN operators o ON c.submitter_id = o.id
        WHERE c.status IN ('PENDING_SINGLE_APPROVAL', 'PENDING_DUAL_APPROVAL')
        ORDER BY c.submitted_at ASC
        """,
    )
    return [row_to_dict(r) for r in rows]


@router.get("/{command_id}")
async def get_command(
    command_id: UUID,
    _: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db),
):
    row = await db.fetchrow("SELECT * FROM commands WHERE id = $1", command_id)
    if not row:
        raise http_error(404, "COMMAND_NOT_FOUND", f"Command {command_id} not found")
    cmd = row_to_dict(row)
    approvals = await db.fetch(
        """
        SELECT a.*, o.username AS approver_username
        FROM approvals a JOIN operators o ON a.approver_id = o.id
        WHERE a.command_id = $1
        ORDER BY a.decided_at ASC
        """,
        command_id,
    )
    cmd["approvals"] = [row_to_dict(a) for a in approvals]
    return cmd


# ── Approval endpoints ────────────────────────────────────────────────────────

@router.post("/{command_id}/approve")
async def approve_command(
    command_id: UUID,
    body: ApprovalRequest,
    current: TokenPayload = Depends(require_role(Role.APPROVER, Role.ADMIN)),
    db=Depends(get_db),
):
    cmd_row = await db.fetchrow(
        "SELECT id, status, submitter_id FROM commands WHERE id = $1", command_id
    )
    if not cmd_row:
        raise http_error(404, "COMMAND_NOT_FOUND", f"Command {command_id} not found")

    current_status = CommandStatus(cmd_row["status"])
    if current_status not in (CommandStatus.PENDING_SINGLE_APPROVAL,
                               CommandStatus.PENDING_DUAL_APPROVAL):
        raise http_error(409, "COMMAND_ALREADY_RESOLVED",
                         f"Command is already in state {current_status.value}")

    required = 1 if current_status == CommandStatus.PENDING_SINGLE_APPROVAL else 2

    try:
        new_status = await process_approval(
            command_id, UUID(current.sub), "APPROVED", body.justification, db
        )
    except ValueError as exc:
        code = str(exc)
        if "Self-approval" in code:
            raise http_error(403, "SELF_APPROVAL_FORBIDDEN",
                             "You cannot approve your own command")
        if code == "COMMAND_NOT_FOUND":
            raise http_error(404, "COMMAND_NOT_FOUND", f"Command {command_id} not found")
        raise

    count_row = await db.fetchrow(
        "SELECT COUNT(*) AS cnt FROM approvals WHERE command_id = $1 AND decision = 'APPROVED'",
        command_id,
    )
    approvals_recorded = int(count_row["cnt"])
    quorum_reached = new_status == CommandStatus.DISPATCHED

    if quorum_reached:
        cmd_detail = await db.fetchrow(
            "SELECT command_type, subsystem, parameters FROM commands WHERE id = $1", command_id
        )
        parsed_ns = types.SimpleNamespace(
            command_type=cmd_detail["command_type"],
            subsystem=cmd_detail["subsystem"],
            parameters=cmd_detail["parameters"],
        )
        await dispatch_to_obc(parsed_ns, command_id, db)

        approver_rows = await db.fetch(
            "SELECT approver_id FROM approvals WHERE command_id = $1 AND decision = 'APPROVED'",
            command_id,
        )
        approver_ids = [r["approver_id"] for r in approver_rows]

        try:
            await ledger_append(
                command_id=command_id,
                event_type="COMMAND_DISPATCHED",
                event_detail={"approved_by": [str(a) for a in approver_ids]},
                operator_id=UUID(current.sub),
                approver_ids=approver_ids,
                db_pool=db,
            )
        except Exception as exc:
            logger.error("Ledger append failed for COMMAND_DISPATCHED command_id=%s: %s",
                         command_id, exc)

        try:
            await ws_manager.broadcast_approver({
                "type": "COMMAND_DISPATCHED",
                "command_id": str(command_id),
                "approved_by": [str(a) for a in approver_ids],
            })
        except Exception as exc:
            logger.warning("WS broadcast failed COMMAND_DISPATCHED command_id=%s: %s",
                           command_id, exc)

    logger.info(
        "Command approved — id=%s approver=%s new_status=%s quorum=%s",
        command_id, sanitize(current.username), new_status.value, quorum_reached,
    )

    return {
        "command_id": str(command_id),
        "new_status": new_status.value,
        "approvals_recorded": approvals_recorded,
        "approvals_required": required,
        "quorum_reached": quorum_reached,
    }


@router.post("/{command_id}/reject")
async def reject_command(
    command_id: UUID,
    body: ApprovalRequest,
    current: TokenPayload = Depends(require_role(Role.APPROVER, Role.ADMIN)),
    db=Depends(get_db),
):
    cmd_row = await db.fetchrow(
        "SELECT id, status, submitter_id FROM commands WHERE id = $1", command_id
    )
    if not cmd_row:
        raise http_error(404, "COMMAND_NOT_FOUND", f"Command {command_id} not found")

    current_status = CommandStatus(cmd_row["status"])
    if current_status not in (CommandStatus.PENDING_SINGLE_APPROVAL,
                               CommandStatus.PENDING_DUAL_APPROVAL):
        raise http_error(409, "COMMAND_ALREADY_RESOLVED",
                         f"Command is already in state {current_status.value}")

    try:
        new_status = await process_approval(
            command_id, UUID(current.sub), "REJECTED", body.justification, db
        )
    except ValueError as exc:
        code = str(exc)
        if "Self-approval" in code:
            raise http_error(403, "SELF_APPROVAL_FORBIDDEN",
                             "You cannot reject your own command")
        if code == "COMMAND_NOT_FOUND":
            raise http_error(404, "COMMAND_NOT_FOUND", f"Command {command_id} not found")
        raise

    try:
        await ledger_append(
            command_id=command_id,
            event_type="COMMAND_REJECTED",
            event_detail={"reason": body.justification, "rejected_by": current.username},
            operator_id=UUID(current.sub),
            approver_ids=[],
            db_pool=db,
        )
    except Exception as exc:
        logger.error("Ledger append failed for COMMAND_REJECTED command_id=%s: %s",
                     command_id, exc)

    try:
        await ws_manager.broadcast_approver({
            "type": "COMMAND_REJECTED",
            "command_id": str(command_id),
            "rejected_by": current.username,
            "reason": body.justification,
        })
    except Exception as exc:
        logger.warning("WS broadcast failed COMMAND_REJECTED command_id=%s: %s",
                       command_id, exc)

    logger.info(
        "Command rejected — id=%s rejector=%s",
        command_id, sanitize(current.username),
    )

    return {"command_id": str(command_id), "new_status": new_status.value}
