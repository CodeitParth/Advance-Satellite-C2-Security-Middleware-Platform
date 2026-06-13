"use client";
import { AppShell } from "../../../components/AppShell";

export default function OrbitalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["operator", "approver", "admin"]} pageTitle="Orbital Operations Center">
      {children}
    </AppShell>
  );
}
