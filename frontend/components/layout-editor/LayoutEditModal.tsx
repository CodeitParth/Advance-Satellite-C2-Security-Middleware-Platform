"use client";
// LayoutEditModal — fullscreen layout editor opened from EditableDashboard.
// Drag panels to move, pull the corner handle to resize, toggle visibility.
// Changes live in a draft and only persist on Apply; Cancel discards.
import { useEffect, useState } from "react";
import GridLayout, { useContainerWidth, type Layout } from "react-grid-layout";
import { Check, Eye, EyeOff, LayoutDashboard, RotateCcw, X } from "lucide-react";
import { clsx } from "clsx";
import {
  defaultLayoutState,
  type DashboardLayoutState,
  type PanelPlacement,
} from "../../lib/layout";
import { GRID_CONFIG, type DashboardPanel } from "./EditableDashboard";

interface LayoutEditModalProps {
  pageTitle: string;
  panels: DashboardPanel[];
  initial: DashboardLayoutState;
  defaults: PanelPlacement[];
  onApply: (state: DashboardLayoutState) => void;
  onCancel: () => void;
}

export function LayoutEditModal({
  pageTitle,
  panels,
  initial,
  defaults,
  onApply,
  onCancel,
}: LayoutEditModalProps) {
  const [draft, setDraft] = useState<DashboardLayoutState>(() => ({
    version: 1,
    placements: initial.placements.map((p) => ({ ...p })),
    hidden: [...initial.hidden],
  }));

  const { width, containerRef, mounted } = useContainerWidth();

  // Lock page scroll + Escape cancels
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const panelById = new Map(panels.map((p) => [p.id, p]));
  const hiddenSet = new Set(draft.hidden);
  const visiblePlacements = draft.placements.filter((p) => !hiddenSet.has(p.i) && panelById.has(p.i));

  function handleLayoutChange(layout: Layout) {
    setDraft((d) => ({
      ...d,
      placements: d.placements.map((p) => {
        const moved = layout.find((l) => l.i === p.i);
        return moved ? { ...p, x: moved.x, y: moved.y, w: moved.w, h: moved.h } : p;
      }),
    }));
  }

  function toggleHidden(id: string) {
    setDraft((d) => {
      if (d.hidden.includes(id)) {
        // re-show at the bottom so it never lands on top of another panel
        const bottomY = d.placements
          .filter((p) => !d.hidden.includes(p.i) || p.i === id)
          .reduce((max, p) => (p.i === id ? max : Math.max(max, p.y + p.h)), 0);
        return {
          ...d,
          hidden: d.hidden.filter((h) => h !== id),
          placements: d.placements.map((p) => (p.i === id ? { ...p, x: 0, y: bottomY } : p)),
        };
      }
      return { ...d, hidden: [...d.hidden, id] };
    });
  }

  function handleReset() {
    setDraft(defaultLayoutState(defaults));
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-surface-0 animate-fade-in" role="dialog" aria-modal="true" aria-label="Edit dashboard layout">
      {/* Header */}
      <header
        className="flex items-center gap-3 h-14 px-4 border-b border-border-subtle shrink-0"
        style={{ background: "var(--surface-1)" }}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded bg-accent-subtle text-accent shrink-0">
          <LayoutDashboard className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-content-primary leading-tight">Edit Layout</div>
          <div className="text-2xs text-content-muted leading-tight truncate">{pageTitle}</div>
        </div>

        <span className="hidden lg:block text-xs text-content-muted ml-4">
          Drag a panel to move it · pull the bottom-right corner to resize · click the eye to hide or show
        </span>

        <div className="flex-1" />

        <button type="button" onClick={handleReset} className="btn-ghost text-xs gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Default
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs gap-1.5">
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button type="button" onClick={() => onApply(draft)} className="btn-primary text-xs gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Apply Changes
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Panel visibility sidebar */}
        <aside
          className="hidden md:flex flex-col w-60 border-r border-border-subtle p-3 overflow-y-auto shrink-0"
          style={{ background: "var(--surface-1)" }}
        >
          <div className="section-label mb-2">Panels</div>
          <div className="space-y-1">
            {panels.map((panel) => {
              const isHidden = hiddenSet.has(panel.id);
              const pl = draft.placements.find((p) => p.i === panel.id);
              return (
                <button
                  key={panel.id}
                  type="button"
                  onClick={() => toggleHidden(panel.id)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded text-left transition-colors",
                    "hover:bg-surface-2 border border-transparent hover:border-border",
                    isHidden && "opacity-50",
                  )}
                  title={isHidden ? "Show panel" : "Hide panel"}
                >
                  {isHidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-content-muted shrink-0" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                  <span className="flex-1 text-xs font-medium text-content-primary truncate">
                    {panel.title}
                  </span>
                  {pl && !isHidden && (
                    <span className="text-2xs font-mono text-content-muted shrink-0">
                      {pl.w}×{pl.h}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-3 border-t border-border-subtle">
            <p className="text-2xs text-content-muted leading-relaxed">
              Hidden panels keep their data — they are only removed from view. Layout is saved
              per user on this browser.
            </p>
          </div>
        </aside>

        {/* Editable grid preview */}
        <main className="flex-1 overflow-y-auto p-4">
          <div ref={containerRef as React.RefObject<HTMLDivElement>}>
            {mounted && (
              <GridLayout
                width={width}
                layout={visiblePlacements}
                gridConfig={GRID_CONFIG}
                dragConfig={{ enabled: true, cancel: ".layout-edit-no-drag" }}
                resizeConfig={{ enabled: true, handles: ["se"] }}
                onLayoutChange={handleLayoutChange}
              >
                {visiblePlacements.map((pl) => {
                  const panel = panelById.get(pl.i)!;
                  return (
                    <div
                      key={pl.i}
                      className="group relative rounded-md border border-dashed border-border-strong
                                 hover:border-accent bg-surface-0 overflow-hidden
                                 cursor-grab active:cursor-grabbing"
                    >
                      {/* Title chip + hide button */}
                      <div className="absolute top-1.5 left-1.5 right-1.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
                        <span className="px-2 py-0.5 rounded-xs bg-accent text-white text-2xs font-semibold tracking-wide shadow-card">
                          {panel.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleHidden(pl.i)}
                          className="layout-edit-no-drag pointer-events-auto flex items-center justify-center
                                     w-6 h-6 rounded bg-surface-2 border border-border text-content-muted
                                     hover:text-danger hover:border-danger-border transition-colors
                                     opacity-0 group-hover:opacity-100"
                          title="Hide panel"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Non-interactive content preview */}
                      <div className="pointer-events-none select-none h-full overflow-hidden opacity-70 pt-7">
                        {panel.render()}
                      </div>
                    </div>
                  );
                })}
              </GridLayout>
            )}
          </div>

          {/* Hidden panels shelf */}
          {draft.hidden.length > 0 && (
            <div className="mt-6">
              <div className="section-label mb-2">Hidden Panels</div>
              <div className="flex flex-wrap gap-2">
                {draft.hidden
                  .filter((id) => panelById.has(id))
                  .map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleHidden(id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-border
                                 bg-surface-1 text-xs text-content-secondary hover:text-content-primary
                                 hover:border-accent transition-colors"
                      title="Show panel"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {panelById.get(id)!.title}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
