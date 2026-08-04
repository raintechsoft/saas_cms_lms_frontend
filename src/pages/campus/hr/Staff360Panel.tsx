import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AccountBalanceOutlined,
  AddOutlined,
  AttachFileOutlined,
  BlockOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutline,
  DescriptionOutlined,
  EditOutlined,
  EventBusyOutlined,
  PaymentsOutlined,
  TodayOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { openPrintPayslip } from "../../../lib/print";
import { notifySuccess } from "../../../lib/notify";
import {
  staffName,
  type HrSetup,
  type Leave,
  type Payroll,
  type Staff,
  type StaffAdjustment,
  type StaffDetail,
} from "./types";

type TabKey = "overview" | "attendance" | "leave" | "payroll" | "payparams" | "documents";

const TABS: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: "overview", label: "Overview", icon: <AccountBalanceOutlined sx={{ fontSize: 16 }} /> },
  { key: "attendance", label: "Attendance", icon: <TodayOutlined sx={{ fontSize: 16 }} /> },
  { key: "leave", label: "Leave", icon: <EventBusyOutlined sx={{ fontSize: 16 }} /> },
  { key: "payroll", label: "Payroll", icon: <PaymentsOutlined sx={{ fontSize: 16 }} /> },
  { key: "payparams", label: "Pay params", icon: <DescriptionOutlined sx={{ fontSize: 16 }} /> },
  { key: "documents", label: "Documents", icon: <AttachFileOutlined sx={{ fontSize: 16 }} /> },
];

function money(value: string | number) {
  return `₹${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-slate-700">{value}</dd>
    </div>
  );
}

export function Staff360Panel({
  staffId,
  setup,
  token,
  onClose,
  onSaved,
  onError,
  onEditProfile,
  onDisable,
}: {
  staffId: string;
  setup: HrSetup;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onEditProfile?: (member: Staff) => void;
  onDisable?: (member: Staff) => void;
}) {
  const [detail, setDetail] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("overview");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setDetail(await apiRequest<StaffDetail>(`/hr/staff/${staffId}`, token));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load staff details");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, token]);

  async function enableStaff() {
    setBusy(true);
    try {
      await apiRequest(`/hr/staff/${staffId}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      notifySuccess("Staff enabled");
      await onSaved();
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to enable staff");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff() {
    const ok = await confirmDelete({
      title: "Delete staff permanently?",
      text: "This removes the staff record and cannot be undone. Only allowed when disabled and no paid payroll exists.",
      confirmText: "Yes, delete",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiRequest(`/hr/staff/${staffId}`, token, { method: "DELETE" });
      notifySuccess("Staff deleted");
      await onSaved();
      onClose();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete staff");
    } finally {
      setBusy(false);
    }
  }

  const roles =
    detail?.user.roles?.map((entry) => entry.role.name).join(", ") ??
    detail?.designation?.name ??
    "—";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col bg-white shadow-2xl lg:my-4 lg:h-[calc(100%-2rem)] lg:rounded-xl lg:ring-1 lg:ring-slate-200">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          {loading || !detail ? (
            <p className="text-sm text-slate-500">Loading staff profile…</p>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <InitialsAvatar
                name={staffName(detail)}
                photoUrl={detail.photoUrl ?? detail.user.avatarUrl}
                size={56}
              />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">{staffName(detail)}</h2>
                <p className="text-[12.5px] text-slate-500">
                  {detail.employeeNumber} · {detail.department?.name ?? "No department"} · {roles}
                </p>
                <span
                  className={`mt-1 inline-flex nx-pill ${
                    detail.status === "ACTIVE" ? "nx-pill-success" : "nx-pill-danger"
                  }`}
                >
                  {detail.status === "ACTIVE" ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {detail && onEditProfile ? (
              <button
                type="button"
                className="nx-btn-secondary !py-1.5 text-[12.5px]"
                onClick={() => onEditProfile(detail)}
              >
                <EditOutlined sx={{ fontSize: 15 }} /> Edit profile
              </button>
            ) : null}
            {detail?.status === "ACTIVE" && onDisable ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-[12.5px] font-semibold text-rose-600 transition hover:bg-rose-50"
                disabled={busy}
                onClick={() => onDisable(detail)}
              >
                <BlockOutlined sx={{ fontSize: 15 }} /> Disable
              </button>
            ) : null}
            {detail?.status === "DISABLED" ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-600 transition hover:bg-emerald-50"
                  disabled={busy}
                  onClick={() => void enableStaff()}
                >
                  <CheckCircleOutlined sx={{ fontSize: 15 }} /> Enable
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-[12.5px] font-semibold text-rose-600 transition hover:bg-rose-50"
                  disabled={busy}
                  onClick={() => void deleteStaff()}
                >
                  <DeleteOutline sx={{ fontSize: 15 }} /> Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100"
              onClick={onClose}
            >
              <CloseOutlined sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 px-4">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[12.5px] font-semibold transition ${
                tab === item.key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setTab(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading || !detail ? (
            <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              {tab === "overview" ? <OverviewTab detail={detail} /> : null}
              {tab === "attendance" ? <AttendanceTab detail={detail} /> : null}
              {tab === "leave" ? <LeaveTab leaves={detail.leaves} /> : null}
              {tab === "payroll" ? <PayrollTab payrolls={detail.payrolls} /> : null}
              {tab === "payparams" ? (
                <PayParamsTab
                  detail={detail}
                  setup={setup}
                  token={token}
                  onSaved={async () => {
                    await onSaved();
                    await load();
                  }}
                  onError={onError}
                />
              ) : null}
              {tab === "documents" ? <DocumentsTab detail={detail} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ detail }: { detail: StaffDetail }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-[13px] font-bold text-slate-900">Personal</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Detail label="Email" value={detail.user.email} />
          <Detail label="Phone" value={detail.phone ?? detail.user.phone ?? "—"} />
          <Detail label="Gender" value={detail.gender ?? "—"} />
          <Detail label="Date of birth" value={formatDate(detail.dateOfBirth)} />
          <Detail label="Marital status" value={detail.maritalStatus ?? "—"} />
          <Detail label="Emergency contact" value={detail.emergencyContact ?? "—"} />
          <Detail label="Address" value={detail.address ?? "—"} />
          <Detail label="Permanent address" value={detail.permanentAddress ?? "—"} />
        </dl>
      </section>
      <section>
        <h3 className="text-[13px] font-bold text-slate-900">Employment</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Detail label="Joining date" value={formatDate(detail.joiningDate)} />
          <Detail label="Contract type" value={detail.contractType ?? "—"} />
          <Detail label="Work shift" value={detail.workShift ?? "—"} />
          <Detail label="Work location" value={detail.workLocation ?? "—"} />
          <Detail label="EPF number" value={detail.epfNumber ?? "—"} />
          <Detail label="Basic salary" value={money(detail.basicSalary)} />
        </dl>
      </section>
      <section>
        <h3 className="text-[13px] font-bold text-slate-900">Bank details</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <Detail label="Account title" value={detail.bankAccountTitle ?? "—"} />
          <Detail label="Account number" value={detail.bankAccountNumber ?? "—"} />
          <Detail label="Bank name" value={detail.bankName ?? "—"} />
          <Detail label="IFSC" value={detail.bankIfsc ?? "—"} />
          <Detail label="Branch" value={detail.bankBranch ?? "—"} />
        </dl>
      </section>
      {detail.status === "DISABLED" ? (
        <section className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
          <h3 className="text-[13px] font-bold text-rose-800">Leaving / disable info</h3>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Disabled reason" value={detail.disabledReason ?? "—"} />
            <Detail label="Leaving date" value={formatDate(detail.leavingDate)} />
            {detail.resignationLetter ? (
              <div className="sm:col-span-2">
                <Detail label="Resignation letter" value={detail.resignationLetter} />
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function AttendanceTab({ detail }: { detail: StaffDetail }) {
  const records = detail.attendance ?? [];
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="nx-table min-w-[640px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-3 py-3 text-left">In</th>
            <th className="px-3 py-3 text-left">Out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr key={record.attendanceDate}>
              <td className="px-4 py-2.5 text-[13px] text-slate-700">
                {formatDate(record.attendanceDate)}
              </td>
              <td className="px-3 py-2.5">
                <span className="nx-pill nx-pill-neutral">{record.status.replaceAll("_", " ")}</span>
              </td>
              <td className="px-3 py-2.5 text-[13px] text-slate-600">{record.inTime ?? "—"}</td>
              <td className="px-3 py-2.5 text-[13px] text-slate-600">{record.outTime ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!records.length ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No attendance records.</p>
      ) : null}
    </div>
  );
}

function LeaveTab({ leaves }: { leaves: Leave[] }) {
  const STATUS: Record<Leave["status"], string> = {
    PENDING: "nx-pill-warning",
    APPROVED: "nx-pill-success",
    REJECTED: "nx-pill-danger",
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="nx-table min-w-[720px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-3 py-3 text-left">From</th>
            <th className="px-3 py-3 text-left">To</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-3 py-3 text-left">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leaves.map((leave) => (
            <tr key={leave.id}>
              <td className="px-4 py-2.5 text-[13px] font-medium text-slate-700">
                {leave.leaveType.name}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-slate-600">
                {formatDate(leave.fromDate)}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-slate-600">{formatDate(leave.toDate)}</td>
              <td className="px-3 py-2.5">
                <span className={`nx-pill ${STATUS[leave.status]}`}>{leave.status}</span>
              </td>
              <td className="max-w-xs px-3 py-2.5 text-[13px] text-slate-600">
                <span className="line-clamp-2">{leave.reason}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!leaves.length ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No leave records.</p>
      ) : null}
    </div>
  );
}

function PayrollTab({ payrolls }: { payrolls: Payroll[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="nx-table min-w-[720px]">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3 text-left">Month</th>
            <th className="px-3 py-3 text-left">Gross</th>
            <th className="px-3 py-3 text-left">Deductions</th>
            <th className="px-3 py-3 text-left">Net pay</th>
            <th className="px-3 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payrolls.map((payroll) => (
            <tr key={payroll.id}>
              <td className="px-4 py-2.5 text-[13px] text-slate-700">
                {payroll.payrollMonth
                  ? new Date(payroll.payrollMonth).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </td>
              <td className="px-3 py-2.5 text-[13px] text-slate-600">{money(payroll.grossAmount)}</td>
              <td className="px-3 py-2.5 text-[13px] text-rose-600">
                −{money(payroll.attendanceDeduction)}
              </td>
              <td className="px-3 py-2.5 text-[13px] font-semibold text-emerald-600">
                {money(payroll.netAmount)}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`nx-pill ${
                    payroll.status === "PAID" ? "nx-pill-success" : "nx-pill-indigo"
                  }`}
                >
                  {payroll.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                {payroll.status === "GENERATED" || payroll.status === "PAID" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline"
                    onClick={() => openPrintPayslip(payroll.id)}
                  >
                    <VisibilityOutlined sx={{ fontSize: 14 }} /> Print payslip
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!payrolls.length ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No payroll history.</p>
      ) : null}
    </div>
  );
}

function PayParamsTab({
  detail,
  setup,
  token,
  onSaved,
  onError,
}: {
  detail: StaffDetail;
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [basicSalary, setBasicSalary] = useState(String(Number(detail.basicSalary)));
  const [absenceDeduction, setAbsenceDeduction] = useState(
    detail.absenceDeduction != null ? String(Number(detail.absenceDeduction)) : "",
  );
  const [leaveAllowance, setLeaveAllowance] = useState(
    detail.leaveAllowance != null ? String(detail.leaveAllowance) : "",
  );
  const [savingParams, setSavingParams] = useState(false);
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [editingAdj, setEditingAdj] = useState<StaffAdjustment | null>(null);

  async function saveParams(event: FormEvent) {
    event.preventDefault();
    setSavingParams(true);
    try {
      await apiRequest(`/hr/staff/${detail.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          basicSalary: Number(basicSalary) || 0,
          absenceDeduction:
            absenceDeduction.trim() === "" ? null : Number(absenceDeduction) || 0,
          leaveAllowance: leaveAllowance.trim() === "" ? null : Number(leaveAllowance) || 0,
        }),
      });
      notifySuccess("Pay parameters updated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update pay parameters");
    } finally {
      setSavingParams(false);
    }
  }

  async function deleteAdjustment(id: string) {
    const ok = await confirmDelete({
      title: "Remove adjustment?",
      text: "This pay adjustment will be removed from the staff profile.",
      confirmText: "Yes, remove",
    });
    if (!ok) return;
    try {
      await apiRequest(`/hr/adjustments/${id}`, token, { method: "DELETE" });
      notifySuccess("Adjustment removed");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to remove adjustment");
    }
  }

  return (
    <div className="space-y-5">
      <form className="nx-card p-4" onSubmit={saveParams}>
        <h3 className="text-[13px] font-bold text-slate-900">Salary &amp; deductions</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="nx-label">Basic salary (monthly)</span>
            <input
              className="nx-input mt-1 w-full"
              type="number"
              min="0"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="nx-label">Absence deduction (per day)</span>
            <input
              className="nx-input mt-1 w-full"
              type="number"
              min="0"
              placeholder="Blank = salary ÷ 30"
              value={absenceDeduction}
              onChange={(e) => setAbsenceDeduction(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="nx-label">Leave allowance (days/year)</span>
            <input
              className="nx-input mt-1 w-full"
              type="number"
              min="0"
              value={leaveAllowance}
              onChange={(e) => setLeaveAllowance(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" className="nx-btn-primary" disabled={savingParams}>
            {savingParams ? "Saving…" : "Save parameters"}
          </button>
        </div>
      </form>

      <div className="nx-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-[13px] font-bold text-slate-900">Pay adjustments</h3>
          <button
            type="button"
            className="nx-btn-secondary !py-1.5 text-[12px]"
            onClick={() => {
              setEditingAdj(null);
              setShowAddAdj(true);
            }}
          >
            <AddOutlined sx={{ fontSize: 14 }} /> Add adjustment
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.adjustments.map((adj) => (
                <tr key={adj.id}>
                  <td className="px-4 py-2.5 text-[13px] font-medium text-slate-700">{adj.name}</td>
                  <td className="px-3 py-2.5 text-[13px] text-slate-600">{adj.type}</td>
                  <td
                    className={`px-3 py-2.5 text-[13px] font-medium ${
                      adj.type === "DEDUCTION" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {adj.type === "DEDUCTION" ? "−" : "+"}
                    {money(adj.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="mr-2 text-[12px] font-semibold text-indigo-600 hover:underline"
                      onClick={() => {
                        setShowAddAdj(false);
                        setEditingAdj(adj);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-rose-600 hover:underline"
                      onClick={() => void deleteAdjustment(adj.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!detail.adjustments.length ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No adjustments yet.</p>
          ) : null}
        </div>
      </div>

      {showAddAdj || editingAdj ? (
        <AdjustmentForm
          staffId={detail.id}
          setup={setup}
          token={token}
          editing={editingAdj}
          onClose={() => {
            setShowAddAdj(false);
            setEditingAdj(null);
          }}
          onSaved={async () => {
            setShowAddAdj(false);
            setEditingAdj(null);
            await onSaved();
          }}
          onError={onError}
        />
      ) : null}
    </div>
  );
}

function AdjustmentForm({
  staffId,
  setup,
  token,
  editing,
  onClose,
  onSaved,
  onError,
}: {
  staffId: string;
  setup: HrSetup;
  token: string;
  editing: StaffAdjustment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [presetId, setPresetId] = useState("");
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<"EARNING" | "DEDUCTION">(editing?.type ?? "EARNING");
  const [amount, setAmount] = useState(editing ? String(Number(editing.amount)) : "");
  const [busy, setBusy] = useState(false);

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = setup.payParameters.find((item) => item.id === id);
    if (!preset) return;
    setName(preset.name);
    setType(preset.type);
    setAmount(String(Number(preset.defaultAmount)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = { name: name.trim(), type, amount: Number(amount) || 0 };
      if (editing) {
        await apiRequest(`/hr/adjustments/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Adjustment updated");
      } else {
        await apiRequest(`/hr/staff/${staffId}/adjustments`, token, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Adjustment added");
      }
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save adjustment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-bold text-slate-900">
            {editing ? "Edit adjustment" : "Add adjustment"}
          </h3>
          <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
        <form className="space-y-3 px-5 py-4" onSubmit={submit}>
          {!editing && setup.payParameters.length ? (
            <label className="block">
              <span className="nx-label">Preset from setup</span>
              <select
                className="nx-input mt-1 w-full"
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">Custom…</option>
                {setup.payParameters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.type}) — {money(item.defaultAmount)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="nx-label">Name</span>
            <input
              className="nx-input mt-1 w-full"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="nx-label">Type</span>
              <select
                className="nx-input mt-1 w-full"
                value={type}
                onChange={(e) => setType(e.target.value as "EARNING" | "DEDUCTION")}
              >
                <option value="EARNING">Earning</option>
                <option value="DEDUCTION">Deduction</option>
              </select>
            </label>
            <label className="block">
              <span className="nx-label">Amount</span>
              <input
                className="nx-input mt-1 w-full"
                type="number"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="nx-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="nx-btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentsTab({ detail }: { detail: StaffDetail }) {
  const docs = detail.documents ?? [];
  if (!docs.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-center">
        <AttachFileOutlined sx={{ fontSize: 40 }} className="text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">No documents on file</p>
        <p className="mt-1 text-[12.5px] text-slate-400">
          Upload documents when editing the staff profile.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
      {docs.map((doc) => (
        <li key={`${doc.label}-${doc.name}`} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-slate-900">{doc.label}</p>
            <p className="text-[12px] text-slate-500">{doc.name}</p>
          </div>
          <a
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 hover:underline"
            href={doc.dataUrl}
            download={doc.name}
          >
            <AttachFileOutlined sx={{ fontSize: 14 }} /> Download
          </a>
        </li>
      ))}
    </ul>
  );
}
