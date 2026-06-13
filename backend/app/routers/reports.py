"""Compliance report generation — Phase 2 F-14 (NIST IR 8401 aligned).

GET /api/v1/admin/reports/audit            → full audit report PDF
GET /api/v1/admin/reports/operator/{id}    → per-operator activity report PDF

Reports carry an integrity certificate: the live hash-chain verification result
plus an HMAC-SHA256 signature over the chain head, so a printed report can be
matched against the ledger state it described. ADMIN only.
"""
import hashlib
import hmac
import io
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings
from app.database import get_db
from app.middleware.auth_middleware import require_role
from app.models.operator import Role, TokenPayload
from app.services.ledger_service import verify_chain
from app.utils.errors import error_dict

router = APIRouter()
logger = logging.getLogger(__name__)

ACCENT = colors.HexColor("#4F6BFF")
DANGER = colors.HexColor("#EF4444")
SUCCESS = colors.HexColor("#16A34A")
MUTED = colors.HexColor("#6B7280")


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontSize=16, spaceAfter=2),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontSize=9, textColor=MUTED),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=11, textColor=ACCENT, spaceBefore=10),
        "body": ParagraphStyle("body", parent=base["Normal"], fontSize=8.5, leading=12),
        "mono": ParagraphStyle("mono", parent=base["Normal"], fontSize=7, fontName="Courier", leading=9),
    }


def _table(data: list[list], col_widths=None) -> Table:
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D1D5DB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F3F6FB")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    return t


def _integrity_certificate(verify_result: dict, head_hash: str) -> tuple[list[list], str]:
    """Certificate rows + HMAC signature binding the report to the chain head."""
    signature = hmac.new(
        settings.jwt_secret_key.encode(),
        f"{head_hash}|{verify_result.get('entries_checked')}|{verify_result.get('valid')}".encode(),
        hashlib.sha256,
    ).hexdigest()
    rows = [
        ["Field", "Value"],
        ["Chain valid", "YES — all hash links verified" if verify_result.get("valid") else
         f"NO — corrupted at sequence {verify_result.get('corrupted_at_sequence')}"],
        ["Entries verified", str(verify_result.get("entries_checked", 0))],
        ["Chain head hash", head_hash],
        ["Certificate signature (HMAC-SHA256)", signature],
        ["Algorithm", "SHA-256 hash chain · genesis 0x00…00"],
    ]
    return rows, signature


def _pdf_response(buffer: io.BytesIO, filename: str) -> StreamingResponse:
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _detail_get(detail, key, default=""):
    if isinstance(detail, str):
        try:
            detail = json.loads(detail)
        except ValueError:
            return default
    return (detail or {}).get(key, default)


@router.get("/audit")
async def audit_report(
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    """NIST IR 8401-aligned audit report: summary, integrity certificate,
    security events, and the most recent 100 ledger entries."""
    s = _styles()
    now = datetime.now(timezone.utc)

    verify_result = await verify_chain(db)
    head = await db.fetchrow("SELECT entry_hash, sequence FROM ledger ORDER BY sequence DESC LIMIT 1")
    head_hash = head["entry_hash"] if head else "0" * 64

    totals = await db.fetch("SELECT event_type, COUNT(*) AS cnt FROM ledger GROUP BY event_type ORDER BY cnt DESC")
    cmd_totals = await db.fetch("SELECT status, COUNT(*) AS cnt FROM commands GROUP BY status ORDER BY cnt DESC")
    recent = await db.fetch(
        """
        SELECT l.sequence, l.timestamp, l.event_type, l.event_detail, l.entry_hash,
               o.username
        FROM ledger l LEFT JOIN operators o ON l.operator_id = o.id
        ORDER BY l.sequence DESC LIMIT 100
        """
    )

    cert_rows, _sig = _integrity_certificate(verify_result, head_hash)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=16 * mm, bottomMargin=14 * mm,
                            leftMargin=14 * mm, rightMargin=14 * mm,
                            title="SCSP Audit Report")
    story = [
        Paragraph("SCSP — Command Authorization Audit Report", s["title"]),
        Paragraph(
            f"NIST IR 8401 aligned · Generated {now.isoformat()} · Requested by {current.username} (admin) · "
            f"Environment: {settings.app_env}", s["subtitle"]),
        Spacer(1, 4 * mm),

        Paragraph("1. Ledger Integrity Certificate", s["h2"]),
        _table(cert_rows, col_widths=[55 * mm, 125 * mm]),
        Spacer(1, 2 * mm),
        Paragraph(
            "The certificate signature is an HMAC-SHA256 over the chain head hash and verification result. "
            "Recompute against the live ledger to confirm this report describes the current chain state.",
            s["body"]),

        Paragraph("2. Event Summary", s["h2"]),
        _table([["Event Type", "Count"]] + [[r["event_type"], str(r["cnt"])] for r in totals],
               col_widths=[120 * mm, 60 * mm]),

        Paragraph("3. Command Outcomes", s["h2"]),
        _table([["Status", "Count"]] + [[r["status"], str(r["cnt"])] for r in cmd_totals],
               col_widths=[120 * mm, 60 * mm]),

        Paragraph("4. Recent Ledger Entries (latest 100)", s["h2"]),
        _table(
            [["Seq", "Timestamp (UTC)", "Event", "Command", "Operator", "Hash (12)"]] + [
                [
                    str(r["sequence"]),
                    r["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                    r["event_type"],
                    str(_detail_get(r["event_detail"], "command_type", "—")),
                    r["username"] or "system",
                    r["entry_hash"][:12] + "…",
                ]
                for r in recent
            ],
            col_widths=[12 * mm, 32 * mm, 44 * mm, 38 * mm, 26 * mm, 28 * mm],
        ),
    ]
    doc.build(story)

    logger.info("Audit report generated — admin=%s entries=%s valid=%s",
                current.username, verify_result.get("entries_checked"), verify_result.get("valid"))
    return _pdf_response(buf, f"scsp-audit-report-{now.strftime('%Y%m%d-%H%M%S')}.pdf")


@router.get("/operator/{operator_id}")
async def operator_activity_report(
    operator_id: UUID,
    current: TokenPayload = Depends(require_role(Role.ADMIN)),
    db=Depends(get_db),
):
    """Per-operator activity report: profile, baseline, command statistics,
    and the operator's most recent 50 commands."""
    s = _styles()
    now = datetime.now(timezone.utc)

    op = await db.fetchrow(
        "SELECT username, full_name, role, created_at, last_login, is_active, baseline_profile "
        "FROM operators WHERE id = $1", operator_id)
    if not op:
        raise HTTPException(status_code=404, detail=error_dict("USER_NOT_FOUND", "No operator with that id"))

    by_status = await db.fetch(
        "SELECT status, COUNT(*) AS cnt FROM commands WHERE submitter_id = $1 GROUP BY status ORDER BY cnt DESC",
        operator_id)
    by_type = await db.fetch(
        "SELECT command_type, COUNT(*) AS cnt, ROUND(AVG(risk_score)) AS avg_risk "
        "FROM commands WHERE submitter_id = $1 GROUP BY command_type ORDER BY cnt DESC LIMIT 15",
        operator_id)
    recent = await db.fetch(
        "SELECT submitted_at, command_type, subsystem, risk_score, risk_tier, status "
        "FROM commands WHERE submitter_id = $1 ORDER BY submitted_at DESC LIMIT 50",
        operator_id)

    baseline = op["baseline_profile"]
    if isinstance(baseline, str):
        try:
            baseline = json.loads(baseline)
        except ValueError:
            baseline = {}
    baseline = baseline or {}

    profile_rows = [
        ["Field", "Value"],
        ["Username", op["username"]],
        ["Full name", op["full_name"] or "—"],
        ["Role", op["role"]],
        ["Account created", op["created_at"].strftime("%Y-%m-%d")],
        ["Last login", op["last_login"].strftime("%Y-%m-%d %H:%M") if op["last_login"] else "never"],
        ["Status", "active" if op["is_active"] else "deactivated"],
    ]
    if baseline.get("mean_commands_per_session") is not None:
        profile_rows += [
            ["Baseline — mean cmds/session",
             f"{baseline['mean_commands_per_session']} (σ {baseline.get('std_commands_per_session')})"],
            ["Baseline — typical hours",
             f"{baseline.get('typical_hour_start')}:00 UTC ± {baseline.get('typical_hour_window')}h"],
            ["Baseline — sessions observed", str(baseline.get("sessions_observed"))],
        ]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=16 * mm, bottomMargin=14 * mm,
                            leftMargin=14 * mm, rightMargin=14 * mm,
                            title=f"SCSP Operator Report — {op['username']}")
    story = [
        Paragraph(f"SCSP — Operator Activity Report: {op['username']}", s["title"]),
        Paragraph(f"Generated {now.isoformat()} · Requested by {current.username} (admin)", s["subtitle"]),
        Spacer(1, 4 * mm),

        Paragraph("1. Operator Profile & Behavioral Baseline", s["h2"]),
        _table(profile_rows, col_widths=[60 * mm, 120 * mm]),

        Paragraph("2. Command Outcomes", s["h2"]),
        _table([["Status", "Count"]] + [[r["status"], str(r["cnt"])] for r in by_status],
               col_widths=[120 * mm, 60 * mm]),

        Paragraph("3. Command Types (top 15)", s["h2"]),
        _table([["Command Type", "Count", "Avg Risk"]] +
               [[r["command_type"], str(r["cnt"]), str(int(r["avg_risk"] or 0))] for r in by_type],
               col_widths=[100 * mm, 40 * mm, 40 * mm]),

        Paragraph("4. Recent Commands (latest 50)", s["h2"]),
        _table(
            [["Submitted (UTC)", "Command", "Subsystem", "Risk", "Tier", "Status"]] + [
                [
                    r["submitted_at"].strftime("%Y-%m-%d %H:%M"),
                    r["command_type"],
                    r["subsystem"],
                    str(r["risk_score"]),
                    r["risk_tier"],
                    r["status"],
                ]
                for r in recent
            ],
            col_widths=[32 * mm, 46 * mm, 24 * mm, 16 * mm, 22 * mm, 40 * mm],
        ),
    ]
    doc.build(story)

    logger.info("Operator report generated — target=%s by admin=%s", op["username"], current.username)
    return _pdf_response(buf, f"scsp-operator-{op['username']}-{now.strftime('%Y%m%d-%H%M%S')}.pdf")
