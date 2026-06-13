// Typed API client — all methods use fetch with Authorization header. T-023
import type {
  LoginRequest,
  LoginResponse,
  CommandSubmitRequest,
  CommandSubmitResponse,
  PendingCommand,
  ApprovalRequest,
  ApprovalResult,
  TelemetryState,
  TelemetryUpdate,
  LedgerPage,
  LedgerVerifyResult,
  OverrideActivateRequest,
  OverrideActivateResponse,
  OverrideStatus,
  PaginationParams,
  ApiError,
  SequenceAlert,
  AdminUser,
  CreateUserRequest,
  UpdateUserRequest,
  ActiveConfig,
  ConstellationStatus,
  SimulateEffectsRequest,
  SimulateEffectsResponse,
  SatelliteSimState,
} from "./types";

const BASE = "/api/v1";

// ── Sequence alert normalization ──────────────────────────────────────────────
// Submit responses carry full alert objects; stored commands (pending/detail)
// persist only rule IDs (TEXT[]). Normalize both to SequenceAlert objects.

const RULE_ELEVATIONS: Record<string, number> = {
  "SEQ-001": 20, "SEQ-002": 25, "SEQ-003": 30, "SEQ-004": 35, "SEQ-005": 40,
  BEHAVIORAL_DRIFT: 10,
};

function normalizeSequenceAlerts(alerts: unknown): SequenceAlert[] {
  if (!Array.isArray(alerts)) return [];
  return alerts.map((a) =>
    typeof a === "string"
      ? { rule_id: a, trigger_command: "see audit ledger", score_elevation: RULE_ELEVATIONS[a] ?? 0 }
      : (a as SequenceAlert),
  );
}

// ── Token storage helpers ─────────────────────────────────────────────────────
// Stored in both localStorage (quick client reads) and a JS-readable cookie
// (for middleware route protection on the server edge).

const TOKEN_KEY = "scsp_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  // Write a readable (non-httpOnly) cookie for middleware access
  const maxAge = 60 * 60; // 1h
  document.cookie = `scsp_token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  document.cookie = "scsp_token=; path=/; max-age=0; SameSite=Strict";
}

export function isStoredTokenValid(): boolean {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return !!payload.exp && payload.exp > Date.now() / 1000 + 30;
  } catch {
    return false;
  }
}

// ── Base fetch wrapper ────────────────────────────────────────────────────────

class ApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const token = getStoredToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let url = `${BASE}${path}`;
    if (params) {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params).map(([k, v]) => [k, String(v)]),
        ),
      );
      url = `${url}?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let errBody: ApiError | null = null;
      try {
        errBody = await res.json();
      } catch {
        // ignore parse failure
      }
      const code = errBody?.error?.code ?? "INTERNAL_ERROR";
      const message = errBody?.error?.message ?? `HTTP ${res.status}`;

      // On token errors: clear session and redirect to login to stop 401 floods
      if (
        res.status === 401 &&
        (code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID") &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        clearStoredToken();
        window.location.href = "/login";
      }

      const err = new Error(message) as Error & { code: string; status: number };
      err.code = code;
      err.status = res.status;
      throw err;
    }

    return res.json() as Promise<T>;
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async login(body: LoginRequest): Promise<LoginResponse> {
    return this.request<LoginResponse>("POST", "/auth/login", body);
  }

  async refresh(): Promise<{ access_token: string }> {
    return this.request<{ access_token: string }>("POST", "/auth/refresh");
  }

  // ── Account security (Phase 2): password change + TOTP MFA ─────────────────

  async changePassword(currentPassword: string, newPassword: string): Promise<{ changed: boolean }> {
    return this.request<{ changed: boolean }>("POST", "/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  async mfaStatus(): Promise<{ mfa_enabled: boolean }> {
    return this.request<{ mfa_enabled: boolean }>("GET", "/auth/mfa/status");
  }

  async mfaSetup(): Promise<{ secret: string; otpauth_uri: string }> {
    return this.request<{ secret: string; otpauth_uri: string }>("POST", "/auth/mfa/setup");
  }

  async mfaEnable(totpCode: string): Promise<{ mfa_enabled: boolean }> {
    return this.request<{ mfa_enabled: boolean }>("POST", "/auth/mfa/enable", { totp_code: totpCode });
  }

  async mfaDisable(currentPassword: string, totpCode: string): Promise<{ mfa_enabled: boolean }> {
    return this.request<{ mfa_enabled: boolean }>("POST", "/auth/mfa/disable", {
      current_password: currentPassword,
      totp_code: totpCode,
    });
  }

  // ── Commands ──────────────────────────────────────────────────────────────────

  async submitCommand(body: CommandSubmitRequest): Promise<CommandSubmitResponse> {
    const resp = await this.request<CommandSubmitResponse>("POST", "/commands", body);
    return { ...resp, sequence_alerts: normalizeSequenceAlerts(resp.sequence_alerts) };
  }

  async getPendingCommands(): Promise<PendingCommand[]> {
    const cmds = await this.request<PendingCommand[]>("GET", "/commands/pending");
    return cmds.map((c) => ({ ...c, sequence_alerts: normalizeSequenceAlerts(c.sequence_alerts) }));
  }

  async getCommand(id: string): Promise<PendingCommand> {
    const cmd = await this.request<PendingCommand>("GET", `/commands/${id}`);
    return { ...cmd, sequence_alerts: normalizeSequenceAlerts(cmd.sequence_alerts) };
  }

  async approveCommand(id: string, body: ApprovalRequest): Promise<ApprovalResult> {
    return this.request<ApprovalResult>("POST", `/commands/${id}/approve`, body);
  }

  async rejectCommand(id: string, body: ApprovalRequest): Promise<{ new_status: string }> {
    return this.request<{ new_status: string }>("POST", `/commands/${id}/reject`, body);
  }

  // ── Telemetry ─────────────────────────────────────────────────────────────────

  async getTelemetry(): Promise<TelemetryState> {
    return this.request<TelemetryState>("GET", "/telemetry/current");
  }

  async updateTelemetry(body: TelemetryUpdate): Promise<TelemetryState> {
    return this.request<TelemetryState>("PUT", "/telemetry/update", body);
  }

  // ── Ledger ────────────────────────────────────────────────────────────────────

  async getLedger(params?: PaginationParams): Promise<LedgerPage> {
    // Backend returns the array under "entries" — normalize to LedgerPage.items
    const raw = await this.request<Omit<LedgerPage, "items"> & { entries: LedgerPage["items"] }>(
      "GET", "/ledger", undefined, {
        page: params?.page ?? 1,
        per_page: params?.per_page ?? 20,
      },
    );
    const { entries, ...rest } = raw;
    return { ...rest, items: entries };
  }

  async verifyLedger(): Promise<LedgerVerifyResult> {
    return this.request<LedgerVerifyResult>("GET", "/ledger/verify");
  }

  async tamperLedger(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("PUT", "/ledger/demo-tamper");
  }

  // ── Admin (Phase 2) ───────────────────────────────────────────────────────────

  async listUsers(): Promise<AdminUser[]> {
    const resp = await this.request<{ users: AdminUser[] }>("GET", "/admin/users");
    return resp.users;
  }

  async createUser(body: CreateUserRequest): Promise<AdminUser> {
    return this.request<AdminUser>("POST", "/admin/users", body);
  }

  async updateUser(id: string, body: UpdateUserRequest): Promise<AdminUser> {
    return this.request<AdminUser>("PATCH", `/admin/users/${id}`, body);
  }

  async getActiveConfig(): Promise<ActiveConfig> {
    return this.request<ActiveConfig>("GET", "/admin/config");
  }

  /** Download a PDF report (compliance export, Phase 2 F-14) and save it. */
  async downloadReport(path: "/admin/reports/audit" | `/admin/reports/operator/${string}`): Promise<void> {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${getStoredToken() ?? ""}` },
    });
    if (!res.ok) {
      let message = `Report failed (${res.status})`;
      try {
        const body = (await res.json()) as ApiError;
        message = body.error?.message ?? message;
      } catch { /* non-JSON error body */ }
      throw new Error(message);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "scsp-report.pdf";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Simulation / Command Preview ──────────────────────────────────────────────

  async simulateEffects(body: SimulateEffectsRequest): Promise<SimulateEffectsResponse> {
    return this.request<SimulateEffectsResponse>("POST", "/simulate/effects", body);
  }

  async getSimSatellites(): Promise<SatelliteSimState[]> {
    return this.request<SatelliteSimState[]>("GET", "/simulate/satellites");
  }

  // ── Constellation (Phase 2 F-11) ──────────────────────────────────────────────

  async getConstellationStatus(): Promise<ConstellationStatus> {
    return this.request<ConstellationStatus>("GET", "/constellation/status");
  }

  // ── Override ──────────────────────────────────────────────────────────────────

  async activateOverride(body: OverrideActivateRequest): Promise<OverrideActivateResponse> {
    return this.request<OverrideActivateResponse>("POST", "/override/activate", body);
  }

  async getOverrideStatus(): Promise<OverrideStatus> {
    return this.request<OverrideStatus>("GET", "/override/status");
  }
}

export const api = new ApiClient();
