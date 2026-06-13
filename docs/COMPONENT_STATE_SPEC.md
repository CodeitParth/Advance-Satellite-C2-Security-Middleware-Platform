# SCSP — Frontend Component State Specification
# TypeScript interfaces, prop types, and state shapes for all MVP components

---

## Shared Types (`frontend/lib/types.ts`)

```typescript
// ── Enums ────────────────────────────────────────────────────────────

export type Role = 'operator' | 'approver' | 'admin'

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH'

export type CommandStatus =
  | 'SUBMITTED'
  | 'PARSING'
  | 'SCORED'
  | 'PENDING_SINGLE_APPROVAL'
  | 'PENDING_DUAL_APPROVAL'
  | 'AUTO_APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'DISPATCHED'
  | 'REPLAY_BLOCKED'
  | 'EMERGENCY_OVERRIDE'

export type ThermalStatus = 'NOMINAL' | 'ELEVATED' | 'CRITICAL'
export type OrbitalPhase  = 'SUNLIT'  | 'ECLIPSE'  | 'PENUMBRA'
export type EventType     = 'COMMAND_SUBMITTED' | 'COMMAND_DISPATCHED' | 'COMMAND_REJECTED'
                           | 'COMMAND_BLOCKED_TIMEOUT' | 'REPLAY_BLOCKED'
                           | 'OVERRIDE_ACTIVATED' | 'OVERRIDE_EXPIRED' | 'SEQUENCE_ANOMALY'

// ── Core Data Models ─────────────────────────────────────────────────

export interface Operator {
  id:         string
  username:   string
  role:       Role
  full_name:  string
  created_at: string
}

export interface TelemetryState {
  satellite_id:      string
  battery_percent:   number
  safe_mode_active:  boolean
  thermal_status:    ThermalStatus
  orbital_phase:     OrbitalPhase
  link_margin_db:    number
  last_contact_min:  number
  updated_at:        string
}

export interface CommandSubmitResponse {
  command_id:          string
  status:              CommandStatus
  risk_score:          number
  risk_tier:           RiskTier
  justification:       string
  sparta_technique:    string | null
  cvss_estimate:       string | null
  affected_subsystems: string[]
  sequence_alerts:     string[]
  demo_mode:           boolean
}

export interface PendingCommand {
  id:                  string
  command_type:        string
  subsystem:           string
  risk_score:          number
  risk_tier:           RiskTier
  justification:       string
  sparta_technique:    string | null
  cvss_estimate:       string | null
  affected_subsystems: string[]
  sequence_alerts:     string[]
  telemetry_snapshot:  TelemetryState
  submitter_username:  string
  submitted_at:        string
  status:              CommandStatus
  approvals_received:  number
  approvals_required:  number
}

export interface ApprovalResult {
  command_id:          string
  new_status:          CommandStatus
  approvals_recorded:  number
  approvals_required:  number
  quorum_reached:      boolean
}

export interface LedgerEntry {
  entry_id:      string
  sequence:      number
  prev_hash:     string
  entry_hash:    string
  command_id:    string | null
  event_type:    EventType
  event_detail:  Record<string, unknown>
  operator_id:   string
  approver_ids:  string[]
  timestamp:     string
}

export interface LedgerPage {
  entries:      LedgerEntry[]
  total:        number
  page:         number
  per_page:     number
  total_pages:  number
}

export interface LedgerVerifyResult {
  valid:                    boolean
  entries_checked:          number
  corrupted_at_sequence?:   number
  entry_id?:                string
  verified_at:              string
}

export interface OverrideStatus {
  active:         boolean
  expires_at?:    string
  activated_by?:  string
  justification?: string
}

export interface LoginResponse {
  access_token:  string
  token_type:    string
  expires_in:    number
  operator:      Operator
}

// ── WebSocket Message Types ───────────────────────────────────────────

export type WSMessage =
  | { type: 'COMMAND_PENDING';    command_id: string; risk_tier: RiskTier; command_type: string; submitted_by: string }
  | { type: 'COMMAND_DISPATCHED'; command_id: string; approved_by: string[] }
  | { type: 'COMMAND_REJECTED';   command_id: string; rejected_by: string;  reason: string }
  | { type: 'COMMAND_ESCALATED';  command_id: string }
  | { type: 'REPLAY_DETECTED';    command_type: string; operator_id: string }
  | { type: 'OVERRIDE_ACTIVATED'; activated_by: string; expires_at: string }
  | { type: 'PING' }
  | { type: 'POLLING_UPDATE';     data: PendingCommand[] }

// ── API Error ────────────────────────────────────────────────────────

export interface ApiError {
  code:      string
  message:   string
  detail:    Record<string, unknown>
  timestamp: string
}
```

---

## Component Specifications

### `CommandTerminal`

```typescript
// Props
interface CommandTerminalProps {
  onScoreResult: (result: CommandSubmitResponse) => void
  onError:       (error: string) => void
  disabled?:     boolean   // true while a command is in PENDING state
}

// Internal state
interface CommandTerminalState {
  subsystem:    string          // selected subsystem, default ''
  commandType:  string          // selected command type, default ''
  nonce:        string          // UUID v4, regenerated after each submit
  isLoading:    boolean         // true during API call
  error:        string | null
}

// Behavior rules
// - subsystem dropdown shows all 5 subsystems always
// - commandType dropdown is empty and disabled until subsystem selected
// - commandType dropdown repopulates when subsystem changes (selection cleared)
// - nonce is shown read-only in a font-mono field with a [regen] icon button
// - Submit button disabled when: isLoading=true, subsystem='', commandType=''
// - After successful submit: nonce regenerated, form NOT cleared (allow resubmission with new nonce)
// - After failed submit: error message shown, form re-enabled
```

---

### `RiskScoreCard`

```typescript
// Props
interface RiskScoreCardProps {
  result:          CommandSubmitResponse
  currentStatus?:  CommandStatus          // updated via WS polling, may differ from result.status
  approvalsCount?: number                 // how many approvals received so far
  rejectionReason?: string               // set when status = REJECTED
}

// Internal state — none. Purely derived from props.

// Display rules
// score color:   0-30 = text-emerald-400 | 31-70 = text-amber-400 | 71-100 = text-red-400
// tier badge:    LOW=emerald | MEDIUM=amber | HIGH=red (bg-[color]-950 text-[color]-400)
// justification: always shown, text-sm text-gray-400
// sparta chip:   shown only if sparta_technique !== null
// cvss chip:     shown only if cvss_estimate !== null
// subsystem chips: one chip per affected_subsystem
// approval tracker: shown only if currentStatus is PENDING_* DISPATCHED REJECTED BLOCKED

// Approval tracker states:
// PENDING_SINGLE_APPROVAL: "Awaiting 1 approval" + 1 row with spinner
// PENDING_DUAL_APPROVAL (0 received): "Awaiting 2 approvals" + 2 rows with spinner
// PENDING_DUAL_APPROVAL (1 received): row 1 shows "✓ Approved" + row 2 shows spinner
// DISPATCHED: "✓ Command dispatched successfully" green banner
// REJECTED: "✗ Command rejected" + rejectionReason if provided, red banner
// BLOCKED: "✗ Command blocked — approval window expired" red banner
// REPLAY_BLOCKED: "✗ Replay attack detected and blocked" orange banner
// EMERGENCY_OVERRIDE: "✓ Dispatched under emergency override" purple banner
```

---

### `TelemetryPanel`

```typescript
// Props
interface TelemetryPanelProps {
  telemetry:     TelemetryState
  demoControls?: boolean          // show interactive sliders/toggles
  onUpdate?:     (updates: Partial<TelemetryState>) => Promise<void>
  isLoading?:    boolean
}

// Internal state
interface TelemetryPanelState {
  localBattery: number    // mirrors telemetry.battery_percent, updated immediately on slider drag
  isUpdating:   boolean   // true during onUpdate call
}

// Behavior rules
// - demoControls=false (default): all fields read-only
// - demoControls=true: battery slider (0-100 step 1), safe_mode toggle, thermal dropdown, orbital dropdown
// - slider drag updates localBattery immediately (for responsive feel)
// - onUpdate called after 300ms debounce from last slider change
// - link_margin_db and last_contact_min always read-only (no demo control)
// - Loading skeleton shown when isLoading=true (replaces values with animate-pulse bars)

// Battery display rules
// battery >= 50: emerald | 20-49: amber | 1-19: red | 0: red + "CRITICAL" label
// Battery bar: div with width = battery_percent%, color matches text color rule

// Color rules (other fields)
// safe_mode ON:             bg-sky-900 text-sky-400 badge
// safe_mode OFF:            bg-gray-800 text-gray-500 badge
// thermal NOMINAL:          text-emerald-400
// thermal ELEVATED:         text-amber-400
// thermal CRITICAL:         text-red-400
// orbital SUNLIT:           text-yellow-400
// orbital ECLIPSE:          text-blue-400
// orbital PENUMBRA:         text-purple-400
```

---

### `ApprovalQueue`

```typescript
// Props
interface ApprovalQueueProps {
  onSelectCommand: (command: PendingCommand) => void
}

// Internal state
interface ApprovalQueueState {
  commands:         PendingCommand[]
  isLoading:        boolean
  wsConnected:      boolean     // false = polling mode
  selectedId:       string | null
}

// Behavior rules
// - Initial load: GET /api/v1/commands/pending
// - Real-time updates via useApprovalWebSocket hook
// - On COMMAND_PENDING WS message: add to top of list (or re-fetch full list)
// - On COMMAND_DISPATCHED/REJECTED WS message: remove command from list
// - List sorted ascending by submitted_at (oldest first = most urgent)
// - Empty state: "No commands pending approval" with green checkmark
// - Connection status badge: "● Live" emerald dot | "⟳ Polling" gray dot

// Row display
// [RISK_BADGE] [command_type]  [subsystem]  Score: [N]  [submitter_username]  [X min ago]  →
// RISK_BADGE color: LOW=emerald | MEDIUM=amber | HIGH=red
// "X min ago" = relative time from submitted_at, updated every 30s
// Row hover: bg-gray-800 cursor
```

---

### `ApprovalModal`

```typescript
// Props
interface ApprovalModalProps {
  command:     PendingCommand
  onApprove:   (justification: string) => Promise<void>
  onReject:    (justification: string) => Promise<void>
  onClose:     () => void
}

// Internal state
interface ApprovalModalState {
  justification:  string
  isSubmitting:   boolean
  error:          string | null
  decision:       'approve' | 'reject' | null
}

// Validation rules
// - justification: REQUIRED only when decision='reject' AND risk_tier='HIGH'
// - justification: empty is OK for approve at any tier
// - justification: empty is OK for reject at LOW/MEDIUM
// - justification: minimum 1 char for reject at HIGH (show "Justification required for HIGH risk rejection")

// Behavior rules
// - Escape key and backdrop click call onClose (if not isSubmitting)
// - Approve/Reject buttons both disabled when isSubmitting=true
// - Button shows spinner + "Processing..." when isSubmitting=true
// - On success: onApprove/onReject resolves → call onClose
// - On error: set error string, re-enable buttons
```

---

### `LedgerTable`

```typescript
// Props
interface LedgerTableProps {
  entries:           LedgerEntry[]
  totalPages:        number
  currentPage:       number
  onPageChange:      (page: number) => void
  corruptedSequence: number | null   // null = no tamper detected, N = highlight row N
  isLoading:         boolean
}

// Internal state — none (all state managed by parent page)

// Row color rules
// event_type COMMAND_DISPATCHED:     bg-gray-900 (default)
// event_type COMMAND_REJECTED:       bg-amber-950
// event_type REPLAY_BLOCKED:         bg-orange-950
// event_type OVERRIDE_ACTIVATED:     bg-purple-950
// sequence === corruptedSequence:    bg-red-950 border border-red-700 (overrides above)

// Hash display
// Show first 12 chars + "..." in table cell
// Full hash available in title attribute (tooltip on hover)

// Columns: # | Time | Event | Command | Score | Operator | Hash
// Time: format as HH:MM:SS (local time)
// Score: shown as number if command_id not null, "—" if null (system events)
```

---

### `IntegrityChecker`

```typescript
// Props
interface IntegrityCheckerProps {
  onResult: (result: LedgerVerifyResult, corruptedSequence: number | null) => void
}

// Internal state
interface IntegrityCheckerState {
  isVerifying:  boolean
  lastResult:   LedgerVerifyResult | null
}

// Behavior rules
// - Button calls GET /api/v1/ledger/verify
// - Button shows "Verifying..." + spinner during call
// - On valid result: green banner with entries_checked and verified_at timestamp
// - On invalid result: red banner with sequence number and entry_id
// - Calls onResult with result + corruptedSequence (null if valid)
// - Banner persists until next verify run (not auto-dismissed)
```

---

### `AlertBanner`

```typescript
// Props
interface AlertBannerProps {
  type:       'sequence_anomaly' | 'replay_blocked' | 'override_active'
  title:      string
  message:    string
  onDismiss?: () => void    // if provided, show X button
}

// No internal state.
// amber bg for sequence_anomaly
// red bg for replay_blocked
// purple bg for override_active
// Dismiss button (×) calls onDismiss if provided
```

---

### `OverridePanel`

```typescript
// Props
interface OverridePanelProps {
  status:       OverrideStatus
  onActivate:   (justification: string) => Promise<void>
  onRefresh:    () => void
}

// Internal state
interface OverridePanelState {
  justification:      string
  showConfirmModal:   boolean
  isActivating:       boolean
  error:              string | null
  timeRemaining:      string    // "MM:SS" countdown string, updated every second
}

// Behavior rules
// - justification minimum 20 chars before activate button enables
// - Character counter shows current / 500 chars, turns text-emerald-400 at 20+
// - Click activate: show confirmation modal
// - Confirm in modal: call onActivate(justification)
// - Cancel in modal: close modal, form unchanged
// - When status.active=true: show active card with countdown, hide activation form
// - Countdown computed from status.expires_at vs Date.now(), updates every second via setInterval
// - When override expires (countdown reaches 0:00): call onRefresh to fetch new status
```

---

## Hook Specifications

### `useAuth`

```typescript
interface AuthState {
  operator:   Operator | null
  isLoading:  boolean
  isLoggedIn: boolean
}

interface UseAuthReturn extends AuthState {
  login:  (username: string, password: string) => Promise<void>
  logout: () => void
}

// Implementation notes
// - Token stored in localStorage key 'scsp_token' (MVP simplification)
// - On mount: decode stored token, check expiry, set operator
// - login(): calls api.login(), stores token, sets operator
// - logout(): clears localStorage, sets operator=null, redirects to /login
// - getStoredToken(): reads from localStorage, returns null if missing/expired
```

---

### `useTelemetry`

```typescript
interface UseTelemetryReturn {
  telemetry:       TelemetryState | null
  isLoading:       boolean
  error:           string | null
  updateTelemetry: (updates: Partial<TelemetryState>) => Promise<void>
  refresh:         () => void
}

// Implementation notes
// - Polls GET /api/v1/telemetry/current every 5000ms via setInterval
// - updateTelemetry calls PUT /api/v1/telemetry/update, then triggers refresh
// - Clears interval on component unmount (cleanup in useEffect return)
// - isLoading=true only on initial fetch, not on polling refreshes
```

---

### `useApprovalWebSocket`

```typescript
interface UseApprovalWebSocketReturn {
  connected:    boolean
  pollingMode:  boolean
}

// Props
type UseApprovalWebSocket = (
  onMessage: (msg: WSMessage) => void
) => UseApprovalWebSocketReturn

// Implementation notes (matches TRD §8.6 exactly)
// - WS URL: ${NEXT_PUBLIC_WS_URL}/ws/approvals?token=${token}
// - On error: setPollingMode(true)
// - On close: setTimeout(connect, 3000) — reconnect after 3s
// - Polling: setInterval fetch GET /api/v1/commands/pending every 3000ms
//            when pollingMode=true
// - Polling data packaged as { type: 'POLLING_UPDATE', data: commands }
//   and passed to onMessage — caller handles uniformly
// - Connected badge: pollingMode=false → "● Live" | pollingMode=true → "⟳ Polling"
```

---

## Page-Level State Management

All pages use local React state (useState/useReducer). No global state management
library (no Redux, no Zustand) for MVP. Props are passed down to components.

### Operator Dashboard page state

```typescript
interface OperatorDashboardState {
  lastResult:        CommandSubmitResponse | null   // from last command submission
  commandStatus:     CommandStatus | null           // updated by WS
  approvalsReceived: number                         // updated by WS
  rejectionReason:   string | null
  sequenceAlerts:    string[]                       // from last command response
  showAlertBanner:   boolean
}

// WS message handling in dashboard
// COMMAND_DISPATCHED where command_id === lastResult?.command_id:
//   → setCommandStatus('DISPATCHED')
// COMMAND_REJECTED where command_id === lastResult?.command_id:
//   → setCommandStatus('REJECTED'), setRejectionReason(reason)
```

### Approver Queue page state

```typescript
interface ApproverQueueState {
  pendingCommands:   PendingCommand[]
  selectedCommand:   PendingCommand | null    // for modal
  isModalOpen:       boolean
}

// WS message handling in approver queue
// COMMAND_PENDING:    add to pendingCommands (or re-fetch full list)
// COMMAND_DISPATCHED: remove matching command_id from pendingCommands
// COMMAND_REJECTED:   remove matching command_id from pendingCommands
// COMMAND_ESCALATED:  update matching command's status
```

### Admin Ledger page state

```typescript
interface AdminLedgerState {
  entries:            LedgerEntry[]
  currentPage:        number
  totalPages:         number
  filterEventType:    string | null
  verifyResult:       LedgerVerifyResult | null
  corruptedSequence:  number | null
  isLoadingLedger:    boolean
  isVerifying:        boolean
}
```
