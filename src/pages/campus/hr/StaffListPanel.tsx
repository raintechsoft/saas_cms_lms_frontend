import { useMemo, useState, useEffect, type FormEvent, type ReactNode } from "react";
import {
  BlockOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutline,
  EditOutlined,
  FormatListBulletedOutlined,
  GridViewOutlined,
  MoreVertOutlined,
  SearchOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import { DisableStaffModal } from "./DisableStaffModal";
import { staffName, type HrSetup, type Staff } from "./types";

const PAGE_SIZE = 8;
const today = new Date().toISOString().slice(0, 10);

interface StaffForm {
  userId: string;
  employeeNumber: string;
  departmentId: string;
  designationId: string;
  joiningDate: string;
  phone: string;
  basicSalary: string;
}

const emptyForm: StaffForm = {
  userId: "",
  employeeNumber: "",
  departmentId: "",
  designationId: "",
  joiningDate: today,
  phone: "",
  basicSalary: "0",
};

export function StaffListPanel({
  setup,
  token,
  onSaved,
  onError,
  onViewStaff,
  pendingEdit,
  onPendingEditHandled,
}: {
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onViewStaff: (id: string) => void;
  pendingEdit?: Staff | null;
  onPendingEditHandled?: () => void;
}) {
  const [view, setView] = useState<"card" | "list">("list");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [menuFor, setMenuFor] = useState("");
  const [disabling, setDisabling] = useState<Staff | null>(null);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pendingEdit) {
      openEdit(pendingEdit);
      onPendingEditHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEdit]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return setup.staff.filter((member) => {
      if (member.status !== statusFilter) return false;
      if (roleId && member.designation?.id !== roleId) return false;
      if (departmentId && member.department?.id !== departmentId) return false;
      if (!query) return true;
      const haystack = [
        staffName(member),
        member.user.email,
        member.employeeNumber,
        member.phone ?? member.user.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [setup.staff, statusFilter, roleId, departmentId, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

  async function enableStaff(member: Staff) {
    try {
      await apiRequest(`/hr/staff/${member.id}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      notifySuccess("Staff enabled");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to enable staff");
    }
  }

  async function deleteStaff(member: Staff) {
    const ok = await confirmDelete({
      title: "Delete staff permanently?",
      text: `${staffName(member)} will be removed. This fails if they have paid payroll history.`,
      confirmText: "Yes, delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/hr/staff/${member.id}`, token, { method: "DELETE" });
      notifySuccess("Staff deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete staff");
    }
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      await apiRequest(`/hr/staff/${editing.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          employeeNumber: form.employeeNumber.trim() || undefined,
          departmentId: form.departmentId || null,
          designationId: form.designationId || null,
          joiningDate: form.joiningDate,
          phone: form.phone.trim() || null,
          basicSalary: Number(form.basicSalary) || 0,
        }),
      });
      notifySuccess("Staff profile updated");
      setEditing(null);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update staff");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(member: Staff) {
    setForm({
      userId: member.user.id,
      employeeNumber: member.employeeNumber,
      departmentId: member.department?.id ?? "",
      designationId: member.designation?.id ?? "",
      joiningDate: member.joiningDate?.slice(0, 10) ?? today,
      phone: member.phone ?? member.user.phone ?? "",
      basicSalary: String(Number(member.basicSalary)),
    });
    setEditing(member);
  }

  function actionButtons(member: Staff) {
    return (
      <div className="relative flex items-center justify-end gap-1">
        <button
          type="button"
          title="View"
          className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          onClick={() => onViewStaff(member.id)}
        >
          <VisibilityOutlined sx={{ fontSize: 16 }} />
        </button>
        <button
          type="button"
          title="Edit"
          className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          onClick={() => openEdit(member)}
        >
          <EditOutlined sx={{ fontSize: 16 }} />
        </button>
        {member.status === "ACTIVE" ? (
          <button
            type="button"
            title="Disable"
            className="grid size-8 place-items-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50"
            onClick={() => setDisabling(member)}
          >
            <BlockOutlined sx={{ fontSize: 16 }} />
          </button>
        ) : (
          <>
            <button
              type="button"
              title="Enable"
              className="grid size-8 place-items-center rounded-lg border border-emerald-200 text-emerald-600 transition hover:bg-emerald-50"
              onClick={() => void enableStaff(member)}
            >
              <CheckCircleOutlined sx={{ fontSize: 16 }} />
            </button>
            <button
              type="button"
              title="Delete"
              className="grid size-8 place-items-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50"
              onClick={() => void deleteStaff(member)}
            >
              <DeleteOutline sx={{ fontSize: 16 }} />
            </button>
          </>
        )}
        <button
          type="button"
          title="More"
          className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          onClick={() => setMenuFor(menuFor === member.id ? "" : member.id)}
        >
          <MoreVertOutlined sx={{ fontSize: 16 }} />
        </button>
        {menuFor === member.id ? (
          <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50"
              onClick={() => {
                void navigator.clipboard?.writeText(member.employeeNumber);
                setMenuFor("");
                notifySuccess("Staff ID copied");
              }}
            >
              Copy staff ID
            </button>
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-[12.5px] text-slate-600 hover:bg-slate-50"
              onClick={() => {
                void navigator.clipboard?.writeText(member.user.email);
                setMenuFor("");
                notifySuccess("Email copied");
              }}
            >
              Copy email
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold transition ${
              view === "card" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
            }`}
            onClick={() => setView("card")}
          >
            <GridViewOutlined sx={{ fontSize: 15 }} /> Card View
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 border-l border-slate-200 px-3.5 py-2 text-[12.5px] font-semibold transition ${
              view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
            }`}
            onClick={() => setView("list")}
          >
            <FormatListBulletedOutlined sx={{ fontSize: 15 }} /> List View
          </button>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(["ACTIVE", "DISABLED"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`px-4 py-2 text-[12.5px] font-semibold transition first:border-r first:border-slate-200 ${
                statusFilter === status
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              {status === "ACTIVE" ? "Active" : "Disabled"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative min-w-0 flex-1">
          <SearchOutlined
            sx={{ fontSize: 17 }}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="nx-input w-full pl-9"
            placeholder="Search by name, ID or phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <label className="block w-full lg:w-48">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            Role
          </span>
          <select
            className="nx-input w-full"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
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
        <label className="block w-full lg:w-52">
          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
            Department
          </span>
          <select
            className="nx-input w-full"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {setup.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {view === "list" ? (
        <div className="nx-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[960px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">Staff Photo &amp; Name</th>
                  <th className="px-3 py-3 text-left">Staff ID</th>
                  <th className="px-3 py-3 text-left">Role</th>
                  <th className="px-3 py-3 text-left">Department</th>
                  <th className="px-3 py-3 text-left">Phone</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((member) => (
                  <tr key={member.id} className="transition hover:bg-indigo-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={staffName(member)}
                          photoUrl={member.photoUrl ?? member.user.avatarUrl}
                          size={38}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {staffName(member)}
                          </p>
                          <p className="truncate text-[12px] text-slate-400">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[12.5px] text-slate-600">
                      {member.employeeNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {member.designation?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {member.department?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {member.phone ?? member.user.phone ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={member.status} />
                    </td>
                    <td className="px-4 py-3">{actionButtons(member)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!pageItems.length ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No staff match the current filters.
              </p>
            ) : null}
          </div>
          <Pagination
            from={from}
            to={to}
            total={filtered.length}
            page={safePage}
            totalPages={totalPages}
            onPage={setPage}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {pageItems.map((member) => (
              <div key={member.id} className="nx-card flex flex-col items-center p-5 text-center">
                <InitialsAvatar
                  name={staffName(member)}
                  photoUrl={member.photoUrl ?? member.user.avatarUrl}
                  size={64}
                />
                <p className="mt-3 font-semibold text-slate-900">{staffName(member)}</p>
                <p className="text-[12px] text-slate-400">{member.user.email}</p>
                <p className="mt-1 font-mono text-[12px] text-slate-500">
                  {member.employeeNumber}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600">
                    {member.designation?.name ?? "No role"}
                  </span>
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600">
                    {member.department?.name ?? "No department"}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] text-slate-500">
                  {member.phone ?? member.user.phone ?? "No phone"}
                </p>
                <div className="mt-3">
                  <StatusPill status={member.status} />
                </div>
                <div className="mt-3">{actionButtons(member)}</div>
              </div>
            ))}
          </div>
          {!pageItems.length ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              No staff match the current filters.
            </p>
          ) : (
            <div className="nx-card mt-4 overflow-hidden">
              <Pagination
                from={from}
                to={to}
                total={filtered.length}
                page={safePage}
                totalPages={totalPages}
                onPage={setPage}
              />
            </div>
          )}
        </>
      )}

      {editing ? (
        <Modal title={`Edit ${staffName(editing)}`} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={submitEdit}>
            <StaffFields form={form} setForm={setForm} setup={setup} />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="nx-btn-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button type="submit" className="nx-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {disabling ? (
        <DisableStaffModal
          member={disabling}
          token={token}
          onClose={() => setDisabling(null)}
          onSaved={onSaved}
          onError={onError}
        />
      ) : null}
    </section>
  );
}

function StaffFields({
  form,
  setForm,
  setup,
  employeeOptional = false,
}: {
  form: StaffForm;
  setForm: (next: StaffForm) => void;
  setup: HrSetup;
  employeeOptional?: boolean;
}) {
  return (
    <>
      <label className="block">
        <span className="nx-label">
          Employee number{employeeOptional ? " (blank = auto)" : ""}
        </span>
        <input
          className="nx-input mt-1 w-full"
          placeholder="STF1001"
          value={form.employeeNumber}
          onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="nx-label">Role</span>
          <select
            className="nx-input mt-1 w-full"
            value={form.designationId}
            onChange={(e) => setForm({ ...form, designationId: e.target.value })}
          >
            <option value="">No role</option>
            {setup.designations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nx-label">Department</span>
          <select
            className="nx-input mt-1 w-full"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">No department</option>
            {setup.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="nx-label">Joining date</span>
          <input
            className="nx-input mt-1 w-full"
            type="date"
            value={form.joiningDate}
            onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="nx-label">Phone</span>
          <input
            className="nx-input mt-1 w-full"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
      </div>
      <label className="block">
        <span className="nx-label">Basic salary (monthly)</span>
        <input
          className="nx-input mt-1 w-full"
          type="number"
          min="0"
          value={form.basicSalary}
          onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
        />
      </label>
    </>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "DISABLED" }) {
  return (
    <span className={`nx-pill ${status === "ACTIVE" ? "nx-pill-success" : "nx-pill-danger"}`}>
      {status === "ACTIVE" ? "Active" : "Disabled"}
    </span>
  );
}


function Pagination({
  from,
  to,
  total,
  page,
  totalPages,
  onPage,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  totalPages: number;
  onPage: (next: number) => void;
}) {
  const pages: number[] = [];
  for (let i = 1; i <= Math.min(totalPages, 3); i += 1) pages.push(i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-[12px] text-slate-500">
        Showing {from} to {to} of {total.toLocaleString()} entries
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Prev
        </button>
        {pages.map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPage(pageNum)}
            className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold ${
              page === pageNum ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {pageNum}
          </button>
        ))}
        {totalPages > 3 ? (
          <>
            <span className="px-1 text-slate-400">…</span>
            <button
              type="button"
              onClick={() => onPage(totalPages)}
              className={`grid min-w-8 place-items-center rounded-lg px-2 text-[12px] font-semibold ${
                page === totalPages ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {totalPages}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-[16px] font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
          >
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
