// Dashboard layout persistence — per-user, per-page, stored in localStorage.
// Used by EditableDashboard for the hide/show + drag + resize layout editor.

export interface PanelPlacement {
  i: string;       // panel id
  x: number;       // grid column (0-11)
  y: number;       // grid row
  w: number;       // width in columns
  h: number;       // height in rows
  minW?: number;
  minH?: number;
  maxH?: number;
}

export interface DashboardLayoutState {
  version: 1;
  placements: PanelPlacement[];
  hidden: string[]; // panel ids currently hidden
}

const STORAGE_PREFIX = "scsp:layout:v1";

function storageKey(username: string, pageId: string): string {
  return `${STORAGE_PREFIX}:${username}:${pageId}`;
}

export function defaultLayoutState(defaults: PanelPlacement[]): DashboardLayoutState {
  return { version: 1, placements: defaults.map((p) => ({ ...p })), hidden: [] };
}

/**
 * Merge a saved layout with the page's current panel defaults:
 * - placements for panels that no longer exist are dropped
 * - panels added since the layout was saved are appended at the bottom
 * - size constraints (min/max) always come from the current defaults
 */
export function mergeWithDefaults(
  defaults: PanelPlacement[],
  saved: DashboardLayoutState | null,
): DashboardLayoutState {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.placements)) {
    return defaultLayoutState(defaults);
  }

  const knownIds = new Set(defaults.map((d) => d.i));
  const savedById = new Map(saved.placements.filter((p) => knownIds.has(p.i)).map((p) => [p.i, p]));

  let bottomY = 0;
  for (const p of savedById.values()) bottomY = Math.max(bottomY, p.y + p.h);

  const placements: PanelPlacement[] = defaults.map((def) => {
    const s = savedById.get(def.i);
    if (s) {
      return {
        ...def, // constraints from current code
        x: s.x, y: s.y, w: s.w, h: s.h,
      };
    }
    // new panel since save — append at the bottom, full default size
    const appended = { ...def, x: 0, y: bottomY };
    bottomY += def.h;
    return appended;
  });

  const hidden = Array.isArray(saved.hidden)
    ? saved.hidden.filter((id) => knownIds.has(id))
    : [];

  return { version: 1, placements, hidden };
}

export function loadLayout(
  username: string,
  pageId: string,
  defaults: PanelPlacement[],
): DashboardLayoutState {
  if (typeof window === "undefined") return defaultLayoutState(defaults);
  try {
    const raw = window.localStorage.getItem(storageKey(username, pageId));
    if (!raw) return defaultLayoutState(defaults);
    return mergeWithDefaults(defaults, JSON.parse(raw) as DashboardLayoutState);
  } catch {
    return defaultLayoutState(defaults);
  }
}

export function saveLayout(username: string, pageId: string, state: DashboardLayoutState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(username, pageId), JSON.stringify(state));
  } catch {
    // storage full or unavailable — layout simply won't persist
  }
}

export function clearLayout(username: string, pageId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(username, pageId));
  } catch {
    // ignore
  }
}
