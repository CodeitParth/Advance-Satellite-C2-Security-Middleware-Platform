"use client";
import { AppShell } from "../../components/AppShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole="admin">
      {children}
    </AppShell>
  );
}
