"use client";
import { AppShell } from "../../components/AppShell";

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell requiredRole={["operator", "admin"]}>
      {children}
    </AppShell>
  );
}
