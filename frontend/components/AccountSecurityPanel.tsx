"use client";
// AccountSecurityPanel — password change + TOTP MFA management. Phase 2.
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { api } from "../lib/api";

function Feedback({ kind, text }: { kind: "ok" | "err"; text: string }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-2 p-2.5 rounded border text-xs",
        kind === "ok"
          ? "bg-success-subtle border-success-border text-success"
          : "bg-danger-subtle border-danger-border text-danger",
      )}
    >
      {kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
      <span>{text}</span>
    </div>
  );
}

// ── Change password ────────────────────────────────────────────────────────────

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const valid = current.length >= 1 && next.length >= 8 && next === confirm;

  async function handleChange() {
    setBusy(true);
    setMsg(null);
    try {
      await api.changePassword(current, next);
      setMsg({ kind: "ok", text: "Password changed. Use it on your next sign-in." });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      const e = err as Error & { code?: string };
      setMsg({
        kind: "err",
        text: e.code === "INVALID_CREDENTIALS" ? "Current password is incorrect." : e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-content-muted" />
        <h4 className="text-sm font-semibold text-content-primary">Change Password</h4>
      </div>
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)}
             className="input-base text-xs" placeholder="Current password" autoComplete="current-password" />
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)}
             className="input-base text-xs" placeholder="New password (min 8 chars)" autoComplete="new-password" />
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
             className="input-base text-xs" placeholder="Confirm new password" autoComplete="new-password" />
      {next && confirm && next !== confirm && (
        <p className="text-2xs text-danger">Passwords do not match.</p>
      )}
      {msg && <Feedback kind={msg.kind} text={msg.text} />}
      <button type="button" onClick={handleChange} disabled={!valid || busy} className="btn-primary w-full justify-center">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
        Update Password
      </button>
    </div>
  );
}

// ── MFA management ─────────────────────────────────────────────────────────────

function MfaManager() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    api.mfaStatus().then((s) => setEnabled(s.mfa_enabled)).catch(() => setEnabled(false));
  }, []);

  async function begin() {
    setBusy(true); setMsg(null);
    try {
      setSetup(await api.mfaSetup());
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      await api.mfaEnable(code.trim());
      setEnabled(true); setSetup(null); setCode("");
      setMsg({ kind: "ok", text: "MFA enabled — the 6-digit code is now required at sign-in." });
    } catch (err) {
      const e = err as Error & { code?: string };
      setMsg({ kind: "err", text: e.code === "MFA_INVALID" ? "Code didn't match — try the next one." : e.message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      await api.mfaDisable(password, code.trim());
      setEnabled(false); setCode(""); setPassword("");
      setMsg({ kind: "ok", text: "MFA disabled." });
    } catch (err) {
      const e = err as Error & { code?: string };
      setMsg({
        kind: "err",
        text: e.code === "INVALID_CREDENTIALS" ? "Password is incorrect."
            : e.code === "MFA_INVALID" ? "Authenticator code didn't match." : e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-content-muted" />
          <h4 className="text-sm font-semibold text-content-primary">Two-Factor Authentication</h4>
        </div>
        <span className={clsx(
          "flex items-center gap-1 text-2xs font-bold uppercase tracking-wide",
          enabled ? "text-success" : "text-content-muted",
        )}>
          {enabled ? <ShieldCheck className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
          {enabled === null ? "…" : enabled ? "Enabled" : "Off"}
        </span>
      </div>

      {msg && <Feedback kind={msg.kind} text={msg.text} />}

      {/* OFF → start setup */}
      {enabled === false && !setup && (
        <>
          <p className="text-2xs text-content-muted leading-relaxed">
            Adds a TOTP authenticator code (Google Authenticator, Authy, 1Password…) to every sign-in.
          </p>
          <button type="button" onClick={begin} disabled={busy} className="btn-secondary w-full justify-center">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Set Up MFA
          </button>
        </>
      )}

      {/* Setup in progress → QR + verify code */}
      {setup && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-center p-3 rounded bg-white">
            <QRCodeSVG value={setup.otpauth_uri} size={132} />
          </div>
          <p className="text-2xs text-content-muted text-center">
            Scan with your authenticator app, or enter the secret manually:
          </p>
          <code className="block text-center font-mono text-2xs text-content-secondary bg-surface-2 border border-border rounded px-2 py-1.5 break-all select-all">
            {setup.secret}
          </code>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="input-base font-mono tracking-[0.5em] text-center text-xs"
            placeholder="••••••"
          />
          <button type="button" onClick={enable} disabled={code.length < 6 || busy} className="btn-primary w-full justify-center">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Verify &amp; Enable
          </button>
        </div>
      )}

      {/* ON → disable flow */}
      {enabled === true && (
        <div className="space-y-2.5">
          <p className="text-2xs text-content-muted">To disable, confirm your password and a current code.</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 className="input-base text-xs" placeholder="Current password" autoComplete="current-password" />
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                 inputMode="numeric" className="input-base font-mono tracking-[0.5em] text-center text-xs" placeholder="••••••" />
          <button
            type="button"
            onClick={disable}
            disabled={!password || code.length < 6 || busy}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded border border-danger-border
                       bg-danger-subtle text-danger text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
            Disable MFA
          </button>
        </div>
      )}
    </div>
  );
}

// ── Combined panel ─────────────────────────────────────────────────────────────

export function AccountSecurityPanel() {
  return (
    <div className="card p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-content-primary mb-3">Account Security</h3>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ChangePasswordForm />
        <MfaManager />
      </div>
    </div>
  );
}

export default AccountSecurityPanel;
