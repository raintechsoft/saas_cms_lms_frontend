import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPlatformUser, isPortalUser } from "../../components/AppShell";

type PortalKind = "student" | "parent";

const portalConfig: Record<PortalKind, {
  title: string;
  headline: string;
  description: string;
  panelLabel: string;
  accentClass: string;
  heroClass: string;
  redirectTo: string;
  requiredRole: "STUDENT" | "PARENT";
  wrongRoleMessage: string;
  emailPlaceholder: string;
}> = {
  student: {
    title: "Student login",
    headline: "Your learning portal",
    description: "View timetable, homework, exams, attendance, fees, and school notices.",
    panelLabel: "Students",
    accentClass: "text-emerald-400",
    heroClass: "bg-emerald-700",
    redirectTo: "/portal/student",
    requiredRole: "STUDENT",
    wrongRoleMessage: "This page is for student accounts only. Parents should use the parent login.",
    emailPlaceholder: "student@school.local",
  },
  parent: {
    title: "Parent login",
    headline: "Follow your child's progress",
    description: "Track attendance, exams, fees, notices, and homework across linked children.",
    panelLabel: "Parents",
    accentClass: "text-sky-400",
    heroClass: "bg-sky-700",
    redirectTo: "/parent/dashboard",
    requiredRole: "PARENT",
    wrongRoleMessage: "This page is for parent accounts only. Students should use the student login.",
    emailPlaceholder: "parent@school.local",
  },
};

function PortalLoginPage({ kind }: { kind: PortalKind }) {
  const config = portalConfig[kind];
  const { login, logout, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tenantSlug, setTenantSlug] = useState("demo-school");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user) {
    if (isPlatformUser(user.permissions)) return <Navigate to="/admin/dashboard" replace />;
    if (user.roles.includes(config.requiredRole)) return <Navigate to={config.redirectTo} replace />;
    if (user.roles.includes("PARENT")) return <Navigate to="/parent/dashboard" replace />;
    if (user.roles.includes("STUDENT")) return <Navigate to="/portal/student" replace />;
    if (isPortalUser(user.roles)) return <Navigate to={config.redirectTo} replace />;
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login({
        email,
        password,
        tenantSlug: tenantSlug.trim() || undefined,
      });
      if (!loggedInUser.roles.includes(config.requiredRole)) {
        logout();
        setError(config.wrongRoleMessage);
        return;
      }
      navigate(config.redirectTo, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className={`hidden p-14 text-white lg:flex lg:flex-col lg:justify-between ${config.heroClass}`}>
        <div className="text-xl font-semibold">SaaS CMS LMS</div>
        <div className="max-w-lg">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-white/70">
            {config.panelLabel}
          </p>
          <h1 className="text-4xl font-semibold leading-tight">{config.headline}</h1>
          <p className="mt-5 text-white/85">{config.description}</p>
        </div>
        <p className="text-sm text-white/70">Use the workspace slug provided by your school</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className={`text-sm font-medium ${config.accentClass}`}>SaaS CMS LMS</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">{config.title}</h2>
          <p className="mt-3 text-sm text-slate-400">{config.description}</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">School workspace</span>
              <input
                className="field"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="your-school-slug"
                autoComplete="organization"
                required
              />
              <span className="mt-2 block text-xs text-slate-500">
                Example: <code className="text-slate-300">green-valley</code> or demo <code className="text-slate-300">demo-school</code>
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Email</span>
              <input
                className="field"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={config.emailPlaceholder}
                autoComplete="username"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Password</span>
              <input
                className="field"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p className="rounded-lg border border-rose-900 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}
            <button
              className="w-full rounded-lg bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export function StudentLoginPage() {
  return <PortalLoginPage kind="student" />;
}

export function ParentLoginPage() {
  return <PortalLoginPage kind="parent" />;
}
