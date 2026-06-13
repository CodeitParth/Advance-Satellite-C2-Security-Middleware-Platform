// Orbital mechanics helpers for the 3D Orbital Operations Center.
// Simplified circular-orbit model: accurate enough for visualization, not for ops.
// Scene units: 1 unit = Earth radius (6371 km). three.js is Y-up.

export const EARTH_RADIUS_KM = 6371;
export const MU_EARTH = 398600.4418; // km^3/s^2
export const SIDEREAL_DAY_S = 86164;

export interface OrbitParams {
  altitudeKm: number;     // circular orbit altitude
  inclinationDeg: number; // 97.4 = sun-synchronous LEO
  raanDeg: number;        // right ascension of ascending node
  phaseDeg: number;       // initial true anomaly at t=0
}

// SAT_ALPHA per the mockup: 547 km SSO
export const SAT_ALPHA_ORBIT: OrbitParams = {
  altitudeKm: 547.21,
  inclinationDeg: 97.4,
  raanDeg: 115,
  phaseDeg: 40,
};

// SAT_BRAVO: 551 km SSO, 120° RAAN offset from Alpha (Walker constellation spacing)
export const SAT_BRAVO_ORBIT: OrbitParams = {
  altitudeKm: 551.4,
  inclinationDeg: 97.4,
  raanDeg: 235,
  phaseDeg: 160,
};

// SAT_CHARLIE: 544 km SSO, 240° RAAN offset from Alpha (Walker constellation spacing)
export const SAT_CHARLIE_ORBIT: OrbitParams = {
  altitudeKm: 543.8,
  inclinationDeg: 97.4,
  raanDeg: 355,
  phaseDeg: 280,
};

export interface GroundStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const GROUND_STATIONS: GroundStation[] = [
  { id: "GS-01", name: "Munich",    lat: 48.14,  lon: 11.58 },
  { id: "GS-02", name: "Houston",   lat: 29.76,  lon: -95.37 },
  { id: "GS-03", name: "Pune",      lat: 18.52,  lon: 73.86 },
  { id: "GS-04", name: "Bengaluru", lat: 12.97,  lon: 77.59 },
  { id: "GS-05", name: "Canberra",  lat: -35.28, lon: 149.13 },
];

const DEG = Math.PI / 180;

export function orbitalRadiusKm(p: OrbitParams): number {
  return EARTH_RADIUS_KM + p.altitudeKm;
}

export function orbitalPeriodS(p: OrbitParams): number {
  const r = orbitalRadiusKm(p);
  return 2 * Math.PI * Math.sqrt((r * r * r) / MU_EARTH);
}

export function orbitalVelocityKms(p: OrbitParams): number {
  return Math.sqrt(MU_EARTH / orbitalRadiusKm(p));
}

export type Vec3 = [number, number, number];

/**
 * Satellite position at simulation time t (seconds), in the inertial frame,
 * in scene units. Orbit plane: circle in XZ rotated by inclination about X,
 * then by RAAN about Y.
 */
export function satPosition(tSeconds: number, p: OrbitParams): Vec3 {
  const r = orbitalRadiusKm(p) / EARTH_RADIUS_KM;
  const T = orbitalPeriodS(p);
  const theta = (2 * Math.PI * tSeconds) / T + p.phaseDeg * DEG;
  const inc = p.inclinationDeg * DEG;
  const raan = p.raanDeg * DEG;

  // In-plane position
  const x0 = r * Math.cos(theta);
  const z0 = r * Math.sin(theta);

  // Incline about X axis
  const y1 = -z0 * Math.sin(inc);
  const z1 = z0 * Math.cos(inc);

  // Rotate node about Y axis
  const x2 = x0 * Math.cos(raan) + z1 * Math.sin(raan);
  const z2 = -x0 * Math.sin(raan) + z1 * Math.cos(raan);

  return [x2, y1, z2];
}

/** Closed orbit ring (n points) for drawing the orbit path. */
export function orbitRingPoints(p: OrbitParams, n = 128): Vec3[] {
  const T = orbitalPeriodS(p);
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push(satPosition((T * i) / n, { ...p, phaseDeg: 0 }));
  }
  return pts;
}

/** Earth rotation angle (radians about Y) at simulation time t. */
export function earthRotation(tSeconds: number): number {
  return (2 * Math.PI * tSeconds) / SIDEREAL_DAY_S;
}

/**
 * Ground station position in the Earth-fixed frame, scene units.
 * Uses the standard three.js SphereGeometry equirectangular mapping
 * (x = -sinφ·cosθ, z = sinφ·sinθ with θ = lon+180°), so markers parented to
 * the Earth mesh group line up with the texture without extra rotation.
 */
export function latLonToVec3(lat: number, lon: number, radius = 1.0): Vec3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Station position in the inertial frame at time t (accounts for Earth spin). */
export function stationInertial(gs: GroundStation, tSeconds: number): Vec3 {
  const [x, y, z] = latLonToVec3(gs.lat, gs.lon);
  const a = earthRotation(tSeconds);
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}

/**
 * Is the satellite above the station's horizon (with a small elevation mask)?
 * Visible when the central angle between the two position vectors is below
 * the horizon angle acos(Re / (Re + h)).
 */
export function isVisible(satPos: Vec3, stPos: Vec3, p: OrbitParams, maskDeg = 5): boolean {
  const horizon = Math.acos(EARTH_RADIUS_KM / orbitalRadiusKm(p)) - maskDeg * DEG;
  const dot = satPos[0] * stPos[0] + satPos[1] * stPos[1] + satPos[2] * stPos[2];
  const magS = Math.hypot(...satPos);
  const magG = Math.hypot(...stPos);
  return Math.acos(Math.min(1, Math.max(-1, dot / (magS * magG)))) < horizon;
}

export interface ContactWindow {
  station: GroundStation;
  aosSeconds: number; // sim time of acquisition of signal
  losSeconds: number; // sim time of loss of signal
}

/**
 * Scan ahead from tNow for the next contact window across all stations.
 * Step-samples at 15 s resolution over the next two orbits.
 */
export function nextContactWindow(tNow: number, p: OrbitParams): ContactWindow | null {
  const T = orbitalPeriodS(p);
  const step = 15;
  const horizonEnd = tNow + 2 * T;

  let best: ContactWindow | null = null;
  for (const gs of GROUND_STATIONS) {
    let aos: number | null = null;
    for (let t = tNow; t <= horizonEnd; t += step) {
      const vis = isVisible(satPosition(t, p), stationInertial(gs, t), p);
      if (vis && aos === null) aos = t;
      if (!vis && aos !== null) {
        if (!best || aos < best.aosSeconds) best = { station: gs, aosSeconds: aos, losSeconds: t };
        break;
      }
    }
  }
  return best;
}

/** Sub-satellite latitude/longitude (degrees) for display. */
export function subSatellitePoint(tSeconds: number, p: OrbitParams): { lat: number; lon: number } {
  const [x, y, z] = satPosition(tSeconds, p);
  const a = earthRotation(tSeconds);
  // De-rotate into the Earth-fixed frame
  const xe = x * Math.cos(-a) + z * Math.sin(-a);
  const ze = -x * Math.sin(-a) + z * Math.cos(-a);
  const r = Math.hypot(x, y, z);
  // Invert the latLonToVec3 mapping
  let lon = Math.atan2(ze, -xe) / DEG - 180;
  if (lon < -180) lon += 360;
  return {
    lat: 90 - Math.acos(y / r) / DEG,
    lon,
  };
}

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


// ── Sun & Eclipse Physics ─────────────────────────────────────────────────────

const SOLAR_YEAR_S = 365.25 * 86400;

/**
 * Unit vector toward the Sun in the scene's inertial frame (ECI-like, Y-up).
 * The Sun moves ~1°/day around the ecliptic; we project into the XZ plane with
 * a small Y offset (~23.5° obliquity compressed to ~sin(23.5°) = 0.399).
 */
export function sunDirectionVec3(tSeconds: number): [number, number, number] {
  const angle = (2 * Math.PI * tSeconds) / SOLAR_YEAR_S;
  const x = Math.cos(angle);
  const y = Math.sin(angle) * 0.399; // ecliptic obliquity
  const z = Math.sin(angle);
  const mag = Math.sqrt(x * x + y * y + z * z);
  return [x / mag, y / mag, z / mag];
}

/**
 * Returns true when the satellite is inside Earth's cylindrical shadow cone.
 * Good approximation for LEO where the penumbra is narrow.
 * `satScenePos` and `sunDir` are in scene units (R_Earth = 1).
 */
export function inEclipse(
  satScenePos: [number, number, number],
  sunDir: [number, number, number],
): boolean {
  const [sx, sy, sz] = sunDir;
  const [px, py, pz] = satScenePos;
  // Component of satPos along anti-sun direction
  const dot = -(px * sx + py * sy + pz * sz);
  if (dot <= 0) return false; // satellite on the sun side
  // Perpendicular distance from the Earth-sun axis
  const perpSq =
    (px + sx * dot) * (px + sx * dot) +
    (py + sy * dot) * (py + sy * dot) +
    (pz + sz * dot) * (pz + sz * dot);
  return perpSq < 1.0; // inside Earth's cylinder (radius = 1 scene unit)
}

/** Solar panel Y-rotation angle (radians) that tracks the sun direction. */
export function solarPanelAngle(
  satScenePos: [number, number, number],
  sunDir: [number, number, number],
): number {
  // Project sun direction into the satellite's local XZ plane and find angle
  const [sx, , sz] = sunDir;
  return Math.atan2(sz, sx);
}

// ── Physics-accurate Battery Model ───────────────────────────────────────────

// LEO small-satellite power budget
const SOLAR_ARRAY_POWER_W = 200;   // watts at full sun
const OBC_BASELINE_POWER_W = 45;   // baseline draw
const BATTERY_CAPACITY_WH = 80;    // watt-hours

/**
 * Update battery state-of-charge (%) given the time step.
 * Uses a physical power budget: solar input depends on panel angle to sun,
 * consumption is constant. Returns clamped [0, 100].
 */
export function updateBatteryPhysics(
  currentPct: number,
  inEclipseState: boolean,
  panelAngleToSun: number, // cos of angle between panel normal and sun dir, 0–1
  dtSeconds: number,
): number {
  const solarIn = inEclipseState
    ? 0
    : SOLAR_ARRAY_POWER_W * Math.max(0, panelAngleToSun);
  const netW = solarIn - OBC_BASELINE_POWER_W;
  const deltaWh = netW * (dtSeconds / 3600);
  const deltaPct = (deltaWh / BATTERY_CAPACITY_WH) * 100;
  return Math.max(0, Math.min(100, currentPct + deltaPct));
}

// ── Kepler Eccentric Anomaly Solver ─────────────────────────────────────────

/**
 * Solve Kepler's equation M = E - e*sin(E) iteratively (Newton–Raphson).
 * Used to propagate elliptical orbits with e > 0.
 */
export function solveKeplersEquation(M: number, e: number, tol = 1e-7): number {
  let E = M;
  for (let i = 0; i < 20; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/**
 * Extended orbit params supporting elliptical orbits.
 * For circular orbits (eccentricity = 0) this reduces to the original model.
 */
export interface KeplerOrbitParams extends OrbitParams {
  eccentricity?: number;   // 0 = circular (default), > 0 = elliptical
  argOfPerigeeDeg?: number; // argument of perigee (degrees)
}

/**
 * Physics-accurate satellite position using Keplerian two-body mechanics.
 * For circular orbits (e=0) this matches the original satPosition exactly.
 * Scene units: 1 = Earth radius.
 */
export function satPositionKepler(tSeconds: number, p: KeplerOrbitParams): Vec3 {
  const e = p.eccentricity ?? 0;
  if (e < 1e-6) return satPosition(tSeconds, p); // fall back for circular

  const a = orbitalRadiusKm(p) / EARTH_RADIUS_KM;
  const n = (2 * Math.PI) / orbitalPeriodS(p); // mean motion rad/s
  const M0 = p.phaseDeg * DEG;
  const M = M0 + n * tSeconds;
  const E = solveKeplersEquation(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));

  const omega = (p.argOfPerigeeDeg ?? 0) * DEG;
  const inc = p.inclinationDeg * DEG;
  const raan = p.raanDeg * DEG;

  // Perifocal position
  const xp = r * Math.cos(nu + omega);
  const yp = r * Math.sin(nu + omega);

  // Rotate to ECI (three.js Y-up: x2=ECI_X, y=ECI_Z projected, z2=ECI_Y-ish)
  const x2 = xp * (Math.cos(raan) * Math.cos(omega) - Math.sin(raan) * Math.sin(omega) * Math.cos(inc));
  const z2 = xp * (Math.sin(raan) * Math.cos(omega) + Math.cos(raan) * Math.sin(omega) * Math.cos(inc));
  const y2 = xp * Math.sin(omega) * Math.sin(inc) + yp * (Math.cos(omega) * Math.sin(inc));
  return [x2, y2, z2];
}
