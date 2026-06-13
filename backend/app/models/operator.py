"""Operator and authentication Pydantic models."""
from pydantic import BaseModel, field_validator
from enum import Enum
from uuid import UUID
from datetime import datetime


class Role(str, Enum):
    OPERATOR = "operator"
    APPROVER = "approver"
    ADMIN = "admin"


class OperatorCreate(BaseModel):
    username: str
    password: str
    role: Role
    full_name: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if len(v) > 64:
            raise ValueError("username must be at most 64 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        if len(v) > 256:
            raise ValueError("password must be at most 256 characters")
        return v


class OperatorOut(BaseModel):
    id: UUID
    username: str
    role: Role
    full_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenPayload(BaseModel):
    sub: str            # operator UUID as string
    role: Role
    username: str
    exp: datetime
    token_type: str     # "access" | "approval" | "override"
    command_id: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str
    # Required (validated server-side) when the account has MFA enabled
    totp_code: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    operator: OperatorOut
