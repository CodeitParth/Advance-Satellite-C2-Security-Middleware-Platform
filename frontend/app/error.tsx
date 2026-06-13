"use client";
// Route error boundary — 500-style card per mockups/Error-pages-login-and-mobile-view.png.
// Never exposes stack traces or raw exception messages to the user.
import { AlertTriangle } from "lucide-react";

export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
      <div className="card max-w-md w-full p-8 text-center border-security-border">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-security-subtle border border-security-border mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-security" />
        </div>
        <div className="font-mono text-4xl font-bold text-security mb-1">500</div>
        <h1 className="text-md font-semibold text-content-primary mb-2">Something went wrong</h1>
        <p className="text-xs text-content-muted leading-relaxed mb-5">
          An unexpected error occurred while rendering this view. Your session and data
          are unaffected — try again.
        </p>
        <button type="button" onClick={reset} className="btn-primary inline-flex">
          Try Again
        </button>
      </div>
    </div>
  );
}
