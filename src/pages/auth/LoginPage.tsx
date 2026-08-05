import { useEffect, useState, type FormEvent } from "react";

import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import { LoginAuthExtras } from "../../components/auth/LoginAuthExtras";

import { isPlatformUser, isPortalUser } from "../../components/AppShell";

import { getAuthConfig, loginWithMsg91Otp, requestLoginOtp, verifyLoginOtp } from "../../lib/api";
import { verifyWithMsg91Widget } from "../../lib/msg91Otp";
import { notifyError, notifyInfo, notifySuccess } from "../../lib/notify";



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

  {

    id: "student",

    title: "Student",

    description: "View timetable, homework, results, fees, and school notices.",

    symbol: "S",

    email: "student@demo-school.local",

  },

  {

    id: "parent",

    title: "Parent",

    description: "Track attendance, exams, fees, notices, and homework across children.",

    symbol: "P",

    email: "parent@demo-school.local",

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



  function navigateAfterLogin(id: LoginOption["id"] | undefined) {

    if (id === "student") {

      navigate("/portal/student", { replace: true });

    } else if (id === "parent") {

      navigate("/parent/dashboard", { replace: true });

    } else {

      navigate("/dashboard", { replace: true });

    }

  }



  async function handlePasswordSubmit(event: FormEvent) {

    event.preventDefault();

    setSubmitting(true);

    try {

      await login({

        email,

        password,

        tenantSlug: tenantSlug.trim() || undefined,

      });

      notifySuccess("Signed in successfully");

      navigateAfterLogin(selectedLogin?.id);

    } catch (cause) {

      notifyError(cause instanceof Error ? cause.message : "Unable to sign in");

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

      navigateAfterLogin(selectedLogin?.id);

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

      navigateAfterLogin(selectedLogin?.id);

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

      navigateAfterLogin(selectedLogin?.id);

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

    setTenantSlug("demo-school");

    setAuthMethod("password");

    setOtpCode("");

    setOtpRequested(false);

    setOtpInfo("");

  }



  return (

    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">

      <section className="hidden overflow-hidden bg-indigo-600 p-14 text-white lg:flex lg:flex-col lg:justify-between">

        <div className="text-xl font-semibold tracking-tight">SaaS CMS LMS</div>

        <div className="max-w-xl">

          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-indigo-200">

            CMS + LMS

          </p>

          <h1 className="text-5xl font-semibold leading-tight">

            One connected platform for modern education.

          </h1>

          <p className="mt-6 text-lg leading-8 text-indigo-100">

            Secure tenant workspaces, shared academic data, and the tools every

            institution needs to teach and operate.

          </p>

        </div>

        <p className="text-sm text-indigo-200">SaaS CMS LMS SaaS Foundation</p>

      </section>



      <section className="flex items-center justify-center px-6 py-12">

        <div className={`w-full ${selectedLogin ? "max-w-md" : "max-w-2xl"}`}>

          <div className="mb-9 lg:hidden">

            <span className="text-xl font-semibold text-white">SaaS CMS LMS</span>

          </div>

          {!selectedLogin ? (

            <>

              <p className="text-sm font-medium text-indigo-400">Welcome to SaaS CMS LMS</p>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">

                Choose your login

              </h2>

              <p className="mt-3 text-sm text-slate-400">

                Select your role to open the correct secure workspace.

              </p>



              <div className="mt-8 grid gap-3 sm:grid-cols-2">

                {loginOptions.map((option) => (

                  <button

                    key={option.id}

                    type="button"

                    onClick={() => chooseLogin(option)}

                    className="group flex items-start gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-indigo-500 hover:bg-slate-900"

                  >

                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-sm font-bold text-indigo-300 transition group-hover:bg-indigo-500 group-hover:text-white">

                      {option.symbol}

                    </span>

                    <span>

                      <span className="block font-semibold text-white">{option.title}</span>

                      <span className="mt-1 block text-xs leading-5 text-slate-400">

                        {option.description}

                      </span>

                    </span>

                  </button>

                ))}

              </div>

            </>

          ) : (

            <>

              <button

                type="button"

                onClick={() => setSelectedLogin(null)}

                className="mb-6 text-sm font-medium text-slate-400 transition hover:text-white"

              >

                ← Choose another login

              </button>

              <div className="flex items-center gap-4">

                <span className="grid size-12 place-items-center rounded-xl bg-indigo-500 text-sm font-bold text-white">

                  {selectedLogin.symbol}

                </span>

                <div>

                  <p className="text-sm font-medium text-indigo-400">Welcome back</p>

                  <h2 className="text-3xl font-semibold tracking-tight text-white">

                    {selectedLogin.title} login

                  </h2>

                </div>

              </div>

              <p className="mt-4 text-sm text-slate-400">{selectedLogin.description}</p>



              <div className="mt-8 space-y-5">

                <label className="block">

                  <span className="mb-2 block text-sm font-medium text-slate-200">Workspace slug</span>

                  <input

                    className="field"

                    value={tenantSlug}

                    onChange={(event) => setTenantSlug(event.target.value)}

                    placeholder="your-school-slug"

                    autoComplete="organization"

                    required

                  />

                  <span className="mt-2 block text-xs text-slate-500">

                    Must match the tenant slug from Super Admin → Tenants (example:{" "}

                    <code className="text-slate-300">green-valley</code>). Demo seed uses{" "}

                    <code className="text-slate-300">demo-school</code>.

                  </span>

                </label>

                <label className="block">

                  <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>

                  <input

                    className="field"

                    type="email"

                    value={email}

                    onChange={(event) => setEmail(event.target.value)}

                    placeholder={selectedLogin.email}

                    autoComplete="username"

                    required

                    autoFocus

                  />

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

                      <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>

                      <input

                        className="field"

                        type="password"

                        value={password}

                        onChange={(event) => setPassword(event.target.value)}

                        autoComplete="current-password"

                        minLength={8}

                        required

                      />

                    </label>



                    <button

                      className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"

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

    </main>

  );

}

