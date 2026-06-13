# SCSP — Frontend Design Requirements
# Satellite Command Security Platform — Enterprise UI/UX Specification
# Version 1.0 | Design-to-Development Reference

---

## 1. Design Philosophy

SCSP is a **critical-infrastructure security platform** used by satellite operators, safety officers, and security administrators. The UI must communicate authority, precision, and trust — not novelty.

**Core design principles:**
- **Clarity over cleverness** — every pixel serves operational purpose
- **Hierarchy by urgency** — risk level, status, and time-sensitivity must be visually dominant
- **Calm at rest, loud when critical** — the UI is quiet when nominal, unmistakable when something needs action
- **Data density where it matters** — queues, tables, and logs are compact; decision-making forms are spacious and deliberate

**Visual personality target:**
The platform should feel like the intersection of **NASA Mission Control** (authority, precision, data density), **CrowdStrike Falcon** (security-first, professional dark UI), **Microsoft Sentinel** (enterprise SIEM clarity), and **Palantir** (serious operational tooling). Every design decision should be answerable by "does this belong in one of those products?"

**Anti-patterns to avoid:**
- No animated particle backgrounds or "space" theming
- No monospace fonts as the primary typeface (reserve for hex, hashes, IDs)
- No gradients on interactive elements
- No gamified progress bars or score animations
- No dark-pattern confirmation flows — destructive/critical actions get explicit friction
- Does not feel like: Linear, Notion, Discord, Stripe, a crypto exchange, or a space game

**The five-second test** — when a user opens Mission Control, they must be able to answer within 3 seconds:
1. Is the satellite healthy?
2. Are commands flowing correctly?
3. Are there pending approvals?
4. Are there security incidents?
5. Is the system operational?
If the layout fails this test, the design has failed.

---

## 2. Design System

### 2.1 Color Mode

Support **both light and dark mode** with a system-aware default and a manual toggle stored in `localStorage`. The toggle lives in the top navigation bar.

### 2.2 Color Palette

#### Dark Mode (Primary)
```
Surface layers (depth model — lower = further back):
  Surface 0 (page bg):       #0B0F19   ← deep navy, not pure black
  Surface 1 (sidebar/nav):   #111827   ← gray-900 equivalent
  Surface 2 (cards/panels):  #1A2234   ← slightly blue-tinted dark
  Surface 3 (inputs/rows):   #1F2D42   ← interactive surfaces
  Surface 4 (hover states):  #253349   ← hover, focus rings

Border:
  Default border:            #2C3E55   ← subtle, not invisible
  Strong border:             #3D5270   ← dividers, active tab underlines
  Focus ring:                #4F6BFF   ← indigo-500, matches primary

Text:
  Primary text:              #F0F4FF   ← near-white with slight blue tint
  Secondary text:            #8899B5   ← muted, for labels and captions
  Tertiary text:             #566880   ← timestamps, IDs, placeholders
  Disabled text:             #3D4F65

Brand / Accent (Indigo):
  Primary-600:               #4F6BFF   ← buttons, links, active states
  Primary-700:               #3D57E8   ← hover on primary buttons
  Primary-500:               #6680FF   ← focus glow, accent highlights
  Primary-100 (dark bg):     #1A2150   ← tinted badge/chip backgrounds

Risk / Status semantic colors:
  Risk LOW (green):
    text:    #34D399   border: #059669   bg: #022C22
  Risk MEDIUM (amber):
    text:    #FCD34D   border: #D97706   bg: #2C1A00
  Risk HIGH (red):
    text:    #F87171   border: #DC2626   bg: #2C0A0A
  Status PENDING (sky):
    text:    #38BDF8   border: #0284C7   bg: #071A2C
  Status APPROVED (emerald):
    text:    #34D399   border: #059669   bg: #022C22
  Status REJECTED (red):
    text:    #F87171   border: #DC2626   bg: #2C0A0A
  Status OVERRIDE (purple):
    text:    #A78BFA   border: #7C3AED   bg: #1C1040
  Status REPLAY (orange):
    text:    #FB923C   border: #EA580C   bg: #2C1100
  Status BLOCKED (crimson):
    text:    #EF4444   border: #B91C1C   bg: #300707

  Warning banner:            bg: #2C1A00   border: #B45309   text: #FCD34D
  Error banner:              bg: #2C0A0A   border: #DC2626   text: #F87171
  Info banner:               bg: #071A2C   border: #0284C7   text: #38BDF8
```

#### Light Mode
```
Surface layers:
  Surface 0 (page bg):       #F3F6FB   ← cool off-white, not pure white
  Surface 1 (sidebar/nav):   #FFFFFF
  Surface 2 (cards/panels):  #FFFFFF   ← white cards on cool bg
  Surface 3 (inputs/rows):   #F8FAFF   ← table rows, input backgrounds
  Surface 4 (hover states):  #EEF2FF   ← indigo-50 equivalent

Border:
  Default border:            #D4DBE8
  Strong border:             #B0BCCE
  Focus ring:                #4F6BFF

Text:
  Primary text:              #0F1A2E
  Secondary text:            #4B5E78
  Tertiary text:             #7A8FA8
  Disabled text:             #B0BCCE

Brand / Accent:
  (Same indigo scale as dark mode — brand is consistent across modes)

Risk / Status semantic colors:
  Risk LOW (green):
    text:    #059669   border: #6EE7B7   bg: #ECFDF5
  Risk MEDIUM (amber):
    text:    #B45309   border: #FDE68A   bg: #FFFBEB
  Risk HIGH (red):
    text:    #DC2626   border: #FECACA   bg: #FEF2F2
  Status PENDING (sky):
    text:    #0284C7   border: #BAE6FD   bg: #F0F9FF
  Status APPROVED:
    text:    #059669   border: #6EE7B7   bg: #ECFDF5
  Status REJECTED:
    text:    #DC2626   border: #FECACA   bg: #FEF2F2
  Status OVERRIDE (purple):
    text:    #7C3AED   border: #DDD6FE   bg: #F5F3FF
  Status REPLAY:
    text:    #C2410C   border: #FED7AA   bg: #FFF7ED
```

### 2.3 Typography

```
Font stack:
  Primary (UI):    "Inter", "system-ui", sans-serif
  Code/Mono:       "JetBrains Mono", "Fira Code", monospace

Scale:
  xs:   11px / 1.5  — timestamps, status badges, sequence numbers
  sm:   13px / 1.5  — table rows, secondary labels, captions
  base: 15px / 1.6  — body copy, form labels, descriptions
  lg:   18px / 1.4  — card titles, section headers
  xl:   22px / 1.3  — page titles, modal headers
  2xl:  28px / 1.2  — risk score number (large display)
  3xl:  40px / 1.1  — login headline

Weight:
  Regular (400): body text, descriptions
  Medium  (500): labels, table column headers, nav items
  Semibold(600): card titles, status values, active nav
  Bold    (700): risk score number, page headlines

Mono usage (always use monospace for):
  - CCSDS hex strings
  - Hash values (SHA-256, prev_hash, entry_hash)
  - UUIDs and command IDs
  - Nonce values
  - Sequence numbers in ledger
```

### 2.4 Spacing & Layout Grid

```
Base unit: 4px (0.25rem)
Common spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px

Layout:
  Sidebar width:        240px (desktop), collapses to 64px (icon-only) on medium screens
  Top bar height:       56px
  Content max-width:    1440px (centered on very wide screens)
  Card padding:         24px
  Table row height:     44px (dense), 56px (spacious)
  Form field height:    40px
  Button height:        36px (default), 40px (large)

Breakpoints:
  sm:  640px
  md:  768px
  lg:  1024px
  xl:  1280px
  2xl: 1440px

Responsive behavior:
  < 768px:  Single column, sidebar becomes bottom tab bar
  768–1023: Sidebar collapses to icon-only
  >= 1024:  Full sidebar + content layout
```

### 2.5 Border Radius

```
None (sharp):    0        — data table rows, horizontal dividers
Small:           4px      — input fields, small badges
Medium:          6px      — buttons, chips, small cards
Large:           8px      — cards, panels, modals
XL:              12px     — dialogs, full-panel modals
Full:            9999px   — status pills, toggle switches
```

### 2.6 Shadows

```
Dark mode:
  Card shadow:      0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.24)
  Elevated panel:   0 4px 16px rgba(0,0,0,0.5)
  Modal:            0 20px 60px rgba(0,0,0,0.7)
  Focus ring:       0 0 0 3px rgba(79,107,255,0.35)

Light mode:
  Card shadow:      0 1px 3px rgba(15,26,46,0.08), 0 1px 2px rgba(15,26,46,0.06)
  Elevated panel:   0 4px 16px rgba(15,26,46,0.12)
  Modal:            0 20px 60px rgba(15,26,46,0.2)
  Focus ring:       0 0 0 3px rgba(79,107,255,0.25)
```

### 2.7 Icons

Use **Lucide React** exclusively (already in stack). Size defaults:
- Navigation icons: 18px
- Status/badge icons: 14px
- Table action icons: 16px
- Alert/warning icons: 20px
- Empty state icons: 48px (muted color)

Key icon assignments:
```
Shield         — SCSP logo/brand mark in sidebar and login
Satellite      — satellite state / telemetry section
Terminal       — command submission
CheckCircle2   — approved / dispatched
XCircle        — rejected / error
AlertTriangle  — sequence anomaly / warning
ShieldAlert    — replay blocked / critical security alert
Clock          — pending approval / timeout
Lock           — emergency override active
Unlock         — override deactivated
BarChart3      — ledger / audit log
Hash           — hash chain entries
RefreshCw      — polling indicator / refresh
Wifi / WifiOff — WebSocket connection status
ChevronDown    — dropdown selectors
LogOut         — logout action
Sun / Moon     — light/dark mode toggle
```

### 2.8 Motion & Transitions

```
Micro-interactions:
  Button hover/press:     150ms ease-out (opacity + transform: scale(0.98) on press)
  Dropdown open:          150ms ease-out (opacity 0→1, translateY -4px→0)
  Panel slide-in:         200ms ease-out
  Toast entry/exit:       250ms ease-in-out (translateX slide from right)
  Modal open:             200ms ease-out (opacity + scale 0.97→1)
  Accordion expand:       200ms ease-in-out

Real-time update flashes (for WebSocket-driven data):
  New row in queue:       row background flashes from indigo-tinted → normal over 600ms
  Status change:          status badge cross-fades via opacity over 300ms
  Risk score change:      number counts up/down with 400ms animation

DO NOT animate:
  - Table sorting (instant)
  - Page navigation (instant, no page transitions)
  - Error messages (instant appearance)
```

---

## 3. Page Requirements

### 3.1 Page — Login

**Purpose**: Single entry point. Establishes operator identity. No other pages are accessible without authentication.

**Layout**: Full-screen centered card. Background is the base surface with a subtle radial gradient from the center (light on dark: very subtle indigo glow; light mode: soft shadow from above).

**Card dimensions**: max-w-sm (384px), vertically centered, 48px horizontal padding.

**Elements (top to bottom):**

1. **Brand mark** — Shield icon (24px) + "SCSP" wordmark (text-xl, semibold). Below: "Satellite Command Security Platform" in secondary text, text-sm.
2. **Spacer** — 32px
3. **Username field** — Label "Username", input with user icon on left, placeholder "Enter your username"
4. **Password field** — Label "Password", input with lock icon on left, show/hide password toggle on right
5. **Error block** — Appears between password and button on error. Red background strip, AlertCircle icon, error message text. Animate in with slide-down.
6. **Sign In button** — Full width, indigo-600, 40px height. Loading state: disabled + spinner + "Signing in…"
7. **Footer** — Version string + "MVP Demo" tag in tertiary color, centered, text-xs

**States:**
- Default — empty fields, button enabled
- Loading — button spinner, fields disabled, cursor: not-allowed
- Error — error block visible (invalid credentials, rate limited + countdown timer, server error — each has distinct message)
- Success — instant redirect, no visible state

**Security UX note**: Rate limit error must show "Too many attempts. Try again in XX seconds" with a countdown timer that ticks down in the UI using the `Retry-After` value from the API.

---

### 3.2 Page — Operator Dashboard

**Purpose**: Primary workspace for satellite operators. Submit CCSDS commands, receive AI risk scores, monitor real-time approval status, and observe satellite telemetry.

**Layout**: Sidebar left (240px) + main content area. Content area splits into two columns on desktop (≥1024px): Command panel left (5/12), Status/Telemetry panel right (7/12).

**Top Navigation Bar:**
- Left: Shield icon + "SCSP" wordmark
- Center: **Satellite selector dropdown** (`SAT_ALPHA ▼`) + live connection status dot (green pulsing = WS connected; amber spinning = polling; red = disconnected). The selector is a `<button>` that opens a dropdown listing available satellites. MVP renders one active item (SAT_ALPHA); future items (SAT_BRAVO, SAT_CHARLIE, ALL SATELLITES) are present but disabled with a "Phase 2" chip. Never hardcode `SAT_ALPHA` as text — always read from a `selectedSatellite` state value.
- Right: User avatar chip (initials + full name + role badge) + theme toggle (Sun/Moon icon) + logout icon button

**Left Sidebar Navigation:**
```
[Shield icon]  SCSP                   ← brand
─────────────────────────
[Terminal]     Command Center         ← active for this page
[BarChart3]    Audit Ledger           ← links to ledger page
─────────────────────────
[bottom]
[User]         op_chen                ← operator name
               Operator               ← role chip
[LogOut]       Sign Out
```

**Main Content — Left Column (Command Panel):**
Contains the **Command Terminal** component (see §4.1) only. Focused on command entry — nothing else competes for attention here.

**Main Content — Right Column (Status Panel):**
Contains three stacked elements:
1. **Satellite health strip** — a single compact read-only bar (48px height) showing `SAT_ALPHA ● NOMINAL` with battery %, safe mode, and thermal status inline. Not a full panel — a single-line health summary. Links to /mission-control for full detail. Updates live via WebSocket.
2. **Alert Banner** (see §4.4) — hidden when no active alerts; slides in when a sequence anomaly or replay event fires
3. **Risk Score Card** (see §4.2) — hidden until a command is submitted, then slides in below the health strip

The Telemetry Panel is intentionally absent from this page. Mission Control owns satellite situational awareness. The Command Center is a focused task page: submit command, see the risk result, track approval status. Operators who need full telemetry detail navigate to Mission Control.

**Mobile (< 768px)**: Stack vertically — Command Terminal, then health strip, then Alert Banner (if active), then Risk Score Card (if result available).

---

### 3.3 Page — Approver Queue

**Purpose**: Safety officers review, approve, or reject pending high-risk commands. This is a time-sensitive, high-stakes interface. Design for clarity and deliberate action.

**Layout**: Same sidebar/nav as Operator Dashboard but with different nav state active. Main content is a two-column split on desktop: queue list (left, 5/12) and selected command detail (right, 7/12).

**Override Status Bar** (conditional — only shown when override is active):
Full-width banner directly below top navigation. Purple background, Lock icon. Shows "EMERGENCY OVERRIDE ACTIVE — Commands auto-dispatching · XX:XX remaining". Countdown timer in bold. Dismiss not possible — it auto-clears when expired.

**Queue Section (Left Column):**
- Section header: "Pending Approvals" (text-lg, semibold) + count badge (indigo pill)
- Connection indicator: "● Live" (green, WS connected) or "⟳ Polling" (amber, fallback mode)
- Commands are **grouped by urgency**, not rendered as a flat list. Two sections:

  **"Expiring Soon"** section (amber section label, AlertTriangle icon):
  - Contains commands pending > 3 minutes
  - Section label flashes amber if any command is within 60 seconds of the 5-minute auto-timeout
  - Cards have red left border when < 60s remaining
  - Shown first, always above "Needs Review"
  - Collapsed with count chip if empty ("0 expiring")

  **"Needs Review"** section (neutral section label):
  - Contains all other pending commands
  - Ordered by submitted_at ascending within the section (oldest = highest visual weight)
  - Shown below "Expiring Soon"

- Within each section, **Command Queue Cards** are ordered by submitted_at ascending
- Empty state (both sections empty): shield-check icon (64px, muted), "All clear — no pending approvals", "Commands requiring your review will appear here in real-time"

**Detail Panel (Right Column):**
- Shows **Command Detail View** (see §4.6) for the selected command
- When nothing is selected: show a subtle prompt "← Select a command to review"

**Mobile**: Single column. Tapping a queue card navigates to a full-screen detail view with a back button.

---

### 3.4 Page — Admin Dashboard

**Purpose**: System-wide visibility for administrators. Monitoring overview, telemetry control, and access to ledger operations.

**Layout**: Full-width three-column grid at the top (stat cards), then full-width ledger table below.

**Admin Stat Cards (4 cards across top):**
```
[Commands Today]   [Pending Now]   [Override Status]   [Ledger Integrity]
  count             count            INACTIVE / ACTIVE    VALID / INVALID
  +N from yesterday  --               or N min remaining   N entries
```
Each card: white/surface-2 background, subtle left border in accent color, data in text-2xl bold, label in secondary text.

**Telemetry Control Panel:**
- Full-width card below stat cards
- "Satellite State Control" header with "ADMIN" badge
- Two-column layout: read-only telemetry display on left, control sliders/dropdowns on right
- Battery percent: range slider (0–100) with live preview
- Safe mode: toggle switch
- Thermal status: segmented control (NOMINAL / ELEVATED / CRITICAL)
- Orbital phase: segmented control (SUNLIT / ECLIPSE / PENUMBRA)
- "Update Telemetry" button — indigo, right-aligned
- Note: Changes are reflected in real-time for all connected users (broadcast via WebSocket)

**Sidebar Navigation (Admin additions):**
```
[Terminal]     Command Center
[BarChart3]    Audit Ledger           ← active sub-nav
[Settings]     System Settings        ← PHASE_2 stub
[Users]        Operators              ← PHASE_2 stub
─────────────────────────────
[Shield]       Admin Panel            ← active for this page
```

---

### 3.5 Page — Audit Ledger

**Purpose**: Immutable, chronological record of all security-relevant events. Available to all authenticated roles with read access. Admins get additional "Verify Chain" capability.

**Layout**: Full-width. Header section with filters, then dense data table, then pagination.

**Header Section:**
- Page title "Audit Ledger" (text-xl, semibold) with Hash icon
- Subtitle: "Tamper-evident hash chain — append-only record of all command and security events"
- Right side: "Verify Chain" button (admin only) — secondary style, Hash icon, triggers integrity check

**Filter Row — Quick Filters (first row):**
One-click filter chips for the most common forensic queries. Always visible above the advanced filters:
```
[Today]  [Last 24h]  [Last 7 Days]  [Security]  [Approvals]  [Overrides]
```
- Active chip: indigo-filled pill
- "Security" chip filters to: REPLAY_BLOCKED, SEQUENCE_ANOMALY, LEDGER_INTEGRITY_FAILURE, BLOCKED
- "Approvals" chip filters to: COMMAND_APPROVED, COMMAND_REJECTED, COMMAND_BLOCKED_TIMEOUT
- "Overrides" chip filters to: OVERRIDE_ACTIVATED, OVERRIDE_EXPIRED, EMERGENCY_OVERRIDE

**Filter Row — Advanced Filters (second row, collapsible):**
- Event type: full dropdown (All event types / specific type)
- Date range: from/to date pickers
- Operator: username search input
- Search: full-text search across event_detail

**Ledger Data Table:**
Dense table, 44px row height. Columns:
```
Seq       Event Type         Command ID         Operator        Timestamp
[mono]    [event type badge] [mono, truncated]  [username]      [relative + absolute on hover]
```
Row hover: surface-4 background highlight.
Clicking a row expands it inline (accordion) to show:
- Hash values (prev_hash, entry_hash) — full monospace display
- Event detail JSON — formatted code block, collapsible
- Approver IDs if relevant

**Chain Verification Result:**
Triggered by "Verify Chain" button. Shows a result panel below the filters:
- SUCCESS: green bordered panel, CheckCircle2 icon, "Chain integrity verified — N entries checked"
- FAILURE: red bordered panel, ShieldAlert icon, "Integrity violation at entry #N — tampering detected", full detail

**Pagination:**
Standard pagination bar. "Showing 1–20 of 347 entries" + Previous/Next + page number chips.

---

### 3.6 Page — Mission Control Dashboard (Simulation Overview)

**Purpose**: The flagship system-wide view. Shows the entire command pipeline, satellite state, security event stream, and operator activity in one screen. Accessible to all authenticated roles; content depth varies by role. This is the page used for live demos and executive walkthroughs.

**Layout**: Full-width, no sidebar column restriction. Four zones stacked vertically — this order is non-negotiable; satellite health is the most visually prominent area:
1. **Status ribbon** — single row of 5 KPI stat cards across the full width
2. **Satellite Health** — full-width primary telemetry card, the visual hero of the page
3. **Main grid** — two columns: command pipeline left (7/12) + activity feed right (5/12)
4. **Charts row** — two side-by-side analytics charts

**Status Ribbon (5 cards, full width):**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Commands     │ │ Pending      │ │ Dispatched   │ │ Blocked/     │ │ Override     │
│ Today        │ │ Approval     │ │ Today        │ │ Rejected     │ │ Status       │
│   47         │ │    2  ← amber│ │   39  ← green│ │    6  ← red  │ │  INACTIVE    │
│ ↑12 from     │ │ ← pulsing if │ │              │ │              │ │  ← gray chip │
│ yesterday    │ │   count > 0  │ │              │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```
Each card: surface-2 background, 24px padding, subtle left border in semantic color, count in text-3xl bold, label in secondary text-sm, delta/subtitle in tertiary text-xs. Pending Approval card is clickable → navigates to /approvals.

**Satellite Health Overview (full-width card):**

This is the primary visual element of Mission Control. The satellite state must be immediately readable at a glance — anyone looking at this page should know the satellite health within two seconds.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  SAT_ALPHA ▼              NOMINAL ● All systems green           Updated 14:32:01 │
│  ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │ POWER             │  │ COMMUNICATIONS    │  │ THERMAL           │  │ ORBIT    │ │
│  │ Battery 78% ●    │  │ Link  12.5 dB ●  │  │ Status  NOMINAL ●│  │ SUNLIT ● │ │
│  │ ████████░░       │  │ Contact 4m ago ● │  │ Fault   NONE     │  │          │ │
│  │ Safe Mode: OFF   │  │                   │  │                   │  │          │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────┘ │
│                                                                                  │
│  Phase 2 slots (shown greyed out with "—" in MVP):                               │
│  Solar Output: —    Signal Quality: —    Altitude: —    Attitude: —              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Layout: 4-column grid of subsystem groups. Each group: label header + metric rows with value + colored status dot. Any metric in WARNING state turns its group card border amber; CRITICAL turns it red.

Overall satellite status chip (top right of card): "NOMINAL ●" (all green) → "DEGRADED ●" (any amber) → "CRITICAL ●" (any red). Color transitions: green → amber → red.

Phase 2 metric slots (Solar Output, Signal Quality, Altitude, Velocity, Attitude Status, Reaction Wheels): rendered as greyed-out rows with value "—" in MVP. Layout accommodates them so no redesign is needed when data becomes available.

**Multi-satellite design**: The `SAT_ALPHA ▼` dropdown in the card header is a satellite selector. MVP renders a single item. Additional satellites (SAT_BRAVO, SAT_CHARLIE, ALL SATELLITES) appear greyed-out with a "Phase 2" tooltip. The selector component and the data-fetching layer must be designed to accept a `satelliteId` parameter from day one — never hardcode `SAT_ALPHA` as a literal in component logic.

**Main Grid — Left (7/12): Command Pipeline Visualization**

A live-updating list of recent commands showing progress through pipeline stages. Shows the last 10 commands. Each command card is compact (64px height) and color-coded by risk tier.

```
COMMAND PIPELINE                                  [last 10 commands]
─────────────────────────────────────────────────────────────────────

  ┌────────────────────────────────────────────────────────────────┐
  │  [HIGH]  DISABLE_SAFE_MODE         EPS   op_chen   2m ago     │
  │          SUBMIT ●─── AI ●─── REVIEW ●─── AUTH ○─── SAT ○     │
  │                                          1/2 ← spinner        │
  └────────────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────────────┐
  │  [LOW]   REQUEST_TELEMETRY          TM   op_patel  5m ago     │
  │          SUBMIT ●─── AI ●─── AUTO ●────────────── SAT ●      │
  │                              [DISPATCHED]                      │
  └────────────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────────────┐
  │  [MED]   UPDATE_PARAMETER          OBC   op_chen   8m ago     │
  │          SUBMIT ●─── AI ●─── REVIEW ●─── AUTH ●─── SAT ●    │
  │                                          [DISPATCHED]          │
  └────────────────────────────────────────────────────────────────┘
```

Five stages: SUBMIT → AI ANALYSIS → SECURITY REVIEW → AUTHORIZATION → SATELLITE DISPATCH. Stage labels match V2's mission workflow language — not generic progress steps.

Filled dot (●) = completed. Pulsing dot (◉) = active/current stage. Empty dot (○) = not yet reached. Active stage connector line animates (traveling dashes, 1.5s loop).

**Main Grid — Right (5/12): Live Activity Event Feed**

Real-time scrolling stream of system events. Purpose: show the **system heartbeat**, not audit history. New events appear at top with a brief background flash. Auto-scrolls; pauses on hover.

Three visual tiers — events are rendered differently based on priority:

**Critical tier** (red/purple row tint, full-weight badge, ShieldAlert icon):
- REPLAY_ATTACK_BLOCKED — red row
- OVERRIDE_ACTIVATED / OVERRIDE_EXPIRED — purple row
- LEDGER_INTEGRITY_FAILURE — red row, bold border

**Operational tier** (default surface, standard-weight badge):
- COMMAND_SUBMITTED, COMMAND_DISPATCHED, COMMAND_APPROVED, COMMAND_REJECTED, SEQUENCE_ANOMALY

**Informational tier** (muted text-xs, no badge, indented):
- USER_LOGIN — "op_chen signed in"
- TELEMETRY_UPDATE — "Telemetry updated by admin_root"

```
  14:32:01  ⚠ REPLAY_BLOCKED  REQUEST_TLM  op_chen        ← red row, full weight
  14:31:45  [SUBMITTED]       DISABLE_SM   op_chen        ← operational, neutral
  14:31:02  [DISPATCHED]      UPDATE_PARAM op_chen→so_kim ← operational, neutral
  14:30:22  ○ op_chen signed in                           ← informational, muted
  14:28:00  ⬤ OVERRIDE ACTIVE               so_kim       ← purple row, full weight
  14:27:30  ○ Telemetry updated              admin_root   ← informational, muted
```

"Pause" button appears on hover: stops auto-scroll, "⏸ Paused" chip replaces connection indicator.

Header: "System Heartbeat" (not "Live Events") + connection dot + "N events today" counter.

**Charts Row — Left (6/12): Risk Distribution (Today)**

Donut chart centered in a card. Three segments: LOW (emerald), MEDIUM (amber), HIGH (red). Center of donut shows total command count. Legend below with count + percentage for each tier.

Below the donut: small bar showing the trend over the last 7 days (sparkline-style, one bar per day, color split by tier within each bar).

Header: "Risk Distribution — Today" + date label.

**Charts Row — Right (6/12): Command Volume (Last 7 Days)**

Vertical bar chart. One bar per day. Each bar stacked: DISPATCHED (emerald) / REJECTED (red) / BLOCKED (orange) / PENDING (sky). X-axis: day labels (Mon, Tue…). Y-axis: count. Hover tooltip shows exact counts per segment.

Header: "Command Volume — Last 7 Days".

**Role-specific differences:**
- Operator: Pipeline shows only their own commands. Activity feed shows all events. Charts show system-wide.
- Approver: Pipeline shows all commands. Pending approval count cards are clickable → navigate to /approvals. Approval queue summary widget shown instead of charts.
- Admin: All panels visible. Stats include security-specific counters. "View System Health" link to /admin.

**Navigation**: This page is reached from the sidebar "Mission Control" item (first item, Globe or LayoutDashboard icon). It is the post-login landing page for all roles (each role sees their customized version).

---

### 3.7 Page — Emergency Override Control

**Purpose**: Dedicated page for approvers to activate, monitor, and understand emergency override. High-friction design — the severity of this action must be felt by the user.

**Layout**: Centered single-column content, max-w-2xl. No split panels — full focus on one action.

**Override Status Card (always visible at top):**

*Inactive state:*
- Surface-2 card, 24px padding
- Header: "Override Status" with Lock icon
- Status indicator: large neutral chip "● NO ACTIVE OVERRIDE"
- Body text: "All commands are subject to the standard risk-based authorization policy. Dual-approval is required for HIGH risk commands."
- Border: default, no color accent

*Active state:*
- Card border: red/purple left border + subtle red-tinted background
- Header: "OVERRIDE ACTIVE" — text-red-400, Lock icon pulsing
- Large countdown timer: "08:32" in text-4xl monospace, counting down in real-time
- "Activated by: [username]" secondary text
- "Justification: [text]" in a quoted block
- "All commands are currently auto-dispatching without approval review." in amber warning text
- No dismiss button — override expires automatically

**Override Activation Form (shown below status card when no active override):**

Section header: "Activate Emergency Override" with AlertTriangle icon, amber color.

Warning box (mandatory, always visible):
```
┌─ amber border ──────────────────────────────────────────────────────┐
│  ⚠  This action bypasses the dual-approval security policy.         │
│     All commands submitted during the override window are           │
│     automatically dispatched without human review.                  │
│                                                                     │
│     Your identity and justification will be permanently recorded    │
│     in the tamper-evident audit ledger.                             │
│                                                                     │
│     Override duration: 10 minutes. Cannot be cancelled once active. │
└─────────────────────────────────────────────────────────────────────┘
```

Justification textarea (spacious, 6 rows):
- Label: "Operational Justification (required, minimum 20 characters)"
- Character counter shown at all times: "X / 500"
- Counter turns from red → amber → green as character count crosses 20
- Below 20: "Activate" button is disabled, reason shown ("Justification too short — N more characters needed")

Activate button:
- Full-width, 48px height, red-600 background, Lock icon
- Text: "Activate Emergency Override (10 minute window)"
- Disabled until justification ≥ 20 chars
- On click: opens **Override Confirmation Modal** (see §4.9) before API call

**Override Confirmation Modal** (special variant):
- Title: "Confirm Emergency Override Activation" with ShieldAlert icon
- Three-point acknowledgment checklist — user must check all three before confirm becomes enabled:
  - "[ ] I confirm dual-approval is currently unavailable"
  - "[ ] I understand this bypasses the standard authorization policy"
  - "[ ] I accept that this action is permanently recorded under my identity"
- Confirm button: red, "I Understand — Activate Override"
- Cancel button: neutral ghost

**Post-activation state:**
After successful activation, the form section is replaced by a read-only "Override is active" panel matching the active state of the Status Card. User cannot activate another override while one is already running.

**Access**: Role APPROVER and ADMIN only. Operators see a 403 page if they navigate here.

---

### 3.8 Page — Operator Command History

**Purpose**: An operator's complete personal command history — every command they have ever submitted, with outcomes. Useful for reviewing past decisions and understanding risk patterns.

**Layout**: Full-width single-column. Filter bar at top, dense data table below, pagination at bottom.

**Page Header:**
- Title: "My Commands" with Terminal icon
- Subtitle: "Complete history of commands submitted under your account"
- Right: "Export CSV" button (ghost style, secondary — Phase 2 stub, shown disabled with tooltip "Available in Phase 2")

**Filter Bar:**
- Status filter: tab chips (All / Dispatched / Pending / Rejected / Blocked)
- Subsystem filter: dropdown (All subsystems / EPS / ADCS / CDH / TM / COMMS / PROP)
- Date range: quick date picker (Today / This week / This month / Custom)
- The filter state is reflected in the URL query params for shareability

**Command History Table:**
Dense table, 44px rows. Columns:
```
#     Time        Command Type       Subsystem   Risk Score   Status       Action
[seq] [HH:MM:SS]  [command_type]    [chip]      [score+tier] [badge]      [→ detail]
```

- `#`: Sequential row number (not the command ID), right-aligned, tertiary color
- Time: HH:MM relative ("3h ago"), full ISO timestamp in tooltip
- Command Type: primary text, semibold
- Subsystem: neutral chip
- Risk Score: number + colored tier badge side by side
- Status: colored status badge
- Action: "View →" ghost link that opens the Command Detail drawer

**Row color rules (matching original wireframe spec):**
- REJECTED: amber-tinted row background
- REPLAY_BLOCKED: orange-tinted row background
- EMERGENCY_OVERRIDE: purple-tinted row background
- BLOCKED: red-tinted row background
- DISPATCHED: default surface

**Command Detail Drawer** (slides in from the right, 480px width):
- Full detail view of the selected command: same content as §4.6 (Command Detail View) but read-only (no approval action buttons)
- Closes with × button or Escape key
- Does not navigate away from the history table

**Pagination:**
Same as §3.5. "Showing 1–20 of 134 commands."

**Empty state:**
- Terminal icon (48px, muted), "No commands yet"
- "Commands you submit will appear here with their risk scores and approval outcomes"
- "Submit Command →" button links to /dashboard

---

### 3.9 Page — Admin User Management (Phase 2 Stub)

**Purpose**: View and manage operator accounts. **MVP implementation**: read-only table. **Phase 2**: full CRUD.

**Layout**: Full-width. Header with "Add Operator" button (disabled in MVP, tooltip "Available in Phase 2"), then user table.

**User Table:**
```
Avatar  Name           Username     Role      Status    Created      Last Login   Actions
[init]  Wei Chen       op_chen      Operator  Active    2024-01-15   2h ago       [→ View]
[init]  Seo-yeon Kim   so_kim       Approver  Active    2024-01-15   14m ago      [→ View]
[init]  System Admin   admin_root   Admin     Active    2024-01-15   1d ago       [→ View]
```

- Avatar: 32px circle with user's initials, indigo background
- Role: colored chip (Operator = sky, Approver = amber, Admin = red)
- Status: Active (green chip) / Inactive (gray chip)
- "Add Operator" button visible but disabled with Phase 2 tooltip in MVP

**Phase 2 stub indicator**: Amber banner at top of page: "User management is read-only in this version. Full operator administration will be available in Phase 2."

---

### 3.10 Page — Admin Policy & Thresholds (Phase 2 Stub)

**Purpose**: Configure risk scoring thresholds, approval policy, and override settings.

**Layout**: Two columns — policy settings list left, preview/impact panel right.

**MVP implementation**: Display-only view of current settings from the backend config. No editing.

Policy groups displayed (read-only):
- **Risk Thresholds**: LOW max score (30), MEDIUM max score (70), HIGH min score (71)
- **Approval Policy**: Single approval threshold, dual approval threshold
- **Override Policy**: Override duration (10 min), cooldown period
- **Rate Limits**: Login attempts, command submission rate

Each setting: label + current value in a monospace chip + "Configured via ENV" tag.

**Phase 2 stub indicator**: Amber banner: "Policy configuration is read-only. Environment-variable based configuration is used in MVP. Policy editor will be available in Phase 2."

---

### 3.11 Page — User Profile & Settings

**Purpose**: Personal account details, display preferences, and session management.

**Layout**: Centered single column, max-w-lg. Two cards stacked.

**Card 1 — Account Information (read-only in MVP):**
- User avatar (64px circle, initials, indigo background) + full name (text-xl) + username (text-sm secondary) + role chip
- Info grid: Account created date, last login timestamp, session expires in X minutes
- "Change Password" button — ghost style (Phase 2 stub, disabled with tooltip)

**Card 2 — Display Preferences:**
- Theme preference: segmented control (System / Light / Dark) — immediately applies, saves to localStorage
- Time display: segmented control (Relative / Absolute / Both) — controls how timestamps display throughout the app
- "Save Preferences" button — indigo primary (preferences saved to localStorage only, no API call)

**Card 3 — Active Session:**
- Current JWT expiry countdown: "Session expires in XX:XX"
- "Refresh Session" button — calls POST /auth/refresh, updates token
- "Sign Out" button — danger/ghost style, clears token, redirects to /login

---

### 3.12 Page — Error Pages

**Purpose**: Graceful handling of navigation and auth errors. Branded, helpful, not generic browser errors.

**Shared layout**: Full-screen centered content, same surface-0 background as the app. No sidebar or topbar (these pages are standalone).

**404 — Not Found:**
- Large "404" in text-6xl, tertiary color, monospace
- "Page not found" heading, text-xl
- "The page you're looking for doesn't exist or has been moved."
- Two buttons: "← Go Back" (ghost) + "Dashboard" (primary)

**403 — Access Denied:**
- ShieldAlert icon (64px, red-400)
- "Access Restricted" heading
- "Your role ([ROLE]) does not have permission to view this page."
- One button: "← Back to [role's home page]" (primary)

**500 — Server Error:**
- AlertTriangle icon (64px, amber-400)
- "Something went wrong" heading
- "An unexpected server error occurred. This has been logged automatically."
- Two buttons: "Try Again" (reloads) + "Back to Dashboard" (primary)

**Session Expired (401):**
- Lock icon (64px, indigo-400)
- "Session Expired" heading
- "Your session has expired for security reasons. Please sign in again."
- One button: "Sign In →" (primary, navigates to /login)
- Auto-redirect to /login after 5 seconds with countdown: "Redirecting in X…"

---

## 4. Component Requirements

### 4.1 Command Terminal

**Container**: White/surface-2 card, 24px padding, rounded-lg, full height of column.

**Anatomy (top to bottom):**

**Header row:**
- "Command Terminal" label (text-base, semibold)
- Divider below

**Form — Subsystem selector:**
- Label: "Subsystem"
- Full-width select dropdown, 40px height
- Options: EPS, ADCS, CDH, TM, COMMS, PROP (with full names as display text, codes as values)
- Placeholder: "Select subsystem…"

**Form — Command Type selector:**
- Label: "Command Type"
- Full-width select dropdown, 40px height
- Dynamically filtered based on selected subsystem
- Placeholder: "Select command…"
- Each option shows command code + description (two-line option layout in dropdown)

**Form — Nonce field:**
- Label: "Command Nonce" with a tooltip icon (ⓘ) — hover shows "Unique ID preventing replay attacks. Auto-generated per session."
- Read-only text input in monospace, font-size 12px, text tertiary color
- "↺ Regenerate" link button on the right — regenerates UUID v4 on click

**Submit button:**
- "Submit Command" full-width button, indigo-600, 40px height, ArrowUp icon left
- Disabled if no subsystem or command type selected
- Loading state: spinner + "Submitting…"

**Idle state footer** (shown when no result yet):
- Dashed border box, text-sm, secondary color
- "Submit a command to see risk assessment" with shield-question icon

---

### 4.2 Risk Score Card

**Visible**: Only after a command is submitted (slides in with 200ms translateY animation).

**Header row:**
- "Risk Assessment" label + risk tier badge (pill, color-matched to tier)
- Divider

**Score display:**
- Large numeric score — text-5xl, bold, color-matched to risk tier
- Below score: "/ 100" in secondary color, text-xl

**Justification:**
- AI-generated explanation text, text-sm, secondary color, line-height comfortable
- Max 4 lines visible, "Show more" expander if longer

**Metadata chips row (horizontal scroll on overflow):**
- SPARTA technique: indigo chip with ExternalLink icon
- CVSS estimate: amber chip
- Affected subsystems: neutral gray chips (one per subsystem)

**Sequence alerts (conditional):**
- Shown when sequence_alerts array is non-empty
- Amber-bordered box, AlertTriangle icon, lists each alert as a bullet
- Labeled "Sequence Anomalies Detected"

**Status section:**
Depends on command status:

- `AUTO_APPROVED` / `DISPATCHED`: Green checkmark, "Auto-approved and dispatched to satellite", DISPATCHED badge
- `PENDING_SINGLE_APPROVAL`: Shows 1 approval slot with spinner + operator name + "Awaiting approval"
- `PENDING_DUAL_APPROVAL`: Shows 2 approval slots. Each approver slot shows name + status (pending spinner, or "✓ Approved HH:MM:SS" in green when received via WebSocket)
- `REJECTED`: Red X, "Command rejected", timestamp, rejection reason if available
- `BLOCKED` / `REPLAY_BLOCKED`: Orange lock icon, "Command blocked — [reason]"
- `EMERGENCY_OVERRIDE`: Purple badge, "Dispatched under emergency override"

**Real-time update behavior:**
Status section updates live via WebSocket. When a `COMMAND_DISPATCHED` message arrives, the PENDING badges animate out and a green success state animates in. Do not show a spinner that persists indefinitely — show a "Connection lost" note if WS is disconnected and status is still pending after 30 seconds.

---

### 4.3 Telemetry Panel

**Variants and where each is used:**
- **Full read-only** — Mission Control Satellite Health card. Shows all metrics, no controls. This is the primary usage.
- **Read-only snapshot** — Approvals Command Detail View (§4.6). Shows satellite state at time of command submission, frozen timestamp.
- **Interactive** — Admin Telemetry Control (§3.4). Same layout, all metrics become editable controls in demo mode.

The satellite ID always comes from `selectedSatellite` context — never hardcoded.

**Container**: White/surface-2 card, 24px padding, rounded-lg.

**Header row:**
- "Satellite State" label + satellite ID chip (value from `selectedSatellite` — renders "SAT_ALPHA" in MVP)
- Auto-refresh countdown indicator: small text + RefreshCw icon, showing "Updated X seconds ago"

**Metrics grid (2-column on wide, 1-column on narrow):**

Each metric row:
- Label (secondary, text-sm, medium weight)
- Value (primary, text-base, semibold) with status-appropriate color
- Status indicator (color-coded dot or badge)

Rows:
1. **Battery** — Horizontal progress bar (full width below label/value). Color: green ≥50%, amber 20–49%, red <20%. Show percentage as text.
2. **Safe Mode** — Toggle-style indicator. "ACTIVE" (sky blue chip) or "INACTIVE" (gray chip). In DEMO_MODE, this is an interactive toggle.
3. **Thermal** — NOMINAL (green) / ELEVATED (amber) / CRITICAL (red) badge
4. **Orbital Phase** — SUNLIT (yellow-ish) / ECLIPSE (blue-gray) / PENUMBRA (purple) badge
5. **Link Margin** — Value in dB, color: ≥10dB green, 5–10dB amber, <5dB red
6. **Last Contact** — "N min ago" with clock icon, red if >15 minutes

**Demo Mode controls** (shown only when DEMO_MODE=true):
- Each metric gets an inline control (slider for battery, toggle for safe mode, segmented for thermal/orbital)
- "DEMO MODE" chip in the header makes this clear to the user
- "Update" button at bottom saves changes via PUT /telemetry/update

---

### 4.4 Alert Banner

**Trigger**: Appears when `sequence_alerts` array is non-empty on a submitted command, or when a `REPLAY_DETECTED` WebSocket message is received.

**Anatomy:**
- Left: colored vertical bar (4px) + icon (AlertTriangle for anomaly, ShieldAlert for replay)
- Content: bold alert title + description text (text-sm)
- Right: dismiss X button (×)

**Variants:**
- Sequence anomaly: amber border/background, AlertTriangle icon, "Sequence Anomaly Detected" title
- Replay attack: red border/background, ShieldAlert icon, "Replay Attack Blocked" title

**Behavior:** Dismissed by clicking × or automatically cleared when a new command is submitted.

---

### 4.5 Command Queue Card (Approver Queue)

**Container**: White/surface-2 card, 16px padding, rounded-lg, cursor-pointer, border-l-4 colored by risk tier (green/amber/red). Hover: surface-4 background.

**Selected state**: Indigo left border (overrides risk color), indigo-tinted background.

**Layout (compact, 44px-ish height):**
```
[RISK BADGE] [command_type]            [submitted_at relative]
             [subsystem]  [submitter]  [N/M approvals]  [status badge]
```

**Risk badge**: Large pill showing the tier text (LOW / MEDIUM / HIGH) with color coding. Or show the numeric score with the tier color.

**Command type**: text-base, semibold, primary color.

**Metadata row**: subsystem chip (neutral) + "by [username]" secondary text + approval progress "1 / 2" chip + status badge.

**Time**: right-aligned, relative ("2 min ago"), full timestamp on hover.

**Urgency indicator**: If a command has been pending > 3 minutes, show a amber "⚠ Expiring soon" chip.

---

### 4.6 Command Detail View (Approver Panel)

**Container**: White/surface-2 card, 24px padding, full height of right column. Spacious layout for deliberate review.

**Sections (top to bottom):**

**Section 1 — Command Identity**
- Command type as page-level headline (text-xl, bold)
- Subsystem + Command ID (monospace, truncated) + submitted timestamp
- "Submitted by [username]" chip

**Section 2 — Risk Assessment** (styled like a contained report)
- Score (text-5xl, bold, risk-colored) + tier badge
- AI justification paragraph
- Metadata chips (SPARTA, CVSS, affected subsystems)
- Sequence alerts if any

**Section 3 — Telemetry at Submission** (labeled "Satellite State at Submission Time")
- Read-only mini-telemetry display (no controls)
- Battery, safe mode, thermal, orbital phase — compact 2×3 grid
- Labeled "Context as of [timestamp]"

**Section 4 — Approval Actions** (only shown if status is PENDING_*)
Spacious, deliberate form area:
- Justification textarea: "Approval Justification", required, min 10 chars, 4 rows, full-width
- Placeholder: "Describe the operational rationale for this decision…"
- Character counter: "X / 1000"
- Two buttons side by side:
  - "✓ Approve Command" — emerald-600, full-width, CheckCircle2 icon
  - "✗ Reject Command" — red-600, full-width, XCircle icon
- Loading state for both: spinner + "Processing…"

**Confirmation dialog** (modal) for both approve AND reject:
- Approve: "Confirm Approval" — "You are approving [COMMAND_TYPE] on [SUBSYSTEM]. This action will be recorded in the tamper-evident audit ledger and cannot be undone." [Cancel] [Confirm Approval]
- Reject: "Confirm Rejection" — Same pattern with reject context. [Cancel] [Confirm Rejection]

**Section 5 — Current Approval Status**
- Shows who has already approved/rejected (for dual-approval commands)
- Each approver slot: avatar initials + name + decision badge + timestamp

---

### 4.7 Navigation Sidebar

**Width**: 240px (expanded), 64px (icon-only collapsed), hidden (mobile → bottom tabs).

**Sections:**
- Brand (top): Shield icon + "SCSP" (hidden when collapsed)
- Navigation items: icon + label (label hidden when collapsed). Active item: indigo left border, surface-4 background, primary text.
- User section (bottom): avatar initials bubble + username + role chip (hidden when collapsed) + logout icon.

**Collapse behavior**: Arrow chevron button at bottom-right of sidebar. Animated 200ms. Tooltip shown on hover of icon-only items.

---

### 4.8 Status Badge

Pill shape, semibold text, text-xs, 4px vertical padding 8px horizontal.

Color mappings (dark mode):
```
LOW:                    bg-emerald-950  text-emerald-400  border-emerald-800
MEDIUM:                 bg-amber-950    text-amber-400    border-amber-800
HIGH:                   bg-red-950      text-red-400      border-red-800
PENDING_SINGLE/DUAL:    bg-sky-950      text-sky-400      border-sky-800
AUTO_APPROVED/DISPATCHED: bg-emerald-950 text-emerald-400 border-emerald-800
REJECTED:               bg-red-950      text-red-400      border-red-800
BLOCKED/REPLAY_BLOCKED: bg-orange-950   text-orange-400   border-orange-800
EMERGENCY_OVERRIDE:     bg-purple-950   text-purple-400   border-purple-800
```

---

### 4.9 Confirmation Modal

**Purpose**: Required for all irreversible actions (approve, reject, override activate).

**Design:**
- Centered modal, max-w-md, elevated shadow, rounded-xl
- Backdrop: semi-transparent black (dark: rgba(0,0,0,0.65), light: rgba(0,0,0,0.35))
- Header: icon (contextual) + title, text-lg semibold
- Body: description text, text-sm secondary color
- Action details summary box: surface-3 background, border, shows key values being confirmed (command type, subsystem, operator)
- Footer: Cancel (neutral ghost button) + Confirm (color by action: emerald for approve, red for reject, purple for override)
- Close on backdrop click: NO — user must explicitly choose
- Escape key: cancels

---

### 4.10 Toast Notifications

**Position**: Bottom-right, 16px from edges. Stack vertically (newest on top).
**Auto-dismiss**: 4 seconds for success/info, 8 seconds for error (stays until dismissed manually).
**Variants**: success (emerald), error (red), warning (amber), info (sky).
**Anatomy**: Icon + title + optional description + dismiss X. Min-width 300px, max-width 420px.

---

### 4.11 Loading Skeleton

Used for data-fetching states (initial page load, refresh).

**Rules:**
- Table rows: shimmer rectangles matching actual row height and approximate column widths
- Cards: shimmer for heading + multiple lines
- Status badges: shimmer pill
- Use CSS animation: shimmer gradient from surface-3 → surface-4 → surface-3 horizontally, 1.5s loop

**Never use spinners for initial page loads** — only for in-place button loading states and WS connection indicator.

---

### 4.12 Approval Modal (Approver Full-Screen Review)

**Trigger**: Approver clicks a command queue card on mobile, or opens the detail modal on desktop when the split-panel is not available.

**Container**: Full-screen overlay modal, max-w-2xl, centered, rounded-xl, elevated shadow. Scrollable content inside. Fixed header + fixed footer.

**Fixed Header:**
- "Command Review" title + risk tier badge + dismiss × button (always visible)
- Sticky to top of modal — does not scroll with content

**Scrollable Content (sections):**

1. Command identity block: COMMAND_TYPE (text-xl, bold) + subsystem chip + command ID (mono) + submitted timestamp
2. AI Risk Assessment: score (text-5xl, risk-colored) + justification paragraph + metadata chips
3. Telemetry at Submission: compact 2×3 grid, read-only
4. Sequence Alerts: conditional amber box if any
5. Submitted by: username + full name + timestamp

**Fixed Footer (decision area):**
- Justification textarea: 3 rows, full width, "Required for rejection — optional for approval"
- Two buttons side by side, full width: "✗ Reject" (red) + "✓ Approve" (emerald)
- Both trigger the same ConfirmModal before API call

**Mobile-specific:** On screens < 768px, this modal is full-screen (no border-radius, no backdrop). The sticky footer contains the approve/reject buttons with 48px minimum height for tap targets.

---

### 4.13 Demo Mode Banner & Controls

**Demo Mode Banner:**
Shown at the top of every page when `DEMO_MODE=true`. Positioned directly below the top navigation bar, above page content.

```
┌─ amber border ──────────────────────────────────────────────────────┐
│  🔬  DEMO MODE ACTIVE  —  AI scoring is using fixture data.          │
│  Risk scores are pre-configured for demonstration purposes.          │
│                                            [Dismiss for session]     │
└─────────────────────────────────────────────────────────────────────┘
```
- Amber left border + amber-tinted background
- Dismiss button hides the banner for the current session (sessionStorage), but it re-appears on next page load
- Does NOT affect functionality — purely informational

**Demo Telemetry Controls:**
When `DEMO_MODE=true`, the Telemetry Panel gains an edit mode. An "Edit" button (pencil icon, ghost style) appears in the Telemetry Panel header. Clicking it toggles the panel into edit mode where static display values become interactive controls:

- Battery %: horizontal range slider (0–100), step 1
- Safe Mode: toggle switch
- Thermal Status: 3-way segmented control
- Orbital Phase: 3-way segmented control
- Link Margin: number input (0–30 dB)
- Last Contact: number input (minutes)

Changes are debounced 300ms and call `PUT /api/v1/telemetry/update`. A small "Saved" toast appears on success. The panel header shows "DEMO MODE" amber chip while in edit mode.

**Demo Tamper Button:**
Visible only in `APP_ENV=development`. Shown at the bottom of the Audit Ledger page as a separate card with a red outline:
```
┌─ red dashed border ─────────────────────────────────────────────────┐
│  ⚠  Development Controls — Not visible in production                │
│                                                                      │
│  [ 🔴 Tamper Ledger Entry #42 ]  ← red outline button               │
│  Simulates a hash chain integrity violation for demo purposes.       │
└──────────────────────────────────────────────────────────────────────┘
```
Calls `PUT /api/v1/ledger/demo-tamper`. On success: toast "Entry 42 tampered — run Verify Chain to detect the violation."

---

### 4.14 Live Activity Event Feed

**Used in**: Mission Control Dashboard (full version), Admin Dashboard (compact widget).

**Purpose**: Show the system's real-time operational heartbeat — not an audit log. The feed communicates that the system is alive and working. Three distinct visual tiers ensure the user's attention goes where it belongs.

**Event priority tiers:**

| Tier | Events | Visual treatment |
|---|---|---|
| **Critical** | REPLAY_ATTACK_BLOCKED, OVERRIDE_ACTIVATED, OVERRIDE_EXPIRED, LEDGER_INTEGRITY_FAILURE | Red or purple row tint, ShieldAlert/Lock icon, semibold text, full-weight event badge |
| **Operational** | COMMAND_SUBMITTED, COMMAND_DISPATCHED, COMMAND_APPROVED, COMMAND_REJECTED, SEQUENCE_ANOMALY, COMMAND_BLOCKED_TIMEOUT | Default surface, standard badge, normal weight |
| **Informational** | USER_LOGIN, TELEMETRY_UPDATE | Muted text (tertiary color), no badge, text-xs, indented 8px, no row tint |

**Full version (Mission Control):**
- Header: "System Heartbeat" + connection dot + "N events today" counter
- Auto-scrolling list, newest at top, 40px row height (Critical: 48px to give more visual weight)
- Row anatomy: `[timestamp] [icon] [event label] [command / detail] [operator]`
- Critical events: row background tinted (red for replay/blocked, purple for override), icon on left, full-weight text
- Operational events: default surface row, badge colored per event type
- Informational events: muted, no badge, smaller text — readable but not attention-grabbing
- Hover state: surface-4 background, cursor-pointer on operational/critical rows
- Click: opens detail drawer with full ledger entry (for operational/critical events)
- Pause on hover: "⏸ Paused" chip, auto-scroll resumes on cursor leave
- "Open audit ledger →" ghost link at the bottom

**Compact widget version (Admin Dashboard):**
- Shows last 5 events, all tiers
- No auto-scroll — static snapshot that refreshes every 10s
- "View all events →" link opens /ledger
- Critical tier rows still get full color treatment even in compact form

---

### 4.15 Command Pipeline Visualization

**Used in**: Mission Control Dashboard, left column.

**Full description**: A vertical list of recent command cards, each showing the command's progress across the 5 pipeline stages.

**Individual pipeline card (64px height):**
```
[RISK BADGE]  [command_type]           [subsystem]  [operator]  [time]
              ●────●────●────○────────────────○
              Sub Score Rev  Approve        Dispatch
```

Stage dots:
- Filled (●): stage completed — indigo-600 fill
- Active (◉): current stage — pulsing animation, indigo-400 with glow
- Empty (○): not yet reached — surface-4 fill, border only

Connector line between stages: solid for completed transitions, animated dashed for the active transition, dotted for future.

Color of the left risk badge sets the card's left border color.

**Interaction**: Clicking a pipeline card navigates to the command detail (operators see their own, approvers/admins see all).

---

### 4.16 Risk Distribution Chart

**Used in**: Mission Control Dashboard, charts row.

**Library**: Recharts (already in Next.js ecosystem, lightweight, SSR-friendly). Do NOT use Chart.js or D3 directly.

**Donut chart spec:**
- Inner radius: 60px, outer radius: 90px
- Segments: LOW (emerald-500), MEDIUM (amber-500), HIGH (red-500)
- Center label: total count (text-2xl bold) + "commands today" (text-xs secondary)
- No animation on initial render (respects `prefers-reduced-motion`)
- Hover: segment brightens, tooltip shows count + percentage
- Legend: 3 rows below chart — colored dot + tier label + count + percentage

**7-day sparkline bar:**
- Below the donut
- 7 stacked bars, one per day (Mon–Sun)
- Each bar stacked: LOW / MEDIUM / HIGH from bottom to top
- Bar width: fill available width / 7, with 4px gap between bars
- X-axis: day abbreviation (Mon, Tue…), today highlighted in primary color
- No Y-axis labels — height is relative only

---

### 4.17 Command Volume Chart

**Used in**: Mission Control Dashboard, charts row.

**Recharts BarChart, stacked:**
- X-axis: last 7 days (day labels)
- Y-axis: command count
- Stacks per bar: DISPATCHED (emerald), REJECTED (red), BLOCKED (orange), PENDING (sky)
- Grid lines: subtle, surface-3 color
- Tooltip: shows all segment counts for the hovered bar
- Legend: horizontal, below chart

---

### 4.18 Operator Presence Indicator

**Used in**: Mission Control Dashboard status ribbon (small), Admin Dashboard.

Shows which operators are currently active (have a valid JWT session within the last 5 minutes, approximated by recent activity).

**Compact version (status ribbon)**:
- "N operators online" chip with user icon
- Hovering shows a popover with the list of names

**Full version (Admin Dashboard widget)**:
- Avatar bubbles stacked horizontally (up to 6 visible, "+N more" if more)
- Each avatar: initials circle, 32px, colored by role (sky=operator, amber=approver, red=admin)
- Tooltip on hover: username + role + "last active X min ago"
- Note: Phase 2 feature — in MVP, show the currently authenticated user only with a "1 active session" label

---

### 4.19 Stat Card (KPI Card)

**Used in**: Mission Control status ribbon, Admin Dashboard, any page-level KPI display.

**Anatomy:**
- Surface-2 background, 16–24px padding, rounded-lg
- Accent left border (4px, semantic color)
- Metric value: text-3xl bold, primary color (or semantic if in a critical state)
- Label: text-sm, secondary color, medium weight
- Delta/subtitle: text-xs, tertiary color (e.g., "+12 from yesterday", "Last updated 3m ago")
- Optional icon: 20px, right-aligned, muted color

**State variants:**
- Default: indigo left border
- Warning (amber): amber left border + amber-tinted background + amber metric text
- Critical (red): red left border + red-tinted background + red metric text
- Positive (green): emerald left border for favorable metrics

**Interactive variant**: If the card links somewhere (e.g., Pending count → /approvals), show cursor-pointer and hover lifts with a 2px box-shadow increase.

---

## 5. UX Patterns

### 5.1 Real-time Connection Status

**Connected state** (WebSocket active):
- Pulsing green dot + "● Live" label in top bar
- Pulse animation: scale 1.0 → 1.4 → 1.0, opacity fade, 2s loop

**Degraded state** (polling fallback):
- Amber spinning icon + "⟳ Polling" label
- Tooltip on hover: "Live connection unavailable. Updates every 3 seconds."

**Disconnected state** (no WS, no polling):
- Red dot + "Disconnected" label
- Inline banner below top bar: "Real-time updates unavailable. Refresh the page to reconnect."

### 5.2 Role-Based UI Adaptation

The same layout adapts based on `role` from JWT payload:

| Element | Operator | Approver | Admin |
|---|---|---|---|
| Command Terminal | Visible | Hidden | Hidden |
| Approval Action buttons | Hidden | Visible | Hidden |
| Telemetry controls | Hidden | Hidden | Visible |
| Admin stat cards | Hidden | Hidden | Visible |
| Ledger "Verify Chain" | Hidden | Hidden | Visible |
| Override "Activate" | Hidden | Visible | Visible |

### 5.3 Approval Urgency Indicators

Commands pending > 3 minutes: amber "⚠ Expiring" chip on queue card.
Commands pending > 4.5 minutes (30s from auto-timeout): red "🔴 Expiring soon" chip.
When a command is auto-timeout-rejected: it disappears from the queue with a "Command timed out" toast.

### 5.4 Command Lifecycle Feedback

From the operator's perspective, after submit the Risk Score Card shows live progression:
1. Submit → brief loading state (300ms)
2. Score received → card animates in with risk number
3. If pending: approval slots show spinner with "Awaiting [name]…"
4. When WebSocket event fires: approval slot transitions to "✓ [name] approved"
5. On DISPATCHED: full card transitions to success state with checkmark

### 5.5 Form Validation UX

- Validation fires on blur (not on keydown — not intrusive)
- On submit with errors: first invalid field is focused automatically, error message slides in below field in red text, field border turns red
- Successful clear: green checkmark icon fades in on the right side of field, then disappears after 1 second

### 5.6 Empty States

Every list/table has a designed empty state:
- Approval queue empty: Shield with checkmark icon, "All clear — no pending commands", "Commands requiring your review will appear here in real-time"
- Ledger empty: BarChart3 icon, "No audit entries yet", "Events will appear here as commands are submitted"
- Generic: Shield question icon, "Nothing here yet"

---

## 6. Accessibility (WCAG 2.1 AA Target)

- **Focus management**: All interactive elements must have visible focus ring (3px indigo glow). Tab order must be logical.
- **Keyboard navigation**: All dropdowns, modals, and dialogs must be fully keyboard-navigable. Escape closes modals/dropdowns.
- **ARIA**: All status badges use `role="status"` and `aria-label`. Modals use `role="dialog"` and `aria-labelledby`. Live WS data regions use `aria-live="polite"`.
- **Color**: Never use color alone to convey information — always pair with icon or text label (e.g., risk tier always shows text "HIGH" not just a red dot).
- **Contrast**: All text meets 4.5:1 contrast ratio. Large text (≥18px bold or ≥24px regular) meets 3:1. Test both light and dark modes.
- **Reduced motion**: Respect `prefers-reduced-motion`. Replace all transitions with instant when enabled.
- **Screen reader**: Risk Score Card updates must announce themselves via ARIA live region when status changes.

---

## 7. Page Inventory & Route Map

```
PUBLIC (no auth required):
  /login                      → Login page

AUTHENTICATED — all roles:
  /                           → redirects to role home (see below)
  /mission-control            → Mission Control Dashboard (§3.6)  ← role home for all roles
  /ledger                     → Audit Ledger (§3.5)
  /profile                    → User Profile & Settings (§3.11)

OPERATOR role:
  /dashboard                  → Operator Dashboard (§3.2)
  /commands                   → Operator Command History (§3.8)

APPROVER role (+ all operator routes above, read-only):
  /approvals                  → Approver Queue (§3.3)
  /override                   → Emergency Override Control (§3.7)

ADMIN role (+ all approver routes):
  /admin                      → Admin Dashboard (§3.4)
  /admin/users                → User Management (§3.9) [Phase 2 stub]
  /admin/policy               → Policy & Thresholds (§3.10) [Phase 2 stub]

ERROR PAGES:
  /404                        → Not Found (§3.12)
  /403                        → Access Denied (§3.12)
  /500                        → Server Error (§3.12)
```

**Role-based redirect on login:**
| Role | Landing page |
|---|---|
| operator | /mission-control (shows operator-flavored view) |
| approver | /mission-control (shows approver-flavored view) |
| admin | /mission-control (shows full admin view) |

**Unauthorized route access**: redirect to `/mission-control` with "Access restricted to [ROLE] role" toast. Do NOT send to /403 — that page is for unrecoverable server errors, not role mismatches.

**Unauthenticated access to any protected route**: redirect to `/login?next=[requested-path]`. After successful login, redirect back to the requested path.

---

## 8. Component File Map (Next.js App Router)

```
frontend/
├── app/
│   ├── layout.tsx                    ← Root layout: ThemeProvider, font loading, toast region
│   ├── page.tsx                      ← Root redirect → /mission-control or /login
│   ├── login/
│   │   └── page.tsx
│   ├── mission-control/
│   │   └── page.tsx                  ← §3.6 Mission Control Dashboard
│   ├── dashboard/
│   │   └── page.tsx                  ← §3.2 Operator Dashboard
│   ├── commands/
│   │   └── page.tsx                  ← §3.8 Operator Command History
│   ├── approvals/
│   │   └── page.tsx                  ← §3.3 Approver Queue
│   ├── override/
│   │   └── page.tsx                  ← §3.7 Emergency Override Control
│   ├── admin/
│   │   ├── page.tsx                  ← §3.4 Admin Dashboard
│   │   ├── users/
│   │   │   └── page.tsx              ← §3.9 User Management (Phase 2 stub)
│   │   └── policy/
│   │       └── page.tsx              ← §3.10 Policy & Thresholds (Phase 2 stub)
│   ├── ledger/
│   │   └── page.tsx                  ← §3.5 Audit Ledger
│   ├── profile/
│   │   └── page.tsx                  ← §3.11 User Profile & Settings
│   └── (errors)/
│       ├── not-found.tsx             ← §3.12 404
│       ├── forbidden.tsx             ← §3.12 403
│       └── error.tsx                 ← §3.12 500
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx              ← Sidebar + topbar wrapper for authenticated pages
│   │   ├── Sidebar.tsx               ← §4.7 collapsible nav sidebar
│   │   ├── TopBar.tsx                ← top bar with satellite chip + connection status
│   │   ├── ThemeToggle.tsx           ← dark/light/system toggle
│   │   └── DemoModeBanner.tsx        ← §4.13 demo mode indicator strip
│   │
│   ├── mission-control/
│   │   ├── StatusRibbon.tsx          ← §3.6 five KPI stat cards row
│   │   ├── CommandPipeline.tsx       ← §4.15 live command pipeline visualization
│   │   ├── ActivityEventFeed.tsx     ← §4.14 live event stream
│   │   ├── SatelliteSummary.tsx      ← §3.6 compact telemetry summary
│   │   ├── RiskDistributionChart.tsx ← §4.16 donut + sparkline
│   │   └── CommandVolumeChart.tsx    ← §4.17 7-day stacked bar chart
│   │
│   ├── command/
│   │   ├── CommandTerminal.tsx       ← §4.1
│   │   └── RiskScoreCard.tsx         ← §4.2
│   │
│   ├── telemetry/
│   │   ├── TelemetryPanel.tsx        ← §4.3 (full version with demo controls)
│   │   └── TelemetryControl.tsx      ← admin edit panel
│   │
│   ├── approvals/
│   │   ├── CommandQueueCard.tsx      ← §4.5
│   │   ├── CommandDetailView.tsx     ← §4.6
│   │   └── ApprovalModal.tsx         ← §4.12 mobile full-screen review modal
│   │
│   ├── override/
│   │   ├── OverrideStatusCard.tsx    ← active/inactive override status display
│   │   └── OverrideActivationForm.tsx ← §3.7 justification form + warning box
│   │
│   ├── ledger/
│   │   ├── LedgerTable.tsx           ← §3.5 dense hash-chain table
│   │   ├── LedgerRowDetail.tsx       ← inline accordion expansion with hashes
│   │   ├── ChainVerifyResult.tsx     ← success/failure verification panel
│   │   └── DemoTamperButton.tsx      ← §4.13 dev-only tamper control
│   │
│   ├── admin/
│   │   ├── AdminStatCards.tsx        ← §3.4 four KPI cards
│   │   ├── UserTable.tsx             ← §3.9 operator list table
│   │   └── PolicyDisplay.tsx         ← §3.10 read-only policy view
│   │
│   ├── commands/
│   │   ├── CommandHistoryTable.tsx   ← §3.8 personal command history
│   │   └── CommandDetailDrawer.tsx   ← §3.8 slide-in detail panel
│   │
│   └── ui/                           ← Primitive reusable components
│       ├── Badge.tsx                 ← §4.8 status + risk tier badges
│       ├── AlertBanner.tsx           ← §4.4 anomaly + replay banners
│       ├── ConfirmModal.tsx          ← §4.9 irreversible action confirmation
│       ├── Toast.tsx                 ← §4.10 notification toasts
│       ├── ToastProvider.tsx         ← toast context + region
│       ├── Skeleton.tsx              ← §4.11 shimmer loading placeholders
│       ├── StatCard.tsx              ← §4.19 KPI card primitive
│       ├── OverrideStatusBar.tsx     ← §3.3 top-of-page override active banner
│       ├── ConnectionIndicator.tsx   ← WebSocket / polling status dot
│       ├── Countdown.tsx             ← live countdown timer (override expiry, rate limit)
│       └── EmptyState.tsx            ← consistent empty state layout
│
├── hooks/
│   ├── useAuth.ts                    ← JWT decode, role check, session refresh
│   ├── useTelemetry.ts               ← telemetry polling + PUT update
│   ├── useApprovalWebSocket.ts       ← WS connection, message dispatch, reconnect
│   ├── useCommandHistory.ts          ← paginated command history fetch
│   ├── useMissionControl.ts          ← aggregated data hook for mission control page
│   └── useTheme.ts                   ← theme read/write from localStorage
│
└── lib/
    ├── api.ts                        ← typed fetch wrappers for all endpoints
    ├── types.ts                      ← TypeScript interfaces (see COMPONENT_STATE_SPEC.md)
    └── utils.ts                      ← formatDate, formatRelativeTime, riskColor helpers
```

---

## 9. Design Decisions vs. Original Wireframe Spec

The following changes from the original ASCII wireframe spec in `WIREFRAMES.md` are **intentional overrides** for the enterprise design direction. Implement these requirements, not the original wireframe values:

| Original wireframe spec | Enterprise design override |
|---|---|
| `bg-gray-950` page background | `#0B0F19` deep navy (dark) / `#F3F6FB` cool off-white (light) |
| `font-mono` as primary font | "Inter" as primary; monospace only for hashes, UUIDs, hex |
| No sidebar — horizontal top nav only | Left sidebar (240px, collapsible) — industry standard for dashboard apps |
| No light mode | Full light/dark toggle with `localStorage` persistence |
| ASCII-defined spacing | Proper 4px-grid spacing system with defined scale |
| All buttons in `bg-indigo-600` | Full button variant system (primary, danger, ghost, secondary) |
| No empty states defined | All lists/tables have designed empty states |
| No confirmation dialogs | Approve and reject require confirmation modal |
| No toast system | Toast notifications for all async action outcomes |
| No loading skeletons | Skeleton loaders for all async data |

---

## 10. Design Deliverables Checklist (Pre-Development)

Before frontend development begins, the following mockup images should be generated and reviewed. Group into batches for image generation — each batch is a prompt set.

### Batch A — Authentication & Navigation Shell
- [ ] Login page — dark mode, default state
- [ ] Login page — light mode, default state
- [ ] Login page — dark mode, error state (invalid credentials shown)
- [ ] Login page — dark mode, rate limit error (countdown visible)
- [ ] Sidebar — expanded (240px), dark mode, operator role active
- [ ] Sidebar — collapsed (64px icon-only), dark mode
- [ ] Sidebar — expanded, light mode, approver role active
- [ ] Top bar — with override active indicator, dark mode
- [ ] Demo Mode Banner — dark mode, visible below top bar

### Batch B — Mission Control Dashboard
- [ ] Mission Control — dark mode, operator view, 2 commands in pipeline, activity feed populated
- [ ] Mission Control — dark mode, approver view, 3 pending approvals (stat card amber)
- [ ] Mission Control — dark mode, admin view, all panels visible, override active (red stat card)
- [ ] Mission Control — light mode, operator view, nominal state
- [ ] Mission Control — Risk Distribution donut chart (populated with LOW/MEDIUM/HIGH data)
- [ ] Mission Control — Command Volume 7-day bar chart
- [ ] Mission Control — Command Pipeline cards (3 commands: one dispatched, one pending, one high risk pending)
- [ ] Mission Control — Activity Feed (replay blocked event in red row visible)

### Batch C — Operator Dashboard & Command Flow
- [ ] Operator Dashboard — dark mode, command terminal idle (no result yet)
- [ ] Operator Dashboard — dark mode, HIGH risk score card visible, DUAL APPROVAL pending (0/2)
- [ ] Operator Dashboard — dark mode, HIGH risk, approval in progress (1/2 received, spinner on second)
- [ ] Operator Dashboard — dark mode, LOW risk, auto-dispatched state
- [ ] Operator Dashboard — dark mode, MEDIUM risk, single approval pending
- [ ] Operator Dashboard — light mode, HIGH risk, dual-approval pending
- [ ] Operator Dashboard — mobile (375px), command submitted, risk card visible
- [ ] Alert Banner — sequence anomaly variant (amber)
- [ ] Alert Banner — replay attack blocked variant (red)

### Batch D — Approver Queue & Decision Flow
- [ ] Approver Queue — dark mode, 3 pending commands in queue, DISABLE_SAFE_MODE selected in detail panel
- [ ] Approver Queue — dark mode, empty queue state
- [ ] Approver Queue — light mode, 2 commands, one HIGH one MEDIUM
- [ ] Approver Queue — override active purple bar visible at top
- [ ] Approver Queue — mobile (375px), queue card list view
- [ ] Approval Modal — dark mode, command detail filled, justification textarea empty
- [ ] Approval Confirmation Modal — approve variant (emerald confirm button)
- [ ] Approval Confirmation Modal — reject variant (red confirm button, three-checkbox layout)
- [ ] Command Detail View — telemetry snapshot section expanded
- [ ] Approver Queue — mobile, approval modal full-screen

### Batch E — Emergency Override
- [ ] Override Control — dark mode, inactive state (no active override)
- [ ] Override Control — dark mode, active state (countdown timer at 07:43 remaining)
- [ ] Override Control — light mode, inactive state, justification partially filled
- [ ] Override Confirmation Modal — three-checkbox acknowledgment (none checked yet)
- [ ] Override Confirmation Modal — all three checked, confirm button enabled (red)

### Batch F — Audit Ledger
- [ ] Audit Ledger — dark mode, populated table, no filter, paginator showing page 1 of 3
- [ ] Audit Ledger — dark mode, row expanded (inline accordion showing hash values)
- [ ] Audit Ledger — dark mode, chain verify SUCCESS result panel visible
- [ ] Audit Ledger — dark mode, chain verify FAILURE panel visible (tampering detected, entry #42 highlighted red)
- [ ] Audit Ledger — light mode, filtered to "Security" events only
- [ ] Audit Ledger — dark mode, Demo Tamper button visible (development mode)
- [ ] Audit Ledger — empty state

### Batch G — Admin Dashboard & Management
- [ ] Admin Dashboard — dark mode, all 4 stat cards, telemetry control panel
- [ ] Admin Dashboard — dark mode, 2 pending approvals (amber stat card), override inactive
- [ ] Admin Dashboard — light mode, nominal state
- [ ] Admin User Management — dark mode, 3 users in table (operator, approver, admin roles)
- [ ] Admin Policy Page — dark mode, read-only policy display with Phase 2 banner
- [ ] Admin Dashboard — activity feed compact widget visible

### Batch H — Command History & Profile
- [ ] Operator Command History — dark mode, table with mixed statuses (DISPATCHED, REJECTED, BLOCKED rows)
- [ ] Operator Command History — dark mode, Command Detail Drawer slid in from right
- [ ] Operator Command History — light mode, filtered to "Rejected" tab
- [ ] Operator Command History — empty state
- [ ] User Profile — dark mode, account info card + display preferences card
- [ ] User Profile — light mode

### Batch I — Error Pages & Edge Cases
- [ ] 404 Not Found — dark mode
- [ ] 403 Access Denied — dark mode
- [ ] 500 Server Error — dark mode
- [ ] Session Expired (401) — dark mode, 3-second countdown visible
- [ ] Connection Lost banner — dark mode, red disconnected indicator in top bar
- [ ] WS Polling fallback — amber polling indicator in top bar
- [ ] Skeleton loading state — Operator Dashboard columns loading
- [ ] Skeleton loading state — Audit Ledger table loading

---

## 11. Navigation Map (Sidebar Items by Role)

```
OPERATOR role:
  Globe/LayoutDashboard  Mission Control    /mission-control   ← home
  Terminal               Command Center     /dashboard
  ClipboardList          My Commands        /commands
  Hash                   Audit Ledger       /ledger
  ─────────────────────────────────────────────
  [user avatar + name + role chip]
  LogOut                 Sign Out

APPROVER role:
  Globe/LayoutDashboard  Mission Control    /mission-control   ← home
  CheckSquare            Approvals          /approvals
  AlertOctagon           Emergency Override /override
  Hash                   Audit Ledger       /ledger
  ─────────────────────────────────────────────
  [user avatar + name + role chip]
  LogOut                 Sign Out

ADMIN role:
  Globe/LayoutDashboard  Mission Control    /mission-control   ← home
  CheckSquare            Approvals          /approvals
  AlertOctagon           Emergency Override /override
  Hash                   Audit Ledger       /ledger
  Shield                 Admin              /admin             ← admin section divider
  Users                  User Management    /admin/users       ← Phase 2 stub
  Settings               Policy             /admin/policy      ← Phase 2 stub
  ─────────────────────────────────────────────
  [user avatar + name + role chip]
  Settings               Profile            /profile
  LogOut                 Sign Out
```

---

*This document supersedes design token values in `docs/WIREFRAMES.md` for all enterprise-mode development.
Reference `WIREFRAMES.md` only for layout structure and component inventory, not for colors, fonts, or spacing.*
