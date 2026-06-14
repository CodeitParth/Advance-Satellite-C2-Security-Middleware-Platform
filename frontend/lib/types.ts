// TypeScript interfaces mirroring backend Pydantic models. T-023

// ── Enums ─────────────────────────────────────────────────────────────────────

export type Role = "operator" | "approver" | "admin";

export type CommandStatus =
  | "SUBMITTED"
  | "PARSING"
  | "SCORED"
  | "PENDING_SINGLE_APPROVAL"
  | "PENDING_DUAL_APPROVAL"
  | "AUTO_APPROVED"
  | "REJECTED"
  | "BLOCKED"
  | "DISPATCHED"
  | "REPLAY_BLOCKED"
  | "EMERGENCY_OVERRIDE";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ThermalStatus = "NOMINAL" | "ELEVATED" | "CRITICAL";
export type OrbitalPhase  = "SUNLIT" | "ECLIPSE" | "PENUMBRA";
export type ApprovalDecision = "APPROVED" | "REJECTED";

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface OperatorOut {
  id: string;
  username: string;
  role: Role;
  full_name: string;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  totp_code?: string; // required when the account has MFA enabled
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  operator: OperatorOut;
}

export interface TokenPayload {
  sub: string;
  role: Role;
  username: string;
  exp: number;
  token_type: string;
  command_id?: string;
}

// ── Commands ──────────────────────────────────────────────────────────────────

export interface SequenceAlert {
  rule_id: string;
  score_elevation: number;
  trigger_command: string;
}

export interface CommandSubmitRequest {
  packet_hex: string;
  nonce: string;
}

export interface CommandSubmitResponse {
  command_id: string;
  status: CommandStatus;
  risk_score: number;
  risk_tier: RiskTier;
  justification: string;
  sparta_technique: string | null;
  cvss_estimate: number | string | null;  // backend stores VARCHAR — coerce with Number() before formatting
  affected_subsystems: string[];
  sequence_alerts: SequenceAlert[];
  demo_mode: boolean;
}

export interface PendingCommand {
  id: string;
  submitter_id: string;
  submitter_username: string;
  status: CommandStatus;
  risk_score: number;
  risk_tier: RiskTier;
  command_type: string;
  subsystem: string;
  justification: string;
  sparta_technique: string | null;
  cvss_estimate: number | string | null;  // backend stores VARCHAR — coerce with Number() before formatting
  affected_subsystems: string[];
  sequence_alerts: SequenceAlert[];
  submitted_at: string;
  telemetry_snapshot: TelemetryState | null;
  approvals?: ApprovalOut[];
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  justification: string;
}

export interface ApprovalOut {
  id: string;
  command_id: string;
  approver_id: string;
  approver_username: string;
  decision: ApprovalDecision;
  justification: string;
  decided_at: string;
  is_override: boolean;
}

export interface ApprovalResult {
  command_id: string;
  new_status: CommandStatus;
  approvals_recorded: number;
  approvals_required: number;
  quorum_reached: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface TelemetryState {
  battery_percent: number;
  safe_mode: boolean;
  thermal_status: ThermalStatus;
  orbital_phase: OrbitalPhase;
  link_margin_db: number;
  updated_at: string;
}

export interface TelemetryUpdate {
  battery_percent?: number;
  safe_mode?: boolean;
  thermal_status?: ThermalStatus;
  orbital_phase?: OrbitalPhase;
  link_margin_db?: number;
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  entry_id: string;
  sequence: number;
  prev_hash: string;
  entry_hash: string;
  command_id: string | null;
  event_type: string;
  event_detail: Record<string, unknown>;
  operator_id: string | null;
  approver_ids: string[];
  timestamp: string;
}

export interface LedgerPage {
  items: LedgerEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LedgerVerifyResult {
  valid: boolean;
  entries_checked: number;
  corrupted_at_sequence: number | null;
  entry_id: string | null;
  verified_at: string;
}

// ── Override ──────────────────────────────────────────────────────────────────

export interface OverrideActivateRequest {
  justification: string;
}

export interface OverrideActivateResponse {
  token: string;
  expires_at: string;
}

export interface OverrideStatus {
  active: boolean;
  activated_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
}

// ── WebSocket messages ────────────────────────────────────────────────────────

export interface WSCommandPending {
  type: "COMMAND_PENDING";
  command_id: string;
  risk_tier: RiskTier;
  command_type: string;
  submitted_by: string;
}

export interface WSCommandDispatched {
  type: "COMMAND_DISPATCHED";
  command_id: string;
  approved_by: string[];
}

export interface WSCommandRejected {
  type: "COMMAND_REJECTED";
  command_id: string;
  rejected_by: string;
  reason: string;
}

export interface WSCommandEscalated {
  type: "COMMAND_ESCALATED";
  command_id: string;
}

export interface WSReplayDetected {
  type: "REPLAY_DETECTED";
  command_type: string;
  operator_id: string;
}

export interface WSOverrideActivated {
  type: "OVERRIDE_ACTIVATED";
  activated_by: string;
  expires_at: string;
}

export interface WSPing {
  type: "PING";
}

export interface WSConstellationAlert {
  type: "CONSTELLATION_ALERT";
  source_satellite: string;
  event_type: string;
  command_type: string;
  risk_score: number;
  timestamp: string;
  elevation_window_minutes: number;
  elevation_active: boolean;
}

export type WSMessage =
  | WSCommandPending
  | WSCommandDispatched
  | WSCommandRejected
  | WSCommandEscalated
  | WSReplayDetected
  | WSOverrideActivated
  | WSConstellationAlert
  | WSPing;

// ── API error ─────────────────────────────────────────────────────────────────

export interface ApiErrorDetail {
  code: string;
  message: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiError {
  error: ApiErrorDetail;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

// ── Admin (Phase 2) ───────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  username: string;
  role: Role;
  full_name: string | null;
  created_at: string;
  last_login: string | null;
  is_active: boolean;
  has_baseline: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: Role;
  full_name: string;
}

export interface UpdateUserRequest {
  is_active?: boolean;
  role?: Role;
  full_name?: string;
}

export interface ActiveConfig {
  risk_thresholds: { low_max: number; medium_max: number };
  approval: { single_approval_tier: string; dual_approval_tier: string; timeout_minutes: number };
  override: { window_minutes: number };
  drift: { min_sessions: number; z_threshold: number; score_elevation: number };
  rate_limits: { login_per_minute: number; commands_per_minute: number };
  demo_mode: boolean;
  gemini_model: string | null;
  app_env: string;
  generated_at: string;
}

// ── Simulation / Command Preview ──────────────────────────────────────────────

export interface CommandEffect {
  battery_delta: number;
  safe_mode: boolean | null;
  orbit_altitude_delta_km: number;
  animation: string;
  duration_ms: number;
  subsystems_affected: string[];
  payload_deployed: boolean;
  thermal_impact: "NONE" | "RISE" | "DROP";
}

export interface ProjectedState {
  battery_percent: number;
  safe_mode_active: boolean;
  thermal_status: string;
  orbital_phase: string;
  orbit_altitude_delta_km: number;
  payload_deployed: boolean;
}

export interface SimulateEffectsRequest {
  command_type: string;
  parameters?: Record<string, unknown>;
  current_telemetry?: Partial<TelemetryState>;
}

export interface SimulateEffectsResponse {
  command_type: string;
  effect: CommandEffect;
  current_state: ProjectedState;
  projected_state: ProjectedState;
  warnings: string[];
}

export interface SatelliteSimState {
  satellite_id: string;
  battery_percent: number;
  safe_mode_active: boolean;
  thermal_status: string;
  orbital_phase: string;
  altitude_km: number;
  is_local: boolean;
}

// ── Constellation (Phase 2 F-11) ──────────────────────────────────────────────

export interface ConstellationEvent {
  source_satellite: string;
  event_type: string;
  command_type: string;
  risk_score: number;
  timestamp: string;
  elevation_window_minutes: number;
}

export interface ConstellationPeer {
  satellite_id: string;
  last_event_at: string | null;
  online: boolean;
  // Simulated telemetry (populated by constellation_hub)
  battery_percent?: number;
  safe_mode_active?: boolean;
  thermal_status?: string;
  orbital_phase?: string;
  altitude_km?: number;
}

export interface ConstellationStatus {
  local_satellite: string;
  bus: "redis" | "simulated";
  elevation_active: boolean;
  elevated_until: string | null;
  elevation_source: string | null;
  peers: ConstellationPeer[];
  alerts: ConstellationEvent[];
  generated_at: string;
}
