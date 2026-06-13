"use client";
// useTelemetry — polls /api/v1/telemetry/current every 5s. T-023
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import type { TelemetryState, TelemetryUpdate } from "../lib/types";

const POLL_INTERVAL = 5_000;

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      const state = await api.getTelemetry();
      setTelemetry(state);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch telemetry");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    intervalRef.current = setInterval(fetchTelemetry, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTelemetry]);

  const updateTelemetry = useCallback(async (update: TelemetryUpdate): Promise<void> => {
    const updated = await api.updateTelemetry(update);
    setTelemetry(updated);
  }, []);

  return { telemetry, isLoading, error, updateTelemetry };
}
