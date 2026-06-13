"use client";
// useCommandPreview — manages a preview command queue, calls /simulate/effects
// for each entry, and drives step-by-step animated playback of the sequence.
// Exposes cumulative projected state so the OBC dashboard can render it.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { ProjectedState, SimulateEffectsResponse, TelemetryState } from "../lib/types";

export interface QueuedCommand {
  id: string;
  commandType: string;
}

export interface PreviewStep {
  command: QueuedCommand;
  result: SimulateEffectsResponse;
}

const COMMAND_TYPES = [
  "THRUSTER_FIRE",
  "ATTITUDE_MANOEUVRE",
  "DISABLE_SAFE_MODE",
  "ENABLE_SAFE_MODE",
  "RESET_OBC",
  "DEPLOY_PAYLOAD",
  "DISABLE_WATCHDOG",
  "UPDATE_AUTH_KEY",
  "UPDATE_PARAMETER",
  "REQUEST_TELEMETRY",
  "ENABLE_BEACON",
  "DISABLE_BEACON",
] as const;

export { COMMAND_TYPES };

export type KnownCommandType = (typeof COMMAND_TYPES)[number];

interface UseCommandPreviewOpts {
  telemetry: TelemetryState | null;
}

export function useCommandPreview({ telemetry }: UseCommandPreviewOpts) {
  const [queue, setQueue] = useState<QueuedCommand[]>([]);
  const [steps, setSteps] = useState<PreviewStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);   // -1 = idle
  const [stepProgress, setStepProgress] = useState(0);  // 0–1 within current step
  const [cumulativeState, setCumulativeState] = useState<ProjectedState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const stepStartRef = useRef<number>(0);

  const addToQueue = useCallback((commandType: string) => {
    setQueue((q) => {
      if (q.length >= 5) return q;
      return [...q, { id: crypto.randomUUID(), commandType }];
    });
    // Reset preview when queue changes
    setSteps([]);
    setCumulativeState(null);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((q) => q.filter((c) => c.id !== id));
    setSteps([]);
    setCumulativeState(null);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setSteps([]);
    setCumulativeState(null);
    setCurrentStep(-1);
    setIsPlaying(false);
    playRef.current = false;
  }, []);

  const runPreview = useCallback(async () => {
    if (queue.length === 0) return;
    setIsLoading(true);
    setError(null);
    setSteps([]);

    const results: PreviewStep[] = [];
    let rolling: ProjectedState = {
      battery_percent: telemetry?.battery_percent ?? 80,
      safe_mode_active: telemetry?.safe_mode ?? false,
      thermal_status: (telemetry?.thermal_status as string | undefined) ?? "NOMINAL",
      orbital_phase: (telemetry?.orbital_phase as string | undefined) ?? "SUNLIT",
      orbit_altitude_delta_km: 0,
      payload_deployed: false,
    };

    for (const cmd of queue) {
      try {
        const resp = await api.simulateEffects({
          command_type: cmd.commandType,
          current_telemetry: { battery_percent: rolling.battery_percent },
        });
        results.push({ command: cmd, result: resp });
        rolling = resp.projected_state;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Step ${results.length + 1} failed: ${msg}`);
        setIsLoading(false);
        return;
      }
    }

    setSteps(results);
    setCumulativeState(results[results.length - 1]?.result.projected_state ?? null);
    setIsLoading(false);
    return results;
  }, [queue, telemetry]);

  // Animate playback: steps advance by their duration_ms
  const startPlayback = useCallback(async () => {
    let stepsToPlay = steps;
    if (stepsToPlay.length === 0) {
      const loaded = await runPreview();
      if (!loaded || loaded.length === 0) return;
      stepsToPlay = loaded;
    }

    playRef.current = true;
    setIsPlaying(true);
    setCurrentStep(0);
    setStepProgress(0);
    stepStartRef.current = performance.now();

    let idx = 0;

    function tick(now: number) {
      if (!playRef.current) return;
      const step = stepsToPlay[idx];
      if (!step) {
        // Sequence complete
        playRef.current = false;
        setIsPlaying(false);
        setCurrentStep(-1);
        setStepProgress(0);
        return;
      }
      const elapsed = now - stepStartRef.current;
      const duration = step.result.effect.duration_ms;
      const progress = Math.min(1, elapsed / duration);
      setStepProgress(progress);

      if (progress >= 1) {
        // Advance to next step
        idx += 1;
        if (idx >= stepsToPlay.length) {
          playRef.current = false;
          setIsPlaying(false);
          setCurrentStep(-1);
          setStepProgress(0);
          return;
        }
        setCurrentStep(idx);
        stepStartRef.current = performance.now();
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [steps, runPreview]);

  const stopPlayback = useCallback(() => {
    playRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setCurrentStep(-1);
    setStepProgress(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Derive active effect type and animation name from current playback step
  const activeAnimationType = isPlaying && currentStep >= 0 && steps[currentStep]
    ? steps[currentStep].result.effect.animation
    : null;

  const orbitDeltaKm = steps
    .slice(0, isPlaying && currentStep >= 0 ? currentStep + 1 : steps.length)
    .reduce((acc, s) => acc + s.result.effect.orbit_altitude_delta_km, 0);

  // Projected battery for the current step (for the power gauge)
  const displayBattery =
    isPlaying && currentStep >= 0 && steps[currentStep]
      ? steps[currentStep].result.projected_state.battery_percent
      : cumulativeState?.battery_percent ?? telemetry?.battery_percent ?? null;

  return {
    // Queue management
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    commandTypes: COMMAND_TYPES as readonly string[],
    // Preview data
    steps,
    isLoading,
    error,
    runPreview,
    // Playback
    isPlaying,
    startPlayback,
    stopPlayback,
    currentStep,
    stepProgress,
    // Derived state for UI
    cumulativeState,
    activeAnimationType,
    orbitDeltaKm,
    displayBattery,
  };
}
