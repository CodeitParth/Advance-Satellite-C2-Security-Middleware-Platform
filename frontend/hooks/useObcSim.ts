"use client";
// useObcSim — hybrid simulation engine for the OBC Monitoring Center.
// Real inputs: telemetry API (battery, thermal, orbital phase, safe mode, link)
// and WebSocket events (dispatches, replays, overrides). Everything the OBC
// doesn't expose (CPU, memory, services, faults, scheduler) is a deterministic
// 1 Hz client-side simulation that reacts to those real inputs.
import { useEffect, useRef, useState } from "react";
import type { TelemetryState, WSMessage } from "../lib/types";

// ── Static fleets ──────────────────────────────────────────────────────────────

export interface ObcService {
  name: string;
  pid: number;
  cpu: number;     // %
  memKb: number;
  status: "RUNNING" | "STANDBY" | "DEGRADED";
  essential: boolean;
}

const BASE_SERVICES: Omit<ObcService, "cpu" | "status">[] = [
  { name: "AOCS Controller",    pid: 101, memKb: 4280, essential: true },
  { name: "Thermal Manager",    pid: 102, memKb: 2110, essential: true },
  { name: "Comms Handler",      pid: 103, memKb: 3640, essential: true },
  { name: "Telemetry Service",  pid: 104, memKb: 2890, essential: true },
  { name: "Command Decoder",    pid: 105, memKb: 1950, essential: true },
  { name: "Watchdog",           pid: 106, memKb: 410,  essential: true },
  { name: "EPS Monitor",        pid: 107, memKb: 1240, essential: true },
  { name: "Payload Manager",    pid: 108, memKb: 5120, essential: false },
  { name: "File System",        pid: 109, memKb: 2380, essential: true },
  { name: "Crypto Engine",      pid: 110, memKb: 1860, essential: true },
  { name: "Orbit Propagator",   pid: 111, memKb: 3220, essential: false },
  { name: "Star Tracker IF",    pid: 112, memKb: 2740, essential: false },
  { name: "Logger",             pid: 113, memKb: 980,  essential: false },
  { name: "Beacon Generator",   pid: 114, memKb: 620,  essential: true },
];

export interface ObcTask {
  name: string;
  intervalS: number;
  nextRunS: number;
  priority: "HIGH" | "MED" | "LOW";
}

const BASE_TASKS: Omit<ObcTask, "nextRunS">[] = [
  { name: "Health Check",      intervalS: 30,   priority: "HIGH" },
  { name: "Telemetry Beacon",  intervalS: 10,   priority: "HIGH" },
  { name: "Battery Check",     intervalS: 60,   priority: "HIGH" },
  { name: "Thermal Sweep",     intervalS: 120,  priority: "MED" },
  { name: "Orbit Update",      intervalS: 300,  priority: "MED" },
  { name: "Log Rotation",      intervalS: 600,  priority: "LOW" },
  { name: "FS Integrity Scan", intervalS: 900,  priority: "LOW" },
];

export interface ObcFault {
  id: string;
  message: string;
  severity: "INFO" | "WARN" | "CRIT";
  status: "ACTIVE" | "MONITORING" | "CLEARED";
  at: number; // epoch ms
}

export interface StreamEvent {
  id: number;
  at: number; // epoch ms
  kind: "info" | "ok" | "warn" | "security";
  source: string;
  message: string;
}

export interface ResourceSample {
  t: number;       // seconds since start
  cpu: number;     // %
  ram: number;     // %
  net: number;     // kbps
  bus: number;     // msgs/s
  temp: number;    // °C
  power: number;   // W draw
  solar: number;   // W input
}

export interface ObcSimState {
  uptimeS: number;
  bootCount: number;
  obcClock: number;        // epoch ms
  cpuLoad: number;
  cpuClockMhz: number;
  cpuTemp: number;
  ramPct: number;
  ramTotalMb: number;
  flashPct: number;
  flashTotalMb: number;
  fragmentationPct: number;
  services: ObcService[];
  tasks: ObcTask[];
  faults: ObcFault[];
  stream: StreamEvent[];
  history: ResourceSample[];
  busVoltage: number;
  solarInputW: number;
  powerDrawW: number;
  securityState: "SECURE" | "ALERT";
  obcStatus: "NOMINAL" | "DEGRADED" | "SAFE MODE";
}

const SEED_FAULTS: ObcFault[] = [
  { id: "FLT-0412-003", message: "Star tracker glint — attitude est. fallback to gyro", severity: "WARN", status: "CLEARED", at: Date.now() - 8.2e6 },
  { id: "FLT-0415-001", message: "Flash sector 0x3A wear-level threshold", severity: "INFO", status: "MONITORING", at: Date.now() - 3.1e6 },
  { id: "FLT-0419-002", message: "Transient bus undervoltage during eclipse entry", severity: "WARN", status: "CLEARED", at: Date.now() - 1.4e6 },
];

function walk(value: number, target: number, jitter: number, pull = 0.06): number {
  return value + (target - value) * pull + (Math.random() - 0.5) * jitter;
}

const HISTORY_LEN = 60;

export interface ObcSimConfig {
  initUptimeS?: number;
  initBootCount?: number;
  initSeedFaults?: ObcFault[];
  initCpuLoad?: number;
  initRamPct?: number;
  initBusVoltage?: number;
  initSolarInputW?: number;
}

export const SAT_BRAVO_FAULTS: ObcFault[] = [
  { id: "FLT-B201-001", message: "Orbit propagator drift — correction scheduled", severity: "INFO",  status: "MONITORING", at: Date.now() - 2.8e6 },
  { id: "FLT-B204-002", message: "S-Band link margin low during eclipse transition", severity: "WARN", status: "CLEARED",    at: Date.now() - 1.1e6 },
];

export const SAT_CHARLIE_FAULTS: ObcFault[] = [
  { id: "FLT-C301-001", message: "Thermal control in elevated recovery mode",       severity: "WARN", status: "ACTIVE",     at: Date.now() - 5.2e6 },
  { id: "FLT-C302-002", message: "Safe-mode engaged — DISABLE_WATCHDOG rejected",  severity: "CRIT", status: "MONITORING", at: Date.now() - 2.4e6 },
  { id: "FLT-C305-003", message: "Flash sector 0x1F wear-level threshold exceeded", severity: "INFO", status: "CLEARED",    at: Date.now() - 9.0e5 },
];

export function useObcSim(telemetry: TelemetryState | null, config: ObcSimConfig = {}) {
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;

  const eventIdRef = useRef(100);
  const cpuSpikeRef = useRef(0); // transient load added by real events

  const [state, setState] = useState<ObcSimState>(() => ({
    uptimeS:          config.initUptimeS    ?? 154.7 * 3600,
    bootCount:        config.initBootCount  ?? 7,
    obcClock: Date.now(),
    cpuLoad:          config.initCpuLoad    ?? 52,
    cpuClockMhz: 1200,
    cpuTemp: 36.5,
    ramPct:           config.initRamPct     ?? 70,
    ramTotalMb: 256,
    flashPct: 45,
    flashTotalMb: 4096,
    fragmentationPct: 12,
    services: BASE_SERVICES.map((s) => ({ ...s, cpu: 2 + Math.random() * 6, status: "RUNNING" as const })),
    tasks: BASE_TASKS.map((t) => ({ ...t, nextRunS: Math.random() * t.intervalS })),
    faults:           config.initSeedFaults ?? SEED_FAULTS,
    stream: [],
    history: [],
    busVoltage:       config.initBusVoltage   ?? 27.1,
    solarInputW:      config.initSolarInputW  ?? 58,
    powerDrawW: 38,
    securityState: "SECURE",
    obcStatus: "NOMINAL",
  }));

  /** Push a real event into the stream + nudge the simulated CPU. */
  function pushEvent(kind: StreamEvent["kind"], source: string, message: string, cpuSpike = 0) {
    cpuSpikeRef.current += cpuSpike;
    setState((s) => ({
      ...s,
      stream: [
        { id: ++eventIdRef.current, at: Date.now(), kind, source, message },
        ...s.stream,
      ].slice(0, 80),
    }));
  }

  /** Wire WebSocket messages (real platform events) into the simulation. */
  function handleWsMessage(msg: WSMessage) {
    if (msg.type === "COMMAND_DISPATCHED") {
      pushEvent("ok", "Command Decoder", `Uplink command executed — ${msg.command_id.slice(0, 8)}…`, 18);
    } else if (msg.type === "COMMAND_PENDING") {
      pushEvent("info", "Comms Handler", `Uplink frame received — ${msg.command_type} (${msg.risk_tier})`, 6);
    } else if (msg.type === "COMMAND_REJECTED") {
      pushEvent("warn", "Command Decoder", `Ground rejected command ${msg.command_id.slice(0, 8)}…`);
    } else if (msg.type === "REPLAY_DETECTED") {
      pushEvent("security", "Crypto Engine", `Replay nonce rejected — ${msg.command_type} from ${msg.operator_id}`, 10);
      setState((s) => ({
        ...s,
        securityState: "ALERT",
        faults: [
          {
            id: `FLT-SEC-${String(eventIdRef.current).padStart(3, "0")}`,
            message: `Security: duplicate nonce rejected (${msg.command_type})`,
            severity: "CRIT" as const,
            status: "ACTIVE" as const,
            at: Date.now(),
          },
          ...s.faults,
        ].slice(0, 12),
      }));
    } else if (msg.type === "OVERRIDE_ACTIVATED") {
      pushEvent("security", "Command Decoder", `EMERGENCY OVERRIDE active — by ${msg.activated_by}`, 8);
    }
  }

  function acknowledgeFault(id: string) {
    setState((s) => ({
      ...s,
      faults: s.faults.map((f) => (f.id === id ? { ...f, status: "MONITORING" as const } : f)),
      securityState: s.faults.some((f) => f.id !== id && f.status === "ACTIVE" && f.severity === "CRIT")
        ? s.securityState
        : "SECURE",
    }));
  }

  // 1 Hz simulation tick
  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const t = telemetryRef.current;
      const safeMode = t?.safe_mode ?? false;
      const sunlit = (t?.orbital_phase ?? "SUNLIT") === "SUNLIT";
      const battery = t?.battery_percent ?? 78;
      const thermal = t?.thermal_status ?? "NOMINAL";

      setState((s) => {
        // CPU: idles lower in safe mode; real events spike it via cpuSpikeRef
        const cpuTarget = (safeMode ? 28 : 54) + cpuSpikeRef.current;
        cpuSpikeRef.current = Math.max(0, cpuSpikeRef.current - 4);
        const cpuLoad = Math.min(98, Math.max(5, walk(s.cpuLoad, cpuTarget, 6)));

        // Temperature follows the real thermal state
        const tempTarget = thermal === "CRITICAL" ? 71 : thermal === "ELEVATED" ? 52 : 36.5;
        const cpuTemp = walk(s.cpuTemp, tempTarget + cpuLoad * 0.05, 0.6);

        const ramPct = Math.min(95, Math.max(40, walk(s.ramPct, safeMode ? 58 : 72, 1.6)));
        const flashPct = Math.min(96, s.flashPct + 0.0004); // slow fill
        const fragmentationPct = Math.min(30, Math.max(6, walk(s.fragmentationPct, 12, 0.3)));

        // Power: solar input gated by the real orbital phase; draw tracks CPU
        const solarInputW = Math.max(0, walk(s.solarInputW, sunlit ? 58 : 0, 2.5, 0.15));
        const powerDrawW = Math.max(18, walk(s.powerDrawW, 30 + cpuLoad * 0.22, 1.8));
        const busVoltage = Math.max(21, Math.min(29.5, walk(s.busVoltage, 24 + battery * 0.05, 0.12)));

        // Services: payload & non-essentials stand down in safe mode
        const services = s.services.map((svc) => {
          const standby = safeMode && !svc.essential;
          return {
            ...svc,
            status: standby ? ("STANDBY" as const) : ("RUNNING" as const),
            cpu: standby ? 0.1 : Math.max(0.3, walk(svc.cpu, svc.essential ? 5 : 3.5, 1.2)),
          };
        });

        // Scheduler countdowns
        const tasks = s.tasks.map((task) => {
          const nextRunS = task.nextRunS - 1;
          return { ...task, nextRunS: nextRunS <= 0 ? task.intervalS : nextRunS };
        });

        // History sample
        const sample: ResourceSample = {
          t: tick,
          cpu: cpuLoad,
          ram: ramPct,
          net: Math.max(0, 24 + (Math.random() - 0.5) * 18 + cpuSpikeRef.current * 2),
          bus: Math.max(0, 110 + (Math.random() - 0.5) * 40),
          temp: cpuTemp,
          power: powerDrawW,
          solar: solarInputW,
        };

        const activeCritical = s.faults.some((f) => f.status === "ACTIVE" && f.severity === "CRIT");
        const obcStatus = safeMode ? "SAFE MODE" : activeCritical || thermal === "CRITICAL" ? "DEGRADED" : "NOMINAL";

        return {
          ...s,
          uptimeS: s.uptimeS + 1,
          obcClock: Date.now(),
          cpuLoad,
          cpuTemp,
          ramPct,
          flashPct,
          fragmentationPct,
          services,
          tasks,
          busVoltage,
          solarInputW,
          powerDrawW,
          obcStatus,
          history: [...s.history, sample].slice(-HISTORY_LEN),
        };
      });

      // Periodic synthetic stream chatter (real events arrive via handleWsMessage)
      if (tick % 10 === 0) {
        pushEvent("info", "Telemetry Service", `Telemetry packet downlinked #${4800 + Math.floor(tick / 10)}`);
      }
      if (tick % 30 === 0) {
        pushEvent("ok", "Watchdog", "Task Health Check completed — all subsystems responsive");
      }
      if (tick % 60 === 0) {
        pushEvent("info", "EPS Monitor", `Battery ${battery.toFixed(0)}% · bus nominal`);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, handleWsMessage, acknowledgeFault };
}
