# Frontend Context — Next.js 14 / React / Tailwind

## Route → Role Map
```
/login                → public
/operator/dashboard   → operator, admin
/operator/ledger      → operator, admin
/approver/queue       → approver, admin   ← must work on mobile (judge's phone)
/approver/override    → approver, admin
/admin/ledger         → admin only
/admin/users          → admin only (stub)
/admin/policy         → admin only (stub)
```
Auth guard: `frontend/middleware.ts` — role check on every route via JWT decode from cookie.

## Component → File Map
```
CommandTerminal    → components/CommandTerminal.tsx
RiskScoreCard      → components/RiskScoreCard.tsx
TelemetryPanel     → components/TelemetryPanel.tsx
ApprovalQueue      → components/ApprovalQueue.tsx
ApprovalModal      → components/ApprovalModal.tsx
LedgerTable        → components/LedgerTable.tsx
IntegrityChecker   → components/IntegrityChecker.tsx
AlertBanner        → components/AlertBanner.tsx
OverridePanel      → components/OverridePanel.tsx
```
Full prop types + internal state in `docs/COMPONENT_STATE_SPEC.md`.
Full layouts in `docs/WIREFRAMES.md`.

## Design Tokens (Tailwind — memorize these)
```
App bg:       bg-gray-950
Panel bg:     bg-gray-900
Card bg:      bg-gray-800
Border:       border border-gray-700
Text:         text-gray-100 / text-gray-400 / text-gray-600

LOW risk:     text-emerald-400  bg-emerald-950
MEDIUM risk:  text-amber-400    bg-amber-950
HIGH risk:    text-red-400      bg-red-950

DISPATCHED:   text-emerald-400  bg-emerald-950
PENDING:      text-sky-400      bg-sky-950
REJECTED:     text-red-400      bg-red-950
OVERRIDE:     text-purple-400   bg-purple-950
REPLAY:       text-orange-400   bg-orange-950
```

## Battery Color Rules
```typescript
battery >= 50 → text-emerald-400 + bg-emerald-600 bar
battery 20-49 → text-amber-400   + bg-amber-600 bar
battery < 20  → text-red-400     + bg-red-600 bar
```

## Subsystem → Command Map (CommandTerminal dropdown filter)
```typescript
EPS:     ['ENABLE_SAFE_MODE', 'DISABLE_SAFE_MODE']
OBC:     ['REQUEST_STATUS', 'UPDATE_PARAMETER', 'RESET_OBC', 'DISABLE_WATCHDOG', 'RESET_SUBSYSTEM', 'FORCE_REBOOT', 'UPDATE_AUTH_KEY']
ADCS:    ['ATTITUDE_MANOEUVRE', 'SCHEDULE_MANOEUVRE', 'THRUSTER_FIRE']
TM:      ['REQUEST_TELEMETRY', 'SET_BEACON_RATE']
PAYLOAD: ['PAYLOAD_ACTIVATE']
```

## WebSocket + Polling Pattern
```typescript
// useApprovalWebSocket: WS first, 3s polling fallback on error
ws.onerror = () => setPollingMode(true)
// If pollingMode: setInterval(() => fetchPending(), 3000)
// Show badge: pollingMode ? "⟳ Polling" : "● Live"
```

## API Client (`lib/api.ts`)
All methods typed. Token from `localStorage['scsp_token']`.
On 401: clear token + redirect to /login.
On network error: throw with `code: 'NETWORK_ERROR'`.

## State Management
Local useState/useReducer only — no Redux/Zustand for MVP.
Page-level state passed as props to components.
No prop drilling beyond 2 levels — lift to page state.

## Demo Controls
Show interactive telemetry sliders when `APP_ENV === 'development'` OR `?demo=true` query param.
Demo tamper button on admin ledger: only visible when `APP_ENV === 'development'`.
Sliders call `api.updateTelemetry()` debounced 300ms.

## Mobile Rules (approver queue only)
- Min tap target: 44×44px
- Modal: overflow-y-scroll, full-screen on mobile
- Approve/Reject buttons: full-width at bottom of modal
