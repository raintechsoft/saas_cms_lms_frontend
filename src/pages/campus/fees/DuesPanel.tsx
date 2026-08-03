import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  MailOutline,
  PaymentsOutlined,
  PersonOutline,
  SearchOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import type { FeeSetup, FeeSummary, Session } from "./types";
import {
  buildStudentClassMap,
  exportDuesCsv,
  formatMoney,
  overduePill,
  parentContactOf,
  studentDisplayName,
} from "./utils";

const PAGE_SIZE = 8;

/**
 * PDF §7 Search Due Fees:
 * Fees Category → Fees Type → Class → Section → Search → student due list
 * Fees Category maps to Fees Class Group.
 */
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
  onCollect?: (studentId: string, assignmentId?: string) => void;
}) {
  const [sessionId, setSessionId] = useState(setup.currentSession?.id ?? "");
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const [feeGroupId, setFeeGroupId] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");

  const [searched, setSearched] = useState(false);
  const [applied, setApplied] = useState({
    feeGroupId: "",
    feeTypeId: "",
    className: "",
    sectionName: "",
  });
  const [page, setPage] = useState(1);

  const classMap = useMemo(() => buildStudentClassMap(setup), [setup]);
  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((item) => item.academicClass.name))].sort(),
    [setup],
  );
  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((item) => !className || item.academicClass.name === className)
      .map((item) => item.section.name);
    return [...new Set(sections)].sort();
  }, [setup, className]);

  const feeTypeOptions = useMemo(() => {
    if (!feeGroupId) {
      return setup.types.filter((t) => t.isActive !== false);
    }
    const group = setup.groups.find((g) => g.id === feeGroupId);
    return group?.items.map((i) => i.feeType) ?? [];
  }, [setup.types, setup.groups, feeGroupId]);

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
      setSummary(await apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${id}`, token));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load dues summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary(sessionId);
    setSearched(false);
  }, [sessionId, token]);

  const openDues = useMemo(() => {
    if (!searched) return [];
    const rows = (summary?.dues ?? []).filter((item) => item.totals.balance > 0);
    return rows.filter((due) => {
      const info = classMap.get(due.student.id);
      if (applied.feeTypeId && due.feeMaster.feeType.id !== applied.feeTypeId) return false;
      if (applied.feeGroupId) {
        const groupId = due.feeMaster.feeGroup?.id;
        if (groupId && groupId !== applied.feeGroupId) return false;
        if (!groupId) {
          const group = setup.groups.find((g) => g.id === applied.feeGroupId);
          const typeIds = new Set(group?.items.map((i) => i.feeType.id) ?? []);
          if (!typeIds.has(due.feeMaster.feeType.id)) return false;
        }
      }
      if (applied.className && info?.className !== applied.className) return false;
      if (applied.sectionName && info?.sectionName !== applied.sectionName) return false;
      return true;
    });
  }, [summary, searched, applied, classMap, setup.groups]);

  useEffect(() => {
    setPage(1);
  }, [searched, applied, sessionId]);

  const pageCount = Math.max(1, Math.ceil(openDues.length / PAGE_SIZE));
  const pageRows = openDues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    onExportReady?.(() => exportDuesCsv(openDues, classMap));
    return () => onExportReady?.(null);
  }, [openDues, classMap, onExportReady]);

  function runSearch() {
    if (!feeTypeId && !feeGroupId) {
      onError("Select Fees Category and/or Fees Type");
      return;
    }
    setApplied({
      feeGroupId,
      feeTypeId,
      className,
      sectionName,
    });
    setSearched(true);
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-5">
        <h3 className="text-[18px] font-bold text-slate-900">Search Due Fees</h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Select Fees Category, Fees Type, Class and Section, then click Search to list students who
          have not paid that fee.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className="nx-label">Session</span>
            <select
              className="nx-input"
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
          </label>
          <label>
            <span className="nx-label">Fees Category</span>
            <select
              className="nx-input"
              value={feeGroupId}
              onChange={(e) => {
                setFeeGroupId(e.target.value);
                setFeeTypeId("");
                setSearched(false);
              }}
            >
              <option value="">All categories</option>
              {setup.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Fees Type</span>
            <select
              className="nx-input"
              value={feeTypeId}
              onChange={(e) => {
                setFeeTypeId(e.target.value);
                setSearched(false);
              }}
            >
              <option value="">Select fees type</option>
              {feeTypeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Class</span>
            <select
              className="nx-input"
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSectionName("");
                setSearched(false);
              }}
            >
              <option value="">All classes</option>
              {classOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Section</span>
            <select
              className="nx-input"
              value={sectionName}
              onChange={(e) => {
                setSectionName(e.target.value);
                setSearched(false);
              }}
            >
              <option value="">All sections</option>
              {sectionOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="nx-btn-primary w-full !py-2.5"
              onClick={runSearch}
              disabled={loading || !sessionId}
            >
              <SearchOutlined sx={{ fontSize: 16 }} />
              Search
            </button>
          </div>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[17px] font-bold text-slate-900">Due fee students</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {searched
              ? `${openDues.length} record(s) found`
              : "Results appear after you click Search."}
          </p>
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
              {!loading && !searched ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    Select Fees Category / Fees Type / Class / Section, then click <strong>Search</strong>.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                searched &&
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
                            <p className="text-[12px] text-slate-400">
                              {due.student.admissionNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                          {info ? `${info.className}-${info.sectionName}` : "—"}
                        </span>
                      </td>
                      <td className="text-slate-700">{due.feeMaster.feeType.name}</td>
                      <td className="font-bold text-slate-900">
                        {formatMoney(due.totals.balance)}
                      </td>
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
                                .then(() =>
                                  notifySuccess(
                                    `Reminder sent for ${studentDisplayName(due.student)}`,
                                  ),
                                )
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
                                onCollect(due.student.id, due.id);
                                return;
                              }
                              notifyInfo("Open Collect Fees to collect payment");
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
              {!loading && searched && !openDues.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No students found with due fees for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {searched && openDues.length > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
            <p className="text-[12px] text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, openDues.length)} of{" "}
              {openDues.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="nx-btn-secondary !py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="nx-btn-secondary !py-1.5"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
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
