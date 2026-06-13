"use client";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Satellite } from "lucide-react";
import { api } from "../lib/api";
import type { SatelliteSimState, TelemetryState } from "../lib/types";
import { SAT_ALPHA_ORBIT } from "../lib/orbit";

// ── Shared card data model ────────────────────────────────────────────────────

interface SatelliteData {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded";
  telemetry: TelemetryState | null;
  peerTelemetry: SatelliteSimState | null;  // raw sim state for Bravo/Charlie
  healthPercent: number;
  altitudeKm: number;
}

// ── Subsystem row ─────────────────────────────────────────────────────────────

function SubRow({
  name,
  value,
  status,
}: {
  name: string;
  value: string;
  status: "ok" | "warn" | "crit" | "unknown";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-content-muted">{name}</span>
      <span
        className={clsx("text-xs font-mono font-medium tabular-nums", {
          "text-success":          status === "ok",
          "text-warning":          status === "warn",
          "text-danger":           status === "crit",
          "text-content-disabled": status === "unknown",
        })}
      >
        {value}
      </span>
    </div>
  );
}

function SubGroup({
  label,
  items,
}: {
  label: string;
  items: { name: string; value: string; status: "ok" | "warn" | "crit" | "unknown" }[];
}) {
  return (
    <div>
      <div className="section-label mb-2">{label}</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <SubRow key={item.name} {...item} />
        ))}
      </div>
    </div>
  );
}

// ── Build subsystem rows from either live telemetry or sim state ──────────────

function buildSubsystems(
  sat: SatelliteData,
): {
  power: ReturnType<typeof SubRow>["props"][];
  thermal: ReturnType<typeof SubRow>["props"][];
  comms: ReturnType<typeof SubRow>["props"][];
  orbit: ReturnType<typeof SubRow>["props"][];
} {
  const t = sat.telemetry;
  const p = sat.peerTelemetry;

  // Battery
  const batt = t?.battery_percent ?? p?.battery_percent ?? null;
  const battStr = batt !== null ? `${batt.toFixed(0)}%` : "—";
  const battStatus = batt !== null ? (batt >= 50 ? "ok" : batt >= 20 ? "warn" : "crit") as "ok"|"warn"|"crit" : "unknown" as "unknown";

  // Thermal
  const thermal = t?.thermal_status ?? p?.thermal_status ?? null;
  const thermalStatus = thermal ? (thermal === "NOMINAL" ? "ok" : thermal === "ELEVATED" ? "warn" : "crit") as "ok"|"warn"|"crit" : "unknown" as "unknown";

  // Link
  const linkDb = t?.link_margin_db ?? null;
  const linkStr = linkDb !== null ? `${linkDb.toFixed(1)} dB` : "—";
  const linkStatus = linkDb !== null ? (linkDb >= 10 ? "ok" : linkDb >= 5 ? "warn" : "crit") as "ok"|"warn"|"crit" : "unknown" as "unknown";

  // Orbit
  const phase = t?.orbital_phase ?? p?.orbital_phase ?? null;
  const alt = sat.altitudeKm > 0 ? `${sat.altitudeKm.toFixed(1)} km` : "—";
  const safeModeActive = t?.safe_mode ?? p?.safe_mode_active ?? false;

  return {
    power: [
      { name: "Battery",      value: battStr,  status: battStatus },
      { name: "Solar Output", value: p ? (p.orbital_phase === "ECLIPSE" ? "0 W" : "~180 W") : "—", status: p ? (p.orbital_phase === "ECLIPSE" ? "warn" : "ok") : "unknown" },
      { name: "Consumption",  value: p ? "45 W" : "—", status: p ? "ok" : "unknown" },
    ],
    thermal: [
      { name: "Temperature",   value: p ? (thermal === "NOMINAL" ? "~22°C" : thermal === "ELEVATED" ? "~48°C" : "~72°C") : "—", status: thermalStatus },
      { name: "Thermal State", value: thermal ?? "—", status: thermalStatus },
    ],
    comms: [
      { name: "Link Margin",    value: linkStr, status: linkStatus },
      { name: "Signal Quality", value: p ? "Good" : "—", status: p ? "ok" : "unknown" },
      { name: "Last Contact",   value: p ? "~5s ago" : (t ? "2s ago" : "—"), status: "ok" },
    ],
    orbit: [
      { name: "Phase",    value: phase ?? "—",                                                  status: "ok" as "ok" },
      { name: "Altitude", value: alt,                                                            status: "ok" as "ok" },
      { name: "Safe Mode", value: safeModeActive ? "ACTIVE" : "OFF",                            status: safeModeActive ? "warn" : "ok" as "ok"|"warn" },
    ],
  };
}

// ── Satellite card ────────────────────────────────────────────────────────────

function SatelliteCard({ sat }: { sat: SatelliteData }) {
  const subsystems = buildSubsystems(sat);

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-content-primary">{sat.name}</span>
            <span
              className={clsx(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs border text-2xs font-semibold uppercase",
                sat.status === "online"   && "bg-success-subtle text-success border-success-border",
                sat.status === "degraded" && "bg-warning-subtle text-warning border-warning-border",
                sat.status === "offline"  && "bg-danger-subtle text-danger border-danger-border",
              )}
            >
              <span
                className={clsx(
                  "status-dot",
                  sat.status === "online"   && "status-dot-online",
                  sat.status === "degraded" && "status-dot-warning",
                  sat.status === "offline"  && "status-dot-offline",
                )}
              />
              {sat.status}
            </span>
          </div>
          <div className="text-xs text-content-muted mt-0.5">{sat.healthPercent.toFixed(1)}% system health</div>
        </div>
        <Satellite className="w-8 h-8 text-accent opacity-60 shrink-0" />
      </div>

      {/* 2×2 subsystem grid */}
      <div className="grid grid-cols-2 gap-4">
        <SubGroup label="Power"          items={subsystems.power}   />
        <SubGroup label="Communications" items={subsystems.comms}   />
        <SubGroup label="Thermal"        items={subsystems.thermal} />
        <SubGroup label="Orbit"          items={subsystems.orbit}   />
      </div>
    </div>
  );
}

// ── Health percent calc ───────────────────────────────────────────────────────

function calcHealth(batt: number, thermal: string, safeMode: boolean): number {
  const thermalScore = thermal === "NOMINAL" ? 100 : thermal === "ELEVATED" ? 65 : 25;
  const modeScore = safeMode ? 70 : 100;
  return Math.min(100, batt * 0.4 + thermalScore * 0.35 + modeScore * 0.25);
}

// ── Overview ──────────────────────────────────────────────────────────────────

interface SatelliteHealthOverviewProps {
  telemetry: TelemetryState | null;
}

// Seed data matches backend _PEER_INIT_TELEMETRY — shown immediately before API responds
const PEER_SEEDS: SatelliteSimState[] = [
  { satellite_id: "SAT_BRAVO",   battery_percent: 85.0, safe_mode_active: false, thermal_status: "NOMINAL",  orbital_phase: "SUNLIT",  altitude_km: 551.4, is_local: false },
  { satellite_id: "SAT_CHARLIE", battery_percent: 72.0, safe_mode_active: true,  thermal_status: "ELEVATED", orbital_phase: "ECLIPSE", altitude_km: 543.8, is_local: false },
];

export function SatelliteHealthOverview({ telemetry }: SatelliteHealthOverviewProps) {
  const [peers, setPeers] = useState<SatelliteSimState[]>(PEER_SEEDS);

  useEffect(() => {
    let active = true;
    const load = () =>
      api.getSimSatellites()
        .then((sats) => { if (active) setPeers(sats.filter((s) => !s.is_local)); })
        .catch(() => {}); // keep seeds on failure — peers stay visible
    load();
    const t = setInterval(load, 15_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Alpha health — derived from live telemetry
  const alphaHealth = telemetry
    ? calcHealth(
        telemetry.battery_percent,
        telemetry.thermal_status,
        telemetry.safe_mode,
      )
    : 99.8;

  const alphaData: SatelliteData = {
    id:             "SAT_ALPHA",
    name:           "SAT_ALPHA",
    status:         "online",
    telemetry,
    peerTelemetry:  null,
    healthPercent:  alphaHealth,
    altitudeKm:     SAT_ALPHA_ORBIT.altitudeKm,
  };

  // Bravo / Charlie — seeds guarantee data before API responds; API updates refine it
  function peerToData(id: string): SatelliteData {
    const p = peers.find((s) => s.satellite_id === id)
           ?? PEER_SEEDS.find((s) => s.satellite_id === id)!;
    const health = calcHealth(p.battery_percent, p.thermal_status, p.safe_mode_active);
    // Only go "offline" if battery critical AND thermal critical — otherwise always online.
    // Safe-mode and elevated thermal are normal operating states, not outages.
    const status: "online" | "degraded" | "offline" =
      p.battery_percent < 10 && p.thermal_status === "CRITICAL" ? "offline"
      : p.battery_percent < 20 || p.thermal_status === "CRITICAL" ? "degraded"
      : "online";
    return {
      id,
      name:          p.satellite_id,
      status,
      telemetry:     null,
      peerTelemetry: p,
      healthPercent: health,
      altitudeKm:    p.altitude_km,
    };
  }

  const satellites = [alphaData, peerToData("SAT_BRAVO"), peerToData("SAT_CHARLIE")];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-md font-semibold text-content-primary">Satellite Health Overview</h2>
        <a href="#" className="text-xs text-accent hover:text-accent-hover transition-colors">
          View All Satellites →
        </a>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {satellites.map((sat) => (
          <SatelliteCard key={sat.id} sat={sat} />
        ))}
      </div>
    </div>
  );
}
