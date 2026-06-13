"use client";
import { clsx } from "clsx";
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Rocket,
  AlertTriangle,
  Lock,
  LogIn,
  Activity,
  Radio,
} from "lucide-react";
import type { WSMessage } from "../lib/types";

// ── Event tier classification ──────────────────────────────────────────────────
type EventTier = "critical" | "operational" | "informational";

interface FeedEvent {
  id: string;
  tier: EventTier;
  icon: React.ElementType;
  title: string;
  detail: string;
  operator?: string;
  timestamp: string;
}

const TIER_STYLES: Record<EventTier, { row: string; icon: string; dot: string }> = {
  critical: {
    row:  "border-l-2 border-danger pl-2",
    icon: "text-danger",
    dot:  "bg-danger",
  },
  operational: {
    row:  "border-l-2 border-accent pl-2",
    icon: "text-accent",
    dot:  "bg-accent",
  },
  informational: {
    row:  "pl-2 opacity-70",
    icon: "text-content-muted",
    dot:  "bg-content-muted",
  },
};

function wsMessageToFeedEvent(msg: WSMessage): FeedEvent | null {
  const ts = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const id = `${msg.type}-${Date.now()}`;

  switch (msg.type) {
    case "REPLAY_DETECTED":
      return { id, tier: "critical", icon: ShieldAlert, title: "Replay Attack Blocked", detail: msg.command_type, operator: msg.operator_id, timestamp: ts };
    case "OVERRIDE_ACTIVATED":
      return { id, tier: "critical", icon: Lock, title: "Emergency Override Activated", detail: `Expires: ${msg.expires_at}`, operator: msg.activated_by, timestamp: ts };
    case "CONSTELLATION_ALERT":
      return { id, tier: "critical", icon: AlertTriangle, title: `Constellation Alert — ${msg.source_satellite}`, detail: `${msg.command_type} (score ${msg.risk_score}) — approval tiers elevated`, timestamp: ts };
    case "COMMAND_REJECTED":
      return { id, tier: "operational", icon: XCircle, title: "Command Rejected", detail: msg.command_id.slice(0, 8), operator: msg.rejected_by, timestamp: ts };
    case "COMMAND_DISPATCHED":
      return { id, tier: "operational", icon: Rocket, title: "Command Dispatched", detail: msg.command_id.slice(0, 8), timestamp: ts };
    case "COMMAND_PENDING":
      return { id, tier: "operational", icon: AlertTriangle, title: `Pending Approval — ${msg.risk_tier}`, detail: msg.command_type, operator: msg.submitted_by, timestamp: ts };
    case "COMMAND_ESCALATED":
      return { id, tier: "operational", icon: AlertTriangle, title: "Command Escalated", detail: msg.command_id.slice(0, 8), timestamp: ts };
    default:
      return null;
  }
}

// Demo seed events shown before live data arrives
const DEMO_EVENTS: FeedEvent[] = [
  { id: "d1", tier: "critical",      icon: ShieldAlert, title: "Replay Attack Blocked",      detail: "DISABLE_SAFE_MODE",   operator: "op_chen",  timestamp: "14:23:01" },
  { id: "d2", tier: "operational",   icon: Rocket,      title: "Command Dispatched",          detail: "REQUEST_TELEMETRY",  operator: "so_kim",   timestamp: "14:22:48" },
  { id: "d3", tier: "operational",   icon: CheckCircle2, title: "Command Approved",           detail: "UPDATE_PARAMETER",   operator: "so_kim",   timestamp: "14:22:30" },
  { id: "d4", tier: "informational", icon: LogIn,       title: "Operator Login",              detail: "op_chen signed in",  operator: "op_chen",  timestamp: "14:21:15" },
  { id: "d5", tier: "operational",   icon: XCircle,     title: "Command Rejected",            detail: "FORCE_REBOOT",       operator: "so_kim",   timestamp: "14:20:55" },
  { id: "d6", tier: "informational", icon: Activity,    title: "Telemetry Updated",           detail: "battery_percent → 87", operator: "admin_root", timestamp: "14:20:00" },
  { id: "d7", tier: "critical",      icon: Lock,        title: "Override Activated",          detail: "Manual auth bypass", operator: "so_kim",   timestamp: "14:19:30" },
  { id: "d8", tier: "operational",   icon: Rocket,      title: "Command Dispatched",          detail: "SET_BEACON_RATE",    operator: "op_chen",  timestamp: "14:18:45" },
];

interface ActivityFeedProps {
  liveMessages?: WSMessage[];
  maxItems?: number;
}

export function ActivityFeed({ liveMessages = [], maxItems = 12 }: ActivityFeedProps) {
  const liveEvents = liveMessages
    .map(wsMessageToFeedEvent)
    .filter((e): e is FeedEvent => e !== null)
    .reverse();

  const combined = [...liveEvents, ...DEMO_EVENTS].slice(0, maxItems);

  return (
    <div className="card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-subtle">
        <h2 className="text-md font-semibold text-content-primary">System Heartbeat</h2>
        <div className="flex items-center gap-2">
          {liveEvents.length > 0 && (
            <span className="live-badge">Live</span>
          )}
          <Radio className="w-3.5 h-3.5 text-content-muted" />
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-none">
        {combined.map((event) => {
          const styles = TIER_STYLES[event.tier];
          const Icon = event.icon;
          return (
            <div
              key={event.id}
              className={clsx(
                "flex items-start gap-2.5 py-2 rounded-sm hover:bg-surface-2 transition-colors animate-fade-in",
                styles.row,
              )}
            >
              <Icon className={clsx("w-4 h-4 shrink-0 mt-0.5", styles.icon)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={clsx(
                      "text-xs font-medium leading-tight",
                      event.tier === "critical"      ? "text-danger"           : "",
                      event.tier === "operational"   ? "text-content-primary"  : "",
                      event.tier === "informational" ? "text-content-secondary" : "",
                    )}
                  >
                    {event.title}
                  </span>
                  <span className="text-2xs text-content-disabled font-mono shrink-0">{event.timestamp}</span>
                </div>
                <div className="text-2xs text-content-muted mt-0.5 font-mono truncate">{event.detail}</div>
                {event.operator && (
                  <div className="text-2xs text-content-disabled mt-0.5">by {event.operator}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
