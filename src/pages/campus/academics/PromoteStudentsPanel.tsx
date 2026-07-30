import { useEffect, useMemo, useState } from "react";
import { InfoOutlined, SearchOutlined, UpgradeOutlined, WarningAmberOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, ClassSection, PromoteBoard } from "./types";
import { studentDisplayName } from "./utils";

type PromoteResult = "PASS" | "FAIL";
type PromoteAction = "CONTINUE" | "LEAVE";

interface Row {
  enrollmentId: string;
  studentName: string;
  admissionNumber: string;
  selected: boolean;
  result: PromoteResult;
  action: PromoteAction;
  passClassId: string;
  passSectionId: string;
  alreadyEnrolled: boolean;
  existingTargetLabel: string | null;
}

export function PromoteStudentsPanel({
  setup,
  token,
  canManage,
  onSaved,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  canManage: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const initialSource = setup.classSections[0];
  const defaultPromoteSessionId =
    setup.sessions.find((session) => session.id !== setup.currentSession?.id)?.id ?? "";
  const [sourceClassId, setSourceClassId] = useState(initialSource?.academicClass.id ?? "");
  const [fromClassSectionId, setFromClassSectionId] = useState(initialSource?.id ?? "");
  const [promoteSessionId, setPromoteSessionId] = useState(defaultPromoteSessionId);
  const [targetClassSections, setTargetClassSections] = useState<ClassSection[]>([]);
  const [board, setBoard] = useState<PromoteBoard | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sourceClassSections = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === sourceClassId),
    [setup.classSections, sourceClassId],
  );
  const sourceClassSection = setup.classSections.find((item) => item.id === fromClassSectionId);
  const targetClasses = useMemo(() => {
    const map = new Map(targetClassSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [targetClassSections]);
  const promoteSessionName = setup.sessions.find((session) => session.id === promoteSessionId)?.name ?? "target session";

  useEffect(() => {
    if (!promoteSessionId) {
      setTargetClassSections([]);
      return;
    }
    void apiRequest<{ classSections: ClassSection[] }>(
      `/academics/setup?sessionId=${encodeURIComponent(promoteSessionId)}`,
      token,
    )
      .then((data) => setTargetClassSections(data.classSections ?? []))
      .catch(() => setTargetClassSections([]));
  }, [promoteSessionId, token]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.studentName.toLowerCase().includes(q) || r.admissionNumber.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => r.selected);
  const selectedCount = rows.filter((r) => r.selected).length;

  async function loadBoard() {
    if (!fromClassSectionId || !promoteSessionId) {
      onError("Select the source class section and promote session first.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<PromoteBoard>(
        `/academics/promote/board?fromClassSectionId=${encodeURIComponent(fromClassSectionId)}&promoteSessionId=${encodeURIComponent(promoteSessionId)}`,
        token,
      );
      setBoard(data);
      setRows(
        data.students.map((s) => ({
          enrollmentId: s.enrollmentId,
          studentName: studentDisplayName(s.student),
          admissionNumber: s.student.admissionNumber,
          selected: false,
          result: "PASS",
          action: "CONTINUE",
          passClassId: sourceClassSection?.academicClass.id ?? "",
          passSectionId: sourceClassSection?.section.id ?? "",
          alreadyEnrolled: s.alreadyEnrolledInTargetSession,
          existingTargetLabel: s.existingTargetLabel,
        })),
      );
      notifySuccess(`Loaded ${data.students.length} students.`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load promote board");
    } finally {
      setLoading(false);
    }
  }

  function updateRow(enrollmentId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.enrollmentId === enrollmentId ? { ...r, ...patch } : r)));
  }

  function sectionsForClass(classId: string) {
    return targetClassSections.filter((item) => item.academicClass.id === classId);
  }

  async function submit() {
    if (!fromClassSectionId || !promoteSessionId) {
      onError("Select a source class/section and ensure the next session exists.");
      return;
    }
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) {
      onError("Select at least one student to promote.");
      return;
    }
    const invalid = selected.find(
      (row) => row.action === "CONTINUE" && (!row.passClassId || !row.passSectionId),
    );
    if (invalid) {
      onError(`Choose a target class and section for ${invalid.studentName}.`);
      return;
    }
    const missingTarget = selected.find((row) => {
      if (row.action !== "CONTINUE") return false;
      const classId = row.result === "FAIL" ? sourceClassSection?.academicClass.id ?? "" : row.passClassId;
      const sectionId = row.result === "FAIL" ? sourceClassSection?.section.id ?? "" : row.passSectionId;
      return !targetClassSections.some(
        (item) => item.academicClass.id === classId && item.section.id === sectionId,
      );
    });
    if (missingTarget) {
      onError(
        `Target class/section for ${missingTarget.studentName} does not exist in ${promoteSessionName}. Create it first.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const groups = new Map<string, Row[]>();
      for (const row of selected) {
        const passClass =
          row.result === "FAIL"
            ? sourceClassSection?.academicClass.id || ""
            : row.passClassId || sourceClassSection?.academicClass.id || "";
        const passSection =
          row.result === "FAIL"
            ? sourceClassSection?.section.id || ""
            : row.passSectionId || sourceClassSection?.section.id || "";
        const key = `${passClass}|${passSection}`;
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }

      let promoted = 0;
      let alumni = 0;
      for (const [key, items] of groups) {
        const [classId, sectionId] = key.split("|");
        const result = await apiRequest<{ promoted: number; alumni: number; total: number }>(
          "/academics/promote",
          token,
          {
            method: "POST",
            body: JSON.stringify({
              fromClassSectionId,
              promoteSessionId,
              passContinueClassId: classId,
              passContinueSectionId: sectionId,
              items: items.map((r) => ({
                studentEnrollmentId: r.enrollmentId,
                result: r.result,
                action: r.action,
              })),
            }),
          },
        );
        promoted += result.promoted;
        alumni += result.alumni;
      }
      notifySuccess(`Promoted ${promoted} student(s), ${alumni} marked alumni.`);
      setBoard(null);
      setRows([]);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to promote students");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-5">
      <div className="nx-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={sourceClassId}
              onChange={(event) => {
                const nextClassId = event.target.value;
                const first = setup.classSections.find(
                  (item) => item.academicClass.id === nextClassId,
                );
                setSourceClassId(nextClassId);
                setFromClassSectionId(first?.id ?? "");
                setBoard(null);
                setRows([]);
              }}
            >
              <option value="">Select class</option>
              {setup.classes.map((academicClass) => (
                <option key={academicClass.id} value={academicClass.id}>
                  {academicClass.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={fromClassSectionId}
              disabled={!sourceClassId}
              onChange={(event) => {
                setFromClassSectionId(event.target.value);
                setBoard(null);
                setRows([]);
              }}
            >
              <option value="">Select section</option>
              {sourceClassSections.map((classSection) => (
                <option key={classSection.id} value={classSection.id}>
                  {classSection.section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[150px] flex-1 sm:max-w-[200px]">
            <span className="nx-label !normal-case !tracking-normal">Promote Session</span>
            <select
              className="nx-input bg-white"
              value={promoteSessionId}
              onChange={(event) => {
                setPromoteSessionId(event.target.value);
                setBoard(null);
                setRows([]);
              }}
            >
              <option value="">Select session</option>
              {setup.sessions
                .filter((session) => session.id !== setup.currentSession?.id)
                .map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="relative min-w-[180px] flex-1 sm:max-w-[230px]">
            <SearchOutlined
              sx={{ fontSize: 17 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input bg-white pl-9"
              placeholder="Search student"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
            disabled={loading || !fromClassSectionId || !promoteSessionId}
            onClick={() => void loadBoard()}
          >
            <SearchOutlined sx={{ fontSize: 17 }} />
            {loading ? "Searching…" : "Search"}
          </button>
          {board?.multiClassAllowed ? (
            <span className="nx-pill nx-pill-indigo">Coaching center: multi-class enrollment allowed</span>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded border border-slate-200">
          <table className="nx-table !min-w-[980px]">
              <thead className="bg-slate-50/80">
                <tr>
                  <th rowSpan={2} className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={!filteredRows.length}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        const ids = new Set(filteredRows.map((row) => row.enrollmentId));
                        setRows((previous) =>
                          previous.map((row) =>
                            ids.has(row.enrollmentId) ? { ...row, selected: checked } : row,
                          ),
                        );
                      }}
                    />
                  </th>
                  <th rowSpan={2} className="w-10">#</th>
                  <th rowSpan={2}>Student Name</th>
                  <th rowSpan={2}>Current Result</th>
                  <th rowSpan={2}>
                    <span className="inline-flex items-center gap-1">
                      Next Session Status <InfoOutlined sx={{ fontSize: 13 }} />
                    </span>
                  </th>
                  <th colSpan={3} className="text-center">Promote To</th>
                  <th rowSpan={2}>Status / Note</th>
                </tr>
                <tr>
                  <th>Session</th>
                  <th>Class</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.enrollmentId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.alreadyEnrolled}
                        onChange={(event) => updateRow(row.enrollmentId, { selected: event.target.checked })}
                      />
                    </td>
                    <td className="text-center font-medium text-slate-700">{index + 1}</td>
                    <td className="font-semibold text-slate-800">{row.studentName}</td>
                    <td>
                      <button
                        type="button"
                        className={`nx-pill border ${
                          row.result === "PASS"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                        onClick={() =>
                          updateRow(row.enrollmentId, {
                            result: row.result === "PASS" ? "FAIL" : "PASS",
                          })
                        }
                        title="Click to toggle result"
                      >
                        {row.result === "PASS" ? "Pass" : "Fail"}
                      </button>
                    </td>
                    <td>
                      <select
                        className="nx-input bg-white !py-1.5"
                        value={row.action}
                        onChange={(event) =>
                          updateRow(row.enrollmentId, {
                            action: event.target.value as PromoteAction,
                          })
                        }
                      >
                        <option value="CONTINUE">Continue</option>
                        <option value="LEAVE">Leave</option>
                      </select>
                    </td>
                    {row.action === "LEAVE" ? (
                      <td colSpan={3} className="text-center text-[11px] font-medium text-slate-700">
                        Will move to Alumni next session
                      </td>
                    ) : (
                      <>
                        <td className="whitespace-nowrap text-[11px] font-medium text-slate-700">
                          {promoteSessionName}
                        </td>
                        <td>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={row.result === "FAIL" ? sourceClassId : row.passClassId}
                            disabled={row.result === "FAIL"}
                            onChange={(event) =>
                              updateRow(row.enrollmentId, {
                                passClassId: event.target.value,
                                passSectionId: "",
                              })
                            }
                          >
                            <option value="">Class</option>
                            {targetClasses.map((academicClass) => (
                              <option key={academicClass.id} value={academicClass.id}>
                                {academicClass.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={
                              row.result === "FAIL"
                                ? sourceClassSection?.section.id ?? ""
                                : row.passSectionId
                            }
                            disabled={row.result === "FAIL"}
                            onChange={(event) =>
                              updateRow(row.enrollmentId, { passSectionId: event.target.value })
                            }
                          >
                            <option value="">Section</option>
                            {sectionsForClass(
                              row.result === "FAIL" ? sourceClassId : row.passClassId,
                            ).map((classSection) => (
                              <option key={classSection.id} value={classSection.section.id}>
                                {classSection.section.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}
                    <td>
                      {row.alreadyEnrolled ? (
                        <span className="nx-pill nx-pill-warning">
                          Already in {row.existingTargetLabel ?? "target session"}
                        </span>
                      ) : row.result === "FAIL" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] leading-4 text-slate-500">
                          Failed students stay in the same section
                          <InfoOutlined sx={{ fontSize: 13 }} />
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                      {rows.length ? "No students match your search." : "Search to load students for promotion."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-[300px] flex-1 items-start gap-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            <WarningAmberOutlined sx={{ fontSize: 19 }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold">Ensure fees are imported before promoting students.</p>
              <p className="mt-0.5 text-[10px]">
                Promotions should be done only after fees for the next session are confirmed and imported.
              </p>
            </div>
          </div>
          {canManage ? (
            <div className="text-center">
              <button
                type="button"
                className="nx-btn-primary min-w-[160px]"
                disabled={submitting || !selectedCount}
                onClick={() => void submit()}
              >
                <UpgradeOutlined sx={{ fontSize: 17 }} />
                {submitting ? "Promoting…" : "Promote Selected"}
              </button>
              <p className="mt-1 text-[10px] text-slate-500">{selectedCount} student selected</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
