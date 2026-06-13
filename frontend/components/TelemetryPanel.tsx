"use client";
// TelemetryPanel — live telemetry display with optional demo sliders. T-025
import { clsx } from "clsx";
import { Battery, Thermometer, Globe, Signal, Power, RefreshCw } from "lucide-react";
import type { TelemetryState, ThermalStatus, OrbitalPhase, TelemetryUpdate } from "../lib/types";

// ── Compact health strip variant (used in Command Center) ─────────────────────

interface CompactHealthStripProps {
  telemetry: TelemetryState | null;
}

export function CompactHealthStrip({ telemetry }: CompactHealthStripProps) {
  if (!telemetry) {
    return (
      <div className="flex items-center gap-2 h-12 px-3 rounded border border-border bg-surface-1">
        <span className="text-xs text-content-muted">Loading telemetry…</span>
      </div>
    );
  }

  const battClass =
    telemetry.battery_percent >= 50 ? "text-success" :
    telemetry.battery_percent >= 20 ? "text-warning" : "text-danger";

  const thermalClass =
    telemetry.thermal_status === "NOMINAL"  ? "text-success" :
    telemetry.thermal_status === "ELEVATED" ? "text-warning" : "text-danger";

  return (
    <div className="flex items-center gap-4 h-12 px-3 rounded border border-border bg-surface-1 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="status-dot status-dot-online" />
        <span className="text-2xs text-content-muted font-mono">SAT_ALPHA</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Battery className="w-3.5 h-3.5 text-content-muted" />
        <span className={clsx("text-xs font-semibold font-mono tabular-nums", battClass)}>
          {telemetry.battery_percent.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Thermometer className="w-3.5 h-3.5 text-content-muted" />
        <span className={clsx("text-xs font-semibold", thermalClass)}>
          {telemetry.thermal_status}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Globe className="w-3.5 h-3.5 text-content-muted" />
        <span className="text-xs text-content-secondary">{telemetry.orbital_phase}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Signal className="w-3.5 h-3.5 text-content-muted" />
        <span className="text-xs text-content-secondary font-mono">{telemetry.link_margin_db.toFixed(1)} dB</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Power className={clsx("w-3.5 h-3.5", telemetry.safe_mode ? "text-accent" : "text-content-muted")} />
        <span className={clsx("text-xs", telemetry.safe_mode ? "text-accent font-medium" : "text-content-muted")}>
          {telemetry.safe_mode ? "SAFE MODE" : "Normal"}
        </span>
      </div>
    </div>
  );
}

// ── Full panel variant (read-only + optional admin controls) ──────────────────

interface TelemetryPanelProps {
  telemetry: TelemetryState | null;
  isLoading?: boolean;
  demoControls?: boolean;
  onUpdate?: (update: TelemetryUpdate) => Promise<void>;
}

function FieldRow({
  label,
  value,
  valueClass,
}: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-xs text-content-muted">{label}</span>
      <span className={clsx("text-xs font-medium font-mono", valueClass ?? "text-content-primary")}>
        {value}
      </span>
    </div>
  );
}

export function TelemetryPanel({ telemetry, isLoading = false, demoControls = false, onUpdate }: TelemetryPanelProps) {
  if (isLoading && !telemetry) {
    return (
      <div className="card p-4 space-y-3">
        <div className="h-4 w-32 rounded bg-surface-3 animate-pulse" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-3 rounded bg-surface-3 animate-pulse" />
        ))}
      </div>
    );
  }

  const t = telemetry;

  const battClass =
    !t ? "text-content-disabled" :
    t.battery_percent >= 50 ? "text-success" :
    t.battery_percent >= 20 ? "text-warning" : "text-danger";

  const thermalClass =
    !t ? "text-content-disabled" :
    t.thermal_status === "NOMINAL"  ? "text-success" :
    t.thermal_status === "ELEVATED" ? "text-warning" : "text-danger";

  const linkClass =
    !t ? "text-content-disabled" :
    t.link_margin_db >= 10 ? "text-success" :
    t.link_margin_db >= 5  ? "text-warning" : "text-danger";

  async function handleBatteryChange(v: number) {
    await onUpdate?.({ battery_percent: v });
  }
  async function handleSafeModeChange(v: boolean) {
    await onUpdate?.({ safe_mode: v });
  }
  async function handleThermalChange(v: ThermalStatus) {
    await onUpdate?.({ thermal_status: v });
  }
  async function handleOrbitalChange(v: OrbitalPhase) {
    await onUpdate?.({ orbital_phase: v });
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold text-content-primary">Telemetry Snapshot</h3>
        {demoControls && (
          <span className="text-2xs text-warning border border-warning-border bg-warning-subtle px-1.5 py-0.5 rounded-xs font-semibold">
            DEMO CONTROLS
          </span>
        )}
      </div>

      <div className="space-y-0">
        {/* Battery */}
        {demoControls ? (
          <div className="py-1.5 border-b border-border-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-content-muted">Battery</span>
              <span className={clsx("text-xs font-mono font-semibold", battClass)}>
                {t?.battery_percent.toFixed(0) ?? "—"}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={t?.battery_percent ?? 78}
              onChange={(e) => handleBatteryChange(Number(e.target.value))}
              className="w-full h-1.5 accent-accent"
            />
          </div>
        ) : (
          <FieldRow
            label="Battery"
            value={t ? `${t.battery_percent.toFixed(0)}%` : "—"}
            valueClass={battClass}
          />
        )}

        {/* Safe Mode */}
        {demoControls ? (
          <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
            <span className="text-xs text-content-muted">Safe Mode</span>
            <button
              onClick={() => handleSafeModeChange(!(t?.safe_mode))}
              className={clsx(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                t?.safe_mode ? "bg-accent" : "bg-surface-3",
              )}
              role="switch"
              aria-checked={t?.safe_mode ?? false}
            >
              <span
                className={clsx(
                  "inline-block w-3.5 h-3.5 transform rounded-full bg-white shadow transition-transform",
                  t?.safe_mode ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        ) : (
          <FieldRow
            label="Safe Mode"
            value={t ? (t.safe_mode ? "ON" : "OFF") : "—"}
            valueClass={t?.safe_mode ? "text-accent" : "text-content-secondary"}
          />
        )}

        {/* Thermal status */}
        {demoControls ? (
          <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
            <span className="text-xs text-content-muted">Thermal</span>
            <select
              value={t?.thermal_status ?? "NOMINAL"}
              onChange={(e) => handleThermalChange(e.target.value as ThermalStatus)}
              className="bg-surface-2 border border-border rounded text-xs text-content-primary px-2 py-0.5"
            >
              <option value="NOMINAL">NOMINAL</option>
              <option value="ELEVATED">ELEVATED</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        ) : (
          <FieldRow label="Thermal Status" value={t?.thermal_status ?? "—"} valueClass={thermalClass} />
        )}

        {/* Orbital phase */}
        {demoControls ? (
          <div className="flex items-center justify-between py-1.5 border-b border-border-subtle">
            <span className="text-xs text-content-muted">Orbital Phase</span>
            <select
              value={t?.orbital_phase ?? "SUNLIT"}
              onChange={(e) => handleOrbitalChange(e.target.value as OrbitalPhase)}
              className="bg-surface-2 border border-border rounded text-xs text-content-primary px-2 py-0.5"
            >
              <option value="SUNLIT">SUNLIT</option>
              <option value="ECLIPSE">ECLIPSE</option>
              <option value="PENUMBRA">PENUMBRA</option>
            </select>
          </div>
        ) : (
          <FieldRow label="Orbital Phase" value={t?.orbital_phase ?? "—"} />
        )}

        <FieldRow label="Link Margin" value={t ? `${t.link_margin_db.toFixed(1)} dB` : "—"} valueClass={linkClass} />
        <FieldRow
          label="Updated"
          value={t ? new Date(t.updated_at).toLocaleTimeString() : "—"}
          valueClass="text-content-muted"
        />
      </div>
    </div>
  );
}

export default TelemetryPanel;
