"use client";
import { AppShell } from "../../components/AppShell";

export default function ApproverLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["approver", "admin"]}>
      {children}
    </AppShell>
  );
}
