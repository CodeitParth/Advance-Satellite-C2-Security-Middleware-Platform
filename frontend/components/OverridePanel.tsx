"use client";
// OverridePanel — emergency override building blocks. T-030
// Sections follow mockups/emergency-override-system-dashboard.png.
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  HeartPulse,
  Lock,
  Radio,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";
import type { OverrideStatus } from "../lib/types";

// ── Reason selector (step 1) ───────────────────────────────────────────────────

export const OVERRIDE_REASONS = [
  {
    id: "LIFE_SAFETY",
    label: "Life Threat / Safety Risk",
    description: "Immediate danger to crew, ground personnel, or the public",
    icon: HeartPulse,
  },
  {
    id: "COLLISION_AVOIDANCE",
    label: "Imminent Collision",
    description: "Conjunction warning requiring an immediate manoeuvre",
    icon: AlertTriangle,
  },
  {
    id: "COMM_LOSS",
    label: "Communication Loss Recovery",
    description: "Restoring contact after an extended loss-of-signal event",
    icon: Radio,
  },
  {
    id: "SECURITY_INCIDENT",
    label: "Security Incident Response",
    description: "Active intrusion or compromise requiring immediate commands",
    icon: ShieldAlert,
  },
  {
    id: "OTHER",
    label: "Other (Documented)",
    description: "Any other genuine emergency — document it in the justification",
    icon: FileWarning,
  },
] as const;

export type OverrideReasonId = (typeof OVERRIDE_REASONS)[number]["id"];

export function ReasonSelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: OverrideReasonId | null;
  onSelect: (id: OverrideReasonId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="card p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-content-primary mb-3">
        <span className="text-danger mr-1.5">1.</span>Select Reason for Override
      </h3>
      <div className="space-y-1.5" role="radiogroup" aria-label="Override reason">
        {OVERRIDE_REASONS.map((reason) => {
          const Icon = reason.icon;
          const isSelected = selected === reason.id;
          return (
            <button
              key={reason.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(reason.id)}
              className={clsx(
                "w-full flex items-start gap-2.5 px-3 py-2.5 rounded border text-left transition-colors",
                isSelected
                  ? "bg-danger-subtle border-danger-border"
                  : "bg-surface-2 border-border hover:border-border-strong",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Icon className={clsx("w-4 h-4 shrink-0 mt-0.5", isSelected ? "text-danger" : "text-content-muted")} />
              <div className="min-w-0">
                <div className={clsx("text-xs font-semibold", isSelected ? "text-danger" : "text-content-primary")}>
                  {reason.label}
                </div>
                <div className="text-2xs text-content-muted leading-relaxed">{reason.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Safeguards checklist (step 2) ──────────────────────────────────────────────

export const SAFEGUARDS = [
  "I understand this bypasses risk thresholds and multi-party approval requirements.",
  "I confirm this is a genuine mission emergency, not operational convenience.",
  "I am authorized to perform an Emergency Override for this mission.",
  "All commands issued during the override window will be flagged for mandatory post-event review.",
] as const;

export function SafeguardsChecklist({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean[];
  onToggle: (index: number) => void;
  disabled?: boolean;
}) {
  const allChecked = checked.every(Boolean);
  return (
    <div className="card p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-content-primary mb-3">
        <span className="text-danger mr-1.5">2.</span>Override Safeguards
      </h3>
      <div className="space-y-2">
        {SAFEGUARDS.map((text, i) => (
          <label
            key={i}
            className={clsx(
              "flex items-start gap-2.5 px-3 py-2.5 rounded border cursor-pointer transition-colors select-none",
              checked[i] ? "bg-surface-2 border-success-border" : "bg-surface-2 border-border",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => onToggle(i)}
              disabled={disabled}
              className="mt-0.5 accent-accent shrink-0"
            />
            <span className="text-2xs text-content-secondary leading-relaxed">{text}</span>
          </label>
        ))}
      </div>
      <div
        className={clsx(
          "flex items-center gap-2 mt-3 px-3 py-2 rounded text-xs font-medium",
          allChecked
            ? "bg-success-subtle border border-success-border text-success"
            : "bg-surface-2 border border-border text-content-muted",
        )}
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        {allChecked ? "All safeguards acknowledged" : `${checked.filter(Boolean).length} of ${SAFEGUARDS.length} acknowledged`}
      </div>
    </div>
  );
}

// ── Impact summary card ────────────────────────────────────────────────────────

export function OverrideImpactCard() {
  const impacts = [
    "Risk-tier approval gates are bypassed for the duration of the window",
    "Dual-approval requirement is suspended",
    "Commands dispatch immediately after AI scoring",
    "Override window closes automatically after 10 minutes",
  ];
  const audit = [
    "Every command is recorded as EMERGENCY_OVERRIDE in the ledger",
    "Activation, justification, and expiry are hash-chained",
    "All operators are notified in real time",
  ];
  return (
    <div className="card p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-content-primary mb-3">Override Impact</h3>
      <div className="space-y-1.5">
        {impacts.map((text) => (
          <div key={text} className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-danger mt-1.5 shrink-0" />
            <span className="text-2xs text-content-secondary leading-relaxed">{text}</span>
          </div>
        ))}
      </div>
      <div className="section-label mt-4 mb-2">Audit &amp; Monitoring</div>
      <div className="space-y-1.5">
        {audit.map((text) => (
          <div key={text} className="flex items-start gap-2">
            <span className="w-1 h-1 rounded-full bg-security mt-1.5 shrink-0" />
            <span className="text-2xs text-content-secondary leading-relaxed">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status banner / active session card ───────────────────────────────────────

export function OverrideStatusCard({ status }: { status: OverrideStatus | null }) {
  // 1s tick for the remaining-time countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!status?.active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status?.active]);

  if (!status?.active) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3 h-full">
        <span className="status-dot status-dot-online shrink-0" />
        <div>
          <div className="text-sm font-semibold text-content-primary">No active override</div>
          <div className="text-2xs text-content-muted">
            Standard tiered approval is in effect. Activating an override is logged and audited.
          </div>
        </div>
      </div>
    );
  }

  const remainingMs = status.expires_at ? new Date(status.expires_at).getTime() - now : 0;
  const remainingS = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = Math.floor(remainingS / 60);
  const ss = String(remainingS % 60).padStart(2, "0");

  return (
    <div className="h-full flex items-center gap-4 px-4 py-3 rounded-md border border-danger bg-danger-subtle shadow-glow-danger">
      <Siren className="w-6 h-6 text-danger shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-danger uppercase tracking-wide">Override Active</div>
        <div className="text-2xs text-content-secondary">
          Activated by <span className="font-semibold">{status.activated_by ?? "unknown"}</span>
          {status.activated_at && <> at {new Date(status.activated_at).toLocaleTimeString()}</>}
          {" — all commands bypass approval and are flagged for post-event review"}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-2xl font-bold text-danger tabular-nums">{mm}:{ss}</div>
        <div className="text-2xs text-content-muted">remaining</div>
      </div>
    </div>
  );
}

// ── Authorize panel (step 5) + confirmation modal ──────────────────────────────

const MIN_JUSTIFICATION = 20;
const MAX_JUSTIFICATION = 500;

export function AuthorizePanel({
  justification,
  onJustificationChange,
  reasonSelected,
  safeguardsComplete,
  overrideActive,
  busy,
  error,
  onActivate,
}: {
  justification: string;
  onJustificationChange: (v: string) => void;
  reasonSelected: boolean;
  safeguardsComplete: boolean;
  overrideActive: boolean;
  busy: boolean;
  error: string | null;
  onActivate: () => void;
}) {
  const trimmedLen = justification.trim().length;
  const justificationValid = trimmedLen >= MIN_JUSTIFICATION;
  const canActivate = reasonSelected && safeguardsComplete && justificationValid && !overrideActive && !busy;

  const blockers: string[] = [];
  if (overrideActive) blockers.push("an override is already active");
  if (!reasonSelected) blockers.push("select a reason");
  if (!safeguardsComplete) blockers.push("acknowledge all safeguards");
  if (!justificationValid) blockers.push(`justification needs ${MIN_JUSTIFICATION - trimmedLen} more characters`);

  return (
    <div className="flex flex-col h-full rounded-md border border-danger-border bg-surface-1 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-danger mb-3 flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Authorize Override
      </h3>

      <label className="block text-xs font-medium text-content-secondary mb-1.5">
        Justification <span className="text-content-muted">(minimum {MIN_JUSTIFICATION} characters)</span>
      </label>
      <textarea
        value={justification}
        onChange={(e) => onJustificationChange(e.target.value.slice(0, MAX_JUSTIFICATION))}
        rows={4}
        disabled={overrideActive || busy}
        className="input-base text-xs resize-none"
        placeholder="Describe the emergency that requires bypassing standard approval..."
      />
      <div
        className={clsx(
          "text-2xs mt-1 text-right tabular-nums",
          justificationValid ? "text-success" : "text-content-muted",
        )}
      >
        {trimmedLen}/{MAX_JUSTIFICATION} {!justificationValid && `· ${MIN_JUSTIFICATION} min`}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 mt-2 rounded bg-danger-subtle border border-danger-border">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <span className="text-xs text-danger">{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onActivate}
        disabled={!canActivate}
        className="mt-3 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded font-bold text-xs
                   uppercase tracking-wide bg-danger text-white hover:opacity-90 transition-opacity
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Siren className="w-4 h-4" />
        Activate Emergency Override
      </button>

      {!canActivate && blockers.length > 0 && (
        <p className="text-2xs text-content-muted mt-2 text-center">
          To enable: {blockers.join(" · ")}
        </p>
      )}

      <p className="text-2xs text-content-muted mt-auto pt-3 leading-relaxed">
        The override token expires automatically after <span className="font-semibold text-content-secondary">10 minutes</span>.
        Activation is broadcast to all connected operators.
      </p>
    </div>
  );
}

export function OverrideConfirmModal({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirm emergency override"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-danger bg-surface-1 shadow-glow-danger p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-danger-subtle border border-danger-border shrink-0">
            <Siren className="w-5 h-5 text-danger" />
          </div>
          <h2 className="text-md font-bold text-content-primary">Confirm Emergency Override</h2>
          <button type="button" onClick={onCancel} className="btn-ghost p-1.5 ml-auto" aria-label="Cancel">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-content-secondary leading-relaxed">
          This will bypass dual-approval for <span className="font-bold text-danger">10 minutes</span>.
          All commands during this period will be flagged for mandatory post-event review.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary justify-center">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded font-bold text-xs
                       bg-danger text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? "Activating…" : "Yes, Activate Override"}
          </button>
        </div>
      </div>
    </div>
  );
}
