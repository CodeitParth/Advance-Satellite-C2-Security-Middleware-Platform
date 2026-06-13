"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, AlertCircle, Satellite } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import type { Role } from "../../lib/types";

const ROLE_HOME: Record<Role, string> = {
  operator: "/operator/dashboard",
  approver: "/approver/queue",
  admin:    "/admin/ledger",
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // MFA step (Phase 2): shown when the backend answers MFA_REQUIRED
  const [mfaRequired, setMfaRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    if (mfaRequired && totpCode.trim().length < 6) return;

    setIsLoading(true);
    setError(null);

    try {
      const operator = await login({
        username: username.trim(),
        password,
        ...(mfaRequired ? { totp_code: totpCode.trim() } : {}),
      });
      router.replace(ROLE_HOME[operator.role] ?? "/mission-control");
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      if (e.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        setError(null);
      } else if (e.code === "MFA_INVALID") {
        setError("Invalid authenticator code.");
      } else if (e.status === 429) {
        setError("Too many attempts. Please wait and try again.");
      } else if (e.status === 401 || e.code === "INVALID_CREDENTIALS") {
        setError("Invalid username or password.");
      } else {
        setError("Unable to connect. Check that the backend is running.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    // Full-screen dark background
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center px-4">

      {/* Subtle grid overlay for texture */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,107,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(79,107,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Login card */}
      <div className="relative w-full max-w-[400px] animate-fade-in">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          {/* Logo mark */}
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent mb-4 shadow-glow">
            <Satellite className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-content-primary tracking-tight">SCSP</h1>
          <p className="text-sm text-content-muted mt-1">Satellite Command Security Platform</p>
        </div>

        {/* Card */}
        <div className="bg-surface-1 border border-border rounded-lg p-6 shadow-card-lg">

          <div className="mb-5">
            <h2 className="text-base font-semibold text-content-primary">Operator Sign-in</h2>
            <p className="text-xs text-content-muted mt-0.5">
              Authenticated access only — all sessions logged
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 mb-4 px-3 py-2.5 rounded
                         bg-danger-subtle border border-danger-border text-danger text-sm"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-content-secondary mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-base"
                placeholder="Enter username"
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-content-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pr-10"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* TOTP code (shown only when the account has MFA enabled) */}
            {mfaRequired && (
              <div>
                <label htmlFor="totp" className="block text-xs font-medium text-content-secondary mb-1.5">
                  Authenticator Code
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="input-base font-mono tracking-[0.5em] text-center"
                  placeholder="••••••"
                  autoFocus
                />
                <p className="text-2xs text-content-muted mt-1.5">
                  Two-factor authentication is enabled — enter the 6-digit code from your authenticator app.
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password || (mfaRequired && totpCode.length < 6)}
              className="btn-primary w-full mt-1"
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5" />
                  Sign in
                </>
              )}
            </button>

          </form>
        </div>

        {/* Classification notice */}
        <p className="text-center text-2xs text-content-disabled mt-5 uppercase tracking-widest">
          Restricted system — authorized personnel only
        </p>

        {/* Demo credentials hint */}
        <div className="mt-4 text-center">
          <details className="inline-block text-left">
            <summary className="text-2xs text-content-muted cursor-pointer select-none hover:text-content-secondary transition-colors">
              Demo credentials
            </summary>
            <div className="mt-2 p-3 rounded bg-surface-2 border border-border-subtle text-xs font-mono text-content-secondary space-y-1">
              <div><span className="text-content-muted">operator :</span> op_chen / operator123</div>
              <div><span className="text-content-muted">approver :</span> so_kim / approver123</div>
              <div><span className="text-content-muted">admin    :</span> admin_root / admin123</div>
            </div>
          </details>
        </div>

      </div>
    </div>
  );
}
