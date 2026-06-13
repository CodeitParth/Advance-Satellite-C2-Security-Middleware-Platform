"""Approval request and response Pydantic models."""
from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime


class ApprovalRequest(BaseModel):
    justification: str

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("justification cannot be empty")
        if len(v) > 1000:
            raise ValueError("justification must be at most 1000 characters")
        return v


class ApprovalOut(BaseModel):
    id: UUID
    command_id: UUID
    approver_id: UUID
    decision: str
    justification: str | None
    decided_at: datetime
    is_override: bool

    model_config = {"from_attributes": True}
