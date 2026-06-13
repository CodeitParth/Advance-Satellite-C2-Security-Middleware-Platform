"use client";
import { AppShell } from "../../components/AppShell";

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["operator", "approver", "admin"]} pageTitle="Mission Control">
      {children}
    </AppShell>
  );
}
