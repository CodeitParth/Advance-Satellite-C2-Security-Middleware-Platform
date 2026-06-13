"""Ed25519 approval-decision signing (security spec: Approval signing → Ed25519).

Every approval decision is signed with the instance's Ed25519 private key over
a canonical JSON payload; the signature is stored alongside the approval row
(approvals.token_hash, 128 hex chars). Anyone holding the public key (exposed
via GET /api/v1/admin/config) can verify a decision offline — non-repudiation
for the authorization chain itself, complementing the SHA-256 ledger.

Key source:
- settings.ed25519_private_key_pem (env, PEM string) when provided — production
- otherwise a key auto-generated at first use and persisted to
  backend/keys/ed25519_private.pem (gitignored) so signatures stay verifiable
  across restarts in development.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from uuid import UUID

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from app.config import settings

logger = logging.getLogger(__name__)

_KEY_PATH = Path(__file__).parent.parent.parent / "keys" / "ed25519_private.pem"

_private_key: Ed25519PrivateKey | None = None


def _load_key() -> Ed25519PrivateKey:
    global _private_key
    if _private_key is not None:
        return _private_key

    if settings.ed25519_private_key_pem:
        _private_key = serialization.load_pem_private_key(
            settings.ed25519_private_key_pem.encode(), password=None
        )
        logger.info("Ed25519 signing key loaded from environment")
    elif _KEY_PATH.exists():
        _private_key = serialization.load_pem_private_key(
            _KEY_PATH.read_bytes(), password=None
        )
        logger.info("Ed25519 signing key loaded from %s", _KEY_PATH)
    else:
        _private_key = Ed25519PrivateKey.generate()
        _KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
        _KEY_PATH.write_bytes(
            _private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        logger.info("Ed25519 signing key generated and persisted to %s", _KEY_PATH)

    if not isinstance(_private_key, Ed25519PrivateKey):
        raise TypeError("Configured signing key is not Ed25519")
    return _private_key


def _canonical_payload(
    command_id: UUID, approver_id: UUID, decision: str, decided_at: datetime
) -> bytes:
    """Stable byte representation — identical at sign and verify time."""
    return json.dumps(
        {
            "command_id": str(command_id),
            "approver_id": str(approver_id),
            "decision": decision,
            "decided_at": decided_at.isoformat(),
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


# ── ML-DSA-65 backend (FIPS 204 post-quantum, roadmap F-15) ───────────────────
# Activated with APPROVAL_SIGNING_ALGORITHM=ml-dsa-65. Pure-Python dilithium-py
# — demo-grade performance (~100 ms/signature); production should use an HSM
# with native ML-DSA support (see docs/HARDENING.md).

_MLDSA_SK_PATH = _KEY_PATH.parent / "ml_dsa_65_private.bin"
_MLDSA_PK_PATH = _KEY_PATH.parent / "ml_dsa_65_public.bin"
_mldsa_keys: tuple[bytes, bytes] | None = None  # (pk, sk)


def _load_mldsa_keys() -> tuple[bytes, bytes]:
    global _mldsa_keys
    if _mldsa_keys is not None:
        return _mldsa_keys
    from dilithium_py.ml_dsa import ML_DSA_65
    if _MLDSA_SK_PATH.exists() and _MLDSA_PK_PATH.exists():
        _mldsa_keys = (_MLDSA_PK_PATH.read_bytes(), _MLDSA_SK_PATH.read_bytes())
    else:
        pk, sk = ML_DSA_65.keygen()
        _MLDSA_SK_PATH.parent.mkdir(parents=True, exist_ok=True)
        _MLDSA_SK_PATH.write_bytes(sk)
        _MLDSA_PK_PATH.write_bytes(pk)
        _mldsa_keys = (pk, sk)
        logger.info("ML-DSA-65 signing keypair generated at %s", _MLDSA_SK_PATH.parent)
    return _mldsa_keys


def _use_mldsa() -> bool:
    return settings.approval_signing_algorithm.lower() in ("ml-dsa-65", "ml_dsa_65", "mldsa65")


def sign_approval(
    command_id: UUID, approver_id: UUID, decision: str, decided_at: datetime
) -> str:
    """Sign an approval decision (hex). Ed25519 → 128 chars; ML-DSA-65 → ~6618."""
    payload = _canonical_payload(command_id, approver_id, decision, decided_at)
    if _use_mldsa():
        from dilithium_py.ml_dsa import ML_DSA_65
        _, sk = _load_mldsa_keys()
        return ML_DSA_65.sign(sk, payload).hex()
    return _load_key().sign(payload).hex()


def verify_approval(
    signature_hex: str,
    command_id: UUID,
    approver_id: UUID,
    decision: str,
    decided_at: datetime,
) -> bool:
    """Verify a stored approval signature. Signature length identifies the
    algorithm, so mixed-era ledgers verify correctly after a mode switch."""
    try:
        payload = _canonical_payload(command_id, approver_id, decision, decided_at)
        signature = bytes.fromhex(signature_hex)
        if len(signature) == 64:  # Ed25519
            _load_key().public_key().verify(signature, payload)
            return True
        from dilithium_py.ml_dsa import ML_DSA_65
        pk, _ = _load_mldsa_keys()
        return bool(ML_DSA_65.verify(pk, payload, signature))
    except Exception:
        return False


def public_key_pem() -> str:
    """Public key for external verification (exposed via /admin/config)."""
    return _load_key().public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
