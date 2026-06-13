# Security Policy

## Supported Versions

This project is in active development. Security fixes are applied to the `main` branch only.

| Version | Supported |
|---|---|
| main (latest) | Yes |
| older commits | No |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security vulnerability:

1. Go to the GitHub repository's **Security** tab
2. Click **"Report a vulnerability"** to open a private advisory
3. Provide as much detail as possible:
   - Description of the vulnerability and its potential impact
   - Steps to reproduce
   - Affected component (backend auth, ledger, command router, frontend, etc.)
   - Suggested mitigation if known

You can expect an acknowledgement within **48 hours** and a full response within **7 days**.

---

## Security Design Principles

SCSP is a security-focused platform. The following non-negotiable properties are enforced:

### Cryptography
| Component | Algorithm | Standard |
|---|---|---|
| Passwords | bcrypt (cost factor 12) | NIST SP 800-63b |
| JWTs | HMAC-SHA256 (HS256) | RFC 7519 |
| Approval signing | Ed25519 | RFC 8037 |
| Hash chain | SHA-256 | FIPS 180-4 |
| CCSDS CRC | CRC-16-CCITT (poly 0x1021, init 0xFFFF) | CCSDS standard |

### Database
- All queries use asyncpg parameterized statements — SQL injection is impossible by construction
- The `ledger` table has a Postgres RULE blocking all UPDATE and DELETE operations at the database level — tampering requires schema modification that is logged by Postgres audit

### Access Control
- Self-approval is enforced server-side by comparing JWT `sub` (operator UUID) to `submitter_id` — UI-bypassing this check is impossible
- Risk tier is always derived from score thresholds from environment config — the AI model's tier output is never trusted directly
- Token expiry: access tokens 60 min, approval tokens 5 min, override tokens 10 min

### Input Validation
- `packet_hex`: regex `^[0-9a-fA-F]+$`, even length, max 2048 chars
- `nonce`: UUID v4 format enforced, max 36 chars
- `justification`: stripped, max 1000 chars
- `override_justification`: min 20 chars, max 500 chars
- All Pydantic models validate at boundary — no internal data bypasses validation

### What SCSP Does Not Do
- Store passwords in plaintext or reversible format
- Return stack traces or internal error messages to clients
- Log passwords, JWT secrets, or API keys at any log level
- Allow UPDATE or DELETE on the ledger table via any API endpoint
- Transmit commands to the satellite without a completed authorization chain

---

## Known Limitations (Research Platform)

- This is a **research and demonstration platform**, not certified for production satellite operations
- The mock OBC (`obc/obc_simulator.py`) is a local simulator — no real satellite command transmission occurs
- `DEMO_MODE=true` bypasses Gemini AI with fixtures — for demonstration only
- The `PUT /api/v1/ledger/demo-tamper` endpoint (development mode only) directly modifies the ledger to demonstrate tamper detection — this endpoint is gated behind `APP_ENV=development` and `ADMIN` role

---

## Scope

The following are in scope for vulnerability reports:
- Authentication bypass or privilege escalation
- SQL injection or NoSQL injection
- JWT manipulation (algorithm confusion, secret disclosure)
- Cross-site scripting (XSS) or cross-site request forgery (CSRF) in the frontend
- Ledger append-only bypass (ability to UPDATE/DELETE ledger entries via API)
- Self-approval bypass (ability to approve your own command)
- Risk tier manipulation (ability to change tier without changing score threshold config)

The following are out of scope:
- Attacks requiring physical access to the machine running SCSP
- Attacks on the mock OBC simulator (it is not a real satellite interface)
- Denial-of-service attacks
- Social engineering
