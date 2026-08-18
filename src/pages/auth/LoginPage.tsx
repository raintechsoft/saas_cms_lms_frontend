import { useEffect, useState, type FormEvent } from "react";

import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import { LoginAuthExtras } from "../../components/auth/LoginAuthExtras";

import { isPlatformUser, isPortalUser } from "../../components/AppShell";

import { getAuthConfig, loginWithMsg91Otp, requestLoginOtp, verifyLoginOtp } from "../../lib/api";
import { verifyWithMsg91Widget } from "../../lib/msg91Otp";
import { notifyError, notifyInfo, notifySuccess } from "../../lib/notify";
import {
  applyApiFieldErrors,
  clearFieldError,
  type FieldErrors,
  validateEmail,
  validateRequired,
} from "../../lib/formErrors";
import { FieldError } from "../../components/forms/Field";



const loginOptions = [

  {

    id: "institution-admin",

    title: "Institution Admin",

    description: "Manage your institution, users and all enabled modules.",

    symbol: "IA",

    email: "admin@demo-school.local",

  },

  {

    id: "teacher",

    title: "Teacher",

    description: "Access classes, attendance, exams and homework.",

    symbol: "T",

    email: "teacher@demo-school.local",

  },

  {

    id: "accountant",

    title: "Accountant",

    description: "Manage fees, payroll and financial reports.",

    symbol: "A",

    email: "accountant@demo-school.local",

  },

] as const;



type LoginOption = (typeof loginOptions)[number];

type AuthMethod = "password" | "otp" | "mobile_otp";



const viteGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;



export function LoginPage() {

  const { login, loginWithGoogleToken, completeLogin, isAuthenticated, user } = useAuth();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedLogin, setSelectedLogin] = useState<LoginOption | null>(null);

  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");

  const [email, setEmail] = useState(searchParams.get("email") ?? "");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [tenantSlug, setTenantSlug] = useState(searchParams.get("tenant") ?? "demo-school");

  const [otpCode, setOtpCode] = useState("");

  const [otpRequested, setOtpRequested] = useState(false);

  const [otpInfo, setOtpInfo] = useState("");

  const [googleClientId, setGoogleClientId] = useState<string | null>(

    viteGoogleClientId?.trim() || null,

  );

  const [msg91Otp, setMsg91Otp] = useState<{ widgetId: string; tokenAuth: string } | null>(null);

  const [mobilePhone, setMobilePhone] = useState("");

  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {
    getAuthConfig()
      .then((config) => {
        if (!viteGoogleClientId?.trim()) setGoogleClientId(config.googleClientId);
        setMsg91Otp(config.msg91Otp);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchParams.get("tenant") || searchParams.get("email")) {
      setSelectedLogin(loginOptions.find((option) => option.id === "institution-admin") ?? null);
    }
  }, [searchParams]);



  if (isAuthenticated && user && isPlatformUser(user.permissions)) {

    return <Navigate to="/admin/dashboard" replace />;

  }

  if (isAuthenticated && user && isPortalUser(user.roles)) {

    return <Navigate to={user.roles.includes("PARENT") ? "/parent/dashboard" : "/portal/student"} replace />;

  }

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;



  function navigateAfterLogin() {

    navigate("/dashboard", { replace: true });

  }



  async function handlePasswordSubmit(event: FormEvent) {

    event.preventDefault();

    const emailErr = validateEmail(email);

    const next = validateRequired(

      { tenantSlug: tenantSlug.trim(), email: email.trim(), password },

      [

        { key: "tenantSlug", label: "Workspace slug" },

        {

          key: "email",

          label: "Email",

          test: () => !emailErr,

          message: emailErr ?? "Email is required",

        },

        { key: "password", label: "Password" },

      ],

    );

    if (emailErr) next.email = emailErr;

    setFieldErrors(next);

    if (Object.keys(next).length) return;

    setSubmitting(true);

    try {

      await login({

        email,

        password,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      notifySuccess("Signed in successfully");

      navigateAfterLogin();

    } catch (cause) {

      if (!applyApiFieldErrors(cause, setFieldErrors)) {

        notifyError(cause instanceof Error ? cause.message : "Unable to sign in");

      }

    } finally {

      setSubmitting(false);

    }

  }



  async function handleRequestOtp() {

    if (!email.trim()) {

      notifyError("Enter your email before requesting a code");

      return;

    }

    setOtpInfo("");

    setSubmitting(true);

    try {

      const result = await requestLoginOtp({

        email,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      setOtpRequested(true);

      const info = result.devCode

        ? `${result.message} Dev code: ${result.devCode}`

        : result.message;

      setOtpInfo(info);

      notifyInfo(info);

    } catch (cause) {

      notifyError(cause instanceof Error ? cause.message : "Unable to send code");

    } finally {

      setSubmitting(false);

    }

  }



  async function handleVerifyOtp() {

    setSubmitting(true);

    try {

      const result = await verifyLoginOtp({

        email,

        code: otpCode,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      completeLogin(result);

      notifySuccess("Signed in successfully");

      navigateAfterLogin();

    } catch (cause) {

      notifyError(cause instanceof Error ? cause.message : "Invalid sign-in code");

    } finally {

      setSubmitting(false);

    }

  }



  async function handleMsg91Otp() {

    if (!msg91Otp) {

      notifyError("MSG91 mobile OTP is not configured");

      return;

    }

    setSubmitting(true);

    try {

      const digits = mobilePhone.replace(/\D/g, "");
      const identifier =
        digits.length === 10
          ? `91${digits}`
          : digits.length >= 11
            ? digits
            : "";

      const accessToken = await verifyWithMsg91Widget(
        msg91Otp,
        identifier || undefined,
      );

      const result = await loginWithMsg91Otp({

        accessToken,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      completeLogin(result);

      notifySuccess("Signed in successfully");

      navigateAfterLogin();

    } catch (cause) {

      notifyError(cause instanceof Error ? cause.message : "Mobile OTP sign-in failed");

    } finally {

      setSubmitting(false);

    }

  }



  async function handleGoogleCredential(idToken: string) {

    setSubmitting(true);

    try {

      await loginWithGoogleToken({

        idToken,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      notifySuccess("Signed in successfully");

      navigateAfterLogin();

    } catch (cause) {

      notifyError(cause instanceof Error ? cause.message : "Google sign-in failed");

    } finally {

      setSubmitting(false);

    }

  }



  function chooseLogin(option: LoginOption) {

    setSelectedLogin(option);

    setEmail("");

    setPassword("");

    setFieldErrors({});

    setTenantSlug("demo-school");

    setAuthMethod("password");

    setOtpCode("");

    setOtpRequested(false);

    setOtpInfo("");

  }



  const fieldClass = (invalid?: string) =>
    `field !border-white/12 !bg-white/[0.06] focus:!border-amber-300/70 focus:!shadow-[0_0_0_3px_rgba(251,191,36,0.18)]${
      invalid ? " is-invalid" : ""
    }`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1a120c] text-white">
      <img
        src={`${import.meta.env.BASE_URL}login-hero.jpg`}
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,12,8,0.28)_0%,rgba(18,12,8,0.42)_38%,rgba(18,12,8,0.78)_68%,rgba(16,11,8,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,transparent_20%,rgba(16,11,8,0.45)_100%)]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between px-12 py-12 lg:flex xl:px-16">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl border border-white/20 bg-white/10 text-[11px] font-bold tracking-[0.18em] backdrop-blur-md">
              UA
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-wide">SaaS CMS LMS</p>
              <p className="text-[11px] tracking-[0.22em] text-white/55 uppercase">Universe AI</p>
            </div>
          </div>

          <div className="max-w-xl pb-8">
            <p className="mb-4 text-[11px] font-semibold tracking-[0.34em] text-amber-200/80 uppercase">
              Campus operating system
            </p>
            <h1 className="text-[52px] font-semibold leading-[1.08] tracking-[-0.03em]">
              One connected platform for modern education.
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-8 text-white/78">
              Secure tenant workspaces, shared academic data, and the tools every institution needs to teach and operate.
            </p>
            <div className="mt-8 flex gap-8 text-[12px] tracking-wide text-white/60">
              <span>Admin</span>
              <span className="text-white/25">·</span>
              <span>Staff</span>
              <span className="text-white/25">·</span>
              <span>Finance</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[460px] rounded-[28px] border border-white/12 bg-[#1c1410]/62 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-8">
            <div className="mb-7 lg:hidden">
              <span className="text-[15px] font-semibold">SaaS CMS LMS</span>
            </div>

            {!selectedLogin ? (
              <>
                <p className="text-[11px] font-semibold tracking-[0.28em] text-amber-200/85 uppercase">
                  Institute login
                </p>
                <h2 className="mt-2 text-[30px] font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-2 text-[13px] leading-6 text-white/60">
                  Choose your staff workspace. Students and parents sign in through the mobile app.
                </p>

                <div className="mt-7 grid gap-3">
                  {loginOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseLogin(option)}
                      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-amber-200/45 hover:bg-white/[0.08]"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-[13px] font-bold text-[#3b2714] shadow-[0_8px_18px_rgba(217,119,6,0.28)]">
                        {option.symbol}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{option.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-white/55">
                          {option.description}
                        </span>
                      </span>
                      <span className="text-white/25 transition group-hover:text-amber-200">→</span>
                    </button>
                  ))}
                </div>

                <p className="mt-7 text-center text-[12px] text-white/45">
                  Platform Super Admin?{" "}
                  <a href="#/admin/login" className="font-semibold text-amber-200 hover:text-amber-100">
                    Go to admin login
                  </a>
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedLogin(null)}
                  className="mb-6 text-[13px] font-medium text-white/50 transition hover:text-white"
                >
                  ← Choose another login
                </button>
                <div className="flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-[13px] font-bold text-[#3b2714]">
                    {selectedLogin.symbol}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/85 uppercase">
                      Welcome back
                    </p>
                    <h2 className="text-[26px] font-semibold tracking-tight">{selectedLogin.title} login</h2>
                  </div>
                </div>
                <p className="mt-3 text-[13px] text-white/55">{selectedLogin.description}</p>

                <div className="mt-7 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-medium text-white/80">Workspace slug</span>
                    <input
                      className={fieldClass(fieldErrors.tenantSlug)}
                      value={tenantSlug}
                      onChange={(event) => {
                        setTenantSlug(event.target.value);
                        setFieldErrors((prev) => clearFieldError(prev, "tenantSlug"));
                      }}
                      placeholder="your-school-slug"
                      autoComplete="organization"
                    />
                    <FieldError error={fieldErrors.tenantSlug} />
                    {!fieldErrors.tenantSlug ? (
                      <span className="mt-2 block text-[11px] text-white/40">
                        Must match Super Admin → Tenants. Demo seed uses{" "}
                        <code className="text-amber-100/80">demo-school</code>.
                      </span>
                    ) : null}
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-medium text-white/80">Email</span>
                    <input
                      className={fieldClass(fieldErrors.email)}
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setFieldErrors((prev) => clearFieldError(prev, "email"));
                      }}
                      placeholder={selectedLogin.email}
                      autoComplete="username"
                      autoFocus
                    />
                    <FieldError error={fieldErrors.email} />
                  </label>

                  <LoginAuthExtras
                    method={authMethod}
                    onMethodChange={(method) => {
                      setAuthMethod(method);
                    }}
                    tenantSlug={tenantSlug}
                    requireTenant
                    otpCode={otpCode}
                    onOtpCodeChange={setOtpCode}
                    onRequestOtp={handleRequestOtp}
                    onVerifyOtp={handleVerifyOtp}
                    otpRequested={otpRequested}
                    otpInfo={otpInfo}
                    submitting={submitting}
                    googleClientId={googleClientId}
                    onGoogleCredential={handleGoogleCredential}
                    onGoogleError={notifyError}
                    forgotPasswordPath="/forgot-password"
                    msg91Enabled={Boolean(msg91Otp)}
                    mobilePhone={mobilePhone}
                    onMobilePhoneChange={setMobilePhone}
                    onMsg91Verify={handleMsg91Otp}
                  />

                  {authMethod === "password" && (
                    <form className="space-y-5" onSubmit={handlePasswordSubmit}>
                      <label className="block">
                        <span className="mb-2 flex items-center justify-between text-[13px] font-medium text-white/80">
                          <span>Password</span>
                          <button
                            type="button"
                            className="text-[12px] font-semibold text-amber-200 hover:text-amber-100"
                            onClick={() => setShowPassword((value) => !value)}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </span>
                        <input
                          className={fieldClass(fieldErrors.password)}
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setFieldErrors((prev) => clearFieldError(prev, "password"));
                          }}
                          autoComplete="current-password"
                          minLength={8}
                        />
                        <FieldError error={fieldErrors.password} />
                      </label>
                      <button
                        className="w-full rounded-2xl bg-gradient-to-r from-amber-200 to-amber-500 px-4 py-3.5 text-[14px] font-semibold text-[#3b2714] shadow-[0_12px_28px_rgba(217,119,6,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting ? "Signing in…" : `Sign in as ${selectedLogin.title}`}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );

}

