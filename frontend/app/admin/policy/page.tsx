"use client";
// Policy & Thresholds — Phase 2: live (read-only) policy values from the backend.
// Threshold editing is a post-Phase-2 item; values come from environment config.
import { useEffect, useState } from "react";
import { Brain, Clock, Gauge, Lock, Scale, ShieldCheck, Zap } from "lucide-react";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { api } from "../../../lib/api";
import type { ActiveConfig } from "../../../lib/types";

function PolicyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-xs text-content-secondary">{label}</span>
      <span className="font-mono text-xs text-content-primary text-right">{value}</span>
    </div>
  );
}

function PolicyCard({
  title, icon: Icon, children,
}: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-content-muted" />
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminPolicyPage() {
  const [config, setConfig] = useState<ActiveConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getActiveConfig().then(setConfig).catch((e) => setError((e as Error).message));
  }, []);

  const c = config;

  const panels: DashboardPanel[] = [
    {
      id: "risk-tiers",
      title: "Risk Tier Thresholds",
      defaultPlacement: { x: 0, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="Risk Tier Thresholds" icon={Gauge}>
          <PolicyRow label="LOW (auto-approve)" value={c ? `score ≤ ${c.risk_thresholds.low_max}` : "—"} />
          <PolicyRow label="MEDIUM (1 approval)" value={c ? `score ≤ ${c.risk_thresholds.medium_max}` : "—"} />
          <PolicyRow label="HIGH (2 approvals)" value={c ? `score > ${c.risk_thresholds.medium_max}` : "—"} />
          <p className="text-2xs text-content-muted mt-2 leading-relaxed">
            Tier is always derived server-side from the score — the AI model&apos;s tier output is never trusted.
          </p>
        </PolicyCard>
      ),
    },
    {
      id: "approval-policy",
      title: "Approval Policy",
      defaultPlacement: { x: 4, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="Approval Policy" icon={ShieldCheck}>
          <PolicyRow label="Single approval tier" value={c?.approval.single_approval_tier ?? "—"} />
          <PolicyRow label="Dual approval tier" value={c?.approval.dual_approval_tier ?? "—"} />
          <PolicyRow label="Pending timeout" value={c ? `${c.approval.timeout_minutes} min → BLOCKED` : "—"} />
          <PolicyRow label="Self-approval" value="FORBIDDEN (server-side)" />
        </PolicyCard>
      ),
    },
    {
      id: "override-policy",
      title: "Override Policy",
      defaultPlacement: { x: 8, y: 0, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="Emergency Override" icon={Lock}>
          <PolicyRow label="Window" value={c ? `${c.override.window_minutes} minutes` : "—"} />
          <PolicyRow label="Minimum role" value="APPROVER" />
          <PolicyRow label="Justification" value="min 20 chars" />
          <PolicyRow label="Post-event review" value="MANDATORY" />
        </PolicyCard>
      ),
    },
    {
      id: "drift-policy",
      title: "Behavioral Drift",
      defaultPlacement: { x: 0, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="Behavioral Drift (F-10)" icon={Brain}>
          <PolicyRow label="Baseline minimum" value={c ? `${c.drift.min_sessions} sessions` : "—"} />
          <PolicyRow label="Z-score threshold" value={c ? `|Z| > ${c.drift.z_threshold}` : "—"} />
          <PolicyRow label="Score elevation" value={c ? `+${c.drift.score_elevation} (non-blocking)` : "—"} />
          <p className="text-2xs text-content-muted mt-2 leading-relaxed">
            Per-operator baselines from command history; anomalous sessions raise a
            BEHAVIORAL_DRIFT alert on every command in the session.
          </p>
        </PolicyCard>
      ),
    },
    {
      id: "rate-limits",
      title: "Rate Limits",
      defaultPlacement: { x: 4, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="Rate Limits" icon={Clock}>
          <PolicyRow label="Login attempts" value={c ? `${c.rate_limits.login_per_minute}/min/IP` : "—"} />
          <PolicyRow label="Command submissions" value={c ? `${c.rate_limits.commands_per_minute}/min` : "—"} />
        </PolicyCard>
      ),
    },
    {
      id: "scoring-engine",
      title: "Scoring Engine",
      defaultPlacement: { x: 8, y: 5, w: 4, h: 5, minW: 3, minH: 4 },
      render: () => (
        <PolicyCard title="AI Scoring Engine" icon={Zap}>
          <PolicyRow label="Mode" value={c ? (c.demo_mode ? "DEMO (fixtures)" : "LIVE") : "—"} />
          <PolicyRow label="Model" value={c?.gemini_model ?? (c?.demo_mode ? "bypassed" : "—")} />
          <PolicyRow label="Environment" value={c?.app_env ?? "—"} />
          {error && <p className="text-2xs text-danger mt-2">{error}</p>}
          <p className="text-2xs text-content-disabled mt-2 leading-relaxed">
            <Scale className="w-3 h-3 inline mr-1" />
            Threshold editing ships post-Phase 2 — values are environment-configured and read-only here.
          </p>
        </PolicyCard>
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="admin-policy"
      pageTitle="Policy & Thresholds"
      panels={panels}
    />
  );
}
