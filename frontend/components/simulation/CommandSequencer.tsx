"use client";
// CommandSequencer — preview a sequence of satellite commands before execution.
// Shows queue editor, step progress, projected state deltas, and safety warnings.
import { useState } from "react";
import { clsx } from "clsx";
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Shield,
  Square,
  Thermometer,
  Trash2,
  Zap,
} from "lucide-react";
import type { useCommandPreview } from "../../hooks/useCommandPreview";

type PreviewState = ReturnType<typeof useCommandPreview>;

interface CommandSequencerProps {
  preview: PreviewState;
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-0.5">
      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-1.5 text-2xs text-warning bg-warning-subtle border border-warning-border rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

function DeltaBadge({ label, value, unit = "" }: { label: string; value: string | number; unit?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-2xs font-mono bg-surface-2">
      <span className="text-content-muted">{label}</span>
      <span className="text-content-primary font-bold">{value}{unit}</span>
    </span>
  );
}

// ── Progress bar for step animation ──────────────────────────────────────────

function StepProgress({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div className="h-0.5 bg-border rounded-full overflow-hidden">
      <div
        className={clsx("h-full rounded-full transition-none", active ? "bg-accent" : "bg-success")}
        style={{ width: `${active ? progress * 100 : 100}%` }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommandSequencer({ preview }: CommandSequencerProps) {
  const [selectedType, setSelectedType] = useState(preview.commandTypes[0] ?? "THRUSTER_FIRE");

  const {
    queue, addToQueue, removeFromQueue,
    steps, isLoading, isPlaying, error,
    startPlayback, stopPlayback,
    currentStep, stepProgress,
    cumulativeState, displayBattery,
    runPreview,
  } = preview;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Queue builder */}
      <div>
        <div className="section-label mb-1.5">Command Queue (max 5)</div>
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-content-primary focus:outline-none focus:border-accent"
          >
            {preview.commandTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addToQueue(selectedType)}
            disabled={queue.length >= 5}
            className="flex items-center gap-1 px-3 py-1.5 rounded border border-border bg-surface-2 text-xs text-content-secondary
                       hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Queued commands */}
      {queue.length > 0 ? (
        <div className="space-y-1">
          {queue.map((cmd, i) => {
            const step = steps[i];
            const isCurrent = isPlaying && currentStep === i;
            const isDone = isPlaying ? currentStep > i : steps.length > 0;

            return (
              <div
                key={cmd.id}
                className={clsx(
                  "rounded border px-2.5 py-2 transition-colors",
                  isCurrent ? "border-accent bg-accent-subtle" : isDone ? "border-success bg-surface-2" : "border-border bg-surface-2",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx(
                    "w-4 h-4 rounded-full flex items-center justify-center text-2xs font-bold shrink-0",
                    isCurrent ? "bg-accent text-white" : isDone ? "bg-success text-white" : "bg-border text-content-muted",
                  )}>
                    {isDone && !isCurrent ? "✓" : i + 1}
                  </span>
                  <span className="font-mono text-xs text-content-primary flex-1 truncate">{cmd.commandType}</span>
                  {step && !isPlaying && (
                    <span className="text-2xs text-content-muted shrink-0">{step.result.effect.duration_ms}ms</span>
                  )}
                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(cmd.id)}
                      className="text-content-disabled hover:text-danger transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isCurrent && (
                  <StepProgress progress={stepProgress} active />
                )}

                {/* Show effects when preview loaded or step is current */}
                {step && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {step.result.effect.battery_delta !== 0 && (
                      <DeltaBadge
                        label="battery"
                        value={`${step.result.effect.battery_delta > 0 ? "+" : ""}${step.result.effect.battery_delta.toFixed(0)}`}
                        unit="%"
                      />
                    )}
                    {step.result.effect.orbit_altitude_delta_km !== 0 && (
                      <DeltaBadge label="orbit" value={`+${step.result.effect.orbit_altitude_delta_km}km`} />
                    )}
                    {step.result.effect.safe_mode !== null && (
                      <DeltaBadge label="safe_mode" value={step.result.effect.safe_mode ? "ON" : "OFF"} />
                    )}
                    {step.result.effect.payload_deployed && (
                      <DeltaBadge label="payload" value="DEPLOYED" />
                    )}
                  </div>
                )}

                {step && step.result.warnings.length > 0 && !isPlaying && (
                  <div className="mt-1.5">
                    <WarningList warnings={step.result.warnings} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-2xs text-content-muted text-center py-4 border border-dashed border-border rounded">
          Add up to 5 commands to preview their sequence effects
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-2xs text-danger bg-danger-subtle border border-danger-border rounded px-2 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <>
            <button
              type="button"
              onClick={() => runPreview()}
              disabled={queue.length === 0 || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface-2 text-xs text-content-secondary
                         hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Dry Run
            </button>
            <button
              type="button"
              onClick={() => startPlayback()}
              disabled={queue.length === 0 || isLoading}
              className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-accent bg-accent text-white text-xs font-semibold
                         hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Run Preview
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={stopPlayback}
            className="flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-danger bg-danger text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Square className="w-3.5 h-3.5" />
            Stop Playback
          </button>
        )}
      </div>

      {/* Cumulative projected state summary */}
      {(cumulativeState || displayBattery !== null) && !isPlaying && steps.length > 0 && (
        <div className="border-t border-border-subtle pt-2">
          <div className="section-label mb-1.5">After Sequence</div>
          <div className="grid grid-cols-2 gap-2">
            {displayBattery !== null && (
              <div className="flex items-center gap-1.5 text-2xs">
                <Battery className={clsx(
                  "w-3.5 h-3.5 shrink-0",
                  displayBattery >= 50 ? "text-success" : displayBattery >= 20 ? "text-warning" : "text-danger",
                )} />
                <span className="text-content-muted">Battery</span>
                <span className={clsx(
                  "font-mono font-bold ml-auto",
                  displayBattery >= 50 ? "text-success" : displayBattery >= 20 ? "text-warning" : "text-danger",
                )}>
                  {displayBattery.toFixed(0)}%
                </span>
              </div>
            )}
            {cumulativeState && (
              <>
                <div className="flex items-center gap-1.5 text-2xs">
                  <Thermometer className="w-3.5 h-3.5 shrink-0 text-content-muted" />
                  <span className="text-content-muted">Thermal</span>
                  <span className={clsx(
                    "font-mono font-bold ml-auto",
                    cumulativeState.thermal_status === "NOMINAL" ? "text-success" :
                    cumulativeState.thermal_status === "ELEVATED" ? "text-warning" : "text-danger",
                  )}>
                    {cumulativeState.thermal_status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-2xs">
                  <Shield className="w-3.5 h-3.5 shrink-0 text-content-muted" />
                  <span className="text-content-muted">Safe Mode</span>
                  <span className={clsx(
                    "font-mono font-bold ml-auto",
                    cumulativeState.safe_mode_active ? "text-accent" : "text-content-muted",
                  )}>
                    {cumulativeState.safe_mode_active ? "ON" : "OFF"}
                  </span>
                </div>
                {cumulativeState.orbit_altitude_delta_km !== 0 && (
                  <div className="flex items-center gap-1.5 text-2xs col-span-2">
                    <Zap className="w-3.5 h-3.5 shrink-0 text-content-muted" />
                    <span className="text-content-muted">Orbit shift</span>
                    <span className="font-mono font-bold ml-auto text-warning">
                      +{cumulativeState.orbit_altitude_delta_km.toFixed(1)} km
                    </span>
                  </div>
                )}
                {cumulativeState.payload_deployed && (
                  <div className="flex items-center gap-1.5 text-2xs col-span-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-success" />
                    <span className="text-success font-semibold">Payload deployed</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
