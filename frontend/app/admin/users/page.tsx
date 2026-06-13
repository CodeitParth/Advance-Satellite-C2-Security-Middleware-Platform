"use client";
// User Management — Phase 2: list, create, activate/deactivate, re-role operators.
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronDown,
  FileDown,
  Loader2,
  UserPlus,
  Users,
} from "lucide-react";
import { RoleBadge } from "../../../components/ui/StatusBadge";
import { EditableDashboard, type DashboardPanel } from "../../../components/layout-editor/EditableDashboard";
import { useAuth } from "../../../hooks/useAuth";
import { api } from "../../../lib/api";
import type { AdminUser, Role } from "../../../lib/types";

const ROLES: Role[] = ["operator", "approver", "admin"];

export default function AdminUsersPage() {
  const { operator: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<Role>("operator");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setUsers(await api.listUsers());
      setError(null);
    } catch (err) {
      setError((err as Error).message ?? "Could not load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(user: AdminUser) {
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await api.updateUser(user.id, { is_active: !user.is_active });
      setUsers((us) => us.map((u) => (u.id === user.id ? updated : u)));
      setNotice(`${user.username} ${updated.is_active ? "re-activated" : "deactivated"}.`);
    } catch (err) {
      setError((err as Error).message ?? "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(user: AdminUser, role: Role) {
    if (role === user.role) return;
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await api.updateUser(user.id, { role });
      setUsers((us) => us.map((u) => (u.id === user.id ? updated : u)));
      setNotice(`${user.username} is now ${role}.`);
    } catch (err) {
      setError((err as Error).message ?? "Role change failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        full_name: newFullName.trim(),
      });
      setUsers((us) => [...us, created]);
      setNotice(`User ${created.username} created.`);
      setNewUsername(""); setNewPassword(""); setNewFullName(""); setNewRole("operator");
    } catch (err) {
      const e = err as Error & { code?: string };
      setCreateError(e.code === "USERNAME_TAKEN" ? "That username already exists." : e.message);
    } finally {
      setCreating(false);
    }
  }

  const createValid = newUsername.trim().length >= 3 && newPassword.length >= 8;

  const panels: DashboardPanel[] = [
    {
      id: "users-table",
      title: "Operators",
      defaultPlacement: { x: 0, y: 0, w: 8, h: 14, minW: 5, minH: 8 },
      render: () => (
        <div className="card flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border-subtle shrink-0">
            <Users className="w-4 h-4 text-content-muted" />
            <h3 className="text-md font-semibold text-content-primary">Operators</h3>
            <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-2xs font-bold tabular-nums">
              {users.length}
            </span>
            <div className="flex-1" />
            {notice && (
              <span className="flex items-center gap-1.5 text-2xs text-success truncate">
                <CheckCircle2 className="w-3 h-3 shrink-0" />{notice}
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-2 bg-danger-subtle border-b border-danger-border text-xs text-danger shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10" style={{ background: "var(--surface-1)" }}>
                <tr className="border-b border-border">
                  {["User", "Role", "Status", "Last Login", "Baseline", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-2 text-2xs font-semibold uppercase tracking-widest text-content-muted whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-border-subtle">
                      <td colSpan={6} className="px-4 py-3"><div className="h-3 rounded bg-surface-3 animate-pulse" /></td>
                    </tr>
                  ))
                ) : (
                  users.map((user) => {
                    const isSelf = me !== null && String(user.id) === String(me.id);
                    return (
                      <tr key={user.id} className={clsx("border-b border-border-subtle", !user.is_active && "opacity-50")}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-2xs font-bold shrink-0">
                              {(user.full_name || user.username).charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-content-primary truncate">
                                {user.full_name || user.username}
                                {isSelf && <span className="text-2xs text-content-muted ml-1.5">(you)</span>}
                              </div>
                              <div className="font-mono text-2xs text-content-muted">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><RoleBadge role={user.role} /></td>
                        <td className="px-4 py-2.5">
                          <span className={clsx("flex items-center gap-1.5 text-2xs font-semibold", user.is_active ? "text-success" : "text-content-muted")}>
                            <span className={clsx("status-dot", user.is_active ? "status-dot-online" : "status-dot-offline")} />
                            {user.is_active ? "Active" : "Deactivated"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-2xs text-content-muted whitespace-nowrap">
                          {user.last_login ? new Date(user.last_login).toLocaleString() : "never"}
                        </td>
                        <td className="px-4 py-2.5">
                          {user.has_baseline ? (
                            <span className="flex items-center gap-1 text-2xs text-security" title="Behavioral drift baseline computed">
                              <Brain className="w-3 h-3" /> Profiled
                            </span>
                          ) : (
                            <span className="text-2xs text-content-disabled">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="relative">
                              <select
                                value={user.role}
                                disabled={busyId === user.id || isSelf}
                                onChange={(e) => changeRole(user, e.target.value as Role)}
                                className="appearance-none pl-2 pr-6 py-1 text-2xs rounded border border-border bg-surface-2
                                           text-content-primary disabled:opacity-40 focus:outline-none focus:border-accent"
                                title={isSelf ? "You cannot change your own role" : "Change role"}
                              >
                                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-content-muted" />
                            </div>
                            <button
                              type="button"
                              disabled={busyId === user.id || isSelf}
                              onClick={() => toggleActive(user)}
                              className={clsx(
                                "px-2 py-1 rounded border text-2xs font-semibold transition-colors disabled:opacity-40",
                                user.is_active
                                  ? "border-danger-border text-danger hover:bg-danger-subtle"
                                  : "border-success-border text-success hover:bg-success-subtle",
                              )}
                              title={isSelf ? "You cannot deactivate yourself" : undefined}
                            >
                              {busyId === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : user.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => api.downloadReport(`/admin/reports/operator/${user.id}`).catch((e) => setError((e as Error).message))}
                              className="btn-ghost p-1"
                              title="Download activity report (PDF)"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2 border-t border-border-subtle text-2xs text-content-muted shrink-0">
            All changes are recorded in the audit ledger · admins cannot deactivate or demote themselves
          </div>
        </div>
      ),
    },
    {
      id: "create-user",
      title: "Create User",
      defaultPlacement: { x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 7 },
      render: () => (
        <div className="card p-4 h-full overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-content-muted" />
            <h3 className="text-sm font-semibold text-content-primary">Create User</h3>
          </div>

          <label className="block text-xs font-medium text-content-secondary mb-1.5">Username</label>
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 64))}
            className="input-base text-xs mb-3"
            placeholder="op_newuser"
          />

          <label className="block text-xs font-medium text-content-secondary mb-1.5">Full Name</label>
          <input
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value.slice(0, 128))}
            className="input-base text-xs mb-3"
            placeholder="Jane Doe"
          />

          <label className="block text-xs font-medium text-content-secondary mb-1.5">
            Password <span className="text-content-muted">(min 8 chars)</span>
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value.slice(0, 256))}
            className="input-base text-xs mb-3"
            placeholder="••••••••"
          />

          <label className="block text-xs font-medium text-content-secondary mb-1.5">Role</label>
          <div className="relative mb-4">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className="input-base appearance-none pr-8 text-xs"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          </div>

          {createError && (
            <div className="flex items-start gap-2 p-2.5 mb-3 rounded bg-danger-subtle border border-danger-border">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span className="text-xs text-danger">{createError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!createValid || creating}
            className="btn-primary w-full justify-center"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Create User
          </button>
        </div>
      ),
    },
  ];

  return (
    <EditableDashboard
      pageId="admin-users"
      pageTitle="User Management"
      panels={panels}
    />
  );
}
