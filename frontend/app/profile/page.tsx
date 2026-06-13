"use client";
// User Profile & Settings — identity, access scope, security, preferences.
// Follows mockups/"User Profile and settings dashboard.png".
// No profile API in MVP: identity comes from the JWT; the rest is informative.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Moon,
  Satellite,
  ShieldCheck,
  Sun,
  Timer,
} from "lucide-react";
import { RoleBadge } from "../../components/ui/StatusBadge";
import { AccountSecurityPanel } from "../../components/AccountSecurityPanel";
import { EditableDashboard, type DashboardPanel } from "../../components/layout-editor/EditableDashboard";
import { useAuth } from "../../hooks/useAuth";
import { getStoredToken, clearStoredToken } from "../../lib/api";
import type { Role } from "../../lib/types";

const ROLE_PERMISSIONS: Record<Role, { label: string; granted: boolean }[]> = {
  operator: [
    { label: "Submit commands for AI risk scoring", granted: true },
    { label: "View own command history", granted: true },
    { label: "View Mission Control", granted: true },
    { label: "Approve / reject commands", granted: false },
    { label: "Activate emergency override", granted: false },
    { label: "Telemetry override & ledger verification", granted: false },
  ],
  approver: [
    { label: "Submit commands for AI risk scoring", granted: true },
    { label: "View Mission Control & command history", granted: true },
    { label: "Approve / reject commands", granted: true },
    { label: "Activate emergency override", granted: true },
    { label: "Telemetry override & ledger verification", granted: false },
  ],
  admin: [
    { label: "Submit commands for AI risk scoring", granted: true },
    { label: "Approve / reject commands", granted: true },
    { label: "Activate emergency override", granted: true },
    { label: "Telemetry override (demo controls)", granted: true },
    { label: "Ledger verification & demo tamper", granted: true },
    { label: "User & policy administration", granted: true },
  ],
};

function tokenExpiry(): Date | null {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    return payload.exp ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const { operator, logout } = useAuth();
  const [isDark, setIsDark] = useState(true);
  const expiry = useMemo(tokenExpiry, []);

  // Live session countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setIsDark(!document.documentElement.classList.contains("light"));
  }, []);

  function toggleTheme(dark: boolean) {
    setIsDark(dark);
    document.documentElement.classList.toggle("light", !dark);
  }

  function handleLogout() {
    logout();
    clearStoredToken();
    router.replace("/login");
  }

  if (!operator) return null;

  const role = operator.role;
  const permissions = ROLE_PERMISSIONS[role];
  const sessionMinutesLeft = expiry ? Math.max(0, Math.round((expiry.getTime() - now) / 60_000)) : null;

  const panels: DashboardPanel[] = [
    {
      id: "profile-card",
      title: "Identity",
      defaultPlacement: { x: 0, y: 0, w: 4, h: 7, minW: 3, minH: 5 },
      render: () => (
        <div className="card p-5 h-full flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-accent text-white text-3xl font-bold mb-3">
            {(operator.full_name || operator.username).charAt(0).toUpperCase()}
          </div>
          <div className="text-lg font-semibold text-content-primary">{operator.full_name || operator.username}</div>
          <div className="font-mono text-xs text-content-muted mb-2">@{operator.username}</div>
          <RoleBadge role={role} />
          <div className="w-full mt-4 pt-3 border-t border-border-subtle space-y-2 text-left">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-content-muted uppercase tracking-wide">Operator ID</span>
              <span className="font-mono text-2xs text-content-secondary">{operator.id ? `${String(operator.id).slice(0, 8)}…` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-content-muted uppercase tracking-wide">Member since</span>
              <span className="text-2xs text-content-secondary">
                {operator.created_at ? new Date(operator.created_at).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xs text-content-muted uppercase tracking-wide">Ground station</span>
              <span className="text-2xs text-content-secondary">GS-1 · Local</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "role-access",
      title: "Role & Access Scope",
      defaultPlacement: { x: 4, y: 0, w: 5, h: 7, minW: 3, minH: 5 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Role &amp; Access Scope</h3>

          <div className="section-label mb-1.5">Authorized Satellites</div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded border border-accent-border bg-accent-subtle text-accent text-2xs font-mono font-semibold">
              <Satellite className="w-3 h-3" /> SAT_ALPHA
            </span>
            {["SAT_BRAVO", "SAT_CHARLIE"].map((sat) => (
              <span key={sat} className="flex items-center gap-1.5 px-2 py-1 rounded border border-dashed border-border text-content-disabled text-2xs font-mono">
                <Satellite className="w-3 h-3" /> {sat} · Phase 2
              </span>
            ))}
          </div>

          <div className="section-label mb-1.5">Permissions</div>
          <div className="space-y-1.5">
            {permissions.map((perm) => (
              <div key={perm.label} className="flex items-start gap-2">
                {perm.granted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-content-disabled shrink-0 mt-px" />
                )}
                <span className={perm.granted ? "text-2xs text-content-secondary" : "text-2xs text-content-disabled"}>
                  {perm.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "security-overview",
      title: "Security Overview",
      defaultPlacement: { x: 9, y: 0, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Security Overview</h3>
          <div className="space-y-2">
            {[
              { label: "bcrypt-hashed credentials", ok: true },
              { label: "JWT session (HS256, 60 min)", ok: true },
              { label: "Login rate limiting active", ok: true },
              { label: "Self-approval blocked", ok: true },
              { label: "Multi-factor auth (TOTP) available", ok: true },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                {item.ok ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-content-disabled shrink-0 mt-px" />
                )}
                <span className={item.ok ? "text-2xs text-content-secondary" : "text-2xs text-content-disabled"}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "active-session",
      title: "Active Session",
      defaultPlacement: { x: 0, y: 7, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Active Session</h3>
          <div className="flex items-start gap-3 p-3 rounded border border-success-border bg-success-subtle">
            <Laptop className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-content-primary">This browser · current</div>
              <div className="text-2xs text-content-muted">Ground station console</div>
            </div>
            <span className="status-dot status-dot-online mt-1.5" />
          </div>
          <div className="flex items-center gap-2 mt-3 text-2xs text-content-muted">
            <Timer className="w-3.5 h-3.5" />
            {sessionMinutesLeft !== null
              ? `Session token expires in ~${sessionMinutesLeft} min`
              : "Session expiry unknown"}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-auto flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded border
                       border-danger-border bg-danger-subtle text-danger text-xs font-semibold
                       hover:opacity-80 transition-opacity"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out of this session
          </button>
        </div>
      ),
    },
    {
      id: "preferences",
      title: "Preferences",
      defaultPlacement: { x: 4, y: 7, w: 5, h: 5, minW: 3, minH: 4 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Preferences</h3>

          <div className="flex items-center justify-between py-2 border-b border-border-subtle">
            <div>
              <div className="text-xs font-medium text-content-primary">Theme</div>
              <div className="text-2xs text-content-muted">Console color scheme</div>
            </div>
            <div className="flex rounded border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleTheme(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-2xs font-semibold transition-colors ${isDark ? "bg-accent text-white" : "bg-surface-2 text-content-muted"}`}
              >
                <Moon className="w-3 h-3" /> Dark
              </button>
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-2xs font-semibold transition-colors ${!isDark ? "bg-accent text-white" : "bg-surface-2 text-content-muted"}`}
              >
                <Sun className="w-3 h-3" /> Light
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-border-subtle">
            <div>
              <div className="text-xs font-medium text-content-primary">Dashboard layouts</div>
              <div className="text-2xs text-content-muted">Per-page panel arrangement, saved on this browser</div>
            </div>
            <span className="text-2xs text-content-secondary">Use “Edit Layout” on any dashboard</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-xs font-medium text-content-primary">Timestamps</div>
              <div className="text-2xs text-content-muted">Displayed in local time</div>
            </div>
            <span className="font-mono text-2xs text-content-secondary">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      defaultPlacement: { x: 9, y: 7, w: 3, h: 5, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-content-primary mb-1">Quick Actions</h3>
          <a href="/operator/ledger" className="btn-secondary w-full justify-center text-xs gap-1.5">
            View My Command History
          </a>
          {role === "admin" && (
            <a href="/admin/ledger" className="btn-secondary w-full justify-center text-xs gap-1.5">
              Open Audit Ledger
            </a>
          )}
          <p className="text-2xs text-content-muted mt-auto">
            Password &amp; MFA controls are in the Account Security panel below.
          </p>
        </div>
      ),
    },
    {
      id: "account-security",
      title: "Account Security",
      defaultPlacement: { x: 0, y: 12, w: 12, h: 8, minW: 4, minH: 6 },
      render: () => <AccountSecurityPanel />,
    },
  ];

  return (
    <EditableDashboard
      pageId="profile"
      pageTitle="Profile & Settings"
      panels={panels}
    />
  );
}
