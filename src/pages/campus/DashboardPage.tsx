import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { BarChart, DonutChart, MetricCard, PanelCard } from "../../components/charts/PremiumCharts";
import { getDashboard, type DashboardResult } from "../../lib/api";

function roleLabel(roles: string[]) {
  if (roles.includes("TEACHER")) return "Teacher";
  if (roles.includes("ACCOUNTANT")) return "Accountant";
  if (roles.includes("INSTITUTION_ADMIN")) return "Institution Admin";
  return "Staff";
}

export function DashboardPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    getDashboard(accessToken)
      .then(setDashboard)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load dashboard");
      });
  }, [accessToken]);

  if (!user) return null;

  const stats = dashboard?.stats;
  const present = stats?.attendanceToday.present ?? 0;
  const absent = stats?.attendanceToday.absent ?? 0;
  const totalAttendance = stats?.attendanceToday.total ?? 0;
  const presentPct = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;

  const quickLinks = [
    { to: "/attendance", label: "Take attendance", hint: "Mark class presence" },
    { to: "/exams", label: "Add / edit results", hint: "Enter test and exam scores" },
    { to: "/homework", label: "Homework", hint: "Assign and review work" },
    { to: "/students", label: "Students", hint: "Profiles and enrollments" },
    { to: "/fees", label: "Fees", hint: "Collect and reconcile" },
    { to: "/notices", label: "Notices", hint: "Publish announcements" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <PageHeader
        eyebrow={`${roleLabel(user.roles)} homepage`}
        title={`Welcome back, ${user.firstName}`}
        description={
          user.tenant?.productMode === "CMS"
            ? "Operations workspace for fees, HR, certificates, and ERP."
            : user.tenant?.productMode === "LMS"
              ? "Teaching workspace for timetable, homework, and academics."
              : "Full CMS + LMS workspace for this institution."
        }
        action={
          dashboard?.currentSession ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current session</p>
              <p className="mt-1 font-semibold text-slate-900">{dashboard.currentSession.name}</p>
            </div>
          ) : undefined
        }
      />

      {error && (
        <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Students" value={stats?.students ?? "—"} tone="teal" icon="ST" />
        <MetricCard label="Staff Members" value={stats?.staff ?? "—"} tone="blue" icon="SF" />
        <MetricCard label="Class Sections" value={stats?.classSections ?? "—"} tone="violet" icon="CL" />
        <MetricCard label="Present Today" value={`${presentPct}%`} tone="green" icon="PR" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <PanelCard title="Today's attendance">
          {totalAttendance === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No attendance marked for today yet.</p>
          ) : (
            <DonutChart
              slices={[
                { label: "Present", value: present, color: "#14b8a6" },
                { label: "Absent", value: absent, color: "#f43f5e" },
              ]}
              centerValue={`${presentPct}%`}
              centerLabel="Present"
            />
          )}
        </PanelCard>

        <PanelCard title="Campus snapshot">
          <BarChart
            categories={["Students", "Staff", "Sections", "Homework", "Notices"]}
            series={[
              {
                label: "Count",
                color: "#3b82f6",
                values: [
                  stats?.students ?? 0,
                  stats?.staff ?? 0,
                  stats?.classSections ?? 0,
                  stats?.homeworkOpen ?? 0,
                  stats?.notices ?? 0,
                ],
              },
            ]}
          />
        </PanelCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PanelCard title="Quick actions">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 transition hover:border-teal-300 hover:shadow-md"
              >
                <p className="font-semibold text-slate-900">{link.label}</p>
                <p className="mt-1 text-sm text-slate-500">{link.hint}</p>
              </Link>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Access profile">
          <p className="text-sm text-slate-500">Signed in roles for this workspace</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                {role.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modules</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {(dashboard?.modules ?? []).join(" + ") || "—"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Homework due</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stats?.homeworkOpen ?? 0}</p>
            </div>
          </div>
        </PanelCard>
      </div>
    </main>
  );
}
