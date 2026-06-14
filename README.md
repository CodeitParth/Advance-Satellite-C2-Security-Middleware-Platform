# Satellite C2 Security Middleware Platform

> **AI-powered semantic risk scoring, tiered multi-party authorization, and tamper-evident audit logging for satellite ground-station command & control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com/)

---

## What It Is

SCSP is a **ground-station security middleware** that intercepts every command between a satellite operator and the uplink. It adds:

- **Semantic AI risk scoring** using Google Gemini 2.5 Flash — commands are scored 0–100 in the context of live satellite telemetry, not just syntax
- **Tiered multi-party authorization** — LOW risk auto-approves; MEDIUM requires one approver; HIGH requires dual approver quorum, all enforced before any transmission
- **Hash-chained tamper-evident ledger** — every command, approval, rejection, and override is SHA-256 chained; tampering is detectable in one click
- **Replay and sequence attack detection** — nonce-based replay prevention plus 5 behavioral sequence anomaly rules mapped to MITRE ATT&CK

SCSP does **not** replace existing C2 systems (OpenC3 COSMOS, Lockheed Compass, ATLAS GSaaS). It sits in front of them as a transparent security proxy. Zero changes to satellite firmware.

---

## The Problem

Every satellite ground control system today treats security as binary: if an operator is authenticated, their command executes. No existing system asks: _"Should this command execute right now, given the satellite's current state and the known threat landscape?"_

This gap is documented by:

- **Viasat AcidRain (2022)** — 40,000+ satellite modems disabled via ground-segment exploit; the satellite hardware was never touched
- **CISA Advisory (2023)** — _"An encrypted link doesn't help once an attacker uses legitimate command infrastructure"_
- **Willbold et al. IEEE S&P 2023** — 100% of analyzed satellites had security-critical vulnerabilities; unprotected telecommand interfaces in every system

---

## Screenshots

### Operator — Submitting Commands

**High-risk command flagged in real time** — AI score 85 (HIGH), battery at 8%, orbital phase ECLIPSE, behavioral drift sequence alert triggered. Requires dual approver quorum before dispatch.

![Operator sending risky command](screenshots/operator-sending-risky-command.png)

**Safe command auto-approved** — Same command type (DISABLE_SAFE_MODE) scores 0 (LOW) when battery is healthy (77.9%) and the satellite is SUNLIT. Context-aware scoring, not keyword matching.

![Operator safe command 0 risk](screenshots/Operator-safe-command-0-risk-allowed.png)

---

### Operator — My Commands Dashboard

Operator's command history showing dispatched, rejected, and security events. The **Security tab** surfaces replay blocks and anomaly detections inline.

![Operator my commands rejected](screenshots/Operator-my-commands-rejected.png)

**Dispatched command** — event detail pane shows the `approved_by` array from the ledger, confirming which approvers signed off.

![Operator command dispatched](screenshots/operator-command-dispatched.png)

---

### Approver — Multi-Party Authorization Queue

**Approval queue** — live WebSocket feed of pending HIGH-risk commands. Risk score, subsystem, submitter, and time-to-timeout visible at a glance. "Dual approval required" enforced in UI and server-side.

![Approver risk assessment](screenshots/Approver-Risk-assesment.png)

**Telemetry snapshot** — approvers see the exact satellite state captured at scoring time (8% battery, ECLIPSE, NOMINAL thermal) — not current telemetry — so they evaluate the same context the AI used.

![Approver telemetry snapshot](screenshots/approver-telemetry.png)

**First approval received** — banner confirms approval 1 of 2 is recorded; command stays PENDING_DUAL_APPROVAL until a second independent approver acts.

![Approver post allow scene](screenshots/appover-post-allow-scene.png)

**Full Detail Review modal** — approvers can expand to see the complete AI justification, approval chain history with timestamps, and live execution sequence.

![Approver full details](screenshots/approver-full-details.png)

---

### Admin — Risk Assessment & Rejection Review

**Admin full-detail view** — shows DISABLE_SAFE_MODE rejected by so_kim with justification, full telemetry at scoring time, and the approval chain with APPROVED/REJECTED badges per participant.

![Admin full details rejection](screenshots/admin-full-details-rejection.png)

**Admin risk assessment view** — telemetry-snapshot tab shows satellite state locked in at scoring time, used for the AI context window.

![Admin risk assessment](screenshots/admin-risk-assesment.png)

---

### Admin — Audit Ledger

**Audit ledger** — every event (COMMAND_SUBMITTED, COMMAND_DISPATCHED, COMMAND_REJECTED, REPLAY_BLOCKED, OVERRIDE_ACTIVATED) is appended as a SHA-256 hash-chained entry. Click any row to inspect its `event_detail` JSON. One-click integrity verification.

![Admin audit ledger](screenshots/admin-audit-ledger.png)

**Ledger verified** — 323 entries checked; hash chain is intact. "VERIFIED" badge shown in green.

![Admin audit ledger verified](screenshots/admin-audit-ledger-verified.png)

**Tamper detection** — after injecting a modified entry via the demo tamper button, "Verify Chain Integrity" detects the break at sequence 11 and highlights the corrupted row in red.

![Tamper detection failed](screenshots/tampered%20detection%20entr-ledger-compromised-integrity-check-failed.png)

---

### Replay Attack Detection

**Before attack** — Security tab shows 5 blocked events (timeouts) but no replay entries yet.

![Before replay attack](screenshots/before-replay-attack.png)

**Replay demo in PowerShell** — first submission with nonce `11111111-1111-4111-8111-111111111111` succeeds (AUTO_APPROVED, LOW, score=0). Second submission with the same nonce is immediately rejected: `REPLAY_DETECTED — Duplicate nonce — possible replay attack`.

![Attempt replay attack](screenshots/attempt-replay-attack.png)

**After attack** — Security tab now shows `Replay Blocked` entries for the attempted replays, each linked to the original command in the ledger.

![After replay attack](screenshots/after-replay-attack.png)

---

### User Profile & Security Settings

Per-operator profile showing role scope, authorized satellites, active session, bcrypt/JWT security indicators, and TOTP two-factor authentication setup.

![User profile settings page](screenshots/user-profile-settings-page.png)

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15
- Google Gemini API key (or set `DEMO_MODE=true` to use fixtures)

### Setup

```powershell
# 1. Clone the repo
git clone https://github.com/griffin-dox/Satellite-C2-Security-Middleware-Platform.git
cd Satellite-C2-Security-Middleware-Platform

# 2. Backend setup
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
cp .env.example .env          # Fill in DATABASE_URL and JWT_SECRET_KEY

# 3. Database setup
psql -U postgres -c "CREATE USER scsp WITH PASSWORD 'scsp_dev';"
psql -U postgres -c "CREATE DATABASE scsp_db OWNER scsp;"
psql -U postgres -c "CREATE DATABASE scsp_test OWNER scsp;"
psql -U scsp -d scsp_db -f migrations/001_initial_schema.sql

# 4. Seed demo data
python scripts/seed_demo.py

# 5. Frontend setup
cd ../frontend
npm install
cp .env.local.example .env.local

# 6. Start everything (from project root)
.\tasks.ps1 dev              # Windows PowerShell
# make dev                   # Linux/Mac
```

Backend runs on `:8000` · Frontend on `:3000` · Mock OBC on `:9000`

### Demo Mode (no Gemini API key needed)

```powershell
# In backend/.env
DEMO_MODE=true
```

Demo mode uses fixture scores from `backend/fixtures/demo_scores.json`. Full feature set works including all approval flows, ledger, and replay detection.

---

## Commands Reference

### Start All Services

```powershell
# Windows (PowerShell)
.\tasks.ps1 dev

# Linux/Mac
make dev
```

Starts backend (:8000), frontend (:3000), and mock OBC simulator (:9000) concurrently.

### Database Migration

```powershell
# Apply schema (idempotent — safe to re-run)
psql -U scsp -d scsp_db -f backend/migrations/001_initial_schema.sql

# Apply to test database
psql -U scsp -d scsp_test -f backend/migrations/001_initial_schema.sql
```

### Seed Demo Data

```powershell
# Populate operators, commands, ledger entries
cd backend
python scripts/seed_demo.py

# Or via task runner
.\tasks.ps1 demo-reset       # Windows
make demo-reset              # Linux/Mac
```

### Verify Demo Readiness

```powershell
# Run all 11 demo checks — all must pass before a live demo
.\tasks.ps1 demo-verify      # Windows
make demo-verify             # Linux/Mac
```

### Run Tests

```powershell
cd backend

# Unit tests only (no DB required)
pytest tests/unit/ -v

# Integration tests (requires scsp_test database)
pytest tests/integration/ -v

# All tests with coverage report
pytest --cov=app tests/

# Via task runner
.\tasks.ps1 test-unit        # Windows
make test-unit               # Linux/Mac
```

### Remote Demo via ngrok

```powershell
# Expose frontend to the internet for remote demos
.\tasks.ps1 tunnel           # Windows
make tunnel                  # Linux/Mac

# Or directly:
ngrok http 3000
```

### Replay Attack Demo (PowerShell)

```powershell
# 1. Login as operator
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"op_chen","password":"operator123"}'

$headers = @{ Authorization = "Bearer $($login.access_token)" }

$body = @{
  packet_hex = "1900C0000000012A4B"
  nonce      = "11111111-1111-4111-8111-111111111111"
} | ConvertTo-Json

# 2. First submission — succeeds
$r1 = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/commands" `
  -Headers $headers -ContentType "application/json" -Body $body

Write-Host "First:  status=$($r1.status)  tier=$($r1.risk_tier)  score=$($r1.risk_score)"

# 3. Same nonce again — REPLAY_DETECTED (409)
try {
  Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/commands" `
    -Headers $headers -ContentType "application/json" -Body $body
} catch {
  $err = $_.ErrorDetails.Message | ConvertFrom-Json
  Write-Host "Second: $($err.error.code) — $($err.error.message)"
}
```

Expected output:
```
First:  status=AUTO_APPROVED  tier=LOW  score=0
Second: REPLAY_DETECTED — Duplicate nonce — possible replay attack
```

### Tamper Detection Demo

```powershell
# 1. Login as admin
$login = Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body '{"username":"admin_root","password":"admin123"}'

$headers = @{ Authorization = "Bearer $($login.access_token)" }

# 2. Inject a tampered ledger entry (development only)
Invoke-RestMethod -Method Put -Uri "http://localhost:8000/api/v1/ledger/demo-tamper" `
  -Headers $headers

# 3. Verify — will report TAMPERED with the corrupted sequence number
Invoke-RestMethod -Method Get -Uri "http://localhost:8000/api/v1/ledger/verify" `
  -Headers $headers
```

Then click **Verify Chain Integrity** in the Admin Audit Ledger to see the corrupted entry highlighted in the UI.

### Interactive API Docs

```
http://localhost:8000/docs       # Swagger UI
http://localhost:8000/redoc      # ReDoc
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Operator)  Browser (Approver)  Browser (Admin)    │
└──────────────────┬───────────────────────────┬──────────────┘
                   │ REST + WebSocket           │
                   ▼                            ▼
┌──────────────────────────────────────────────────────────────┐
│               Next.js 14 Frontend (:3000)                     │
│    Operator Dashboard │ Approver Queue │ Admin Ledger         │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST + WebSocket
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                FastAPI Backend (:8000)                        │
│  CCSDS Parser → Replay Detector → AI Scorer → Auth Chain     │
│  Hash-Chain Ledger → WS Manager → OBC Client → Override      │
└────────┬──────────────────┬──────────────────┬──────────────┘
         │ asyncpg          │ Gemini API        │ UDP
         ▼                  ▼                   ▼
    PostgreSQL 15     Gemini 2.5 Flash     Mock OBC (:9000)
```

### Command Pipeline

```
POST /api/v1/commands
  → JWT Auth → CCSDS Parse → Replay Check → Sequence Anomaly
  → Telemetry Context → Gemini Score → Score Elevation
  → Risk Tier (LOW/MEDIUM/HIGH) → Authorization State Machine
      LOW:    Auto-approve → Ledger → UDP → OBC
      MEDIUM: Ledger(PENDING) → WS push → await 1 approval
      HIGH:   Ledger(PENDING) → WS push × 2 → await quorum
  → On approval: Ledger(DISPATCHED) → UDP → OBC → Telemetry update
```

---

## Tech Stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Backend API      | Python 3.11, FastAPI 0.111                       |
| Database         | PostgreSQL 15, asyncpg                           |
| AI Scoring       | Google Gemini 2.5 Flash                          |
| Auth             | PyJWT (HS256), bcrypt (cost 12)                  |
| Cryptography     | SHA-256 hash chain, Ed25519 approval signing     |
| Frontend         | Next.js 14 App Router, React 18, Tailwind CSS    |
| 3D Visualization | React Three Fiber, Three.js                      |
| Real-time        | WebSocket (native FastAPI) + 3s polling fallback |
| Satellite Sim    | Python asyncio UDP server                        |

---

## Features

### Security Layers

1. **CCSDS Packet Validation** — 15 command types, CRC-16-CCITT (poly 0x1021), full header validation
2. **Replay Attack Detection** — Sliding nonce window (100 entries), FIFO eviction
3. **Sequence Anomaly Detection** — 5 behavioral rules (SEQ-001 to SEQ-005), MITRE ATT&CK mapped
4. **Telemetry-Aware AI Scoring** — Gemini 2.5 Flash scores every command 0–100 with battery, thermal, orbital context
5. **Tiered Multi-Party Authorization** — Risk-proportional approval chain with self-approval prevention
6. **Hash-Chain Tamper-Evident Ledger** — SHA-256 chained append-only audit log; Postgres RULE enforces at DB level

### User Roles

| Role     | Credentials               | Capabilities                                    |
| -------- | ------------------------- | ----------------------------------------------- |
| Operator | `op_chen` / `operator123` | Submit commands, view own ledger                |
| Approver | `so_kim` / `approver123`  | Approve/reject queue, activate override         |
| Admin    | `admin_root` / `admin123` | Full ledger, telemetry control, user management |

### Risk Tiers

| Tier   | Score  | Approval Required          | Timeout Escalation            |
| ------ | ------ | -------------------------- | ----------------------------- |
| LOW    | 0–30   | Auto-approved              | —                             |
| MEDIUM | 31–70  | 1 Safety Officer           | Escalates to dual after 5 min |
| HIGH   | 71–100 | 2 Safety Officers (quorum) | BLOCKED after 5 min           |

---

## API Reference

Full API contract: [.claude/rules/api.md](.claude/rules/api.md)

```
POST   /api/v1/auth/login           → LoginResponse
POST   /api/v1/auth/refresh         → {access_token}

POST   /api/v1/commands             → CommandSubmitResponse
GET    /api/v1/commands/pending     → PendingCommand[]
POST   /api/v1/commands/{id}/approve → ApprovalResult
POST   /api/v1/commands/{id}/reject  → {new_status}

GET    /api/v1/telemetry/current    → TelemetryState
GET    /api/v1/ledger               → LedgerPage (paginated)
GET    /api/v1/ledger/verify        → LedgerVerifyResult

POST   /api/v1/override/activate    → {token, expires_at}
WS     /ws/approvals?token=<jwt>    → WSMessage stream
```

Interactive API docs available at `http://localhost:8000/docs` when running.

---

## Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://scsp:scsp_dev@localhost:5432/scsp_db
JWT_SECRET_KEY=<min-32-chars-random>
GEMINI_API_KEY=<key>          # not required when DEMO_MODE=true
DEMO_MODE=false
APP_ENV=development

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory
│   │   ├── config.py                # Pydantic settings
│   │   ├── models/                  # Pydantic request/response models
│   │   ├── routers/                 # API route handlers
│   │   ├── services/                # Business logic
│   │   └── middleware/              # Auth + error handling
│   ├── migrations/001_initial_schema.sql
│   ├── fixtures/demo_scores.json    # DEMO_MODE fixture responses
│   ├── scripts/                     # Seed + demo scripts
│   └── tests/unit/ tests/integration/
├── frontend/
│   ├── app/                         # Next.js App Router pages
│   ├── components/                  # React components
│   ├── hooks/                       # useAuth, useTelemetry, useApprovalWebSocket
│   └── lib/                         # api.ts, types.ts
├── obc/
│   └── obc_simulator.py             # Mock satellite UDP server
├── docs/                            # PRD, TRD, wireframes, specs
├── screenshots/                     # UI screenshots for documentation
└── tasks.ps1                        # PowerShell task runner (Windows)
```

---

## Research Foundation

SCSP is grounded in five peer-reviewed papers establishing the gap it fills:

1. Willbold et al. — _Space Odyssey_ (IEEE S&P 2023, Distinguished Paper)
2. Shelby — _CubeSat Cybersecurity Risk Assessment_ (Oxford, arXiv:2604.00303, 2025)
3. Pavur & Martinovic — _SoK: Satellite Cyber-Security_ (IEEE S4 2020)
4. _Cyber Attacks on Space Information Networks_ (MDPI Aerospace 2025)
5. Salim, Moustafa & Reisslein — _Cybersecurity of Satellite Comms_ (IEEE Surveys 2025)

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, branch conventions, and commit format.

---

## Security

See [SECURITY.md](./SECURITY.md) for how to report vulnerabilities.

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Disclaimer

This is a research and demonstration platform. It is not certified for use in actual satellite operations. All satellite command interfaces in this repository connect to a local mock OBC simulator only.
