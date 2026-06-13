# Contributing to SCSP

Thank you for your interest in contributing to the Satellite C2 Security Middleware Platform.

---

## Development Setup

See [README.md](./README.md) for full setup instructions. Ensure `make demo-verify` (or `.\tasks.ps1 demo-verify` on Windows) passes before submitting any PR.

---

## Commit Format

All commits must follow this format:

```
type(scope): description
```

**Types**: `feat` `fix` `test` `refactor` `docs` `chore`  
**Scope**: task ID if applicable (e.g. `T-007`) or module name (e.g. `ledger`, `auth`, `frontend`)

**Examples:**
```
feat(T-012): implement Gemini AI scoring engine with DEMO_MODE bypass
fix(ledger): correct hash serialization for UUID fields
test(T-009): add CCSDS parser tests for all 15 command types
docs(readme): add Quick Start section for Windows setup
chore(deps): bump fastapi to 0.111.1
```

One commit per completed task or logical change. Do not bundle unrelated changes.

---

## Branch Naming

```
feature/T-NNN-short-description
fix/T-NNN-short-description
docs/topic-name
chore/task-name
```

All branches should target `main` via pull request.

---

## Pull Request Requirements

Before opening a PR:

- [ ] All unit tests pass (`pytest tests/unit/ -v`)
- [ ] All integration tests pass (`pytest tests/integration/ -v`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit` in `frontend/`)
- [ ] No new `# TODO: CLARIFY` comments left unresolved
- [ ] `make demo-verify` (or `.\tasks.ps1 demo-verify`) all 11 checks pass
- [ ] PR description references the task ID and acceptance criteria

---

## Code Standards

### Backend (Python)

- All imports within `backend/app` must be absolute: `from app.services.x import y`
- All database queries must use asyncpg parameterized statements (`$1`, `$2`) — no string interpolation in SQL
- All errors must use the standard error format from `.claude/rules/errors.md`
- No stack traces or internal state in error responses to clients
- bcrypt cost factor: 12 (from settings, never hardcoded)

### Frontend (TypeScript/React)

- All API calls go through `frontend/lib/api.ts` — no direct fetch calls in components
- All types must come from `frontend/lib/types.ts`
- Tailwind only — no inline styles, no external CSS libraries
- No `any` types — use the models defined in `types.ts`

### Security Rules

- Ledger table is append-only — never attempt UPDATE or DELETE on the ledger
- Self-approval is forbidden — enforced server-side, never rely on client-side prevention only
- Risk tier must always be derived from the score using env thresholds — never trust model tier output
- DEMO_MODE=true must never reach the Gemini API

---

## Architecture Constraints

- **No changes to satellite firmware or OBC protocol** — all logic runs on the ground segment
- **No changes to upstream C2 system APIs** — SCSP is a transparent proxy
- **Phase tags must be respected** — `[PHASE_2]` features must be stubbed, not implemented
- Build tasks in order from `docs/AGENT_INSTRUCTIONS.md` — do not skip ahead

---

## Reporting Issues

Use GitHub Issues with the appropriate template:
- **Bug report** — unexpected behavior, error messages, test failures
- **Feature request** — new capabilities, improvements to existing features

For security vulnerabilities, see [SECURITY.md](./SECURITY.md).

---

## License

By contributing to SCSP, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
