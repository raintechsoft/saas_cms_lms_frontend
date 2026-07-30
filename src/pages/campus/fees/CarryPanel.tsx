import { useEffect, useMemo, useState } from "react";
import {
  CalendarMonthOutlined,
  CheckCircleOutline,
  InfoOutlined,
  SearchOutlined,
  SwapHorizOutlined,
  GroupsOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { FeeSetup, FeeSummary, Session, Student, StudentDetail } from "./types";
import { buildStudentClassMap, formatMoney, studentDisplayName, today } from "./utils";

const PAGE_SIZE = 6;

export function CarryPanel({
  setup,
  sessions,
  students,
  token,
  onSaved,
  onError,
}: {
  setup: FeeSetup;
  sessions: Session[];
  students: Student[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [fromSessionId, setFromSessionId] = useState(
    sessions.find((s) => !s.isCurrent)?.id ?? sessions[0]?.id ?? "",
  );
  const [toSessionId, setToSessionId] = useState(setup.currentSession?.id ?? "");
  const [dueDate, setDueDate] = useState(today);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const classMap = useMemo(() => buildStudentClassMap(setup), [setup]);
  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((c) => c.academicClass.name))].sort(),
    [setup],
  );
  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((c) => !classFilter || c.academicClass.name === classFilter)
      .map((c) => c.section.name);
    return [...new Set(sections)].sort();
  }, [setup, classFilter]);

  useEffect(() => {
    if (!fromSessionId) return;
    void (async () => {
      try {
        setSummary(
          await apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${fromSessionId}`, token),
        );
      } catch (cause) {
        onError(cause instanceof Error ? cause.message : "Unable to load previous session dues");
      }
    })();
  }, [fromSessionId, token]);

  const rows = useMemo(() => {
    const byStudent = new Map<
      string,
      { student: Student; balance: number; dueDate: string }
    >();
    (summary?.dues ?? [])
      .filter((d) => d.totals.balance > 0)
      .forEach((due) => {
        const existing = byStudent.get(due.student.id);
        if (existing) {
          existing.balance += due.totals.balance;
          if (due.feeMaster.dueDate < existing.dueDate) existing.dueDate = due.feeMaster.dueDate;
        } else {
          byStudent.set(due.student.id, {
            student: due.student,
            balance: due.totals.balance,
            dueDate: due.feeMaster.dueDate.slice(0, 10),
          });
        }
      });
    let list = [...byStudent.values()];
    const q = search.trim().toLowerCase();
    list = list.filter((row) => {
      const info = classMap.get(row.student.id);
      if (classFilter && info?.className !== classFilter) return false;
      if (sectionFilter && info?.sectionName !== sectionFilter) return false;
      if (!q) return true;
      return (
        studentDisplayName(row.student).toLowerCase().includes(q) ||
        row.student.admissionNumber.toLowerCase().includes(q)
      );
    });
    return list;
  }, [summary, search, classFilter, sectionFilter, classMap]);

  useEffect(() => {
    setPage(1);
    const nextSelected: Record<string, boolean> = {};
    const nextBalances: Record<string, string> = {};
    rows.forEach((row) => {
      nextSelected[row.student.id] = selected[row.student.id] ?? true;
      nextBalances[row.student.id] =
        balances[row.student.id] ?? row.balance.toFixed(2);
    });
    setSelected(nextSelected);
    setBalances(nextBalances);
  }, [fromSessionId, search, classFilter, sectionFilter, summary]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = rows.filter((row) => selected[row.student.id]);
  const selectedBalance = selectedRows.reduce((sum, row) => {
    const override = Number(balances[row.student.id]);
    return sum + (Number.isFinite(override) ? override : row.balance);
  }, 0);

  async function forwardSelected() {
    if (!fromSessionId || !toSessionId || !selectedRows.length) return;
    setSubmitting(true);
    try {
      for (const row of selectedRows) {
        const detail = await apiRequest<StudentDetail>(`/students/${row.student.id}`, token);
        const enrollment = detail.enrollments.find((e) => e.academicSession.id === toSessionId);
        if (!enrollment) {
          throw new Error(
            `${studentDisplayName(row.student)} is not enrolled in the target session`,
          );
        }
        await apiRequest("/fees/carry-forward", token, {
          method: "POST",
          body: JSON.stringify({
            fromSessionId,
            targetEnrollmentId: enrollment.id,
            dueDate,
            amount: Number(balances[row.student.id] ?? row.balance),
          }),
        });
      }
      notifySuccess(`Carried forward ${selectedRows.length} student balance(s)`);
      await onSaved();
      setSummary(
        await apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${fromSessionId}`, token),
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to carry forward balances");
    } finally {
      setSubmitting(false);
    }
  }

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected[r.student.id]);

  return (
    <section className="mt-5 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-[#6366f1]">
            <SwapHorizOutlined sx={{ fontSize: 22 }} />
          </div>
          <div>
            <p className="text-sm text-slate-500">
              Manage student balances moving from previous academic session to the current session
              {setup.currentSession ? ` (${setup.currentSession.name})` : ""}.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <select
                className="nx-input w-48"
                value={fromSessionId}
                onChange={(e) => setFromSessionId(e.target.value)}
              >
                <option value="">From session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="nx-input w-48"
                value={toSessionId}
                onChange={(e) => setToSessionId(e.target.value)}
              >
                <option value="">To session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                className="nx-input w-44"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-2xl">
          <div className="nx-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Selected To Forward
              </p>
              <CheckCircleOutline sx={{ fontSize: 18 }} className="text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{selectedRows.length}</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Pending validation for {rows.length} students
            </p>
          </div>
          <div className="nx-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Total Students
              </p>
              <GroupsOutlined sx={{ fontSize: 18 }} className="text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{rows.length.toLocaleString()}</p>
            <p className="mt-1 text-[12px] text-slate-500">Found in current session filters</p>
          </div>
          <div className="nx-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Calculated Balance
              </p>
              <InfoOutlined sx={{ fontSize: 18 }} className="text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(selectedBalance)}</p>
            <p className="mt-1 text-[12px] text-slate-500">Total outstanding credit to forward</p>
          </div>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchOutlined
              sx={{ fontSize: 18 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-10"
              placeholder="Search student name or roll no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="nx-input lg:w-40"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSectionFilter("");
            }}
          >
            <option value="">All Classes</option>
            {classOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="nx-input lg:w-40"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="">All Sections</option>
            {sectionOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className="nx-btn-primary" onClick={() => setPage(1)}>
            Search
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[880px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => {
                      const next = { ...selected };
                      pageRows.forEach((row) => {
                        next[row.student.id] = e.target.checked;
                      });
                      setSelected(next);
                    }}
                  />
                </th>
                <th>Student Name</th>
                <th>Previous Session Balance (₹)</th>
                <th>Due Date</th>
                <th className="text-center">Include</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.student.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[row.student.id]}
                      onChange={(e) =>
                        setSelected({ ...selected, [row.student.id]: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                        #{row.student.admissionNumber.slice(-3) || "—"}
                      </span>
                      <InitialsAvatar name={studentDisplayName(row.student)} size={36} />
                      <span className="font-semibold text-slate-900">
                        {studentDisplayName(row.student)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <input
                      className="nx-input max-w-[140px]"
                      type="number"
                      min="0"
                      step="0.01"
                      value={balances[row.student.id] ?? row.balance.toFixed(2)}
                      onChange={(e) =>
                        setBalances({ ...balances, [row.student.id]: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <CalendarMonthOutlined sx={{ fontSize: 16 }} className="text-slate-400" />
                      {dueDate || row.dueDate}
                    </span>
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={!!selected[row.student.id]}
                      onChange={(e) =>
                        setSelected({ ...selected, [row.student.id]: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No unpaid balances found in the selected previous session.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <p className="text-[12px] text-slate-500">
            Showing {rows.length ? (page - 1) * PAGE_SIZE + 1 : 0}-
            {Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} students
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {(() => {
              const windowSize = Math.min(5, pageCount);
              let start = Math.max(1, page - Math.floor(windowSize / 2));
              const end = Math.min(pageCount, start + windowSize - 1);
              start = Math.max(1, end - windowSize + 1);
              return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-8 rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${
                  page === n
                    ? "bg-[#6366f1] text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
              ));
            })()}
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="nx-btn-secondary"
          onClick={() => {
            const next: Record<string, boolean> = {};
            rows.forEach((row) => {
              next[row.student.id] = false;
            });
            setSelected(next);
          }}
        >
          Cancel Session Move
        </button>
        <button
          type="button"
          className="nx-btn-primary"
          disabled={submitting || !selectedRows.length}
          onClick={() => void forwardSelected()}
        >
          {submitting ? "Forwarding…" : "Forward selected balances"}
        </button>
      </div>
    </section>
  );
}
