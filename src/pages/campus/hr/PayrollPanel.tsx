import { useMemo, useState } from "react";
import {
  CloseOutlined,
  DescriptionOutlined,
  MoreVertOutlined,
  PaymentsOutlined,
  ReplayOutlined,
  SearchOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { openPrintPayslip } from "../../../lib/print";
import { notifyError, notifySuccess } from "../../../lib/notify";
import { staffName, type HrSetup, type Payroll, type Staff } from "./types";

const PAGE_SIZE = 8;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type PayrollStatus = "NOT_GENERATED" | "GENERATED" | "PAID";

const STATUS_META: Record<PayrollStatus, { label: string; pill: string }> = {
  NOT_GENERATED: { label: "Not Generated", pill: "nx-pill-neutral" },
  GENERATED: { label: "Generated", pill: "nx-pill-indigo" },
  PAID: { label: "Paid", pill: "nx-pill-success" },
};

function money(value: string | number) {
  return `₹${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function PayrollPanel({
  setup,
  month,
  onMonthChange,
  token,
  onSaved,
  onError,
}: {
  setup: HrSetup;
  month: string;
  onMonthChange: (next: string) => void;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [payslip, setPayslip] = useState<{ payroll: Payroll; member: Staff } | null>(null);

  const monthYear = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i);

  const payrollByStaff = useMemo(() => {
    const map = new Map<string, Payroll>();
    for (const payroll of setup.payrolls) map.set(payroll.staff.id, payroll);
    return map;
  }, [setup.payrolls]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return setup.staff
      .filter((member) => member.status === "ACTIVE")
      .filter((member) => !roleFilter || member.designation?.id === roleFilter)
      .filter(
        (member) =>
          !query ||
          staffName(member).toLowerCase().includes(query) ||
          member.employeeNumber.toLowerCase().includes(query),
      )
      .map((member) => ({
        member,
        payroll: payrollByStaff.get(member.id) ?? null,
        status: (payrollByStaff.get(member.id)?.status ?? "NOT_GENERATED") as PayrollStatus,
      }));
  }, [setup.staff, roleFilter, search, payrollByStaff]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFrom = rows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safePage * PAGE_SIZE, rows.length);

  const pageIds = pageRows.map((row) => row.member.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function setMonthPart(part: "month" | "year", value: number) {
    const y = part === "year" ? value : monthYear;
    const m = part === "month" ? value : monthIndex;
    onMonthChange(`${y}-${String(m + 1).padStart(2, "0")}`);
  }

  async function generate(staffIds: string[]) {
    if (!setup.currentSession) {
      onError("Payroll requires an active academic session");
      return;
    }
    try {
      await apiRequest("/hr/payroll", token, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: setup.currentSession.id,
          payrollMonth: `${month}-01`,
          staffIds,
        }),
      });
      notifySuccess(
        staffIds.length === 1
          ? "Payroll generated"
          : `Payroll generated for ${staffIds.length} staff`,
      );
      setSelected([]);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate payroll");
    }
  }

  async function bulkGenerate() {
    if (!selected.length) {
      notifyError("Select at least one staff member first");
      return;
    }
    const eligible = selected.filter(
      (id) => (payrollByStaff.get(id)?.status ?? "NOT_GENERATED") !== "PAID",
    );
    if (!eligible.length) {
      notifyError("Selected staff are already paid for this month");
      return;
    }
    setBulkBusy(true);
    await generate(eligible);
    setBulkBusy(false);
  }

  async function pay(payrollId: string) {
    setBusyId(payrollId);
    try {
      await apiRequest(`/hr/payroll/${payrollId}/pay`, token, {
        method: "PUT",
        body: JSON.stringify({ paymentMode: "BANK_TRANSFER" }),
      });
      notifySuccess("Payroll marked as paid");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to pay payroll");
    } finally {
      setBusyId(null);
    }
  }

  async function revert(payrollId: string, status: PayrollStatus) {
    setBusyId(payrollId);
    try {
      await apiRequest(`/hr/payroll/${payrollId}/revert`, token, { method: "PUT" });
      notifySuccess(
        status === "PAID" ? "Payment reverted to Generated" : "Payroll reverted to Not Generated",
      );
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to revert payroll");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="nx-card flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="nx-label">Role</span>
            <select
              className="nx-input mt-1 w-40"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              {setup.designations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Month</span>
            <select
              className="nx-input mt-1 w-36"
              value={monthIndex}
              onChange={(e) => setMonthPart("month", Number(e.target.value))}
            >
              {MONTHS.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Year</span>
            <select
              className="nx-input mt-1 w-28"
              value={monthYear}
              onChange={(e) => setMonthPart("year", Number(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <div className="relative">
            <SearchOutlined
              sx={{ fontSize: 17 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input w-72 pl-9"
              placeholder="Search staff by name or ID…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => {
              setRoleFilter("");
              setSearch("");
              setPage(1);
            }}
          >
            <ReplayOutlined sx={{ fontSize: 16 }} /> Clear Filters
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            disabled={bulkBusy || !setup.currentSession}
            onClick={() => void bulkGenerate()}
          >
            <DescriptionOutlined sx={{ fontSize: 16 }} />
            {bulkBusy ? "Generating…" : "Generate Payroll for Selected"}
          </button>
        </div>
      </div>
      {!setup.currentSession ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
          Payroll requires an active academic session. Set a current session first.
        </p>
      ) : null}

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[940px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-indigo-600"
                    checked={allPageSelected}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? Array.from(new Set([...current, ...pageIds]))
                          : current.filter((id) => !pageIds.includes(id)),
                      )
                    }
                  />
                </th>
                <th className="px-3 py-3 text-left">Staff Name</th>
                <th className="px-3 py-3 text-left">Staff ID</th>
                <th className="px-3 py-3 text-left">Role</th>
                <th className="px-3 py-3 text-left">Department</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map(({ member, payroll, status }) => (
                <tr key={member.id} className="transition hover:bg-indigo-50/30">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-indigo-600"
                      checked={selected.includes(member.id)}
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={staffName(member)}
                        photoUrl={member.photoUrl ?? member.user.avatarUrl}
                        size={34}
                      />
                      <p className="truncate font-semibold text-slate-900">{staffName(member)}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-600">
                    {member.employeeNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{member.designation?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-600">{member.department?.name ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`nx-pill ${STATUS_META[status].pill}`}>
                      {STATUS_META[status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {status === "NOT_GENERATED" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-[12px] font-semibold text-indigo-600 transition hover:bg-indigo-50"
                          disabled={busyId === member.id}
                          onClick={() => void generate([member.id])}
                        >
                          <DescriptionOutlined sx={{ fontSize: 14 }} /> Generate Payroll
                        </button>
                      ) : null}
                      {status === "GENERATED" && payroll ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-[12px] font-semibold text-indigo-600 transition hover:bg-indigo-50"
                            disabled={busyId === payroll.id}
                            onClick={() => void pay(payroll.id)}
                          >
                            <PaymentsOutlined sx={{ fontSize: 14 }} /> Proceed to Pay
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
                            onClick={() => openPrintPayslip(payroll.id)}
                          >
                            <DescriptionOutlined sx={{ fontSize: 14 }} /> Print payslip
                          </button>
                        </>
                      ) : null}
                      {status === "PAID" && payroll ? (
                        <>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
                            onClick={() => setPayslip({ payroll, member })}
                          >
                            <VisibilityOutlined sx={{ fontSize: 14 }} /> View Payslip
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-[12px] font-semibold text-indigo-600 transition hover:bg-indigo-50"
                            onClick={() => openPrintPayslip(payroll.id)}
                          >
                            <DescriptionOutlined sx={{ fontSize: 14 }} /> Print payslip
                          </button>
                        </>
                      ) : null}
                      {payroll ? (
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                          disabled={busyId === payroll.id}
                          onClick={() => void revert(payroll.id, status)}
                        >
                          Revert
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title={payroll ? "View payslip" : "Payroll not generated yet"}
                        className="ml-auto grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-40"
                        disabled={!payroll}
                        onClick={() => payroll && setPayslip({ payroll, member })}
                      >
                        <MoreVertOutlined sx={{ fontSize: 17 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageRows.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No staff match the current filters.
            </p>
          ) : null}
        </div>
        {rows.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              Showing {showFrom} to {showTo} of {rows.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold transition ${
                    num === safePage
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {payslip ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">Payslip</h3>
                <p className="text-[12px] text-slate-500">
                  {staffName(payslip.member)} · {payslip.member.employeeNumber} ·{" "}
                  {MONTHS[monthIndex]} {monthYear}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setPayslip(null)}
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="px-5 py-4 text-[13px]">
              <dl className="space-y-2">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Basic Salary</dt>
                  <dd className="font-medium text-slate-900">
                    {money(payslip.payroll.basicSalary ?? payslip.member.basicSalary)}
                  </dd>
                </div>
                {(payslip.payroll.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <dt className="text-slate-500">{item.name}</dt>
                    <dd
                      className={`font-medium ${
                        item.type === "DEDUCTION" ? "text-rose-600" : "text-slate-900"
                      }`}
                    >
                      {item.type === "DEDUCTION" ? "−" : "+"}
                      {money(item.amount)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Attendance Deduction</dt>
                  <dd className="font-medium text-rose-600">
                    −{money(payslip.payroll.attendanceDeduction)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <dt className="text-slate-500">Gross Amount</dt>
                  <dd className="font-semibold text-slate-900">
                    {money(payslip.payroll.grossAmount)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-semibold text-slate-900">Net Pay</dt>
                  <dd className="text-[15px] font-bold text-emerald-600">
                    {money(payslip.payroll.netAmount)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                <span className={`nx-pill ${STATUS_META[payslip.payroll.status].pill}`}>
                  {STATUS_META[payslip.payroll.status].label}
                </span>
                <span>
                  {payslip.payroll.status === "PAID" ? "Paid via bank transfer" : "Awaiting payment"}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
