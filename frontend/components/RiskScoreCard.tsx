"use client";
// RiskScoreCard — score display, tier badge, justification, approval tracker. T-027
import { clsx } from "clsx";
import { Loader2, CheckCircle2, XCircle, Clock, ShieldAlert } from "lucide-react";
import { RiskTierBadge, CommandStatusBadge } from "./ui/StatusBadge";
import type { CommandSubmitResponse, CommandStatus, RiskTier } from "../lib/types";

// ── Circular score gauge ───────────────────────────────────────────────────────

const TIER_COLOR: Record<RiskTier, string> = {
  LOW:      "#22C55E",
  MEDIUM:   "#F59E0B",
  HIGH:     "#EF4444",
  CRITICAL: "#8B5CF6",
};

const TIER_TEXT_CLASS: Record<RiskTier, string> = {
  LOW:      "text-success",
  MEDIUM:   "text-warning",
  HIGH:     "text-danger",
  CRITICAL: "text-security",
};

export function ScoreGauge({ score, tier }: { score: number; tier: RiskTier }) {
  const radius = 52;
  const stroke = 8;
  const normalizedR = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedR;
  const filled = (score / 100) * circumference;
  const color = TIER_COLOR[tier];

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg
        className="absolute inset-0 -rotate-90"
        width={144}
        height={144}
        viewBox="0 0 144 144"
      >
        {/* Track */}
        <circle
          cx={72}
          cy={72}
          r={normalizedR}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={72}
          cy={72}
          r={normalizedR}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          style={{ transition: "stroke-dashoffset 0.6s ease-out, stroke 0.3s" }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className={clsx("text-4xl font-bold tabular-nums leading-none", TIER_TEXT_CLASS[tier])}>
          {score}
        </span>
        <RiskTierBadge tier={tier} />
      </div>
    </div>
  );
}

// ── Approval status tracker ────────────────────────────────────────────────────

function ApprovalTracker({ status, approvalsReceived = 0 }: { status: CommandStatus; approvalsReceived?: number }) {
  switch (status) {
    case "PENDING_SINGLE_APPROVAL":
      return (
        <div className="flex items-center gap-2 text-warning text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Awaiting 1 approval
        </div>
      );
    case "PENDING_DUAL_APPROVAL":
      return (
        <div className="flex items-center gap-2 text-warning text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {approvalsReceived} of 2 approvals received
        </div>
      );
    case "AUTO_APPROVED":
      return (
        <div className="flex items-center gap-2 text-success text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Auto-approved (LOW risk)
        </div>
      );
    case "DISPATCHED":
      return (
        <div className="flex items-center gap-2 text-success text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Command Dispatched ✓
        </div>
      );
    case "REJECTED":
      return (
        <div className="flex items-center gap-2 text-danger text-sm">
          <XCircle className="w-4 h-4" />
          Command Rejected
        </div>
      );
    case "BLOCKED":
      return (
        <div className="flex items-center gap-2 text-danger text-sm">
          <Clock className="w-4 h-4" />
          Command Blocked — approval timeout
        </div>
      );
    case "REPLAY_BLOCKED":
      return (
        <div className="flex items-center gap-2 text-security text-sm">
          <ShieldAlert className="w-4 h-4" />
          Replay Attack Blocked
        </div>
      );
    default:
      return <CommandStatusBadge status={status} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

interface RiskScoreCardProps {
  result: CommandSubmitResponse;
  liveStatus?: CommandStatus;
  approvalsReceived?: number;
}

export function RiskScoreCard({ result, liveStatus, approvalsReceived = 0 }: RiskScoreCardProps) {
  const displayStatus = liveStatus ?? result.status;

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-content-primary">AI Risk Assessment</h3>
        {result.demo_mode && (
          <span className="text-2xs text-warning border border-warning-border bg-warning-subtle px-1.5 py-0.5 rounded-xs">
            DEMO
          </span>
        )}
      </div>

      {/* Score gauge + metadata */}
      <div className="flex items-center gap-6">
        <ScoreGauge score={result.risk_score} tier={result.risk_tier} />

        <div className="flex-1 space-y-2.5">
          {result.sparta_technique && (
            <div>
              <div className="section-label mb-1">SPARTA Technique</div>
              <span className="font-mono text-sm text-content-primary">{result.sparta_technique}</span>
            </div>
          )}
          {result.cvss_estimate != null && (
            <div>
              <div className="section-label mb-1">CVSS Estimate</div>
              <span className="font-mono text-sm text-content-primary">{Number(result.cvss_estimate).toFixed(1)}</span>
            </div>
          )}
          {result.affected_subsystems.length > 0 && (
            <div>
              <div className="section-label mb-1">Affected Subsystems</div>
              <div className="flex flex-wrap gap-1">
                {result.affected_subsystems.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded-xs text-2xs font-mono font-semibold
                               bg-accent-subtle text-accent border border-accent-border"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Justification */}
      <div>
        <div className="section-label mb-1.5">Assessment</div>
        <p className="text-xs text-content-secondary leading-relaxed">{result.justification}</p>
      </div>

      {/* Sequence alerts */}
      {result.sequence_alerts.length > 0 && (
        <div className="space-y-1.5">
          <div className="section-label">Sequence Alerts</div>
          {result.sequence_alerts.map((alert) => (
            <div
              key={alert.rule_id}
              className="flex items-center gap-2 px-3 py-2 rounded bg-warning-subtle border border-warning-border"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-warning font-medium">{alert.rule_id}</span>
                <span className="text-xs text-content-muted ml-1.5">
                  triggered by {alert.trigger_command}
                </span>
              </div>
              <span className="text-2xs font-mono text-warning font-bold">+{alert.score_elevation}</span>
            </div>
          ))}
        </div>
      )}

      {/* Command ID */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
        <div className="section-label">Command ID</div>
        <span className="font-mono text-xs text-content-muted truncate max-w-[200px]">
          {result.command_id}
        </span>
      </div>

      {/* Approval status tracker */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
        <div className="section-label">Status</div>
        <ApprovalTracker status={displayStatus} approvalsReceived={approvalsReceived} />
      </div>
    </div>
  );
}

export default RiskScoreCard;
