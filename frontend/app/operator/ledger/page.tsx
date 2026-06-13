"use client";
// Command History — operator-facing log of command lifecycle events.
// Follows mockups/Satellite-command-history-dashboard-interface.png.
// Built on GET /ledger (event per status transition) since the API has no
// list-all-commands endpoint; the detail drawer enriches via GET /commands/{id}.
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Search,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { StatCard } from "../../../components/StatCard";
import { ScoreGauge } from "../../../components/RiskScoreCard";
import { CommandStatusBadge, RiskTierBadge } from "../../../components/ui/StatusBadge";
import { entryCommandType, entryRiskScore, entryOperator } from "../../../components/LedgerTable";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { api } from "../../../lib/api";
import type { LedgerEntry, LedgerPage, PendingCommand } from "../../../lib/types";

type HistoryFilter = "ALL" | "DISPATCHED" | "REJECTED" | "SECURITY";

const FILTER_TABS: { id: HistoryFilter; label: string }[] = [
  { id: "ALL", label: "All Events" },
  { id: "DISPATCHED", label: "Dispatched" },
  { id: "REJECTED", label: "Rejected" },
  { id: "SECURITY", label: "Security" },
];

const EVENT_BADGE: Record<string, { label: string; cls: string }> = {
  COMMAND_SUBMITTED:       { label: "Submitted",      cls: "bg-accent-subtle text-accent border-accent-border" },
  COMMAND_DISPATCHED:      { label: "Dispatched",     cls: "bg-success-subtle text-success border-success-border" },
  COMMAND_REJECTED:        { label: "Rejected",       cls: "bg-danger-subtle text-danger border-danger-border" },
  COMMAND_BLOCKED_TIMEOUT: { label: "Blocked",        cls: "bg-danger-subtle text-danger border-danger-border" },
  REPLAY_BLOCKED:          { label: "Replay Blocked", cls: "bg-security-subtle text-security border-security-border" },
  OVERRIDE_ACTIVATED:      { label: "Override",       cls: "bg-security-subtle text-security border-security-border" },
  OVERRIDE_EXPIRED:        { label: "Override End",   cls: "bg-surface-2 text-content-secondary border-border" },
  LEDGER_VERIFY:           { label: "Verify",         cls: "bg-surface-2 text-content-secondary border-border" },
};

function matchesFilter(entry: LedgerEntry, filter: HistoryFilter): boolean {
  switch (filter) {
    case "ALL": return true;
    case "DISPATCHED": return entry.event_type === "COMMAND_DISPATCHED";
    case "REJECTED": return entry.event_type === "COMMAND_REJECTED" || entry.event_type === "COMMAND_BLOCKED_TIMEOUT";
    case "SECURITY": return entry.event_type === "REPLAY_BLOCKED" || entry.event_type.startsWith("OVERRIDE");
  }
}

export default function OperatorLedgerPage() {
  const [ledgerPage, setLedgerPage] = useState<LedgerPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [detail, setDetail] = useState<PendingCommand | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadPage = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      setLedgerPage(await api.getLedger({ page, per_page: 20 }));
    } catch {
      // backend unreachable — keep current view
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  // Enrich the detail drawer with the full command record
  useEffect(() => {
    setDetail(null);
    if (!selected?.command_id) return;
    setDetailLoading(true);
    api.getCommand(selected.command_id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selected]);

  const items = ledgerPage?.items ?? [];
  const q = searchQuery.trim().toLowerCase();
  const visible = items.filter((e) => {
    if (!matchesFilter(e, filter)) return false;
    if (!q) return true;
    return (
      (entryCommandType(e) ?? "").toLowerCase().includes(q) ||
      e.event_type.toLowerCase().includes(q) ||
      (e.command_id ?? "").toLowerCase().includes(q)
    );
  });

  const dispatched = items.filter((e) => e.event_type === "COMMAND_DISPATCHED").length;
  const rejected = items.filter((e) => e.event_type === "COMMAND_REJECTED").length;
  const blocked = items.filter((e) => e.event_type === "COMMAND_BLOCKED_TIMEOUT" || e.event_type === "REPLAY_BLOCKED").length;
  const overrides = items.filter((e) => e.event_type.startsWith("OVERRIDE")).length;

  const panels: DashboardPanel[] = [
    {
      id: "history-kpis",
      title: "History KPIs",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 h-full">
          <StatCard label="Total Events" value={ledgerPage?.total.toLocaleString() ?? "—"} sub="All recorded" icon={Activity} variant="blue" />
          <StatCard label="Dispatched" value={dispatched} sub="This page" icon={Send} variant="green" />
          <StatCard label="Rejected" value={rejected} sub="This page" icon={XCircle} variant={rejected > 0 ? "amber" : "default"} />
          <StatCard label="Blocked" value={blocked} sub="Timeout + replay" icon={ShieldAlert} variant={blocked > 0 ? "red" : "default"} />
          <StatCard label="Overrides" value={overrides} sub="This page" icon={Lock} variant={overrides > 0 ? "purple" : "default"} />
        </div>
      ),
    },
    {
      id: "history-table",
      title: "Command History",
      defaultPlacement: { x: 0, y: 3, w: 8, h: 13, minW: 5, minH: 8 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          {/* Tabs + search */}
          <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-border-subtle shrink-0">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={clsx(
                  "px-3 py-2 text-xs border-b-2 -mb-px transition-colors",
                  filter === tab.id
                    ? "font-semibold text-accent border-accent"
                    : "text-content-muted hover:text-content-secondary border-transparent",
                )}
              >
                {tab.label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="relative pb-1.5">
              <Search className="absolute left-2.5 top-[7px] w-3.5 h-3.5 text-content-muted pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search command, ID…"
                className="pl-8 pr-3 py-1 text-xs rounded border border-border bg-surface-2 w-44
                           text-content-primary placeholder:text-content-muted
                           focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10" style={{ background: "var(--surface-1)" }}>
                <tr className="border-b border-border">
                  {["Timestamp", "Command", "Satellite", "Operator", "Event", "Risk"].map((h) => (
                    <th key={h} className="px-3 py-2 text-2xs font-semibold uppercase tracking-widest text-content-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && !ledgerPage ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border-subtle">
                      <td colSpan={6} className="px-3 py-2.5">
                        <div className="h-3 rounded bg-surface-3 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-xs text-content-muted">
                      No events match the current filter. Submit commands from the Command Center to build history.
                    </td>
                  </tr>
                ) : (
                  visible.map((entry) => {
                    const badge = EVENT_BADGE[entry.event_type] ?? { label: entry.event_type, cls: "bg-surface-2 text-content-secondary border-border" };
                    const risk = entryRiskScore(entry);
                    const isSelected = entry.entry_id === selected?.entry_id;
                    return (
                      <tr
                        key={entry.entry_id}
                        onClick={() => setSelected(entry)}
                        className={clsx(
                          "border-b border-border-subtle cursor-pointer transition-colors",
                          isSelected ? "bg-accent-subtle" : "hover:bg-surface-2",
                        )}
                      >
                        <td className="px-3 py-2.5 font-mono text-2xs text-content-secondary whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-content-primary whitespace-nowrap">
                          {entryCommandType(entry) ?? (entry.command_id ? `${entry.command_id.slice(0, 8)}…` : "—")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-2xs text-content-muted border border-border rounded-xs px-1.5 py-0.5">
                            SAT_ALPHA
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-content-secondary whitespace-nowrap">
                          {entryOperator(entry)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={clsx("inline-flex px-1.5 py-0.5 rounded-xs border text-2xs font-semibold whitespace-nowrap", badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs tabular-nums">
                          {risk !== null ? (
                            <span className={clsx(
                              "font-bold",
                              risk >= 80 ? "text-security" : risk >= 60 ? "text-danger" : risk >= 30 ? "text-warning" : "text-success",
                            )}>
                              {risk}
                            </span>
                          ) : (
                            <span className="text-content-disabled">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border-subtle shrink-0">
            <span className="text-2xs text-content-muted tabular-nums">
              Page {ledgerPage?.page ?? 1} of {ledgerPage?.total_pages ?? 1} · {ledgerPage?.total.toLocaleString() ?? 0} events
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => ledgerPage && loadPage(ledgerPage.page - 1)}
                disabled={!ledgerPage || ledgerPage.page <= 1 || isLoading}
                className="btn-ghost p-1.5 disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => ledgerPage && loadPage(ledgerPage.page + 1)}
                disabled={!ledgerPage || ledgerPage.page >= ledgerPage.total_pages || isLoading}
                className="btn-ghost p-1.5 disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "history-detail",
      title: "Command Details",
      defaultPlacement: { x: 8, y: 3, w: 4, h: 13, minW: 3, minH: 6 },
      render: () => (
        <div className="card flex flex-col h-full p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Command Details</h3>
          {!selected ? (
            <p className="text-xs text-content-muted">Select an event row to inspect the underlying command.</p>
          ) : detailLoading ? (
            <div className="flex items-center gap-2 text-xs text-content-muted py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading command…
            </div>
          ) : detail ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-mono text-md font-bold text-content-primary truncate">{detail.command_type}</div>
                  <div className="text-2xs text-content-muted font-mono">{detail.subsystem} · SAT_ALPHA</div>
                  <div className="mt-1.5"><CommandStatusBadge status={detail.status} /></div>
                </div>
                <ScoreGauge score={detail.risk_score} tier={detail.risk_tier} />
              </div>

              <div className="section-label mb-1">AI Assessment</div>
              <p className="text-2xs text-content-secondary leading-relaxed mb-3">{detail.justification}</p>

              {/* Lifecycle timeline */}
              <div className="section-label mb-1.5">Timeline</div>
              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                  <div>
                    <div className="text-2xs text-content-primary">Submitted by {detail.submitter_username}</div>
                    <div className="text-2xs text-content-muted font-mono">{new Date(detail.submitted_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                  <div className="text-2xs text-content-primary">
                    Scored {detail.risk_score} <RiskTierBadge tier={detail.risk_tier} />
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  {detail.status === "DISPATCHED" || detail.status === "AUTO_APPROVED" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                  ) : detail.status === "REJECTED" || detail.status === "BLOCKED" || detail.status === "REPLAY_BLOCKED" ? (
                    <XCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-px" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-warning shrink-0 mt-px" />
                  )}
                  <div className="text-2xs text-content-primary">
                    Final state: <span className="font-semibold">{detail.status}</span>
                  </div>
                </div>
              </div>

              {detail.affected_subsystems.length > 0 && (
                <>
                  <div className="section-label mb-1.5">Affected Subsystems</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {detail.affected_subsystems.map((s) => (
                      <span key={s} className="px-1.5 py-0.5 rounded-xs text-2xs font-mono font-semibold bg-accent-subtle text-accent border border-accent-border">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="section-label mb-1">Command ID</div>
              <div className="font-mono text-2xs text-content-muted break-all">{detail.id}</div>
            </>
          ) : (
            <>
              {/* Event-only fallback (no command record, e.g. override events) */}
              <div className="section-label mb-1">Event Type</div>
              <div className="font-mono text-xs text-content-primary mb-3">{selected.event_type}</div>
              <div className="section-label mb-1">Timestamp</div>
              <div className="font-mono text-2xs text-content-secondary mb-3">{new Date(selected.timestamp).toLocaleString()}</div>
              <div className="section-label mb-1">Event Detail</div>
              <pre className="text-2xs font-mono text-content-secondary bg-surface-2 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(selected.event_detail, null, 2)}
              </pre>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="operator-history"
      pageTitle="Command History"
      panels={panels}
    />
  );
}
