import { clsx } from "clsx";
import type { CommandStatus, RiskTier } from "../../lib/types";

// ── Risk tier badge ───────────────────────────────────────────────────────────

const TIER_STYLES: Record<RiskTier, string> = {
  LOW:      "bg-success-subtle text-success border-success-border",
  MEDIUM:   "bg-warning-subtle text-warning border-warning-border",
  HIGH:     "bg-danger-subtle text-danger border-danger-border",
  CRITICAL: "bg-security-subtle text-security border-security-border",
};

export function RiskTierBadge({ tier }: { tier: RiskTier }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-xs border",
        "text-2xs font-bold tracking-widest uppercase",
        TIER_STYLES[tier],
      )}
    >
      {tier}
    </span>
  );
}

// ── Command status badge ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<CommandStatus, string> = {
  SUBMITTED:               "bg-surface-2 text-content-secondary border-border",
  PARSING:                 "bg-surface-2 text-content-secondary border-border",
  SCORED:                  "bg-accent-subtle text-accent border-accent-border",
  PENDING_SINGLE_APPROVAL: "bg-warning-subtle text-warning border-warning-border",
  PENDING_DUAL_APPROVAL:   "bg-warning-subtle text-warning border-warning-border",
  AUTO_APPROVED:           "bg-success-subtle text-success border-success-border",
  REJECTED:                "bg-danger-subtle text-danger border-danger-border",
  BLOCKED:                 "bg-danger-subtle text-danger border-danger-border",
  DISPATCHED:              "bg-success-subtle text-success border-success-border",
  REPLAY_BLOCKED:          "bg-security-subtle text-security border-security-border",
  EMERGENCY_OVERRIDE:      "bg-warning-subtle text-warning border-warning-border",
};

const STATUS_LABELS: Record<CommandStatus, string> = {
  SUBMITTED:               "Submitted",
  PARSING:                 "Parsing",
  SCORED:                  "Scored",
  PENDING_SINGLE_APPROVAL: "Pending Approval",
  PENDING_DUAL_APPROVAL:   "Pending 2 Approvals",
  AUTO_APPROVED:           "Auto-Approved",
  REJECTED:                "Rejected",
  BLOCKED:                 "Blocked",
  DISPATCHED:              "Dispatched",
  REPLAY_BLOCKED:          "Replay Blocked",
  EMERGENCY_OVERRIDE:      "Override",
};

export function CommandStatusBadge({ status }: { status: CommandStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-xs border",
        "text-2xs font-semibold tracking-wide uppercase",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Generic role badge ────────────────────────────────────────────────────────

const ROLE_STYLES = {
  operator: "bg-accent-subtle text-accent border-accent-border",
  approver: "bg-security-subtle text-security border-security-border",
  admin:    "bg-warning-subtle text-warning border-warning-border",
};

export function RoleBadge({ role }: { role: "operator" | "approver" | "admin" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-xs border",
        "text-2xs font-semibold tracking-wide uppercase",
        ROLE_STYLES[role],
      )}
    >
      {role}
    </span>
  );
}
