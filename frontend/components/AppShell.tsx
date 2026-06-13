"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { DemoModeBanner } from "./DemoModeBanner";
import { useAuth } from "../hooks/useAuth";
import type { Role } from "../lib/types";

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  pendingCount?: number;
  requiredRole?: Role | Role[];
}

export function AppShell({ children, pageTitle, pendingCount = 0, requiredRole }: AppShellProps) {
  const router = useRouter();
  const { operator, isLoading } = useAuth();
  const [selectedSatellite, setSelectedSatellite] = useState("ALL SATELLITES");

  useEffect(() => {
    if (!isLoading && !operator) {
      router.replace("/login");
    }
  }, [isLoading, operator, router]);

  useEffect(() => {
    if (!isLoading && operator && requiredRole) {
      const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!allowed.includes(operator.role)) {
        const homes: Record<Role, string> = {
          operator: "/operator/dashboard",
          approver: "/approver/queue",
          admin:    "/admin/ledger",
        };
        router.replace(homes[operator.role]);
      }
    }
  }, [isLoading, operator, requiredRole, router]);

  if (isLoading || !operator) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-0">
        <div className="flex items-center gap-3 text-content-muted text-sm">
          <span className="w-4 h-4 border-2 border-content-muted/30 border-t-content-muted rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Sidebar */}
      <Sidebar role={operator.role} pendingCount={pendingCount} />

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Demo mode banner */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="shrink-0 px-4 pt-2">
            <DemoModeBanner />
          </div>
        )}

        {/* Top nav */}
        <TopNav
          operator={operator}
          pageTitle={pageTitle}
          pendingCount={pendingCount}
          selectedSatellite={selectedSatellite}
          onSatelliteChange={setSelectedSatellite}
        />

        {/* Scrollable page content */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
