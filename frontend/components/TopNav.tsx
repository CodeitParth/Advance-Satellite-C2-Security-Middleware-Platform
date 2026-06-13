"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  ChevronDown,
  LogOut,
  User,
  Moon,
  Sun,
  Satellite,
} from "lucide-react";
import { clsx } from "clsx";
import type { OperatorOut } from "../lib/types";
import { RoleBadge } from "./ui/StatusBadge";
import { clearStoredToken } from "../lib/api";

const SATELLITES = [
  { id: "SAT_ALPHA", label: "SAT_ALPHA", active: true },
  { id: "SAT_BRAVO", label: "SAT_BRAVO", active: false },
  { id: "SAT_CHARLIE", label: "SAT_CHARLIE", active: false },
];

interface TopNavProps {
  operator: OperatorOut;
  pageTitle?: string;
  pendingCount?: number;
  selectedSatellite?: string;
  onSatelliteChange?: (id: string) => void;
}

export function TopNav({
  operator,
  pageTitle,
  pendingCount = 0,
  selectedSatellite = "ALL SATELLITES",
  onSatelliteChange,
}: TopNavProps) {
  const router = useRouter();
  const [showSatMenu, setShowSatMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(true);

  function toggleTheme() {
    setIsDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("light", !next);
      return next;
    });
  }

  function handleLogout() {
    clearStoredToken();
    router.replace("/login");
  }

  return (
    <header
      className="flex items-center gap-3 h-topnav px-4 shrink-0 border-b border-border-subtle"
      style={{ background: "var(--surface-1)" }}
    >
      {/* Page title / breadcrumb */}
      {pageTitle && (
        <h1 className="text-md font-semibold text-content-primary mr-2 whitespace-nowrap">
          {pageTitle}
        </h1>
      )}

      {/* Satellite selector */}
      <div className="relative">
        <button
          onClick={() => { setShowSatMenu((v) => !v); setShowUserMenu(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border
                     bg-surface-2 text-sm text-content-primary hover:border-accent
                     transition-colors duration-150"
          aria-haspopup="listbox"
          aria-expanded={showSatMenu}
        >
          <Satellite className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono text-xs font-semibold">{selectedSatellite}</span>
          <ChevronDown className={clsx("w-3.5 h-3.5 text-content-muted transition-transform", showSatMenu && "rotate-180")} />
        </button>

        {showSatMenu && (
          <div
            className="absolute top-full left-0 mt-1 w-48 rounded border border-border
                       bg-surface-2 shadow-card-md z-50 py-1 animate-fade-in"
            role="listbox"
          >
            <div
              role="option"
              aria-selected={selectedSatellite === "ALL SATELLITES"}
              onClick={() => { onSatelliteChange?.("ALL SATELLITES"); setShowSatMenu(false); }}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer",
                "hover:bg-surface-3 transition-colors",
                selectedSatellite === "ALL SATELLITES"
                  ? "text-accent font-semibold"
                  : "text-content-secondary",
              )}
            >
              <span className="font-mono">ALL SATELLITES</span>
            </div>
            <div className="border-t border-border-subtle my-1" />
            {SATELLITES.map((sat) => (
              <div
                key={sat.id}
                role="option"
                aria-selected={selectedSatellite === sat.id}
                aria-disabled={!sat.active}
                onClick={() => {
                  if (!sat.active) return;
                  onSatelliteChange?.(sat.id);
                  setShowSatMenu(false);
                }}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors",
                  sat.active ? "hover:bg-surface-3" : "opacity-40 cursor-not-allowed",
                  selectedSatellite === sat.id ? "text-accent font-semibold" : "text-content-secondary",
                )}
              >
                <span className={clsx("status-dot", sat.active ? "status-dot-online" : "status-dot-offline")} />
                <span className="font-mono flex-1">{sat.label}</span>
                {!sat.active && <span className="text-2xs text-content-disabled">Phase 2</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted pointer-events-none" />
        <input
          type="search"
          placeholder="Search commands, IDs…"
          className="pl-8 pr-3 py-1.5 text-xs rounded border border-border bg-surface-2
                     text-content-primary placeholder:text-content-muted w-52
                     focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
        />
      </div>

      {/* Notifications */}
      <button
        className="relative btn-ghost p-1.5"
        aria-label={`Notifications${pendingCount > 0 ? `, ${pendingCount} pending` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center
                           min-w-[16px] h-4 px-0.5 rounded-full bg-accent text-white text-2xs font-bold">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="btn-ghost p-1.5"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => { setShowUserMenu((v) => !v); setShowSatMenu(false); }}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-2 transition-colors"
          aria-haspopup="menu"
          aria-expanded={showUserMenu}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-xs font-bold shrink-0">
            {operator.full_name?.charAt(0)?.toUpperCase() ?? operator.username.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block text-left min-w-0">
            <div className="text-xs font-semibold text-content-primary leading-tight truncate max-w-[120px]">
              {operator.full_name || operator.username}
            </div>
            <div className="text-2xs text-content-muted leading-tight capitalize">{operator.role}</div>
          </div>
          <ChevronDown className={clsx("w-3.5 h-3.5 text-content-muted transition-transform hidden md:block", showUserMenu && "rotate-180")} />
        </button>

        {showUserMenu && (
          <div
            className="absolute top-full right-0 mt-1 w-52 rounded border border-border
                       bg-surface-2 shadow-card-md z-50 py-1 animate-fade-in"
            role="menu"
          >
            <div className="px-3 py-2 border-b border-border-subtle">
              <div className="text-xs font-semibold text-content-primary">{operator.full_name || operator.username}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <RoleBadge role={operator.role} />
              </div>
            </div>
            <a
              href="/profile"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm text-content-secondary
                         hover:bg-surface-3 hover:text-content-primary transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Profile &amp; Settings
            </a>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger
                         hover:bg-danger-subtle transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Click-away overlay for dropdowns */}
      {(showSatMenu || showUserMenu) && (
        <div
          aria-hidden
          className="fixed inset-0 z-40"
          onClick={() => { setShowSatMenu(false); setShowUserMenu(false); }}
        />
      )}
    </header>
  );
}
