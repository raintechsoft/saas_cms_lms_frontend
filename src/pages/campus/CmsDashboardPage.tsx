import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CalendarMonthOutlined,
  ErrorOutlineRounded,
  FileDownloadOutlined,
  GroupsOutlined,
  InsightsOutlined,
  LocalFireDepartmentOutlined,
  MoreHorizOutlined,
  PersonAddAltOutlined,
  SearchOutlined,
  TrendingUpRounded,
  VerifiedOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CmsPage, CmsScrollBody } from "../../components/cms/CmsLayout";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { BarChart } from "../../components/charts/PremiumCharts";
import { apiRequest, getDashboard, type DashboardResult } from "../../lib/api";
import { notifyError, notifyInfo } from "../../lib/notify";

const INVOICES_PER_PAGE = 5;

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const formatCompactMoney = (value: number) => {
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return formatMoney(value);
};

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

function paymentGrade(payment: FeePayment) {
  const cs = payment.student.enrollments?.[0]?.classSection;
  if (!cs?.academicClass?.name) return "—";
  return `${cs.academicClass.name}${cs.section?.name ? ` ${cs.section.name}` : ""}`;
}

function paymentStatus(raw: string) {
  const status = raw?.toUpperCase() ?? "";
  if (status === "COLLECTED" || status.includes("PAID") || status === "SUCCESS") {
    return { label: "Paid", className: "nx-pill-success" };
  }
  if (status === "REVERTED" || status.includes("CANCEL")) {
    return { label: "Reverted", className: "nx-pill-neutral" };
  }
  if (status.includes("OVERDUE")) return { label: "Overdue", className: "nx-pill-danger" };
  return { label: "Pending", className: "nx-pill-warning" };
}

function formatTrendPct(value: number) {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return "0%";
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const text = String(cell ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  trend,
  trendTone = "up",
  trendSuffix,
}: {
  icon: QuickIcon;
  label: string;
  value: string | number;
  tint: string;
  trend?: string;
  trendTone?: "up" | "down";
  trendSuffix?: string;
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
            {trendSuffix ? <span className="font-medium">{trendSuffix}</span> : null}
          </span>
        ) : null}
      </div>
      <p className="ov-kpi-label">{label}</p>
      <p className="ov-kpi-value !mt-0.5">{value}</p>
    </article>
  );
}

export function CmsDashboardPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [attendanceAlerts, setAttendanceAlerts] = useState<AttendanceReport["records"]>([]);
  const [pendingAdmissions, setPendingAdmissions] = useState<OnlineAdmission[]>([]);
  const [bottomTab, setBottomTab] = useState<"invoices" | "logs" | "approvals">("invoices");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [invoicePage, setInvoicePage] = useState(1);

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
            .then((items) => setPayments(Array.isArray(items) ? items : []))
            .catch(() => setPayments([])),
        );

        const today = new Date().toISOString().slice(0, 10);
        jobs.push(
          apiRequest<AttendanceReport>(`/attendance/reports?fromDate=${today}&toDate=${today}`, accessToken)
            .then((report) => {
              const alerts = (report.records ?? []).filter((item) =>
                ["ABSENT", "LATE"].includes(item.status),
              );
              setAttendanceAlerts(alerts.slice(0, 3));
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
        notifyError(cause instanceof Error ? cause.message : "Unable to load dashboard");
      }
    })();
  }, [accessToken]);

  const stats = dashboard?.stats;
  const present = stats?.attendanceToday.present ?? 0;
  const absent = stats?.attendanceToday.absent ?? 0;
  const totalAttendance = stats?.attendanceToday.total ?? 0;
  const presentPct = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : 0;
  const absentPct = totalAttendance > 0 ? Math.round((absent / totalAttendance) * 100) : 0;

  const institution = user?.tenant?.name ?? "Institution";

  const collected = feeSummary?.totals.collected ?? 0;
  const outstanding = feeSummary?.totals.due ?? 0;
  const assigned = feeSummary?.totals.assigned ?? 0;
  const collectionTarget = assigned > 0 ? assigned : Math.max(collected + outstanding, 1);
  const collectionPct = Math.min(100, Math.round((collected / collectionTarget) * 100));
  const now = Date.now();
  const overdueDues = (feeSummary?.dues ?? []).filter(
    (item) => item.totals.balance > 0 && new Date(item.feeMaster.dueDate).getTime() < now,
  );
  const overdueImpact = overdueDues.reduce((sum, item) => sum + item.totals.balance, 0);
  const delinquentCount = overdueDues.length;

  const newEnrollments = pendingAdmissions.length + Math.max(0, Math.round((stats?.students ?? 0) * 0.04));

  const filteredPayments = useMemo(() => {
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((payment) => {
      const name = studentName(payment.student).toLowerCase();
      const id = (payment.receiptNumber || payment.id).toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [invoiceQuery, payments]);

  const invoicePageCount = Math.max(1, Math.ceil(filteredPayments.length / INVOICES_PER_PAGE));
  const safeInvoicePage = Math.min(invoicePage, invoicePageCount);
  const pagePayments = filteredPayments.slice(
    (safeInvoicePage - 1) * INVOICES_PER_PAGE,
    safeInvoicePage * INVOICES_PER_PAGE,
  );

  const growthValues =
    dashboard?.trends?.enrollmentByMonth?.length === 6
      ? dashboard.trends.enrollmentByMonth
      : [0, 0, 0, 0, 0, 0];
  const monthlyGrowth = growthValues[growthValues.length - 1] ?? 0;
  const growthPct =
    growthValues[0] > 0 ? Math.round(((monthlyGrowth - growthValues[0]) / growthValues[0]) * 100) : 0;

  const studentsTrend = dashboard?.trends?.studentsPct ?? 0;
  const collectionTrend = dashboard?.trends?.collectionPct ?? 0;
  const attendanceTrend = dashboard?.trends?.attendancePct ?? 0;
  const enrollmentTrend = growthPct;

  if (!user) return null;

  const adminName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : `${institution} Admin`;

  const exportInvoicesCsv = () => {
    if (!filteredPayments.length) {
      notifyInfo("No invoices to export.");
      return;
    }
    downloadCsv(
      "recent-invoices.csv",
      ["ID", "Student", "Grade", "Amount", "Paid On", "Status"],
      filteredPayments.map((payment) => [
        payment.receiptNumber || payment.id.slice(0, 8).toUpperCase(),
        studentName(payment.student),
        paymentGrade(payment),
        Number(payment.amount),
        formatDate(payment.paymentDate),
        paymentStatus(payment.status).label,
      ]),
    );
  };

  return (
    <CmsPage>
      <CmsScrollBody>
      <div className="ov-stack">

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[12px] font-semibold text-indigo-600">
                Admin Dashboard
              </span>
              <h1 className="mt-3 text-[24px] font-bold leading-8 tracking-tight text-slate-900">
                Welcome Back, {adminName}
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-5 text-slate-500">
                Institution management summary for the current academic session
                {dashboard?.currentSession?.name ? ` (${dashboard.currentSession.name})` : ""}. You have{" "}
                <span className="font-semibold text-slate-700">{delinquentCount}</span> pending fee approval
                {delinquentCount === 1 ? "" : "s"} and{" "}
                <span className="font-semibold text-slate-700">{attendanceAlerts.length}</span> urgent attendance
                alert{attendanceAlerts.length === 1 ? "" : "s"}.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to="/reports" className="nx-btn-primary">
                  Generate Monthly Report
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-transparent px-4 py-2 text-[14px] font-medium text-slate-900 transition hover:bg-slate-50"
                >
                  View Institution Settings
                </Link>
              </div>
            </div>
            <img
              src="/cms-dashboard-hero.webp"
              alt=""
              className="hidden h-[170px] w-[320px] shrink-0 rounded-lg object-cover lg:block"
            />
          </div>
        </section>

        <div className="ov-kpi-grid">
          <KpiCard
            icon={GroupsOutlined}
            label="Total Students"
            value={stats?.students?.toLocaleString() ?? "—"}
            tint="#6366f1"
            trend={formatTrendPct(studentsTrend)}
            trendTone={studentsTrend >= 0 ? "up" : "down"}
            trendSuffix=" vs LY"
          />
          <KpiCard
            icon={AccountBalanceWalletOutlined}
            label="Monthly Fees"
            value={feeSummary ? formatMoney(collected) : "—"}
            tint="#10b981"
            trend={formatTrendPct(collectionTrend)}
            trendTone={collectionTrend >= 0 ? "up" : "down"}
          />
          <KpiCard
            icon={CalendarMonthOutlined}
            label="Avg. Attendance"
            value={totalAttendance > 0 ? `${presentPct}%` : "—"}
            tint="#f59e0b"
            trend={formatTrendPct(attendanceTrend)}
            trendTone={attendanceTrend >= 0 ? "up" : "down"}
          />
          <KpiCard
            icon={TrendingUpRounded}
            label="New Enrollments"
            value={newEnrollments.toLocaleString()}
            tint="#3b82f6"
            trend={formatTrendPct(enrollmentTrend)}
            trendTone={enrollmentTrend >= 0 ? "up" : "down"}
            trendSuffix=" this month"
          />
        </div>

        <div className="ov-widgets">
          <section className="ov-widget">
            <div className="ov-widget-head">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">Due Fee Alerts</h2>
              <span className="grid size-7 place-items-center rounded-lg bg-rose-50 text-rose-500">
                <LocalFireDepartmentOutlined sx={{ fontSize: 16 }} />
              </span>
            </div>
            <div className="ov-widget-body">
              <Link
                to="/fees"
                className="block rounded-lg border border-rose-100 bg-rose-50/70 px-3.5 py-3 transition hover:border-rose-200"
              >
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-rose-600">
                  <ErrorOutlineRounded sx={{ fontSize: 15 }} />
                  Overdue Invoices
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  {delinquentCount > 0
                    ? `${delinquentCount} student${delinquentCount === 1 ? "" : "s"} overdue > 30 days. Impact: ${formatCompactMoney(overdueImpact)}.`
                    : "No overdue invoices right now."}
                </p>
              </Link>

              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-slate-500">Collection Progress</span>
                  <span className="font-bold text-slate-800">{collectionPct}%</span>
                </div>
                <div className="ov-progress">
                  <i style={{ width: `${collectionPct}%` }} />
                </div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-4 pt-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Collected</p>
                  <p className="mt-1 text-[18px] font-bold text-slate-900">
                    {feeSummary ? formatCompactMoney(collected) : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Outstanding</p>
                  <p className="mt-1 text-[18px] font-bold text-rose-500">
                    {feeSummary ? formatCompactMoney(outstanding) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="ov-widget">
            <div className="ov-widget-head">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">Attendance Summary</h2>
              <Link
                to="/attendance"
                className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-500"
                title="Open attendance"
              >
                <InsightsOutlined sx={{ fontSize: 16 }} />
              </Link>
            </div>

            <div className="ov-widget-body gap-2.5">
              {attendanceAlerts.length > 0 ? (
                attendanceAlerts.map((record) => {
                  const name = studentName(record.studentEnrollment.student);
                  const grade = `Grade ${record.studentEnrollment.classSection.academicClass.name}-${record.studentEnrollment.classSection.section.name}`;
                  const isAbsent = record.status === "ABSENT";
                  return (
                    <div key={record.id} className="ov-checkin">
                      <InitialsAvatar name={name} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">{name}</p>
                        <p className="truncate text-[11px] text-slate-400">{grade}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                          isAbsent ? "bg-rose-800" : "bg-sky-600"
                        }`}
                      >
                        {isAbsent ? "Absent" : "Late"}
                      </span>
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

              <div className="mt-auto grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 pt-3 text-center">
                <div>
                  <p className="text-[16px] font-bold text-slate-900">{presentPct}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Present</p>
                </div>
                <div>
                  <p className="text-[16px] font-bold text-slate-900">{absentPct}%</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Absent</p>
                </div>
              </div>
            </div>
          </section>

          <section className="ov-widget">
            <div className="ov-widget-head">
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-700">Growth Analytics</h2>
              <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-500">
                <TrendingUpRounded sx={{ fontSize: 16 }} />
              </span>
            </div>
            <div className="ov-widget-body justify-end">
              <BarChart
                categories={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
                series={[{ label: "Enrollments", color: "#6366f1", values: growthValues }]}
                height={190}
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
                  onChange={(event) => {
                    setInvoiceQuery(event.target.value);
                    setInvoicePage(1);
                  }}
                />
              </label>
              <button
                type="button"
                className="nx-btn-secondary !rounded-lg !px-3 !py-1.5 text-[12px]"
                onClick={exportInvoicesCsv}
              >
                <FileDownloadOutlined sx={{ fontSize: 15 }} />
                Export
              </button>
            </div>
          </div>

          {bottomTab === "invoices" ? (
            <>
              <div className="overflow-x-auto">
                <table className="nx-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Student</th>
                      <th>Grade</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagePayments.map((payment) => {
                      const status = paymentStatus(payment.status);
                      return (
                        <tr key={payment.id}>
                          <td>
                            <Link
                              to={`/print/fees/${payment.id}`}
                              className="font-mono text-[12px] font-semibold text-indigo-600 hover:underline"
                            >
                              {payment.receiptNumber || payment.id.slice(0, 8).toUpperCase()}
                            </Link>
                          </td>
                          <td className="font-medium text-slate-800">{studentName(payment.student)}</td>
                          <td className="text-slate-500">{paymentGrade(payment)}</td>
                          <td className="font-semibold text-slate-800">{formatMoney(Number(payment.amount))}</td>
                          <td>
                            <span className={`nx-pill ${status.className}`}>{status.label}</span>
                          </td>
                          <td className="text-right">
                            <Link
                              to={`/print/fees/${payment.id}`}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                              aria-label="Print receipt"
                              title="Print receipt"
                            >
                              <MoreHorizOutlined sx={{ fontSize: 18 }} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!pagePayments.length ? (
                  <p className="px-5 py-12 text-center text-sm text-slate-500">
                    No fee invoices recorded yet.{" "}
                    <Link to="/fees" className="font-semibold text-indigo-600 hover:underline">
                      Collect fees
                    </Link>
                  </p>
                ) : null}
              </div>
              {filteredPayments.length > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
                  <span>
                    Showing {pagePayments.length} of {filteredPayments.length} total invoices
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safeInvoicePage <= 1}
                      onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safeInvoicePage >= invoicePageCount}
                      onClick={() => setInvoicePage((page) => Math.min(invoicePageCount, page + 1))}
                    >
                      Next
                    </button>
                  </div>
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
                icon={<VerifiedOutlined sx={{ fontSize: 16 }} className="text-emerald-500" />}
                title="Session active"
                detail={
                  dashboard?.currentSession?.name
                    ? `Current session: ${dashboard.currentSession.name}`
                    : "No current academic session set"
                }
                time="Today"
              />
              <LogRow
                icon={<GroupsOutlined sx={{ fontSize: 16 }} className="text-sky-500" />}
                title="Campus snapshot"
                detail={`${stats?.students ?? 0} students · ${stats?.staff ?? 0} staff · ${stats?.classSections ?? 0} sections`}
                time="Live"
              />
              <LogRow
                icon={<AccountBalanceWalletOutlined sx={{ fontSize: 16 }} className="text-violet-500" />}
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
          <div className="flex flex-wrap items-center gap-4">
            <span>
              © {new Date().getFullYear()} {institution.toUpperCase()}
            </span>
            <span className="text-slate-400">Compliance</span>
            <span className="text-slate-400">Privacy</span>
            <span className="text-slate-400">Support</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
              <VerifiedOutlined sx={{ fontSize: 13 }} />
              GDPR Certified
            </span>
            <span className="text-slate-400">v2.4.1</span>
          </div>
        </footer>
      </div>
      </CmsScrollBody>
    </CmsPage>
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
