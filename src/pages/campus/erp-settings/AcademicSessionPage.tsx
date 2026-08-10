import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

interface AcademicSession {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

type OutletCtx = { activeLabel?: string };
type StatusValue = "ACTIVE" | "COMPLETED";

type SessionForm = {
  name: string;
  startDate: string;
  endDate: string;
  status: StatusValue;
};

const emptyForm: SessionForm = {
  name: "",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
};

const PAGE_SIZE = 6;

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children} <span className="text-rose-500">*</span>
    </span>
  );
}

function toInputDate(value: string | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDisplayDate(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </section>
  );
}

export function AcademicSessionPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Academic Session";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["sessions.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(emptyForm);
  const [page, setPage] = useState(1);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<AcademicSession[]>("/academic-sessions", accessToken);
      setSessions(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load academic sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sessions.slice(start, start + PAGE_SIZE);
  }, [sessions, currentPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(session: AcademicSession) {
    setEditingId(session.id);
    setForm({
      name: session.name,
      startDate: toInputDate(session.startDate),
      endDate: toInputDate(session.endDate),
      status: session.isCurrent ? "ACTIVE" : "COMPLETED",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitForm(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;

    const name = form.name.trim();
    if (name.length < 3) {
      notifyError("Session name must be at least 3 characters.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      notifyError("Start and end dates are required.");
      return;
    }
    if (form.endDate <= form.startDate) {
      notifyError("End date must be after the start date.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        startDate: form.startDate,
        endDate: form.endDate,
        isCurrent: form.status === "ACTIVE",
      };

      if (editingId) {
        await apiRequest(`/academic-sessions/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Academic session updated");
      } else {
        await apiRequest("/academic-sessions", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Academic session created");
      }
      resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save academic session");
    } finally {
      setSaving(false);
    }
  }

  async function removeSession(session: AcademicSession) {
    if (!accessToken || !canManage) return;
    if (session.isCurrent) {
      notifyError("Activate another session before deleting the active one.");
      return;
    }
    const ok = await confirmDelete({
      title: "Delete academic session?",
      text: `Delete "${session.name}"? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/academic-sessions/${session.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Academic session deleted");
      if (editingId === session.id) resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete academic session");
    }
  }

  const rangeStart = sessions.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, sessions.length);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || !canManage}
          onClick={() => void submitForm()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Academic Session</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage academic years and set the active session for your institution.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void submitForm(e)}>
          <Card title={editingId ? "Edit Academic Session" : "Add New Academic Session"}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <RequiredLabel>Session Name</RequiredLabel>
                <input
                  className="nx-input w-full"
                  required
                  minLength={3}
                  placeholder="e.g., 2025-2026"
                  value={form.name}
                  disabled={!canManage || saving}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="block">
                <RequiredLabel>Start Date</RequiredLabel>
                <input
                  className="nx-input w-full"
                  required
                  type="date"
                  value={form.startDate}
                  disabled={!canManage || saving}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </label>
              <label className="block">
                <RequiredLabel>End Date</RequiredLabel>
                <input
                  className="nx-input w-full"
                  required
                  type="date"
                  value={form.endDate}
                  disabled={!canManage || saving}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </label>
              <label className="block">
                <RequiredLabel>Status</RequiredLabel>
                <select
                  className="nx-input w-full"
                  value={form.status}
                  disabled={!canManage || saving}
                  onChange={(e) => setForm({ ...form, status: e.target.value as StatusValue })}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
                Recommended format: YYYY-YYYY (e.g., 2025-2026)
              </p>
              <div className="flex flex-wrap gap-2">
                {editingId ? (
                  <button
                    type="button"
                    className="nx-btn-secondary"
                    disabled={saving}
                    onClick={resetForm}
                  >
                    Cancel edit
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!canManage || saving}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                  {editingId ? "Update session" : "Add session"}
                </button>
              </div>
            </div>
          </Card>

          <Card title="Existing Academic Sessions">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-3 py-2.5">Session Name</th>
                    <th className="px-3 py-2.5">Start Date</th>
                    <th className="px-3 py-2.5">End Date</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-[#6B7280]">
                        {loading ? "Loading sessions…" : "No academic sessions yet."}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((session) => (
                      <tr key={session.id} className="border-b border-[#F3F4F6] last:border-b-0">
                        <td className="px-3 py-3 font-semibold text-[#1A1A1A]">{session.name}</td>
                        <td className="px-3 py-3 text-[#6B7280]">{formatDisplayDate(session.startDate)}</td>
                        <td className="px-3 py-3 text-[#6B7280]">{formatDisplayDate(session.endDate)}</td>
                        <td className="px-3 py-3">
                          {session.isCurrent ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-800/80">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                              disabled={!canManage || saving}
                              aria-label={`Edit ${session.name}`}
                              onClick={() => startEdit(session)}
                            >
                              <EditOutlined sx={{ fontSize: 18 }} />
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                              disabled={!canManage || saving || session.isCurrent}
                              aria-label={`Delete ${session.name}`}
                              onClick={() => void removeSession(session)}
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
                  {currentPage}
                </span>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
              <p>
                Showing {rangeStart} to {rangeEnd} of {sessions.length} entries
              </p>
            </div>
          </Card>
        </form>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#374151]">
          <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-primary" />
          <p>
            <span className="font-semibold text-[#1A1A1A]">Note:</span> Only one academic session can
            be active at a time. Changing the active session will affect attendance, fees and
            academic data.
          </p>
        </div>
      </div>
    </div>
  );
}
