"use client";
// EditableDashboard — wraps a dashboard page in a customizable grid:
// hide/show panels, drag to reposition, resize from the corner.
// Layout is saved per-user + per-page in localStorage (see lib/layout.ts).
import { useMemo, useState } from "react";
import GridLayout, { useContainerWidth } from "react-grid-layout";
import { LayoutDashboard } from "lucide-react";
import { getStoredToken } from "../../lib/api";
import {
  loadLayout,
  saveLayout,
  type DashboardLayoutState,
  type PanelPlacement,
} from "../../lib/layout";
import { LayoutEditModal } from "./LayoutEditModal";

export const GRID_CONFIG = {
  cols: 12,
  rowHeight: 40,
  margin: [16, 16] as [number, number],
  containerPadding: [0, 0] as [number, number],
};

export interface DashboardPanel {
  id: string;
  title: string;
  defaultPlacement: Omit<PanelPlacement, "i">;
  render: () => React.ReactNode;
}

function usernameFromToken(): string {
  const token = getStoredToken();
  if (!token) return "anon";
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { username?: string };
    return payload.username ?? "anon";
  } catch {
    return "anon";
  }
}

interface EditableDashboardProps {
  pageId: string;
  pageTitle: string;
  panels: DashboardPanel[];
  /** Optional content rendered to the left of the Edit Layout button. */
  toolbarLeft?: React.ReactNode;
}

export function EditableDashboard({ pageId, pageTitle, panels, toolbarLeft }: EditableDashboardProps) {
  // Lazy init: runs once on first client render; SSR-safe (falls back to defaults).
  const [username] = useState(usernameFromToken);
  const [layoutState, setLayoutState] = useState<DashboardLayoutState>(() =>
    loadLayout(usernameFromToken(), pageId, panels.map((p) => ({ i: p.id, ...p.defaultPlacement }))),
  );
  const [isEditing, setIsEditing] = useState(false);

  const { width, containerRef, mounted } = useContainerWidth();

  const panelById = useMemo(() => new Map(panels.map((p) => [p.id, p])), [panels]);
  const defaults = panels.map((p) => ({ i: p.id, ...p.defaultPlacement }));

  const hiddenSet = new Set(layoutState.hidden);
  const visiblePlacements = layoutState.placements.filter((p) => !hiddenSet.has(p.i) && panelById.has(p.i));

  function handleApply(next: DashboardLayoutState) {
    setLayoutState(next);
    saveLayout(username, pageId, next);
    setIsEditing(false);
  }

  return (
    <div className="p-4 min-h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="min-w-0">{toolbarLeft}</div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="btn-ghost text-xs gap-1.5 shrink-0"
          title="Customize this dashboard's layout"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Edit Layout
        </button>
      </div>

      {/* Static grid (positions/sizes from saved layout; not interactive) */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>}>
        {mounted && (
          <GridLayout
            width={width}
            layout={visiblePlacements}
            gridConfig={GRID_CONFIG}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
          >
            {visiblePlacements.map((pl) => (
              <div key={pl.i} className="overflow-auto">
                {panelById.get(pl.i)!.render()}
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {isEditing && (
        <LayoutEditModal
          pageTitle={pageTitle}
          panels={panels}
          initial={layoutState}
          defaults={defaults}
          onApply={handleApply}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </div>
  );
}
