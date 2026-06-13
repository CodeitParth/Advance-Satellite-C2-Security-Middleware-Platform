"use client";
import { AppShell } from "../../components/AppShell";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["operator", "approver", "admin"]} pageTitle="Profile & Settings">
      {children}
    </AppShell>
  );
}
