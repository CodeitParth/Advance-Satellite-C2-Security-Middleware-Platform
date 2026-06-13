# Backend Context — FastAPI / Python

## Module Responsibilities (don't cross these)
| File | Single responsibility |
|---|---|
| `services/auth_service.py` | JWT create/decode, bcrypt, role enforcement |
| `services/ccsds_parser.py` | Packet parse only — never raises, always ParseResult |
| `services/telemetry_service.py` | In-memory singleton, async lock, fire-and-forget persist |
| `services/ai_scorer.py` | Gemini call + DEMO_MODE fallback — does NOT apply sequence elevation |
| `services/replay_detector.py` | OrderedDict nonce window + sequence rule table |
| `services/auth_chain.py` | State machine + timeout background task |
| `services/ledger_service.py` | SHA-256 chain append + verify — no UPDATE/DELETE ever |
| `services/obc_client.py` | UDP dispatch — timeout returns dict, never raises |
| `services/ws_manager.py` | ConnectionManager — DefaultDict[role → list[WebSocket]] |
| `services/override_service.py` | OverrideState singleton + auto-deactivation task |
| `routers/commands.py` | Wires all services — pipeline order is in TRD §6.11 |
| `middleware/error_handler.py` | All unhandled exceptions → standard error JSON |

## Pipeline Order (commands router — do not reorder)
1. JWT auth → 2. CCSDS parse → 3. Replay check → 4. Sequence check →
5. Telemetry inject → 6. Gemini score → 7. Sequence elevation →
8. Tier re-derive → 9. Override check → 10. Status determine →
11. DB store → 12. Ledger entry → 13. Dispatch if approved → 14. WS notify if pending

## Key Patterns
```python
# All services accept db pool as parameter — never import pool directly
async def my_service(data, db_pool):  ✓
_pool = get_pool()  ✗  # breaks test injection

# Telemetry update: fire-and-forget persist, never block
asyncio.create_task(persist_telemetry_snapshot(state))  ✓
await persist_telemetry_snapshot(state)  ✗  # blocks update path

# Gemini call: always thread + timeout
result = await asyncio.wait_for(asyncio.to_thread(_model.generate_content, prompt), timeout=10.0)

# Hash chain: sort_keys + UTF-8, timestamps as ISO strings, UUIDs as lowercase hyphenated
content = prev_hash + json.dumps(payload, sort_keys=True) + timestamp
entry_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
```

## Risk Thresholds
```python
# Always derive tier from score — never from model output
if score <= settings.risk_low_max:    tier = "LOW"     # default 30
elif score <= settings.risk_medium_max: tier = "MEDIUM"  # default 70
else:                                   tier = "HIGH"
```

## CCSDS Validation Order
1. Valid hex → 2. Length >= 7 → 3. Version == 1 → 4. Type == 1 (telecommand) →
5. APID in registry → 6. Data length matches → 7. CRC-16-CCITT valid → 8. Extract command type
Never raises — returns ParseResult(success=False, error_code=...)

## Sequence Rules (hardcoded, do not change values)
SEQ-001: DISABLE_SAFE_MODE → ATTITUDE_MANOEUVRE (60s, +20)
SEQ-002: DISABLE_SAFE_MODE → THRUSTER_FIRE (60s, +25)
SEQ-003: DISABLE_ENCRYPTION → any (120s, +30)
SEQ-004: RESET_OBC → DISABLE_WATCHDOG (30s, +35)
SEQ-005: UPDATE_AUTH_KEY → any (300s, +40)

## Auth Rules
- `require_role(Role.APPROVER, Role.ADMIN)` for approve/reject endpoints
- Self-approval check: `if str(approver.sub) == str(command.submitter_id): raise HTTPException(403)`
- Override minimum justification: 20 characters
- Approval token: 5-min JWT with `token_type="approval"` and `command_id` embedded

## Test Setup
```python
# Always use TEST_DATABASE_URL and DEMO_MODE=true in tests
# All tests roll back — never commit test data
@pytest.fixture(autouse=True)
async def test_db(db_pool):
    async with db_pool.acquire() as conn:
        await conn.execute("BEGIN")
        yield conn
        await conn.execute("ROLLBACK")
```
