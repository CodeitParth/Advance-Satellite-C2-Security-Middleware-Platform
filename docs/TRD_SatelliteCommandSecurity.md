# Technical Requirements Document
# Satellite Command Security Platform (SCSP)

---

## §1 — Document Header & Metadata

| Field | Value |
|---|---|
| **Document Title** | Satellite Command Security Platform — Technical Requirements Document |
| **Version** | 1.0.0 |
| **Status** | Draft — Pre-Development |
| **Parent Document** | PRD_SatelliteCommandSecurity.md v1.0.0 |
| **Category** | Space & Aerospace — Ground Segment Security |
| **Classification** | Internal — Hackathon Planning |
| **Created** | 2026-06-10 |
| **Last Updated** | 2026-06-10 |

### How This Document Relates to the PRD

The PRD defines **what** SCSP does and **why**. This TRD defines **how** it is built — every implementation decision, interface contract, module boundary, data flow, error handling policy, environment configuration, and testing requirement. Every section in this document traces back to one or more PRD sections.

### AI-Agent Usage Notes

This TRD is structured for direct use by coding agents. Each module section contains:
- Exact file paths and module names
- Function signatures with type annotations
- Request/response schemas in full
- Error codes and handling rules
- Environment variable names
- Test case IDs with expected inputs and outputs
- Phase tags: `[MVP]` `[PHASE_2]` `[ROADMAP]`

Agents should implement modules in the order listed in §4 (dependency order). All `[MVP]` items must be implemented before any `[PHASE_2]` scaffolding begins.

---

## §2 — Table of Contents

```
§1  Document Header & Metadata
§2  Table of Contents
§3  System Overview & Component Map
§4  Repository Structure
§5  Environment Configuration
§6  Backend — FastAPI Application
    §6.1  Application Bootstrap
    §6.2  Authentication Module
    §6.3  CCSDS Parser Module
    §6.4  Telemetry State Service
    §6.5  AI Risk Scoring Engine
    §6.6  Replay Detection Service
    §6.7  Authorization State Machine
    §6.8  Hash-Chain Ledger Service
    §6.9  WebSocket Notification Service
    §6.10 Emergency Override Module
    §6.11 API Route Definitions
    §6.12 Middleware & Error Handling
§7  Database Layer
    §7.1  Connection & Pool Configuration
    §7.2  Migration Strategy
    §7.3  Full Schema DDL
    §7.4  Query Patterns & Indexes
§8  Frontend — Next.js Application
    §8.1  Project Configuration
    §8.2  Route Architecture & Auth Middleware
    §8.3  Operator Dashboard
    §8.4  Approver Panel
    §8.5  Admin Dashboard
    §8.6  WebSocket Client Hook
    §8.7  API Client Layer
    §8.8  Component Library
§9  Mock Satellite OBC
    §9.1  UDP Server Design
    §9.2  Satellite State Model
    §9.3  Command Handlers
    §9.4  Telemetry Response Format
§10 Integration Layer
    §10.1 OpenC3 COSMOS Plugin
    §10.2 Generic REST Proxy Adapter
    §10.3 Uplink Passthrough
§11 AI Scoring Engine — Deep Specification
    §11.1 Prompt Engineering
    §11.2 Gemini API Configuration
    §11.3 Output Validation & Parsing
    §11.4 DEMO_MODE Implementation
    §11.5 SPARTA Threat Mapping Table
§12 Cryptography & Security Implementation
    §12.1 Password Hashing
    §12.2 JWT Implementation
    §12.3 Ed25519 Approval Token Signing
    §12.4 SHA-256 Hash Chain Implementation
    §12.5 Input Sanitization Rules
§13 Synthetic Data Generation
    §13.1 Seed Script Architecture
    §13.2 Operator & History Generator
    §13.3 Command Dataset Generator
    §13.4 Attack Scenario Fixtures
    §13.5 Demo State Seeder
§14 API Contract — Full Endpoint Specification
    §14.1 Authentication Endpoints
    §14.2 Command Endpoints
    §14.3 Telemetry Endpoints
    §14.4 Ledger Endpoints
    §14.5 Override Endpoints
    §14.6 WebSocket Protocol
    §14.7 Error Response Standard
§15 Non-Functional Requirements
    §15.1 Performance Requirements
    §15.2 Reliability & Availability
    §15.3 Security Requirements
    §15.4 Observability & Logging
§16 Testing Requirements
    §16.1 Unit Test Coverage Requirements
    §16.2 Integration Test Scenarios
    §16.3 Demo Verification Checklist
    §16.4 Test Fixture Specifications
§17 Local Development Setup
    §17.1 Prerequisites
    §17.2 First-Time Setup
    §17.3 Makefile Commands
    §17.4 Demo Environment Runbook
§18 Phase 2 & Roadmap Technical Specifications
    §18.1 Behavioral Drift Detection
    §18.2 Constellation Threat Correlation
    §18.3 Docker Containerization
    §18.4 Quantum-Resistant Signing
```

---

## §3 — System Overview & Component Map

### Component Inventory

| Component | Technology | Port | Phase | PRD Ref |
|---|---|---|---|---|
| Backend API | Python 3.11 / FastAPI | 8000 | MVP | §10, §11 |
| Frontend UI | Next.js 14 / React / Tailwind | 3000 | MVP | §8 |
| Database | PostgreSQL 15 | 5432 | MVP | §12 |
| Mock OBC | Python 3.11 / UDP | 9000 | MVP | §F-08 |
| ngrok Tunnel | ngrok v3 | — | MVP | §11.8 |
| Redis Event Bus | Redis 7 | 6379 | Phase 2 | §18.2 |
| Docker Compose | Docker 24+ | — | Phase 2 | §18.3 |

### Communication Map

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (Operator)    Browser (Approver)    Browser (Admin)   │
│       :3000                 :3000                 :3000        │
└──────────┬──────────────────┬──────────────────────┬──────────┘
           │ HTTP/REST        │ HTTP/REST + WS        │ HTTP/REST
           ▼                  ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  Next.js Frontend (:3000)                     │
│         App Router │ Auth Middleware │ API Routes             │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP/REST + WebSocket
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (:8000)                      │
│  Auth │ CCSDS Parser │ AI Scorer │ Auth Chain │ Ledger       │
│  Replay Detector │ Telemetry │ WebSocket │ Override          │
└──────┬────────────────────┬────────────────────┬────────────┘
       │ asyncpg            │ google-generativeai │ UDP
       ▼                    ▼                     ▼
┌──────────┐     ┌─────────────────┐    ┌────────────────┐
│ Postgres │     │  Gemini 2.5     │    │  Mock OBC      │
│  (:5432) │     │  Flash API      │    │  (:9000/UDP)   │
└──────────┘     └─────────────────┘    └────────────────┘
```

### Data Flow Summary

```
Command Ingress Pipeline:
  POST /api/v1/commands
    → Auth middleware (JWT validate)
    → CCSDS Parser (packet validate)
    → Replay Detector (nonce check)
    → Sequence Anomaly Check (rule table)
    → Telemetry State Inject
    → Gemini AI Scorer
    → Risk Tier Determination
    → Authorization State Machine
      → [LOW]    → Auto-approve → Sign → Ledger → UDP dispatch → OBC
      → [MEDIUM] → Ledger(PENDING) → WS notify approver → await token
      → [HIGH]   → Ledger(PENDING) → WS notify 2x approver → await quorum
    → On approval: Sign → Ledger(DISPATCHED) → UDP dispatch → OBC
    → On rejection: Ledger(REJECTED)
    → Telemetry update from OBC response → Frontend update
```

---

## §4 — Repository Structure

```
scsp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app factory, startup
│   │   ├── config.py                  # Settings from env vars (pydantic-settings)
│   │   ├── database.py                # asyncpg pool, connection helpers
│   │   ├── models/
│   │   │   ├── command.py             # Command Pydantic models
│   │   │   ├── operator.py            # Operator / auth models
│   │   │   ├── ledger.py              # Ledger entry models
│   │   │   ├── telemetry.py           # Telemetry state models
│   │   │   └── approval.py            # Approval token models
│   │   ├── routers/
│   │   │   ├── auth.py                # /api/v1/auth/*
│   │   │   ├── commands.py            # /api/v1/commands/*
│   │   │   ├── telemetry.py           # /api/v1/telemetry/*
│   │   │   ├── ledger.py              # /api/v1/ledger/*
│   │   │   ├── override.py            # /api/v1/override/*
│   │   │   └── websocket.py           # /ws/approvals
│   │   ├── services/
│   │   │   ├── auth_service.py        # JWT creation, validation, RBAC
│   │   │   ├── ccsds_parser.py        # CCSDS packet parser & validator
│   │   │   ├── telemetry_service.py   # Telemetry state cache & update
│   │   │   ├── ai_scorer.py           # Gemini scoring engine
│   │   │   ├── replay_detector.py     # Nonce window + sequence rules
│   │   │   ├── auth_chain.py          # Authorization state machine
│   │   │   ├── ledger_service.py      # Hash-chain append & verify
│   │   │   ├── obc_client.py          # UDP dispatch to mock OBC
│   │   │   ├── ws_manager.py          # WebSocket connection manager
│   │   │   └── override_service.py    # Emergency bypass logic
│   │   └── middleware/
│   │       ├── auth_middleware.py     # JWT extraction & validation
│   │       └── error_handler.py      # Global exception → JSON error
│   ├── migrations/
│   │   └── 001_initial_schema.sql     # Full DDL
│   ├── scripts/
│   │   ├── seed_demo.py               # Full demo state seeder
│   │   ├── seed_operators.py          # Operator + history generator
│   │   └── reset_demo.py              # Truncate + re-seed
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── test_ccsds_parser.py
│   │   │   ├── test_ai_scorer.py
│   │   │   ├── test_replay_detector.py
│   │   │   ├── test_ledger_service.py
│   │   │   └── test_auth_chain.py
│   │   └── integration/
│   │       ├── test_command_pipeline.py
│   │       └── test_approval_flow.py
│   ├── fixtures/
│   │   └── demo_scores.json           # DEMO_MODE pre-seeded AI responses
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, font, providers
│   │   ├── page.tsx                   # Root redirect → /login
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── operator/
│   │   │   ├── layout.tsx             # Operator auth guard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # Command terminal + telemetry
│   │   │   └── ledger/
│   │   │       └── page.tsx           # Command history viewer
│   │   ├── approver/
│   │   │   ├── layout.tsx             # Approver auth guard
│   │   │   ├── queue/
│   │   │   │   └── page.tsx           # Pending approvals
│   │   │   └── override/
│   │   │       └── page.tsx           # Emergency override panel
│   │   └── admin/
│   │       ├── layout.tsx             # Admin auth guard
│   │       ├── users/
│   │       │   └── page.tsx
│   │       ├── policy/
│   │       │   └── page.tsx
│   │       └── ledger/
│   │           └── page.tsx           # Full ledger + integrity check
│   ├── components/
│   │   ├── CommandTerminal.tsx        # Command authoring form
│   │   ├── RiskScoreCard.tsx          # Score display + justification
│   │   ├── TelemetryPanel.tsx         # Live telemetry + sliders
│   │   ├── ApprovalQueue.tsx          # Pending command list
│   │   ├── ApprovalModal.tsx          # Approve/reject with justification
│   │   ├── LedgerTable.tsx            # Ledger entries + hash display
│   │   ├── IntegrityChecker.tsx       # Chain verify + tamper highlight
│   │   ├── AlertBanner.tsx            # Replay / sequence alerts
│   │   └── OverridePanel.tsx          # Emergency bypass UI
│   ├── hooks/
│   │   ├── useApprovalWebSocket.ts    # WS connection + polling fallback
│   │   ├── useTelemetry.ts            # Telemetry state polling
│   │   └── useAuth.ts                 # JWT storage + refresh
│   ├── lib/
│   │   ├── api.ts                     # Axios/fetch API client
│   │   └── types.ts                   # Shared TypeScript types
│   ├── middleware.ts                   # Next.js route-level auth
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── obc/
│   └── obc_simulator.py               # Mock satellite UDP server
├── scripts/
│   └── ngrok_start.sh                 # ngrok + QR code display
├── Makefile
└── README.md
```

---

## §5 — Environment Configuration

### Backend `.env` (full specification)

```bash
# ── Application ──────────────────────────────────────────────
APP_ENV=development                  # development | production
APP_HOST=0.0.0.0
APP_PORT=8000
LOG_LEVEL=INFO                       # DEBUG | INFO | WARNING | ERROR

# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://scsp:scsp_dev@localhost:5432/scsp_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_TIMEOUT=30

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET_KEY=change_this_to_32_char_random_string_in_prod
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
APPROVAL_TOKEN_EXPIRE_MINUTES=5
OVERRIDE_TOKEN_EXPIRE_MINUTES=10

# ── AI Scoring ───────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MAX_OUTPUT_TOKENS=1024
GEMINI_TEMPERATURE=0.1              # Low temperature for consistent scoring
DEMO_MODE=false                      # true = bypass Gemini, use fixtures

# ── Risk Thresholds ──────────────────────────────────────────
RISK_LOW_MAX=30                      # 0–30 → LOW
RISK_MEDIUM_MAX=70                   # 31–70 → MEDIUM
                                     # 71–100 → HIGH

# ── OBC ──────────────────────────────────────────────────────
OBC_HOST=127.0.0.1
OBC_PORT=9000
OBC_TIMEOUT_MS=500
OBC_ENABLED=true                     # false = skip OBC dispatch in tests

# ── Replay Detection ─────────────────────────────────────────
REPLAY_NONCE_WINDOW_SIZE=100
REPLAY_SEQUENCE_WINDOW_SECONDS=60

# ── CORS ─────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,https://*.ngrok-free.app

# ── Rate Limiting ────────────────────────────────────────────
RATE_LIMIT_LOGIN_PER_MINUTE=5
RATE_LIMIT_COMMANDS_PER_MINUTE=60
```

### Frontend `.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_ENV=development
```

### Environment Validation

At startup, the backend validates all required environment variables using `pydantic-settings`. If `GEMINI_API_KEY` is missing and `DEMO_MODE=false`, the application raises a startup error. If `DEMO_MODE=true`, `GEMINI_API_KEY` is not required.

```python
# app/config.py
from pydantic_settings import BaseSettings
from pydantic import model_validator

class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str
    jwt_secret_key: str
    gemini_api_key: str = ""
    demo_mode: bool = False
    risk_low_max: int = 30
    risk_medium_max: int = 70
    obc_host: str = "127.0.0.1"
    obc_port: int = 9000
    replay_nonce_window_size: int = 100
    replay_sequence_window_seconds: int = 60

    @model_validator(mode='after')
    def validate_gemini_key(self):
        if not self.demo_mode and not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY required when DEMO_MODE=false")
        return self

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

---

## §6 — Backend — FastAPI Application

### 6.1 Application Bootstrap

**File**: `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import create_pool, close_pool
from app.routers import auth, commands, telemetry, ledger, override, websocket
from app.middleware.error_handler import register_error_handlers
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()           # Create asyncpg connection pool
    yield
    await close_pool()            # Graceful shutdown

app = FastAPI(
    title="Satellite Command Security Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["auth"])
app.include_router(commands.router,  prefix="/api/v1/commands",  tags=["commands"])
app.include_router(telemetry.router, prefix="/api/v1/telemetry", tags=["telemetry"])
app.include_router(ledger.router,    prefix="/api/v1/ledger",    tags=["ledger"])
app.include_router(override.router,  prefix="/api/v1/override",  tags=["override"])
app.include_router(websocket.router, tags=["websocket"])
```

---

### 6.2 Authentication Module `[MVP]`

**File**: `backend/app/services/auth_service.py`

**Responsibilities**: JWT creation, validation, RBAC enforcement, password hashing.

**Types**:
```python
from enum import Enum
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class Role(str, Enum):
    OPERATOR = "operator"
    APPROVER = "approver"
    ADMIN    = "admin"

class TokenPayload(BaseModel):
    sub: str           # operator UUID
    role: Role
    username: str
    exp: datetime
    token_type: str    # "access" | "approval" | "override"
    command_id: str | None = None   # set for approval tokens
```

**Functions**:
```python
def hash_password(plain: str) -> str
    # bcrypt.hashpw with cost factor 12

def verify_password(plain: str, hashed: str) -> bool
    # bcrypt.checkpw

def create_access_token(operator_id: UUID, role: Role, username: str) -> str
    # HS256 JWT, exp = now + ACCESS_TOKEN_EXPIRE_MINUTES

def create_approval_token(operator_id: UUID, command_id: UUID) -> str
    # HS256 JWT, exp = now + APPROVAL_TOKEN_EXPIRE_MINUTES
    # token_type = "approval", command_id embedded

def create_override_token(operator_id: UUID) -> str
    # HS256 JWT, exp = now + OVERRIDE_TOKEN_EXPIRE_MINUTES
    # token_type = "override"

def decode_token(token: str) -> TokenPayload
    # Raises 401 if expired or invalid signature

async def get_current_operator(token: str = Depends(oauth2_scheme)) -> TokenPayload
    # FastAPI dependency — validates token, returns payload

def require_role(*roles: Role)
    # Returns FastAPI dependency that raises 403 if role not in roles
    # Usage: Depends(require_role(Role.APPROVER, Role.ADMIN))
```

**RBAC Enforcement Rules**:

| Endpoint | Required Role |
|---|---|
| `POST /commands` | OPERATOR, APPROVER, ADMIN |
| `POST /commands/{id}/approve` | APPROVER, ADMIN |
| `POST /commands/{id}/reject` | APPROVER, ADMIN |
| `POST /override/activate` | APPROVER, ADMIN |
| `GET /ledger` | OPERATOR, APPROVER, ADMIN |
| `GET /ledger/verify` | ADMIN |
| `PUT /telemetry/update` | ADMIN (or OBC service token) |
| `GET /admin/*` | ADMIN |

**Self-approval prevention** (enforced in `commands.py` router):
```python
if approval_payload.sub == command.submitter_id:
    raise HTTPException(403, "Operators cannot approve their own commands")
```

---

### 6.3 CCSDS Parser Module `[MVP]`

**File**: `backend/app/services/ccsds_parser.py`

**CCSDS Primary Header Structure** (6 bytes):
```
Bits 0–2:   Version Number       (expected: 0b001 = 1)
Bit 3:      Packet Type          (1 = telecommand)
Bit 4:      Secondary Header Flag
Bits 5–15:  Application Process Identifier (APID)
Bits 16–17: Sequence Flags       (0b11 = standalone)
Bits 18–31: Packet Sequence Count
Bits 32–47: Packet Data Length   (total packet length - 7)
```

**Known APID Registry**:
```python
APID_REGISTRY: dict[int, str] = {
    0x100: "TM",
    0x101: "TM",
    0x102: "OBC",
    0x18E: "EPS",
    0x18F: "EPS",
    0x200: "OBC",
    0x201: "OBC",
    0x202: "OBC",
    0x203: "OBC",
    0x204: "OBC",
    0x205: "OBC",
    0x300: "ADCS",
    0x301: "ADCS",
    0x302: "ADCS",
    0x400: "PAYLOAD",
}
```

**Function Signatures**:
```python
from pydantic import BaseModel

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
    parsed: ParsedCommand | None
    error: str | None
    error_code: str | None   # INVALID_VERSION | UNKNOWN_APID | BAD_LENGTH | BAD_CRC

def parse_ccsds_packet(packet_hex: str) -> ParseResult:
    """
    Parses a hex-encoded CCSDS telecommand packet.
    Returns ParseResult with success=True and parsed command on valid input.
    Returns ParseResult with success=False and error_code on any validation failure.
    Never raises exceptions — all errors returned in ParseResult.
    """

def compute_crc16_ccitt(data: bytes) -> int:
    """CRC-16-CCITT (polynomial 0x1021, init 0xFFFF)"""
```

**Validation Sequence**:
1. Decode hex string → bytes (error: `INVALID_HEX`)
2. Length >= 7 bytes (error: `TOO_SHORT`)
3. Version field == 1 (error: `INVALID_VERSION`)
4. Packet type field == 1 (telecommand) (error: `NOT_TELECOMMAND`)
5. APID in `APID_REGISTRY` (error: `UNKNOWN_APID`)
6. Data length field matches actual payload length (error: `BAD_LENGTH`)
7. CRC-16-CCITT checksum validates (error: `BAD_CRC`)
8. Extract command type from function code byte in secondary header

---

### 6.4 Telemetry State Service `[MVP]`

**File**: `backend/app/services/telemetry_service.py`

**Design**: An in-memory singleton holding the current satellite state, updated by the OBC's response stream. All scoring requests read from this singleton — no database query needed for current state.

```python
from pydantic import BaseModel
from enum import Enum
import asyncio

class ThermalStatus(str, Enum):
    NOMINAL  = "NOMINAL"
    ELEVATED = "ELEVATED"
    CRITICAL = "CRITICAL"

class OrbitalPhase(str, Enum):
    SUNLIT    = "SUNLIT"
    ECLIPSE   = "ECLIPSE"
    PENUMBRA  = "PENUMBRA"

class TelemetryState(BaseModel):
    satellite_id: str         = "SAT_ALPHA"
    battery_percent: float    = 78.0
    safe_mode_active: bool    = False
    thermal_status: ThermalStatus = ThermalStatus.NOMINAL
    orbital_phase: OrbitalPhase   = OrbitalPhase.SUNLIT
    link_margin_db: float     = 12.5
    last_contact_min: int     = 0
    updated_at: str           = ""   # ISO timestamp

class TelemetryService:
    _state: TelemetryState = TelemetryState()
    _lock: asyncio.Lock = asyncio.Lock()

    @classmethod
    async def get_current(cls) -> TelemetryState:
        return cls._state

    @classmethod
    async def update(cls, updates: dict) -> TelemetryState:
        async with cls._lock:
            cls._state = cls._state.model_copy(update=updates)
            cls._state.updated_at = datetime.utcnow().isoformat()
            # Persist snapshot to telemetry_states table (async, fire-and-forget)
            asyncio.create_task(persist_telemetry_snapshot(cls._state))
            return cls._state
```

---

### 6.5 AI Risk Scoring Engine `[MVP]`

**File**: `backend/app/services/ai_scorer.py`

**Gemini Client Initialization**:
```python
import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.gemini_api_key)

_model = genai.GenerativeModel(
    model_name=settings.gemini_model,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
        max_output_tokens=settings.gemini_max_output_tokens,
        temperature=settings.gemini_temperature,
    )
)
```

**Score Request/Response Models**:
```python
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
    risk_score: int                    # 0–100
    risk_tier: str                     # LOW | MEDIUM | HIGH
    justification: str
    sparta_technique: str | None
    cvss_estimate: str | None
    affected_subsystems: list[str]
    recommended_action: str
    confidence: float                  # 0.0–1.0
    scored_at: str                     # ISO timestamp
    demo_mode: bool = False
```

**Scoring Function**:
```python
async def score_command(request: ScoreRequest) -> ScoreResponse:
    if settings.demo_mode:
        return _load_demo_fixture(request.command_type)

    prompt = _build_prompt(request)

    try:
        response = await asyncio.to_thread(
            _model.generate_content, prompt
        )
        raw = response.text
        parsed = ScoreResponse.model_validate_json(raw)
        parsed.scored_at = datetime.utcnow().isoformat()

        # Enforce tier boundaries from env config
        if parsed.risk_score <= settings.risk_low_max:
            parsed.risk_tier = "LOW"
        elif parsed.risk_score <= settings.risk_medium_max:
            parsed.risk_tier = "MEDIUM"
        else:
            parsed.risk_tier = "HIGH"

        return parsed

    except Exception as e:
        if settings.demo_mode:
            return _load_demo_fixture(request.command_type)
        raise ScoringError(f"Gemini scoring failed: {e}")
```

**Prompt Builder** — the prompt is constructed from a template, injecting all fields from `ScoreRequest`:

```python
SCORING_PROMPT_TEMPLATE = """
You are a satellite command security analyst with expertise in space systems cybersecurity,
CCSDS telecommand protocols, and the SPARTA satellite threat matrix.

Evaluate the following satellite command for security risk. Consider the command type,
target subsystem, current satellite operational state, and operator context.

## COMMAND DETAILS
Command Type: {command_type}
Target Subsystem: {subsystem}
APID: {apid_hex}
Parameters: {parameters_json}

## CURRENT SATELLITE STATE (live telemetry)
Battery Level: {battery_percent}%
Safe Mode Active: {safe_mode_active}
Thermal Status: {thermal_status}
Orbital Phase: {orbital_phase}
Link Margin: {link_margin_db} dB
Last Contact: {last_contact_min} minutes ago

## OPERATOR CONTEXT
Role: {operator_role}
Commands This Session: {session_command_count}
Session Duration: {session_duration_min} minutes

## MISSION SAFETY RULES
SR-001: Safe mode shall not be disabled below 15% battery
SR-002: Attitude manoeuvres are prohibited during eclipse phase without dual approval
SR-003: OBC reset requires safety officer approval regardless of battery state
SR-004: Authentication key updates require admin approval and audit review
SR-005: Thruster fire during penumbra requires dual approval

## SPARTA THREAT TECHNIQUES (relevant)
T0836: Modify Parameter — unauthorized parameter modification
T0855: Unauthorized Command Message — injecting illegitimate commands
T0869: Point and Shoot — directing satellite to perform unsafe actions
T0862: Spoof Reporting Message — false telemetry leading to dangerous commands

## SCORING RUBRIC
0–30  (LOW):    Read-only operations, no satellite state change,
                nominal satellite state, routine operations
31–70 (MEDIUM): State changes to non-safety-critical subsystems,
                minor telemetry concerns, planned operations
71–100 (HIGH):  Safety-critical state changes, mission rule violations,
                anomalous operator behavior, dangerous telemetry state,
                irreversible operations, security-critical parameter changes

## OUTPUT FORMAT
Respond ONLY with a valid JSON object. No markdown, no preamble, no explanation outside JSON.
Schema:
{{
  "risk_score": <integer 0-100>,
  "risk_tier": "<LOW|MEDIUM|HIGH>",
  "justification": "<2-3 sentences referencing specific telemetry values and mission rules>",
  "sparta_technique": "<technique_id or null>",
  "cvss_estimate": "<score string or null>",
  "affected_subsystems": ["<subsystem>"],
  "recommended_action": "<AUTO_APPROVE|SINGLE_APPROVAL|DUAL_APPROVAL|BLOCK>",
  "confidence": <float 0.0-1.0>
}}
"""
```

---

### 6.6 Replay Detection Service `[MVP]`

**File**: `backend/app/services/replay_detector.py`

```python
from collections import OrderedDict
from datetime import datetime, timedelta
from app.config import settings

class ReplayDetector:
    """Thread-safe nonce deduplication + sequence anomaly detection."""

    # Nonce window: OrderedDict preserves insertion order for O(1) eviction
    _nonce_window: OrderedDict[str, datetime] = OrderedDict()

    # Recent command sequence: list of (command_type, timestamp) tuples
    _sequence_window: list[tuple[str, datetime]] = []

    # Dangerous sequence rules
    SEQUENCE_RULES: list[dict] = [
        {"id": "SEQ-001", "trigger": "DISABLE_SAFE_MODE",  "next": "ATTITUDE_MANOEUVRE",  "window_s": 60,  "elevation": 20},
        {"id": "SEQ-002", "trigger": "DISABLE_SAFE_MODE",  "next": "THRUSTER_FIRE",        "window_s": 60,  "elevation": 25},
        {"id": "SEQ-003", "trigger": "DISABLE_ENCRYPTION", "next": None,                   "window_s": 120, "elevation": 30},
        {"id": "SEQ-004", "trigger": "RESET_OBC",          "next": "DISABLE_WATCHDOG",     "window_s": 30,  "elevation": 35},
        {"id": "SEQ-005", "trigger": "UPDATE_AUTH_KEY",    "next": None,                   "window_s": 300, "elevation": 40},
    ]

    @classmethod
    def check_replay(cls, nonce: str) -> bool:
        """Returns True if nonce is a duplicate (replay detected)."""
        if nonce in cls._nonce_window:
            return True
        cls._nonce_window[nonce] = datetime.utcnow()
        if len(cls._nonce_window) > settings.replay_nonce_window_size:
            cls._nonce_window.popitem(last=False)   # Evict oldest
        return False

    @classmethod
    def check_sequence(cls, command_type: str) -> list[dict]:
        """
        Returns list of triggered sequence rules for this command_type.
        Each returned dict has: rule_id, score_elevation, trigger_command.
        """
        now = datetime.utcnow()
        window_s = settings.replay_sequence_window_seconds

        # Evict expired entries
        cls._sequence_window = [
            (ct, ts) for ct, ts in cls._sequence_window
            if now - ts < timedelta(seconds=max(r["window_s"] for r in cls.SEQUENCE_RULES))
        ]

        triggered = []
        for rule in cls.SEQUENCE_RULES:
            # Rule fires when: trigger was seen recently AND current command matches next
            # OR rule has no "next" (any command after trigger is elevated)
            if rule["next"] is None or rule["next"] == command_type:
                trigger_seen = any(
                    ct == rule["trigger"] and (now - ts).seconds <= rule["window_s"]
                    for ct, ts in cls._sequence_window
                )
                if trigger_seen:
                    triggered.append({
                        "rule_id": rule["id"],
                        "score_elevation": rule["elevation"],
                        "trigger_command": rule["trigger"]
                    })

        # Append current command to window for future checks
        cls._sequence_window.append((command_type, now))
        return triggered
```

---

### 6.7 Authorization State Machine `[MVP]`

**File**: `backend/app/services/auth_chain.py`

**States**:
```python
class CommandStatus(str, Enum):
    SUBMITTED             = "SUBMITTED"
    PARSING               = "PARSING"
    SCORED                = "SCORED"
    PENDING_SINGLE        = "PENDING_SINGLE_APPROVAL"
    PENDING_DUAL          = "PENDING_DUAL_APPROVAL"
    AUTO_APPROVED         = "AUTO_APPROVED"
    REJECTED              = "REJECTED"
    BLOCKED               = "BLOCKED"
    DISPATCHED            = "DISPATCHED"
    REPLAY_BLOCKED        = "REPLAY_BLOCKED"
    EMERGENCY_OVERRIDE    = "EMERGENCY_OVERRIDE"
```

**Core Logic**:
```python
async def determine_initial_status(risk_tier: str, override_active: bool) -> CommandStatus:
    if override_active:
        return CommandStatus.EMERGENCY_OVERRIDE
    if risk_tier == "LOW":
        return CommandStatus.AUTO_APPROVED
    if risk_tier == "MEDIUM":
        return CommandStatus.PENDING_SINGLE
    return CommandStatus.PENDING_DUAL

async def process_approval(
    command_id: UUID,
    approver_id: UUID,
    decision: str,           # "APPROVED" | "REJECTED"
    justification: str,
    db_pool
) -> CommandStatus:
    """
    Records approval/rejection. Checks quorum.
    Returns new status after this approval.
    Raises ValueError if approver submitted the command.
    """
    command = await get_command(command_id, db_pool)

    if str(approver_id) == str(command.submitter_id):
        raise ValueError("Self-approval not permitted")

    if decision == "REJECTED":
        await update_command_status(command_id, CommandStatus.REJECTED, db_pool)
        return CommandStatus.REJECTED

    await record_approval(command_id, approver_id, justification, db_pool)
    approval_count = await count_approvals(command_id, db_pool)

    required = 1 if command.status == CommandStatus.PENDING_SINGLE else 2
    if approval_count >= required:
        await update_command_status(command_id, CommandStatus.DISPATCHED, db_pool)
        return CommandStatus.DISPATCHED

    return command.status  # Quorum not yet reached
```

**Approval Timeout Handler**: A background task runs every 30 seconds checking for commands in PENDING state past their timeout:
```python
async def check_pending_timeouts():
    while True:
        await asyncio.sleep(30)
        expired = await get_expired_pending_commands()
        for cmd in expired:
            if cmd.status == CommandStatus.PENDING_SINGLE:
                # Escalate to dual
                await update_command_status(cmd.id, CommandStatus.PENDING_DUAL)
                await ws_manager.broadcast_approver({"type": "ESCALATED", "command_id": str(cmd.id)})
            elif cmd.status == CommandStatus.PENDING_DUAL:
                # Block
                await update_command_status(cmd.id, CommandStatus.BLOCKED)
                await ledger_service.append(cmd.id, "COMMAND_BLOCKED_TIMEOUT")
```

---

### 6.8 Hash-Chain Ledger Service `[MVP]`

**File**: `backend/app/services/ledger_service.py`

```python
import hashlib, json
from datetime import datetime
from uuid import UUID

GENESIS_HASH = "0" * 64   # Hash of the first entry's prev_hash

async def append(
    command_id: UUID,
    event_type: str,
    event_detail: dict,
    operator_id: UUID,
    approver_ids: list[UUID],
    db_pool
) -> str:
    """
    Appends a new entry to the hash chain.
    Returns the entry_hash of the new entry.
    """
    async with db_pool.acquire() as conn:
        # Get previous entry hash (or genesis if first)
        prev = await conn.fetchrow(
            "SELECT entry_hash FROM ledger ORDER BY sequence DESC LIMIT 1"
        )
        prev_hash = prev["entry_hash"] if prev else GENESIS_HASH

        payload = {
            "command_id": str(command_id),
            "event_type": event_type,
            "event_detail": event_detail,
            "operator_id": str(operator_id),
            "approver_ids": [str(a) for a in approver_ids],
        }
        timestamp = datetime.utcnow().isoformat()

        entry_hash = _compute_hash(prev_hash, payload, timestamp)

        await conn.execute("""
            INSERT INTO ledger
              (prev_hash, entry_hash, command_id, event_type, event_detail,
               operator_id, approver_ids, timestamp)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        """, prev_hash, entry_hash, command_id, event_type,
             json.dumps(event_detail), operator_id,
             [str(a) for a in approver_ids], timestamp)

        return entry_hash

def _compute_hash(prev_hash: str, payload: dict, timestamp: str) -> str:
    content = (
        prev_hash
        + json.dumps(payload, sort_keys=True)
        + timestamp
    )
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

async def verify_chain(db_pool) -> dict:
    """
    Traverses the entire ledger chain and verifies integrity.
    Returns {"valid": True} or {"valid": False, "corrupted_at_sequence": N, "entry_id": uuid}
    """
    async with db_pool.acquire() as conn:
        entries = await conn.fetch(
            "SELECT * FROM ledger ORDER BY sequence ASC"
        )

    if not entries:
        return {"valid": True, "entries_checked": 0}

    prev_hash = GENESIS_HASH
    for entry in entries:
        payload = {
            "command_id": str(entry["command_id"]),
            "event_type": entry["event_type"],
            "event_detail": json.loads(entry["event_detail"]),
            "operator_id": str(entry["operator_id"]),
            "approver_ids": entry["approver_ids"],
        }
        expected = _compute_hash(prev_hash, payload, entry["timestamp"].isoformat())

        if expected != entry["entry_hash"]:
            return {
                "valid": False,
                "corrupted_at_sequence": entry["sequence"],
                "entry_id": str(entry["entry_id"]),
                "expected_hash": expected,
                "stored_hash": entry["entry_hash"]
            }
        prev_hash = entry["entry_hash"]

    return {"valid": True, "entries_checked": len(entries)}
```

---

### 6.9 WebSocket Notification Service `[MVP]`

**File**: `backend/app/services/ws_manager.py`

```python
from fastapi import WebSocket
from typing import DefaultDict
from collections import defaultdict

class ConnectionManager:
    def __init__(self):
        # Maps role → list of active WebSocket connections
        self.connections: DefaultDict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, ws: WebSocket, role: str):
        await ws.accept()
        self.connections[role].append(ws)

    def disconnect(self, ws: WebSocket, role: str):
        self.connections[role] = [c for c in self.connections[role] if c != ws]

    async def broadcast_to_role(self, role: str, message: dict):
        """Send JSON message to all connected clients with this role."""
        dead = []
        for ws in self.connections[role]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, role)

    async def broadcast_approver(self, message: dict):
        await self.broadcast_to_role("approver", message)
        await self.broadcast_to_role("admin", message)

ws_manager = ConnectionManager()
```

**WebSocket Message Types** (server → client):
```typescript
// Sent when a command enters PENDING state
{ type: "COMMAND_PENDING",    command_id: string, risk_tier: string, command_type: string, submitted_by: string }

// Sent when a command is approved / dispatched
{ type: "COMMAND_DISPATCHED", command_id: string, approved_by: string[] }

// Sent when a command is rejected
{ type: "COMMAND_REJECTED",   command_id: string, rejected_by: string, reason: string }

// Sent when MEDIUM escalates to HIGH on timeout
{ type: "COMMAND_ESCALATED",  command_id: string }

// Sent when a replay attack is detected
{ type: "REPLAY_DETECTED",    command_type: string, operator_id: string }

// Sent when emergency override is activated
{ type: "OVERRIDE_ACTIVATED", activated_by: string, expires_at: string }

// Heartbeat (every 30s to keep connection alive)
{ type: "PING" }
```

---

### 6.10 Emergency Override Module `[MVP]`

**File**: `backend/app/services/override_service.py`

```python
class OverrideState:
    active: bool = False
    token: str | None = None
    activated_by: str | None = None
    expires_at: datetime | None = None
    justification: str | None = None

_override = OverrideState()

async def activate_override(approver_id: UUID, justification: str) -> dict:
    if len(justification.strip()) < 20:
        raise ValueError("Justification must be at least 20 characters")

    token = create_override_token(approver_id)
    expires = datetime.utcnow() + timedelta(minutes=settings.override_token_expire_minutes)

    _override.active = True
    _override.token = token
    _override.activated_by = str(approver_id)
    _override.expires_at = expires
    _override.justification = justification

    # Log to ledger
    await ledger_service.append(
        command_id=None,
        event_type="OVERRIDE_ACTIVATED",
        event_detail={"justification": justification, "expires_at": expires.isoformat()},
        operator_id=approver_id, approver_ids=[]
    )

    # Schedule auto-deactivation
    asyncio.create_task(_auto_deactivate(expires))

    # Notify all connected clients
    await ws_manager.broadcast_approver({
        "type": "OVERRIDE_ACTIVATED",
        "activated_by": str(approver_id),
        "expires_at": expires.isoformat()
    })

    return {"token": token, "expires_at": expires.isoformat()}

async def _auto_deactivate(expires: datetime):
    await asyncio.sleep((expires - datetime.utcnow()).total_seconds())
    _override.active = False
    await ledger_service.append(
        command_id=None, event_type="OVERRIDE_EXPIRED",
        event_detail={}, operator_id=UUID(_override.activated_by), approver_ids=[]
    )

def is_override_active() -> bool:
    if not _override.active:
        return False
    if datetime.utcnow() > _override.expires_at:
        _override.active = False
        return False
    return True
```

---

### 6.11 API Route Definitions

**Command submission pipeline** (`backend/app/routers/commands.py`):

```python
@router.post("", response_model=CommandSubmitResponse)
async def submit_command(
    body: CommandSubmitRequest,
    operator: TokenPayload = Depends(get_current_operator),
    db=Depends(get_db)
):
    # 1. Parse CCSDS packet
    parse_result = parse_ccsds_packet(body.packet_hex)
    if not parse_result.success:
        raise HTTPException(400, detail={"error": parse_result.error_code})

    # 2. Replay check
    if ReplayDetector.check_replay(body.nonce):
        cmd_id = await store_command(parse_result.parsed, operator, CommandStatus.REPLAY_BLOCKED, db)
        await ledger_service.append(cmd_id, "REPLAY_BLOCKED", {...}, operator.sub, [], db)
        raise HTTPException(409, detail={"error": "REPLAY_DETECTED", "command_id": str(cmd_id)})

    # 3. Sequence anomaly check
    sequence_hits = ReplayDetector.check_sequence(parse_result.parsed.command_type)

    # 4. Get telemetry
    telemetry = await TelemetryService.get_current()

    # 5. Score
    score_req = ScoreRequest(
        command_type=parse_result.parsed.command_type,
        subsystem=parse_result.parsed.subsystem,
        apid=parse_result.parsed.apid,
        parameters=parse_result.parsed.parameters,
        sequence_count=parse_result.parsed.sequence_count,
        telemetry=telemetry,
        operator_id=operator.sub,
        operator_role=operator.role,
        session_command_count=await get_session_command_count(operator.sub, db),
        session_duration_min=await get_session_duration(operator.sub, db),
    )
    score = await score_command(score_req)

    # Apply sequence elevation
    for hit in sequence_hits:
        score.risk_score = min(100, score.risk_score + hit["score_elevation"])
    # Re-derive tier after elevation
    score = recalculate_tier(score)

    # 6. Determine auth chain status
    override_active = is_override_active()
    initial_status = await determine_initial_status(score.risk_tier, override_active)

    # 7. Store command
    cmd_id = await store_command_with_score(parse_result.parsed, score, operator, initial_status, db)

    # 8. Ledger entry
    await ledger_service.append(cmd_id, "COMMAND_SUBMITTED", {
        "risk_score": score.risk_score,
        "risk_tier": score.risk_tier,
        "status": initial_status,
    }, operator.sub, [], db)

    # 9. If auto-approved or override → dispatch immediately
    if initial_status in (CommandStatus.AUTO_APPROVED, CommandStatus.EMERGENCY_OVERRIDE):
        await dispatch_to_obc(parse_result.parsed, cmd_id, db)

    # 10. If pending → notify approvers via WebSocket
    if initial_status in (CommandStatus.PENDING_SINGLE, CommandStatus.PENDING_DUAL):
        await ws_manager.broadcast_approver({
            "type": "COMMAND_PENDING",
            "command_id": str(cmd_id),
            "risk_tier": score.risk_tier,
            "command_type": parse_result.parsed.command_type,
            "submitted_by": operator.username,
        })

    return CommandSubmitResponse(
        command_id=cmd_id,
        status=initial_status,
        risk_score=score.risk_score,
        risk_tier=score.risk_tier,
        justification=score.justification,
        sequence_alerts=[h["rule_id"] for h in sequence_hits],
    )
```

---

### 6.12 Middleware & Error Handling

**File**: `backend/app/middleware/error_handler.py`

All errors return a consistent JSON structure:
```json
{
  "error": {
    "code": "COMMAND_REPLAY_DETECTED",
    "message": "Duplicate command nonce detected — possible replay attack",
    "detail": {},
    "timestamp": "2026-06-10T14:32:00Z",
    "request_id": "uuid"
  }
}
```

**Error Code Registry**:

| HTTP Status | Code | Trigger |
|---|---|---|
| 400 | `INVALID_CCSDS_PACKET` | CCSDS parser failure |
| 400 | `INVALID_REQUEST_BODY` | Pydantic validation error |
| 401 | `TOKEN_EXPIRED` | JWT past expiry |
| 401 | `TOKEN_INVALID` | Bad JWT signature |
| 403 | `INSUFFICIENT_ROLE` | Role check failed |
| 403 | `SELF_APPROVAL_FORBIDDEN` | Operator approving own command |
| 404 | `COMMAND_NOT_FOUND` | Unknown command_id |
| 409 | `REPLAY_DETECTED` | Duplicate nonce |
| 409 | `COMMAND_ALREADY_RESOLVED` | Approving a non-pending command |
| 422 | `SCORING_FAILED` | Gemini API error (non-DEMO_MODE) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled exception |

---

## §7 — Database Layer

### 7.1 Connection & Pool Configuration

**File**: `backend/app/database.py`

```python
import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None

async def create_pool():
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.database_pool_min,
        max_size=settings.database_pool_max,
        command_timeout=settings.database_pool_timeout,
    )

async def close_pool():
    if _pool:
        await _pool.close()

async def get_db() -> asyncpg.Pool:
    return _pool
```

### 7.2 Migration Strategy

Migrations are plain SQL files in `backend/migrations/`. Applied manually at setup time and tracked by a `schema_migrations` table.

```bash
# Apply migration
psql $DATABASE_URL < backend/migrations/001_initial_schema.sql
```

For the MVP there is a single migration file (`001_initial_schema.sql`) containing the complete DDL. Future migrations are numbered sequentially (`002_`, `003_`, etc.).

### 7.3 Full Schema DDL

```sql
-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(16) PRIMARY KEY,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Operators ───────────────────────────────────────────────────
CREATE TABLE operators (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR(64) UNIQUE NOT NULL,
    password_hash       VARCHAR(256) NOT NULL,
    role                VARCHAR(32) NOT NULL
                        CHECK (role IN ('operator','approver','admin')),
    full_name           VARCHAR(128),
    baseline_profile    JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    last_login          TIMESTAMPTZ,
    is_active           BOOLEAN DEFAULT TRUE
);

-- ── Commands ────────────────────────────────────────────────────
CREATE TABLE commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce               VARCHAR(64) UNIQUE NOT NULL,
    ccsds_apid          VARCHAR(16) NOT NULL,
    command_type        VARCHAR(64) NOT NULL,
    subsystem           VARCHAR(32) NOT NULL,
    parameters          JSONB DEFAULT '{}',
    sequence_count      INTEGER NOT NULL,
    raw_packet_hex      TEXT,
    risk_score          INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    risk_tier           VARCHAR(16)
                        CHECK (risk_tier IN ('LOW','MEDIUM','HIGH')),
    ai_justification    TEXT,
    sparta_technique    VARCHAR(32),
    cvss_estimate       VARCHAR(8),
    affected_subsystems TEXT[],
    sequence_alerts     TEXT[],
    telemetry_snapshot  JSONB,
    status              VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN (
                          'SUBMITTED','PARSING','SCORED',
                          'PENDING_SINGLE_APPROVAL','PENDING_DUAL_APPROVAL',
                          'AUTO_APPROVED','REJECTED','BLOCKED',
                          'DISPATCHED','REPLAY_BLOCKED','EMERGENCY_OVERRIDE'
                        )),
    submitter_id        UUID REFERENCES operators(id),
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    scored_at           TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    demo_mode           BOOLEAN DEFAULT FALSE
);

-- ── Approvals ───────────────────────────────────────────────────
CREATE TABLE approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id      UUID NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
    approver_id     UUID NOT NULL REFERENCES operators(id),
    decision        VARCHAR(16) NOT NULL
                    CHECK (decision IN ('APPROVED','REJECTED')),
    justification   TEXT,
    token_hash      VARCHAR(256),
    decided_at      TIMESTAMPTZ DEFAULT NOW(),
    token_expires   TIMESTAMPTZ,
    is_override     BOOLEAN DEFAULT FALSE,
    UNIQUE (command_id, approver_id)    -- One decision per approver per command
);

-- ── Tamper-Evident Ledger ───────────────────────────────────────
CREATE TABLE ledger (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence        BIGSERIAL UNIQUE NOT NULL,
    prev_hash       VARCHAR(64) NOT NULL,
    entry_hash      VARCHAR(64) NOT NULL,
    command_id      UUID REFERENCES commands(id),
    event_type      VARCHAR(64) NOT NULL,
    event_detail    JSONB DEFAULT '{}',
    operator_id     UUID REFERENCES operators(id),
    approver_ids    UUID[] DEFAULT '{}',
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger is append-only: block UPDATE and DELETE
CREATE RULE ledger_no_update AS ON UPDATE TO ledger DO INSTEAD NOTHING;
CREATE RULE ledger_no_delete AS ON DELETE TO ledger DO INSTEAD NOTHING;

-- ── Telemetry States ────────────────────────────────────────────
CREATE TABLE telemetry_states (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satellite_id        VARCHAR(32) DEFAULT 'SAT_ALPHA',
    battery_percent     FLOAT NOT NULL,
    safe_mode_active    BOOLEAN NOT NULL,
    thermal_status      VARCHAR(32) NOT NULL
                        CHECK (thermal_status IN ('NOMINAL','ELEVATED','CRITICAL')),
    orbital_phase       VARCHAR(32) NOT NULL
                        CHECK (orbital_phase IN ('SUNLIT','ECLIPSE','PENUMBRA')),
    link_margin_db      FLOAT,
    last_contact_min    INTEGER,
    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX idx_commands_status       ON commands(status);
CREATE INDEX idx_commands_submitter    ON commands(submitter_id);
CREATE INDEX idx_commands_nonce        ON commands(nonce);
CREATE INDEX idx_commands_submitted_at ON commands(submitted_at DESC);
CREATE INDEX idx_ledger_sequence       ON ledger(sequence ASC);
CREATE INDEX idx_ledger_command_id     ON ledger(command_id);
CREATE INDEX idx_approvals_command     ON approvals(command_id);
CREATE INDEX idx_telemetry_recorded    ON telemetry_states(recorded_at DESC);

INSERT INTO schema_migrations (version) VALUES ('001');
```

### 7.4 Key Query Patterns

```sql
-- Get pending commands for approver panel
SELECT c.*, o.username as submitter_username
FROM commands c
JOIN operators o ON c.submitter_id = o.id
WHERE c.status IN ('PENDING_SINGLE_APPROVAL','PENDING_DUAL_APPROVAL')
ORDER BY c.submitted_at ASC;

-- Count approvals for a command
SELECT COUNT(*) FROM approvals
WHERE command_id = $1 AND decision = 'APPROVED';

-- Get expired pending commands (for timeout handler)
SELECT * FROM commands
WHERE status IN ('PENDING_SINGLE_APPROVAL','PENDING_DUAL_APPROVAL')
AND submitted_at < NOW() - INTERVAL '5 minutes';

-- Get full ledger for integrity check (ordered)
SELECT * FROM ledger ORDER BY sequence ASC;

-- Operator session stats (for AI scorer context)
SELECT COUNT(*) as count, MIN(submitted_at) as first
FROM commands
WHERE submitter_id = $1
AND submitted_at > NOW() - INTERVAL '8 hours';
```

---

## §8 — Frontend — Next.js Application

### 8.1 Project Configuration

**`package.json` dependencies**:
```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "^18.3.x",
    "react-dom": "^18.3.x",
    "axios": "^1.7.x",
    "recharts": "^2.12.x",
    "lucide-react": "^0.383.0",
    "clsx": "^2.1.x"
  },
  "devDependencies": {
    "typescript": "^5.4.x",
    "@types/react": "^18.3.x",
    "tailwindcss": "^3.4.x",
    "autoprefixer": "^10.4.x"
  }
}
```

**`next.config.ts`**:
```typescript
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ]
  },
}
export default nextConfig
```

### 8.2 Route Architecture & Auth Middleware

**`middleware.ts`** (Next.js route-level auth):
```typescript
import { NextRequest, NextResponse } from 'next/server'

const ROLE_ROUTES: Record<string, string[]> = {
  '/operator': ['operator', 'admin'],
  '/approver': ['approver', 'admin'],
  '/admin':    ['admin'],
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('scsp_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  try {
    const payload = parseJwtPayload(token)    // decode without verify (verify on backend)
    const path = request.nextUrl.pathname
    const requiredRoles = Object.entries(ROLE_ROUTES)
      .find(([prefix]) => path.startsWith(prefix))?.[1]

    if (requiredRoles && !requiredRoles.includes(payload.role)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/operator/:path*', '/approver/:path*', '/admin/:path*'],
}
```

### 8.3 Operator Dashboard — Key Components

**`CommandTerminal.tsx`** — command authoring form:
- Subsystem selector (dropdown from APID registry)
- Command type selector (filtered by subsystem)
- Parameter fields (rendered dynamically per command type)
- Nonce auto-generated (UUID v4) on form mount
- Submit button triggers `POST /api/v1/commands`
- On response: renders `RiskScoreCard` with score + justification
- Shows approval status badge if PENDING

**`TelemetryPanel.tsx`** — live satellite state:
- Displays all 6 telemetry fields
- In demo mode: renders sliders for battery_percent, safe_mode_active toggle, thermal_status select, orbital_phase select
- Changes trigger `PUT /api/v1/telemetry/update`
- Badge colors: battery (green/amber/red by threshold), safe_mode (blue/red)

**`RiskScoreCard.tsx`** — score display:
- Large numeric score with color coding (green 0–30, amber 31–70, red 71–100)
- Risk tier badge (LOW / MEDIUM / HIGH)
- Justification text paragraph
- SPARTA technique chip (if present)
- CVSS score chip (if present)
- Affected subsystems tag list
- Approval status tracker (for PENDING commands)

### 8.4 Approver Panel — Key Components

**`ApprovalQueue.tsx`** — pending command list:
- Sorted by submitted_at ascending (oldest first)
- Each row shows: command type, subsystem, risk score, submitted by, time pending
- Click opens `ApprovalModal`
- Real-time update via WebSocket (or 3s polling fallback)

**`ApprovalModal.tsx`** — full command review:
- Full command details (type, subsystem, parameters)
- AI risk score + justification (same as operator sees)
- Telemetry snapshot at time of scoring
- SPARTA technique + CVSS if present
- Sequence alerts if any rules triggered
- Justification textarea (required for HIGH-risk rejection, optional otherwise)
- Approve (green) / Reject (red) buttons
- Submit calls `POST /api/v1/commands/{id}/approve` or `reject`

### 8.5 Admin Dashboard — Key Components

**`LedgerTable.tsx`** — ledger viewer:
- Paginated table of all ledger entries (20 per page)
- Columns: sequence, timestamp, event_type, command_type, risk_score, status, operator, approvers, entry_hash (truncated)
- Row color: DISPATCHED=neutral, REJECTED=amber, REPLAY_BLOCKED=red, EMERGENCY_OVERRIDE=purple

**`IntegrityChecker.tsx`** — chain verification:
- "Verify Chain Integrity" button
- Calls `GET /api/v1/ledger/verify`
- On VALID: green banner "All N entries verified — chain intact"
- On INVALID: red banner "Tampering detected at sequence N"
- Highlights the corrupted row in the ledger table red
- For demo tamper: a hidden admin button "Tamper Entry [N]" updates risk_score to trigger failure

### 8.6 WebSocket Client Hook

**`hooks/useApprovalWebSocket.ts`**:
```typescript
import { useEffect, useRef, useState, useCallback } from 'react'

export function useApprovalWebSocket(
  onMessage: (msg: WSMessage) => void
) {
  const ws = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [pollingMode, setPollingMode] = useState(false)

  const connect = useCallback(() => {
    const token = getStoredToken()
    ws.current = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/ws/approvals?token=${token}`
    )
    ws.current.onopen  = () => { setConnected(true); setPollingMode(false) }
    ws.current.onmessage = (e) => onMessage(JSON.parse(e.data))
    ws.current.onerror = () => setPollingMode(true)
    ws.current.onclose = () => { setConnected(false); setTimeout(connect, 3000) }
  }, [onMessage])

  useEffect(() => { connect() }, [connect])

  // Polling fallback — activates when WebSocket unavailable
  useEffect(() => {
    if (!pollingMode) return
    const interval = setInterval(async () => {
      const pending = await api.getPendingCommands()
      onMessage({ type: 'POLLING_UPDATE', data: pending })
    }, 3000)
    return () => clearInterval(interval)
  }, [pollingMode, onMessage])

  return { connected, pollingMode }
}
```

### 8.7 API Client Layer

**`lib/api.ts`** — typed API client using fetch:
```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new ApiError(res.status, err.error)
  }
  return res.json()
}

export const api = {
  login:              (body) => request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  submitCommand:      (body) => request('/api/v1/commands', { method: 'POST', body: JSON.stringify(body) }),
  getPendingCommands: ()     => request('/api/v1/commands/pending'),
  approveCommand:     (id, body) => request(`/api/v1/commands/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
  rejectCommand:      (id, body) => request(`/api/v1/commands/${id}/reject`,  { method: 'POST', body: JSON.stringify(body) }),
  getTelemetry:       ()     => request('/api/v1/telemetry/current'),
  updateTelemetry:    (body) => request('/api/v1/telemetry/update', { method: 'PUT', body: JSON.stringify(body) }),
  getLedger:          (page) => request(`/api/v1/ledger?page=${page}`),
  verifyLedger:       ()     => request('/api/v1/ledger/verify'),
  activateOverride:   (body) => request('/api/v1/override/activate', { method: 'POST', body: JSON.stringify(body) }),
}
```

---

## §9 — Mock Satellite OBC

**File**: `obc/obc_simulator.py`

### 9.1 UDP Server Design

Listens on `UDP 0.0.0.0:9000`. Accepts JSON-encoded command packets (not raw CCSDS — SCSP wraps the parsed command in JSON before UDP dispatch for simplicity). Returns JSON telemetry response.

### 9.2 Satellite State Model

```python
satellite_state = {
    "battery_percent":   78.0,
    "safe_mode_active":  False,
    "thermal_status":    "NOMINAL",    # NOMINAL | ELEVATED | CRITICAL
    "orbital_phase":     "SUNLIT",     # SUNLIT | ECLIPSE | PENUMBRA
    "link_margin_db":    12.5,
    "attitude":          {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
    "subsystem_status": {
        "EPS": "NOMINAL", "ADCS": "NOMINAL",
        "TM":  "NOMINAL", "OBC":  "NOMINAL", "PAYLOAD": "NOMINAL"
    }
}
```

**Battery drain simulation**: Each received command drains `0.1%` battery. When battery < 5%, safe_mode auto-activates regardless of commands.

### 9.3 Command Handlers

```python
COMMAND_HANDLERS = {
    "REQUEST_TELEMETRY":    lambda p: None,   # No state change — return as-is
    "DISABLE_SAFE_MODE":    lambda p: state.update({"safe_mode_active": False}),
    "ENABLE_SAFE_MODE":     lambda p: state.update({"safe_mode_active": True}),
    "ATTITUDE_MANOEUVRE":   lambda p: state["attitude"].update(p),
    "RESET_SUBSYSTEM":      lambda p: state["subsystem_status"].update({p["subsystem"]: "NOMINAL"}),
    "THRUSTER_FIRE":        lambda p: state["attitude"].update({"yaw": state["attitude"]["yaw"] + p.get("delta_yaw", 0)}),
    "UPDATE_PARAMETER":     lambda p: None,   # Acknowledged but no visible state change
    "RESET_OBC":            lambda p: state.update({"subsystem_status": {k: "NOMINAL" for k in state["subsystem_status"]}}),
    "PAYLOAD_ACTIVATE":     lambda p: state["subsystem_status"].update({"PAYLOAD": "ACTIVE"}),
}
```

### 9.4 Telemetry Response Format

```json
{
  "status": "ACK",
  "command_id": "<uuid>",
  "executed_command": "DISABLE_SAFE_MODE",
  "telemetry": {
    "battery_percent": 77.9,
    "safe_mode_active": false,
    "thermal_status": "NOMINAL",
    "orbital_phase": "SUNLIT",
    "link_margin_db": 12.4,
    "attitude": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
    "subsystem_status": {"EPS": "NOMINAL", "ADCS": "NOMINAL", "TM": "NOMINAL", "OBC": "NOMINAL", "PAYLOAD": "NOMINAL"}
  },
  "timestamp": "2026-06-10T14:32:01Z"
}
```

---

## §10 — Integration Layer

### 10.1 OpenC3 COSMOS Plugin

**Plugin Registration** (`cosmos_plugin/scsp_command_router.rb`):
```ruby
require 'net/http'
require 'json'

class ScspCommandRouter
  SCSP_ENDPOINT = ENV.fetch('SCSP_API_URL', 'http://localhost:8000')
  SCSP_TOKEN    = ENV.fetch('SCSP_SERVICE_TOKEN')

  def self.route(target_name, cmd_name, cmd_params)
    packet_hex = build_ccsds_packet(target_name, cmd_name, cmd_params)
    nonce      = SecureRandom.uuid

    response = Net::HTTP.post(
      URI("#{SCSP_ENDPOINT}/api/v1/commands"),
      { packet_hex: packet_hex, nonce: nonce }.to_json,
      'Content-Type' => 'application/json',
      'Authorization' => "Bearer #{SCSP_TOKEN}"
    )

    result = JSON.parse(response.body)

    if %w[AUTO_APPROVED DISPATCHED EMERGENCY_OVERRIDE].include?(result['status'])
      # Command approved — COSMOS proceeds normally
      return true
    elsif result['status'].start_with?('PENDING')
      raise "SCSP: Command pending approval (#{result['risk_tier']}) — ID: #{result['command_id']}"
    else
      raise "SCSP: Command blocked — #{result['justification']}"
    end
  end
end
```

### 10.2 Generic REST Proxy Adapter

SCSP exposes a proxy endpoint that accepts commands from any C2 system and forwards them to the configured upstream uplink after authorization:

```
POST /proxy/command
Content-Type: application/json
Authorization: Bearer <service_token>

{
  "packet_hex": "<ccsds_hex>",
  "nonce": "<uuid>",
  "upstream_target": "https://uplink.example.com/command"  // optional override
}
```

On approval, SCSP POSTs the original `packet_hex` bytes to `SCSP_UPSTREAM_ENDPOINT` and returns the upstream response to the caller.

### 10.3 Uplink Passthrough

**`backend/app/services/obc_client.py`**:
```python
import socket, json
from app.config import settings

async def dispatch_to_obc(parsed_command, command_id: UUID, db) -> dict:
    """
    Sends approved command to mock OBC via UDP.
    Updates command.dispatched_at on success.
    Updates telemetry state from OBC response.
    """
    payload = json.dumps({
        "command_id": str(command_id),
        "command_type": parsed_command.command_type,
        "subsystem": parsed_command.subsystem,
        "parameters": parsed_command.parameters,
    }).encode()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(settings.obc_timeout_ms / 1000)

    try:
        sock.sendto(payload, (settings.obc_host, settings.obc_port))
        response_data, _ = sock.recvfrom(4096)
        response = json.loads(response_data)

        # Update telemetry state from OBC response
        if response.get("status") == "ACK":
            await TelemetryService.update(response["telemetry"])
            await update_command_dispatched_at(command_id, db)

        return response
    except socket.timeout:
        # OBC didn't respond — log but don't block (satellite may be out of contact)
        return {"status": "TIMEOUT", "command_id": str(command_id)}
    finally:
        sock.close()
```

---

## §11 — AI Scoring Engine — Deep Specification

### 11.1 Prompt Engineering Guidelines

The scoring prompt is the highest-leverage engineering surface in SCSP. These rules govern prompt evolution:

- **Temperature must stay at 0.1** — higher values produce inconsistent risk scores for identical inputs, breaking the demo reproducibility requirement
- **Always use `response_mime_type="application/json"`** — prevents markdown fencing and preamble that breaks JSON parsing
- **Mission rules must be in the prompt** — not in the system instruction — to ensure they are visible to the model on every call
- **Telemetry values must be injected as concrete numbers**, not descriptions (say "battery: 9%" not "battery is low") — the model reasons more consistently from numbers
- **The output schema must be in the prompt** — the model must see the exact field names to produce valid JSON consistently
- **Never exceed 1024 output tokens** — longer responses indicate the model is producing explanatory text outside the JSON, indicating a prompt issue

### 11.2 Gemini API Configuration

```python
generation_config = genai.GenerationConfig(
    response_mime_type="application/json",
    max_output_tokens=1024,
    temperature=0.1,
    top_p=0.9,
    top_k=40,
)

safety_settings = [
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    # Disable dangerous content blocking — satellite safety analysis requires
    # discussing potentially dangerous commands without filter interference
]
```

### 11.3 Output Validation & Parsing

```python
def validate_score_response(raw_json: str) -> ScoreResponse:
    """
    Validates and normalizes Gemini's JSON response.
    Raises ScoringError on any validation failure.
    """
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        raise ScoringError(f"Invalid JSON from Gemini: {e}")

    # Coerce risk_score to int and clamp to 0–100
    score = int(data.get("risk_score", 50))
    score = max(0, min(100, score))
    data["risk_score"] = score

    # Derive tier from score (don't trust model's tier — use config thresholds)
    if score <= settings.risk_low_max:
        data["risk_tier"] = "LOW"
    elif score <= settings.risk_medium_max:
        data["risk_tier"] = "MEDIUM"
    else:
        data["risk_tier"] = "HIGH"

    # Ensure required fields have defaults
    data.setdefault("sparta_technique", None)
    data.setdefault("cvss_estimate", None)
    data.setdefault("affected_subsystems", [])
    data.setdefault("confidence", 0.8)

    return ScoreResponse.model_validate(data)
```

### 11.4 DEMO_MODE Implementation

**File**: `backend/fixtures/demo_scores.json`:
```json
{
  "REQUEST_TELEMETRY": {
    "risk_score": 5, "risk_tier": "LOW",
    "justification": "Telemetry request is read-only with no satellite state change. Nominal battery and orbital conditions. Routine operation.",
    "sparta_technique": null, "cvss_estimate": null,
    "affected_subsystems": ["TM"],
    "recommended_action": "AUTO_APPROVE", "confidence": 0.99
  },
  "UPDATE_PARAMETER": {
    "risk_score": 45, "risk_tier": "MEDIUM",
    "justification": "Parameter update modifies OBC configuration state. Non-safety-critical subsystem. Nominal satellite conditions.",
    "sparta_technique": "T0836", "cvss_estimate": "4.2",
    "affected_subsystems": ["OBC"],
    "recommended_action": "SINGLE_APPROVAL", "confidence": 0.87
  },
  "DISABLE_SAFE_MODE": {
    "risk_score": 87, "risk_tier": "HIGH",
    "justification": "Disabling safe mode at 9% battery during eclipse phase violates SR-001. Thermal elevation compounds power risk. Irreversible power failure is probable. SPARTA T0836 applies.",
    "sparta_technique": "T0836", "cvss_estimate": "8.4",
    "affected_subsystems": ["EPS","OBC","ADCS"],
    "recommended_action": "DUAL_APPROVAL", "confidence": 0.96
  },
  "THRUSTER_FIRE": {
    "risk_score": 92, "risk_tier": "HIGH",
    "justification": "Thruster firing is an irreversible orbital manoeuvre. Current eclipse phase violates SR-002. Safe mode must be active before thrusters engage. SPARTA T0869 applies.",
    "sparta_technique": "T0869", "cvss_estimate": "9.1",
    "affected_subsystems": ["ADCS","EPS"],
    "recommended_action": "DUAL_APPROVAL", "confidence": 0.97
  }
}
```

### 11.5 SPARTA Threat Mapping Table

| Command Type | SPARTA Technique | Description |
|---|---|---|
| `UPDATE_PARAMETER` | T0836 | Modify Parameter |
| `UPDATE_AUTH_KEY` | T0836 | Modify Parameter (security-critical) |
| `DISABLE_SAFE_MODE` | T0836 | Modify Parameter (safety state) |
| `THRUSTER_FIRE` | T0869 | Point and Shoot |
| `ATTITUDE_MANOEUVRE` | T0869 | Point and Shoot |
| `RESET_OBC` | T0800 | Activate Firmware Update Mode |
| `DISABLE_WATCHDOG` | T0800 | Activate Firmware Update Mode |
| Replayed command | T0855 | Unauthorized Command Message |
| Sequence anomaly | T0836 | Modify Parameter (chained) |

---

## §12 — Cryptography & Security Implementation

### 12.1 Password Hashing

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

### 12.2 JWT Implementation

```python
from jose import JWTError, jwt
from datetime import datetime, timedelta

def create_access_token(sub: str, role: str, username: str) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "username": username,
        "token_type": "access",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    except JWTError as e:
        raise AuthenticationError(str(e))
```

### 12.3 Ed25519 Approval Token Signing

Approval tokens are signed with Ed25519 (separate from JWT) to provide a cryptographic proof of the specific approver's decision that is embeddable in the ledger:

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import base64, json

# Key generation (done once at setup, stored as env var)
# private_key = Ed25519PrivateKey.generate()
# APPROVAL_SIGNING_PRIVATE_KEY = base64.b64encode(
#     private_key.private_bytes(Raw, Raw, NoEncryption)
# ).decode()

def sign_approval(command_id: str, approver_id: str, decision: str, timestamp: str) -> str:
    """Returns base64-encoded Ed25519 signature."""
    message = json.dumps({
        "command_id": command_id,
        "approver_id": approver_id,
        "decision": decision,
        "timestamp": timestamp,
    }, sort_keys=True).encode()

    key_bytes = base64.b64decode(settings.approval_signing_private_key)
    private_key = Ed25519PrivateKey.from_private_bytes(key_bytes)
    signature = private_key.sign(message)
    return base64.b64encode(signature).decode()
```

### 12.4 SHA-256 Hash Chain

Implemented in `ledger_service.py` — see §6.8 for full implementation.

**Hash input canonicalization rules** (must be consistent across all invocations):
- JSON serialized with `sort_keys=True` — prevents key ordering variations
- Encoded as UTF-8 before hashing
- Timestamps stored and used as ISO 8601 strings (no timezone conversion)
- UUID values serialized as lowercase hyphenated strings (Python default)
- Empty lists serialized as `[]`, not `null`

### 12.5 Input Sanitization Rules

All API inputs are validated by Pydantic models before reaching service logic:

| Input | Validation | Max Length |
|---|---|---|
| `packet_hex` | Regex `^[0-9a-fA-F]+$`, even length | 2048 chars |
| `nonce` | UUID v4 format | 36 chars |
| `justification` | String, strip whitespace | 1000 chars |
| `username` | Alphanumeric + underscore | 64 chars |
| `password` | Minimum 8 chars | 256 chars |
| `override_justification` | Minimum 20 chars | 500 chars |
| JSONB `parameters` | Max depth 3, max 20 keys | — |

SQL injection: all database queries use asyncpg parameterized queries (`$1`, `$2` placeholders) exclusively. No string interpolation in SQL.

---

## §13 — Synthetic Data Generation

### 13.1 Seed Script Architecture

```
backend/scripts/
├── seed_demo.py          # Master seeder — calls all below in order
├── seed_operators.py     # Creates operators + bcrypt passwords
├── seed_history.py       # Generates 300 historical commands (50 per operator)
├── seed_telemetry.py     # Inserts 4 canonical telemetry snapshots
├── seed_scenarios.py     # Stages attack scenario data
└── reset_demo.py         # TRUNCATE all tables CASCADE + re-run seed_demo.py
```

**Execution order in `seed_demo.py`**:
```python
async def main():
    pool = await create_pool()
    await seed_operators(pool)       # Must be first (foreign keys)
    await seed_telemetry(pool)       # Independent
    await seed_history(pool)         # Depends on operators
    await seed_scenarios(pool)       # Depends on operators + history
    await print_verification(pool)   # Print counts to confirm
    await pool.close()
```

### 13.2 Operator & History Generator

```python
OPERATORS = [
    {"username": "op_chen",     "role": "operator", "full_name": "Wei Chen",
     "password": "operator123", "typical_subsystems": ["EPS","TM"],
     "session_hour_start": 8, "cmds_per_session": (15, 25)},
    {"username": "op_martinez", "role": "operator", "full_name": "Carlos Martinez",
     "password": "operator123", "typical_subsystems": ["ADCS","OBC"],
     "session_hour_start": 16, "cmds_per_session": (20, 35)},
    {"username": "op_patel",    "role": "operator", "full_name": "Priya Patel",
     "password": "operator123", "typical_subsystems": ["TM","PAYLOAD"],
     "session_hour_start": 0,  "cmds_per_session": (10, 18)},
    {"username": "so_kim",      "role": "approver",  "full_name": "Jisoo Kim",
     "password": "approver123", "typical_subsystems": [],
     "session_hour_start": 8,  "cmds_per_session": (0, 0)},
    {"username": "so_okonkwo",  "role": "approver",  "full_name": "Emeka Okonkwo",
     "password": "approver123", "typical_subsystems": [],
     "session_hour_start": 16, "cmds_per_session": (0, 0)},
    {"username": "admin_root",  "role": "admin",     "full_name": "System Admin",
     "password": "admin123",   "typical_subsystems": [],
     "session_hour_start": 9,  "cmds_per_session": (0, 0)},
]
```

**History generation logic**: For each operator, generate 50 commands distributed across the past 30 days. Command types are sampled from a weighted distribution matching the operator's `typical_subsystems`. Risk scores are generated using DEMO_MODE fixtures. 45 of 50 commands are DISPATCHED; 3 are REJECTED; 2 are BLOCKED (one replay, one HIGH rejected).

### 13.3 CCSDS Command Dataset

Each command type is stored as a fixture with:
- A valid hex-encoded CCSDS packet (minimal length, valid CRC)
- A set of parameters for dynamic substitution
- Three telemetry contexts: nominal (LOW score), marginal (MEDIUM score), critical (HIGH score)

Packets are generated using a minimal CCSDS builder function:
```python
def build_ccsds_packet(apid: int, function_code: int, params: bytes = b'') -> str:
    version_type_apid = (0b001 << 13) | (1 << 12) | (apid & 0x7FF)
    seq_flags_count = (0b11 << 14) | (0 & 0x3FFF)
    secondary_header = bytes([function_code]) + params
    data_length = len(secondary_header) - 1
    header = struct.pack('>HHH', version_type_apid, seq_flags_count, data_length)
    packet = header + secondary_header
    crc = compute_crc16_ccitt(packet)
    return (packet + struct.pack('>H', crc)).hex()
```

### 13.4 Attack Scenario Fixtures

Four attack scenarios are pre-staged as data fixtures (not code). Each is a JSON file in `backend/fixtures/scenarios/`:

**`replay_attack.json`** — two commands with identical nonce, second submitted 8 minutes after first  
**`high_risk_low_battery.json`** — `DISABLE_SAFE_MODE` with `low_power_eclipse` telemetry  
**`dangerous_sequence.json`** — `DISABLE_SAFE_MODE` followed by `THRUSTER_FIRE` within 45 seconds  
**`ledger_tamper.json`** — ledger entry at sequence 42 with `risk_score` pre-set to 87, `tampered_score` field set to 12 for demo tamper script

### 13.5 Demo State Seeder

`seed_scenarios.py` creates one command in `PENDING_DUAL_APPROVAL` state with:
- Command type: `DISABLE_SAFE_MODE`
- Risk score: 87, tier: HIGH
- Telemetry snapshot: `low_power_eclipse`
- Submitter: `op_chen`
- Submitted 2 minutes ago (within approval window)
- Zero approvals recorded

This ensures the approver panel is never empty when the demo starts. The approver (judge or team member) can approve it immediately as a warm-up before the main scripted demo flow.

---

## §14 — API Contract — Full Endpoint Specification

### 14.1 Authentication Endpoints

#### `POST /api/v1/auth/login`

**Request**:
```json
{ "username": "op_chen", "password": "operator123" }
```
**Response 200**:
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 3600,
  "operator": { "id": "<uuid>", "username": "op_chen", "role": "operator", "full_name": "Wei Chen" }
}
```
**Errors**: 401 `INVALID_CREDENTIALS`, 429 `RATE_LIMIT_EXCEEDED`

#### `POST /api/v1/auth/refresh`

**Headers**: `Authorization: Bearer <access_token>`  
**Response 200**: New `access_token` with reset expiry  
**Errors**: 401 `TOKEN_EXPIRED`, 401 `TOKEN_INVALID`

---

### 14.2 Command Endpoints

#### `POST /api/v1/commands` — Submit command

**Auth**: OPERATOR, APPROVER, ADMIN

**Request**:
```json
{
  "packet_hex": "190e00020001...",
  "nonce": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response 200**:
```json
{
  "command_id": "<uuid>",
  "status": "PENDING_DUAL_APPROVAL",
  "risk_score": 87,
  "risk_tier": "HIGH",
  "justification": "Disabling safe mode at 9% battery...",
  "sparta_technique": "T0836",
  "cvss_estimate": "8.4",
  "affected_subsystems": ["EPS", "OBC", "ADCS"],
  "sequence_alerts": [],
  "demo_mode": false
}
```

**Errors**: 400 `INVALID_CCSDS_PACKET`, 409 `REPLAY_DETECTED`, 422 `SCORING_FAILED`

#### `GET /api/v1/commands/pending`

**Auth**: APPROVER, ADMIN  
**Response 200**: Array of pending command objects with full scoring details

#### `GET /api/v1/commands/{id}`

**Auth**: Any authenticated  
**Response 200**: Single command with full detail including approval history

#### `POST /api/v1/commands/{id}/approve`

**Auth**: APPROVER, ADMIN

**Request**:
```json
{ "justification": "Approved for scheduled maintenance window" }
```

**Response 200**:
```json
{
  "command_id": "<uuid>",
  "new_status": "DISPATCHED",
  "approvals_recorded": 2,
  "approvals_required": 2,
  "quorum_reached": true
}
```

**Errors**: 403 `SELF_APPROVAL_FORBIDDEN`, 404 `COMMAND_NOT_FOUND`, 409 `COMMAND_ALREADY_RESOLVED`

#### `POST /api/v1/commands/{id}/reject`

**Auth**: APPROVER, ADMIN

**Request**: `{ "justification": "Battery too low — reschedule" }`  
**Response 200**: `{ "command_id": "<uuid>", "new_status": "REJECTED" }`

---

### 14.3 Telemetry Endpoints

#### `GET /api/v1/telemetry/current`

**Auth**: Any authenticated  
**Response 200**:
```json
{
  "satellite_id": "SAT_ALPHA",
  "battery_percent": 9.0,
  "safe_mode_active": true,
  "thermal_status": "ELEVATED",
  "orbital_phase": "ECLIPSE",
  "link_margin_db": 3.2,
  "last_contact_min": 18,
  "updated_at": "2026-06-10T14:31:55Z"
}
```

#### `PUT /api/v1/telemetry/update`

**Auth**: ADMIN  
**Request**: Partial telemetry object (any subset of fields)  
**Response 200**: Updated full telemetry state

---

### 14.4 Ledger Endpoints

#### `GET /api/v1/ledger`

**Auth**: Any authenticated  
**Query params**: `?page=1&per_page=20&event_type=COMMAND_DISPATCHED`  
**Response 200**: Paginated ledger entries with total count

#### `GET /api/v1/ledger/verify`

**Auth**: ADMIN  
**Response 200 (valid)**:
```json
{ "valid": true, "entries_checked": 50, "verified_at": "2026-06-10T14:32:00Z" }
```
**Response 200 (tampered)**:
```json
{
  "valid": false,
  "entries_checked": 50,
  "corrupted_at_sequence": 42,
  "entry_id": "<uuid>",
  "verified_at": "2026-06-10T14:32:00Z"
}
```

---

### 14.5 Override Endpoints

#### `POST /api/v1/override/activate`

**Auth**: APPROVER, ADMIN

**Request**:
```json
{
  "justification": "Contact window closing — single-operator override authorized under Mission Rule 7.3"
}
```

**Response 200**:
```json
{
  "override_token": "<jwt>",
  "expires_at": "2026-06-10T14:42:00Z",
  "activated_by": "so_kim"
}
```

**Errors**: 400 `JUSTIFICATION_TOO_SHORT`, 409 `OVERRIDE_ALREADY_ACTIVE`

#### `GET /api/v1/override/status`

**Auth**: Any authenticated  
**Response 200**: `{ "active": true, "expires_at": "...", "activated_by": "so_kim" }` or `{ "active": false }`

---

### 14.6 WebSocket Protocol

**Endpoint**: `WS /ws/approvals?token=<access_token>`

**Connection auth**: Token is validated on connection. Invalid token → connection rejected with close code 4001.

**Client → Server messages**:
```json
{ "type": "PING" }                         // Keepalive
{ "type": "SUBSCRIBE", "role": "approver"} // Subscribe to role-specific events
```

**Server → Client messages**: See §6.9 for full message type list.

**Reconnection**: Client should reconnect with exponential backoff (1s, 2s, 4s, max 30s). Server maintains no state between connections.

---

### 14.7 Error Response Standard

All errors return HTTP 4xx/5xx with this body:
```json
{
  "error": {
    "code": "COMMAND_REPLAY_DETECTED",
    "message": "Duplicate command nonce detected — possible replay attack",
    "detail": { "nonce": "550e8400-...", "first_seen": "2026-06-10T14:24:00Z" },
    "timestamp": "2026-06-10T14:32:00Z"
  }
}
```

---

## §15 — Non-Functional Requirements

### 15.1 Performance Requirements

| Operation | Target (p95) | Measurement |
|---|---|---|
| Gemini AI scoring (live) | < 2000ms | From POST /commands received to score available |
| Gemini AI scoring (DEMO_MODE) | < 100ms | From POST /commands received to score available |
| Command pipeline (LOW, end-to-end) | < 2500ms | From submission to DISPATCHED status |
| WebSocket notification delivery | < 200ms | From status change to approver notification |
| Ledger integrity check (50 entries) | < 500ms | Full chain traversal |
| OBC round-trip (UDP) | < 500ms | Command dispatch to telemetry response |
| Login response | < 300ms | Auth endpoint including bcrypt verify |
| Dashboard initial load | < 1500ms | Full page including telemetry fetch |

### 15.2 Reliability & Availability

- **Demo environment target**: 100% uptime for the 4-day build period and demo window
- **Fallback coverage**: Every interactive feature has a defined fallback (see PRD §15.4)
- **DEMO_MODE**: Must be testable and verified before the demo — `make demo-verify` checks all fallbacks
- **Database**: PostgreSQL with connection pool — pool exhaustion logged as WARNING, not server crash
- **OBC timeout**: If OBC doesn't respond within 500ms, the command is marked DISPATCHED and the OBC timeout logged — the demo continues without stalling
- **Gemini timeout**: 10-second timeout on Gemini API calls. On timeout, if `DEMO_MODE=false`, returns 422. If `DEMO_MODE=true`, returns fixture silently.

### 15.3 Security Requirements

- All passwords stored as bcrypt hashes (cost 12) — never logged or returned in API responses
- JWT secrets must be minimum 32 characters — enforced at startup
- All SQL queries use parameterized statements — no string interpolation
- CORS restricted to `localhost:3000` and ngrok domain during MVP
- Rate limiting: 5 login attempts per minute per IP, 60 command submissions per minute per operator
- Approval tokens are single-use: once an approval is recorded for a `(command_id, approver_id)` pair, a second submission returns 409
- The ledger table has database-level UPDATE and DELETE rules blocking modifications
- Sensitive fields (password_hash, jwt_secret_key) must not appear in logs at any log level

### 15.4 Observability & Logging

**Log format**: Structured JSON to stdout:
```json
{
  "timestamp": "2026-06-10T14:32:00Z",
  "level": "INFO",
  "service": "scsp-backend",
  "event": "command_submitted",
  "command_id": "<uuid>",
  "operator_id": "<uuid>",
  "risk_tier": "HIGH",
  "duration_ms": 1240
}
```

**Mandatory log events**:
- `operator_login` (INFO) — username, role, IP
- `command_submitted` (INFO) — command_id, type, risk_score, risk_tier, duration_ms
- `command_dispatched` (INFO) — command_id, approver_ids
- `command_rejected` (INFO) — command_id, rejected_by, reason
- `replay_detected` (WARNING) — nonce, operator_id, command_type
- `sequence_anomaly` (WARNING) — rule_id, command_type, score_elevation
- `override_activated` (WARNING) — operator_id, expires_at
- `ledger_tamper_detected` (ERROR) — sequence, entry_id
- `gemini_timeout` (WARNING) — command_id, elapsed_ms
- `obc_timeout` (WARNING) — command_id, elapsed_ms

---

## §16 — Testing Requirements

### 16.1 Unit Test Coverage Requirements

**Minimum coverage per module**:

| Module | Min Coverage | Critical Test Cases |
|---|---|---|
| `ccsds_parser.py` | 95% | All 7 validation failures + valid parse |
| `ai_scorer.py` | 85% | DEMO_MODE fixture, tier derivation, JSON parse failure |
| `replay_detector.py` | 95% | Nonce duplicate, window eviction, all 5 sequence rules |
| `ledger_service.py` | 95% | Append, chain verify pass, chain verify fail at seq N |
| `auth_service.py` | 90% | Token creation, expiry, role enforcement, self-approval block |
| `auth_chain.py` | 90% | All state transitions, timeout escalation, quorum logic |

### 16.2 Integration Test Scenarios

**`test_command_pipeline.py`**:
```
TC-INT-001: LOW risk command — full pipeline — verify AUTO_APPROVED + ledger entry
TC-INT-002: HIGH risk command — verify PENDING_DUAL_APPROVAL + WS notification sent
TC-INT-003: Replay command — same nonce twice — verify second returns 409 REPLAY_DETECTED
TC-INT-004: Sequence anomaly — DISABLE_SAFE_MODE + THRUSTER_FIRE within 45s — verify score elevated
TC-INT-005: Override active — HIGH risk command — verify EMERGENCY_OVERRIDE + dispatched
TC-INT-006: CCSDS invalid packet — verify 400 INVALID_CCSDS_PACKET
TC-INT-007: Unknown APID — verify 400 UNKNOWN_APID
```

**`test_approval_flow.py`**:
```
TC-INT-010: MEDIUM command — single approval — verify DISPATCHED
TC-INT-011: HIGH command — first approval — verify still PENDING
TC-INT-012: HIGH command — second approval different approver — verify DISPATCHED + OBC dispatched
TC-INT-013: HIGH command — rejection — verify REJECTED + ledger entry
TC-INT-014: Self-approval attempt — verify 403 SELF_APPROVAL_FORBIDDEN
TC-INT-015: Approval on already-dispatched command — verify 409 COMMAND_ALREADY_RESOLVED
TC-INT-016: Ledger integrity — unmodified chain — verify pass
TC-INT-017: Ledger integrity — manually corrupted entry — verify fail at correct sequence
```

### 16.3 Demo Verification Checklist

Run `make demo-verify` which executes all checks and prints pass/fail:

```
[ ] Postgres connection — OK
[ ] All 6 operators seeded — OK
[ ] 50 ledger entries present — OK
[ ] 1 command in PENDING_DUAL_APPROVAL — OK
[ ] DEMO_MODE fixtures valid JSON — OK
[ ] OBC responding to REQUEST_TELEMETRY — OK
[ ] WS endpoint accepting connection — OK
[ ] Gemini scoring live (or DEMO_MODE active) — OK
[ ] Integrity check passes on unmodified ledger — OK
[ ] Tamper entry 42 demo function available — OK
[ ] ngrok URL accessible — OK
```

### 16.4 Test Fixture Specifications

All integration tests use a separate `scsp_test` database (configured via `TEST_DATABASE_URL` env var). Fixtures are applied before each test class and rolled back after:

```python
@pytest.fixture(autouse=True)
async def test_db(db_pool):
    async with db_pool.acquire() as conn:
        await conn.execute("BEGIN")
        yield conn
        await conn.execute("ROLLBACK")
```

DEMO_MODE is always `true` in test environment to avoid Gemini API calls.

---

## §17 — Local Development Setup

### 17.1 Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | `pyenv install 3.11` |
| Node.js | 20+ | `nvm install 20` |
| PostgreSQL | 15+ | `brew install postgresql@15` |
| ngrok | v3 | https://ngrok.com/download |
| git | any | — |

### 17.2 First-Time Setup

```bash
# 1. Clone and enter project
git clone <repo_url> scsp && cd scsp

# 2. Backend setup
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GEMINI_API_KEY and JWT_SECRET_KEY

# 3. Database setup
createdb scsp_db
createdb scsp_test
psql scsp_db < migrations/001_initial_schema.sql
psql scsp_test < migrations/001_initial_schema.sql

# 4. Seed demo data
python scripts/seed_demo.py

# 5. Frontend setup
cd ../frontend
npm install
cp .env.local.example .env.local

# 6. Verify setup
cd ../backend && make demo-verify
```

### 17.3 Makefile Commands

```makefile
# Backend
run-backend:
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
run-frontend:
	cd frontend && npm run dev

# OBC Simulator
run-obc:
	cd obc && python obc_simulator.py

# Database
db-reset:
	psql scsp_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	psql scsp_db < backend/migrations/001_initial_schema.sql

# Demo
demo-seed:
	cd backend && python scripts/seed_demo.py

demo-reset:
	cd backend && python scripts/reset_demo.py

demo-verify:
	cd backend && python scripts/verify_demo_state.py

# Testing
test-unit:
	cd backend && pytest tests/unit -v --cov=app --cov-report=term-missing

test-integration:
	cd backend && pytest tests/integration -v

test-all:
	cd backend && pytest tests/ -v --cov=app

# ngrok
tunnel:
	ngrok http 3000

# Run everything
dev:
	make run-backend & make run-frontend & make run-obc
```

### 17.4 Demo Environment Runbook

```
T-30 min: make demo-reset          — clean slate
T-30 min: make demo-seed           — populate demo data
T-25 min: make demo-verify         — confirm all checks pass
T-20 min: make dev                 — start all services
T-15 min: make tunnel              — start ngrok, copy URL
T-10 min: Open operator dashboard on presenter laptop
T-10 min: Open approver panel on second device (judge phone or second laptop)
T-05 min: Rehearse Demo Moment 1 (telemetry score shift) once end-to-end
T-05 min: Confirm Demo Moment 2 (ledger tamper) works
T-00:     Demo starts — operator dashboard on screen
          QR code for ngrok URL visible on secondary monitor
          Approver panel open on judge device

If Gemini API fails during demo:
  → Open new terminal: export DEMO_MODE=true && make run-backend
  → Frontend will automatically start receiving fixture scores

If WebSocket drops during demo:
  → Approver panel switches to 3-second polling automatically
  → No visible failure — slight delay in notification only

If OBC fails during demo:
  → Telemetry panel holds last known state
  → Commands still score and approve normally
  → Narrate: "In production this would connect to real downlink telemetry"
```

---

## §18 — Phase 2 & Roadmap Technical Specifications

### 18.1 Behavioral Drift Detection `[PHASE_2]`

**File**: `backend/app/services/drift_detector.py`

**Baseline model** (per operator, computed from historical command data):
```python
class OperatorBaseline(BaseModel):
    operator_id: UUID
    mean_commands_per_session: float
    std_commands_per_session: float
    subsystem_distribution: dict[str, float]   # {"EPS": 0.3, "TM": 0.5, ...}
    typical_hour_start: int                     # 0–23
    typical_hour_window: int                    # ± hours
    mean_session_duration_min: float
    std_session_duration_min: float
    computed_at: str
```

**Drift detection**: Z-score calculation per session metric vs baseline. Threshold: Z > 2.5 triggers `BEHAVIORAL_DRIFT` alert. Alert is non-blocking — it adds +10 to the AI risk score for all commands in the flagged session.

**Seeding requirement**: Minimum 20 sessions per operator for baseline to be statistically meaningful. `seed_history.py` generates 30 sessions per operator for Phase 2.

---

### 18.2 Constellation-Level Threat Correlation `[ROADMAP]`

**Architecture**:
- Redis pub/sub channel: `scsp:constellation:alerts`
- Each SCSP instance (one per satellite) publishes HIGH-risk events to the channel
- All instances subscribe and elevate their minimum approval tier on HIGH event from any peer
- Multi-satellite dashboard shows SAT_ALPHA, SAT_BETA, SAT_GAMMA panels in parallel

**Event schema**:
```json
{
  "source_satellite": "SAT_ALPHA",
  "event_type": "HIGH_RISK_COMMAND_DETECTED",
  "command_type": "DISABLE_SAFE_MODE",
  "risk_score": 87,
  "timestamp": "2026-06-10T14:32:00Z",
  "elevation_window_minutes": 30
}
```

**Dependency**: Redis 7. Add to `requirements.txt`: `redis[asyncio]>=5.0`.

---

### 18.3 Docker Containerization `[PHASE_2]`

**`docker-compose.yml`** (target structure):
```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://scsp:scsp@db:5432/scsp_db
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on: [db]

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: scsp
      POSTGRES_PASSWORD: scsp
      POSTGRES_DB: scsp_db
    volumes: ["pgdata:/var/lib/postgresql/data"]

  obc:
    build: ./obc
    ports: ["9000:9000/udp"]

volumes:
  pgdata:
```

---

### 18.4 Quantum-Resistant Signing `[ROADMAP]`

**Target algorithm**: CRYSTALS-Dilithium (NIST PQC standard, FIPS 204)  
**Library**: `pqcrypto` or `liboqs` Python bindings  
**Scope**: Replace Ed25519 approval token signing with Dilithium-3  
**Trigger**: When NIST finalizes FIPS 204 and a stable Python binding is available for production use  
**No changes** to SHA-256 hash chain — SHA-256 is quantum-resistant for 256-bit security level

---

*End of Technical Requirements Document — Satellite Command Security Platform v1.0.0*
*This document, combined with PRD_SatelliteCommandSecurity.md, provides complete specification for MVP development.*
