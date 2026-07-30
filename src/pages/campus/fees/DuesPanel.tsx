import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DownloadOutlined,
  MailOutline,
  PaymentsOutlined,
  PersonOutline,
  SearchOutlined,
  GroupsOutlined,
  SouthWestOutlined,
  MarkEmailReadOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import type { FeeSetup, FeeSummary, Session } from "./types";
import {
  buildStudentClassMap,
  exportDuesCsv,
  formatMoney,
  overdueDays,
  overduePill,
  parentContactOf,
  studentDisplayName,
} from "./utils";

const PAGE_SIZE = 5;

export function DuesPanel({
  setup,
  sessions,
  token,
  onError,
  onExportReady,
  onCollect,
}: {
  setup: FeeSetup;
  sessions: Session[];
  token: string;
  onError: (message: string) => void;
  onExportReady?: (exportFn: (() => void) | null) => void;
  onCollect?: (studentId: string) => void;
}) {
  const [sessionId, setSessionId] = useState(setup.currentSession?.id ?? "");
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [feeType, setFeeType] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [remindersSentMtd, setRemindersSentMtd] = useState(0);

  const classMap = useMemo(() => buildStudentClassMap(setup), [setup]);
  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((item) => item.academicClass.name))].sort(),
    [setup],
  );
  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((item) => !classFilter || item.academicClass.name === classFilter)
      .map((item) => item.section.name);
    return [...new Set(sections)].sort();
  }, [setup, classFilter]);
  const feeTypeOptions = useMemo(
    () => [...new Set((summary?.dues ?? []).map((d) => d.feeMaster.feeType.name))].sort(),
    [summary],
  );

  useEffect(() => {
    if (setup.currentSession?.id && !sessionId) setSessionId(setup.currentSession.id);
  }, [setup.currentSession?.id, sessionId]);

  async function loadSummary(id: string) {
    if (!id) {
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const [nextSummary, reminderStats] = await Promise.all([
        apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${id}`, token),
        apiRequest<{ sentMtd: number }>("/fees/reminders/stats", token),
      ]);
      setSummary(nextSummary);
      setRemindersSentMtd(reminderStats.sentMtd);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load dues summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary(sessionId);
  }, [sessionId, token]);

  const openDues = useMemo(() => {
    const rows = (summary?.dues ?? []).filter((item) => item.totals.balance > 0);
    const query = search.trim().toLowerCase();
    return rows.filter((due) => {
      const info = classMap.get(due.student.id);
      if (feeType && due.feeMaster.feeType.name !== feeType) return false;
      if (classFilter && info?.className !== classFilter) return false;
      if (sectionFilter && info?.sectionName !== sectionFilter) return false;
      if (category === "overdue" && overdueDays(due.feeMaster.dueDate) <= 0) return false;
      if (category === "upcoming" && overdueDays(due.feeMaster.dueDate) > 0) return false;
      if (!query) return true;
      const haystack = [
        studentDisplayName(due.student),
        due.student.admissionNumber,
        due.feeMaster.feeType.name,
        info?.className ?? "",
        info?.sectionName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [summary, search, classFilter, sectionFilter, feeType, category, classMap]);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, sectionFilter, feeType, category, sessionId]);

  const pageCount = Math.max(1, Math.ceil(openDues.length / PAGE_SIZE));
  const pageRows = openDues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const arrearsStudents = useMemo(() => new Set(openDues.map((d) => d.student.id)).size, [openDues]);
  const filteredDueTotal = useMemo(
    () => openDues.reduce((sum, due) => sum + due.totals.balance, 0),
    [openDues],
  );

  useEffect(() => {
    onExportReady?.(() => exportDuesCsv(openDues, classMap));
    return () => onExportReady?.(null);
  }, [openDues, classMap, onExportReady]);

  function applySearch() {
    setSearch(draftSearch);
  }

  return (
    <section className="mt-5 space-y-5">
      <div className="nx-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Defaulter student records
            </p>
            <select
              className="nx-input mt-2 w-full max-w-xs"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchOutlined
              sx={{ fontSize: 18 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-10"
              placeholder="Quick search student..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <select className="nx-input xl:w-40" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
          </select>
          <select className="nx-input xl:w-40" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
            <option value="">All Types</option>
            {feeTypeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="nx-input xl:w-40"
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
            className="nx-input xl:w-40"
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
          <button type="button" className="nx-btn-primary shrink-0" onClick={applySearch}>
            <SearchOutlined sx={{ fontSize: 16 }} />
            Search Records
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Class/Section</th>
                <th>Fee Type</th>
                <th>Amount Due</th>
                <th>Days Overdue</th>
                <th>Parent Contact</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    Loading dues…
                  </td>
                </tr>
              ) : null}
              {!loading &&
                pageRows.map((due) => {
                  const info = classMap.get(due.student.id);
                  const badge = overduePill(due.feeMaster.dueDate);
                  const contact = parentContactOf(due.student);
                  return (
                    <tr key={due.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <InitialsAvatar
                            name={studentDisplayName(due.student)}
                            className="size-9 text-[11px]"
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {studentDisplayName(due.student)}
                            </p>
                            <p className="text-[12px] text-slate-400">{due.student.admissionNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                          {info ? `${info.className}-${info.sectionName}` : "—"}
                        </span>
                      </td>
                      <td className="text-slate-700">{due.feeMaster.feeType.name}</td>
                      <td className="font-bold text-slate-900">{formatMoney(due.totals.balance)}</td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td className="text-slate-600">{contact}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          <button
                            type="button"
                            className="rounded-md p-1.5 hover:bg-slate-100 hover:text-indigo-600"
                            title="Send reminder"
                            onClick={() => {
                              if (contact === "—") {
                                notifyInfo("No parent contact on file for this student");
                                return;
                              }
                              void apiRequest("/fees/reminders/student", token, {
                                method: "POST",
                                body: JSON.stringify({
                                  studentId: due.student.id,
                                  sessionId,
                                }),
                              })
                                .then(() => {
                                  notifySuccess(
                                    `Reminder sent for ${studentDisplayName(due.student)}`,
                                  );
                                  setRemindersSentMtd((count) => count + 1);
                                })
                                .catch((cause) =>
                                  onError(
                                    cause instanceof Error
                                      ? cause.message
                                      : "Unable to send reminder",
                                  ),
                                );
                            }}
                          >
                            <MailOutline sx={{ fontSize: 18 }} />
                          </button>
                          <Link
                            to={`/students/${due.student.id}`}
                            className="rounded-md p-1.5 hover:bg-slate-100 hover:text-indigo-600"
                            title="View profile"
                          >
                            <PersonOutline sx={{ fontSize: 18 }} />
                          </Link>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            title="Collect fees"
                            onClick={() => {
                              if (onCollect) {
                                onCollect(due.student.id);
                                return;
                              }
                              notifyInfo("Open Receipts → Generate New Receipt to collect fees");
                            }}
                          >
                            <PaymentsOutlined sx={{ fontSize: 16 }} />
                            Collect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!loading && !openDues.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No outstanding dues for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <p className="text-[12px] text-slate-500">
            Showing {openDues.length ? (page - 1) * PAGE_SIZE + 1 : 0}-
            {Math.min(page * PAGE_SIZE, openDues.length)} of {openDues.length} records
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
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="nx-card flex items-center gap-4 p-4">
          <div className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <GroupsOutlined sx={{ fontSize: 22 }} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Total Students In Arrears
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">{arrearsStudents} Students</p>
          </div>
        </div>
        <div className="nx-card flex items-center gap-4 p-4">
          <div className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <SouthWestOutlined sx={{ fontSize: 22 }} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Total Due Amount
            </p>
            <p className="mt-1 text-xl font-bold text-rose-600">{formatMoney(filteredDueTotal)}</p>
          </div>
        </div>
        <div className="nx-card flex items-center gap-4 p-4">
          <div className="grid size-11 place-items-center rounded-xl bg-orange-50 text-orange-600">
            <MarkEmailReadOutlined sx={{ fontSize: 22 }} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Reminders Sent (MTD)
            </p>
            <p className="mt-1 text-xl font-bold text-orange-600">
              {remindersSentMtd} Sent
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="nx-btn-secondary hidden"
        onClick={() => exportDuesCsv(openDues, classMap)}
      >
        <DownloadOutlined sx={{ fontSize: 16 }} /> Export
      </button>
    </section>
  );
}
