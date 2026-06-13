"""Hash-chain ledger Pydantic models."""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class LedgerEntry(BaseModel):
    entry_id: UUID
    sequence: int
    prev_hash: str
    entry_hash: str
    command_id: UUID | None
    event_type: str
    event_detail: dict
    operator_id: UUID | None
    approver_ids: list[UUID]
    timestamp: datetime

    model_config = {"from_attributes": True}


class LedgerPage(BaseModel):
    entries: list[LedgerEntry]
    total: int
    page: int
    per_page: int
    total_pages: int


class LedgerVerifyResult(BaseModel):
    valid: bool
    entries_checked: int
    corrupted_at_sequence: int | None = None
    entry_id: str | None              = None
    expected_hash: str | None         = None
    stored_hash: str | None           = None
    verified_at: str                  = ""
