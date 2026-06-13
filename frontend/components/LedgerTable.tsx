"use client";
// LedgerTable — paginated hash-chain entries with status color coding. T-031
// Layout follows mockups/audit-ledger-dashboard-overview.png (main table).
import { clsx } from "clsx";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileWarning,
  Lock,
  Search,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LedgerEntry, LedgerPage } from "../lib/types";

export const LEDGER_EVENT_TYPES = [
  "COMMAND_SUBMITTED",
  "COMMAND_DISPATCHED",
  "COMMAND_REJECTED",
  "COMMAND_BLOCKED_TIMEOUT",
  "REPLAY_BLOCKED",
  "OVERRIDE_ACTIVATED",
  "OVERRIDE_EXPIRED",
  "LEDGER_VERIFY",
] as const;

const EVENT_STYLE: Record<string, { icon: LucideIcon; badge: string; row: string }> = {
  COMMAND_SUBMITTED:       { icon: Send,         badge: "bg-accent-subtle text-accent border-accent-border",       row: "" },
  COMMAND_DISPATCHED:      { icon: CheckCircle2, badge: "bg-success-subtle text-success border-success-border",    row: "" },
  COMMAND_REJECTED:        { icon: XCircle,      badge: "bg-warning-subtle text-warning border-warning-border",    row: "bg-warning-subtle/40" },
  COMMAND_BLOCKED_TIMEOUT: { icon: Clock,        badge: "bg-danger-subtle text-danger border-danger-border",       row: "" },
  REPLAY_BLOCKED:          { icon: ShieldAlert,  badge: "bg-danger-subtle text-danger border-danger-border",       row: "bg-danger-subtle/40" },
  OVERRIDE_ACTIVATED:      { icon: Lock,         badge: "bg-security-subtle text-security border-security-border", row: "bg-security-subtle/40" },
  OVERRIDE_EXPIRED:        { icon: Lock,         badge: "bg-security-subtle text-security border-security-border", row: "" },
  LEDGER_VERIFY:           { icon: FileWarning,  badge: "bg-surface-2 text-content-secondary border-border",       row: "" },
};

function eventStyle(eventType: string) {
  return EVENT_STYLE[eventType] ?? { icon: FileWarning, badge: "bg-surface-2 text-content-secondary border-border", row: "" };
}

/** Pull display fields out of the heterogeneous event_detail JSON. */
export function entryCommandType(entry: LedgerEntry): string | null {
  const d = entry.event_detail ?? {};
  return (d.command_type as string) ?? null;
}
export function entryRiskScore(entry: LedgerEntry): number | null {
  const d = entry.event_detail ?? {};
  return typeof d.risk_score === "number" ? d.risk_score : null;
}
export function entryOperator(entry: LedgerEntry): string {
  const d = entry.event_detail ?? {};
  const name = (d.rejected_by as string) ?? (d.activated_by as string) ?? (d.username as string);
  if (name) return name;
  return entry.operator_id ? `${entry.operator_id.slice(0, 8)}…` : "system";
}

interface LedgerTableProps {
  page: LedgerPage | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  eventFilter: string;
  onEventFilterChange: (eventType: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  corruptedSequence: number | null;
  selectedEntryId: string | null;
  onSelectEntry: (entry: LedgerEntry) => void;
}

export function LedgerTable({
  page,
  isLoading,
  onPageChange,
  eventFilter,
  onEventFilterChange,
  searchQuery,
  onSearchChange,
  corruptedSequence,
  selectedEntryId,
  onSelectEntry,
}: LedgerTableProps) {
  // Event filter + search are applied client-side within the fetched page;
  // pagination itself is server-side (20 per page).
  const q = searchQuery.trim().toLowerCase();
  const items = (page?.items ?? []).filter((e) => {
    if (eventFilter !== "ALL" && e.event_type !== eventFilter) return false;
    if (!q) return true;
    return (
      e.event_type.toLowerCase().includes(q) ||
      (entryCommandType(e) ?? "").toLowerCase().includes(q) ||
      (e.command_id ?? "").toLowerCase().includes(q) ||
      e.entry_hash.toLowerCase().includes(q)
    );
  });

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle shrink-0">
        <div className="relative">
          <select
            value={eventFilter}
            onChange={(e) => onEventFilterChange(e.target.value)}
            className="appearance-none pl-2.5 pr-7 py-1.5 text-xs rounded border border-border bg-surface-2
                       text-content-primary focus:outline-none focus:border-accent"
            aria-label="Filter by event type"
          >
            <option value="ALL">All Event Types</option>
            {LEDGER_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search type, command ID, hash…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-border bg-surface-2
                       text-content-primary placeholder:text-content-muted
                       focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex-1" />
        <span className="text-2xs text-content-muted tabular-nums shrink-0">
          {page ? `${page.total.toLocaleString()} entries` : "—"}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10" style={{ background: "var(--surface-1)" }}>
            <tr className="border-b border-border">
              {["Seq", "Timestamp", "Event", "Command", "Risk", "Operator", "Entry Hash"].map((h) => (
                <th key={h} className="px-3 py-2 text-2xs font-semibold uppercase tracking-widest text-content-muted whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && !page ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td colSpan={7} className="px-3 py-2.5">
                    <div className="h-3 rounded bg-surface-3 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-xs text-content-muted">
                  No ledger entries match the current filter.
                </td>
              </tr>
            ) : (
              items.map((entry) => {
                const style = eventStyle(entry.event_type);
                const Icon = style.icon;
                const isCorrupted = corruptedSequence !== null && entry.sequence === corruptedSequence;
                const isSelected = entry.entry_id === selectedEntryId;
                const cmdType = entryCommandType(entry);
                const risk = entryRiskScore(entry);

                return (
                  <tr
                    key={entry.entry_id}
                    onClick={() => onSelectEntry(entry)}
                    className={clsx(
                      "border-b border-border-subtle cursor-pointer transition-colors",
                      isCorrupted
                        ? "bg-danger-subtle ring-1 ring-inset ring-danger"
                        : isSelected
                          ? "bg-accent-subtle"
                          : clsx(style.row, "hover:bg-surface-2"),
                    )}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-content-muted tabular-nums">
                      {entry.sequence}
                      {isCorrupted && <ShieldAlert className="inline w-3.5 h-3.5 text-danger ml-1.5 -mt-0.5" />}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-2xs text-content-secondary whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={clsx(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs border text-2xs font-semibold whitespace-nowrap",
                        style.badge,
                      )}>
                        <Icon className="w-3 h-3" />
                        {entry.event_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-content-primary whitespace-nowrap">
                      {cmdType ?? (entry.command_id ? `${entry.command_id.slice(0, 8)}…` : "—")}
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
                    <td className="px-3 py-2.5 text-xs text-content-secondary whitespace-nowrap">
                      {entryOperator(entry)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-2xs text-content-muted whitespace-nowrap">
                      {entry.entry_hash.slice(0, 12)}…
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
          Page {page?.page ?? 1} of {page?.total_pages ?? 1} · 20 per page
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => page && onPageChange(page.page - 1)}
            disabled={!page || page.page <= 1 || isLoading}
            className="btn-ghost p-1.5 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => page && onPageChange(page.page + 1)}
            disabled={!page || page.page >= page.total_pages || isLoading}
            className="btn-ghost p-1.5 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default LedgerTable;
