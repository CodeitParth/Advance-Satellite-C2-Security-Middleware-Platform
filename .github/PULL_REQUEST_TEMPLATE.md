# Pull Request

## Task Reference

Closes: T-NNN
Related: (issue number if applicable)

## Change Type

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `test` — tests only
- [ ] `refactor` — no behavior change
- [ ] `docs` — documentation only
- [ ] `chore` — dependency or tooling

## Summary

What does this PR do and why? (2–3 sentences max)

## Changes Made

- `path/to/file.py` — what changed and why
- `path/to/component.tsx` — what changed and why

## Acceptance Criteria Checklist

Copy the acceptance criteria from the task and check them off:

- [ ] Criterion 1
- [ ] Criterion 2

## Testing

- [ ] Unit tests pass: `pytest tests/unit/ -v`
- [ ] Integration tests pass: `pytest tests/integration/ -v`
- [ ] TypeScript compiles: `npx tsc --noEmit` in `frontend/`
- [ ] Demo verification: `.\tasks.ps1 demo-verify` (or `make demo-verify`) — all 11 checks pass

## Security Checklist

- [ ] No string interpolation in SQL queries (asyncpg `$1` params only)
- [ ] No stack traces or secrets returned in API error responses
- [ ] No UPDATE or DELETE on the ledger table
- [ ] Self-approval prevention untouched (if touching commands router)
- [ ] Risk tier derived from score thresholds, not from model output (if touching AI scorer)
- [ ] No secrets committed (.env files excluded)

## Screenshots (if frontend change)

<!-- Paste before/after screenshots or screen recordings -->
