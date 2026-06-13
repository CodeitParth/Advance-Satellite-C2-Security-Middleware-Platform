# SCSP — Production Hardening Guide (Phase 3)

Status of PRD §17.2 items. ✅ implemented in this repo · 📋 documented here for
deployment-time execution (environment-dependent, not buildable locally).

## Implemented in this repo ✅

| Item | Where |
|---|---|
| Global per-IP rate limiting (sliding window) | `backend/app/middleware/rate_limiter.py` — 120 req/min general, 60/min command submissions, 5/min login |
| Security headers (CSP, HSTS, nosniff, frame-deny) | `backend/app/middleware/security_headers.py` |
| Containerization (Compose: backend/frontend/obc/postgres/redis) | `docker-compose.yml` + per-service Dockerfiles, non-root users, healthchecks |
| Append-only audit ledger (SHA-256 hash chain + Postgres rules) | `backend/app/services/ledger_service.py`, migration 001 |
| bcrypt cost-12 password hashing, timing-safe login | `backend/app/services/auth_service.py` |
| Self-approval + admin self-lockout prevention | `routers/commands.py`, `routers/admin.py` |
| Replay detection (nonce window) + dangerous-sequence rules | `services/replay_detector.py` |
| Behavioral drift detection (F-10) | `services/drift_detector.py` |
| Constellation threat correlation (F-11, Redis or simulated) | `services/constellation.py` |
| Compliance export with integrity certificate (F-14) | `routers/reports.py` |
| Production: interactive docs disabled, JSON logging | `app/main.py`, `utils/logging_utils.py` |

## Deployment-time items 📋

### JWT: HS256 → RS256
Generate an RSA keypair (`openssl genrsa -out jwt_rsa 4096`), set
`JWT_ALGORITHM=RS256`, sign with the private key, verify with the public key.
Only the auth service needs the private key; other replicas verify with the
public key. The frontend never verifies signatures (it only decodes claims),
so no client change is required. Key rotation: publish a JWKS endpoint and
include `kid` in token headers.

### Secrets management
Local dev uses `.env` (gitignored). For deployment, move `JWT_SECRET_KEY` /
`GEMINI_API_KEY` / `DATABASE_URL` into HashiCorp Vault (KV v2 + agent
injection) or AWS Secrets Manager (ECS task secrets). Never bake secrets into
images; the provided Dockerfiles take them only via environment.

### Kubernetes (outline)
- One Deployment per service (backend ×2 replicas, frontend, obc), `redis` +
  `postgres` as managed services (ElastiCache / RDS) rather than in-cluster.
- Backend: liveness `GET /health`, readiness `GET /ready`, resources
  `250m/512Mi`, `automountServiceAccountToken: false`.
- NetworkPolicy: frontend→backend:8000 only; backend→db,redis,obc only.
- Ingress: TLS terminate (cert-manager), sticky-less — WS upgrades for
  `/ws/approvals` need `proxy-read-timeout ≥ 3600`.
- Secrets via ExternalSecrets → Vault/ASM.

### mTLS between components
Service mesh (Linkerd is the lighter fit) for backend↔obc/redis/db traffic;
alternatively raw sidecar-less mTLS with SPIFFE/SPIRE identities. The OBC UDP
link cannot carry TLS — wrap it in WireGuard between pods/hosts or move
dispatch to a TCP channel before production.

### HSM for approval signing
Approval decisions are Ed25519-signed (`services/signing_service.py`).
Production: move the signing keys into an HSM/KMS (AWS KMS asymmetric or
CloudHSM) and sign via API so private keys never leave the module.

**Post-quantum (F-15) — implemented in software**: set
`APPROVAL_SIGNING_ALGORITHM=ml-dsa-65` to sign decisions with ML-DSA-65
(FIPS 204, via dilithium-py). Verification auto-detects the algorithm by
signature length, so mixed-era records keep verifying after a switch.
The pure-Python implementation is demo-grade (~100 ms/signature); production
should use an HSM with native ML-DSA. The SHA-256 hash chain needs no change.

### OWASP API Security Top-10 checklist
| Risk | Mitigation status |
|---|---|
| API1 Broken object-level auth | ✅ role checks per route; commands scoped by submitter; verify per-object checks when adding new GET-by-id routes |
| API2 Broken authentication | ✅ bcrypt-12, rate-limited login, 60-min JWT; 📋 add refresh-token rotation |
| API3 Object property exposure | ✅ Pydantic response models; never return password_hash |
| API4 Resource consumption | ✅ global + per-route rate limits; pagination capped at 100 |
| API5 Broken function-level auth | ✅ `require_role` on every admin/approver route |
| API6 Sensitive business flows | ✅ dual approval, self-approval block, override audit |
| API7 SSRF | ✅ no user-supplied URLs are fetched |
| API8 Misconfiguration | ✅ docs off in prod, CORS allowlist, security headers; 📋 TLS config at ingress |
| API9 Inventory | ✅ OpenAPI generated; keep `/docs` internal-only |
| API10 Unsafe 3rd-party APIs | ✅ Gemini responses validated by Pydantic; tier always recomputed server-side |

### Pen-test before launch
Scope: auth bypass on approval flow, ledger tamper attempts via API surface,
WS auth (token in query string — consider moving to subprotocol header),
rate-limit evasion via X-Forwarded-For spoofing (terminate at trusted proxy and
use its client IP), CCSDS parser fuzzing (hex input is the main untrusted surface).
