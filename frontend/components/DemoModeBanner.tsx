import { FlaskConical } from "lucide-react";

export function DemoModeBanner() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!isDemoMode) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-warning-subtle border border-warning-border text-warning text-xs font-medium">
      <FlaskConical className="w-3 h-3 flex-shrink-0" />
      <span>DEMO MODE — AI scores use fixtures, not live Gemini</span>
    </div>
  );
}
