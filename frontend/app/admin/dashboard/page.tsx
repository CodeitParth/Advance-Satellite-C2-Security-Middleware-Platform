"use client";
// Admin Dashboard — platform overview and system administration.
// Follows mockups/satellite-command-admin-dashboard-overview.png.
// Counters not exposed by the API use representative demo data.
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "../../../components/StatCard";
import { RiskDistributionChart } from "../../../components/RiskDistributionChart";
import { TelemetryPanel } from "../../../components/TelemetryPanel";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { useTelemetry } from "../../../hooks/useTelemetry";
import { api } from "../../../lib/api";

// ── Demo data (no admin metrics API in MVP) ────────────────────────────────────

const ACTIVITY_24H = [
  { hour: "00", submitted: 1, dispatched: 1, rejected: 0 },
  { hour: "03", submitted: 0, dispatched: 0, rejected: 0 },
  { hour: "06", submitted: 2, dispatched: 2, rejected: 0 },
  { hour: "09", submitted: 6, dispatched: 5, rejected: 1 },
  { hour: "12", submitted: 8, dispatched: 6, rejected: 2 },
  { hour: "15", submitted: 5, dispatched: 4, rejected: 1 },
  { hour: "18", submitted: 4, dispatched: 3, rejected: 1 },
  { hour: "21", submitted: 1, dispatched: 1, rejected: 1 },
];

const ROLE_BREAKDOWN = [
  { name: "Operators", value: 3, color: "#4F6BFF" },
  { name: "Approvers", value: 2, color: "#8B5CF6" },
  { name: "Admins",    value: 1, color: "#F59E0B" },
];

const SECURITY_EVENTS = [
  { label: "Replay attack blocked", detail: "Duplicate nonce from op_chen", time: "12 min ago", tone: "danger" },
  { label: "HIGH command rejected", detail: "DISABLE_WATCHDOG · score 91", time: "1 h ago", tone: "warning" },
  { label: "Override expired", detail: "Activated by so_kim · 10 min window", time: "3 h ago", tone: "security" },
  { label: "Rate limit triggered", detail: "Login attempts from 10.0.0.14", time: "5 h ago", tone: "warning" },
];

const ADMIN_ACTIONS = [
  { time: "2026-06-11 09:14", admin: "admin_root", action: "Telemetry override", target: "battery_percent → 76", result: "OK" },
  { time: "2026-06-11 08:55", admin: "admin_root", action: "Ledger verification", target: "Full chain", result: "VALID" },
  { time: "2026-06-10 17:32", admin: "admin_root", action: "Demo reset", target: "All tables", result: "OK" },
  { time: "2026-06-10 16:08", admin: "admin_root", action: "User unlocked", target: "op_diaz", result: "OK" },
];

const POLICY_CHECKS = [
  "Dual approval enforced for HIGH risk",
  "Self-approval blocked server-side",
  "Ledger append-only rule active",
  "Login rate limiting (5/min/IP)",
  "Risk tier derived from score only",
];

const SERVICES = [
  { name: "API Gateway", latency: "12 ms" },
  { name: "Approval Engine", latency: "8 ms" },
  { name: "AI Scoring (DEMO)", latency: "41 ms" },
  { name: "Telemetry Service", latency: "5 ms" },
  { name: "WebSocket Hub", latency: "3 ms" },
  { name: "PostgreSQL", latency: "2 ms" },
  { name: "Audit Ledger", latency: "6 ms" },
];

export default function AdminDashboardPage() {
  const { telemetry, updateTelemetry } = useTelemetry();
  const [pendingCount, setPendingCount] = useState(3);

  useEffect(() => {
    api.getPendingCommands()
      .then((cmds) => setPendingCount(cmds.length))
      .catch(() => {});
  }, []);

  const postureScore = 94;

  const panels: DashboardPanel[] = [
    {
      id: "admin-kpis",
      title: "KPI Ribbon",
      defaultPlacement: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 3 },
      render: () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 h-full">
          <StatCard label="Total Users" value={6} sub="3 op · 2 appr · 1 admin" icon={Users} variant="blue" />
          <StatCard label="Commands (24h)" value={27} sub="21 dispatched" icon={Activity} variant="green" trend="up" trendValue="+12%" />
          <StatCard label="Pending Approvals" value={pendingCount} sub="Live" icon={Clock} variant={pendingCount > 0 ? "amber" : "default"} />
          <StatCard label="Security Events" value={SECURITY_EVENTS.length} sub="Last 24h" icon={ShieldAlert} variant="red" />
          <StatCard label="Security Posture" value={postureScore} sub="of 100" icon={Zap} variant="green" />
        </div>
      ),
    },
    {
      id: "command-activity",
      title: "Command Activity",
      defaultPlacement: { x: 0, y: 3, w: 6, h: 7, minW: 4, minH: 5 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-1">Command Activity Overview</h3>
          <p className="text-2xs text-content-muted mb-2">Last 24 hours · submitted vs dispatched vs rejected</p>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ACTIVITY_24H} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                />
                <Area type="monotone" dataKey="submitted" stroke="#4F6BFF" fill="#4F6BFF" fillOpacity={0.25} strokeWidth={1.5} />
                <Area type="monotone" dataKey="dispatched" stroke="#22C55E" fill="#22C55E" fillOpacity={0.18} strokeWidth={1.5} />
                <Area type="monotone" dataKey="rejected" stroke="#EF4444" fill="#EF4444" fillOpacity={0.18} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            {[["Submitted", "#4F6BFF"], ["Dispatched", "#22C55E"], ["Rejected", "#EF4444"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 text-2xs text-content-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "service-health",
      title: "System Health",
      defaultPlacement: { x: 6, y: 3, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">System Health</h3>
          <div className="space-y-2">
            {SERVICES.map((svc) => {
              const ok = svc.name !== "Telemetry Service" || telemetry !== null;
              return (
                <div key={svc.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`status-dot ${ok ? "status-dot-online" : "status-dot-danger"}`} />
                    <span className="text-xs text-content-secondary truncate">{svc.name}</span>
                  </div>
                  <span className="text-2xs font-mono text-content-muted shrink-0">{ok ? svc.latency : "DOWN"}</span>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: "security-posture",
      title: "Security Posture",
      defaultPlacement: { x: 9, y: 3, w: 3, h: 7, minW: 2, minH: 5 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Security Posture</h3>
          <div className="flex items-center justify-center mb-3">
            <div className="relative flex items-center justify-center w-24 h-24">
              <svg className="absolute inset-0 -rotate-90" width={96} height={96} viewBox="0 0 96 96">
                <circle cx={48} cy={48} r={42} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={7} />
                <circle
                  cx={48} cy={48} r={42} fill="none" stroke="#22C55E" strokeWidth={7} strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={(1 - postureScore / 100) * 2 * Math.PI * 42}
                />
              </svg>
              <span className="text-2xl font-bold text-success tabular-nums">{postureScore}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {POLICY_CHECKS.slice(0, 4).map((check) => (
              <div key={check} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                <span className="text-2xs text-content-secondary leading-relaxed">{check}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "user-management",
      title: "User Management",
      defaultPlacement: { x: 0, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full flex flex-col">
          <h3 className="text-sm font-semibold text-content-primary mb-1">User Management</h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ROLE_BREAKDOWN} dataKey="value" innerRadius="62%" outerRadius="85%" paddingAngle={3} strokeWidth={0}>
                  {ROLE_BREAKDOWN.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-content-primary tabular-nums">6</span>
              <span className="text-2xs text-content-muted">users</span>
            </div>
          </div>
          <div className="space-y-1 mt-2">
            {ROLE_BREAKDOWN.map((role) => (
              <div key={role.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-2xs text-content-secondary">
                  <span className="w-2 h-2 rounded-full" style={{ background: role.color }} />
                  {role.name}
                </span>
                <span className="text-2xs font-semibold text-content-primary tabular-nums">{role.value}</span>
              </div>
            ))}
          </div>
          <a href="/admin/users" className="text-2xs text-accent hover:underline mt-2">Manage users →</a>
        </div>
      ),
    },
    {
      id: "risk-distribution",
      title: "Risk Distribution",
      defaultPlacement: { x: 3, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => <RiskDistributionChart />,
    },
    {
      id: "policy-compliance",
      title: "Policy Compliance",
      defaultPlacement: { x: 6, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-1">Policy Compliance</h3>
          <div className="text-3xl font-bold text-success tabular-nums mb-2">100%</div>
          <div className="space-y-1.5">
            {POLICY_CHECKS.map((check) => (
              <div key={check} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-px" />
                <span className="text-2xs text-content-secondary leading-relaxed">{check}</span>
              </div>
            ))}
          </div>
          <a href="/admin/policy" className="text-2xs text-accent hover:underline mt-2 inline-block">
            View policies →
          </a>
        </div>
      ),
    },
    {
      id: "security-events",
      title: "Recent Security Events",
      defaultPlacement: { x: 9, y: 10, w: 3, h: 6, minW: 2, minH: 4 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-3">Recent Security Events</h3>
          <div className="space-y-2.5">
            {SECURITY_EVENTS.map((evt) => (
              <div key={evt.label + evt.time} className="flex items-start gap-2.5">
                {evt.tone === "danger" ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
                ) : evt.tone === "security" ? (
                  <Lock className="w-3.5 h-3.5 text-security shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-content-primary leading-tight">{evt.label}</div>
                  <div className="text-2xs text-content-muted">{evt.detail}</div>
                  <div className="text-2xs text-content-disabled">{evt.time}</div>
                </div>
              </div>
            ))}
          </div>
          <a href="/admin/ledger" className="text-2xs text-accent hover:underline mt-3 inline-block">
            View audit ledger →
          </a>
        </div>
      ),
    },
    {
      id: "telemetry-controls",
      title: "Telemetry Demo Controls",
      defaultPlacement: { x: 0, y: 16, w: 4, h: 7, minW: 3, minH: 5 },
      render: () => (
        <TelemetryPanel telemetry={telemetry} demoControls onUpdate={updateTelemetry} />
      ),
    },
    {
      id: "admin-actions",
      title: "Recent Administrative Actions",
      defaultPlacement: { x: 4, y: 16, w: 8, h: 7, minW: 4, minH: 4 },
      render: () => (
        <div className="card h-full flex flex-col overflow-hidden">
          <h3 className="text-sm font-semibold text-content-primary px-4 pt-3.5 pb-2">Recent Administrative Actions</h3>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
                <tr className="border-b border-border">
                  {["Timestamp", "Admin", "Action", "Target", "Result"].map((h) => (
                    <th key={h} className="px-4 py-1.5 text-2xs font-semibold uppercase tracking-widest text-content-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ADMIN_ACTIONS.map((row) => (
                  <tr key={row.time + row.action} className="border-b border-border-subtle hover:bg-surface-2">
                    <td className="px-4 py-2 font-mono text-2xs text-content-muted whitespace-nowrap">{row.time}</td>
                    <td className="px-4 py-2 text-xs text-content-secondary">{row.admin}</td>
                    <td className="px-4 py-2 text-xs text-content-primary">{row.action}</td>
                    <td className="px-4 py-2 font-mono text-2xs text-content-secondary">{row.target}</td>
                    <td className="px-4 py-2">
                      <span className="text-2xs font-bold text-success">{row.result}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "system-info",
      title: "System Information",
      defaultPlacement: { x: 0, y: 23, w: 12, h: 5, minW: 3, minH: 4 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <h3 className="text-sm font-semibold text-content-primary mb-2">System Information</h3>
          {[
            ["Platform", "SCSP v0.1.0 (MVP)"],
            ["Environment", process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "Development · DEMO_MODE" : "Development"],
            ["Backend", "FastAPI 0.111 · Python 3.13"],
            ["Frontend", "Next.js 14 · React 18"],
            ["Database", "PostgreSQL 15 · scsp_db"],
            ["AI Scoring", "Gemini 2.5 Flash (fixtures in demo)"],
            ["OBC Simulator", "UDP :9000"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">
              <span className="text-2xs text-content-muted uppercase tracking-wide shrink-0">{label}</span>
              <span className="font-mono text-2xs text-content-primary text-right">{value}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="admin-dashboard"
      pageTitle="Admin Dashboard"
      panels={panels}
    />
  );
}
