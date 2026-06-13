"use client";
// T-028: Operator Dashboard — Command Center
// Composed of editable panels (hide/show, drag, resize) via EditableDashboard.
import { useState, useCallback } from "react";
import { CommandTerminal } from "../../../components/CommandTerminal";
import { RiskScoreCard } from "../../../components/RiskScoreCard";
import { CompactHealthStrip } from "../../../components/TelemetryPanel";
import { AlertBanner } from "../../../components/AlertBanner";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { useTelemetry } from "../../../hooks/useTelemetry";
import { useApprovalWebSocket } from "../../../hooks/useApprovalWebSocket";
import type { CommandSubmitResponse, CommandStatus, WSMessage } from "../../../lib/types";

export default function OperatorDashboardPage() {
  const { telemetry } = useTelemetry();
  const [scoreResult, setScoreResult] = useState<CommandSubmitResponse | null>(null);
  const [liveStatus, setLiveStatus] = useState<CommandStatus | null>(null);
  const [approvalsReceived, setApprovalsReceived] = useState(0);

  // Track live status updates from WebSocket
  const handleWsMessage = useCallback((msg: WSMessage) => {
    if (!scoreResult) return;
    if (
      (msg.type === "COMMAND_DISPATCHED" && msg.command_id === scoreResult.command_id) ||
      (msg.type === "COMMAND_REJECTED"   && msg.command_id === scoreResult.command_id)
    ) {
      setLiveStatus(msg.type === "COMMAND_DISPATCHED" ? "DISPATCHED" : "REJECTED");
    }
    if (msg.type === "COMMAND_ESCALATED" && msg.command_id === scoreResult.command_id) {
      setLiveStatus("PENDING_DUAL_APPROVAL");
    }
    if (msg.type === "COMMAND_PENDING" && msg.command_id === scoreResult.command_id) {
      setApprovalsReceived((n) => n + 1);
    }
  }, [scoreResult]);

  useApprovalWebSocket({ onMessage: handleWsMessage, enabled: true });

  function handleScoreResult(result: CommandSubmitResponse) {
    setScoreResult(result);
    setLiveStatus(null);
    setApprovalsReceived(0);
  }

  const hasReplayAlert  = scoreResult?.status === "REPLAY_BLOCKED";
  const hasSeqAlerts    = (scoreResult?.sequence_alerts.length ?? 0) > 0;

  const panels: DashboardPanel[] = [
    {
      id: "health-strip",
      title: "Satellite Health Strip",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
      render: () => <CompactHealthStrip telemetry={telemetry} />,
    },
    {
      id: "command-terminal",
      title: "Command Terminal",
      defaultPlacement: { x: 0, y: 2, w: 5, h: 16, minW: 3, minH: 8 },
      render: () => <CommandTerminal onScoreResult={handleScoreResult} />,
    },
    {
      id: "risk-assessment",
      title: "AI Risk Assessment",
      defaultPlacement: { x: 5, y: 2, w: 7, h: 16, minW: 4, minH: 6 },
      render: () =>
        scoreResult ? (
          <RiskScoreCard
            result={scoreResult}
            liveStatus={liveStatus ?? undefined}
            approvalsReceived={approvalsReceived}
          />
        ) : (
          <div className="card p-8 flex flex-col items-center justify-center text-center h-full">
            <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-content-secondary">No assessment yet</p>
            <p className="text-xs text-content-muted mt-1">
              Select a command and click Run AI Analysis to see the risk score
            </p>
          </div>
        ),
    },
  ];

  return (
    <>
      {/* Alert banners stay above the editable grid */}
      {(hasReplayAlert || hasSeqAlerts) && (
        <div className="px-4 pt-4 space-y-3">
          {hasReplayAlert && <AlertBanner type="replay_blocked" />}
          {hasSeqAlerts && scoreResult && (
            <AlertBanner type="sequence_alert" sequenceAlerts={scoreResult.sequence_alerts} />
          )}
        </div>
      )}

      <EditableDashboard
        pageId="operator-command-center"
        pageTitle="Command Center"
        panels={panels}
      />
    </>
  );
}
