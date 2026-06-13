"use client";
// Audit Ledger — hash-chained event log with integrity verification. T-031
// Follows mockups/audit-ledger-dashboard-overview.png:
// KPI ribbon → table + event-details drawer → integrity panel.
import { useCallback, useEffect, useState } from "react";
import { Database, Download, FileWarning, Lock, Send, ShieldAlert } from "lucide-react";
import { StatCard } from "../../../components/StatCard";
import { LedgerTable, entryCommandType } from "../../../components/LedgerTable";
import { IntegrityChecker } from "../../../components/IntegrityChecker";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { api } from "../../../lib/api";
import type { LedgerEntry, LedgerPage, LedgerVerifyResult } from "../../../lib/types";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1.5 border-b border-border-subtle last:border-0">
      <div className="text-2xs text-content-muted uppercase tracking-wide mb-0.5">{label}</div>
      <div className="font-mono text-xs text-content-primary break-all">{value}</div>
    </div>
  );
}

export default function AdminLedgerPage() {
  const [ledgerPage, setLedgerPage] = useState<LedgerPage | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [verifyResult, setVerifyResult] = useState<LedgerVerifyResult | null>(null);

  const loadPage = useCallback(async (page: number) => {
    setIsLoading(true);
    try {
      const result = await api.getLedger({ page, per_page: 20 });
      setLedgerPage(result);
      setPageNum(page);
    } catch {
      // backend unreachable — keep current view
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  function exportPage() {
    if (!ledgerPage) return;
    const blob = new Blob([JSON.stringify(ledgerPage.items, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scsp-ledger-page-${ledgerPage.page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const items = ledgerPage?.items ?? [];
  const dispatched = items.filter((e) => e.event_type === "COMMAND_DISPATCHED").length;
  const rejected = items.filter((e) => e.event_type === "COMMAND_REJECTED").length;
  const security = items.filter((e) =>
    e.event_type === "REPLAY_BLOCKED" || e.event_type === "OVERRIDE_ACTIVATED",
  ).length;

  const corruptedSequence = verifyResult && !verifyResult.valid ? verifyResult.corrupted_at_sequence : null;

  const panels: DashboardPanel[] = [
    {
      id: "ledger-kpis",
      title: "Ledger KPIs",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3 h-full">
          <StatCard label="Total Entries" value={ledgerPage?.total.toLocaleString() ?? "—"} sub="Hash-chained" icon={Database} variant="blue" />
          <StatCard label="Dispatched" value={dispatched} sub="This page" icon={Send} variant="green" />
          <StatCard label="Rejected" value={rejected} sub="This page" icon={FileWarning} variant={rejected > 0 ? "amber" : "default"} />
          <StatCard label="Security Events" value={security} sub="Replay + override" icon={ShieldAlert} variant={security > 0 ? "red" : "default"} />
          <StatCard
            label="Ledger Integrity"
            value={verifyResult ? (verifyResult.valid ? "VERIFIED" : "TAMPERED") : "—"}
            sub={verifyResult ? new Date(verifyResult.verified_at).toLocaleTimeString() : "Not yet verified"}
            icon={Lock}
            variant={verifyResult ? (verifyResult.valid ? "green" : "red") : "default"}
          />
        </div>
      ),
    },
    {
      id: "ledger-table",
      title: "Event Log",
      defaultPlacement: { x: 0, y: 3, w: 8, h: 13, minW: 5, minH: 8 },
      render: () => (
        <LedgerTable
          page={ledgerPage}
          isLoading={isLoading}
          onPageChange={loadPage}
          eventFilter={eventFilter}
          onEventFilterChange={setEventFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          corruptedSequence={corruptedSequence}
          selectedEntryId={selected?.entry_id ?? null}
          onSelectEntry={setSelected}
        />
      ),
    },
    {
      id: "ledger-event-details",
      title: "Event Details",
      defaultPlacement: { x: 8, y: 3, w: 4, h: 7, minW: 3, minH: 5 },
      render: () => (
        <div className="card flex flex-col h-full p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-2">Event Details</h3>
          {!selected ? (
            <p className="text-xs text-content-muted">Select a ledger row to inspect its chain metadata.</p>
          ) : (
            <>
              <DetailRow label="Sequence" value={selected.sequence} />
              <DetailRow label="Event Type" value={selected.event_type} />
              {entryCommandType(selected) && <DetailRow label="Command Type" value={entryCommandType(selected)} />}
              {selected.command_id && <DetailRow label="Command ID" value={selected.command_id} />}
              <DetailRow label="Timestamp" value={new Date(selected.timestamp).toLocaleString()} />
              <DetailRow label="Prev Hash" value={selected.prev_hash} />
              <DetailRow label="Entry Hash" value={selected.entry_hash} />
              {selected.approver_ids.length > 0 && (
                <DetailRow label="Approvers" value={selected.approver_ids.join(", ")} />
              )}
              <div className="py-1.5">
                <div className="text-2xs text-content-muted uppercase tracking-wide mb-1">Event Detail</div>
                <pre className="text-2xs font-mono text-content-secondary bg-surface-2 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.event_detail, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      id: "ledger-integrity",
      title: "Integrity Checker",
      defaultPlacement: { x: 8, y: 10, w: 4, h: 6, minW: 3, minH: 5 },
      render: () => (
        <IntegrityChecker
          onResult={setVerifyResult}
          onTampered={() => loadPage(pageNum)}
        />
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="admin-ledger"
      pageTitle="Audit Ledger"
      panels={panels}
      toolbarLeft={
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportPage} disabled={!ledgerPage} className="btn-secondary text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export Page (JSON)
          </button>
          <button
            type="button"
            onClick={() => api.downloadReport("/admin/reports/audit").catch(() => {})}
            className="btn-secondary text-xs gap-1.5"
            title="NIST IR 8401 aligned audit report with integrity certificate"
          >
            <Download className="w-3.5 h-3.5" />
            Audit Report (PDF)
          </button>
        </div>
      }
    />
  );
}
