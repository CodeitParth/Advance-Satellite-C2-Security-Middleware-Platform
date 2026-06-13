"use client";
import { AppShell } from "../../../components/AppShell";

export default function ObcLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["operator", "approver", "admin"]} pageTitle="OBC Monitoring Center">
      {children}
    </AppShell>
  );
}
