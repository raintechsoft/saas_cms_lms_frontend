import { Link } from "react-router-dom";
import { GoogleSignInButton } from "./GoogleSignInButton";

type AuthMethod = "password" | "otp" | "mobile_otp";

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
  msg91Enabled?: boolean;
  mobilePhone?: string;
  onMobilePhoneChange?: (value: string) => void;
  onMsg91Verify?: () => void;
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
  msg91Enabled = false,
  mobilePhone = "",
  onMobilePhoneChange,
  onMsg91Verify,
}: LoginAuthExtrasProps) {
  const light = tone === "light";
  const forgotParams = new URLSearchParams();
  if (tenantSlug?.trim()) forgotParams.set("tenant", tenantSlug.trim());
  const forgotHref = forgotParams.size
    ? `${forgotPasswordPath}?${forgotParams.toString()}`
    : forgotPasswordPath;

  const goldButton =
    "w-full rounded-2xl bg-gradient-to-r from-amber-200 to-amber-500 px-4 py-3.5 text-[14px] font-semibold text-[#3b2714] shadow-[0_12px_28px_rgba(217,119,6,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";
  const goldField =
    "field !border-white/12 !bg-white/[0.06] tracking-[0.35em] focus:!border-amber-300/70 focus:!shadow-[0_0_0_3px_rgba(251,191,36,0.18)]";
  const panelClass = light
    ? "border border-slate-200 bg-slate-50"
    : "border border-white/10 bg-white/[0.04]";
  const tabClass = (active: boolean) =>
    `flex-1 rounded-xl px-2 py-2.5 text-[13px] font-semibold transition ${
      active
        ? "bg-gradient-to-r from-amber-200 to-amber-500 text-[#3b2714] shadow-[0_8px_18px_rgba(217,119,6,0.22)]"
        : light
          ? "text-slate-500 hover:text-slate-800"
          : "text-white/55 hover:bg-white/[0.06] hover:text-white"
    }`;

  return (
    <div className="space-y-5">
      <div
        className={`flex rounded-2xl p-1 ${
          light ? "border border-slate-200 bg-slate-50" : "border border-white/10 bg-white/[0.04]"
        }`}
      >
        <button type="button" className={tabClass(method === "password")} onClick={() => onMethodChange("password")}>
          Password
        </button>
        <button type="button" className={tabClass(method === "otp")} onClick={() => onMethodChange("otp")}>
          Email code
        </button>
        {msg91Enabled ? (
          <button
            type="button"
            className={tabClass(method === "mobile_otp")}
            onClick={() => onMethodChange("mobile_otp")}
          >
            Mobile OTP
          </button>
        ) : null}
      </div>

      {method === "password" && (
        <div className="flex justify-end">
          <Link
            to={forgotHref}
            className={`text-[13px] font-semibold ${light ? "text-amber-800 hover:text-amber-900" : "text-amber-200 hover:text-amber-100"}`}
          >
            Forgot password?
          </Link>
        </div>
      )}

      {method === "otp" && (
        <div className={`space-y-4 rounded-2xl p-4 ${panelClass}`}>
          {!otpRequested ? (
            <>
              <p className={`text-[13px] leading-6 ${light ? "text-slate-600" : "text-white/60"}`}>
                We&apos;ll email a one-time sign-in code{requireTenant ? " for your workspace account" : ""}.
              </p>
              <button
                type="button"
                className={light ? "button-primary w-full py-3 disabled:opacity-60" : goldButton}
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
                      : "border border-amber-200/20 bg-amber-200/10 text-amber-100"
                  }`}
                >
                  {otpInfo}
                </p>
              )}
              <label className="block">
                <span className={`mb-2 block text-[13px] font-medium ${light ? "text-slate-700" : "text-white/80"}`}>
                  6-digit code
                </span>
                <input
                  className={`${light ? "input" : goldField} tracking-[0.35em]`}
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
                className={light ? "button-primary w-full py-3 disabled:opacity-60" : goldButton}
                onClick={onVerifyOtp}
                disabled={submitting || otpCode.length < 6}
              >
                {submitting ? "Verifying…" : "Verify code & sign in"}
              </button>
              <button
                type="button"
                className={`w-full text-[13px] font-medium ${light ? "text-slate-500 hover:text-slate-800" : "text-amber-200/80 hover:text-amber-100"}`}
                onClick={onRequestOtp}
                disabled={submitting}
              >
                Resend code
              </button>
            </>
          )}
        </div>
      )}

      {method === "mobile_otp" && msg91Enabled ? (
        <div className={`space-y-4 rounded-2xl p-4 ${panelClass}`}>
          <p className={`text-[13px] leading-6 ${light ? "text-slate-600" : "text-white/60"}`}>
            Verify with MSG91 OTP. Use the mobile number saved on your campus user profile.
          </p>
          <label className="block">
            <span className={`mb-2 block text-[13px] font-medium ${light ? "text-slate-700" : "text-white/80"}`}>
              Mobile number
            </span>
            <input
              className={light ? "input" : "field !border-white/12 !bg-white/[0.06] focus:!border-amber-300/70 focus:!shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"}
              inputMode="tel"
              autoComplete="tel"
              placeholder="9876543210 or +919876543210"
              value={mobilePhone}
              onChange={(event) => onMobilePhoneChange?.(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={light ? "button-primary w-full py-3 disabled:opacity-60" : goldButton}
            onClick={onMsg91Verify}
            disabled={submitting}
          >
            {submitting ? "Opening OTP…" : "Continue with Mobile OTP"}
          </button>
        </div>
      ) : null}

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
