"use client";
// ApprovalQueue — pending commands grouped by risk tier, with wait timers. T-029
// Layout follows mockups/satellite-command-approval-dashboard.png (left column).
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { PendingCommand, RiskTier } from "../lib/types";

const TIER_ORDER: RiskTier[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const TIER_HEADER: Record<RiskTier, { label: string; dot: string; text: string }> = {
  CRITICAL: { label: "Critical Risk", dot: "bg-security", text: "text-security" },
  HIGH:     { label: "High Risk",     dot: "bg-danger",   text: "text-danger" },
  MEDIUM:   { label: "Medium Risk",   dot: "bg-warning",  text: "text-warning" },
  LOW:      { label: "Low Risk",      dot: "bg-success",  text: "text-success" },
};

const TIER_STRIPE: Record<RiskTier, string> = {
  CRITICAL: "border-l-security",
  HIGH:     "border-l-danger",
  MEDIUM:   "border-l-warning",
  LOW:      "border-l-success",
};

const TIER_SCORE: Record<RiskTier, string> = {
  CRITICAL: "bg-security-subtle text-security border-security-border",
  HIGH:     "bg-danger-subtle text-danger border-danger-border",
  MEDIUM:   "bg-warning-subtle text-warning border-warning-border",
  LOW:      "bg-success-subtle text-success border-success-border",
};

const APPROVAL_TIMEOUT_S = 5 * 60; // commands time out to BLOCKED after 5 min

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface ApprovalQueueProps {
  commands: PendingCommand[];
  selectedId: string | null;
  onSelect: (cmd: PendingCommand) => void;
  isLive: boolean;
  filterTier?: RiskTier | "ALL";
  onFilterChange?: (tier: RiskTier | "ALL") => void;
}

export function ApprovalQueue({
  commands,
  selectedId,
  onSelect,
  isLive,
  filterTier = "ALL",
  onFilterChange,
}: ApprovalQueueProps) {
  // 1s tick for live wait timers
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const criticalCount = commands.filter((c) => c.risk_tier === "CRITICAL").length;
  const filtered = filterTier === "ALL" ? commands : commands.filter((c) => c.risk_tier === filterTier);

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-md font-semibold text-content-primary">Pending Approvals</h3>
          <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-2xs font-bold tabular-nums">
            {commands.length}
          </span>
        </div>
        <span
          className={clsx(
            "flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide",
            isLive ? "text-success" : "text-warning",
          )}
        >
          <span className={clsx("status-dot", isLive ? "status-dot-online" : "status-dot-warning")} />
          {isLive ? "Live" : "Polling"}
        </span>
      </div>

      {/* Critical alert strip */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-security-subtle border-b border-security-border shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 text-security shrink-0" />
          <span className="text-xs text-security font-medium">
            {criticalCount} CRITICAL command{criticalCount > 1 ? "s" : ""} await{criticalCount === 1 ? "s" : ""} your attention
          </span>
        </div>
      )}

      {/* Tier filter chips */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border-subtle overflow-x-auto scrollbar-none shrink-0">
        {(["ALL", ...TIER_ORDER] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onFilterChange?.(tier)}
            className={clsx(
              "px-2 py-1 rounded text-2xs font-semibold uppercase tracking-wide transition-colors shrink-0",
              filterTier === tier
                ? "bg-accent text-white"
                : "bg-surface-2 text-content-muted hover:text-content-secondary",
            )}
          >
            {tier === "ALL" ? `All (${commands.length})` : `${tier} (${commands.filter((c) => c.risk_tier === tier).length})`}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="w-10 h-10 text-success mb-3" />
            <p className="text-sm font-medium text-content-primary">No commands pending approval</p>
            <p className="text-xs text-content-muted mt-1">The queue is clear. New submissions appear here in real time.</p>
          </div>
        ) : (
          TIER_ORDER.map((tier) => {
            const group = filtered
              .filter((c) => c.risk_tier === tier)
              .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
            if (group.length === 0) return null;
            const header = TIER_HEADER[tier];

            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className={clsx("w-1.5 h-1.5 rounded-full", header.dot)} />
                  <span className={clsx("text-2xs font-bold uppercase tracking-widest", header.text)}>
                    {header.label}
                  </span>
                  <span className="text-2xs text-content-muted">({group.length})</span>
                </div>

                <div className="space-y-1.5">
                  {group.map((cmd) => {
                    const elapsedS = Math.max(0, (now - new Date(cmd.submitted_at).getTime()) / 1000);
                    const remainingS = APPROVAL_TIMEOUT_S - elapsedS;
                    const expiringSoon = remainingS > 0 && remainingS < 90;
                    const isSelected = cmd.id === selectedId;

                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => onSelect(cmd)}
                        className={clsx(
                          "w-full text-left rounded border border-l-2 px-3 py-2.5 transition-colors",
                          TIER_STRIPE[cmd.risk_tier],
                          isSelected
                            ? "bg-accent-subtle border-accent"
                            : "bg-surface-2 border-border hover:border-border-strong",
                          expiringSoon && !isSelected && "ring-1 ring-warning-border",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-content-primary truncate">
                            {cmd.command_type}
                          </span>
                          <span
                            className={clsx(
                              "px-1.5 py-0.5 rounded-xs border text-2xs font-bold tabular-nums shrink-0",
                              TIER_SCORE[cmd.risk_tier],
                            )}
                          >
                            {cmd.risk_score}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-3 text-content-secondary text-2xs font-bold shrink-0">
                              {cmd.submitter_username.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-2xs text-content-muted truncate">{cmd.submitter_username}</span>
                            <span className="text-2xs text-content-disabled">·</span>
                            <span className="text-2xs text-content-muted font-mono">{cmd.subsystem}</span>
                          </div>
                          <span
                            className={clsx(
                              "flex items-center gap-1 text-2xs font-mono tabular-nums shrink-0",
                              expiringSoon ? "text-warning font-semibold" : "text-content-muted",
                            )}
                            title={expiringSoon ? "Approval window closing soon" : "Time in queue"}
                          >
                            <Clock className="w-3 h-3" />
                            {formatElapsed(elapsedS)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border-subtle text-2xs text-content-muted shrink-0">
        Showing {filtered.length} of {commands.length} pending · commands time out after 5:00
      </div>
    </div>
  );
}

export default ApprovalQueue;
