"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Terminal,
  History,
  CheckCircle2,
  Lock,
  Shield,
  Users,
  Settings,
  Hash,
  UserCircle,
  Satellite,
  ChevronRight,
  Globe2,
  Cpu,
} from "lucide-react";
import type { Role } from "../lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNavGroups(pendingCount = 0): NavGroup[] {
  return [
    {
      label: "",
      items: [
        {
          label: "Mission Control",
          href: "/mission-control",
          icon: LayoutDashboard,
          roles: ["operator", "approver", "admin"],
        },
      ],
    },
    {
      label: "Operations",
      items: [
        {
          label: "Command Center",
          href: "/operator/dashboard",
          icon: Terminal,
          roles: ["operator", "admin"],
        },
        {
          label: "My Commands",
          href: "/operator/ledger",
          icon: History,
          roles: ["operator", "approver", "admin"],
        },
        {
          label: "Approvals",
          href: "/approver/queue",
          icon: CheckCircle2,
          roles: ["approver", "admin"],
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        {
          label: "Emergency Override",
          href: "/approver/override",
          icon: Lock,
          roles: ["approver", "admin"],
        },
      ],
    },
    {
      label: "Simulation",
      items: [
        {
          label: "Orbital Ops Center",
          href: "/simulation/orbital",
          icon: Globe2,
          roles: ["operator", "approver", "admin"],
        },
        {
          label: "OBC Monitor",
          href: "/simulation/obc",
          icon: Cpu,
          roles: ["operator", "approver", "admin"],
        },
      ],
    },
    {
      label: "Administration",
      items: [
        {
          label: "Admin Dashboard",
          href: "/admin/dashboard",
          icon: Shield,
          roles: ["admin"],
        },
        {
          label: "Users",
          href: "/admin/users",
          icon: Users,
          roles: ["admin"],
        },
        {
          label: "Policies",
          href: "/admin/policy",
          icon: Settings,
          roles: ["admin"],
        },
        {
          label: "Audit Ledger",
          href: "/admin/ledger",
          icon: Hash,
          roles: ["operator", "approver", "admin"],
        },
      ],
    },
  ];
}

interface SidebarProps {
  role: Role;
  pendingCount?: number;
  systemStatus?: "nominal" | "degraded" | "offline";
}

export function Sidebar({ role, pendingCount = 0, systemStatus = "nominal" }: SidebarProps) {
  const pathname = usePathname();
  const groups = buildNavGroups(pendingCount);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-col w-sidebar h-full shrink-0 overflow-y-auto scrollbar-none"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border-subtle)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-topnav shrink-0 border-b border-border-subtle">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-accent shadow-glow shrink-0">
          <Satellite className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-content-primary leading-tight">SCSP</div>
          <div className="text-2xs text-content-muted leading-tight truncate">
            Cmd Security Platform
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <div className="flex-1 px-2 py-3 space-y-1">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className="mb-1">
              {group.label && (
                <div
                  className="px-2 mb-1 text-2xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--sidebar-group-label)" }}
                >
                  {group.label}
                </div>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "nav-item w-full",
                      active && "nav-item-active",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge != null && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-2xs font-bold">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                    {active && <ChevronRight className="w-3 h-3 text-[var(--sidebar-item-active-text)] shrink-0" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Profile link */}
      <div className="px-2 pb-2 border-t border-border-subtle pt-2">
        <Link
          href="/profile"
          className={clsx("nav-item w-full", isActive("/profile") && "nav-item-active")}
          aria-current={isActive("/profile") ? "page" : undefined}
        >
          <UserCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Profile &amp; Settings</span>
        </Link>
      </div>

      {/* System status footer */}
      <div className="px-3 pb-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={clsx("status-dot", {
              "status-dot-online":  systemStatus === "nominal",
              "status-dot-warning": systemStatus === "degraded",
              "status-dot-offline": systemStatus === "offline",
            })}
          />
          <span className="text-content-muted">
            {systemStatus === "nominal" ? "System Nominal" : systemStatus === "degraded" ? "System Degraded" : "System Offline"}
          </span>
        </div>
        <div className="text-2xs text-content-disabled">
          Last sync: <span id="sidebar-sync-ts">—</span>
        </div>
      </div>
    </nav>
  );
}
