# SCSP — Satellite Command Security Platform

Ground-station security middleware that adds semantic AI risk scoring, tiered
multi-party authorization, and tamper-evident audit logging to satellite command
and control systems.

**Category**: Space & Aerospace — Ground Segment Security  
**Build target**: MVP in 4 days  
**Status**: Pre-development

---

## Quick Start

```bash
# 1. Clone
git clone <repo_url> scsp && cd scsp

# 2. Backend setup
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# → Edit .env: set GEMINI_API_KEY and JWT_SECRET_KEY

# 3. Database setup
createdb scsp_db && createdb scsp_test
psql scsp_db < migrations/001_initial_schema.sql
psql scsp_test < migrations/001_initial_schema.sql

# 4. Seed demo data
python scripts/seed_demo.py

# 5. Frontend setup
cd ../frontend
cp package.json package.json  # already pinned
npm install
cp .env.local.example .env.local

# 6. Verify everything
cd ../backend && make demo-verify
```

---

## Run in Development

```bash
# Start all services (3 separate terminals or use make dev)
make dev         # starts backend + frontend + OBC simultaneously

# Or individually:
make run-backend    # FastAPI on :8000
make run-frontend   # Next.js on :3000
make run-obc        # Mock OBC UDP on :9000

# Demo tunnel
make tunnel         # ngrok on :3000 → public HTTPS URL
```

---

## Environment Variables

**Backend** (`.env`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | Min 32 chars, random string |
| `GEMINI_API_KEY` | If DEMO_MODE=false | Gemini API key (gemini-2.5-flash / gemini-2.5-flash-lite) |
| `DEMO_MODE` | No (default: false) | Skip Gemini, use fixtures |
| `OBC_HOST` | No (default: 127.0.0.1) | Mock OBC host |
| `OBC_PORT` | No (default: 9000) | Mock OBC UDP port |

Full variable list: see `.env.example`

**Frontend** (`.env.local`):

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | Yes | Backend WebSocket URL |

---

## Make Commands

```bash
make dev            # Start backend + frontend + OBC
make run-backend    # FastAPI only
make run-frontend   # Next.js only
make run-obc        # Mock OBC only
make tunnel         # ngrok tunnel

make demo-seed      # Seed demo data (non-destructive)
make demo-reset     # Truncate all data + re-seed
make demo-verify    # Run all 11 demo checks (exit 1 if any fail)

make test-unit      # Run unit tests with coverage
make test-integration # Run integration tests
make test-all       # Run all tests

make db-reset       # Drop + recreate schema (dev only)
```

---

## Project Structure

```
scsp/
├── backend/           ← FastAPI application (Python 3.11)
│   ├── app/           ← Application code
│   ├── migrations/    ← SQL migration files
│   ├── scripts/       ← Seed and utility scripts
│   ├── tests/         ← Unit and integration tests
│   └── fixtures/      ← Demo mode AI response fixtures
├── frontend/          ← Next.js 14 application
│   ├── app/           ← Pages (App Router)
│   ├── components/    ← React components
│   ├── hooks/         ← Custom React hooks
│   └── lib/           ← API client and TypeScript types
├── obc/               ← Mock satellite OBC (Python UDP)
└── Makefile
```

---

## Test Credentials (demo)

| Username | Password | Role |
|---|---|---|
| `op_chen` | `operator123` | Operator |
| `op_martinez` | `operator123` | Operator |
| `op_patel` | `operator123` | Operator |
| `so_kim` | `approver123` | Safety Officer (Approver) |
| `so_okonkwo` | `approver123` | Safety Officer (Approver) |
| `admin_root` | `admin123` | Admin |

---

## Key Documents

| Document | Purpose |
|---|---|
| `docs/PRD_SatelliteCommandSecurity.md` | Product requirements — what & why |
| `docs/TRD_SatelliteCommandSecurity.md` | Technical requirements — how to build |
| `docs/AGENT_INSTRUCTIONS.md` | **Start here for coding** — ordered task list |
| `docs/WIREFRAMES.md` | UI layout and component specs |
| `docs/COMPONENT_STATE_SPEC.md` | TypeScript interfaces and state shapes |
| `docs/SEED_DATA_SPEC.json` | Synthetic data values for seed scripts |
| `docs/ccsds_packets.json` | CCSDS packet fixtures for parser tests |
| `docs/PROMPT_REGRESSION_TESTS.md` | Gemini prompt test cases |
| `docs/CONTRIBUTING.md` | Git branching and commit conventions |

---

## Architecture Overview

```
Operator Browser  →  Next.js (:3000)  →  FastAPI (:8000)  →  PostgreSQL (:5432)
                                              ↓                      ↓
                                         Gemini API           Hash-Chain Ledger
                                              ↓
                                       Mock OBC (:9000/UDP)
```

SCSP sits between existing C2 software and the satellite uplink as a security proxy.
No changes to satellite firmware or on-board software required.

---

## The Three Novelty Claims

1. **Semantic + telemetry-aware AI risk scoring** — same command, different score based on satellite's live state
2. **Tiered multi-party authorization** — AI score determines required approval level
3. **Hash-chained tamper-evident ledger** — any historical modification is cryptographically detectable

---

## Research Foundation

- Willbold et al., IEEE S&P 2023 — vulnerabilities in real satellite firmware
- Shelby, Oxford 2025 — CubeSat security gaps and Security-per-Watt
- Pavur & Martinovic — satellite attack surface taxonomy
- MDPI Aerospace 2025 — comprehensive space cyber threat review
- Salim et al., IEEE 2025 — satellite communications cybersecurity survey
