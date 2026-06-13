// 404 — route not found. Styled per mockups/Error-pages-login-and-mobile-view.png.
import Link from "next/link";
import { Satellite } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--surface-0)" }}>
      <div className="card max-w-md w-full p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-accent-subtle border border-accent-border mx-auto mb-4">
          <Satellite className="w-7 h-7 text-accent" />
        </div>
        <div className="font-mono text-4xl font-bold text-accent mb-1">404</div>
        <h1 className="text-md font-semibold text-content-primary mb-2">Lost in space</h1>
        <p className="text-xs text-content-muted leading-relaxed mb-5">
          The page you requested drifted out of orbit. Check the address, or return to a
          known trajectory.
        </p>
        <Link href="/mission-control" className="btn-primary inline-flex">
          Return to Mission Control
        </Link>
      </div>
    </div>
  );
}
