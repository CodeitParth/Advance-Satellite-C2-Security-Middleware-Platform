"use client";
// Approver Queue — master-detail review of pending commands. T-029
// Follows mockups/satellite-command-approval-dashboard.png:
// left = grouped pending list, right = selected command detail + decision.
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Expand, Lock, ShieldAlert } from "lucide-react";
import { ApprovalQueue } from "../../../components/ApprovalQueue";
import { ApprovalModal, DecisionForm } from "../../../components/ApprovalModal";
import { ScoreGauge } from "../../../components/RiskScoreCard";
import { TelemetryPanel } from "../../../components/TelemetryPanel";
import { CommandStatusBadge } from "../../../components/ui/StatusBadge";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { useApprovalWebSocket } from "../../../hooks/useApprovalWebSocket";
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";
import type { ConstellationStatus, OverrideStatus, PendingCommand, RiskTier, WSMessage } from "../../../lib/types";

type DetailTab = "risk" | "telemetry";

export default function ApproverQueuePage() {
  const { operator } = useAuth();
  const [commands, setCommands] = useState<PendingCommand[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<RiskTier | "ALL">("ALL");
  const [detailTab, setDetailTab] = useState<DetailTab>("risk");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [override, setOverride] = useState<OverrideStatus | null>(null);
  const [constellation, setConstellation] = useState<ConstellationStatus | null>(null);

  const loadCommands = useCallback(async () => {
    try {
      const cmds = await api.getPendingCommands();
      setCommands(cmds);
    } catch {
      // backend unreachable — keep current list
    }
  }, []);

  useEffect(() => {
    loadCommands();
    api.getOverrideStatus().then(setOverride).catch(() => {});
    api.getConstellationStatus().then(setConstellation).catch(() => {});
    const t = setInterval(
      () => api.getConstellationStatus().then(setConstellation).catch(() => {}),
      20_000,
    );
    return () => clearInterval(t);
  }, [loadCommands]);

  // Real-time updates: refetch on any queue-changing event
  const handleWsMessage = useCallback((msg: WSMessage) => {
    if (
      msg.type === "COMMAND_PENDING" ||
      msg.type === "COMMAND_DISPATCHED" ||
      msg.type === "COMMAND_REJECTED" ||
      msg.type === "COMMAND_ESCALATED"
    ) {
      loadCommands();
    } else if (msg.type === "OVERRIDE_ACTIVATED") {
      api.getOverrideStatus().then(setOverride).catch(() => {});
    }
  }, [loadCommands]);

  const { isConnected, isPolling, pendingCommands } = useApprovalWebSocket({
    onMessage: handleWsMessage,
    enabled: true,
  });

  // When WS is down the hook polls — use its results
  useEffect(() => {
    if (isPolling) setCommands(pendingCommands);
  }, [isPolling, pendingCommands]);

  // Keep a valid selection
  const selected = commands.find((c) => c.id === selectedId) ?? null;
  useEffect(() => {
    if (!selected && commands.length > 0) setSelectedId(commands[0].id);
    if (commands.length === 0) setSelectedId(null);
  }, [selected, commands]);

  async function decide(action: "approve" | "reject", justification: string) {
    if (!selected) return;
    setBusy(true);
    setServerError(null);
    setSuccessMsg(null);
    try {
      if (action === "approve") {
        const result = await api.approveCommand(selected.id, { justification });
        setSuccessMsg(
          result.new_status === "DISPATCHED"
            ? `${selected.command_type} approved — dispatched to satellite.`
            : `${selected.command_type} approved (${result.approvals_recorded}/${result.approvals_required}) — awaiting second approval.`,
        );
      } else {
        await api.rejectCommand(selected.id, { justification });
        setSuccessMsg(`${selected.command_type} rejected.`);
      }
      setShowReviewModal(false);
      await loadCommands();
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "SELF_APPROVAL_FORBIDDEN") {
        setServerError("Self-approval is forbidden — you submitted this command.");
      } else if (e.code === "COMMAND_ALREADY_RESOLVED") {
        setServerError("This command was already resolved by another approver.");
        await loadCommands();
      } else {
        setServerError(e.message ?? "Decision failed — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // ── Panels ───────────────────────────────────────────────────────────────────
  const panels: DashboardPanel[] = [
    {
      id: "pending-queue",
      title: "Pending Approvals",
      defaultPlacement: { x: 0, y: 0, w: 4, h: 14, minW: 3, minH: 8 },
      render: () => (
        <ApprovalQueue
          commands={commands}
          selectedId={selectedId}
          onSelect={(cmd) => { setSelectedId(cmd.id); setServerError(null); }}
          isLive={isConnected}
          filterTier={filterTier}
          onFilterChange={setFilterTier}
        />
      ),
    },
    {
      id: "command-detail",
      title: "Selected Command",
      defaultPlacement: { x: 4, y: 0, w: 8, h: 14, minW: 5, minH: 8 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
              <CheckCircle2 className="w-12 h-12 text-success mb-3" />
              <p className="text-sm font-medium text-content-primary">Nothing selected</p>
              <p className="text-xs text-content-muted mt-1">
                Select a pending command from the queue to review its AI risk assessment.
              </p>
            </div>
          ) : (
            <>
              {/* Detail header */}
              <div className="flex items-start gap-4 px-4 pt-4 pb-3 border-b border-border-subtle shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="section-label mb-1">Selected Command</div>
                  <h2 className="font-mono text-lg font-bold text-content-primary truncate">
                    {selected.command_type}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <CommandStatusBadge status={selected.status} />
                    <span className="text-2xs text-content-muted font-mono">
                      {selected.subsystem} · {selected.submitter_username} ·{" "}
                      {new Date(selected.submitted_at).toLocaleTimeString()} · SAT_ALPHA
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="btn-secondary text-2xs gap-1.5 mt-2.5"
                  >
                    <Expand className="w-3 h-3" />
                    Full Detail Review
                  </button>
                </div>
                <ScoreGauge score={selected.risk_score} tier={selected.risk_tier} />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 pt-2 border-b border-border-subtle shrink-0">
                {([
                  { id: "risk", label: "Risk Breakdown" },
                  { id: "telemetry", label: "Telemetry Snapshot" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id)}
                    className={
                      detailTab === tab.id
                        ? "px-3 py-2 text-xs font-semibold text-accent border-b-2 border-accent -mb-px"
                        : "px-3 py-2 text-xs text-content-muted hover:text-content-secondary border-b-2 border-transparent -mb-px"
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content + decision */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {detailTab === "risk" ? (
                  <div className="space-y-4">
                    <div>
                      <div className="section-label mb-1.5">AI Assessment</div>
                      <p className="text-xs text-content-secondary leading-relaxed">
                        {selected.justification}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {selected.sparta_technique && (
                        <div className="rounded border border-border bg-surface-2 p-2.5">
                          <div className="section-label mb-1">SPARTA Technique</div>
                          <span className="font-mono text-xs text-content-primary">{selected.sparta_technique}</span>
                        </div>
                      )}
                      {selected.cvss_estimate != null && (
                        <div className="rounded border border-border bg-surface-2 p-2.5">
                          <div className="section-label mb-1">CVSS Estimate</div>
                          <span className="font-mono text-xs text-content-primary">{Number(selected.cvss_estimate).toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {selected.affected_subsystems.length > 0 && (
                      <div>
                        <div className="section-label mb-1.5">Affected Subsystems</div>
                        <div className="flex flex-wrap gap-1">
                          {selected.affected_subsystems.map((s) => (
                            <span
                              key={s}
                              className="px-1.5 py-0.5 rounded-xs text-2xs font-mono font-semibold
                                         bg-accent-subtle text-accent border border-accent-border"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selected.sequence_alerts.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="section-label">Sequence Alerts</div>
                        {selected.sequence_alerts.map((alert) => (
                          <div
                            key={alert.rule_id}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-warning-subtle border border-warning-border"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0" />
                            <span className="text-2xs text-warning font-medium flex-1">
                              {alert.rule_id} · via {alert.trigger_command}
                            </span>
                            <span className="text-2xs font-mono text-warning font-bold">
                              +{alert.score_elevation}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <TelemetryPanel telemetry={selected.telemetry_snapshot} />
                )}

                <DecisionForm
                  command={selected}
                  currentOperatorId={operator?.id ?? null}
                  busy={busy}
                  serverError={serverError}
                  onApprove={(j) => decide("approve", j)}
                  onReject={(j) => decide("reject", j)}
                />
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <EditableDashboard
        pageId="approver-queue"
        pageTitle="Approvals Queue"
        panels={panels}
        toolbarLeft={
          <div className="flex items-center gap-3 min-w-0">
            {override?.active && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-security-border bg-security-subtle text-security text-2xs font-bold uppercase tracking-wide">
                <Lock className="w-3 h-3" />
                Emergency Override Active
              </span>
            )}
            {constellation?.elevation_active && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-warning-border bg-warning-subtle text-warning text-2xs font-bold uppercase tracking-wide"
                title={`${constellation.elevation_source} reported a HIGH-risk command — auto-approve suspended`}
              >
                <ShieldAlert className="w-3 h-3" />
                Constellation Elevation
              </span>
            )}
            {successMsg && (
              <span className="flex items-center gap-1.5 text-xs text-success truncate">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {successMsg}
              </span>
            )}
          </div>
        }
      />

      {showReviewModal && selected && (
        <ApprovalModal
          command={selected}
          currentOperatorId={operator?.id ?? null}
          busy={busy}
          serverError={serverError}
          onApprove={(j) => decide("approve", j)}
          onReject={(j) => decide("reject", j)}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </>
  );
}
