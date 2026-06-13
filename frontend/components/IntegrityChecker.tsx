"use client";
// IntegrityChecker — verify chain button, result banner, demo tamper. T-031
import { useState } from "react";
import { clsx } from "clsx";
import { FlaskConical, Loader2, ShieldAlert, ShieldCheck, Link2 } from "lucide-react";
import { api } from "../lib/api";
import type { LedgerVerifyResult } from "../lib/types";

const IS_DEV =
  process.env.NEXT_PUBLIC_APP_ENV === "development" || process.env.NODE_ENV === "development";

interface IntegrityCheckerProps {
  /** Reports the corrupted sequence (or null when chain is valid) so the table can highlight it. */
  onResult?: (result: LedgerVerifyResult) => void;
  /** Called after a successful demo-tamper so the page can refresh the table. */
  onTampered?: () => void;
}

export function IntegrityChecker({ onResult, onTampered }: IntegrityCheckerProps) {
  const [result, setResult] = useState<LedgerVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [tampering, setTampering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await api.verifyLedger();
      setResult(res);
      onResult?.(res);
    } catch (err) {
      setError((err as Error).message ?? "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function tamper() {
    setTampering(true);
    setError(null);
    try {
      await api.tamperLedger();
      onTampered?.();
      // Immediately re-verify to demonstrate detection
      await verify();
    } catch (err) {
      setError((err as Error).message ?? "Demo tamper failed");
    } finally {
      setTampering(false);
    }
  }

  return (
    <div className="card flex flex-col h-full p-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-content-muted" />
        <h3 className="text-sm font-semibold text-content-primary">Ledger Integrity</h3>
      </div>
      <p className="text-2xs text-content-muted leading-relaxed mb-3">
        Every entry is SHA-256 hash-chained to its predecessor. Verification recomputes the
        full chain and flags the first mismatch.
      </p>

      {/* Result banner */}
      {result && (
        <div
          className={clsx(
            "flex items-start gap-2.5 p-3 rounded border mb-3",
            result.valid
              ? "bg-success-subtle border-success-border"
              : "bg-danger-subtle border-danger-border",
          )}
        >
          {result.valid ? (
            <ShieldCheck className="w-5 h-5 text-success shrink-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-danger shrink-0" />
          )}
          <div className="min-w-0">
            <div className={clsx("text-xs font-bold uppercase tracking-wide", result.valid ? "text-success" : "text-danger")}>
              {result.valid ? "Chain Verified" : "Tampering Detected"}
            </div>
            <div className="text-2xs text-content-secondary mt-0.5 leading-relaxed">
              {result.valid ? (
                <>
                  {result.entries_checked.toLocaleString()} entries checked ·{" "}
                  {new Date(result.verified_at).toLocaleTimeString()}
                </>
              ) : (
                <>
                  Tampering detected at sequence{" "}
                  <span className="font-mono font-bold text-danger">{result.corrupted_at_sequence}</span>
                  {result.entry_id && (
                    <> — entry ID <span className="font-mono">{result.entry_id.slice(0, 13)}…</span></>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded bg-danger-subtle border border-danger-border mb-3">
          <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <span className="text-xs text-danger">{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={verify}
        disabled={verifying || tampering}
        className="btn-primary w-full justify-center"
      >
        {verifying ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Verifying chain…
          </>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5" />
            Verify Chain Integrity
          </>
        )}
      </button>

      {IS_DEV && (
        <button
          type="button"
          onClick={tamper}
          disabled={verifying || tampering}
          className="mt-2 flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded border border-dashed
                     border-warning-border bg-warning-subtle text-warning text-xs font-semibold
                     hover:opacity-80 transition-opacity disabled:opacity-40"
          title="Development only — corrupts entry 42 to demonstrate detection"
        >
          {tampering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
          Tamper Entry 42 (Demo)
        </button>
      )}

      <p className="text-2xs text-content-disabled mt-auto pt-3">
        The ledger table is append-only at the database level — UPDATE and DELETE are blocked
        by a Postgres rule.
      </p>
    </div>
  );
}

export default IntegrityChecker;
