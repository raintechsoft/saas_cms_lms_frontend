import { useEffect, useState, type ComponentType } from "react";
import {
  AssignmentOutlined,
  CampaignOutlined,
  EventNoteOutlined,
  PaymentsOutlined,
  QuizOutlined,
  SchoolOutlined,
} from "@mui/icons-material";
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

const QUICK_ICON_SX = { fontSize: 28 };

type QuickIcon = ComponentType<{ sx?: { fontSize?: number }; className?: string }>;

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

  const quickLinks: { to: string; label: string; Icon: QuickIcon }[] = [
    { to: "/attendance", label: "Attendance", Icon: EventNoteOutlined },
    { to: "/exams", label: "Exams", Icon: QuizOutlined },
    { to: "/homework", label: "Homework", Icon: AssignmentOutlined },
    { to: "/students", label: "Students", Icon: SchoolOutlined },
    { to: "/fees", label: "Fees", Icon: PaymentsOutlined },
    { to: "/notices", label: "Notices", Icon: CampaignOutlined },
  ];

  return (
    <main className="page-main">
      <PageHeader
        eyebrow={roleLabel(user.roles)}
        title="Dashboard"
        description={`Signed in as ${user.firstName} ${user.lastName ?? ""}`.trim()}
        action={
          dashboard?.currentSession ? (
            <div className="rounded border border-slate-200 bg-white px-3 py-1.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Session</p>
              <p className="text-[13px] font-semibold text-slate-900">{dashboard.currentSession.name}</p>
            </div>
          ) : undefined
        }
      />

      {error && (
        <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Students" value={stats?.students ?? "—"} tone="blue" icon="ST" />
        <MetricCard label="Staff Members" value={stats?.staff ?? "—"} tone="blue" icon="SF" />
        <MetricCard label="Class Sections" value={stats?.classSections ?? "—"} tone="violet" icon="CL" />
        <MetricCard label="Present Today" value={`${presentPct}%`} tone="green" icon="PR" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <PanelCard title="Today's attendance">
          {totalAttendance === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No attendance marked for today yet.</p>
          ) : (
            <DonutChart
              slices={[
                { label: "Present", value: present, color: "#2563eb" },
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
                color: "#2563eb",
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

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <PanelCard title="Quick actions">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickLinks.map(({ to, label, Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex min-h-14 items-center gap-2.5 rounded border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-800 transition hover:border-blue-400 hover:bg-blue-50"
              >
                <Icon sx={QUICK_ICON_SX} className="shrink-0 text-blue-600" />
                {label}
              </Link>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Access">
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((role) => (
              <span
                key={role}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-white"
              >
                {role.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Modules</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {(dashboard?.modules ?? []).join(" + ") || "—"}
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Homework due</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">{stats?.homeworkOpen ?? 0}</p>
            </div>
          </div>
        </PanelCard>
      </div>
    </main>
  );
}
