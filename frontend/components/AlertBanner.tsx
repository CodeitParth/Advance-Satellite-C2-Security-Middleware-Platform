"use client";
// AlertBanner — dismissible banner for replay/sequence alerts. T-028
import { useState } from "react";
import { clsx } from "clsx";
import { ShieldAlert, X, AlertTriangle } from "lucide-react";
import type { SequenceAlert } from "../lib/types";

type AlertType = "replay_blocked" | "sequence_alert" | "scoring_failed" | "error";

interface AlertBannerProps {
  type: AlertType;
  title?: string;
  sequenceAlerts?: SequenceAlert[];
  message?: string;
  onDismiss?: () => void;
}

const TYPE_STYLES: Record<AlertType, { container: string; icon: React.ElementType; iconClass: string }> = {
  replay_blocked:  { container: "bg-security-subtle border-security-border text-security", icon: ShieldAlert, iconClass: "text-security" },
  sequence_alert:  { container: "bg-warning-subtle border-warning-border text-warning",   icon: AlertTriangle, iconClass: "text-warning" },
  scoring_failed:  { container: "bg-danger-subtle border-danger-border text-danger",      icon: AlertTriangle, iconClass: "text-danger" },
  error:           { container: "bg-danger-subtle border-danger-border text-danger",      icon: AlertTriangle, iconClass: "text-danger" },
};

export function AlertBanner({ type, title, sequenceAlerts = [], message, onDismiss }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { container, icon: Icon, iconClass } = TYPE_STYLES[type];

  const defaultTitle: Record<AlertType, string> = {
    replay_blocked: "Replay Attack Blocked",
    sequence_alert: `${sequenceAlerts.length} Sequence Alert${sequenceAlerts.length > 1 ? "s" : ""} Detected`,
    scoring_failed: "AI Scoring Failed",
    error:          "Error",
  };

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <div
      role="alert"
      className={clsx("rounded border px-3 py-3 animate-fade-in", container)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Icon className={clsx("w-4 h-4 shrink-0 mt-0.5", iconClass)} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{title ?? defaultTitle[type]}</div>
            {message && <p className="text-xs mt-0.5 opacity-80">{message}</p>}
            {sequenceAlerts.length > 0 && (
              <ul className="mt-2 space-y-1">
                {sequenceAlerts.map((a) => (
                  <li key={a.rule_id} className="text-xs opacity-90">
                    <span className="font-semibold">{a.rule_id}</span>
                    {" — triggered by "}
                    <span className="font-mono">{a.trigger_command}</span>
                    {" · "}
                    <span className="font-semibold">+{a.score_elevation} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default AlertBanner;
