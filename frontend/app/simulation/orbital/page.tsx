"use client";
// Orbital Operations Center — 3D orbit visualization with live telemetry.
// Follows mockups/"3D Orbital Visualization.png".
// Hybrid data: power/link/thermal come from the telemetry API; orbit state is
// a deterministic client-side propagation (see lib/orbit.ts).
// Effect preview: overlay buttons trigger physics animations (thruster, payload, etc.)
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { clsx } from "clsx";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  FastForward,
  Flame,
  Gauge,
  Globe2,
  Lock,
  Package,
  Pause,
  Play,
  RadioTower,
  RefreshCw,
  Rewind,
  RotateCcw,
  RotateCw,
  Satellite as SatelliteIcon,
  Shield,
  ShieldCheck,
  ShieldOff,
  Signal,
  Zap,
} from "lucide-react";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { KpiTile } from "../../../components/ui/KpiTile";
import { useTelemetry } from "../../../hooks/useTelemetry";
import { useOrbitSim, SIM_SPEEDS, type SimSpeed } from "../../../hooks/useOrbitSim";
import {
  DEFAULT_DISPLAY_OPTIONS,
  type ActiveEffect,
  type CameraMode,
  type DisplayOptions,
  type PeerSatConfig,
} from "../../../components/orbital/OrbitalCanvas";
import {
  SAT_ALPHA_ORBIT,
  SAT_BRAVO_ORBIT,
  SAT_CHARLIE_ORBIT,
  formatHMS,
  nextContactWindow,
  orbitalPeriodS,
  orbitalVelocityKms,
  subSatellitePoint,
  type OrbitParams,
} from "../../../lib/orbit";
import { api } from "../../../lib/api";
import type { SatelliteSimState } from "../../../lib/types";

// WebGL canvas must not be server-rendered
const OrbitalCanvas = dynamic(() => import("../../../components/orbital/OrbitalCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-xs text-content-muted">
      Initializing 3D engine…
    </div>
  ),
});

type SatId = "SAT_ALPHA" | "SAT_BRAVO" | "SAT_CHARLIE";

const SAT_CONFIGS: Array<{ id: SatId; orbit: OrbitParams; color: string }> = [
  { id: "SAT_ALPHA",   orbit: SAT_ALPHA_ORBIT,   color: "#22C55E" },
  { id: "SAT_BRAVO",   orbit: SAT_BRAVO_ORBIT,   color: "#4F6BFF" },
  { id: "SAT_CHARLIE", orbit: SAT_CHARLIE_ORBIT,  color: "#F59E0B" },
];

const PEER_SEEDS: SatelliteSimState[] = [
  { satellite_id: "SAT_BRAVO",   battery_percent: 85.0, safe_mode_active: false, thermal_status: "NOMINAL",  orbital_phase: "SUNLIT",  altitude_km: 551.4, is_local: false },
  { satellite_id: "SAT_CHARLIE", battery_percent: 72.0, safe_mode_active: true,  thermal_status: "ELEVATED", orbital_phase: "ECLIPSE", altitude_km: 543.8, is_local: false },
];

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "EARTH", label: "Earth View" },
  { id: "FOLLOW", label: "Follow Satellite" },
  { id: "TOP", label: "Polar View" },
];

const DISPLAY_TOGGLES: { key: keyof DisplayOptions; label: string }[] = [
  { key: "groundStations", label: "Show Ground Stations" },
  { key: "orbitPath", label: "Show Orbit Path" },
  { key: "predictedPath", label: "Show Predicted Orbit" },
  { key: "nightLights", label: "Show City Lights" },
  { key: "clouds", label: "Show Cloud Layer" },
  { key: "coverage", label: "Show Coverage Area" },
];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-2xs text-content-muted uppercase tracking-wide">{label}</span>
      <span className="font-mono text-xs text-content-primary tabular-nums">{value}</span>
    </div>
  );
}

type NonNullEffect = Exclude<ActiveEffect, null>;

interface EffectPreset {
  id: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  effect: NonNullEffect;
  orbitDelta: number;
  durationMs: number;
  tone: "default" | "danger" | "amber" | "green" | "blue";
}

const MANOEUVRE_GROUPS: Array<{ title: string; presets: EffectPreset[] }> = [
  {
    title: "Orbital Manoeuvres",
    presets: [
      { id: "raise-orbit",  label: "Raise Orbit",   sub: "+5 km / 3.5s burn",  icon: ArrowUp,    effect: { type: "thruster_burst",  progress: 0 }, orbitDelta:  5, durationMs: 3500, tone: "amber" },
      { id: "lower-orbit",  label: "Lower Orbit",   sub: "−5 km / retro burn", icon: ArrowDown,  effect: { type: "thruster_burst",  progress: 0 }, orbitDelta: -5, durationMs: 3500, tone: "amber" },
    ],
  },
  {
    title: "Attitude Control",
    presets: [
      { id: "yaw-90",       label: "Yaw  90°",      sub: "Z-axis slew",        icon: RotateCw,   effect: { type: "attitude_change", progress: 0 }, orbitDelta: 0, durationMs: 2200, tone: "blue"  },
      { id: "pitch-15",     label: "Pitch  15°",    sub: "X-axis manoeuvre",   icon: RefreshCw,  effect: { type: "attitude_change", progress: 0 }, orbitDelta: 0, durationMs: 1800, tone: "blue"  },
    ],
  },
  {
    title: "Payload & Mode",
    presets: [
      { id: "deploy",       label: "Deploy Payload",sub: "8s separation seq.", icon: Package,    effect: { type: "payload_separation", progress: 0 }, orbitDelta: 0, durationMs: 8000, tone: "green" },
      { id: "safe-on",      label: "Safe Mode ON",  sub: "Enable constraint",  icon: Shield,     effect: { type: "mode_change",     progress: 0 }, orbitDelta: 0, durationMs:  600, tone: "green" },
      { id: "safe-off",     label: "Safe Mode OFF", sub: "Remove constraint",  icon: ShieldOff,  effect: { type: "mode_change",     progress: 0 }, orbitDelta: 0, durationMs:  600, tone: "danger"},
    ],
  },
  {
    title: "System",
    presets: [
      { id: "obc-reset",    label: "OBC Reset",     sub: "Cold restart 4.2s",  icon: Zap,        effect: { type: "system_reset",    progress: 0 }, orbitDelta: 0, durationMs: 4200, tone: "danger"},
      { id: "beacon",       label: "Beacon Ping",   sub: "Telemetry pulse",    icon: Signal,     effect: { type: "telemetry_pulse", progress: 0 }, orbitDelta: 0, durationMs:  150, tone: "default"},
    ],
  },
];

export default function OrbitalOpsPage() {
  const { telemetry } = useTelemetry();
  const { simTime, simTimeRef, playing, speed, setPlaying, setSpeed, scrub, reset } = useOrbitSim();
  const [options, setOptions] = useState<DisplayOptions>(DEFAULT_DISPLAY_OPTIONS);
  const [cameraMode, setCameraMode] = useState<CameraMode>("EARTH");
  const [showCamMenu, setShowCamMenu] = useState(false);
  const [missionEpoch] = useState(() => Date.now());

  // Multi-satellite selector
  const [selectedSat, setSelectedSat] = useState<SatId>("SAT_ALPHA");
  const [peers, setPeers] = useState<SatelliteSimState[]>(PEER_SEEDS);

  // Fetch peer telemetry every 15s
  useEffect(() => {
    let active = true;
    const load = () =>
      api.getSimSatellites()
        .then((sats) => { if (active) setPeers(sats.filter((s) => !s.is_local)); })
        .catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  // Derived per-satellite data
  const activeSatConfig = SAT_CONFIGS.find((s) => s.id === selectedSat)!;
  const activeOrbit = activeSatConfig.orbit;

  const peerSatellites: PeerSatConfig[] = SAT_CONFIGS
    .filter((s) => s.id !== selectedSat)
    .map((s) => {
      const peerState = peers.find((p) => p.satellite_id === s.id);
      return {
        id: s.id,
        label: s.id,
        orbit: s.orbit,
        color: s.color,
        phase: peerState?.orbital_phase as "SUNLIT" | "ECLIPSE" | undefined,
      };
    });

  // Active satellite telemetry values (live for Alpha, seed for Bravo/Charlie)
  const activePeer = peers.find((p) => p.satellite_id === selectedSat);
  const activeBattery = selectedSat === "SAT_ALPHA"
    ? (telemetry?.battery_percent ?? null)
    : (activePeer?.battery_percent ?? null);
  const activeLinkMargin = selectedSat === "SAT_ALPHA"
    ? (telemetry?.link_margin_db ?? 12)
    : (selectedSat === "SAT_BRAVO" ? 9.2 : 6.8);
  const activeThermal = selectedSat === "SAT_ALPHA"
    ? (telemetry?.thermal_status ?? "NOMINAL")
    : (activePeer?.thermal_status ?? "NOMINAL");
  const activeSafeMode = selectedSat === "SAT_ALPHA"
    ? (telemetry?.safe_mode ?? false)
    : (activePeer?.safe_mode_active ?? false);

  // 3D effect preview state
  const [activeEffect, setActiveEffect] = useState<ActiveEffect>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [effectProgress, setEffectProgress] = useState(0);
  const [orbitDeltaKm, setOrbitDeltaKm] = useState(0);
  const batteryPctRef = useRef(activeBattery ?? 80);
  const effectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const effectStartRef = useRef(0);

  // Reset battery physics ref and clear effects when switching satellites
  useEffect(() => {
    batteryPctRef.current = activeBattery ?? 80;
    clearEffects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSat]);

  function triggerEffect(preset: EffectPreset) {
    if (effectTimerRef.current) clearTimeout(effectTimerRef.current);
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);

    const startEffect: ActiveEffect = { ...preset.effect, progress: 0 };
    setActiveEffect(startEffect);
    setActivePresetId(preset.id);
    setEffectProgress(0);
    setOrbitDeltaKm(preset.orbitDelta);
    effectStartRef.current = performance.now();

    function animProgress(now: number) {
      const progress = Math.min(1, (now - effectStartRef.current) / preset.durationMs);
      setActiveEffect((prev) => prev ? ({ ...prev, progress } as ActiveEffect) : prev);
      setEffectProgress(progress);
      if (progress < 1) {
        progressRafRef.current = requestAnimationFrame(animProgress);
      } else {
        effectTimerRef.current = setTimeout(() => {
          setActiveEffect(null);
          setActivePresetId(null);
          setEffectProgress(0);
          if (preset.orbitDelta === 0) setOrbitDeltaKm(0);
        }, 1800);
      }
    }
    progressRafRef.current = requestAnimationFrame(animProgress);
  }

  function clearEffects() {
    if (effectTimerRef.current) clearTimeout(effectTimerRef.current);
    if (progressRafRef.current) cancelAnimationFrame(progressRafRef.current);
    setActiveEffect(null);
    setActivePresetId(null);
    setEffectProgress(0);
    setOrbitDeltaKm(0);
  }

  const period = orbitalPeriodS(activeOrbit);
  const velocity = orbitalVelocityKms(activeOrbit);
  const ssp = subSatellitePoint(simTime, activeOrbit);
  const orbitProgress = ((simTime % period) / period) * 100;

  // Recompute the contact scan only every 5 sim-seconds
  const contactKey = Math.floor(simTime / 5);
  const contact = useMemo(
    () => nextContactWindow(simTime, activeOrbit),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contactKey, selectedSat],
  );
  const inContact = contact !== null && contact.aosSeconds <= simTime + 1;

  const missionClock = new Date(missionEpoch + simTime * 1000)
    .toISOString().replace("T", " ").slice(0, 19);

  const linkOk = activeLinkMargin >= 5;
  const thermalOk = activeThermal !== "CRITICAL";

  const panels: DashboardPanel[] = [
    {
      id: "orbital-kpis",
      title: "Orbital KPI Strip",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 h-full">
          <KpiTile label="Altitude" value={activeOrbit.altitudeKm.toFixed(2)} unit="km" sub="Circular LEO" icon={ArrowUp} />
          <KpiTile label="Velocity" value={velocity.toFixed(2)} unit="km/s" sub="Orbital speed" icon={Gauge} />
          <KpiTile label="Inclination" value={`${activeOrbit.inclinationDeg.toFixed(2)}°`} sub="Sun-synchronous" icon={Globe2} />
          <KpiTile label="Orbital Period" value={(period / 60).toFixed(2)} unit="min" sub={`${(period / 3600).toFixed(2)} h`} icon={RotateCcw} />
          <KpiTile
            label="Power Status"
            value={activeBattery !== null ? `${activeBattery.toFixed(0)}%` : "—"}
            sub={activeBattery !== null ? (activeBattery >= 50 ? "Nominal" : activeBattery >= 20 ? "Reduced" : "Critical") : "No telemetry"}
            icon={Zap}
            tone={activeBattery === null ? "default" : activeBattery >= 50 ? "green" : activeBattery >= 20 ? "amber" : "red"}
          />
          <KpiTile
            label="Command Lock"
            value={linkOk ? "Locked" : "Degraded"}
            sub={linkOk ? "Uplink secured" : "Low link margin"}
            icon={Lock}
            tone={linkOk ? "blue" : "amber"}
          />
          <KpiTile
            label="System Health"
            value={thermalOk ? "Nominal" : "Alert"}
            sub={`Thermal ${activeThermal} ${activeSafeMode ? "· SAFE" : ""}`}
            icon={ShieldCheck}
            tone={thermalOk ? "green" : "red"}
          />
        </div>
      ),
    },
    {
      id: "orbital-canvas",
      title: "3D Orbital View",
      defaultPlacement: { x: 0, y: 3, w: 9, h: 14, minW: 5, minH: 8 },
      render: () => (
        <div className="card relative h-full overflow-hidden p-0">
          <OrbitalCanvas
            simTimeRef={simTimeRef}
            simTime={simTime}
            options={options}
            cameraMode={cameraMode}
            activeEffect={activeEffect}
            orbitDeltaKm={orbitDeltaKm}
            batteryPctRef={batteryPctRef}
            primaryOrbit={activeOrbit}
            primarySatLabel={selectedSat}
            peerSatellites={peerSatellites}
          />

          {/* Camera mode dropdown (overlay, top-left) */}
          <div className="absolute top-3 left-3 z-10">
            <button
              type="button"
              onClick={() => setShowCamMenu((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border bg-surface-1/90
                         text-xs text-content-primary hover:border-accent transition-colors backdrop-blur"
            >
              <span className="text-2xs text-content-muted uppercase tracking-wide">Camera</span>
              <span className="font-semibold">{CAMERA_MODES.find((m) => m.id === cameraMode)?.label}</span>
              <ChevronDown className={clsx("w-3.5 h-3.5 text-content-muted transition-transform", showCamMenu && "rotate-180")} />
            </button>
            {showCamMenu && (
              <div className="mt-1 w-44 rounded border border-border bg-surface-2 shadow-card-md py-1 animate-fade-in">
                {CAMERA_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setCameraMode(m.id); setShowCamMenu(false); }}
                    className={clsx(
                      "w-full text-left px-3 py-1.5 text-xs transition-colors",
                      cameraMode === m.id ? "text-accent font-semibold" : "text-content-secondary hover:bg-surface-3",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mission clock (overlay, top-right) */}
          <div className="absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded border border-border bg-surface-1/90 backdrop-blur">
            <div className="text-2xs text-content-muted uppercase tracking-wide">Mission Time (UTC)</div>
            <div className="font-mono text-xs font-semibold text-content-primary tabular-nums">{missionClock}</div>
          </div>

          {/* Legend (overlay, bottom-left) */}
          <div className="absolute bottom-3 left-3 z-10 px-3 py-2 rounded border border-border bg-surface-1/90 backdrop-blur space-y-1">
            <div className="text-2xs text-content-muted uppercase tracking-widest mb-0.5">Legend</div>
            <div className="flex items-center gap-2 text-2xs text-content-secondary">
              <span className="inline-block w-4 h-0.5 bg-success" /> Current Orbit
            </div>
            <div className="flex items-center gap-2 text-2xs text-content-secondary">
              <span className="inline-block w-4 h-0.5 border-t border-dashed" style={{ borderColor: "#38BDF8" }} /> Predicted Path
            </div>
            <div className="flex items-center gap-2 text-2xs text-content-secondary">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" /> Ground Station
            </div>
            <div className="flex items-center gap-2 text-2xs text-content-secondary">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" /> In Contact
            </div>
          </div>

          {/* Sub-satellite point (overlay, bottom-right) */}
          <div className="absolute bottom-3 right-3 z-10 px-2.5 py-1.5 rounded border border-border bg-surface-1/90 backdrop-blur">
            <div className="text-2xs text-content-muted uppercase tracking-wide">Sub-Satellite Point</div>
            <div className="font-mono text-xs text-content-primary tabular-nums">
              {ssp.lat.toFixed(2)}°{ssp.lat >= 0 ? "N" : "S"} · {Math.abs(ssp.lon).toFixed(2)}°{ssp.lon >= 0 ? "E" : "W"}
            </div>
          </div>

        </div>
      ),
    },
    {
      id: "orbit-info",
      title: "Orbit Info",
      defaultPlacement: { x: 9, y: 3, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-content-primary">Orbit Info</h3>
            <span
              className="text-2xs font-mono px-1.5 py-0.5 rounded border"
              style={{ color: activeSatConfig.color, borderColor: `${activeSatConfig.color}55`, background: `${activeSatConfig.color}18` }}
            >
              {selectedSat}
            </span>
          </div>
          <InfoRow label="Regime" value="LEO / SSO" />
          <InfoRow label="Apogee" value={`${(activeOrbit.altitudeKm + 4.9).toFixed(1)} km`} />
          <InfoRow label="Perigee" value={`${(activeOrbit.altitudeKm - 5.4).toFixed(1)} km`} />
          <InfoRow label="Eccentricity" value="0.0007" />
          <InfoRow label="RAAN" value={`${activeOrbit.raanDeg.toFixed(1)}°`} />
          <InfoRow label="True Anomaly" value={`${(((simTime % period) / period) * 360).toFixed(1)}°`} />
          <InfoRow label="Revolutions" value={`${Math.floor(simTime / period)}`} />
          <InfoRow label="Sim Elapsed" value={formatHMS(simTime)} />
          {activeSafeMode && <InfoRow label="Safe Mode" value="ACTIVE" />}
        </div>
      ),
    },
    {
      id: "display-options",
      title: "Display Options",
      defaultPlacement: { x: 9, y: 9, w: 3, h: 4, minW: 2, minH: 3 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Display Options</h3>
          <div className="space-y-1">
            {DISPLAY_TOGGLES.map((t) => (
              <label key={t.key} className="flex items-center justify-between py-1 cursor-pointer select-none">
                <span className="text-xs text-content-secondary">{t.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={options[t.key]}
                  onClick={() => setOptions((o) => ({ ...o, [t.key]: !o[t.key] }))}
                  className={clsx(
                    "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
                    options[t.key] ? "bg-accent" : "bg-surface-3",
                  )}
                >
                  <span
                    className={clsx(
                      "inline-block w-3 h-3 transform rounded-full bg-white shadow transition-transform",
                      options[t.key] ? "translate-x-3.5" : "translate-x-0.5",
                    )}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "time-controls",
      title: "Time Controls",
      defaultPlacement: { x: 9, y: 13, w: 3, h: 4, minW: 2, minH: 3 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Time Controls</h3>
          <div className="flex items-center justify-center gap-2 mb-3">
            <button type="button" onClick={() => scrub(-period / 4)} className="btn-ghost p-2" title="Back ¼ orbit">
              <Rewind className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white hover:opacity-90 transition-opacity"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button type="button" onClick={() => scrub(period / 4)} className="btn-ghost p-2" title="Forward ¼ orbit">
              <FastForward className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-content-muted uppercase tracking-wide shrink-0">Speed</span>
            <div className="flex flex-1 rounded border border-border overflow-hidden">
              {SIM_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s as SimSpeed)}
                  className={clsx(
                    "flex-1 px-1 py-1 text-2xs font-semibold tabular-nums transition-colors",
                    speed === s ? "bg-accent text-white" : "bg-surface-2 text-content-muted hover:text-content-secondary",
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={reset} className="btn-ghost text-2xs gap-1 mt-auto self-center">
            <RotateCcw className="w-3 h-3" /> Reset epoch
          </button>
        </div>
      ),
    },
    {
      id: "manoeuvre-control",
      title: "Manoeuvre Control",
      defaultPlacement: { x: 9, y: 17, w: 3, h: 17, minW: 2, minH: 10 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-border-subtle shrink-0">
            <h3 className="text-sm font-semibold text-content-primary">Manoeuvre Control</h3>
            {activePresetId && (
              <button
                type="button"
                onClick={clearEffects}
                className="text-2xs text-danger hover:underline"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Active effect status */}
          {activePresetId ? (
            <div className="mx-3 mt-2.5 mb-1 px-3 py-2 rounded border border-accent-border bg-accent-subtle shrink-0">
              {(() => {
                const flat = MANOEUVRE_GROUPS.flatMap((g) => g.presets);
                const p = flat.find((x) => x.id === activePresetId);
                const Icon = p?.icon ?? Flame;
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="text-xs font-semibold text-accent">{p?.label ?? "Running…"}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-none"
                        style={{ width: `${effectProgress * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-2xs text-content-muted">{p?.sub}</span>
                      <span className="font-mono text-2xs text-accent">{(effectProgress * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="mx-3 mt-2.5 mb-1 px-3 py-2 rounded border border-border-subtle bg-surface-2 text-2xs text-content-disabled text-center shrink-0">
              Click a manoeuvre to animate
            </div>
          )}

          {/* Orbit delta indicator */}
          {orbitDeltaKm !== 0 && (
            <div className="mx-3 mb-1 px-3 py-1.5 rounded border border-warning-border bg-warning-subtle flex items-center justify-between shrink-0">
              <span className="text-2xs text-warning">New orbit altitude</span>
              <span className="font-mono text-2xs text-warning font-bold">
                {(activeOrbit.altitudeKm + orbitDeltaKm).toFixed(1)} km
              </span>
            </div>
          )}

          {/* Grouped presets */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3 mt-1">
            {MANOEUVRE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="section-label mb-1">{group.title}</div>
                <div className="space-y-1">
                  {group.presets.map((preset) => {
                    const Icon = preset.icon;
                    const isActive = activePresetId === preset.id;
                    const toneClass = {
                      default: "border-border text-content-secondary hover:border-accent hover:text-accent",
                      amber:   "border-warning-border text-warning hover:bg-warning-subtle",
                      blue:    "border-accent-border text-accent hover:bg-accent-subtle",
                      green:   "border-success text-success hover:bg-success/10",
                      danger:  "border-danger-border text-danger hover:bg-danger-subtle",
                    }[preset.tone];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={!!activePresetId && !isActive}
                        onClick={() => isActive ? clearEffects() : triggerEffect(preset)}
                        className={clsx(
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded border text-left transition-colors",
                          "disabled:opacity-40 disabled:cursor-not-allowed",
                          isActive
                            ? "border-accent bg-accent text-white"
                            : `bg-surface-2 ${toneClass}`,
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold leading-tight truncate">{preset.label}</div>
                          <div className={clsx("text-2xs leading-tight truncate", isActive ? "text-white/70" : "text-content-disabled")}>
                            {preset.sub}
                          </div>
                        </div>
                        {isActive && <span className="text-2xs text-white/80 shrink-0">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "status-cards",
      title: "Status Cards",
      defaultPlacement: { x: 0, y: 17, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 h-full">
          {/* Orbit status */}
          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <div className="min-w-0">
              <div className="text-2xs text-content-muted uppercase tracking-widest">Orbit Status</div>
              <div className="text-xs font-bold text-success">NOMINAL</div>
              <div className="text-2xs text-content-muted truncate">All parameters within limits</div>
            </div>
          </div>

          {/* Next contact window */}
          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <RadioTower className={clsx("w-5 h-5 shrink-0", inContact ? "text-success" : "text-accent")} />
            <div className="min-w-0">
              <div className="text-2xs text-content-muted uppercase tracking-widest">
                {inContact ? "In Contact" : "Next Contact"}
              </div>
              {contact ? (
                <>
                  <div className="text-xs font-bold text-content-primary truncate">
                    {contact.station.name} ({contact.station.id})
                  </div>
                  <div className="font-mono text-2xs text-content-muted tabular-nums">
                    {inContact
                      ? `LOS in ${formatHMS(contact.losSeconds - simTime)}`
                      : `AOS in ${formatHMS(contact.aosSeconds - simTime)} · ${formatHMS(contact.losSeconds - contact.aosSeconds)} pass`}
                  </div>
                </>
              ) : (
                <div className="text-xs text-content-muted">Scanning…</div>
              )}
            </div>
          </div>

          {/* Orbit progress */}
          <div className="card px-3 py-2.5 flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
              <svg className="absolute inset-0 -rotate-90" width={44} height={44} viewBox="0 0 44 44">
                <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={4} />
                <circle
                  cx={22} cy={22} r={18} fill="none" stroke="#4F6BFF" strokeWidth={4} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={(1 - orbitProgress / 100) * 2 * Math.PI * 18}
                />
              </svg>
              <span className="font-mono text-2xs font-bold text-accent tabular-nums">{orbitProgress.toFixed(0)}%</span>
            </div>
            <div className="min-w-0">
              <div className="text-2xs text-content-muted uppercase tracking-widest">Orbit Progress</div>
              <div className="font-mono text-2xs text-content-secondary tabular-nums">
                {formatHMS(period - (simTime % period))} to node
              </div>
            </div>
          </div>

          {/* Prediction accuracy */}
          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-success shrink-0" />
            <div>
              <div className="text-2xs text-content-muted uppercase tracking-widest">Prediction Accuracy</div>
              <div className="font-mono text-md font-bold text-success tabular-nums">98.7%</div>
              <div className="text-2xs text-content-muted">Propagator vs ephemeris</div>
            </div>
          </div>

          {/* Alerts */}
          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <SatelliteIcon className="w-5 h-5 text-content-muted shrink-0" />
            <div>
              <div className="text-2xs text-content-muted uppercase tracking-widest">Orbit Alerts</div>
              <div className="text-xs font-bold text-content-primary">No Active Alerts</div>
              <div className="text-2xs text-content-muted">Conjunction screen clear</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const satTabs = (
    <div className="flex items-center gap-1">
      {SAT_CONFIGS.map((sat) => (
        <button
          key={sat.id}
          type="button"
          onClick={() => setSelectedSat(sat.id)}
          className={clsx(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors border",
            selectedSat === sat.id
              ? "text-white border-transparent"
              : "text-content-secondary border-border hover:border-accent",
          )}
          style={selectedSat === sat.id ? { background: sat.color, borderColor: sat.color } : undefined}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: selectedSat === sat.id ? "#fff" : sat.color }}
          />
          {sat.id}
        </button>
      ))}
    </div>
  );

  return (
    <EditableDashboard
      pageId={`simulation-orbital-${selectedSat}`}
      pageTitle="Orbital Operations Center"
      panels={panels}
      toolbarLeft={satTabs}
    />
  );
}
