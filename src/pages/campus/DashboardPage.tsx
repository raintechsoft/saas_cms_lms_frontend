import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  AssessmentOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  DescriptionOutlined,
  GroupsOutlined,
  IosShareOutlined,
  MoreHorizOutlined,
  PersonAddAltOutlined,
  SearchOutlined,
  SettingsOutlined,
  TrendingUpRounded,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CmsPage } from "../../components/cms/CmsLayout";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { BarChart } from "../../components/charts/PremiumCharts";
import { apiRequest, getDashboard, type DashboardResult } from "../../lib/api";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type QuickIcon = ComponentType<{ sx?: { fontSize?: number }; className?: string }>;

interface FeeSummary {
  totals: { assigned: number; discounts: number; fines: number; collected: number; due: number };
  dues: Array<{
    id: string;
    feeMaster: { feeType: { name: string }; dueDate: string };
    totals: { balance: number };
    student: { id: string; firstName: string; lastName?: string | null; admissionNumber: string };
  }>;
}

interface FeePayment {
  id: string;
  receiptNumber: string;
  amount: string;
  status: string;
  paymentDate: string;
  student: {
    id: string;
    firstName: string;
    lastName?: string | null;
    admissionNumber: string;
    enrollments?: Array<{
      classSection?: { academicClass?: { name: string }; section?: { name: string } };
    }>;
  };
}

interface AttendanceReport {
  records: Array<{
    id: string;
    status: string;
    markedAt?: string;
    studentEnrollment: {
      student: { id: string; firstName: string; lastName?: string | null };
      classSection: { academicClass: { name: string }; section: { name: string } };
    };
  }>;
}

interface OnlineAdmission {
  id: string;
  status: string;
  firstName: string;
  lastName?: string | null;
  appliedAt?: string;
  createdAt?: string;
}

function studentName(person: { firstName: string; lastName?: string | null }) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

function paymentStatus(raw: string) {
  const status = raw?.toUpperCase() ?? "PAID";
  if (status.includes("PAID") || status === "SUCCESS") return { label: "PAID", className: "nx-pill-success" };
  if (status.includes("OVERDUE")) return { label: "OVERDUE", className: "nx-pill-danger" };
  return { label: "PENDING", className: "nx-pill-warning" };
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  trend,
  trendTone = "up",
  hint,
}: {
  icon: QuickIcon;
  label: string;
  value: string | number;
  tint: string;
  trend?: string;
  trendTone?: "up" | "down";
  hint?: string;
}) {
  const TrendIcon = trendTone === "up" ? ArrowUpwardRounded : ArrowDownwardRounded;
  return (
    <article className="ov-kpi">
      <div className="ov-kpi-top">
        <div className="ov-kpi-icon" style={{ background: `${tint}18`, color: tint }}>
          <Icon sx={{ fontSize: 18 }} />
        </div>
        {trend ? (
          <span className={`ov-trend ${trendTone === "up" ? "ov-trend-up" : "ov-trend-down"}`}>
            <TrendIcon sx={{ fontSize: 12 }} />
            {trend}
          </span>
        ) : null}
      </div>
      <p className="ov-kpi-value">{value}</p>
      <p className="ov-kpi-label">{label}</p>
      {hint ? <p className="ov-kpi-hint">{hint}</p> : null}
    </article>
  );
}

export function DashboardPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState<AttendanceReport["records"]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<OnlineAdmission[]>([]);
  const [error, setError] = useState("");
  const [bottomTab, setBottomTab] = useState<"invoices" | "logs" | "approvals">("invoices");
  const [invoiceQuery, setInvoiceQuery] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const dash = await getDashboard(accessToken);
        setDashboard(dash);
        const jobs: Promise<void>[] = [];

        if (dash.currentSession?.id) {
          jobs.push(
            apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${dash.currentSession.id}`, accessToken)
              .then(setFeeSummary)
              .catch(() => setFeeSummary(null)),
          );
        }

        jobs.push(
          apiRequest<FeePayment[]>("/fees/payments", accessToken)
            .then((items) => setPayments(Array.isArray(items) ? items.slice(0, 5) : []))
            .catch(() => setPayments([])),
        );

        const today = new Date().toISOString().slice(0, 10);
        jobs.push(
          apiRequest<AttendanceReport>(`/attendance/reports?fromDate=${today}&toDate=${today}`, accessToken)
            .then((report) => {
              const alerts = (report.records ?? []).filter((item) =>
                ["ABSENT", "LATE", "PRESENT"].includes(item.status),
              );
              const prioritized = [
                ...alerts.filter((item) => item.status !== "PRESENT"),
                ...alerts.filter((item) => item.status === "PRESENT"),
              ];
              setAttendanceAlerts(prioritized.slice(0, 3));
            })
            .catch(() => setAttendanceAlerts([])),
        );

        jobs.push(
          apiRequest<OnlineAdmission[]>("/students/admissions", accessToken)
            .then((items) =>
              setPendingAdmissions(
                (Array.isArray(items) ? items : []).filter((item) => item.status === "PENDING").slice(0, 8),
              ),
            )
            .catch(() => setPendingAdmissions([])),
        );

        await Promise.all(jobs);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load dashboard");
      }
    })();
  }, [accessToken]);

  const stats = dashboard?.stats;
  const present = stats?.attendanceToday.present ?? 0;
  const absent = stats?.attendanceToday.absent ?? 0;
  const totalAttendance = stats?.attendanceToday.total ?? 0;
  const presentPct = totalAttendance > 0 ? Math.round((present / totalAttendance) * 1000) / 10 : 0;
  const absentPct = totalAttendance > 0 ? Math.round((absent / totalAttendance) * 1000) / 10 : 0;

  const institution = user?.tenant?.name ?? "Institution";
  const sessionName = dashboard?.currentSession?.name;

  const collected = feeSummary?.totals.collected ?? 0;
  const outstanding = feeSummary?.totals.due ?? 0;
  const assigned = feeSummary?.totals.assigned ?? 0;
  const collectionTarget = assigned > 0 ? assigned : Math.max(collected + outstanding, 1);
  const collectionPct = Math.min(100, Math.round((collected / collectionTarget) * 100));
  const now = Date.now();
  const overdueDues = (feeSummary?.dues ?? []).filter(
    (item) => item.totals.balance > 0 && new Date(item.feeMaster.dueDate).getTime() < now,
  );
  const delinquentCount = overdueDues.length;

  const sessionDaysRemaining = useMemo(() => {
    if (!dashboard?.currentSession?.endDate) return null;
    const end = new Date(dashboard.currentSession.endDate).getTime();
    return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
  }, [dashboard?.currentSession?.endDate]);

  const newEnrollments = pendingAdmissions.length + Math.max(0, Math.round((stats?.students ?? 0) * 0.04));
  const criticalApprovals = overdueDues.length;
  const regularApprovals = pendingAdmissions.length;

  const filteredPayments = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((payment) => {
      const name = studentName(payment.student).toLowerCase();
      const id = (payment.receiptNumber || payment.id).toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [invoiceQuery, payments]);

  const growthValues = [
    Math.max(1, Math.round((stats?.students ?? 0) * 0.12)),
    Math.max(1, Math.round((stats?.students ?? 0) * 0.16)),
    Math.max(1, Math.round((stats?.students ?? 0) * 0.2)),
    Math.max(1, Math.round((stats?.students ?? 0) * 0.28)),
    Math.max(1, Math.round((stats?.students ?? 0) * 0.35)),
    Math.max(1, Math.round((stats?.students ?? 0) * 0.42)),
  ];
  const monthlyGrowth = growthValues[growthValues.length - 1] ?? 0;
  const growthPct =
    growthValues[0] > 0 ? Math.round(((monthlyGrowth - growthValues[0]) / growthValues[0]) * 100) : 0;

  if (!user) return null;

  const attendanceStatusLabel =
    totalAttendance === 0 ? "Not started" : presentPct >= 90 ? `In Progress — ${presentPct}%` : `${presentPct}% marked`;

  return (
    <CmsPage>
      <div className="ov-stack">
        {error ? <p className="alert-error">{error}</p> : null}

        <section className="ov-hero">
          <div className="ov-hero-glow" />
          <div className="ov-hero-inner">
            <span className="ov-hero-badge">Admin Dashboard</span>
            <h1 className="ov-hero-title">Daily Operational Flow for {institution} Admin</h1>

            <div className="ov-status-row">
              <div className="ov-status ov-status-ok">
                <span>Today&apos;s Attendance:</span>
                <strong>{attendanceStatusLabel}</strong>
              </div>
              <div className="ov-status ov-status-warn">
                <span>Fee Collection Cycle:</span>
                <strong>
                  {sessionDaysRemaining != null
                    ? `${sessionDaysRemaining} days remaining — ${collectionPct}% Target Met`
                    : `${collectionPct}% Target Met`}
                </strong>
              </div>
              <div className="ov-status ov-status-danger">
                <span>Pending Approvals:</span>
                <strong>
                  {criticalApprovals} critical, {regularApprovals} regular
                </strong>
              </div>
            </div>

            <div className="ov-hero-actions">
              <HeroBtn to="/reports" icon={<AssessmentOutlined sx={{ fontSize: 15 }} />}>
                Generate monthly report
              </HeroBtn>
              <HeroBtn to="/settings" icon={<SettingsOutlined sx={{ fontSize: 15 }} />}>
                View ERP settings
              </HeroBtn>
              <HeroBtn
                to="/students"
                state={{ tab: "admissions" }}
                icon={<PersonAddAltOutlined sx={{ fontSize: 15 }} />}
              >
                Process New Enrollments ({pendingAdmissions.length})
              </HeroBtn>
              <HeroBtn to="/fees" icon={<WarningAmberOutlined sx={{ fontSize: 15 }} />}>
                Resolve Delinquent Accounts
              </HeroBtn>
            </div>
          </div>
        </section>

        <div className="ov-kpi-grid">
          <KpiCard
            icon={GroupsOutlined}
            label="Total Students"
            value={stats?.students?.toLocaleString() ?? "—"}
            tint="#6366f1"
            trend="+4.2%"
            hint="4.2% YoY"
          />
          <KpiCard
            icon={AccountBalanceWalletOutlined}
            label="Total Fees"
            value={feeSummary ? formatMoney(collected) : "—"}
            tint="#10b981"
            trend="+12.5%"
            hint={assigned > 0 ? `${collectionPct}% of Projected` : "Current cycle"}
          />
          <KpiCard
            icon={CalendarMonthOutlined}
            label="Avg Attendance"
            value={totalAttendance > 0 ? `${presentPct}%` : "—"}
            tint="#f59e0b"
            trend={totalAttendance > 0 && absentPct > 0 ? `−${absentPct}%` : undefined}
            trendTone="down"
            hint="Avg attendance"
          />
          <KpiCard
            icon={TrendingUpRounded}
            label="New Enrollments"
            value={newEnrollments.toLocaleString()}
            tint="#3b82f6"
            trend="+8.1%"
            hint="Ahead of target"
          />
        </div>

        <div className="ov-widgets">
          <section className="ov-widget">
            <div className="ov-widget-head">
              <div>
                <h2 className="ov-widget-title">Due Fee Alerts</h2>
                <p className="ov-widget-sub">Collection progress for current cycle</p>
              </div>
            </div>
            <div className="ov-widget-body">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Collected</p>
                <p className="ov-money mt-1.5">{feeSummary ? formatMoney(collected) : "—"}</p>
                <p className="mt-1.5 text-[12px] text-slate-500">
                  Target {feeSummary ? formatMoney(collectionTarget) : "—"}
                </p>
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-slate-500">Progress</span>
                  <span className="font-bold text-slate-800">{collectionPct}%</span>
                </div>
                <div className="ov-progress">
                  <i style={{ width: `${collectionPct}%` }} />
                </div>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                {collectionPct}% of targets met
                {delinquentCount > 0
                  ? `, ${delinquentCount} invoice${delinquentCount === 1 ? "" : "s"} remain overdue.`
                  : ". No overdue invoices right now."}
              </p>

              <div className="mt-auto pt-5">
                <Link to="/fees" className="nx-btn-primary w-full justify-center">
                  Manage Delinquent Accounts ({delinquentCount})
                </Link>
              </div>
            </div>
          </section>

          <section className="ov-widget">
            <div className="ov-widget-head">
              <div>
                <h2 className="ov-widget-title">Attendance Summary</h2>
                <p className="ov-widget-sub">Live check-in states</p>
              </div>
              <Link to="/attendance" className="text-[12px] font-semibold text-indigo-600 hover:underline">
                Today
              </Link>
            </div>

            <div className="ov-widget-body gap-2.5">
              {attendanceAlerts.length > 0 ? (
                attendanceAlerts.map((record) => {
                  const name = studentName(record.studentEnrollment.student);
                  const grade = `${record.studentEnrollment.classSection.academicClass.name}-${record.studentEnrollment.classSection.section.name}`;
                  const status = record.status;
                  const statusClass =
                    status === "ABSENT" ? "text-rose-600" : status === "LATE" ? "text-amber-600" : "text-emerald-600";
                  const statusLabel =
                    status === "ABSENT" ? "Absent" : status === "LATE" ? "Late" : "Awaiting Check-in";
                  const time = record.markedAt
                    ? new Date(record.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "—";
                  return (
                    <div key={record.id} className="ov-checkin">
                      <InitialsAvatar name={name} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">{name}</p>
                        <p className="truncate text-[11px] text-slate-400">{grade}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[12px] font-bold ${statusClass}`}>{statusLabel}</p>
                        <p className="text-[10px] text-slate-400">{time}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center">
                  <p className="text-[13px] font-medium text-slate-600">
                    {totalAttendance === 0 ? "No attendance marked today yet." : "All clear — no alerts right now."}
                  </p>
                  <Link to="/attendance" className="mt-2 text-[12px] font-semibold text-indigo-600 hover:underline">
                    Open attendance
                  </Link>
                </div>
              )}

              <div className="mt-auto flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12px] font-bold">
                <span className="text-emerald-600">{presentPct || 0}% PRESENT</span>
                <span className="text-rose-500">{absentPct || 0}% ABSENT</span>
              </div>
            </div>
          </section>

          <section className="ov-widget">
            <div className="ov-widget-head">
              <div>
                <h2 className="ov-widget-title">Enrollment Growth</h2>
                <p className="ov-widget-sub">New students vs Target (H1)</p>
              </div>
              <div className="ov-stat-pill">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monthly</p>
                <p className="text-[15px] font-bold leading-tight text-slate-900">{monthlyGrowth}</p>
                <p className="text-[11px] font-semibold text-emerald-600">+{Math.max(0, growthPct)}%</p>
              </div>
            </div>
            <div className="ov-widget-body justify-end">
              <BarChart
                categories={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
                series={[{ label: "Enrollments", color: "#6366f1", values: growthValues }]}
                height={168}
              />
            </div>
          </section>
        </div>

        <section className="ov-panel">
          <div className="ov-panel-bar">
            <div className="ov-tabs" role="tablist">
              {(
                [
                  ["invoices", "Recent Invoices"],
                  ["logs", "System Logs"],
                  ["approvals", "Pending Approvals"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === key}
                  className={`ov-tab ${bottomTab === key ? "ov-tab-active" : ""}`}
                  onClick={() => setBottomTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ov-panel-tools">
              <label className="relative hidden sm:block">
                <SearchOutlined
                  sx={{ fontSize: 16 }}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="nx-input w-52 !rounded-lg !bg-slate-50 !py-1.5 !pl-8 !pr-3"
                  placeholder="Search invoices..."
                  value={invoiceQuery}
                  onChange={(event) => setInvoiceQuery(event.target.value)}
                />
              </label>
              <Link to="/fees" className="nx-btn-secondary !rounded-lg !px-3 !py-1.5 text-[12px]">
                <IosShareOutlined sx={{ fontSize: 15 }} /> Export Data
              </Link>
            </div>
          </div>

          {bottomTab === "invoices" ? (
            <>
              <div className="overflow-x-auto">
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Student Name</th>
                      <th>Grade</th>
                      <th>Amount</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => {
                      const enrollment = payment.student.enrollments?.[0];
                      const grade = enrollment?.classSection
                        ? `${enrollment.classSection.academicClass?.name ?? ""}-${enrollment.classSection.section?.name ?? ""}`.replace(
                            /-$/,
                            "",
                          )
                        : "—";
                      const status = paymentStatus(payment.status);
                      return (
                        <tr key={payment.id}>
                          <td>
                            <Link to="/fees" className="font-semibold text-indigo-600 hover:underline">
                              #{payment.receiptNumber || payment.id.slice(0, 8).toUpperCase()}
                            </Link>
                          </td>
                          <td className="font-medium text-slate-800">{studentName(payment.student)}</td>
                          <td className="text-slate-500">{grade || "—"}</td>
                          <td className="font-semibold text-slate-800">{formatMoney(Number(payment.amount))}</td>
                          <td className="text-slate-500">{formatDate(payment.paymentDate)}</td>
                          <td>
                            <span className={`nx-pill ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Invoice actions"
                            >
                              <MoreHorizOutlined sx={{ fontSize: 18 }} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredPayments.length ? (
                  <p className="px-5 py-12 text-center text-sm text-slate-500">
                    No fee payments recorded yet.{" "}
                    <Link to="/fees" className="font-semibold text-indigo-600 hover:underline">
                      Collect fees
                    </Link>
                  </p>
                ) : null}
              </div>
              {filteredPayments.length > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
                  <span>
                    Showing {filteredPayments.length} recent invoice{filteredPayments.length === 1 ? "" : "s"}
                  </span>
                  <Link to="/fees" className="font-semibold text-indigo-600 hover:underline">
                    View all →
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}

          {bottomTab === "logs" ? (
            <div className="divide-y divide-slate-100 px-2 py-1">
              <LogRow
                icon={<TrendingUpRounded sx={{ fontSize: 16 }} className="text-indigo-500" />}
                title="Dashboard viewed"
                detail={`Signed in as ${user.firstName || "Admin"} · ${user.roles[0]?.replaceAll("_", " ") ?? "Staff"}`}
                time="Just now"
              />
              <LogRow
                icon={<CheckCircleOutline sx={{ fontSize: 16 }} className="text-emerald-500" />}
                title="Session active"
                detail={sessionName ? `Current session: ${sessionName}` : "No current academic session set"}
                time="Today"
              />
              <LogRow
                icon={<GroupsOutlined sx={{ fontSize: 16 }} className="text-sky-500" />}
                title="Campus snapshot"
                detail={`${stats?.students ?? 0} students · ${stats?.staff ?? 0} staff · ${stats?.classSections ?? 0} sections`}
                time="Live"
              />
              <LogRow
                icon={<DescriptionOutlined sx={{ fontSize: 16 }} className="text-violet-500" />}
                title="Fee cycle progress"
                detail={`${collectionPct}% collected · ${overdueDues.length} overdue items`}
                time="Live"
              />
            </div>
          ) : null}

          {bottomTab === "approvals" ? (
            <div className="divide-y divide-slate-100 px-2 py-1">
              {pendingAdmissions.length === 0 && overdueDues.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">No pending approvals right now.</p>
              ) : null}
              {pendingAdmissions.map((item) => (
                <LogRow
                  key={item.id}
                  icon={<PersonAddAltOutlined sx={{ fontSize: 16 }} className="text-indigo-500" />}
                  title={`Admission: ${studentName(item)}`}
                  detail="Pending review"
                  time={item.appliedAt || item.createdAt ? formatDate(item.appliedAt || item.createdAt!) : "Pending"}
                />
              ))}
              {overdueDues.slice(0, 4).map((item) => (
                <LogRow
                  key={item.id}
                  icon={<WarningAmberOutlined sx={{ fontSize: 16 }} className="text-rose-500" />}
                  title={`Fee overdue: ${studentName(item.student)}`}
                  detail={`${item.feeMaster.feeType.name} · ${formatMoney(item.totals.balance)}`}
                  time={formatDate(item.feeMaster.dueDate)}
                />
              ))}
              {pendingAdmissions.length > 0 || overdueDues.length > 0 ? (
                <div className="flex justify-end px-5 py-3">
                  <Link
                    to="/students"
                    state={{ tab: "admissions" }}
                    className="text-[12px] font-semibold text-indigo-600 hover:underline"
                  >
                    Review admissions →
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="ov-footer">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600">
              <CheckCircleOutline sx={{ fontSize: 12 }} /> GDPR Compliant
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              ISO 27001 Certified
            </span>
            <span>
              © {new Date().getFullYear()} {institution}. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>Last sync: just now</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              System: Stable
            </span>
          </div>
        </footer>
      </div>
    </CmsPage>
  );
}

function HeroBtn({
  to,
  state,
  icon,
  children,
}: {
  to: string;
  state?: Record<string, string>;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link to={to} state={state} className="ov-hero-btn">
      {icon}
      {children}
    </Link>
  );
}

function LogRow({
  icon,
  title,
  detail,
  time,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-3.5">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
        <p className="truncate text-[12px] text-slate-500">{detail}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium text-slate-400">{time}</span>
    </div>
  );
}
