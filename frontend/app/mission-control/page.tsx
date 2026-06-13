"use client";
// Mission Control — shared situational-awareness dashboard.
// Composed of editable panels (hide/show, drag, resize) via EditableDashboard.
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Activity,
  XCircle,
  ShieldAlert,
  Lock,
  Zap,
} from "lucide-react";
import { StatCard } from "../../components/StatCard";
import { SatelliteHealthOverview } from "../../components/SatelliteHealthCard";
import { CommandPipeline } from "../../components/CommandPipeline";
import { ActivityFeed } from "../../components/ActivityFeed";
import { OperatorPresence } from "../../components/OperatorPresence";
import { RiskDistributionChart } from "../../components/RiskDistributionChart";
import { CommandVolumeChart } from "../../components/CommandVolumeChart";
import { ConstellationPanel } from "../../components/ConstellationPanel";
import { EditableDashboard, type DashboardPanel } from "../../components/layout-editor/EditableDashboard";
import { useApprovalWebSocket } from "../../hooks/useApprovalWebSocket";
import { useTelemetry } from "../../hooks/useTelemetry";
import { api } from "../../lib/api";
import type { WSMessage, PendingCommand } from "../../lib/types";

// ── KPI state type ─────────────────────────────────────────────────────────────
interface KpiState {
  pendingApprovals: number;
  commandsToday: number;
  rejectedToday: number;
  securityAlerts: number;
  overrideActive: boolean;
  systemHealthPct: number;
}

const DEMO_KPI: KpiState = {
  pendingApprovals: 3,
  commandsToday:    27,
  rejectedToday:    6,
  securityAlerts:   2,
  overrideActive:   false,
  systemHealthPct:  99.8,
};

export default function MissionControlPage() {
  const { telemetry } = useTelemetry();
  const [kpi, setKpi] = useState<KpiState>(DEMO_KPI);
  const [commands, setCommands] = useState<PendingCommand[]>([]);
  const [wsMessages, setWsMessages] = useState<WSMessage[]>([]);
  const [constellationRefresh, setConstellationRefresh] = useState(0);

  // Load pending commands on mount
  useEffect(() => {
    api.getPendingCommands()
      .then((cmds) => {
        setCommands(cmds);
        setKpi((k) => ({ ...k, pendingApprovals: cmds.filter((c) =>
          c.status === "PENDING_SINGLE_APPROVAL" || c.status === "PENDING_DUAL_APPROVAL"
        ).length }));
      })
      .catch(() => {
        // backend not running — keep demo data
      });
  }, []);

  const handleWsMessage = useCallback((msg: WSMessage) => {
    setWsMessages((prev) => [msg, ...prev].slice(0, 50));

    // Update KPI on relevant events
    if (msg.type === "COMMAND_PENDING") {
      setKpi((k) => ({ ...k, pendingApprovals: k.pendingApprovals + 1 }));
    } else if (msg.type === "COMMAND_DISPATCHED" || msg.type === "COMMAND_REJECTED") {
      setKpi((k) => ({
        ...k,
        pendingApprovals: Math.max(0, k.pendingApprovals - 1),
        commandsToday:    k.commandsToday + (msg.type === "COMMAND_DISPATCHED" ? 1 : 0),
        rejectedToday:    k.rejectedToday  + (msg.type === "COMMAND_REJECTED"  ? 1 : 0),
      }));
    } else if (msg.type === "REPLAY_DETECTED") {
      setKpi((k) => ({ ...k, securityAlerts: k.securityAlerts + 1 }));
    } else if (msg.type === "OVERRIDE_ACTIVATED") {
      setKpi((k) => ({ ...k, overrideActive: true }));
    } else if (msg.type === "CONSTELLATION_ALERT") {
      setConstellationRefresh((n) => n + 1);
      setKpi((k) => ({ ...k, securityAlerts: k.securityAlerts + 1 }));
    }
  }, []);

  const { isConnected } = useApprovalWebSocket({
    onMessage: handleWsMessage,
    enabled: true,
  });

  // ── Panels (each one is hideable / draggable / resizable) ──────────────────
  const panels: DashboardPanel[] = [
    {
      id: "kpi-ribbon",
      title: "KPI Ribbon",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 h-full">
          <StatCard
            label="Pending Approvals"
            value={kpi.pendingApprovals}
            sub={kpi.pendingApprovals > 0 ? `${Math.min(kpi.pendingApprovals, 2)} high priority` : "Queue clear"}
            icon={CheckCircle2}
            variant={kpi.pendingApprovals > 0 ? "blue" : "green"}
            trend="up"
            trendValue={kpi.pendingApprovals > 0 ? "+2" : ""}
          />
          <StatCard
            label="Commands Today"
            value={kpi.commandsToday}
            sub="Active pipeline"
            icon={Activity}
            variant="default"
            trend="up"
            trendValue="+4"
          />
          <StatCard
            label="Rejected Today"
            value={kpi.rejectedToday}
            sub="Since midnight"
            icon={XCircle}
            variant={kpi.rejectedToday > 0 ? "amber" : "default"}
          />
          <StatCard
            label="Security Alerts"
            value={kpi.securityAlerts}
            sub={kpi.securityAlerts > 0 ? "Replay detected" : "No incidents"}
            icon={ShieldAlert}
            variant={kpi.securityAlerts > 0 ? "red" : "default"}
          />
          <StatCard
            label="Override Active"
            value={kpi.overrideActive ? "YES" : "0"}
            sub={kpi.overrideActive ? "Manual override" : "No override"}
            icon={Lock}
            variant={kpi.overrideActive ? "purple" : "default"}
          />
          <StatCard
            label="System Health"
            value={`${kpi.systemHealthPct.toFixed(1)}%`}
            sub={isConnected ? "WS connected" : "Polling mode"}
            icon={Zap}
            variant={kpi.systemHealthPct >= 99 ? "green" : kpi.systemHealthPct >= 90 ? "amber" : "red"}
          />
        </div>
      ),
    },
    {
      id: "satellite-health",
      title: "Satellite Health",
      defaultPlacement: { x: 0, y: 3, w: 12, h: 6, minW: 6, minH: 4 },
      render: () => <SatelliteHealthOverview telemetry={telemetry} />,
    },
    {
      id: "command-pipeline",
      title: "Command Pipeline",
      defaultPlacement: { x: 0, y: 9, w: 7, h: 9, minW: 4, minH: 5 },
      render: () => <CommandPipeline commands={commands.length > 0 ? commands : undefined} />,
    },
    {
      id: "activity-feed",
      title: "System Heartbeat",
      defaultPlacement: { x: 7, y: 9, w: 5, h: 6, minW: 3, minH: 4 },
      render: () => <ActivityFeed liveMessages={wsMessages} />,
    },
    {
      id: "operator-presence",
      title: "Operator Presence",
      defaultPlacement: { x: 7, y: 15, w: 5, h: 3, minW: 3, minH: 3 },
      render: () => <OperatorPresence />,
    },
    {
      id: "constellation",
      title: "Constellation Threat Status",
      defaultPlacement: { x: 0, y: 18, w: 6, h: 6, minW: 4, minH: 4 },
      render: () => <ConstellationPanel refreshSignal={constellationRefresh} />,
    },
    {
      id: "risk-distribution",
      title: "Risk Distribution",
      defaultPlacement: { x: 6, y: 18, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => <RiskDistributionChart />,
    },
    {
      id: "command-volume",
      title: "Command Volume",
      defaultPlacement: { x: 9, y: 18, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => <CommandVolumeChart />,
    },
    {
      id: "top-command-types",
      title: "Top Command Types",
      defaultPlacement: { x: 0, y: 24, w: 6, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full">
          <h3 className="text-md font-semibold text-content-primary mb-3">Top Command Types</h3>
          <div className="space-y-2">
            {[
              { name: "REQUEST_TELEMETRY",  count: 9,  pct: 90 },
              { name: "UPDATE_PARAMETER",   count: 7,  pct: 70 },
              { name: "DISABLE_SAFE_MODE",  count: 4,  pct: 40 },
              { name: "ATTITUDE_MANOEUVRE", count: 4,  pct: 40 },
              { name: "SET_BEACON_RATE",    count: 3,  pct: 30 },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-mono text-content-secondary truncate">{item.name}</span>
                  <span className="text-xs font-semibold text-content-primary ml-2 shrink-0">{item.count}</span>
                </div>
                <div className="h-1 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "system-health",
      title: "System Health",
      defaultPlacement: { x: 6, y: 24, w: 6, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full">
          <h3 className="text-md font-semibold text-content-primary mb-3">System Health</h3>
          <div className="space-y-2">
            {[
              { label: "API",         ok: true  },
              { label: "WebSocket",   ok: isConnected },
              { label: "Telemetry",   ok: telemetry !== null },
              { label: "OBC Link",    ok: true  },
              { label: "Ledger",      ok: true  },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-xs text-content-secondary">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${item.ok ? "status-dot-online" : "status-dot-danger"}`} />
                  <span className={`text-xs font-medium ${item.ok ? "text-success" : "text-danger"}`}>
                    {item.ok ? "OK" : "DOWN"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="mission-control"
      pageTitle="Mission Control"
      panels={panels}
    />
  );
}
