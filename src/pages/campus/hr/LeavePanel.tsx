import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  AttachFileOutlined,
  BeachAccessOutlined,
  CancelOutlined,
  CheckCircleOutlined,
  ChildFriendlyOutlined,
  CloseOutlined,
  DeleteOutline,
  GroupsOutlined,
  HealingOutlined,
  PendingActionsOutlined,
  PersonAddAltOutlined,
  ReplayOutlined,
  SaveOutlined,
  SearchOutlined,
  VisibilityOutlined,
  WorkHistoryOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import { staffName, type HrSetup, type Leave } from "./types";

const today = new Date().toISOString().slice(0, 10);

const STATUS_LABEL: Record<Leave["status"], string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function statusPill(status: Leave["status"]) {
  if (status === "APPROVED") return "nx-pill-success";
  if (status === "REJECTED") return "nx-pill-danger";
  return "nx-pill-warning";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LeavePanel({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [subTab, setSubTab] = useState<"approve" | "apply">("approve");

  return (
    <section className="mt-4">
      <div className="flex gap-1">
        {(
          [
            ["approve", "Approve Requests", <GroupsOutlined key="a" sx={{ fontSize: 16 }} />],
            ["apply", "Apply Leave", <PersonAddAltOutlined key="b" sx={{ fontSize: 16 }} />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 px-4 py-2.5 text-[13px] font-semibold transition ${
              subTab === key
                ? "border-slate-200 bg-white text-indigo-700"
                : "border-transparent bg-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setSubTab(key)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="nx-card rounded-tl-none p-4">
        {subTab === "approve" ? (
          <ApproveRequests
            setup={setup}
            token={token}
            onSaved={onSaved}
            onError={onError}
            onAddManually={() => setSubTab("apply")}
          />
        ) : (
          <ApplyLeave setup={setup} token={token} onSaved={onSaved} onError={onError} />
        )}
      </div>
    </section>
  );
}

function ApproveRequests({
  setup,
  token,
  onSaved,
  onError,
  onAddManually,
}: {
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onAddManually: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [roleId, setRoleId] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { status: Leave["status"]; note: string }>>(
    {},
  );
  const [savingId, setSavingId] = useState("");

  const leaves = setup.leaves ?? [];

  const stats = useMemo(() => {
    const pending = leaves.filter((leave) => leave.status === "PENDING").length;
    const approvedToday = leaves.filter(
      (leave) => leave.status === "APPROVED" && leave.reviewedAt?.slice(0, 10) === today,
    ).length;
    const rejectedToday = leaves.filter(
      (leave) => leave.status === "REJECTED" && leave.reviewedAt?.slice(0, 10) === today,
    ).length;
    return { pending, approvedToday, rejectedToday };
  }, [leaves]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leaves.filter((leave) => {
      if (statusFilter && leave.status !== statusFilter) return false;
      if (roleId && leave.staff.designation?.id !== roleId) return false;
      if (query && !staffName(leave.staff).toLowerCase().includes(query)) return false;
      return true;
    });
  }, [leaves, statusFilter, roleId, search]);

  function draftFor(leave: Leave) {
    return drafts[leave.id] ?? { status: leave.status, note: leave.reviewNote ?? "" };
  }

  async function saveReview(leave: Leave) {
    const draft = draftFor(leave);
    setSavingId(leave.id);
    try {
      await apiRequest(`/hr/leaves/${leave.id}/review`, token, {
        method: "PUT",
        body: JSON.stringify({
          status: draft.status,
          reviewNote: draft.note.trim() || null,
        }),
      });
      notifySuccess(`Leave marked ${STATUS_LABEL[draft.status].toLowerCase()}`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[leave.id];
        return next;
      });
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update leave");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-3">
        <StatCard
          tint="#f59e0b"
          icon={<PendingActionsOutlined sx={{ fontSize: 20 }} />}
          label="Pending Requests"
          value={stats.pending}
          hint="View all pending requests"
          onClick={() => setStatusFilter("PENDING")}
        />
        <StatCard
          tint="#10b981"
          icon={<CheckCircleOutlined sx={{ fontSize: 20 }} />}
          label="Approved Today"
          value={stats.approvedToday}
          hint="Requests approved today"
        />
        <StatCard
          tint="#f43f5e"
          icon={<CancelOutlined sx={{ fontSize: 20 }} />}
          label="Rejected Today"
          value={stats.rejectedToday}
          hint="Requests rejected today"
        />
        <div className="ml-auto flex items-center">
          <button type="button" className="nx-btn-primary" onClick={onAddManually}>
            <AddOutlined sx={{ fontSize: 16 }} /> Add Leave Manually
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3">
        <label className="block w-44">
          <span className="nx-label">Status</span>
          <select
            className="nx-input mt-1 w-full"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label className="block w-44">
          <span className="nx-label">Role</span>
          <select
            className="nx-input mt-1 w-full"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">All Roles</option>
            {setup.designations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="relative min-w-0 flex-1 basis-52">
          <SearchOutlined
            sx={{ fontSize: 16 }}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="nx-input w-full pl-9"
            placeholder="Search staff by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="nx-btn-secondary"
          onClick={() => {
            setStatusFilter("");
            setRoleId("");
            setSearch("");
          }}
        >
          <ReplayOutlined sx={{ fontSize: 15 }} /> Clear Filters
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="nx-table min-w-[1020px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 text-left">Staff Name</th>
              <th className="px-3 py-3 text-left">Leave Type</th>
              <th className="px-3 py-3 text-left">Leave Dates</th>
              <th className="px-3 py-3 text-left">Reason</th>
              <th className="px-3 py-3 text-left">Applied On</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="w-64 px-3 py-3 text-left">Actions &amp; Note</th>
              <th className="w-14 px-4 py-3 text-left"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((leave) => {
              const draft = draftFor(leave);
              return (
                <tr key={leave.id} className="align-top transition hover:bg-indigo-50/30">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar
                        name={staffName(leave.staff)}
                        photoUrl={leave.staff.photoUrl ?? leave.staff.user?.avatarUrl}
                        size={38}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {staffName(leave.staff)}
                        </p>
                        <p className="truncate text-[12px] text-slate-400">
                          {leave.staff.designation?.name ?? leave.staff.employeeNumber}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">{leave.leaveType.name}</td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {formatDate(leave.fromDate)} –<br />
                    {formatDate(leave.toDate)}
                  </td>
                  <td className="max-w-44 px-3 py-3.5 text-slate-600">
                    <span className="line-clamp-2">{leave.reason}</span>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">{formatDate(leave.createdAt)}</td>
                  <td className="px-3 py-3.5">
                    <span className={`nx-pill ${statusPill(leave.status)}`}>
                      {STATUS_LABEL[leave.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="nx-input w-full"
                      value={draft.status}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [leave.id]: {
                            ...draft,
                            status: e.target.value as Leave["status"],
                          },
                        })
                      }
                    >
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                    <input
                      className="nx-input mt-1.5 w-full"
                      placeholder="Add note..."
                      value={draft.note}
                      onChange={(e) =>
                        setDrafts({
                          ...drafts,
                          [leave.id]: { ...draft, note: e.target.value },
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="Save review"
                      className="grid size-9 place-items-center rounded-lg border border-indigo-200 text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                      disabled={savingId === leave.id}
                      onClick={() => void saveReview(leave)}
                    >
                      <SaveOutlined sx={{ fontSize: 17 }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            No leave requests match the current filters.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  tint,
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  tint: string;
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex min-w-56 items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:shadow-sm"
      style={{ background: `${tint}0d`, borderColor: `${tint}33` }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full text-white"
        style={{ background: tint }}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[12px] font-semibold text-slate-600">{label}</span>
        <span className="block text-[20px] font-bold leading-tight text-slate-900">
          {value}
        </span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
    </button>
  );
}

const LEAVE_TYPE_ICONS = [
  { icon: <BeachAccessOutlined sx={{ fontSize: 15 }} />, tint: "#6366f1" },
  { icon: <HealingOutlined sx={{ fontSize: 15 }} />, tint: "#10b981" },
  { icon: <WorkHistoryOutlined sx={{ fontSize: 15 }} />, tint: "#f59e0b" },
  { icon: <ChildFriendlyOutlined sx={{ fontSize: 15 }} />, tint: "#a855f7" },
];

const REQUEST_PAGE_SIZE = 8;

function leaveDays(leave: Leave) {
  const from = new Date(leave.fromDate).getTime();
  const to = new Date(leave.toDate).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

function ApplyLeave({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [form, setForm] = useState({ leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
  const [attachment, setAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Leave | null>(null);
  const [busy, setBusy] = useState(false);

  const member = setup.staff.find((item) => item.id === staffId);
  const myLeaves = useMemo(
    () => (setup.leaves ?? []).filter((leave) => leave.staff.id === staffId),
    [setup.leaves, staffId],
  );

  const year = new Date().getFullYear();
  const balance = useMemo(() => {
    const rows = setup.leaveTypes.map((type) => {
      const used = myLeaves
        .filter(
          (leave) =>
            leave.status === "APPROVED" &&
            leave.leaveType.id === type.id &&
            new Date(leave.fromDate).getFullYear() === year,
        )
        .reduce((sum, leave) => sum + leaveDays(leave), 0);
      return {
        id: type.id,
        name: type.name,
        allocated: type.annualLimit,
        used,
        remaining: type.annualLimit != null ? type.annualLimit - used : null,
      };
    });
    const totals = rows.reduce(
      (acc, row) => ({
        allocated: acc.allocated + (row.allocated ?? 0),
        used: acc.used + row.used,
        remaining: acc.remaining + (row.remaining ?? 0),
      }),
      { allocated: 0, used: 0, remaining: 0 },
    );
    return { rows, totals };
  }, [setup.leaveTypes, myLeaves, year]);

  const requests = useMemo(
    () => myLeaves.filter((leave) => !statusFilter || leave.status === statusFilter),
    [myLeaves, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(requests.length / REQUEST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = requests.slice(
    (safePage - 1) * REQUEST_PAGE_SIZE,
    safePage * REQUEST_PAGE_SIZE,
  );
  const showFrom = requests.length ? (safePage - 1) * REQUEST_PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safePage * REQUEST_PAGE_SIZE, requests.length);

  async function openDetails(leave: Leave) {
    setViewing(leave);
    try {
      // The list payload omits attachments to stay small; fetch the full record.
      setViewing(await apiRequest<Leave>(`/hr/leaves/${leave.id}`, token));
    } catch {
      // Keep showing the summary if the detail fetch fails.
    }
  }

  async function onPickAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onError("Attachment must be 5MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, dataUrl: String(reader.result) });
    reader.onerror = () => onError("Unable to read the selected file");
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!staffId) {
      onError("Select a staff member first");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/hr/leaves", token, {
        method: "POST",
        body: JSON.stringify({ staffId, ...form, attachment }),
      });
      setForm({ leaveTypeId: "", fromDate: "", toDate: "", reason: "" });
      setAttachment(null);
      notifySuccess("Leave request submitted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to apply leave");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-slate-100">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-[14px] font-bold text-slate-900">
              {member ? `${staffName(member)}'s leave balance` : "Leave balance"}
            </h3>
            {!member ? (
              <p className="text-[12px] text-slate-400">
                Select a staff member to see their balance.
              </p>
            ) : null}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 text-left">Leave Type</th>
                <th className="px-2 py-2.5 text-right">Allocated</th>
                <th className="px-2 py-2.5 text-right">Used</th>
                <th className="px-4 py-2.5 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {balance.rows.map((row, index) => {
                const deco = LEAVE_TYPE_ICONS[index % LEAVE_TYPE_ICONS.length];
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <span
                          className="grid size-6 shrink-0 place-items-center rounded-md"
                          style={{ background: `${deco.tint}1a`, color: deco.tint }}
                        >
                          {deco.icon}
                        </span>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-600">
                      {row.allocated != null ? row.allocated.toFixed(1) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right text-slate-600">
                      {member ? row.used.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                      {member && row.remaining != null ? row.remaining.toFixed(1) : "—"}
                    </td>
                  </tr>
                );
              })}
              {balance.rows.length ? (
                <tr className="border-t border-slate-200 font-bold text-slate-900">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-2 py-2.5 text-right">
                    {balance.totals.allocated.toFixed(1)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    {member ? balance.totals.used.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">
                    {member ? balance.totals.remaining.toFixed(1) : "—"}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No leave types configured — add them in HR &gt; Setup.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="rounded-xl border border-slate-100 p-4" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-slate-900">Apply for leave</h3>
            <button type="submit" className="nx-btn-primary" disabled={busy}>
              <AddOutlined sx={{ fontSize: 16 }} /> {busy ? "Applying…" : "Apply Leave"}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="nx-label">Staff Member *</span>
              <select
                className="nx-input mt-1 w-full"
                required
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Select staff</option>
                {setup.staff
                  .filter((item) => item.status === "ACTIVE")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {staffName(item)} · {item.employeeNumber}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="nx-label">Leave Type *</span>
              <select
                className="nx-input mt-1 w-full"
                required
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
              >
                <option value="">Select leave type</option>
                {setup.leaveTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="nx-label">From Date *</span>
              <input
                className="nx-input mt-1 w-full"
                type="date"
                required
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="nx-label">To Date *</span>
              <input
                className="nx-input mt-1 w-full"
                type="date"
                required
                value={form.toDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="nx-label">Reason *</span>
            <textarea
              className="nx-input mt-1 w-full"
              rows={3}
              required
              maxLength={500}
              placeholder="Enter reason for leave"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <span className="mt-0.5 block text-right text-[11px] text-slate-400">
              {form.reason.length} / 500
            </span>
          </label>
          <div>
            <span className="nx-label">Attach Document (optional)</span>
            {attachment ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-slate-600">
                  <AttachFileOutlined sx={{ fontSize: 15 }} className="shrink-0" />
                  <span className="truncate">{attachment.name}</span>
                </span>
                <button
                  type="button"
                  className="text-rose-500 hover:text-rose-600"
                  title="Remove attachment"
                  onClick={() => setAttachment(null)}
                >
                  <DeleteOutline sx={{ fontSize: 16 }} />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border-2 border-dashed border-slate-200 px-4 py-4 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600">
                  <AttachFileOutlined sx={{ fontSize: 15 }} /> Click to upload
                </span>
                <span className="text-[11.5px] text-slate-400">PDF, JPG, PNG up to 5MB</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => void onPickAttachment(e)}
                />
              </label>
            )}
          </div>
        </form>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-[14px] font-bold text-slate-900">
            {member ? `${staffName(member)}'s leave requests` : "Leave requests"}
          </h3>
          <select
            className="nx-input w-36 !py-1.5 text-[12.5px]"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Leave Type</th>
                <th className="px-3 py-3 text-left">Dates</th>
                <th className="px-3 py-3 text-left">Reason</th>
                <th className="px-3 py-3 text-left">Applied On</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Comments</th>
                <th className="w-14 px-4 py-3 text-left"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((leave) => (
                <tr key={leave.id} className="transition hover:bg-indigo-50/30">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {leave.leaveType.name}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatDate(leave.fromDate)}
                    {leave.fromDate !== leave.toDate ? ` – ${formatDate(leave.toDate)}` : ""}
                  </td>
                  <td className="max-w-52 px-3 py-3 text-slate-600">
                    <span className="line-clamp-1">{leave.reason}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{formatDate(leave.createdAt)}</td>
                  <td className="px-3 py-3">
                    <span className={`nx-pill ${statusPill(leave.status)}`}>
                      {STATUS_LABEL[leave.status]}
                    </span>
                  </td>
                  <td className="max-w-52 px-3 py-3 text-slate-500">
                    <span className="line-clamp-1">{leave.reviewNote ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="View details"
                      className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                      onClick={() => void openDetails(leave)}
                    >
                      <VisibilityOutlined sx={{ fontSize: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageItems.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              {member
                ? "No leave requests for this staff member."
                : "Select a staff member to view their leave requests."}
            </p>
          ) : null}
        </div>
        {requests.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              Showing {showFrom} to {showTo} of {requests.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Prev
              </button>
              <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-[12px] font-semibold text-white">
                {safePage}
              </span>
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-[16px] font-bold text-slate-900">Leave request details</h3>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setViewing(null)}
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  {viewing.leaveType.name} · {leaveDays(viewing)} day
                  {leaveDays(viewing) === 1 ? "" : "s"}
                </span>
                <span className={`nx-pill ${statusPill(viewing.status)}`}>
                  {STATUS_LABEL[viewing.status]}
                </span>
              </div>
              <p className="text-slate-600">
                {formatDate(viewing.fromDate)} – {formatDate(viewing.toDate)}
              </p>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Reason
                </p>
                <p className="mt-0.5 text-slate-700">{viewing.reason}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Reviewer comment
                </p>
                <p className="mt-0.5 text-slate-700">{viewing.reviewNote ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Attachment
                </p>
                {viewing.attachment ? (
                  <a
                    className="mt-0.5 inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:underline"
                    href={viewing.attachment.dataUrl}
                    download={viewing.attachment.name}
                  >
                    <AttachFileOutlined sx={{ fontSize: 15 }} /> {viewing.attachment.name}
                  </a>
                ) : (
                  <p className="mt-0.5 text-slate-500">No document attached.</p>
                )}
              </div>
              <p className="text-[12px] text-slate-400">
                Applied on {formatDate(viewing.createdAt)}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
