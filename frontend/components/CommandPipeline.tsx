import { clsx } from "clsx";
import Link from "next/link";
import {
  Send,
  Cpu,
  ShieldCheck,
  KeyRound,
  Rocket,
  ArrowRight,
  Clock,
} from "lucide-react";
import { RiskTierBadge, CommandStatusBadge } from "./ui/StatusBadge";
import type { PendingCommand, CommandStatus, RiskTier } from "../lib/types";

// Pipeline stage definition
const STAGES: {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  statuses: CommandStatus[];
}[] = [
  { key: "submit",   label: "Submit",        shortLabel: "CMD",    icon: Send,        statuses: ["SUBMITTED", "PARSING"] },
  { key: "ai",       label: "AI Analysis",   shortLabel: "AI",     icon: Cpu,         statuses: ["SCORED"] },
  { key: "review",   label: "Security Review", shortLabel: "SEC",  icon: ShieldCheck, statuses: ["PENDING_SINGLE_APPROVAL", "PENDING_DUAL_APPROVAL"] },
  { key: "auth",     label: "Authorization", shortLabel: "AUTH",   icon: KeyRound,    statuses: ["AUTO_APPROVED", "EMERGENCY_OVERRIDE"] },
  { key: "dispatch", label: "Dispatch",      shortLabel: "SAT",    icon: Rocket,      statuses: ["DISPATCHED"] },
];

function getStageIndex(status: CommandStatus): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].statuses.includes(status)) return i;
  }
  return -1; // rejected / blocked
}

function minutesAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

function formatAge(iso: string): string {
  const m = minutesAgo(iso);
  if (m < 1) return "<1m ago";
  if (m < 60) return `${Math.floor(m)}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const TIER_STRIPE: Record<RiskTier, string> = {
  LOW:      "border-l-success",
  MEDIUM:   "border-l-warning",
  HIGH:     "border-l-danger",
  CRITICAL: "border-l-security",
};

// Demo seed commands displayed before live data arrives
const DEMO_COMMANDS: PendingCommand[] = [
  {
    id: "c1a2b3c4-0000-0000-0000-000000000001",
    submitter_id:       "u1",
    submitter_username: "op_chen",
    status:             "PENDING_SINGLE_APPROVAL",
    risk_score:         87,
    risk_tier:          "HIGH",
    command_type:       "DISABLE_SAFE_MODE",
    subsystem:          "EPS",
    justification:      "Scheduled maintenance window — safe mode inhibits uplink.",
    sparta_technique:   "SA-0002",
    cvss_estimate:      8.3,
    affected_subsystems: ["EPS", "OBC"],
    sequence_alerts:    [],
    submitted_at:       new Date(Date.now() - 4 * 60_000).toISOString(),
    telemetry_snapshot: null,
  },
  {
    id: "c1a2b3c4-0000-0000-0000-000000000002",
    submitter_id:       "u1",
    submitter_username: "op_chen",
    status:             "SCORED",
    risk_score:         34,
    risk_tier:          "MEDIUM",
    command_type:       "REQUEST_TELEMETRY",
    subsystem:          "TM",
    justification:      "Routine status check.",
    sparta_technique:   null,
    cvss_estimate:      null,
    affected_subsystems: ["TM"],
    sequence_alerts:    [],
    submitted_at:       new Date(Date.now() - 1 * 60_000).toISOString(),
    telemetry_snapshot: null,
  },
  {
    id: "c1a2b3c4-0000-0000-0000-000000000003",
    submitter_id:       "u2",
    submitter_username: "op_tanaka",
    status:             "DISPATCHED",
    risk_score:         12,
    risk_tier:          "LOW",
    command_type:       "SET_BEACON_RATE",
    subsystem:          "TM",
    justification:      "Reduce beacon frequency during eclipse.",
    sparta_technique:   null,
    cvss_estimate:      null,
    affected_subsystems: ["TM"],
    sequence_alerts:    [],
    submitted_at:       new Date(Date.now() - 8 * 60_000).toISOString(),
    telemetry_snapshot: null,
  },
];

interface CommandPipelineProps {
  commands?: PendingCommand[];
}

export function CommandPipeline({ commands = DEMO_COMMANDS }: CommandPipelineProps) {
  // Sort: pending first (by age desc), then others
  const sorted = [...commands].sort((a, b) => {
    const isPendingA = a.status.includes("PENDING");
    const isPendingB = b.status.includes("PENDING");
    if (isPendingA !== isPendingB) return isPendingB ? 1 : -1;
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });

  // Stage counts for overview
  const stageCounts = STAGES.map((s) => ({
    ...s,
    count: commands.filter((c) => s.statuses.includes(c.status)).length,
  }));

  return (
    <div className="card flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-semibold text-content-primary">Command Pipeline</h2>
          <span className="live-badge">Live</span>
        </div>
        <Link href="/approver/queue" className="text-xs text-accent hover:text-accent-hover transition-colors">
          View All →
        </Link>
      </div>

      {/* Stage flow header */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center gap-1 min-w-[56px]">
                <div className={clsx(
                  "flex items-center justify-center w-7 h-7 rounded border",
                  stageCounts[i].count > 0
                    ? "bg-accent-subtle border-accent-border text-accent"
                    : "bg-surface-2 border-border text-content-muted",
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-2xs text-content-muted text-center leading-tight">{stage.shortLabel}</span>
                {stageCounts[i].count > 0 && (
                  <span className="text-2xs font-bold text-accent">{stageCounts[i].count}</span>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <ArrowRight className="w-3 h-3 text-content-disabled shrink-0 mb-4" />
              )}
            </div>
          );
        })}
      </div>

      {/* Command cards */}
      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-content-muted text-xs">No active commands</div>
        ) : (
          sorted.map((cmd) => {
            const stageIdx = getStageIndex(cmd.status);
            const isExpiring = cmd.status.includes("PENDING") && minutesAgo(cmd.submitted_at) > 3;
            return (
              <div
                key={cmd.id}
                className={clsx(
                  "flex items-start gap-3 p-3 rounded-md border border-border",
                  "border-l-2 bg-surface-1 hover:bg-surface-2 transition-colors",
                  TIER_STRIPE[cmd.risk_tier],
                  isExpiring && "ring-1 ring-warning/40",
                )}
              >
                {/* Risk score */}
                <div className="text-center shrink-0">
                  <div className={clsx("text-lg font-bold tabular-nums leading-none", {
                    "text-success": cmd.risk_tier === "LOW",
                    "text-warning": cmd.risk_tier === "MEDIUM",
                    "text-danger":  cmd.risk_tier === "HIGH",
                    "text-security": cmd.risk_tier === "CRITICAL",
                  })}>
                    {cmd.risk_score}
                  </div>
                  <RiskTierBadge tier={cmd.risk_tier} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-content-primary">{cmd.command_type}</span>
                    <span className="text-2xs text-content-muted">{cmd.subsystem}</span>
                  </div>
                  <div className="text-2xs text-content-muted mt-0.5">
                    by {cmd.submitter_username} · {formatAge(cmd.submitted_at)}
                  </div>
                </div>

                {/* Status + pipeline progress */}
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <CommandStatusBadge status={cmd.status} />
                  {isExpiring && (
                    <div className="flex items-center gap-1 text-warning text-2xs">
                      <Clock className="w-3 h-3" />
                      Expiring
                    </div>
                  )}
                  {/* Mini pipeline indicator */}
                  {stageIdx >= 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {STAGES.map((_, i) => (
                        <div
                          key={i}
                          className={clsx("w-3 h-1 rounded-full", {
                            "bg-accent":          i === stageIdx,
                            "bg-success":         i < stageIdx,
                            "bg-surface-3":       i > stageIdx,
                          })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
