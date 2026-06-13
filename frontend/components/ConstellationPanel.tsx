"use client";
// ConstellationPanel — cross-satellite threat status. Phase 2 F-11.
// Individual satellite cards + aggregate elevation state + recent alert feed.
// Peer cards now display simulated telemetry (battery, thermal, orbital phase).
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Battery, Radio, Satellite, ShieldAlert, Thermometer, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import type { ConstellationStatus } from "../lib/types";

interface ConstellationPanelProps {
  /** Bump to force a refresh (e.g. on a CONSTELLATION_ALERT WS message). */
  refreshSignal?: number;
}

export function ConstellationPanel({ refreshSignal = 0 }: ConstellationPanelProps) {
  const [status, setStatus] = useState<ConstellationStatus | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => api.getConstellationStatus().then((s) => { if (active) setStatus(s); }).catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => { active = false; clearInterval(t); };
  }, [refreshSignal]);

  const elevationActive = status?.elevation_active ?? false;

  const satellites = [
    {
      id: status?.local_satellite ?? "SAT_ALPHA",
      isLocal: true,
      lastEvent: status?.alerts.find((a) => a.source_satellite === (status?.local_satellite ?? "SAT_ALPHA")) ?? null,
      batteryPct: undefined as number | undefined,
      thermalStatus: undefined as string | undefined,
      orbitalPhase: undefined as string | undefined,
      safeMode: undefined as boolean | undefined,
      altitudeKm: undefined as number | undefined,
    },
    ...(status?.peers ?? []).map((p) => ({
      id: p.satellite_id,
      isLocal: false,
      lastEvent: status?.alerts.find((a) => a.source_satellite === p.satellite_id) ?? null,
      batteryPct: p.battery_percent,
      thermalStatus: p.thermal_status,
      orbitalPhase: p.orbital_phase,
      safeMode: p.safe_mode_active,
      altitudeKm: p.altitude_km,
    })),
  ];

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-content-muted" />
          <h3 className="text-md font-semibold text-content-primary">Constellation Threat Status</h3>
        </div>
        <span className="text-2xs text-content-muted font-mono uppercase">
          bus: {status?.bus ?? "—"}
        </span>
      </div>

      {/* Elevation banner */}
      {elevationActive && (
        <div className="flex items-center gap-2 px-4 py-2 bg-security-subtle border-b border-security-border shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-security shrink-0" />
          <span className="text-xs text-security font-medium">
            Approval tiers elevated — {status?.elevation_source} reported a HIGH-risk command.
            Auto-approve suspended until{" "}
            {status?.elevated_until ? new Date(status.elevated_until).toLocaleTimeString() : "—"}.
          </span>
        </div>
      )}

      {/* Satellite cards */}
      <div className="grid grid-cols-3 gap-2 p-3 shrink-0">
        {satellites.map((sat) => (
          <div
            key={sat.id}
            className={clsx(
              "rounded border px-2.5 py-2",
              sat.isLocal ? "border-accent-border bg-accent-subtle" : "border-border bg-surface-2",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Satellite className={clsx("w-3 h-3 shrink-0", sat.isLocal ? "text-accent" : "text-content-muted")} />
              <span className="font-mono text-2xs font-bold text-content-primary truncate">{sat.id}</span>
              <span className="status-dot status-dot-online ml-auto shrink-0" />
            </div>

            {/* Telemetry row for peer satellites */}
            {!sat.isLocal && sat.batteryPct !== undefined ? (
              <div className="mt-1.5 space-y-0.5">
                <div className="flex items-center gap-1 text-2xs">
                  <Battery className={clsx(
                    "w-3 h-3 shrink-0",
                    sat.batteryPct >= 50 ? "text-success" : sat.batteryPct >= 20 ? "text-warning" : "text-danger",
                  )} />
                  <span className={clsx(
                    "font-mono font-bold",
                    sat.batteryPct >= 50 ? "text-success" : sat.batteryPct >= 20 ? "text-warning" : "text-danger",
                  )}>{sat.batteryPct.toFixed(0)}%</span>
                  <span className="text-content-disabled ml-auto truncate">{sat.orbitalPhase}</span>
                </div>
                <div className="flex items-center gap-1 text-2xs">
                  <Thermometer className="w-3 h-3 shrink-0 text-content-disabled" />
                  <span className={clsx(
                    "text-2xs",
                    sat.thermalStatus === "NOMINAL" ? "text-success" : sat.thermalStatus === "ELEVATED" ? "text-warning" : "text-danger",
                  )}>{sat.thermalStatus}</span>
                  {sat.safeMode && (
                    <span className="ml-auto text-2xs text-accent font-semibold">SAFE</span>
                  )}
                </div>
                {sat.altitudeKm !== undefined && (
                  <div className="font-mono text-2xs text-content-disabled">{sat.altitudeKm.toFixed(1)} km</div>
                )}
              </div>
            ) : (
              <div className="text-2xs text-content-muted mt-1 truncate">
                {sat.isLocal
                  ? "this instance"
                  : sat.lastEvent
                    ? `${sat.lastEvent.command_type} · ${sat.lastEvent.risk_score}`
                    : "no recent events"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alert feed */}
      <div className="section-label px-4 pb-1 shrink-0">Cross-Satellite Alerts</div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!status || status.alerts.length === 0 ? (
          <p className="text-2xs text-content-muted text-center py-4">
            No HIGH-risk events on the constellation bus yet.
          </p>
        ) : (
          status.alerts.slice(0, 12).map((alert, i) => (
            <div key={`${alert.timestamp}-${i}`} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-2">
              <ShieldAlert
                className={clsx(
                  "w-3.5 h-3.5 shrink-0 mt-px",
                  alert.source_satellite === status.local_satellite ? "text-danger" : "text-security",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-2xs text-content-primary leading-snug">
                  <span className="font-mono font-bold">{alert.source_satellite}</span>
                  {" "}detected{" "}
                  <span className="font-mono">{alert.command_type}</span>
                  {" "}(score {alert.risk_score})
                </div>
                <div className="text-2xs text-content-disabled font-mono">
                  {new Date(alert.timestamp).toLocaleTimeString()} · elevation {alert.elevation_window_minutes}m
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ConstellationPanel;
