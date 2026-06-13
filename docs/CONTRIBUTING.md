# SCSP — Git Branching & Commit Convention

---

## Branch Strategy

Single main branch model with short-lived feature branches.

```
main          ← stable, demo-ready at all times after Day 3 freeze
  └── feature/T-001-repo-scaffold
  └── feature/T-007-auth-service
  └── feature/T-012-ai-scorer
  └── fix/T-012-score-clamping
```

### Branch Naming

```
feature/T-[NNN]-[short-description]    ← new feature per task ID
fix/T-[NNN]-[short-description]        ← bug fix on a task
test/T-[NNN]-[short-description]       ← test-only changes
chore/[short-description]              ← deps, config, tooling
```

Examples:
```
feature/T-007-auth-service
feature/T-012-ai-scorer
feature/T-015-hash-chain-ledger
fix/T-009-crc-validation
chore/pin-requirements
```

**Rules**:
- One branch per task (one task ID per branch)
- Branch from `main`, merge back to `main`
- Delete branch after merge
- Never push directly to `main`

---

## Commit Message Format

```
type(T-NNN): short description (max 72 chars)

Optional body: what changed and why, if non-obvious.
```

**Types**:

| Type | Use when |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `test` | Adding or fixing tests only |
| `refactor` | Code restructure, no behavior change |
| `docs` | Documentation only |
| `chore` | Dependencies, config, tooling, non-code |

**Examples**:
```
feat(T-007): implement JWT auth service with bcrypt and RBAC
feat(T-009): implement CCSDS parser with CRC-16-CCITT validation
test(T-009): add unit tests for all 7 CCSDS error codes
fix(T-012): clamp risk score to 0-100 before tier derivation
fix(T-015): use sort_keys=True in hash computation for consistency
refactor(T-014): extract approval quorum logic to separate function
chore: pin all backend dependencies to exact versions
```

**One commit per completed task**. Do not commit partial work to main.
A task is complete when all its acceptance criteria pass and tests pass.

---

## Merge Rules

1. All acceptance criteria for the task must pass locally
2. `make test-unit` must pass (no failures)
3. No `# TODO: CLARIFY` comments left unresolved
4. Self-review: read the diff before merging
5. Merge using `git merge --no-ff` to preserve task history

```bash
# Standard merge flow
git checkout main
git pull origin main
git merge --no-ff feature/T-007-auth-service -m "feat(T-007): auth service complete"
git push origin main
git branch -d feature/T-007-auth-service
```

---

## Day 3 Code Freeze

**At end of Day 3 (approx 18:00)**: tag the last stable commit as `demo-ready`.

```bash
git tag -a v1.0.0-demo -m "Demo-ready build — all MVP features complete"
git push origin v1.0.0-demo
```

After this tag:
- Only bug fixes and demo polish go to `main`
- No new feature branches created
- All fixes committed directly to `main` with `fix(T-NNN):` prefix
- If a fix breaks the demo, revert immediately (`git revert HEAD`)

---

## Day 4 Rules

- Branch: `fix/demo-polish-[description]` only
- Commit: `fix:` type only — no `feat:` on Day 4
- Code freeze at 18:00 Day 4 — no commits after this point
- Final demo build is the `v1.0.0-demo` tag or the last commit before 18:00

---

## `.gitignore` Requirements

```
# Environment
.env
.env.local
*.env

# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/
.pytest_cache/
.coverage
htmlcov/

# Node
node_modules/
.next/
out/

# Database
*.db
*.sqlite

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Test artifacts
.pytest_cache/
coverage.xml
```

---

## Parallel Work Guidelines (3-person team)

To minimize merge conflicts on a fast-moving 4-day build:

**Person A (Backend)** owns:
- `backend/app/services/` — all service files
- `backend/app/models/` — all model files
- `backend/migrations/` — SQL only

**Person B (Frontend)** owns:
- `frontend/app/` — all page files
- `frontend/components/` — all component files
- `frontend/hooks/` — all hook files

**Person C (Integration)** owns:
- `backend/app/routers/` — all router files
- `backend/app/main.py` — app wiring
- `obc/` — OBC simulator
- `backend/scripts/` — seed scripts

**Shared files** (coordinate before editing):
- `backend/app/config.py` — communicate changes in team chat before editing
- `frontend/lib/types.ts` — communicate new types before adding
- `frontend/lib/api.ts` — communicate new methods before adding
- `Makefile` — merge conflicts here are harmless, just combine both versions

**Integration checkpoints** (team syncs):
- End of Day 1: DB + auth working end-to-end
- End of Day 2: AI scorer + auth chain working, WS notifications firing
- End of Day 3: Full pipeline works, seed scripts complete, demo dry run
