# SCSP — AI Agent Task Instruction Document
# Satellite Command Security Platform — MVP Build

---

## How to Use This Document

This document is your **primary directive**. The PRD and TRD are reference material.
Do not read the PRD or TRD in full before starting. Read only the sections pointed to
by each task below. Execute tasks in the numbered order. Do not skip ahead.

**On ambiguity**: If a task is unclear, resolve it using the TRD section referenced.
If the TRD does not resolve it, use the most conservative, minimal implementation
and leave a `# TODO: CLARIFY —` comment.

**On completion**: A task is complete when all its acceptance criteria are satisfied
and all referenced tests pass. Mark complete tasks with a commit message following
the convention in `CONTRIBUTING.md`.

**Phase tags**: Only build `[MVP]` items. Do not implement `[PHASE_2]` or `[ROADMAP]`
items — scaffold file stubs with `# PHASE_2: not implemented` comments only.

---

## Build Order — Master Task List

```
BLOCK 0  — Environment & Scaffold          (pre-code, ~2h)
BLOCK 1  — Database & Auth                 (backend foundation, ~4h)
BLOCK 2  — CCSDS + Telemetry + Replay      (ingress pipeline, ~4h)
BLOCK 3  — AI Scoring Engine               (core intelligence, ~3h)
BLOCK 4  — Authorization State Machine     (approval chain, ~4h)
BLOCK 5  — Hash-Chain Ledger               (audit trail, ~2h)
BLOCK 6  — OBC Simulator + Dispatch        (space segment, ~2h)
BLOCK 7  — WebSocket + Override            (real-time + safety, ~2h)
BLOCK 8  — API Routes (wire everything)    (integration, ~3h)
BLOCK 9  — Frontend Foundation             (Next.js scaffold, ~3h)
BLOCK 10 — Frontend Operator Dashboard     (core UI, ~4h)
BLOCK 11 — Frontend Approver Panel         (approval UI, ~3h)
BLOCK 12 — Frontend Admin / Ledger         (admin UI, ~2h)
BLOCK 13 — Seed Scripts + Demo State       (data layer, ~3h)
BLOCK 14 — Integration & Demo Verification (final QA, ~3h)
```

---

## BLOCK 0 — Environment & Scaffold

### T-001 — Initialize repository structure `[MVP]`

**TRD Reference**: §4 Repository Structure

Create the exact directory and file tree specified in TRD §4. For each `.py` or `.ts`
file, create it with only the module docstring and necessary imports — no implementation.
This gives the agent a concrete file map to fill in subsequent tasks.

```
Required files to create (stubs only):
backend/app/main.py
backend/app/config.py
backend/app/database.py
backend/app/models/command.py
backend/app/models/operator.py
backend/app/models/ledger.py
backend/app/models/telemetry.py
backend/app/models/approval.py
backend/app/routers/auth.py
backend/app/routers/commands.py
backend/app/routers/telemetry.py
backend/app/routers/ledger.py
backend/app/routers/override.py
backend/app/routers/websocket.py
backend/app/services/auth_service.py
backend/app/services/ccsds_parser.py
backend/app/services/telemetry_service.py
backend/app/services/ai_scorer.py
backend/app/services/replay_detector.py
backend/app/services/auth_chain.py
backend/app/services/ledger_service.py
backend/app/services/obc_client.py
backend/app/services/ws_manager.py
backend/app/services/override_service.py
backend/app/middleware/auth_middleware.py
backend/app/middleware/error_handler.py
obc/obc_simulator.py
frontend/middleware.ts
frontend/lib/api.ts
frontend/lib/types.ts
frontend/hooks/useApprovalWebSocket.ts
frontend/hooks/useTelemetry.ts
frontend/hooks/useAuth.ts
```

**Acceptance criteria**:
- [ ] All directories exist
- [ ] All stub files exist with correct module docstrings
- [ ] `python -c "from app.main import app"` runs without ImportError
- [ ] `npm install` completes without errors in `/frontend`

---

### T-002 — Configure environment files `[MVP]`

**TRD Reference**: §5 Environment Configuration

Create `.env` (backend) and `.env.local` (frontend) from the exact variable lists
in TRD §5. Use the exact variable names — case-sensitive.

Create `.env.example` (backend) and `.env.local.example` (frontend) with all keys
present but values replaced with `<REPLACE_ME>`. These go in version control.
The filled `.env` files do NOT go in version control — add to `.gitignore`.

**Acceptance criteria**:
- [ ] `.env.example` contains all 20 backend variables
- [ ] `.env.local.example` contains all 3 frontend variables
- [ ] `settings = Settings()` loads without error when `.env` is populated
- [ ] Startup raises `ValueError` if `DEMO_MODE=false` and `GEMINI_API_KEY` is empty

---

### T-003 — Implement Settings with validation `[MVP]`

**TRD Reference**: §5 — Settings class, `model_validator`

Implement `backend/app/config.py` exactly as specified in TRD §5. The `Settings`
class must use `pydantic-settings` `BaseSettings`. All fields must have correct
types and defaults. The `validate_gemini_key` validator is mandatory.

**Acceptance criteria**:
- [ ] `from app.config import settings` works
- [ ] `settings.risk_low_max` returns `30` by default
- [ ] `settings.demo_mode` returns `False` by default
- [ ] Test: instantiate Settings with no GEMINI_API_KEY and DEMO_MODE=false → raises ValueError
- [ ] Test: instantiate Settings with DEMO_MODE=true and no GEMINI_API_KEY → no error

---

## BLOCK 1 — Database & Auth

### T-004 — Database connection pool `[MVP]`

**TRD Reference**: §7.1 Connection & Pool Configuration

Implement `backend/app/database.py` exactly as specified. The `_pool` module-level
variable, `create_pool()`, `close_pool()`, and `get_db()` functions are all required.
`get_db` is a FastAPI dependency — it must be usable with `Depends(get_db)`.

**Acceptance criteria**:
- [ ] `create_pool()` connects to PostgreSQL without error given valid `DATABASE_URL`
- [ ] `get_db()` returns a pool object
- [ ] `close_pool()` closes all connections gracefully
- [ ] Pool respects `DATABASE_POOL_MIN` and `DATABASE_POOL_MAX` settings

---

### T-005 — Apply database migration `[MVP]`

**TRD Reference**: §7.2 Migration Strategy, §7.3 Full Schema DDL

Create `backend/migrations/001_initial_schema.sql` containing the exact DDL from
TRD §7.3 verbatim. Do not alter table names, column names, types, or constraints.

The DDL must be idempotent — wrap in `CREATE TABLE IF NOT EXISTS` where applicable.
The ledger append-only rules (`CREATE RULE ledger_no_update`, `ledger_no_delete`)
are mandatory — do not omit them.

Apply with:
```bash
psql $DATABASE_URL < backend/migrations/001_initial_schema.sql
```

**Acceptance criteria**:
- [ ] Migration runs without error on empty database
- [ ] Migration runs without error a second time (idempotent)
- [ ] `\dt` in psql shows: operators, commands, approvals, ledger, telemetry_states, schema_migrations
- [ ] `UPDATE ledger SET entry_hash = 'x' WHERE sequence = 1` silently does nothing (rule active)
- [ ] `DELETE FROM ledger WHERE sequence = 1` silently does nothing (rule active)

---

### T-006 — Implement Pydantic models `[MVP]`

**TRD Reference**: §6.2 Auth Module (TokenPayload, Role), §6.5 AI Scorer (ScoreRequest, ScoreResponse), §6.4 Telemetry (TelemetryState)

Implement all Pydantic models in `backend/app/models/`. Each model file contains
only models — no business logic. Import from these in services and routers.

**Models required**:

`models/operator.py`:
```python
class Role(str, Enum): OPERATOR / APPROVER / ADMIN
class OperatorCreate(BaseModel): username, password, role, full_name
class OperatorOut(BaseModel): id, username, role, full_name, created_at
class TokenPayload(BaseModel): sub, role, username, exp, token_type, command_id
class LoginRequest(BaseModel): username, password
class LoginResponse(BaseModel): access_token, token_type, expires_in, operator
```

`models/command.py`:
```python
class ParsedCommand(BaseModel): apid, subsystem, command_type, sequence_count, parameters, raw_packet_hex, crc_valid
class ParseResult(BaseModel): success, parsed, error, error_code
class CommandSubmitRequest(BaseModel): packet_hex, nonce
class CommandSubmitResponse(BaseModel): command_id, status, risk_score, risk_tier, justification, sparta_technique, cvss_estimate, affected_subsystems, sequence_alerts
class ScoreRequest(BaseModel): [all fields from TRD §6.5]
class ScoreResponse(BaseModel): [all fields from TRD §6.5]
class CommandStatus(str, Enum): [all statuses from TRD §6.7]
```

`models/telemetry.py`:
```python
class ThermalStatus(str, Enum): NOMINAL / ELEVATED / CRITICAL
class OrbitalPhase(str, Enum): SUNLIT / ECLIPSE / PENUMBRA
class TelemetryState(BaseModel): [all fields from TRD §6.4]
class TelemetryUpdate(BaseModel): all fields Optional for partial update
```

`models/ledger.py`:
```python
class LedgerEntry(BaseModel): entry_id, sequence, prev_hash, entry_hash, command_id, event_type, event_detail, operator_id, approver_ids, timestamp
class LedgerVerifyResult(BaseModel): valid, entries_checked, corrupted_at_sequence, entry_id, verified_at
```

`models/approval.py`:
```python
class ApprovalRequest(BaseModel): justification (min_length=1)
class ApprovalOut(BaseModel): id, command_id, approver_id, decision, justification, decided_at, is_override
```

**Acceptance criteria**:
- [ ] All models import without error
- [ ] Pydantic validation fires correctly on invalid input for each model
- [ ] `CommandStatus` enum covers all 11 statuses from TRD §6.7
- [ ] `TelemetryState` default values match TRD §6.4 exactly

---

### T-007 — Implement auth service `[MVP]`

**TRD Reference**: §6.2 Authentication Module

Implement `backend/app/services/auth_service.py` with all functions listed in TRD
§6.2. Use `passlib[bcrypt]` for password hashing and `python-jose[cryptography]` for
JWT. Cost factor for bcrypt must be 12 (from settings).

Implement `backend/app/middleware/auth_middleware.py` with:
- `get_current_operator()` FastAPI dependency
- `require_role(*roles)` dependency factory

RBAC enforcement table from TRD §6.2 must be followed exactly.
The self-approval check is NOT in auth_service — it belongs in the commands router
(T-017). Auth service only handles token mechanics and role enforcement.

**Acceptance criteria**:
- [ ] `hash_password("test123")` returns a bcrypt hash starting with `$2b$`
- [ ] `verify_password("test123", hash)` returns True
- [ ] `verify_password("wrong", hash)` returns False
- [ ] `create_access_token(...)` returns a decodable JWT with correct `role` and `sub`
- [ ] `decode_token(expired_token)` raises `AuthenticationError`
- [ ] `require_role(Role.ADMIN)` on an OPERATOR token returns 403
- [ ] `create_approval_token(...)` includes `command_id` in payload

---

### T-008 — Implement auth router `[MVP]`

**TRD Reference**: §14.1 Authentication Endpoints

Implement `backend/app/routers/auth.py` with:
- `POST /login` — validates credentials, returns `LoginResponse`
- `POST /refresh` — validates existing token, returns new access token

Login must query the `operators` table by username, verify bcrypt hash,
update `last_login` timestamp, and return the full `LoginResponse` schema.

Failed logins must return `401` with code `INVALID_CREDENTIALS`.
Do not reveal whether username or password was wrong (return the same error for both).

**Acceptance criteria**:
- [ ] `POST /login` with valid credentials returns 200 + JWT
- [ ] `POST /login` with wrong password returns 401 `INVALID_CREDENTIALS`
- [ ] `POST /login` with unknown username returns 401 `INVALID_CREDENTIALS`
- [ ] Returned JWT decodes to correct `sub`, `role`, `username` claims
- [ ] `last_login` updated in database after successful login

---

## BLOCK 2 — CCSDS + Telemetry + Replay

### T-009 — Implement CCSDS parser `[MVP]`

**TRD Reference**: §6.3 CCSDS Parser Module

Implement `backend/app/services/ccsds_parser.py` exactly as specified.

The `APID_REGISTRY` dict must contain all 15 entries from TRD §6.3.
The `compute_crc16_ccitt` function uses polynomial `0x1021`, init `0xFFFF`.
The `parse_ccsds_packet` function NEVER raises exceptions — all failures
are returned as `ParseResult(success=False, error_code=...)`.

Validation sequence must follow the exact 8-step order in TRD §6.3.

**CRC-16-CCITT implementation**:
```python
def compute_crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
        crc &= 0xFFFF
    return crc
```

Test packets are provided in `backend/fixtures/ccsds_packets.json`.
All 15 packet types must parse successfully against their fixtures.

**Acceptance criteria**:
- [ ] All 15 packet types in `ccsds_packets.json` parse with `success=True`
- [ ] Packet with wrong version field → `error_code = "INVALID_VERSION"`
- [ ] Packet with unknown APID → `error_code = "UNKNOWN_APID"`
- [ ] Packet with bad data length → `error_code = "BAD_LENGTH"`
- [ ] Packet with bad CRC → `error_code = "BAD_CRC"`
- [ ] Empty string input → `error_code = "INVALID_HEX"`
- [ ] Non-hex characters → `error_code = "INVALID_HEX"`
- [ ] Function never raises — all errors in ParseResult

---

### T-010 — Implement telemetry state service `[MVP]`

**TRD Reference**: §6.4 Telemetry State Service

Implement `backend/app/services/telemetry_service.py` as the async singleton
described in TRD §6.4. The `_lock: asyncio.Lock` must be a class variable
initialized at class definition time, not in `__init__`.

The `update()` method must fire-and-forget persist to `telemetry_states` table
using `asyncio.create_task()`. Do not await the persist — it must not block the
update path.

Default state values must match TRD §6.4 exactly:
battery=78.0, safe_mode=False, thermal=NOMINAL, orbital=SUNLIT, link_margin=12.5

**Acceptance criteria**:
- [ ] `TelemetryService.get_current()` returns a `TelemetryState` with correct defaults
- [ ] `TelemetryService.update({"battery_percent": 9.0})` updates only battery
- [ ] Concurrent updates do not corrupt state (lock working)
- [ ] `updated_at` field is set to current ISO timestamp after each update
- [ ] Persist task fires without blocking the update caller

---

### T-011 — Implement replay detection service `[MVP]`

**TRD Reference**: §6.6 Replay Detection Service

Implement `backend/app/services/replay_detector.py` using `OrderedDict` for the
nonce window as specified. The eviction must use `popitem(last=False)` to evict
the oldest entry — FIFO order.

All 5 sequence rules from TRD §6.6 `SEQUENCE_RULES` list must be present verbatim
with correct `window_s` and `elevation` values.

`check_replay()` must be synchronous (not async) — it operates on in-memory state.
`check_sequence()` must be synchronous.

**Rule validation**: After calling `check_sequence("DISABLE_SAFE_MODE")`, a subsequent
call to `check_sequence("ATTITUDE_MANOEUVRE")` within 60 seconds must return
`[{"rule_id": "SEQ-001", "score_elevation": 20, "trigger_command": "DISABLE_SAFE_MODE"}]`.

**Acceptance criteria**:
- [ ] First nonce → `check_replay()` returns False
- [ ] Same nonce second time → returns True
- [ ] After 100 unique nonces, the 101st evicts the 1st (window size maintained)
- [ ] SEQ-001 through SEQ-005 all trigger correctly
- [ ] Commands outside any rule's time window do not trigger
- [ ] `check_sequence` returns empty list for commands with no matching rule

---

## BLOCK 3 — AI Scoring Engine

### T-012 — Implement AI scoring engine `[MVP]`

**TRD Reference**: §6.5 AI Risk Scoring Engine, §11 AI Scoring Engine Deep Spec

Implement `backend/app/services/ai_scorer.py`.

**DEMO_MODE path** must be implemented first and verified before the live path.
The fixture file `backend/fixtures/demo_scores.json` must exist and contain the
4 command types from TRD §11.4 with exact score values.

For command types NOT in the fixture file, DEMO_MODE must return the MEDIUM fixture
(UPDATE_PARAMETER) as a safe default — never raise an exception.

**Live path**: Use `asyncio.to_thread()` to run the synchronous Gemini call without
blocking the event loop. Apply a 10-second timeout using `asyncio.wait_for()`.

**Output validation**: Use `validate_score_response()` (TRD §11.3) to normalize
all Gemini responses. The tier must ALWAYS be derived from the score using
`settings.risk_low_max` and `settings.risk_medium_max` — never trust the model's
tier output directly.

**Sequence elevation**: After the base score is returned, the caller (commands router)
applies sequence elevation. The scorer itself does not know about sequence rules.

**Acceptance criteria**:
- [ ] `DEMO_MODE=true` → `REQUEST_TELEMETRY` returns score=5, tier=LOW
- [ ] `DEMO_MODE=true` → `DISABLE_SAFE_MODE` returns score=87, tier=HIGH
- [ ] `DEMO_MODE=true` → unknown command type returns MEDIUM fixture without error
- [ ] `DEMO_MODE=false` → live Gemini call with valid API key returns valid ScoreResponse
- [ ] Score is always clamped to 0–100
- [ ] Tier is always derived from score, never from model output
- [ ] 10-second timeout raises ScoringError on timeout
- [ ] `scored_at` field is populated with current timestamp

---

### T-013 — Create Gemini prompt regression test `[MVP]`

**Reference**: `PROMPT_REGRESSION_TESTS.md` (companion document)

Create `backend/scripts/test_prompt.py` — a standalone script that tests the
scoring prompt against 10 input pairs from the regression test file.

```python
# Usage: python scripts/test_prompt.py
# Requires GEMINI_API_KEY in environment
# Prints PASS/FAIL per test case + overall summary
```

Run this script and iterate on the prompt template in `ai_scorer.py` until all
10 test cases pass. Do not proceed to T-014 until all cases pass.

**Acceptance criteria**:
- [ ] Script runs without error
- [ ] All 10 test cases produce correct `risk_tier`
- [ ] No test case takes longer than 3 seconds
- [ ] Script outputs clear PASS/FAIL per case

---

## BLOCK 4 — Authorization State Machine

### T-014 — Implement authorization state machine `[MVP]`

**TRD Reference**: §6.7 Authorization State Machine

Implement `backend/app/services/auth_chain.py`.

`determine_initial_status()` must check `is_override_active()` from
`override_service.py` (T-019). Import it lazily or pass as parameter to avoid
circular imports.

`process_approval()` must raise `ValueError` (not HTTPException) when self-approval
is attempted. The router (T-017) converts this to a 403 response.

`check_pending_timeouts()` is a background task started in `app/main.py` lifespan.
It runs every 30 seconds using `asyncio.sleep(30)`.

The state machine diagram in TRD §6.7 is the source of truth for all transitions.
No transition not shown in that diagram should be implemented.

**Acceptance criteria**:
- [ ] `determine_initial_status("LOW", False)` → `AUTO_APPROVED`
- [ ] `determine_initial_status("MEDIUM", False)` → `PENDING_SINGLE_APPROVAL`
- [ ] `determine_initial_status("HIGH", False)` → `PENDING_DUAL_APPROVAL`
- [ ] `determine_initial_status("HIGH", True)` → `EMERGENCY_OVERRIDE`
- [ ] `process_approval(cmd_id, same_operator_id, ...)` raises ValueError
- [ ] `process_approval(cmd_id, approver_1, "APPROVED")` on HIGH → status unchanged (still PENDING)
- [ ] `process_approval(cmd_id, approver_2, "APPROVED")` on HIGH → status → DISPATCHED
- [ ] `process_approval(cmd_id, approver_1, "REJECTED")` → status → REJECTED immediately
- [ ] Timeout handler escalates MEDIUM → PENDING_DUAL after 5 minutes
- [ ] Timeout handler blocks PENDING_DUAL after 5 minutes

---

## BLOCK 5 — Hash-Chain Ledger

### T-015 — Implement hash-chain ledger service `[MVP]`

**TRD Reference**: §6.8 Hash-Chain Ledger Service

Implement `backend/app/services/ledger_service.py`.

The `GENESIS_HASH` constant must be exactly `"0" * 64`.

The `_compute_hash()` function must follow the canonicalization rules in TRD §12.4:
- JSON serialized with `sort_keys=True`
- Encoded as UTF-8
- Timestamps as ISO 8601 strings
- UUIDs as lowercase hyphenated strings
- Empty lists as `[]`

The `verify_chain()` function must return the exact dict structure from TRD §6.8 —
`valid`, `entries_checked`, and on failure `corrupted_at_sequence`, `entry_id`,
`expected_hash`, `stored_hash`.

**IMPORTANT**: The database `RULE` blocks UPDATE/DELETE on the ledger table at
the Postgres level. The ledger service must never attempt UPDATE or DELETE on
this table — only INSERT and SELECT.

**Acceptance criteria**:
- [ ] First `append()` call uses GENESIS_HASH as `prev_hash`
- [ ] Second `append()` call uses first entry's `entry_hash` as `prev_hash`
- [ ] `verify_chain()` on 10 unmodified entries returns `{"valid": True, "entries_checked": 10}`
- [ ] Directly UPDATE one entry's `entry_hash` in DB → `verify_chain()` returns `valid=False` at correct sequence
- [ ] Modifying a field used in hash computation (e.g. event_type) → `verify_chain()` detects tampering
- [ ] `verify_chain()` on empty ledger returns `{"valid": True, "entries_checked": 0}`

---

## BLOCK 6 — OBC Simulator & Dispatch

### T-016 — Implement mock OBC UDP server `[MVP]`

**TRD Reference**: §9 Mock Satellite OBC

Implement `obc/obc_simulator.py` as a standalone Python script (not a module).
It must be runnable with `python obc_simulator.py` from the `obc/` directory.

Use the `satellite_state` dict from TRD §9.2 as the in-memory state.
Implement all 8 command handlers from TRD §9.3.
Battery drain: subtract 0.1 from `battery_percent` on every received command.
Auto-safe-mode: if `battery_percent < 5`, set `safe_mode_active = True` regardless of command.

Response format must match TRD §9.4 exactly — `status`, `command_id`,
`executed_command`, `telemetry`, `timestamp`.

**Acceptance criteria**:
- [ ] Server starts and listens on UDP port 9000
- [ ] Sending `{"command_type": "REQUEST_TELEMETRY", "command_id": "test-1", "parameters": {}}` returns valid JSON response
- [ ] `DISABLE_SAFE_MODE` sets `safe_mode_active` to False in returned telemetry
- [ ] `ENABLE_SAFE_MODE` sets `safe_mode_active` to True
- [ ] Battery decrements by 0.1 per command
- [ ] Battery at 4% → `DISABLE_SAFE_MODE` is processed but safe_mode auto-re-enables

---

### T-017-a — Implement OBC client (UDP dispatcher) `[MVP]`

**TRD Reference**: §10.3 Uplink Passthrough, `obc_client.py`

Implement `backend/app/services/obc_client.py`.

On OBC timeout (500ms default), return `{"status": "TIMEOUT", "command_id": ...}`
— do NOT raise an exception. The dispatch path must never fail the command pipeline.

On successful OBC response, call `TelemetryService.update()` with the telemetry
dict from the response, and call `update_command_dispatched_at()` to set the
`dispatched_at` timestamp on the command record.

**Acceptance criteria**:
- [ ] Successfully dispatches to running OBC and returns telemetry response
- [ ] Timeout returns TIMEOUT status without raising
- [ ] `TelemetryService` state updated after successful dispatch
- [ ] `commands.dispatched_at` set in DB after successful dispatch

---

## BLOCK 7 — WebSocket + Override

### T-018 — Implement WebSocket notification service `[MVP]`

**TRD Reference**: §6.9 WebSocket Notification Service

Implement `backend/app/services/ws_manager.py` using the `ConnectionManager`
class from TRD §6.9. The `connections` dict maps role strings to lists of
WebSocket objects.

Implement `backend/app/routers/websocket.py` with:
- `WS /ws/approvals` endpoint
- Token validation on connection (read from query param `?token=`)
- Invalid token → close with code 4001
- Message loop that handles `PING` type messages with a `PONG` response
- Disconnect handling that calls `ws_manager.disconnect()`

The server must send a heartbeat `{"type": "PING"}` every 30 seconds to keep
connections alive through proxies.

**All 7 server→client message types** from TRD §6.9 must be used by other
services when the relevant events occur. Add `await ws_manager.broadcast_approver(...)`
calls to the commands router (T-017) and override service (T-019) once those are built.

**Acceptance criteria**:
- [ ] WS connection with valid token succeeds
- [ ] WS connection with invalid token closes with code 4001
- [ ] Broadcast to role "approver" reaches all connected approver clients
- [ ] Dead connections are cleaned up automatically on send failure
- [ ] `PING` from client returns `PONG`
- [ ] Heartbeat sent every 30 seconds

---

### T-019 — Implement emergency override service `[MVP]`

**TRD Reference**: §6.10 Emergency Override Module

Implement `backend/app/services/override_service.py` with the `OverrideState`
singleton and the functions from TRD §6.10.

`activate_override()` must:
1. Validate justification length >= 20 characters
2. Check for already-active override (raise `ValueError: "OVERRIDE_ALREADY_ACTIVE"`)
3. Create override JWT token
4. Set `_override` state
5. Log to ledger (`OVERRIDE_ACTIVATED` event)
6. Schedule auto-deactivation task
7. Broadcast to approver WS channel

`is_override_active()` must check expiry time on every call — do not trust
`_override.active` without checking `expires_at`. If expired, set `active = False`.

Implement `backend/app/routers/override.py` with endpoints from TRD §14.5.

**Acceptance criteria**:
- [ ] `activate_override()` with short justification raises ValueError
- [ ] `is_override_active()` returns True during active window
- [ ] `is_override_active()` returns False after expiry without manual deactivation
- [ ] Override auto-deactivates after `OVERRIDE_TOKEN_EXPIRE_MINUTES`
- [ ] `OVERRIDE_ACTIVATED` event logged to ledger
- [ ] `OVERRIDE_EXPIRED` event logged to ledger on auto-deactivation
- [ ] Cannot activate when override already active

---

## BLOCK 8 — API Routes (Wire Everything)

### T-017 — Implement commands router `[MVP]`

**TRD Reference**: §6.11 API Route Definitions, §14.2 Command Endpoints

This is the most complex router. It wires all services together.
Implement `backend/app/routers/commands.py` following the pipeline in TRD §6.11.

The exact pipeline order is:
1. JWT auth middleware (via `Depends`)
2. CCSDS parser → 400 on failure
3. Replay check → 409 on duplicate
4. Sequence anomaly check → collect alerts, save for score elevation
5. Telemetry context injection
6. Gemini scoring
7. Sequence score elevation (add elevation values from step 4)
8. Tier re-derivation after elevation
9. Override check
10. Initial status determination
11. Store command in DB with all score fields
12. Ledger entry (`COMMAND_SUBMITTED`)
13. If AUTO_APPROVED or EMERGENCY_OVERRIDE → dispatch to OBC immediately
14. If PENDING → broadcast via WebSocket

Self-approval check in approval endpoints:
```python
if str(current_operator.sub) == str(command["submitter_id"]):
    raise HTTPException(403, detail={"error": {"code": "SELF_APPROVAL_FORBIDDEN", ...}})
```

**Acceptance criteria**:
- [ ] `POST /commands` with valid LOW command → 200, status=AUTO_APPROVED
- [ ] `POST /commands` with replay nonce → 409 REPLAY_DETECTED
- [ ] `POST /commands` with HIGH score → 200, status=PENDING_DUAL_APPROVAL
- [ ] `POST /commands/{id}/approve` by submitter → 403 SELF_APPROVAL_FORBIDDEN
- [ ] `POST /commands/{id}/approve` by valid approver on HIGH → quorum logic works
- [ ] All pipeline steps produce correct ledger entries
- [ ] Error response format matches TRD §14.7 exactly

---

### T-020 — Implement remaining routers `[MVP]`

**TRD Reference**: §14.3 Telemetry, §14.4 Ledger, §6.12 Error Handling

Implement `backend/app/routers/telemetry.py`:
- `GET /api/v1/telemetry/current` → returns `TelemetryState` from singleton
- `PUT /api/v1/telemetry/update` → ADMIN only, partial update, returns new state

Implement `backend/app/routers/ledger.py`:
- `GET /api/v1/ledger` → paginated, 20 per page, accepts `?page=` and `?event_type=`
- `GET /api/v1/ledger/verify` → ADMIN only, calls `verify_chain()`, returns result

Implement `backend/app/middleware/error_handler.py`:
- Registers exception handlers for `HTTPException`, `RequestValidationError`, unhandled `Exception`
- All errors return the standard error structure from TRD §14.7
- Include `timestamp` and `request_id` (UUID generated per request) in all error responses

**Acceptance criteria**:
- [ ] `GET /telemetry/current` returns current satellite state
- [ ] `PUT /telemetry/update` by OPERATOR returns 403
- [ ] `PUT /telemetry/update` by ADMIN with `{"battery_percent": 9}` updates only battery
- [ ] `GET /ledger` returns paginated entries, 20 per page
- [ ] `GET /ledger/verify` by OPERATOR returns 403
- [ ] `GET /ledger/verify` by ADMIN returns integrity result
- [ ] All errors use standard error format from TRD §14.7

---

### T-021 — Wire FastAPI app `[MVP]`

**TRD Reference**: §6.1 Application Bootstrap

Complete `backend/app/main.py` with the full app factory from TRD §6.1.

Add to the lifespan:
- Start `check_pending_timeouts()` background task (from auth_chain.py)
- Initialize `TelemetryService` default state on startup
- Log startup message with env and port

**Acceptance criteria**:
- [ ] `uvicorn app.main:app --port 8000` starts without error
- [ ] `GET /docs` returns FastAPI interactive docs with all routes visible
- [ ] All 13 REST endpoints plus 1 WebSocket endpoint are listed in docs
- [ ] Background timeout task is running (verify via log output)

---

## BLOCK 9 — Frontend Foundation

### T-022 — Next.js app scaffold `[MVP]`

**TRD Reference**: §8.1 Project Configuration, §8.2 Route Architecture

Complete `frontend/next.config.ts` with the API rewrite rule from TRD §8.1.
Complete `frontend/tailwind.config.ts` with content paths.
Implement `frontend/middleware.ts` exactly as specified in TRD §8.2.

The ROLE_ROUTES mapping must be:
```typescript
'/operator': ['operator', 'admin'],
'/approver': ['approver', 'admin'],
'/admin':    ['admin'],
```

`parseJwtPayload()` decodes the JWT payload (base64 decode the middle segment)
without verification — verification happens on the backend.

Create the full route directory structure from TRD §4 with `page.tsx` stubs.

**Acceptance criteria**:
- [ ] `npm run dev` starts without error on port 3000
- [ ] `GET /` redirects to `/login`
- [ ] Accessing `/operator/dashboard` without token redirects to `/login`
- [ ] Accessing `/admin/users` with operator-role token redirects to `/login`

---

### T-023 — Implement shared hooks and API client `[MVP]`

**TRD Reference**: §8.6 WebSocket Hook, §8.7 API Client

Implement `frontend/lib/api.ts` with all methods from TRD §8.7.
All API methods must be typed — use types from `frontend/lib/types.ts`.

`frontend/lib/types.ts` must define TypeScript interfaces for:
- `TelemetryState`, `CommandSubmitResponse`, `LedgerEntry`, `LedgerVerifyResult`
- `LoginResponse`, `OperatorOut`, `ApprovalRequest`
- `WSMessage` (union type of all 7 message types from TRD §6.9)

Implement `frontend/hooks/useAuth.ts`:
- Stores JWT in httpOnly cookie via API, falls back to localStorage for MVP
- `getStoredToken()`, `setStoredToken()`, `clearToken()` functions
- `useAuth()` hook returns `{ operator, isLoading, login, logout }`

Implement `frontend/hooks/useTelemetry.ts`:
- Polls `GET /api/v1/telemetry/current` every 5 seconds
- Returns `{ telemetry, isLoading, updateTelemetry }`

Implement `frontend/hooks/useApprovalWebSocket.ts` exactly as in TRD §8.6,
including the 3-second polling fallback when WebSocket is unavailable.

**Acceptance criteria**:
- [ ] `api.login(...)` returns typed `LoginResponse`
- [ ] `api.submitCommand(...)` returns typed `CommandSubmitResponse`
- [ ] WebSocket hook connects and calls `onMessage` on server push
- [ ] WebSocket hook activates polling fallback on connection error
- [ ] `useTelemetry` polls correctly and updates on interval

---

### T-024 — Implement login page `[MVP]`

Create `frontend/app/login/page.tsx`:
- Username and password fields
- Submit calls `api.login()`
- On success: store token, redirect to role-appropriate route
  - operator → `/operator/dashboard`
  - approver → `/approver/queue`
  - admin → `/admin/ledger`
- On error: display error message below form
- No external component library — use Tailwind utility classes only

**Acceptance criteria**:
- [ ] Login with valid operator credentials → redirected to `/operator/dashboard`
- [ ] Login with valid approver credentials → redirected to `/approver/queue`
- [ ] Login with wrong password → error message displayed
- [ ] Loading state shown during API call

---

## BLOCK 10 — Frontend Operator Dashboard

### T-025 — Implement TelemetryPanel component `[MVP]`

**Reference**: `WIREFRAMES.md` §Operator Dashboard, `COMPONENT_STATE_SPEC.md`

Implement `frontend/components/TelemetryPanel.tsx`.

In demo mode (controlled by a prop `demoControls: boolean`):
- Battery: range slider 0–100
- Safe mode: toggle switch
- Thermal status: dropdown (NOMINAL / ELEVATED / CRITICAL)
- Orbital phase: dropdown (SUNLIT / ECLIPSE / PENUMBRA)

Changing any control calls `api.updateTelemetry()` immediately (debounced 300ms).
In non-demo mode, shows read-only values with color coding.

Battery color rules: >= 50 green, 20–49 amber, < 20 red.
Safe mode color: ON = blue badge, OFF = neutral badge.
Thermal ELEVATED = amber, CRITICAL = red.

**Acceptance criteria**:
- [ ] All 6 telemetry fields displayed
- [ ] Demo sliders/controls visible when `demoControls=true`
- [ ] Changing battery slider calls `updateTelemetry` with new value
- [ ] Color coding correct per threshold

---

### T-026 — Implement CommandTerminal component `[MVP]`

**Reference**: `WIREFRAMES.md` §CommandTerminal, `COMPONENT_STATE_SPEC.md`

Implement `frontend/components/CommandTerminal.tsx`.

Subsystem dropdown options: EPS, OBC, ADCS, TM, PAYLOAD
Command type dropdown: filtered by selected subsystem using the mapping:
```typescript
const SUBSYSTEM_COMMANDS: Record<string, string[]> = {
  EPS:     ['ENABLE_SAFE_MODE', 'DISABLE_SAFE_MODE'],
  OBC:     ['REQUEST_STATUS', 'UPDATE_PARAMETER', 'RESET_OBC', 'DISABLE_WATCHDOG', 'RESET_SUBSYSTEM', 'FORCE_REBOOT', 'UPDATE_AUTH_KEY'],
  ADCS:    ['ATTITUDE_MANOEUVRE', 'SCHEDULE_MANOEUVRE', 'THRUSTER_FIRE'],
  TM:      ['REQUEST_TELEMETRY', 'SET_BEACON_RATE'],
  PAYLOAD: ['PAYLOAD_ACTIVATE'],
}
```

Nonce auto-generated as UUID v4 on component mount and on each successful submission.

On submit:
1. Show loading state on button
2. Call `api.submitCommand({ packet_hex, nonce })`

**Note on packet_hex**: For MVP, the frontend generates a placeholder hex string
encoding the command type and subsystem. Import from `lib/ccsds_builder.ts` which
assembles a minimal valid CCSDS packet from the fixture data in `ccsds_packets.json`.
The backend parser validates the real structure.

On response: pass result to `onScoreResult` callback prop.

**Acceptance criteria**:
- [ ] Subsystem dropdown shows 5 options
- [ ] Command dropdown filters correctly per subsystem
- [ ] Nonce is a valid UUID v4
- [ ] Submit button shows loading state during API call
- [ ] `onScoreResult` callback called with response on success
- [ ] Error message displayed on API failure

---

### T-027 — Implement RiskScoreCard component `[MVP]`

**Reference**: `WIREFRAMES.md` §RiskScoreCard, `COMPONENT_STATE_SPEC.md`

Implement `frontend/components/RiskScoreCard.tsx`.

Score display rules:
- Score 0–30: large green number, "LOW RISK" badge
- Score 31–70: large amber number, "MEDIUM RISK" badge
- Score 71–100: large red number, "HIGH RISK" badge

Show: score number, tier badge, justification paragraph, SPARTA technique chip
(if not null), CVSS estimate chip (if not null), affected subsystems tag list.

Approval status tracker (shown when command is PENDING):
- `PENDING_SINGLE_APPROVAL`: "Awaiting 1 approval" with spinner
- `PENDING_DUAL_APPROVAL`: "Awaiting 2 approvals — N received" with spinner
- `DISPATCHED`: green "Command Dispatched ✓"
- `REJECTED`: red "Command Rejected — [reason]"
- `REPLAY_BLOCKED`: red "Replay Attack Blocked"
- `BLOCKED`: red "Command Blocked — approval timeout"

**Acceptance criteria**:
- [ ] Score 5 renders green
- [ ] Score 87 renders red
- [ ] Null sparta_technique → chip not rendered
- [ ] PENDING_DUAL with 1 approval shows "1 of 2 approvals received"
- [ ] DISPATCHED state shows green confirmation

---

### T-028 — Assemble operator dashboard page `[MVP]`

**Reference**: `WIREFRAMES.md` §Operator Dashboard

Implement `frontend/app/operator/dashboard/page.tsx`.

Layout (from wireframe):
- Top bar: satellite name, operator username, logout button
- Left panel (40%): CommandTerminal + RiskScoreCard (appears after submission)
- Right panel (60%): TelemetryPanel (top) + AlertBanner (below, for sequence alerts)

Implement `frontend/components/AlertBanner.tsx`:
- Shows when sequence alerts are present in the last command response
- Each alert shows: rule_id, trigger command, score elevation applied
- Dismissible (X button)
- Color: amber background

Implement `frontend/app/operator/ledger/page.tsx`:
- Table of operator's own commands (filtered by submitter_id from JWT)
- Columns: time, command type, subsystem, score, tier, status
- 20 per page, pagination controls
- Status badges with color coding

**Acceptance criteria**:
- [ ] Dashboard loads with TelemetryPanel showing current state
- [ ] CommandTerminal submit → RiskScoreCard appears with result
- [ ] Sequence alert banner appears when `sequence_alerts` is non-empty
- [ ] Ledger page shows operator's commands only

---

## BLOCK 11 — Frontend Approver Panel

### T-029 — Implement ApprovalQueue and ApprovalModal `[MVP]`

**Reference**: `WIREFRAMES.md` §Approver Panel, `COMPONENT_STATE_SPEC.md`

Implement `frontend/components/ApprovalQueue.tsx`:
- List of pending commands from `GET /api/v1/commands/pending`
- Each row: command type badge, subsystem, risk score (colored), time pending (relative), submitted by
- Sorted ascending by `submitted_at` (oldest first — most urgent)
- Empty state: "No commands pending approval" with checkmark icon
- Real-time updates via `useApprovalWebSocket` hook

Implement `frontend/components/ApprovalModal.tsx`:
- Full-screen modal triggered by clicking a queue row
- Shows: command type, subsystem, parameters, risk score card, telemetry snapshot, SPARTA, CVSS, sequence alerts
- Justification textarea (placeholder: "Reason for decision...")
- Required for HIGH-risk rejection (client-side validation)
- Approve (green) / Reject (red) buttons
- Submit calls `api.approveCommand()` or `api.rejectCommand()`
- On success: close modal, remove command from queue

Implement `frontend/app/approver/queue/page.tsx`:
- Top bar with safety officer name, active override indicator (if active)
- ApprovalQueue component filling main content
- Polled fallback status indicator (small badge: "Live" or "Polling")

**Acceptance criteria**:
- [ ] Queue shows pending commands sorted by time
- [ ] New PENDING command pushed via WS appears in queue without page refresh
- [ ] Modal shows full AI justification and telemetry snapshot
- [ ] Reject without justification on HIGH command shows validation error
- [ ] After approve/reject, command removed from queue
- [ ] Empty state shown when no pending commands

---

### T-030 — Implement emergency override panel `[MVP]`

**Reference**: `WIREFRAMES.md` §Override Panel

Implement `frontend/app/approver/override/page.tsx` and
`frontend/components/OverridePanel.tsx`.

Shows current override status at top:
- If inactive: neutral card "No active override"
- If active: red card with "OVERRIDE ACTIVE", time remaining, activated by

Activation form:
- Justification textarea (min 20 chars, enforced client-side)
- Character counter
- "Activate Emergency Override" button (red, requires confirmation modal)
- Confirmation modal text: "This will bypass dual-approval for [X] minutes. All commands during this period will be flagged for mandatory post-event review."

**Acceptance criteria**:
- [ ] Justification shorter than 20 chars → button disabled
- [ ] Confirmation modal shown before activation
- [ ] After activation: status card updates to active state
- [ ] Time remaining countdown visible
- [ ] Expired override → status card returns to inactive

---

## BLOCK 12 — Frontend Admin / Ledger

### T-031 — Implement admin ledger view `[MVP]`

**Reference**: `WIREFRAMES.md` §Admin Ledger, `COMPONENT_STATE_SPEC.md`

Implement `frontend/components/LedgerTable.tsx` and `frontend/components/IntegrityChecker.tsx`.

`LedgerTable.tsx`:
- Columns: sequence, timestamp, event_type badge, command_type, risk_score, status badge, operator, entry_hash (first 12 chars + "...")
- Row background by status: DISPATCHED=neutral, REJECTED=amber bg, REPLAY_BLOCKED=red bg, EMERGENCY_OVERRIDE=purple bg
- Pagination: 20 per page
- Filter by event_type (dropdown)

`IntegrityChecker.tsx`:
- "Verify Chain Integrity" button (calls `GET /api/v1/ledger/verify`)
- Loading state during verification
- On VALID: green banner with entries count and timestamp
- On INVALID: red banner "Tampering detected at sequence N — entry ID [uuid]"
- Highlights the corrupted row in LedgerTable red (passes corrupted sequence down as prop)

**Demo tamper button** (shown only when `APP_ENV === 'development'`):
- Admin-only button: "Tamper Entry 42 (Demo)"
- Calls `PUT /api/v1/ledger/demo-tamper` (a development-only endpoint that directly
  updates entry 42's risk_score in the DB bypassing the ledger rule)
- After tamper: run integrity check to show failure

Implement `backend/app/routers/ledger.py` additions:
- `PUT /api/v1/ledger/demo-tamper` — ADMIN only, APP_ENV=development only — directly
  updates one ledger entry's `event_detail` JSON to change risk_score from 87 to 12
  using a raw SQL UPDATE (bypasses the Postgres RULE by using a superuser connection
  or temporarily disabling the rule — implementation note: use `ALTER TABLE ledger DISABLE RULE ALL`
  before update and `ENABLE RULE ALL` after)

**Acceptance criteria**:
- [ ] Ledger table shows all entries with correct columns
- [ ] Integrity check on unmodified ledger shows green banner
- [ ] Demo tamper button changes entry 42's data
- [ ] Integrity check after tamper shows red banner at sequence 42
- [ ] Row 42 highlighted red in table after failed check
- [ ] Demo tamper button not visible in production (APP_ENV check)

---

## BLOCK 13 — Seed Scripts & Demo State

### T-032 — Implement seed scripts `[MVP]`

**TRD Reference**: §13 Synthetic Data Generation
**Reference**: `SEED_DATA_SPEC.json`

Implement all seed scripts in `backend/scripts/`. Each script must be runnable
independently AND as part of `seed_demo.py`.

`seed_operators.py`:
- Creates all 6 operators from `SEED_DATA_SPEC.json`
- Uses `hash_password()` from auth_service for password hashing
- Uses `INSERT ... ON CONFLICT (username) DO NOTHING` — idempotent

`seed_history.py`:
- Generates 50 commands per operator using command type distributions from spec
- Uses DEMO_MODE fixtures for risk scores (no Gemini calls during seeding)
- 45 DISPATCHED, 3 REJECTED, 2 BLOCKED per operator
- Timestamps distributed across past 30 days matching operator session hours
- Creates corresponding ledger entries for each command

`seed_telemetry.py`:
- Inserts 4 canonical telemetry snapshots from `SEED_DATA_SPEC.json`
- Calls `TelemetryService.update()` with `nominal` snapshot as starting state

`seed_scenarios.py`:
- Creates 1 command in `PENDING_DUAL_APPROVAL` with 0 approvals (for demo warm-up)
  - Command: DISABLE_SAFE_MODE, submitter: op_chen, risk_score: 87
  - Submitted 2 minutes ago (relative to seed time)
- Creates ledger entries up to sequence 50 with entry 42 having risk_score=87
  (the pre-tamper value for the demo)

`reset_demo.py`:
- `TRUNCATE operators, commands, approvals, ledger, telemetry_states CASCADE`
- Runs `seed_demo.py` (calls all scripts in order)

**Acceptance criteria**:
- [ ] `make demo-seed` completes without error
- [ ] `make demo-reset` truncates all data and re-seeds correctly
- [ ] All 6 operators exist with correct roles after seed
- [ ] 300 total historical commands exist (50 × 6)
- [ ] 1 command in PENDING_DUAL_APPROVAL state
- [ ] 50 ledger entries exist
- [ ] Login with `op_chen` / `operator123` succeeds after seed

---

### T-033 — Implement demo verification script `[MVP]`

Implement `backend/scripts/verify_demo_state.py`:

```python
# Checks all items in the demo verification checklist from TRD §16.3
# Prints colored PASS/FAIL for each check
# Exits with code 1 if any check fails
```

All 11 checklist items from TRD §16.3 must be verified programmatically:
- DB connection, operator count, ledger entry count, pending command presence,
  DEMO_MODE fixture validity, OBC responsiveness, WS endpoint, Gemini/DEMO_MODE,
  ledger integrity, tamper function availability, ngrok (optional — just warns if unavailable)

**Acceptance criteria**:
- [ ] All 11 checks pass on a correctly seeded database
- [ ] Script exits with code 0 on all pass
- [ ] Script exits with code 1 if any check fails
- [ ] Output is clearly formatted with PASS/FAIL and check description

---

## BLOCK 14 — Integration & Demo Verification

### T-034 — Run integration test suite `[MVP]`

**TRD Reference**: §16.2 Integration Test Scenarios

Implement all integration tests in `backend/tests/integration/`:
- `test_command_pipeline.py`: TC-INT-001 through TC-INT-007
- `test_approval_flow.py`: TC-INT-010 through TC-INT-017

All tests use `TEST_DATABASE_URL` and `DEMO_MODE=true`.
Use pytest fixtures for database setup/rollback (TRD §16.4).

**Acceptance criteria**:
- [ ] `make test-all` completes with 0 failures
- [ ] TC-INT-001 through TC-INT-007 all pass
- [ ] TC-INT-010 through TC-INT-017 all pass
- [ ] Coverage for critical modules meets minimums from TRD §16.1

---

### T-035 — Demo dry run `[MVP]`

**Reference**: PRD §15 Demo Plan, TRD §17.4 Demo Environment Runbook

Execute the full demo runbook from TRD §17.4:
1. `make demo-reset`
2. `make demo-verify` — all 11 checks must pass
3. `make dev` — all services running
4. `make tunnel` — ngrok URL accessible
5. Execute Demo Moment 1 script (telemetry score shift) end-to-end
6. Execute Demo Moment 2 script (ledger tamper) end-to-end
7. Verify all fallbacks (switch to `DEMO_MODE=true`, check polling fallback)

If any step fails, document the failure and fix before proceeding.

**Acceptance criteria**:
- [ ] `make demo-verify` all 11 checks PASS
- [ ] Demo Moment 1: LOW→HIGH score shift visible on screen with correct scores
- [ ] Demo Moment 2: tamper detected at sequence 42, row highlighted red
- [ ] `DEMO_MODE=true` produces correct fixture scores
- [ ] WebSocket polling fallback activates correctly
- [ ] Approver panel accessible via ngrok URL on external device

---

## Appendix A — Error Handling Conventions

All backend errors must follow this pattern:
```python
from fastapi import HTTPException

raise HTTPException(
    status_code=400,
    detail={
        "error": {
            "code": "INVALID_CCSDS_PACKET",
            "message": "Human-readable description",
            "detail": {},  # optional extra context
            "timestamp": datetime.utcnow().isoformat(),
        }
    }
)
```

Never return raw exception messages to the client. All unhandled exceptions
are caught by `error_handler.py` and returned as `500 INTERNAL_ERROR`.

---

## Appendix B — Import Conventions

All imports within the `backend/app` package must be absolute:
```python
from app.services.auth_service import hash_password  # ✓
from .auth_service import hash_password               # ✗
```

All service functions that interact with the database must accept a `db` parameter
(the asyncpg pool) — never import the pool directly into a service file. This makes
testing with a test pool straightforward.

---

## Appendix C — Commit Message Convention

Format: `type(scope): description`

Types: `feat` `fix` `test` `refactor` `docs` `chore`
Scope: task ID (e.g. `T-007`, `T-012`)

Examples:
```
feat(T-007): implement JWT auth service with bcrypt and RBAC
test(T-009): add CCSDS parser unit tests for all error codes
fix(T-012): clamp risk score to 0-100 before tier derivation
```

One commit per completed task (after all acceptance criteria pass).
Do not commit partially completed tasks.
