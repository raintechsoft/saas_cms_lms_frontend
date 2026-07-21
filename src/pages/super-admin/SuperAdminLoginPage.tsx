import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { LoginAuthExtras } from "../../components/auth/LoginAuthExtras";
import { isPlatformUser } from "../../components/AppShell";
import { getAuthConfig, requestLoginOtp, verifyLoginOtp } from "../../lib/api";

type AuthMethod = "password" | "otp";
const viteGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function SuperAdminLoginPage() {
  const { login, loginWithGoogleToken, completeLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState("admin@saas-cms-lms.local");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInfo, setOtpInfo] = useState("");
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    viteGoogleClientId?.trim() || null,
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (viteGoogleClientId?.trim()) return;
    getAuthConfig()
      .then((config) => setGoogleClientId(config.googleClientId))
      .catch(() => undefined);
  }, []);

  if (isAuthenticated && user && isPlatformUser(user.permissions)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/admin/dashboard", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestOtp() {
    if (!email.trim()) {
      setError("Enter your email before requesting a code");
      return;
    }
    setError("");
    setOtpInfo("");
    setSubmitting(true);
    try {
      const result = await requestLoginOtp({ email });
      setOtpRequested(true);
      setOtpInfo(
        result.devCode ? `${result.message} Dev code: ${result.devCode}` : result.message,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setSubmitting(true);
    try {
      const result = await verifyLoginOtp({ email, code: otpCode });
      completeLogin(result);
      navigate("/admin/dashboard", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid sign-in code");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogleToken({ idToken });
      navigate("/admin/dashboard", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f5f0] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-zinc-950 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-amber-400">SaaS CMS LMS</p>
          <p className="mt-2 text-sm font-semibold text-zinc-300">Ops Console</p>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-400">
            Restricted access
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">Platform command plane</h1>
          <p className="mt-5 text-base leading-7 text-zinc-400">
            Separate from campus teacher and student panels. Sign in here only for platform-wide tenant and
            reseller operations.
          </p>
        </div>
        <p className="relative font-mono text-xs text-zinc-600">super-admin · network control</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
            Operator login
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Super Admin</h2>
          <p className="mt-3 text-sm text-zinc-500">No workspace slug — platform identity only.</p>

          <div className="mt-8 space-y-5">
            <label className="block">
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>

            <LoginAuthExtras
              method={authMethod}
              onMethodChange={(method) => {
                setAuthMethod(method);
                setError("");
              }}
              otpCode={otpCode}
              onOtpCodeChange={setOtpCode}
              onRequestOtp={handleRequestOtp}
              onVerifyOtp={handleVerifyOtp}
              otpRequested={otpRequested}
              otpInfo={otpInfo}
              submitting={submitting}
              googleClientId={googleClientId}
              onGoogleCredential={handleGoogleCredential}
              onGoogleError={setError}
              forgotPasswordPath="/forgot-password?platform=1"
              tone="light"
            />

            {authMethod === "password" && (
              <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                <label className="block">
                  <span className="label">Password</span>
                  <input
                    className="input"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                {error && <p className="alert-error">{error}</p>}
                <button
                  className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-bold text-amber-400 transition hover:bg-zinc-800 disabled:opacity-60"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Authenticating…" : "Enter ops console"}
                </button>
              </form>
            )}

            {authMethod === "otp" && error && <p className="alert-error">{error}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
