# SCSP — UI/UX Wireframe Specification
# Satellite Command Security Platform — MVP Frontend

---

## Design Tokens (Tailwind classes to use)

```
Background:       bg-gray-950 (app), bg-gray-900 (panels), bg-gray-800 (cards)
Border:           border border-gray-700
Text primary:     text-gray-100
Text secondary:   text-gray-400
Text muted:       text-gray-600

Risk LOW:         text-emerald-400  bg-emerald-950  border-emerald-700
Risk MEDIUM:      text-amber-400    bg-amber-950    border-amber-700
Risk HIGH:        text-red-400      bg-red-950      border-red-700

Status PENDING:   text-sky-400      bg-sky-950
Status APPROVED:  text-emerald-400  bg-emerald-950
Status REJECTED:  text-red-400      bg-red-950
Status BLOCKED:   text-red-600      bg-red-950
Status REPLAY:    text-orange-400   bg-orange-950
Status OVERRIDE:  text-purple-400   bg-purple-950

Button primary:   bg-indigo-600 hover:bg-indigo-500 text-white
Button danger:    bg-red-600    hover:bg-red-500    text-white
Button approve:   bg-emerald-600 hover:bg-emerald-500 text-white
Button reject:    bg-red-600    hover:bg-red-500    text-white
Button neutral:   bg-gray-700   hover:bg-gray-600  text-gray-100

Font:             font-mono for hashes/hex, font-sans for everything else
Spacing unit:     4px (Tailwind default, use gap-4, p-4, etc.)
Border radius:    rounded-lg for cards, rounded-md for badges, rounded for buttons
```

---

## Page 1 — Login

```
┌─────────────────────────────────────────────────────────┐
│                    bg-gray-950 full screen               │
│                                                         │
│              ┌────────────────────────────┐             │
│              │        bg-gray-900         │             │
│              │        rounded-xl          │             │
│              │        p-8 w-96            │             │
│              │                            │             │
│              │  [satellite icon 32px]     │             │
│              │  SCSP                      │             │  ← text-2xl font-bold text-gray-100
│              │  Satellite Command         │             │
│              │  Security Platform         │             │  ← text-sm text-gray-400
│              │                            │             │
│              │  ┌──────────────────────┐  │             │
│              │  │ Username             │  │             │  ← input, bg-gray-800, border-gray-700
│              │  └──────────────────────┘  │             │
│              │  ┌──────────────────────┐  │             │
│              │  │ Password             │  │             │  ← input type=password
│              │  └──────────────────────┘  │             │
│              │                            │             │
│              │  [error message here]      │             │  ← text-red-400, hidden unless error
│              │                            │             │
│              │  ┌──────────────────────┐  │             │
│              │  │    Sign In           │  │             │  ← button primary, full width
│              │  └──────────────────────┘  │             │
│              │                            │             │
│              │  v1.0.0 · MVP              │             │  ← text-xs text-gray-600
│              └────────────────────────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**States**:
- Default: all fields empty, button enabled
- Loading: button shows spinner + "Signing in...", fields disabled
- Error: red error text between password and button, fields re-enabled
- Success: redirect (no visible state)

---

## Page 2 — Operator Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR  bg-gray-900 border-b border-gray-700  h-14                │
│  [🛰 SCSP]  SAT_ALPHA  ●LIVE   [Operator: op_chen ▼]  [Logout]     │
│                         green dot                                    │
└──────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  ┌────────────────────────────┐  ┌──────────────────────────────┐   │
│  │  LEFT PANEL  w-5/12        │  │  RIGHT PANEL  w-7/12         │   │
│  │  bg-gray-900 rounded-lg    │  │                              │   │
│  │  p-4                       │  │  ┌──────────────────────┐    │   │
│  │                            │  │  │  TELEMETRY PANEL     │    │   │
│  │  COMMAND TERMINAL          │  │  │  bg-gray-900 p-4     │    │   │
│  │  ─────────────────         │  │  │  rounded-lg          │    │   │
│  │                            │  │  │  [see §TelemetryPanel]│   │   │
│  │  Subsystem  [dropdown ▼]   │  │  └──────────────────────┘    │   │
│  │  Command    [dropdown ▼]   │  │                              │   │
│  │                            │  │  ┌──────────────────────┐    │   │
│  │  [Submit Command]  btn     │  │  │  ALERT BANNER        │    │   │
│  │                            │  │  │  bg-amber-950        │    │   │
│  │  ────────────────────────  │  │  │  (hidden if no alerts│    │   │
│  │                            │  │  │   [see §AlertBanner] │    │   │
│  │  RISK SCORE CARD           │  │  └──────────────────────┘    │   │
│  │  (appears after submit)    │  │                              │   │
│  │  [see §RiskScoreCard]      │  │                              │   │
│  │                            │  │                              │   │
│  └────────────────────────────┘  └──────────────────────────────┘   │
│                                                                      │
│  NAV BOTTOM (mobile) or LEFT SIDEBAR (desktop, optional for MVP)     │
│  [Dashboard] [Ledger]                                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component — TelemetryPanel

```
┌──────────────────────────────────────────────────────────┐
│  SATELLITE STATE                             [SAT_ALPHA]  │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  Battery          [████████░░] 78%              [green] │
│                   ← slider (demo mode only)             │
│                                                          │
│  Safe Mode        [OFF]                        [neutral] │
│                   ← toggle switch (demo mode only)      │
│                                                          │
│  Thermal          NOMINAL                      [green]   │
│                   ← dropdown (demo mode only)           │
│                                                          │
│  Orbital Phase    SUNLIT                       [green]   │
│                   ← dropdown (demo mode only)           │
│                                                          │
│  Link Margin      12.5 dB                               │
│                                                          │
│  Last Contact     4 min ago                             │
│                                                          │
│  Updated 14:32:01                              [refresh] │
└──────────────────────────────────────────────────────────┘
```

**Battery threshold colors**:
- >= 50%: `text-emerald-400`, bar `bg-emerald-600`
- 20–49%: `text-amber-400`, bar `bg-amber-600`
- < 20%:  `text-red-400`, bar `bg-red-600`

**Safe Mode colors**: ON = `bg-sky-900 text-sky-400`, OFF = `bg-gray-800 text-gray-400`

---

## Component — CommandTerminal

```
┌──────────────────────────────────────────────────────────┐
│  COMMAND TERMINAL                                        │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  Subsystem                                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  EPS — Power System                           ▼  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Command Type                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  DISABLE_SAFE_MODE                            ▼  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Nonce (auto-generated)                                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  550e8400-e29b-41d4-a716-446655440000    [regen] │   │  ← font-mono text-xs text-gray-500
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │            ⬆ Submit Command                      │   │  ← bg-indigo-600 button, full width
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [loading spinner shown during API call]                 │
└──────────────────────────────────────────────────────────┘
```

---

## Component — RiskScoreCard

**LOW state** (score 0–30):
```
┌──────────────────────────────────────────────────────────┐
│  RISK ASSESSMENT                                         │
│  ────────────────────────────────────────────────────── │
│                                                          │
│       5                  [LOW RISK]                      │
│  ← text-7xl font-bold   ← bg-emerald-950 text-emerald-400│
│    text-emerald-400         badge                        │
│                                                          │
│  Telemetry request is read-only with no satellite state  │
│  change. Nominal battery and orbital conditions.         │
│  ← text-sm text-gray-400                                 │
│                                                          │
│  [TM]  ← affected subsystem chip, bg-gray-800            │
│                                                          │
│  ── Status ─────────────────────────────────────────── │
│  ✓ Auto-approved and dispatched          [DISPATCHED]   │
│  ← text-emerald-400                      green badge    │
└──────────────────────────────────────────────────────────┘
```

**HIGH state** (score 71–100):
```
┌──────────────────────────────────────────────────────────┐
│  RISK ASSESSMENT                                         │
│  ────────────────────────────────────────────────────── │
│                                                          │
│       87                 [HIGH RISK]                     │
│  ← text-7xl font-bold   ← bg-red-950 text-red-400 badge  │
│    text-red-400                                          │
│                                                          │
│  Disabling safe mode at 9% battery during eclipse        │
│  phase violates SR-001. Thermal elevation compounds      │
│  power risk. SPARTA T0836 applies.                       │
│  ← text-sm text-gray-400                                 │
│                                                          │
│  [T0836]  [CVSS 8.4]  [EPS] [OBC] [ADCS]               │
│  ← chips, bg-gray-800 text-gray-300                      │
│                                                          │
│  ── Approval Status ───────────────────────────────── │
│                                                          │
│  Awaiting dual approval (0 of 2)                        │
│  ● Safety Officer A    [Pending...]    ← spinner        │
│  ● Safety Officer B    [Pending...]    ← spinner        │
│                                                          │
│  [PENDING DUAL APPROVAL] badge sky-blue                 │
└──────────────────────────────────────────────────────────┘
```

**Approval received state** (1 of 2):
```
│  ● Safety Officer A    [✓ Approved 14:32:15]  ← emerald  │
│  ● Safety Officer B    [Pending...]            ← spinner  │
```

---

## Component — AlertBanner

```
┌──────────────────────────────────────────────────────────┐
│  ⚠ SEQUENCE ANOMALY DETECTED                         [×] │  ← amber
│  ────────────────────────────────────────────────────── │
│  Rule SEQ-001 triggered: DISABLE_SAFE_MODE followed by   │
│  ATTITUDE_MANOEUVRE within 60 seconds.                   │
│  Risk score elevated by +20 points.                      │
└──────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────┐
│  🔴 REPLAY ATTACK BLOCKED                            [×] │  ← red
│  ────────────────────────────────────────────────────── │
│  Duplicate command nonce detected. This command was      │
│  already submitted at 14:24:01. Command blocked.         │
└──────────────────────────────────────────────────────────┘
```

---

## Page 3 — Approver Queue

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR                                                             │
│  [🛰 SCSP]  SAT_ALPHA  ●LIVE   [Safety Officer: so_kim ▼]  [Logout]│
│                                 [🔴 OVERRIDE ACTIVE 08:32 remaining] │  ← only if override active
└──────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  PENDING APPROVALS            [2 pending]   ● Live  (or 🔄 Polling) │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  [HIGH] DISABLE_SAFE_MODE  EPS  Score: 87   op_chen  2m ago  →│  │  ← row, cursor-pointer
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  [MED]  UPDATE_PARAMETER   OBC  Score: 45   op_patel  5m ago →│  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  (empty state when no pending commands)                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ✓  No commands pending approval                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component — ApprovalModal

```
┌─────────────────────────────────────────────────────────────┐
│  COMMAND REVIEW                                         [×] │  ← modal overlay, bg-gray-900
│  ────────────────────────────────────────────────────────── │
│                                                             │
│  DISABLE_SAFE_MODE          [HIGH RISK]  Score: 87          │
│  Subsystem: EPS                                             │
│                                                             │
│  ── AI Risk Assessment ────────────────────────────────── │
│  Disabling safe mode at 9% battery during eclipse           │
│  phase violates SR-001...                                   │
│  [T0836]  [CVSS 8.4]  [EPS] [OBC] [ADCS]                  │
│                                                             │
│  ── Telemetry at Submission Time ─────────────────────── │
│  Battery: 9%  ← red   Safe Mode: ON   Thermal: ELEVATED    │
│  Orbital: ECLIPSE      Link: 3.2 dB                        │
│                                                             │
│  ── Sequence Alerts ───────────────────────────────────── │
│  (none)  ← shown as "None" if empty                        │
│                                                             │
│  ── Submitted by ──────────────────────────────────────── │
│  op_chen (Wei Chen)  ·  14:30:15  ·  2 minutes ago         │
│                                                             │
│  ── Your Decision ─────────────────────────────────────── │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Justification (required for rejection)           │    │
│  │                                                   │    │
│  │                                                   │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────┐    │
│  │   ✗ Reject Command  │  │   ✓ Approve Command      │   │
│  │   bg-red-600        │  │   bg-emerald-600          │   │
│  └─────────────────────┘  └─────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**States**:
- Default: justification empty, both buttons enabled
- Loading: both buttons disabled with spinner
- Error: error text above buttons
- Success: modal closes, row removed from queue

---

## Page 4 — Emergency Override

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR  [← Back to Queue]                                          │
└──────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  EMERGENCY OVERRIDE CONTROL                                          │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  OVERRIDE STATUS                                            │    │
│  │                                                             │    │
│  │  [inactive state]                                           │    │
│  │  ● No active override                                       │    │  ← bg-gray-900
│  │  All commands are subject to normal authorization policy.   │    │
│  │                                                             │    │
│  │  [active state — shown instead when override is active]     │    │
│  │  🔴 OVERRIDE ACTIVE                                         │    │  ← bg-red-950 border-red-700
│  │  Activated by: so_kim                                       │    │
│  │  Expires in: 08:32                  ← countdown            │    │
│  │  Justification: "Contact window closing..."                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  ACTIVATE EMERGENCY OVERRIDE                                │    │
│  │                                                             │    │
│  │  ⚠ Use only when dual approval is unavailable during a      │    │
│  │  critical mission window. All commands executed during      │    │
│  │  the override period are flagged for mandatory post-event   │    │
│  │  review and logged with your identity.                      │    │
│  │                                                             │    │
│  │  Justification (minimum 20 characters)                      │    │
│  │  ┌───────────────────────────────────────────────────┐     │    │
│  │  │                                                   │     │    │
│  │  │                                                   │     │    │
│  │  └───────────────────────────────────────────────────┘     │    │
│  │  0 / 500 chars  ← counter, turns green at 20               │    │
│  │                                                             │    │
│  │  ┌───────────────────────────────────────────────────┐     │    │
│  │  │  🔴 Activate Emergency Override (10 min)          │     │    │  ← disabled until 20 chars
│  │  └───────────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Confirmation modal** (shown before activation):
```
┌──────────────────────────────────────┐
│  Confirm Emergency Override     [×]  │
│  ────────────────────────────────── │
│  This will bypass dual-approval for  │
│  10 minutes. All commands during     │
│  this period will be flagged for     │
│  mandatory post-event review.        │
│                                      │
│  [Cancel]    [Confirm — Activate]    │
│  gray         red                    │
└──────────────────────────────────────┘
```

---

## Page 5 — Admin Ledger

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR  [Admin: admin_root]  [Logout]                              │
│  NAV: [Ledger] [Users] [Policy]                                      │
└──────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  COMMAND LEDGER                                                      │
│  ──────────────────────────────────────────────────────────────────  │
│                                                                      │
│  [Filter: All Events ▼]   [Verify Chain Integrity]  ← button         │
│                           bg-indigo-600                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ integrity check result banner (hidden until verified)        │   │
│  │ GREEN: ✓ All 50 entries verified — chain intact (14:32:00)   │   │
│  │ RED:   ✗ Tampering detected at sequence 42 — entry [uuid]    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──┬──────────┬──────────────────┬────────────┬──────┬──────────┐ │
│  │#  │ Time    │ Event            │ Command    │Score │ Operator │ │  ← table header
│  ├──┼──────────┼──────────────────┼────────────┼──────┼──────────┤ │
│  │50 │14:32:01 │[DISPATCHED]      │DISABLE_SM  │87    │op_chen   │ │  ← row
│  │49 │14:31:45 │[SUBMITTED]       │DISABLE_SM  │87    │op_chen   │ │
│  │42 │14:28:12 │[DISPATCHED] ← ⚠  │DISABLE_SM  │87→12 │op_chen   │ │  ← highlighted RED if tampered
│  │...│         │                  │            │      │          │ │
│  └──┴──────────┴──────────────────┴────────────┴──────┴──────────┘ │
│                                                                      │
│  [← Prev]  Page 1 of 3  [Next →]            ← pagination           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  [🔴 Tamper Entry 42 (Demo)] ← only visible in development   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Entry hash display**: Show first 12 chars + "..." in table. Full hash in tooltip or modal.

**Row color rules**:
- DISPATCHED: `bg-gray-900` (default)
- REJECTED: `bg-amber-950`
- REPLAY_BLOCKED: `bg-orange-950`
- EMERGENCY_OVERRIDE: `bg-purple-950`
- Corrupted entry (from verify): `bg-red-950 border border-red-700`

---

## Page 6 — Operator Ledger (Own Commands)

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP BAR  [← Dashboard]  MY COMMANDS                                │
└──────────────────────────────────────────────────────────────────────┘
│                                                                      │
│  ┌──┬──────────┬──────────────────┬────────────┬──────┬──────────┐ │
│  │#  │ Time    │ Command          │ Subsystem  │Score │ Status   │ │
│  ├──┼──────────┼──────────────────┼────────────┼──────┼──────────┤ │
│  │  │14:32:01 │DISABLE_SAFE_MODE │EPS         │87    │[REJECTED]│ │
│  │  │14:30:00 │REQUEST_TELEMETRY │TM          │5     │[DISPATCHED]│ │
│  └──┴──────────┴──────────────────┴────────────┴──────┴──────────┘ │
│                                                                      │
│  [← Prev]  Page 1 of 3  [Next →]                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

For MVP, target desktop-first at 1280px+ viewport width.
Mobile is needed only for the approver panel (judges use their phone as approver).

**Approver queue mobile** (380px viewport):
- Full-width card list instead of table
- Each card shows: command type, risk badge, score, submitter, time
- Tap card → full-screen modal (same content as desktop)
- Approve/Reject buttons at bottom of modal, full width

**ngrok demo**: The approver queue must be usable on a phone browser.
Ensure all tap targets are minimum 44×44px.
Ensure modal scroll works on mobile (overflow-y-scroll on modal content).

---

## Loading & Error States (all components)

**Loading state**: Replace content with skeleton loaders:
```
bg-gray-800 animate-pulse rounded h-4 w-full  ← skeleton bar
```

**Error state**: 
```
┌──────────────────────────────────────┐
│  ⚠ Failed to load                    │
│  [error message]                     │
│  [Try again] button                  │
└──────────────────────────────────────┘
```

**Empty state**: Each list/table has a specific empty state message (defined per component above).

---

## Navigation Structure

```
Operator (/operator/*)
  ├── /operator/dashboard    ← primary view
  └── /operator/ledger       ← own command history

Approver (/approver/*)
  ├── /approver/queue        ← primary view
  └── /approver/override     ← emergency bypass

Admin (/admin/*)
  ├── /admin/ledger          ← full ledger + integrity check
  ├── /admin/users           ← user management (stub for MVP)
  └── /admin/policy          ← threshold config (stub for MVP)
```

Admin nav tabs shown at top of all admin pages.
Operator and approver use minimal top bar with single back link where relevant.

---

## Demo-Specific UI Elements

### Telemetry Slider Controls (demo mode)

When `?demo=true` query param is present OR `APP_ENV=development`:
- Battery slider appears below battery display (range 0–100)
- Safe mode toggle appears (boolean switch)
- Thermal dropdown (3 options)
- Orbital phase dropdown (3 options)
- All changes call `PUT /api/v1/telemetry/update` on change (debounced 300ms)

### Demo Tamper Button

Visible only in `APP_ENV=development` on the admin ledger page.
Red outline button: "Tamper Entry 42 (Demo)"
Calls `PUT /api/v1/ledger/demo-tamper`
After success: show toast "Entry 42 tampered — run integrity check to detect"
