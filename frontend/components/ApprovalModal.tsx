"use client";
// ApprovalModal — full-screen "Approval Detail Review" + shared DecisionForm. T-029
// Layout follows mockups/satellite-command-approval-dashboard-preview-modal.png.
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import type { ApprovalOut, PendingCommand } from "../lib/types";
import { ScoreGauge } from "./RiskScoreCard";
import { CommandStatusBadge } from "./ui/StatusBadge";
import { TelemetryPanel } from "./TelemetryPanel";

// ── Decision form (shared by in-page detail panel and the fullscreen modal) ────

export interface DecisionFormProps {
  command: PendingCommand;
  currentOperatorId: string | null;
  busy: boolean;
  onApprove: (justification: string) => void;
  onReject: (justification: string) => void;
  serverError?: string | null;
}

export function DecisionForm({
  command,
  currentOperatorId,
  busy,
  onApprove,
  onReject,
  serverError,
}: DecisionFormProps) {
  const [justification, setJustification] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset form when switching commands
  useEffect(() => {
    setJustification("");
    setConfirmed(false);
    setValidationError(null);
  }, [command.id]);

  const isSelfApproval =
    currentOperatorId !== null && String(command.submitter_id) === String(currentOperatorId);
  const isElevated = command.risk_tier === "HIGH" || command.risk_tier === "CRITICAL";
  const needsConfirm = isElevated;

  function handleApprove() {
    if (needsConfirm && !confirmed) {
      setValidationError("Confirm the checkbox before approving a HIGH/CRITICAL command.");
      return;
    }
    setValidationError(null);
    onApprove(justification.trim());
  }

  function handleReject() {
    if (isElevated && justification.trim().length === 0) {
      setValidationError("A justification is required to reject a HIGH/CRITICAL risk command.");
      return;
    }
    setValidationError(null);
    onReject(justification.trim());
  }

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3.5 space-y-3">
      <div className="section-label">Your Decision</div>

      <textarea
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        rows={3}
        maxLength={1000}
        disabled={busy || isSelfApproval}
        className="input-base text-xs resize-none"
        placeholder="Reason for decision..."
      />

      {needsConfirm && (
        <label className="flex items-start gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={busy || isSelfApproval}
            className="mt-0.5 accent-accent"
          />
          <span className="text-2xs text-content-secondary leading-relaxed">
            I have reviewed the AI risk assessment and telemetry snapshot, and I accept
            responsibility for authorizing this {command.risk_tier} risk command.
          </span>
        </label>
      )}

      {isSelfApproval && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-security-subtle border border-security-border">
          <ShieldAlert className="w-4 h-4 text-security shrink-0 mt-0.5" />
          <span className="text-xs text-security">
            You submitted this command — self-approval is forbidden. Another approver must decide.
          </span>
        </div>
      )}

      {(validationError || serverError) && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-danger-subtle border border-danger-border">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <span className="text-xs text-danger">{validationError ?? serverError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy || isSelfApproval}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded font-semibold text-xs
                     bg-success text-white hover:opacity-90 transition-opacity
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          APPROVE
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={busy || isSelfApproval}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded font-semibold text-xs
                     bg-danger text-white hover:opacity-90 transition-opacity
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
          REJECT
        </button>
      </div>

      {command.status === "PENDING_DUAL_APPROVAL" && (
        <p className="text-2xs text-content-muted text-center">
          Dual approval required — this decision is one of two.
        </p>
      )}
    </div>
  );
}

// ── Execution sequence checklist ───────────────────────────────────────────────

function ExecutionSequence({ command }: { command: PendingCommand }) {
  const steps = [
    { label: "Validate Command",        done: true },
    { label: "AI Risk Scoring",         done: true },
    { label: "Security Review",         done: false, current: true },
    { label: "Authorization",           done: false },
    { label: "Dispatch to Satellite",   done: false },
  ];
  return (
    <div className="space-y-1.5">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-2">
          {step.done ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
          ) : step.current ? (
            <Loader2 className="w-3.5 h-3.5 text-warning animate-spin shrink-0" />
          ) : (
            <span className="w-3.5 h-3.5 rounded-full border border-border-strong shrink-0" />
          )}
          <span
            className={clsx(
              "text-xs",
              step.done ? "text-content-secondary" : step.current ? "text-warning font-medium" : "text-content-muted",
            )}
          >
            {step.label}
          </span>
          {step.current && (
            <span className="text-2xs text-warning bg-warning-subtle border border-warning-border rounded-xs px-1.5 py-0.5 ml-auto">
              {command.status === "PENDING_DUAL_APPROVAL" ? "needs 2 approvals" : "needs 1 approval"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Detail row helper ──────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-2xs text-content-muted uppercase tracking-wide shrink-0">{label}</span>
      <span className={clsx("text-xs text-content-primary text-right truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}

// ── Fullscreen modal ───────────────────────────────────────────────────────────

interface ApprovalModalProps {
  command: PendingCommand;
  currentOperatorId: string | null;
  busy: boolean;
  serverError?: string | null;
  onApprove: (justification: string) => void;
  onReject: (justification: string) => void;
  onClose: () => void;
}

export function ApprovalModal({
  command,
  currentOperatorId,
  busy,
  serverError,
  onApprove,
  onReject,
  onClose,
}: ApprovalModalProps) {
  const [approvals, setApprovals] = useState<ApprovalOut[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);

  // Fetch full command detail (includes approvals[]) when the modal opens
  useEffect(() => {
    setApprovalsLoading(true);
    api.getCommand(command.id)
      .then((detail) => setApprovals(detail.approvals ?? []))
      .catch(() => {})
      .finally(() => setApprovalsLoading(false));
  }, [command.id]);

  const approvedCount = approvals.filter((a) => a.decision === "APPROVED").length;
  const required = command.status === "PENDING_DUAL_APPROVAL" ? 2 : 1;
  const remaining = Math.max(0, required - approvedCount);

  // Lock page scroll + Escape closes
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/60 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Approval detail review"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-6xl max-h-full rounded-lg border border-border bg-surface-1 shadow-card-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <header className="flex items-start gap-4 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="min-w-0 flex-1">
            <div className="section-label mb-1">Approval Detail Review</div>
            <h2 className="font-mono text-xl font-bold text-content-primary truncate">
              {command.command_type}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-content-muted font-mono">{command.subsystem}</span>
              <CommandStatusBadge status={command.status} />
              <span className="text-2xs text-content-muted font-mono">
                {command.submitter_username} · {new Date(command.submitted_at).toLocaleString()} · SAT_ALPHA
              </span>
            </div>
          </div>

          <ScoreGauge score={command.risk_score} tier={command.risk_tier} />

          <button
            type="button"
            onClick={onClose}
            className="btn-ghost p-1.5 shrink-0"
            aria-label="Close review"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 3-column body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Col 1 — command details + execution sequence */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-2">Command Details</h3>
              <DetailRow label="Command ID" value={`${command.id.slice(0, 13)}…`} />
              <DetailRow label="Type" value={command.command_type} />
              <DetailRow label="Subsystem" value={command.subsystem} />
              <DetailRow label="Submitted by" value={command.submitter_username} mono={false} />
              <DetailRow label="Submitted at" value={new Date(command.submitted_at).toLocaleTimeString()} />
              <DetailRow label="Satellite" value="SAT_ALPHA" />
              {command.sparta_technique && <DetailRow label="SPARTA" value={command.sparta_technique} />}
              {command.cvss_estimate != null && (
                <DetailRow label="CVSS Estimate" value={Number(command.cvss_estimate).toFixed(1)} />
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-2.5">Execution Sequence</h3>
              <ExecutionSequence command={command} />
            </div>
          </div>

          {/* Col 2 — AI analysis */}
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-2.5">AI Analysis &amp; Justification</h3>
              <p className="text-xs text-content-secondary leading-relaxed">{command.justification}</p>

              {command.affected_subsystems.length > 0 && (
                <div className="mt-3">
                  <div className="section-label mb-1.5">Affected Subsystems</div>
                  <div className="flex flex-wrap gap-1">
                    {command.affected_subsystems.map((s) => (
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

              {command.sequence_alerts.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="section-label">Sequence Alerts</div>
                  {command.sequence_alerts.map((alert) => (
                    <div
                      key={alert.rule_id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-warning-subtle border border-warning-border"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-2xs text-warning font-medium">{alert.rule_id}</span>
                        <span className="text-2xs text-content-muted ml-1">
                          via {alert.trigger_command}
                        </span>
                      </div>
                      <span className="text-2xs font-mono text-warning font-bold">+{alert.score_elevation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-content-primary mb-2.5">Approval Chain</h3>
              <div className="space-y-2.5">
                {/* Operator submission */}
                <div className="flex items-start gap-2.5">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-3 text-content-secondary text-2xs font-bold shrink-0">
                    {command.submitter_username.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-content-primary">
                      <span className="font-semibold">{command.submitter_username}</span>
                      <span className="text-content-muted"> submitted command</span>
                    </div>
                    <div className="text-2xs text-content-muted font-mono">
                      {new Date(command.submitted_at).toLocaleString()} · AI scored {command.risk_tier} ({command.risk_score}/100)
                    </div>
                  </div>
                </div>

                {/* Loading spinner while fetching */}
                {approvalsLoading && (
                  <div className="flex items-center gap-1.5 text-2xs text-content-muted pl-8">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading approval history…
                  </div>
                )}

                {/* Actual approval/rejection records */}
                {!approvalsLoading && approvals.map((approval) => (
                  <div key={approval.id} className="flex items-start gap-2.5">
                    <span className={clsx(
                      "flex items-center justify-center w-6 h-6 rounded-full shrink-0",
                      approval.decision === "APPROVED"
                        ? "bg-success-subtle border border-success-border"
                        : "bg-danger-subtle border border-danger-border",
                    )}>
                      {approval.decision === "APPROVED"
                        ? <Check className="w-3 h-3 text-success" />
                        : <X className="w-3 h-3 text-danger" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-content-primary">
                          {approval.approver_username ?? approval.approver_id.slice(0, 8)}
                        </span>
                        <span className={clsx(
                          "px-1.5 py-0.5 rounded-xs text-2xs font-bold uppercase",
                          approval.decision === "APPROVED"
                            ? "bg-success-subtle text-success border border-success-border"
                            : "bg-danger-subtle text-danger border border-danger-border",
                        )}>
                          {approval.decision}
                        </span>
                        {approval.is_override && (
                          <span className="px-1.5 py-0.5 rounded-xs text-2xs font-bold uppercase bg-security-subtle text-security border border-security-border">
                            OVERRIDE
                          </span>
                        )}
                      </div>
                      {approval.justification && (
                        <p className="text-2xs text-content-secondary mt-0.5 italic leading-relaxed">
                          &ldquo;{approval.justification}&rdquo;
                        </p>
                      )}
                      <div className="text-2xs text-content-muted font-mono mt-0.5">
                        {new Date(approval.decided_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Still awaiting more approvals */}
                {!approvalsLoading && remaining > 0 && (
                  <div className="flex items-start gap-2.5">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-warning-subtle border border-warning-border shrink-0">
                      <Loader2 className="w-3 h-3 text-warning animate-spin" />
                    </span>
                    <div>
                      <div className="text-xs text-content-primary">
                        Awaiting {remaining} more approval{remaining > 1 ? "s" : ""}
                        {required > 1 && (
                          <span className="text-content-muted"> ({approvedCount}/{required} received)</span>
                        )}
                      </div>
                      <div className="text-2xs text-content-muted">All decisions are recorded in the audit ledger</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Col 3 — telemetry snapshot + decision */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-content-muted" />
                <span className="section-label">Telemetry at Scoring Time</span>
              </div>
              <TelemetryPanel telemetry={command.telemetry_snapshot} />
            </div>

            <DecisionForm
              command={command}
              currentOperatorId={currentOperatorId}
              busy={busy}
              serverError={serverError}
              onApprove={onApprove}
              onReject={onReject}
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between px-5 py-2.5 border-t border-border-subtle shrink-0">
          <span className="text-2xs text-content-muted">
            Decisions are signed and appended to the tamper-evident audit ledger.
          </span>
          <a href="/admin/ledger" className="text-2xs text-accent hover:underline">
            View Full Audit Trail →
          </a>
        </footer>
      </div>
    </div>
  );
}

export default ApprovalModal;
