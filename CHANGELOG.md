# Changelog

All notable changes to the Satellite C2 Security Middleware Platform are documented here.

Format: `[Version] — YYYY-MM-DD`  
Commit convention: `type(scope): description` per [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## [Unreleased]

### Added
- Multi-satellite Orbital Operations Center (`/simulation/orbital`) — SAT_ALPHA, SAT_BRAVO, SAT_CHARLIE tabs; selected satellite drives all KPI panels and 3D canvas
- `PeerSatMesh` component — simplified satellite mesh for non-selected satellites with per-satellite orbit rings and colored labels
- `SAT_BRAVO_ORBIT` and `SAT_CHARLIE_ORBIT` constants in `frontend/lib/orbit.ts` (Walker constellation 120° RAAN spacing)
- Per-satellite localStorage layout persistence via `pageId={simulation-orbital-${selectedSat}}`
- Token auto-refresh in `useAuth.ts` — proactive refresh 5 minutes before JWT expiry, no more 401 floods on long sessions
- `isStoredTokenValid()` export in `frontend/lib/api.ts` — client-side JWT expiry check without server round-trip
- 401 auto-redirect to `/login` on `TOKEN_EXPIRED` / `TOKEN_INVALID` in `api.ts` `request()` — stops polling flood when token expires
- WS reconnect after 4001 close when proactive refresh has provided a fresh token

### Fixed
- `asyncpg.ForeignKeyViolationError` on `POST /commands` when JWT references an operator UUID not in DB (after demo-reset) — now returns `401 TOKEN_INVALID` instead of unhandled 500
- Fixed UUIDs in `backend/scripts/seed_operators.py` (`a0000001-…` through `a0000007-…`) — operator UUIDs now survive `demo-reset` cycles, preventing JWT invalidation

---

## [0.1.0 — MVP] — 2026-06-10

### Added — Backend

- **T-001** `feat(T-001)`: Initialize repository structure with all stub files
- **T-002** `feat(T-002)`: Environment configuration (.env.example, .env.local.example)
- **T-003** `feat(T-003)`: Pydantic Settings with GEMINI_API_KEY validation
- **T-004** `feat(T-004)`: asyncpg connection pool with get_db FastAPI dependency
- **T-005** `feat(T-005)`: PostgreSQL migration — full DDL including append-only ledger RULE
- **T-006** `feat(T-006)`: All Pydantic models (operator, command, telemetry, ledger, approval)
- **T-007** `feat(T-007)`: Auth service — bcrypt (cost 12), PyJWT HS256, RBAC dependency factory
- **T-008** `feat(T-008)`: Auth router — POST /login, POST /refresh, rate limiting (5/min/IP)
- **T-009** `feat(T-009)`: CCSDS parser — 15 command types, CRC-16-CCITT, 8-step validation
- **T-010** `feat(T-010)`: Telemetry state singleton with async lock and fire-and-forget persist
- **T-011** `feat(T-011)`: Replay detector — nonce sliding window + 5 sequence anomaly rules (SEQ-001–SEQ-005)
- **T-012** `feat(T-012)`: AI scoring engine — Gemini 2.5 Flash with DEMO_MODE fixture bypass
- **T-014** `feat(T-014)`: Authorization state machine — 11 status enum, timeout escalation, override integration
- **T-015** `feat(T-015)`: Hash-chain ledger — SHA-256 chain, GENESIS_HASH, verify_chain()
- **T-016** `feat(T-016)`: Mock satellite OBC UDP server (port 9000) — 8 command handlers, battery physics
- **T-017** `feat(T-017)`: Commands router — full 14-step pipeline, self-approval prevention, quorum logic
- **T-018** `feat(T-018)`: WebSocket manager — role-based broadcast, 30s heartbeat, 4001 auth close
- **T-019** `feat(T-019)`: Emergency override service — 10-min token, mandatory justification, ledger audit
- **T-020** `feat(T-020)`: Telemetry and ledger routers; global error handler with standard format
- **T-021** `feat(T-021)`: FastAPI app wiring — lifespan, CORS, all routers registered

### Added — Frontend

- **T-022** `feat(T-022)`: Next.js 14 scaffold — App Router, auth middleware, role-gated routes
- **T-023** `feat(T-023)`: TypeScript API client, types, useAuth, useTelemetry, useApprovalWebSocket
- **T-024** `feat(T-024)`: Login page with role-based redirect
- **T-025** `feat(T-025)`: TelemetryPanel with demo controls and battery/thermal color coding
- **T-026** `feat(T-026)`: CommandTerminal with subsystem/command dropdowns and CCSDS packet builder
- **T-027** `feat(T-027)`: RiskScoreCard with score gradient, tier badge, SPARTA chip, approval tracker
- **T-028** `feat(T-028)`: Operator dashboard assembly; AlertBanner; operator ledger page
- **T-029** `feat(T-029)`: ApprovalQueue, ApprovalModal; approver queue page with WebSocket updates
- **T-030** `feat(T-030)`: Emergency override panel with justification form and countdown timer
- **T-031** `feat(T-031)`: Admin ledger view; IntegrityChecker with tamper demo; ledger demo-tamper endpoint

### Added — Data & Scripts

- **T-032** `feat(T-032)`: Seed scripts — operators, 300 historical commands, telemetry snapshots, demo scenario
- **T-033** `feat(T-033)`: Demo verification script — 11-point checklist, exits 1 on any failure

### Security

- Postgres RULE enforces ledger append-only at database level — no API bypass possible
- Self-approval prevented by JWT `sub` vs `submitter_id` comparison server-side
- All SQL uses asyncpg parameterized queries — SQL injection impossible by construction
- Risk tier always derived from score thresholds from env config — AI model tier output is discarded
- Rate limiting on login: 5 attempts/60s/IP with monotonic clock

---

*This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.*
