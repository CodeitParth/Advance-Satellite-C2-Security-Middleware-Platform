"use client";
// OBC Monitoring Center — on-board computer health and resource monitor.
// Follows mockups/"OBC Simulation Panel 2.png".
// Hybrid data: telemetry API + WS events drive the simulation in useObcSim.
// Preview mode: command sequencer with animated step-through of effects.
import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  HardDrive,
  Info,
  ListTree,
  Lock,
  MemoryStick,
  Pause,
  Play,
  RadioTower,
  ShieldAlert,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Line as RLine,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { KpiTile } from "../../../components/ui/KpiTile";
import { useTelemetry } from "../../../hooks/useTelemetry";
import { useApprovalWebSocket } from "../../../hooks/useApprovalWebSocket";
import {
  useObcSim,
  SAT_BRAVO_FAULTS,
  SAT_CHARLIE_FAULTS,
  type ObcFault,
  type StreamEvent,
} from "../../../hooks/useObcSim";
import { useCommandPreview } from "../../../hooks/useCommandPreview";
import { CommandSequencer } from "../../../components/simulation/CommandSequencer";
import { api } from "../../../lib/api";
import type { TelemetryState, SatelliteSimState } from "../../../lib/types";

// ── Small shared pieces ────────────────────────────────────────────────────────

function RadialGauge({
  pct,
  label,
  color,
  size = 88,
}: { pct: number; label: string; color: string; size?: number }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(128,128,128,0.16)" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={(1 - pct / 100) * c}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
        <span className="text-2xs text-content-muted">{label}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border-subtle last:border-0">
      <span className="text-2xs text-content-muted">{label}</span>
      <span className={clsx("font-mono text-2xs tabular-nums", valueClass ?? "text-content-primary")}>{value}</span>
    </div>
  );
}

const STREAM_ICON: Record<StreamEvent["kind"], { icon: React.ElementType; cls: string }> = {
  info:     { icon: Info,         cls: "text-accent" },
  ok:       { icon: CheckCircle2, cls: "text-success" },
  warn:     { icon: AlertTriangle, cls: "text-warning" },
  security: { icon: ShieldAlert,  cls: "text-security" },
};

const FAULT_SEVERITY_CLS: Record<ObcFault["severity"], string> = {
  INFO: "bg-accent-subtle text-accent border-accent-border",
  WARN: "bg-warning-subtle text-warning border-warning-border",
  CRIT: "bg-danger-subtle text-danger border-danger-border",
};

const FAULT_STATUS_CLS: Record<ObcFault["status"], string> = {
  ACTIVE:     "text-danger",
  MONITORING: "text-warning",
  CLEARED:    "text-content-muted",
};

function chartTooltipStyle() {
  return {
    background: "var(--surface-2)",
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    fontSize: 10,
  } as const;
}

type SimMode = "live" | "preview";
type SatId = "SAT_ALPHA" | "SAT_BRAVO" | "SAT_CHARLIE";

const SAT_TABS: { id: SatId; label: string; sub: string }[] = [
  { id: "SAT_ALPHA",   label: "SAT_ALPHA",   sub: "Primary — 547 km SSO" },
  { id: "SAT_BRAVO",   label: "SAT_BRAVO",   sub: "Secondary — 551 km SSO" },
  { id: "SAT_CHARLIE", label: "SAT_CHARLIE",  sub: "Tertiary — 544 km SSO" },
];

// Converts peer sim state into a TelemetryState shape that useObcSim can consume
function peerToTelemetry(p: SatelliteSimState): TelemetryState {
  return {
    battery_percent: p.battery_percent,
    safe_mode:       p.safe_mode_active,
    thermal_status:  p.thermal_status as TelemetryState["thermal_status"],
    orbital_phase:   p.orbital_phase  as TelemetryState["orbital_phase"],
    link_margin_db:  p.satellite_id === "SAT_BRAVO" ? 9.2 : 6.8,
    updated_at:      new Date().toISOString(),
  };
}

const PEER_SEEDS: Record<string, SatelliteSimState> = {
  SAT_BRAVO:   { satellite_id: "SAT_BRAVO",   battery_percent: 85.0, safe_mode_active: false, thermal_status: "NOMINAL",  orbital_phase: "SUNLIT",  altitude_km: 551.4, is_local: false },
  SAT_CHARLIE: { satellite_id: "SAT_CHARLIE",  battery_percent: 72.0, safe_mode_active: true,  thermal_status: "ELEVATED", orbital_phase: "ECLIPSE", altitude_km: 543.8, is_local: false },
};

export default function ObcMonitoringPage() {
  const { telemetry } = useTelemetry();
  const [selectedSat, setSelectedSat] = useState<SatId>("SAT_ALPHA");

  // Peer telemetry — seeded immediately, refreshed from API every 15s
  const [bravoSim, setBravoSim] = useState<SatelliteSimState>(PEER_SEEDS.SAT_BRAVO);
  const [charlieSim, setCharlieSim] = useState<SatelliteSimState>(PEER_SEEDS.SAT_CHARLIE);

  useEffect(() => {
    let active = true;
    const load = () =>
      api.getSimSatellites().then((sats) => {
        if (!active) return;
        const b = sats.find((s) => s.satellite_id === "SAT_BRAVO");
        const c = sats.find((s) => s.satellite_id === "SAT_CHARLIE");
        if (b) setBravoSim(b);
        if (c) setCharlieSim(c);
      }).catch(() => {});
    load();
    const t = setInterval(load, 15_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  const bravoTelemetry   = useMemo(() => peerToTelemetry(bravoSim),   [bravoSim]);
  const charlieTelemetry = useMemo(() => peerToTelemetry(charlieSim), [charlieSim]);

  // Independent OBC sim for each satellite
  const obcAlpha   = useObcSim(telemetry,        {});
  const obcBravo   = useObcSim(bravoTelemetry,   { initUptimeS: 89.3 * 3600, initBootCount: 3,  initCpuLoad: 48, initRamPct: 64, initSeedFaults: SAT_BRAVO_FAULTS,   initBusVoltage: 26.8, initSolarInputW: 62 });
  const obcCharlie = useObcSim(charlieTelemetry, { initUptimeS: 213.6 * 3600, initBootCount: 12, initCpuLoad: 28, initRamPct: 58, initSeedFaults: SAT_CHARLIE_FAULTS, initBusVoltage: 25.4, initSolarInputW: 0  });

  // Active satellite's sim
  const activeSim = selectedSat === "SAT_ALPHA" ? obcAlpha : selectedSat === "SAT_BRAVO" ? obcBravo : obcCharlie;
  const { state, handleWsMessage, acknowledgeFault } = activeSim;

  const { isConnected } = useApprovalWebSocket({ onMessage: handleWsMessage, enabled: true });
  const [streamPaused, setStreamPaused] = useState(false);
  const [frozenStream, setFrozenStream] = useState<StreamEvent[]>([]);
  const [simMode, setSimMode] = useState<SimMode>("live");

  // Active telemetry for the selected satellite
  const activeTelemetry = selectedSat === "SAT_ALPHA" ? telemetry
                        : selectedSat === "SAT_BRAVO"  ? bravoTelemetry
                        : charlieTelemetry;

  const preview = useCommandPreview({ telemetry: activeTelemetry });

  function toggleStream() {
    if (!streamPaused) setFrozenStream(state.stream);
    setStreamPaused((p) => !p);
  }

  const stream = streamPaused ? frozenStream : state.stream;

  const uptimeH = Math.floor(state.uptimeS / 3600);
  const uptimeM = Math.floor((state.uptimeS % 3600) / 60);
  const ramFreeMb = state.ramTotalMb * (1 - state.ramPct / 100);
  const linkDb = activeTelemetry?.link_margin_db ?? null;

  // In preview mode, use projected battery from the command sequencer
  const displayBatteryPct =
    simMode === "preview" && preview.displayBattery !== null
      ? preview.displayBattery
      : activeTelemetry?.battery_percent ?? 0;

  const statusTone = state.obcStatus === "NOMINAL" ? "green" : state.obcStatus === "SAFE MODE" ? "blue" : "amber";

  const panels: DashboardPanel[] = [
    {
      id: "obc-kpis",
      title: "OBC KPI Strip",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 h-full">
          <KpiTile label="OBC Status" value={state.obcStatus} sub={isConnected ? "Live link" : "Polling"} icon={Cpu} tone={statusTone} />
          <KpiTile label="Uptime" value={`${uptimeH}h ${String(uptimeM).padStart(2, "0")}m`} sub={`Boot count ${state.bootCount}`} icon={Clock} />
          <KpiTile label="OBC Clock" value={new Date(state.obcClock).toISOString().slice(11, 19)} unit="UTC" sub={new Date(state.obcClock).toISOString().slice(0, 10)} icon={CalendarClock} />
          <KpiTile
            label="CPU Temp"
            value={`${state.cpuTemp.toFixed(1)}°C`}
            sub={`Thermal ${activeTelemetry?.thermal_status ?? "—"}`}
            icon={Thermometer}
            tone={state.cpuTemp > 65 ? "red" : state.cpuTemp > 48 ? "amber" : "green"}
          />
          <KpiTile label="Memory Free" value={ramFreeMb.toFixed(1)} unit="MB" sub={`of ${state.ramTotalMb} MB`} icon={MemoryStick} />
          <KpiTile
            label="Uplink"
            value="S-Band"
            sub={linkDb !== null ? `${linkDb.toFixed(1)} dB margin` : "No telemetry"}
            icon={RadioTower}
            tone={linkDb !== null && linkDb < 5 ? "amber" : "blue"}
          />
          <KpiTile
            label="Security State"
            value={state.securityState}
            sub={state.securityState === "SECURE" ? "Crypto nominal" : "Active security fault"}
            icon={Lock}
            tone={state.securityState === "SECURE" ? "purple" : "red"}
          />
        </div>
      ),
    },
    {
      id: "cpu-performance",
      title: "CPU Performance",
      defaultPlacement: { x: 0, y: 3, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-2">CPU Performance</h3>
          <div className="flex items-center gap-3">
            <RadialGauge pct={state.cpuLoad} label="load" color={state.cpuLoad > 85 ? "#EF4444" : state.cpuLoad > 70 ? "#F59E0B" : "#4F6BFF"} />
            <div className="flex-1 min-w-0">
              <StatRow label="Clock" value={`${state.cpuClockMhz} MHz`} />
              <StatRow label="Temp" value={`${state.cpuTemp.toFixed(1)} °C`} valueClass={state.cpuTemp > 65 ? "text-danger" : state.cpuTemp > 48 ? "text-warning" : "text-success"} />
              <StatRow label="Processes" value={`${state.services.filter((s) => s.status === "RUNNING").length}`} />
            </div>
          </div>
          <div className="section-label mt-2 mb-1">CPU Load (last 60s)</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="cpu" stroke="#4F6BFF" fill="#4F6BFF" fillOpacity={0.22} strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "memory-storage",
      title: "Memory & Storage",
      defaultPlacement: { x: 3, y: 3, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Memory &amp; Storage</h3>
          <div className="flex items-center justify-around mb-2">
            <RadialGauge pct={state.ramPct} label="RAM" color={state.ramPct > 88 ? "#EF4444" : "#8B5CF6"} size={80} />
            <RadialGauge pct={state.flashPct} label="Flash" color="#38BDF8" size={80} />
          </div>
          <StatRow label="RAM Used" value={`${(state.ramTotalMb * state.ramPct / 100).toFixed(0)} / ${state.ramTotalMb} MB`} />
          <StatRow label="Flash Used" value={`${(state.flashTotalMb * state.flashPct / 100 / 1024).toFixed(2)} / ${(state.flashTotalMb / 1024).toFixed(0)} GB`} />
          <StatRow label="Fragmentation" value={`${state.fragmentationPct.toFixed(0)}%`} valueClass={state.fragmentationPct > 20 ? "text-warning" : "text-content-primary"} />
          <div className="section-label mt-2 mb-1">RAM (last 60s)</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="ram" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ),
    },
    {
      id: "running-services",
      title: "Running Services",
      defaultPlacement: { x: 6, y: 3, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 shrink-0">
            <ListTree className="w-4 h-4 text-content-muted" />
            <h3 className="text-sm font-semibold text-content-primary">
              Running Services ({state.services.filter((s) => s.status === "RUNNING").length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {state.services.map((svc) => (
              <div key={svc.pid} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-2">
                <span className={clsx(
                  "status-dot shrink-0",
                  svc.status === "RUNNING" ? "status-dot-online" : svc.status === "STANDBY" ? "status-dot-offline" : "status-dot-warning",
                )} />
                <span className="text-2xs text-content-primary flex-1 truncate">{svc.name}</span>
                <span className="font-mono text-2xs text-content-disabled shrink-0">#{svc.pid}</span>
                <span className="font-mono text-2xs text-content-muted tabular-nums w-10 text-right shrink-0">
                  {svc.status === "STANDBY" ? "—" : `${svc.cpu.toFixed(1)}%`}
                </span>
                <span className="font-mono text-2xs text-content-muted tabular-nums w-12 text-right shrink-0">
                  {(svc.memKb / 1024).toFixed(1)}M
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "telemetry-stream",
      title: "Telemetry Stream",
      defaultPlacement: { x: 9, y: 3, w: 3, h: 13, minW: 2, minH: 6 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 border-b border-border-subtle shrink-0">
            <h3 className="text-sm font-semibold text-content-primary">Telemetry Stream</h3>
            <span className={clsx("live-badge", streamPaused && "opacity-50")}>
              {streamPaused ? "PAUSED" : "LIVE"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {stream.length === 0 ? (
              <p className="text-2xs text-content-muted text-center py-6">Waiting for events…</p>
            ) : (
              stream.map((evt) => {
                const meta = STREAM_ICON[evt.kind];
                const Icon = meta.icon;
                return (
                  <div key={evt.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-2">
                    <Icon className={clsx("w-3.5 h-3.5 shrink-0 mt-px", meta.cls)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-2xs text-content-primary leading-snug">{evt.message}</div>
                      <div className="text-2xs text-content-disabled font-mono">
                        {evt.source} · {new Date(evt.at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button
            type="button"
            onClick={toggleStream}
            className="flex items-center justify-center gap-1.5 mx-3 mb-3 mt-1 px-3 py-1.5 rounded border border-border
                       bg-surface-2 text-xs text-content-secondary hover:text-content-primary hover:border-accent transition-colors shrink-0"
          >
            {streamPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            {streamPaused ? "Resume Stream" : "Pause Stream"}
          </button>
        </div>
      ),
    },
    {
      id: "task-scheduler",
      title: "Task Scheduler",
      defaultPlacement: { x: 0, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <h3 className="text-sm font-semibold text-content-primary px-4 pt-3.5 pb-2 shrink-0">Task Scheduler</h3>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {state.tasks.map((task) => (
              <div key={task.name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-2">
                <span className={clsx(
                  "px-1 py-0.5 rounded-xs border text-2xs font-bold shrink-0",
                  task.priority === "HIGH" ? "bg-danger-subtle text-danger border-danger-border" :
                  task.priority === "MED"  ? "bg-warning-subtle text-warning border-warning-border" :
                                             "bg-surface-2 text-content-muted border-border",
                )}>
                  {task.priority}
                </span>
                <span className="text-2xs text-content-primary flex-1 truncate">{task.name}</span>
                <span className="font-mono text-2xs text-content-muted tabular-nums shrink-0">
                  T-{Math.ceil(task.nextRunS)}s
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-border-subtle text-2xs text-content-muted shrink-0">
            {state.tasks.length} scheduled · RTOS tick 1 Hz
          </div>
        </div>
      ),
    },
    {
      id: "fault-monitor",
      title: "Fault Monitor",
      defaultPlacement: { x: 3, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2 shrink-0">
            <h3 className="text-sm font-semibold text-content-primary">Fault Monitor</h3>
            {state.faults.some((f) => f.status === "ACTIVE") && (
              <span className="px-1.5 py-0.5 rounded-full bg-danger text-white text-2xs font-bold">
                {state.faults.filter((f) => f.status === "ACTIVE").length} ACTIVE
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {state.faults.map((fault) => (
              <div key={fault.id} className="px-2 py-1.5 rounded border border-border-subtle bg-surface-2">
                <div className="flex items-center gap-2">
                  <span className={clsx("px-1 py-0.5 rounded-xs border text-2xs font-bold shrink-0", FAULT_SEVERITY_CLS[fault.severity])}>
                    {fault.severity}
                  </span>
                  <span className="font-mono text-2xs text-content-muted flex-1 truncate">{fault.id}</span>
                  <span className={clsx("text-2xs font-semibold shrink-0", FAULT_STATUS_CLS[fault.status])}>
                    {fault.status}
                  </span>
                </div>
                <div className="text-2xs text-content-secondary mt-1 leading-snug">{fault.message}</div>
                {fault.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => acknowledgeFault(fault.id)}
                    className="text-2xs text-accent hover:underline mt-1"
                  >
                    Acknowledge →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "power-system",
      title: "Power System",
      defaultPlacement: { x: 6, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Power System</h3>
          <div className="flex items-center gap-3 mb-1">
            <RadialGauge
              pct={displayBatteryPct}
              label={simMode === "preview" ? "projected" : "battery"}
              color={displayBatteryPct >= 50 ? "#22C55E" : displayBatteryPct >= 20 ? "#F59E0B" : "#EF4444"}
              size={76}
            />
            <div className="flex-1 min-w-0">
              <StatRow label="Bus Voltage" value={`${state.busVoltage.toFixed(1)} V`} />
              <StatRow label="Solar Input" value={`${state.solarInputW.toFixed(0)} W`} valueClass={state.solarInputW > 5 ? "text-success" : "text-content-muted"} />
              <StatRow label="Power Draw" value={`${state.powerDrawW.toFixed(0)} W`} />
            </div>
          </div>
          <div className="section-label mt-1 mb-1">Power (W, last 60s)</div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={state.history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <YAxis hide />
                <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={() => ""} />
                <RLine type="monotone" dataKey="solar" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <RLine type="monotone" dataKey="power" stroke="#22C55E" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-2xs text-content-muted"><span className="w-3 h-0.5 bg-warning inline-block" /> Solar in</span>
            <span className="flex items-center gap-1 text-2xs text-content-muted"><span className="w-3 h-0.5 bg-success inline-block" /> Draw</span>
          </div>
        </div>
      ),
    },
    ...(simMode === "preview"
      ? [{
          id: "command-sequencer",
          title: "Command Sequence Preview",
          defaultPlacement: { x: 0, y: 10, w: 3, h: 12, minW: 2, minH: 8 },
          render: () => (
            <div className="card p-4 h-full flex flex-col overflow-y-auto">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Eye className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-content-primary">Command Sequence Preview</h3>
              </div>
              <div className="flex-1 min-h-0">
                <CommandSequencer preview={preview} />
              </div>
            </div>
          ),
        }]
      : []),
    {
      id: "resource-strip",
      title: "System Resources Utilization",
      defaultPlacement: { x: 0, y: 16, w: 12, h: 4, minW: 6, minH: 3 },
      render: () => (
        <div className="card p-3 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-2 px-1">System Resources Utilization</h3>
          <div className="grid grid-cols-3 xl:grid-cols-6 gap-2 flex-1 min-h-0">
            {([
              { key: "cpu",   label: "CPU Load",   unit: "%",      color: "#4F6BFF", icon: Cpu },
              { key: "ram",   label: "RAM",        unit: "%",      color: "#8B5CF6", icon: MemoryStick },
              { key: "net",   label: "Network I/O", unit: "kbps",  color: "#38BDF8", icon: Activity },
              { key: "bus",   label: "Bus Traffic", unit: "msg/s", color: "#22C55E", icon: Database },
              { key: "temp",  label: "Temp",       unit: "°C",     color: "#F59E0B", icon: Thermometer },
              { key: "power", label: "Power Draw", unit: "W",      color: "#EF4444", icon: Zap },
            ] as const).map((m) => {
              const last = state.history[state.history.length - 1];
              const value = last ? (last[m.key] as number) : 0;
              const Icon = m.icon;
              return (
                <div key={m.key} className="rounded border border-border-subtle bg-surface-2 p-2 flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="flex items-center gap-1 text-2xs text-content-muted truncate">
                      <Icon className="w-3 h-3 shrink-0" />
                      {m.label}
                    </span>
                    <span className="font-mono text-2xs font-bold tabular-nums" style={{ color: m.color }}>
                      {value.toFixed(0)}{m.unit}
                    </span>
                  </div>
                  <div className="flex-1 min-h-[28px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={state.history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <YAxis hide domain={["auto", "auto"]} />
                        <RLine type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={1.2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
  ];

  // Satellite status dots for tabs
  const satHealthColor = (id: SatId) => {
    if (id === "SAT_ALPHA") return activeTelemetry ? "status-dot-online" : "status-dot-warning";
    const p = id === "SAT_BRAVO" ? bravoSim : charlieSim;
    return p.battery_percent >= 20 && p.thermal_status !== "CRITICAL" ? "status-dot-online" : "status-dot-warning";
  };

  const toolbar = (
    <div className="flex items-center gap-3">
      {/* Satellite selector */}
      <div className="flex items-center gap-0.5 p-0.5 bg-surface-2 border border-border rounded">
        {SAT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedSat(tab.id)}
            title={tab.sub}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors",
              selectedSat === tab.id
                ? "bg-accent text-white"
                : "text-content-muted hover:text-content-secondary",
            )}
          >
            <span className={clsx("status-dot shrink-0", selectedSat === tab.id ? "status-dot-online" : satHealthColor(tab.id))} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live / Preview mode toggle */}
      <div className="flex items-center gap-1 p-0.5 bg-surface-2 border border-border rounded">
        <button
          type="button"
          onClick={() => setSimMode("live")}
          className={clsx(
            "px-3 py-1 rounded text-xs font-semibold transition-colors",
            simMode === "live" ? "bg-accent text-white" : "text-content-muted hover:text-content-secondary",
          )}
        >
          Live
        </button>
        <button
          type="button"
          onClick={() => setSimMode("preview")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors",
            simMode === "preview" ? "bg-accent text-white" : "text-content-muted hover:text-content-secondary",
          )}
        >
          <Eye className="w-3 h-3" />
          Preview
        </button>
      </div>
    </div>
  );

  return (
    <EditableDashboard
      pageId={`simulation-obc-${selectedSat}`}
      pageTitle={`OBC Monitor — ${selectedSat}`}
      panels={panels}
      toolbarLeft={toolbar}
    />
  );
}
