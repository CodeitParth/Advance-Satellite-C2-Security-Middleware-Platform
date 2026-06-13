import { clsx } from "clsx";
import { Users } from "lucide-react";
import { RoleBadge } from "./ui/StatusBadge";
import type { Role } from "../lib/types";

interface PresenceUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: "active" | "idle";
  lastSeen?: string;
}

// Demo seed — replaced with real data via WebSocket in Phase 2
const DEMO_OPERATORS: PresenceUser[] = [
  { id: "1", username: "op_chen",    fullName: "Chen Wei",     role: "operator", status: "active" },
  { id: "2", username: "so_kim",     fullName: "Kim Park",     role: "approver", status: "active" },
  { id: "3", username: "admin_root", fullName: "Adam Root",    role: "admin",    status: "active" },
  { id: "4", username: "op_tanaka",  fullName: "Tanaka Kenji", role: "operator", status: "idle",   lastSeen: "3m ago" },
  { id: "5", username: "so_reyes",   fullName: "Ana Reyes",    role: "approver", status: "active" },
];

export function OperatorPresence() {
  const active  = DEMO_OPERATORS.filter((u) => u.status === "active");
  const idle    = DEMO_OPERATORS.filter((u) => u.status === "idle");

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-content-muted" />
          <span className="text-md font-semibold text-content-primary">Operator Presence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="status-dot status-dot-online animate-pulse-dot" />
          <span className="text-xs font-bold text-success">{active.length} online</span>
        </div>
      </div>

      {/* Active */}
      <div className="space-y-1.5">
        {active.map((user) => (
          <div key={user.id} className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-2xs font-bold shrink-0">
              {user.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-content-primary leading-tight truncate">
                {user.fullName}
              </div>
              <div className="text-2xs text-content-muted leading-tight font-mono truncate">
                {user.username}
              </div>
            </div>
            <RoleBadge role={user.role} />
          </div>
        ))}
      </div>

      {/* Idle section */}
      {idle.length > 0 && (
        <>
          <div className="border-t border-border-subtle" />
          <div className="section-label">Idle</div>
          {idle.map((user) => (
            <div key={user.id} className={clsx("flex items-center gap-2.5 opacity-50")}>
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-2 text-content-muted text-2xs font-bold shrink-0">
                {user.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-content-secondary leading-tight truncate">{user.fullName}</div>
                <div className="text-2xs text-content-disabled leading-tight">{user.lastSeen ?? "idle"}</div>
              </div>
              <RoleBadge role={user.role} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
