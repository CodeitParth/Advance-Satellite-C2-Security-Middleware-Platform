"use client";
// OrbitalCanvas — React Three Fiber 3D orbital visualization.
// Physics: Kepler two-body mechanics, eclipse detection, physics-accurate battery model.
// Effects: solar panel sun-tracking, thruster particle burst, animated orbit shift,
//          payload separation, eclipse battery drain/charge cycle.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Line, Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  GROUND_STATIONS,
  SAT_ALPHA_ORBIT,
  earthRotation,
  inEclipse,
  isVisible,
  latLonToVec3,
  orbitRingPoints,
  satPosition,
  solarPanelAngle,
  stationInertial,
  sunDirectionVec3,
  updateBatteryPhysics,
  type OrbitParams,
  type Vec3,
} from "../../lib/orbit";

export interface DisplayOptions {
  groundStations: boolean;
  orbitPath: boolean;
  predictedPath: boolean;
  nightLights: boolean;
  clouds: boolean;
  coverage: boolean;
}

export type CameraMode = "EARTH" | "FOLLOW" | "TOP";

export type ActiveEffect =
  | { type: "thruster_burst"; progress: number }   // 0→1 over 3.5s
  | { type: "attitude_change"; progress: number }
  | { type: "payload_separation"; progress: number } // 0→1 over 8s
  | { type: "system_reset"; progress: number }
  | { type: "mode_change"; progress: number }
  | { type: "telemetry_pulse"; progress: number }
  | { type: "beacon_enable"; progress: number }
  | { type: "parameter_change"; progress: number }
  | null;

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  groundStations: true,
  orbitPath: true,
  predictedPath: true,
  nightLights: true,
  clouds: true,
  coverage: false,
};

export interface PeerSatConfig {
  id: string;
  label: string;
  orbit: OrbitParams;
  color: string;
  phase?: "SUNLIT" | "ECLIPSE";
}

interface SceneProps {
  simTimeRef: React.MutableRefObject<number>;
  simTime: number;
  options: DisplayOptions;
  cameraMode: CameraMode;
  /** Active animation effect (preview or live command result) */
  activeEffect?: ActiveEffect;
  /** If set, orbit is animating to this altitude delta (km) */
  orbitDeltaKm?: number;
  /** Battery % to use (physics override from preview mode) */
  batteryPctRef?: React.MutableRefObject<number>;
  /** Primary satellite orbit (defaults to SAT_ALPHA_ORBIT) */
  primaryOrbit?: OrbitParams;
  /** Label shown on the primary satellite's tag */
  primarySatLabel?: string;
  /** Peer satellites rendered alongside the primary */
  peerSatellites?: PeerSatConfig[];
}

// ── Thruster particle system ──────────────────────────────────────────────────

const PARTICLE_COUNT = 120;

function ThrusterParticles({
  active,
  offset,
  color = "#FF8C00",
}: {
  active: boolean;
  offset: [number, number, number];
  color?: string;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const lifetimes = useRef(new Float32Array(PARTICLE_COUNT).fill(-1));
  const baseLifetime = 0.35;

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    if (!active) {
      // Fade remaining particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes.current[i] -= dt;
      }
    } else {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        lifetimes.current[i] -= dt;
        if (lifetimes.current[i] <= 0) {
          // Respawn at thruster nozzle
          lifetimes.current[i] = baseLifetime + Math.random() * 0.25;
          positions[i * 3]     = offset[0] + (Math.random() - 0.5) * 0.003;
          positions[i * 3 + 1] = offset[1];
          positions[i * 3 + 2] = offset[2] + (Math.random() - 0.5) * 0.003;
          // Eject opposite to thrust direction (−Y in body frame)
          velocities.current[i * 3]     = (Math.random() - 0.5) * 0.018;
          velocities.current[i * 3 + 1] = -(0.1 + Math.random() * 0.08);
          velocities.current[i * 3 + 2] = (Math.random() - 0.5) * 0.018;
        }
        positions[i * 3]     += velocities.current[i * 3] * dt;
        positions[i * 3 + 1] += velocities.current[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities.current[i * 3 + 2] * dt;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.0025}
        transparent
        opacity={active ? 0.92 : 0}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Payload separation animation ──────────────────────────────────────────────

function PayloadObject({ progress }: { progress: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    // Payload drifts away: +X and slightly up over 8 seconds
    const eased = progress * progress * (3 - 2 * progress); // smoothstep
    ref.current.position.set(0.04 + eased * 0.06, eased * 0.02, 0);
    ref.current.scale.setScalar(1 - eased * 0.3);
  });

  const connPts: Vec3[] = [[0, 0, 0], [0.04, 0, 0]];

  return (
    <group>
      <mesh ref={ref} position={[0.04, 0, 0]}>
        <boxGeometry args={[0.012, 0.008, 0.016]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Connection line fades as progress advances */}
      {progress < 0.7 && (
        <Line
          points={connPts}
          color="#F59E0B"
          lineWidth={1}
          transparent
          opacity={Math.max(0, 1 - progress / 0.7) * 0.8}
        />
      )}
    </group>
  );
}

// ── Peer satellite (simplified mesh, no physics effects) ─────────────────────

function PeerSatMesh({
  config,
  simTimeRef,
}: {
  config: PeerSatConfig;
  simTimeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const [x, y, z] = satPosition(simTimeRef.current, config.orbit);
    groupRef.current.position.set(x, y, z);
    groupRef.current.lookAt(0, 0, 0);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.018, 0.018, 0.028]} />
        <meshStandardMaterial
          color={config.color}
          metalness={0.6}
          roughness={0.4}
          emissive={new THREE.Color(config.color)}
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[-0.034, 0, 0]}>
        <boxGeometry args={[0.048, 0.002, 0.020]} />
        <meshStandardMaterial color="#1d3fb8" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.034, 0, 0]}>
        <boxGeometry args={[0.048, 0.002, 0.020]} />
        <meshStandardMaterial color="#1d3fb8" metalness={0.5} roughness={0.4} />
      </mesh>
      <pointLight color={config.color} intensity={0.25} distance={0.25} />
      <Html distanceFactor={5} zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          transform: "translate(12px, -120%)",
          whiteSpace: "nowrap",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "var(--font-mono), monospace",
          color: config.color,
          background: "rgba(4, 6, 14, 0.82)",
          border: `1px solid ${config.color}55`,
          borderRadius: 3,
          padding: "1px 5px",
          letterSpacing: "0.04em",
        }}>
          {config.label}{config.phase === "ECLIPSE" ? " · ECL" : ""}
        </div>
      </Html>
    </group>
  );
}

// ── Earth + stations ──────────────────────────────────────────────────────────

function EarthSystem({ simTimeRef, simTime, options, primaryOrbit }: Omit<SceneProps, "cameraMode">) {
  const [dayMap, lightsMap, cloudsMap, normalMap, specularMap] = useTexture([
    "/textures/earth_atmos_2048.jpg",
    "/textures/earth_lights_2048.png",
    "/textures/earth_clouds_1024.png",
    "/textures/earth_normal_2048.jpg",
    "/textures/earth_specular_2048.jpg",
  ]);

  const earthGroup = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const t = simTimeRef.current;
    if (earthGroup.current) earthGroup.current.rotation.y = earthRotation(t);
    if (cloudsRef.current) cloudsRef.current.rotation.y = earthRotation(t) * 1.12;
  });

  const activeOrbit = primaryOrbit ?? SAT_ALPHA_ORBIT;
  const satPos = satPosition(simTime, activeOrbit);

  return (
    <group>
      <group ref={earthGroup}>
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshPhongMaterial
            map={dayMap}
            normalMap={normalMap}
            normalScale={new THREE.Vector2(0.8, 0.8)}
            specularMap={specularMap}
            specular={new THREE.Color("#222a3a")}
            shininess={14}
            emissiveMap={options.nightLights ? lightsMap : null}
            emissive={options.nightLights ? new THREE.Color("#9fb4d8") : new THREE.Color("#000000")}
            emissiveIntensity={0.55}
          />
        </mesh>

        {options.groundStations &&
          GROUND_STATIONS.map((gs) => {
            const pos = latLonToVec3(gs.lat, gs.lon, 1.005);
            const visible = isVisible(satPos, stationInertial(gs, simTime), activeOrbit);
            return (
              <group key={gs.id} position={pos}>
                <mesh>
                  <sphereGeometry args={[0.012, 12, 12]} />
                  <meshBasicMaterial color={visible ? "#22C55E" : "#4F6BFF"} />
                </mesh>
                <Html distanceFactor={5} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                  <div style={{
                    transform: "translate(10px, -50%)",
                    whiteSpace: "nowrap",
                    fontSize: 11,
                    fontFamily: "var(--font-mono), monospace",
                    color: visible ? "#22C55E" : "#9CA3AF",
                    background: "rgba(13, 17, 23, 0.75)",
                    border: `1px solid ${visible ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}>
                    {gs.name}
                  </div>
                </Html>
              </group>
            );
          })}
      </group>

      {options.clouds && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.012, 48, 48]} />
          <meshLambertMaterial map={cloudsMap} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}

      <mesh>
        <sphereGeometry args={[1.06, 48, 48]} />
        <meshBasicMaterial
          color="#4F6BFF" transparent opacity={0.1}
          side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Satellite ─────────────────────────────────────────────────────────────────

function Satellite({
  simTimeRef, simTime, options, activeEffect, orbitDeltaKm, batteryPctRef,
  primaryOrbit, primarySatLabel,
}: Omit<SceneProps, "cameraMode">) {
  const orbit = primaryOrbit ?? SAT_ALPHA_ORBIT;
  const satLabel = primarySatLabel ?? "SAT_ALPHA";
  const satGroup   = useRef<THREE.Group>(null);
  const coverageRef = useRef<THREE.Mesh>(null);
  const panelL     = useRef<THREE.Group>(null);
  const panelR     = useRef<THREE.Group>(null);
  const eclipseLight = useRef<THREE.PointLight>(null);
  const busMatRef  = useRef<THREE.MeshStandardMaterial>(null);
  const [eclipseState, setEclipseState] = useState(false);

  // Track orbit altitude shift (preview: smooth lerp to delta)
  const currentDeltaRef = useRef(0);
  const targetDeltaKm = orbitDeltaKm ?? 0;

  useFrame((_, dt) => {
    const t = simTimeRef.current;
    const sunDir = sunDirectionVec3(t);

    // Lerp orbit shift
    currentDeltaRef.current += (targetDeltaKm - currentDeltaRef.current) * Math.min(1, dt * 0.8);
    const shiftedOrbit = {
      ...orbit,
      altitudeKm: orbit.altitudeKm + currentDeltaRef.current,
    };

    const [x, y, z] = satPosition(t, shiftedOrbit);

    if (satGroup.current) {
      satGroup.current.position.set(x, y, z);
      satGroup.current.lookAt(0, 0, 0);
    }
    if (coverageRef.current) {
      const dir = new THREE.Vector3(x, y, z).normalize();
      coverageRef.current.position.copy(dir.multiplyScalar(1.004));
      coverageRef.current.lookAt(dir.multiplyScalar(2));
    }

    // Eclipse detection
    const isEcl = inEclipse([x, y, z], sunDir);
    setEclipseState(isEcl);

    // Solar panel tracking — rotate to face sun
    const panelAngle = solarPanelAngle([x, y, z], sunDir);
    if (panelL.current) panelL.current.rotation.z = panelAngle;
    if (panelR.current) panelR.current.rotation.z = panelAngle;

    // Eclipse glow — dim blue in eclipse, bright amber in sunlit
    if (eclipseLight.current) {
      const targetColor = isEcl ? new THREE.Color("#3b5bdb") : new THREE.Color("#4F6BFF");
      eclipseLight.current.color.lerp(targetColor, dt * 2);
      eclipseLight.current.intensity = isEcl ? 0.25 : 0.5;
    }

    // Bus color shifts slightly in eclipse (power-saving mode indicator)
    if (busMatRef.current) {
      const targetEmissive = isEcl ? new THREE.Color("#0a1220") : new THREE.Color("#000000");
      busMatRef.current.emissive.lerp(targetEmissive, dt * 1.5);
    }

    // Physics-accurate battery update
    if (batteryPctRef) {
      const cosAngle = Math.abs(Math.cos(panelAngle));
      batteryPctRef.current = updateBatteryPhysics(batteryPctRef.current, isEcl, cosAngle, dt);
    }
  });

  const satPos = satPosition(simTime, orbit);
  const visibleStations = GROUND_STATIONS.filter((gs) =>
    isVisible(satPos, stationInertial(gs, simTime), orbit),
  );

  const thrusterActive = activeEffect?.type === "thruster_burst" && (activeEffect.progress ?? 0) < 0.85;
  const payloadSep = activeEffect?.type === "payload_separation";
  const resetActive = activeEffect?.type === "system_reset";

  return (
    <>
      <group ref={satGroup}>
        {/* Main bus */}
        <mesh>
          <boxGeometry args={[0.022, 0.022, 0.034]} />
          <meshStandardMaterial
            ref={busMatRef}
            color={resetActive ? "#38BDF8" : "#C9D4E8"}
            metalness={0.7}
            roughness={0.3}
            emissive={resetActive ? new THREE.Color("#38BDF8") : new THREE.Color("#000")}
            emissiveIntensity={resetActive ? (activeEffect?.progress ?? 0) * 0.4 : 0}
          />
        </mesh>

        {/* Left solar panel — rotates to track sun */}
        <group ref={panelL} position={[-0.045, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.06, 0.002, 0.026]} />
            <meshStandardMaterial
              color="#1d3fb8"
              metalness={0.5}
              roughness={0.4}
              emissive={new THREE.Color(eclipseState ? "#000" : "#1a2a6c")}
              emissiveIntensity={eclipseState ? 0 : 0.3}
            />
          </mesh>
        </group>

        {/* Right solar panel */}
        <group ref={panelR} position={[0.045, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.06, 0.002, 0.026]} />
            <meshStandardMaterial
              color="#1d3fb8"
              metalness={0.5}
              roughness={0.4}
              emissive={new THREE.Color(eclipseState ? "#000" : "#1a2a6c")}
              emissiveIntensity={eclipseState ? 0 : 0.3}
            />
          </mesh>
        </group>

        {/* Thruster nozzle */}
        <mesh position={[0, -0.018, 0]}>
          <cylinderGeometry args={[0.003, 0.005, 0.008, 8]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Thruster particle effect */}
        <ThrusterParticles
          active={thrusterActive}
          offset={[0, -0.022, 0]}
          color={thrusterActive ? "#FF8C00" : "#ff4400"}
        />

        {/* Payload separation */}
        {payloadSep && <PayloadObject progress={activeEffect?.progress ?? 0} />}

        {/* Beacon glow */}
        <pointLight
          ref={eclipseLight}
          color="#4F6BFF"
          intensity={0.5}
          distance={0.4}
        />

        <Html distanceFactor={5} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            transform: "translate(14px, -130%)",
            whiteSpace: "nowrap",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--font-mono), monospace",
            color: "#fff",
            background: eclipseState ? "rgba(59,91,219,0.9)" : "rgba(34,197,94,0.9)",
            borderRadius: 3,
            padding: "2px 6px",
            letterSpacing: "0.05em",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            {satLabel}{eclipseState ? " · ECLIPSE" : ""}
          </div>
        </Html>
      </group>

      {/* Coverage footprint */}
      {options.coverage && (
        <mesh ref={coverageRef}>
          <circleGeometry args={[0.38, 48]} />
          <meshBasicMaterial
            color="#4F6BFF" transparent opacity={0.16}
            side={THREE.DoubleSide} depthWrite={false}
          />
        </mesh>
      )}

      {/* Ground contact lines */}
      {options.groundStations &&
        visibleStations.map((gs) => (
          <Line
            key={gs.id}
            points={[satPos, stationInertial(gs, simTime)]}
            color="#22C55E"
            lineWidth={1}
            transparent
            opacity={0.7}
          />
        ))}
    </>
  );
}

// ── Orbit paths with shift animation ─────────────────────────────────────────

function OrbitPaths({
  options,
  orbitDeltaKm = 0,
  primaryOrbit,
  peerSatellites,
}: {
  options: DisplayOptions;
  orbitDeltaKm?: number;
  primaryOrbit?: OrbitParams;
  peerSatellites?: PeerSatConfig[];
}) {
  const orbit = primaryOrbit ?? SAT_ALPHA_ORBIT;

  const shiftedOrbit = useMemo(
    () => ({ ...orbit, altitudeKm: orbit.altitudeKm + orbitDeltaKm }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orbitDeltaKm, orbit.altitudeKm, orbit.raanDeg],
  );

  const currentRing = useMemo(() => orbitRingPoints(orbit, 160) as Vec3[], [orbit]);
  const shiftedRing = useMemo(
    () => (orbitDeltaKm !== 0 ? orbitRingPoints(shiftedOrbit, 160) as Vec3[] : null),
    [shiftedOrbit, orbitDeltaKm],
  );
  const predictedRing = useMemo(
    () => orbitRingPoints({ ...orbit, raanDeg: orbit.raanDeg - 4 }, 160) as Vec3[],
    [orbit],
  );

  return (
    <>
      {/* Peer satellite orbit rings (thin, dashed, behind primary) */}
      {options.orbitPath && peerSatellites?.map((peer) => {
        const ring = orbitRingPoints(peer.orbit, 120) as Vec3[];
        return (
          <Line
            key={peer.id}
            points={ring}
            color={peer.color}
            lineWidth={1}
            dashed
            dashSize={0.04}
            gapSize={0.035}
            transparent
            opacity={0.35}
          />
        );
      })}

      {/* Primary satellite orbit */}
      {options.orbitPath && (
        <Line
          points={currentRing}
          color={orbitDeltaKm !== 0 ? "#22C55E66" : "#22C55E"}
          lineWidth={orbitDeltaKm !== 0 ? 1 : 1.5}
          dashed={orbitDeltaKm !== 0}
          dashSize={0.05}
          gapSize={0.04}
          transparent
          opacity={orbitDeltaKm !== 0 ? 0.4 : 0.85}
        />
      )}
      {/* New orbit after thruster burn */}
      {shiftedRing && (
        <Line
          points={shiftedRing}
          color="#F59E0B"
          lineWidth={2}
          transparent
          opacity={0.9}
        />
      )}
      {options.predictedPath && (
        <Line
          points={predictedRing}
          color="#38BDF8"
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.035}
          transparent
          opacity={0.65}
        />
      )}
    </>
  );
}

// ── Dynamic sun directional light ─────────────────────────────────────────────

function SunLight({ simTimeRef }: { simTimeRef: React.MutableRefObject<number> }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const [sx, sy, sz] = sunDirectionVec3(simTimeRef.current);
    lightRef.current.position.set(sx * 6, sy * 6, sz * 6);
  });

  return <directionalLight ref={lightRef} position={[6, 2, 4]} intensity={1.9} color="#fff5e6" />;
}

// ── Camera rig ────────────────────────────────────────────────────────────────

function CameraRig({
  simTimeRef,
  cameraMode,
  primaryOrbit,
}: {
  simTimeRef: React.MutableRefObject<number>;
  cameraMode: CameraMode;
  primaryOrbit?: OrbitParams;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useRef<any>(null);
  const { camera } = useThree();
  const orbit = primaryOrbit ?? SAT_ALPHA_ORBIT;

  useEffect(() => {
    if (cameraMode === "TOP") {
      camera.position.set(0, 3.4, 0.02);
      camera.lookAt(0, 0, 0);
    } else if (cameraMode === "EARTH") {
      camera.position.set(0.4, 1.15, 3.1);
      camera.lookAt(0, 0, 0);
    }
  }, [cameraMode, camera]);

  useFrame(() => {
    if (cameraMode === "FOLLOW") {
      const [x, y, z] = satPosition(simTimeRef.current, orbit);
      const target = new THREE.Vector3(x, y, z).multiplyScalar(2.1);
      camera.position.lerp(target, 0.06);
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={cameraMode !== "FOLLOW"}
      enablePan={false}
      minDistance={1.5}
      maxDistance={7}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
    />
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function OrbitalCanvas({
  simTimeRef, simTime, options, cameraMode, activeEffect, orbitDeltaKm, batteryPctRef,
  primaryOrbit, primarySatLabel, peerSatellites,
}: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0.4, 1.15, 3.1], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      style={{ background: "#04060e" }}
    >
      <ambientLight intensity={0.35} />
      <SunLight simTimeRef={simTimeRef} />
      <Stars radius={40} depth={25} count={3500} factor={3} saturation={0} fade speed={0.4} />

      <Suspense fallback={null}>
        <EarthSystem simTimeRef={simTimeRef} simTime={simTime} options={options} primaryOrbit={primaryOrbit} />
        <OrbitPaths options={options} orbitDeltaKm={orbitDeltaKm} primaryOrbit={primaryOrbit} peerSatellites={peerSatellites} />
        <Satellite
          simTimeRef={simTimeRef}
          simTime={simTime}
          options={options}
          activeEffect={activeEffect}
          orbitDeltaKm={orbitDeltaKm}
          batteryPctRef={batteryPctRef}
          primaryOrbit={primaryOrbit}
          primarySatLabel={primarySatLabel}
        />
        {peerSatellites?.map((peer) => (
          <PeerSatMesh key={peer.id} config={peer} simTimeRef={simTimeRef} />
        ))}
      </Suspense>

      <CameraRig simTimeRef={simTimeRef} cameraMode={cameraMode} primaryOrbit={primaryOrbit} />
    </Canvas>
  );
}
