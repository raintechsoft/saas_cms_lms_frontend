import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";
import type { Leave, Payroll, Staff } from "./hr/types";

interface PayslipPayload {
  payroll: Payroll & {
    payrollMonth: string;
    staff: Staff;
    tenant?: { name: string; branding?: unknown };
  };
  attendance: Array<{
    attendanceDate: string;
    status: string;
    inTime: string | null;
    outTime: string | null;
  }>;
  leaves: Leave[];
}

const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

function countStatuses(records: PayslipPayload["attendance"]) {
  const counts = { present: 0, late: 0, absent: 0, halfDay: 0 };
  for (const row of records) {
    if (row.status === "PRESENT") counts.present += 1;
    else if (row.status === "LATE") counts.late += 1;
    else if (row.status === "ABSENT") counts.absent += 1;
    else if (row.status === "HALF_DAY") counts.halfDay += 1;
  }
  return counts;
}

export function PayslipPrintPage() {
  const { id } = useParams();
  const { accessToken, isAuthenticated, user } = useAuth();
  const [payload, setPayload] = useState<PayslipPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.tenant?.branding) return;
    applyBrandingToDocument(parseBranding(user.tenant.branding));
  }, [user?.tenant?.branding]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    apiRequest<PayslipPayload>(`/hr/payroll/${id}/payslip`, accessToken)
      .then(setPayload)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load payslip"),
      );
  }, [id, accessToken, isAuthenticated]);

  const attendanceSummary = useMemo(
    () => (payload ? countStatuses(payload.attendance) : null),
    [payload],
  );

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (error) return <p className="alert-error m-8">{error}</p>;
  if (!payload) return <p className="p-8 text-center text-slate-500">Preparing payslip…</p>;

  const { payroll, attendance, leaves } = payload;
  const staff = payroll.staff;
  const tenantName = payroll.tenant?.name ?? user?.tenant?.name ?? "School";
  const monthLabel = payroll.payrollMonth
    ? new Date(payroll.payrollMonth).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : "—";
  const earnings = (payroll.items ?? []).filter((item) => item.type === "EARNING");
  const deductions = (payroll.items ?? []).filter((item) => item.type === "DEDUCTION");

  return (
    <main className="min-h-screen bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-2xl justify-between">
        <Link className="button-secondary" to="/hr">
          Back to HR
        </Link>
        <button className="button-primary" type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <article className="mx-auto max-w-2xl overflow-hidden bg-white p-10 shadow-xl print:shadow-none">
        <header
          className="border-b-2 pb-6 text-center"
          style={{ borderColor: "var(--brand-primary, #4f46e5)" }}
        >
          <p
            className="text-sm font-bold uppercase tracking-[0.25em]"
            style={{ color: "var(--brand-primary, #4f46e5)" }}
          >
            {tenantName}
          </p>
          <h1 className="mt-3 text-2xl font-serif font-bold">Salary payslip</h1>
          <p className="mt-1 text-sm text-slate-500">{monthLabel}</p>
        </header>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employee</p>
            <p className="mt-1 font-medium">
              {staff.user.firstName} {staff.user.lastName}
            </p>
            <p className="text-sm text-slate-500">Emp. {staff.employeeNumber}</p>
            <p className="text-sm text-slate-500">{staff.designation?.name ?? "—"}</p>
            <p className="text-sm text-slate-500">{staff.department?.name ?? "—"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay status</p>
            <p className="mt-1 text-sm font-semibold">{payroll.status}</p>
            {payroll.academicSession ? (
              <p className="text-sm text-slate-500">{payroll.academicSession.name}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Earnings
            </div>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span>Basic salary</span>
              <span className="font-medium">
                {formatMoney(payroll.basicSalary ?? staff.basicSalary)}
              </span>
            </div>
            {earnings.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
                <span>{item.name}</span>
                <span className="font-medium">{formatMoney(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 font-semibold">
              <span>Gross</span>
              <span>{formatMoney(payroll.grossAmount)}</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Deductions
            </div>
            {deductions.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b px-4 py-3">
                <span>{item.name}</span>
                <span className="font-medium text-rose-600">−{formatMoney(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span>Attendance deduction</span>
              <span className="font-medium text-rose-600">
                −{formatMoney(payroll.attendanceDeduction)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3 font-semibold">
              <span>Net pay</span>
              <span className="text-emerald-700">{formatMoney(payroll.netAmount)}</span>
            </div>
          </div>
        </div>

        {attendanceSummary ? (
          <div className="mt-8 rounded-xl border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attendance summary ({attendance.length} days marked)
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
              <span>Present: {attendanceSummary.present}</span>
              <span>Late: {attendanceSummary.late}</span>
              <span>Absent: {attendanceSummary.absent}</span>
              <span>Half day: {attendanceSummary.halfDay}</span>
            </div>
            {leaves.length ? (
              <p className="mt-2 text-sm text-slate-600">
                Approved leave days this month: {leaves.length} request
                {leaves.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 border-t pt-6 text-center text-xs text-slate-400">
          Computer-generated payslip — no signature required.
        </div>
      </article>
    </main>
  );
}
