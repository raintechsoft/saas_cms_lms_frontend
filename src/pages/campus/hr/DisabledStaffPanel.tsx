import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutlined,
  DeleteOutline,
  SearchOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import { staffName, type Staff } from "./types";

const PAGE_SIZE = 10;

export function DisabledStaffPanel({
  token,
  onViewStaff,
  onSaved,
  onError,
}: {
  token: string;
  onViewStaff: (id: string) => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true);
    try {
      setStaff(await apiRequest<Staff[]>("/hr/staff/disabled", token));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load disabled staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((member) => {
      const haystack = [
        staffName(member),
        member.user.email,
        member.employeeNumber,
        member.disabledReason ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [staff, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function enable(member: Staff) {
    setBusyId(member.id);
    try {
      await apiRequest(`/hr/staff/${member.id}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      notifySuccess(`${staffName(member)} enabled`);
      await onSaved();
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to enable staff");
    } finally {
      setBusyId("");
    }
  }

  async function remove(member: Staff) {
    const ok = await confirmDelete({
      title: "Delete staff permanently?",
      text: `${staffName(member)} will be removed. This fails if they have paid payroll history.`,
      confirmText: "Yes, delete",
    });
    if (!ok) return;
    setBusyId(member.id);
    try {
      await apiRequest(`/hr/staff/${member.id}`, token, { method: "DELETE" });
      notifySuccess("Staff deleted");
      await onSaved();
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete staff");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="mt-4">
      <div className="relative max-w-md">
        <SearchOutlined
          sx={{ fontSize: 17 }}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          className="nx-input w-full pl-9"
          placeholder="Search disabled staff…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="nx-card mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[880px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-3 py-3 text-left">Employee No</th>
                <th className="px-3 py-3 text-left">Department</th>
                <th className="px-3 py-3 text-left">Disabled reason</th>
                <th className="px-3 py-3 text-left">Leaving date</th>
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
                        size={36}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{staffName(member)}</p>
                        <p className="text-[12px] text-slate-400">{member.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12.5px] text-slate-600">
                    {member.employeeNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{member.department?.name ?? "—"}</td>
                  <td className="max-w-xs px-3 py-3 text-[12.5px] text-slate-600">
                    <span className="line-clamp-2">{member.disabledReason ?? "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {member.leavingDate
                      ? new Date(member.leavingDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="View 360"
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        onClick={() => onViewStaff(member.id)}
                      >
                        <VisibilityOutlined sx={{ fontSize: 16 }} />
                      </button>
                      <button
                        type="button"
                        title="Enable"
                        className="grid size-8 place-items-center rounded-lg border border-emerald-200 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                        disabled={busyId === member.id}
                        onClick={() => void enable(member)}
                      >
                        <CheckCircleOutlined sx={{ fontSize: 16 }} />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        className="grid size-8 place-items-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
                        disabled={busyId === member.id}
                        onClick={() => void remove(member)}
                      >
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageItems.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              {loading ? "Loading disabled staff…" : "No disabled staff found."}
            </p>
          ) : null}
        </div>
        {filtered.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              Page {safePage} of {totalPages} · {filtered.length} total
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                Prev
              </button>
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
    </section>
  );
}
