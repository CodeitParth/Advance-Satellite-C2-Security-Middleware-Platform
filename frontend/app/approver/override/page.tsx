"use client";
// Emergency Override — guarded activation flow with confirmation. T-030
// Follows mockups/emergency-override-system-dashboard.png:
// warning banner → reason / safeguards / impact → telemetry + authorize.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AuthorizePanel,
  OverrideConfirmModal,
  OverrideImpactCard,
  OverrideStatusCard,
  ReasonSelector,
  SafeguardsChecklist,
  OVERRIDE_REASONS,
  SAFEGUARDS,
  type OverrideReasonId,
} from "../../../components/OverridePanel";
import { TelemetryPanel } from "../../../components/TelemetryPanel";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { useApprovalWebSocket } from "../../../hooks/useApprovalWebSocket";
import { useTelemetry } from "../../../hooks/useTelemetry";
import { api } from "../../../lib/api";
import type { OverrideStatus } from "../../../lib/types";

export default function ApproverOverridePage() {
  const { telemetry } = useTelemetry();
  const [status, setStatus] = useState<OverrideStatus | null>(null);
  const [reason, setReason] = useState<OverrideReasonId | null>(null);
  const [safeguards, setSafeguards] = useState<boolean[]>(() => SAFEGUARDS.map(() => false));
  const [justification, setJustification] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    api.getOverrideStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    loadStatus();
    // re-check every 15s so an expired override flips back to inactive
    const t = setInterval(loadStatus, 15_000);
    return () => clearInterval(t);
  }, [loadStatus]);

  useApprovalWebSocket({
    onMessage: (msg) => {
      if (msg.type === "OVERRIDE_ACTIVATED") loadStatus();
    },
    enabled: true,
  });

  // When the live countdown crosses zero, refetch promptly
  useEffect(() => {
    if (!status?.active || !status.expires_at) return;
    const ms = new Date(status.expires_at).getTime() - Date.now();
    if (ms <= 0) { loadStatus(); return; }
    const t = setTimeout(loadStatus, ms + 1_000);
    return () => clearTimeout(t);
  }, [status, loadStatus]);

  async function activate() {
    const reasonLabel = OVERRIDE_REASONS.find((r) => r.id === reason)?.label ?? "Unspecified";
    setBusy(true);
    setError(null);
    try {
      await api.activateOverride({ justification: `[${reasonLabel}] ${justification.trim()}` });
      setShowConfirm(false);
      setJustification("");
      setSafeguards(SAFEGUARDS.map(() => false));
      setReason(null);
      loadStatus();
    } catch (err) {
      const e = err as Error & { code?: string };
      setShowConfirm(false);
      setError(e.message ?? "Override activation failed.");
    } finally {
      setBusy(false);
    }
  }

  const overrideActive = status?.active ?? false;

  const panels: DashboardPanel[] = [
    {
      id: "override-status",
      title: "Override Status",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
      render: () => <OverrideStatusCard status={status} />,
    },
    {
      id: "override-reason",
      title: "1 · Reason",
      defaultPlacement: { x: 0, y: 2, w: 4, h: 8, minW: 3, minH: 5 },
      render: () => <ReasonSelector selected={reason} onSelect={setReason} disabled={overrideActive || busy} />,
    },
    {
      id: "override-safeguards",
      title: "2 · Safeguards",
      defaultPlacement: { x: 4, y: 2, w: 4, h: 8, minW: 3, minH: 5 },
      render: () => (
        <SafeguardsChecklist
          checked={safeguards}
          onToggle={(i) => setSafeguards((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
          disabled={overrideActive || busy}
        />
      ),
    },
    {
      id: "override-impact",
      title: "Override Impact",
      defaultPlacement: { x: 8, y: 2, w: 4, h: 8, minW: 3, minH: 5 },
      render: () => <OverrideImpactCard />,
    },
    {
      id: "override-telemetry",
      title: "3 · Telemetry Snapshot",
      defaultPlacement: { x: 0, y: 10, w: 6, h: 7, minW: 3, minH: 5 },
      render: () => <TelemetryPanel telemetry={telemetry} />,
    },
    {
      id: "override-authorize",
      title: "4 · Authorize",
      defaultPlacement: { x: 6, y: 10, w: 6, h: 7, minW: 3, minH: 5 },
      render: () => (
        <AuthorizePanel
          justification={justification}
          onJustificationChange={setJustification}
          reasonSelected={reason !== null}
          safeguardsComplete={safeguards.every(Boolean)}
          overrideActive={overrideActive}
          busy={busy}
          error={error}
          onActivate={() => setShowConfirm(true)}
        />
      ),
    },
  ];

  return (
    <>
      {/* Standing warning banner */}
      <div className="mx-4 mt-4 flex items-start gap-2.5 px-4 py-2.5 rounded border border-danger-border bg-danger-subtle">
        <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
        <p className="text-xs text-content-secondary leading-relaxed">
          <span className="font-bold text-danger uppercase tracking-wide mr-1.5">Emergency Override</span>
          This mode bypasses tiered approval and dispatches commands immediately after scoring.
          Use only for genuine mission emergencies — every action is hash-chained in the audit ledger.
        </p>
      </div>

      <EditableDashboard
        pageId="approver-override"
        pageTitle="Emergency Override"
        panels={panels}
      />

      {showConfirm && (
        <OverrideConfirmModal
          busy={busy}
          onConfirm={activate}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
