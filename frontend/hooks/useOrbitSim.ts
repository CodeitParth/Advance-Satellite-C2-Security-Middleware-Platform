"use client";
// useOrbitSim — simulation clock for the Orbital Operations Center.
// Drives satellite propagation with play/pause, speed multiplier, and scrubbing.
// The 3D canvas reads simTimeRef inside useFrame (60 fps, no React re-render);
// text panels read the throttled simTime state (4 Hz).
import { useEffect, useRef, useState } from "react";

export const SIM_SPEEDS = [1, 10, 60, 300, 1000] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number];

export function useOrbitSim() {
  const simTimeRef = useRef(0);
  const [simTime, setSimTime] = useState(0); // throttled mirror for panels
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<SimSpeed>(60);

  const playingRef = useRef(playing);
  const speedRef = useRef<number>(speed);
  playingRef.current = playing;
  speedRef.current = speed;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playingRef.current) {
        simTimeRef.current += dt * speedRef.current;
      }
      if (now - lastPublish > 250) {
        lastPublish = now;
        setSimTime(simTimeRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function scrub(deltaSeconds: number) {
    simTimeRef.current = Math.max(0, simTimeRef.current + deltaSeconds);
    setSimTime(simTimeRef.current);
  }

  return {
    simTime,
    simTimeRef,
    playing,
    speed,
    setPlaying,
    setSpeed,
    scrub,
    reset: () => { simTimeRef.current = 0; setSimTime(0); },
  };
}
