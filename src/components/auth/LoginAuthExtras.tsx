import { Link } from "react-router-dom";
import { GoogleSignInButton } from "./GoogleSignInButton";

type AuthMethod = "password" | "otp";

interface LoginAuthExtrasProps {
  method: AuthMethod;
  onMethodChange: (method: AuthMethod) => void;
  tenantSlug?: string;
  requireTenant?: boolean;
  otpCode: string;
  onOtpCodeChange: (value: string) => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
  otpRequested: boolean;
  otpInfo: string;
  submitting: boolean;
  googleClientId: string | null;
  onGoogleCredential: (idToken: string) => Promise<void>;
  onGoogleError: (message: string) => void;
  forgotPasswordPath: string;
  tone?: "dark" | "light";
}

export function LoginAuthExtras({
  method,
  onMethodChange,
  tenantSlug,
  requireTenant,
  otpCode,
  onOtpCodeChange,
  onRequestOtp,
  onVerifyOtp,
  otpRequested,
  otpInfo,
  submitting,
  googleClientId,
  onGoogleCredential,
  onGoogleError,
  forgotPasswordPath,
  tone = "dark",
}: LoginAuthExtrasProps) {
  const light = tone === "light";
  const forgotParams = new URLSearchParams();
  if (tenantSlug?.trim()) forgotParams.set("tenant", tenantSlug.trim());
  const forgotHref = forgotParams.size
    ? `${forgotPasswordPath}?${forgotParams.toString()}`
    : forgotPasswordPath;

  return (
    <div className="space-y-5">
      <div
        className={`flex rounded-xl p-1 ${
          light ? "border border-slate-200 bg-slate-50" : "border border-slate-800 bg-slate-900/50"
        }`}
      >
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            method === "password"
              ? "bg-teal-500 text-white shadow-sm"
              : light
                ? "text-slate-500 hover:text-slate-800"
                : "text-slate-400 hover:text-white"
          }`}
          onClick={() => onMethodChange("password")}
        >
          Password
        </button>
        <button
          type="button"
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
            method === "otp"
              ? "bg-teal-500 text-white shadow-sm"
              : light
                ? "text-slate-500 hover:text-slate-800"
                : "text-slate-400 hover:text-white"
          }`}
          onClick={() => onMethodChange("otp")}
        >
          Email code
        </button>
      </div>

      {method === "password" && (
        <div className="flex justify-end">
          <Link
            to={forgotHref}
            className={`text-sm font-semibold ${light ? "text-teal-700 hover:text-teal-800" : "text-teal-400 hover:text-teal-300"}`}
          >
            Forgot password?
          </Link>
        </div>
      )}

      {method === "otp" && (
        <div
          className={`space-y-4 rounded-xl p-4 ${
            light ? "border border-slate-200 bg-slate-50" : "border border-slate-800 bg-slate-900/40"
          }`}
        >
          {!otpRequested ? (
            <>
              <p className={`text-sm ${light ? "text-slate-600" : "text-slate-400"}`}>
                We&apos;ll email a one-time sign-in code{requireTenant ? " for your workspace account" : ""}.
              </p>
              <button
                type="button"
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                  light
                    ? "border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
                    : "border border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                }`}
                onClick={onRequestOtp}
                disabled={submitting}
              >
                {submitting ? "Sending code…" : "Send sign-in code"}
              </button>
            </>
          ) : (
            <>
              {otpInfo && (
                <p
                  className={`rounded-xl px-3 py-2 text-sm ${
                    light
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-emerald-900/60 bg-emerald-950/40 text-emerald-200"
                  }`}
                >
                  {otpInfo}
                </p>
              )}
              <label className="block">
                <span className={`mb-2 block text-sm font-medium ${light ? "text-slate-700" : "text-slate-200"}`}>
                  6-digit code
                </span>
                <input
                  className={`${light ? "input" : "field"} tracking-[0.35em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </label>
              <button
                type="button"
                className="button-primary w-full py-3 disabled:opacity-60"
                onClick={onVerifyOtp}
                disabled={submitting || otpCode.length < 6}
              >
                {submitting ? "Verifying…" : "Verify code & sign in"}
              </button>
              <button
                type="button"
                className={`w-full text-sm ${light ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-white"}`}
                onClick={onRequestOtp}
                disabled={submitting}
              >
                Resend code
              </button>
            </>
          )}
        </div>
      )}

      {googleClientId && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`h-px flex-1 ${light ? "bg-slate-200" : "bg-slate-800"}`} />
            <span className="text-xs uppercase tracking-wider text-slate-500">or</span>
            <div className={`h-px flex-1 ${light ? "bg-slate-200" : "bg-slate-800"}`} />
          </div>
          <GoogleSignInButton
            clientId={googleClientId}
            disabled={submitting}
            onCredential={onGoogleCredential}
            onError={onGoogleError}
          />
        </div>
      )}
    </div>
  );
}
