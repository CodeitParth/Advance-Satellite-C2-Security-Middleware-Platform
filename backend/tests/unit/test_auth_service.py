"""Unit tests — JWT lifecycle, bcrypt, Ed25519 signing. TRD §16.1"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import settings
from app.models.operator import Role
from app.services.auth_service import (
    create_access_token,
    create_approval_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.services.signing_service import sign_approval, verify_approval


class TestPasswords:
    def test_hash_and_verify(self):
        h = hash_password("correct horse battery")
        assert h.startswith("$2b$")
        assert verify_password("correct horse battery", h)
        assert not verify_password("wrong", h)

    def test_malformed_hash_returns_false(self):
        assert verify_password("anything", "not-a-bcrypt-hash") is False

    def test_cost_factor_from_settings(self):
        assert f"$2b${settings.bcrypt_rounds:02d}$" in hash_password("x" * 8)


class TestJwt:
    def test_access_token_roundtrip(self):
        op_id = uuid4()
        token = create_access_token(op_id, Role.OPERATOR, "op_chen")
        payload = decode_token(token)
        assert payload.sub == str(op_id)
        assert payload.role == Role.OPERATOR
        assert payload.token_type == "access"

    def test_expired_token_rejected(self):
        expired = jwt.encode(
            {
                "sub": str(uuid4()), "role": "operator", "username": "x",
                "token_type": "access",
                "exp": (datetime.now(timezone.utc) - timedelta(minutes=1)).timestamp(),
            },
            settings.jwt_secret_key, algorithm=settings.jwt_algorithm,
        )
        with pytest.raises(HTTPException) as exc:
            decode_token(expired)
        assert exc.value.status_code == 401

    def test_bad_signature_rejected(self):
        forged = jwt.encode(
            {
                "sub": str(uuid4()), "role": "admin", "username": "evil",
                "token_type": "access",
                "exp": (datetime.now(timezone.utc) + timedelta(hours=1)).timestamp(),
            },
            "wrong-secret-key-0123456789abcdef", algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc:
            decode_token(forged)
        assert exc.value.status_code == 401

    def test_approval_token_carries_command_and_short_expiry(self):
        cmd_id = uuid4()
        payload = decode_token(create_approval_token(uuid4(), cmd_id), require_type="approval")
        assert payload.token_type == "approval"
        assert payload.command_id == str(cmd_id)
        remaining = payload.exp - datetime.now(timezone.utc)
        assert remaining <= timedelta(minutes=settings.approval_token_expire_minutes)


class TestEd25519Signing:
    def test_sign_verify_roundtrip(self):
        cmd, appr, ts = uuid4(), uuid4(), datetime.now(timezone.utc)
        sig = sign_approval(cmd, appr, "APPROVED", ts)
        assert len(sig) == 128
        assert verify_approval(sig, cmd, appr, "APPROVED", ts)

    def test_tampered_fields_fail(self):
        cmd, appr, ts = uuid4(), uuid4(), datetime.now(timezone.utc)
        sig = sign_approval(cmd, appr, "APPROVED", ts)
        assert not verify_approval(sig, cmd, appr, "REJECTED", ts)
        assert not verify_approval(sig, uuid4(), appr, "APPROVED", ts)
