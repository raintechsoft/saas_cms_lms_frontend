import { useEffect, useMemo, useRef, useState } from "react";
import {
  DescriptionOutlined,
  InfoOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { ListPagination } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { ExamWithGroup, Roster, ScheduleWithExam, Setup } from "./types";

function gradeForPercent(
  percent: number,
  grades: Setup["grades"],
  resultType: string,
): { name: string; tone: string } {
  const matched = grades
    .filter((grade) => grade.resultType === resultType)
    .find(
      (grade) => percent >= Number(grade.minPercent) && percent <= Number(grade.maxPercent),
    );
  if (!matched) {
    if (percent >= 90) return { name: "A+", tone: "bg-emerald-50 text-emerald-700" };
    if (percent >= 80) return { name: "A", tone: "bg-emerald-50 text-emerald-700" };
    if (percent >= 70) return { name: "B+", tone: "bg-blue-50 text-blue-700" };
    if (percent >= 60) return { name: "B", tone: "bg-blue-50 text-blue-700" };
    if (percent >= 50) return { name: "C", tone: "bg-amber-50 text-amber-700" };
    if (percent >= 40) return { name: "D", tone: "bg-orange-50 text-orange-700" };
    return { name: "F", tone: "bg-rose-50 text-rose-700" };
  }
  const name = matched.name;
  const tone =
    matched.passStatus === "FAIL"
      ? "bg-rose-50 text-rose-700"
      : name.startsWith("A")
        ? "bg-emerald-50 text-emerald-700"
        : name.startsWith("B")
          ? "bg-blue-50 text-blue-700"
          : name.startsWith("C")
            ? "bg-amber-50 text-amber-700"
            : "bg-orange-50 text-orange-700";
  return { name, tone };
}

function studentName(row: Roster) {
  return `${row.studentEnrollment.student.firstName} ${row.studentEnrollment.student.lastName ?? ""}`.trim();
}

export function MarksEntryPanel({
  setup,
  exams,
  schedules,
  token,
  onError,
  initialScheduleId = "",
  importRequestKey = 0,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  schedules: ScheduleWithExam[];
  token: string;
  onError: (message: string) => void;
  initialScheduleId?: string;
  importRequestKey?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = schedules.find((item) => item.id === initialScheduleId);

  const [groupId, setGroupId] = useState(initial?.exam.group.id ?? setup.groups[0]?.id ?? "");
  const [classId, setClassId] = useState(initial?.classSection.academicClass.id ?? "");
  const [classSectionId, setClassSectionId] = useState(initial?.classSection.id ?? "");
  const [scheduleId, setScheduleId] = useState(initialScheduleId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [componentScores, setComponentScores] = useState<Record<string, Record<string, string>>>({});
  const [singleScores, setSingleScores] = useState<Record<string, string>>({});
  const [absences, setAbsences] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [slipClassId, setSlipClassId] = useState("");
  const [slipSectionId, setSlipSectionId] = useState("");
  const [slipExamId, setSlipExamId] = useState("");

  useEffect(() => {
    if (!initialScheduleId) return;
    const schedule = schedules.find((item) => item.id === initialScheduleId);
    if (!schedule) return;
    setGroupId(schedule.exam.group.id);
    setClassId(schedule.classSection.academicClass.id);
    setClassSectionId(schedule.classSection.id);
    setScheduleId(schedule.id);
  }, [initialScheduleId, schedules]);

  useEffect(() => {
    if (importRequestKey > 0) fileRef.current?.click();
  }, [importRequestKey]);

  const classOptions = useMemo(() => {
    const map = new Map(setup.classSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () => setup.classSections.filter((item) => !classId || item.academicClass.id === classId),
    [setup.classSections, classId],
  );

  const subjectSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (groupId && schedule.exam.group.id !== groupId) return false;
        if (classSectionId && schedule.classSection.id !== classSectionId) return false;
        if (classId && !classSectionId && schedule.classSection.academicClass.id !== classId) {
          return false;
        }
        return true;
      }),
    [schedules, groupId, classId, classSectionId],
  );

  const selectedSchedule = schedules.find((item) => item.id === scheduleId) ?? null;
  const components = selectedSchedule?.components ?? [];
  const useComponents = components.length > 0;
  const maxTotal = useComponents
    ? components.reduce((sum, item) => sum + Number(item.maximumMarks), 0)
    : Number(selectedSchedule?.maximumMarks ?? 0);

  useEffect(() => {
    if (!scheduleId && subjectSchedules[0]) {
      setScheduleId(subjectSchedules[0].id);
      return;
    }
    if (scheduleId && !subjectSchedules.some((item) => item.id === scheduleId)) {
      setScheduleId(subjectSchedules[0]?.id ?? "");
    }
  }, [subjectSchedules, scheduleId]);

  useEffect(() => {
    if (!scheduleId) {
      setRoster([]);
      return;
    }
    void loadRoster(scheduleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, token]);

  async function loadRoster(id: string) {
    setLoading(true);
    try {
      const data = await apiRequest<Roster[]>(`/exams/schedules/${id}/roster`, token);
      setRoster(data);
      const nextSingle: Record<string, string> = {};
      const nextComponents: Record<string, Record<string, string>> = {};
      const nextAbsences: Record<string, boolean> = {};
      for (const row of data) {
        const mark = row.marks[0];
        nextAbsences[row.id] = mark?.isAbsent ?? false;
        nextSingle[row.id] = String(mark?.marksObtained ?? "0");
        const scores: Record<string, string> = {};
        for (const component of components) {
          const existing = mark?.componentScores?.find((item) => item.componentId === component.id);
          scores[component.id] = String(existing?.marks ?? "0");
        }
        nextComponents[row.id] = scores;
      }
      setSingleScores(nextSingle);
      setComponentScores(nextComponents);
      setAbsences(nextAbsences);
      setPage(1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load mark roster");
    } finally {
      setLoading(false);
    }
  }

  // Reload component score defaults when schedule components change after roster load
  useEffect(() => {
    if (!roster.length || !useComponents) return;
    setComponentScores((prev) => {
      const next = { ...prev };
      for (const row of roster) {
        const current = { ...(next[row.id] ?? {}) };
        for (const component of components) {
          if (current[component.id] === undefined) current[component.id] = "0";
        }
        next[row.id] = current;
      }
      return next;
    });
  }, [components, roster, useComponents]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter((row) => {
      const name = studentName(row).toLowerCase();
      const roll = (row.rollNumber ?? "").toLowerCase();
      const admission = row.studentEnrollment.student.admissionNumber.toLowerCase();
      return name.includes(q) || roll.includes(q) || admission.includes(q);
    });
  }, [roster, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
  const pageRows = filteredRoster.slice((page - 1) * pageSize, page * pageSize);

  function resetFilters() {
    setGroupId(setup.groups[0]?.id ?? "");
    setClassId("");
    setClassSectionId("");
    setScheduleId("");
    setSearch("");
    setPage(1);
  }

  function rowTotal(studentId: string) {
    if (absences[studentId]) return 0;
    if (useComponents) {
      return components.reduce(
        (sum, component) => sum + Number(componentScores[studentId]?.[component.id] ?? 0),
        0,
      );
    }
    return Number(singleScores[studentId] ?? 0);
  }

  async function saveMarks() {
    if (!selectedSchedule) return;
    setSaving(true);
    try {
      await apiRequest(`/exams/schedules/${selectedSchedule.id}/marks`, token, {
        method: "PUT",
        body: JSON.stringify({
          entries: roster.map((student) => {
            const isAbsent = absences[student.id] ?? false;
            const total = rowTotal(student.id);
            return {
              examStudentId: student.id,
              marksObtained: isAbsent ? 0 : total,
              isAbsent,
              componentScores: useComponents
                ? components.map((component) => ({
                    componentId: component.id,
                    marks: isAbsent ? 0 : Number(componentScores[student.id]?.[component.id] ?? 0),
                  }))
                : undefined,
            };
          }),
        }),
      });
      notifySuccess("Marks saved.");
      await loadRoster(selectedSchedule.id);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save marks");
    } finally {
      setSaving(false);
    }
  }

  async function importMarksCsv(file: File | undefined) {
    if (!file) return;
    try {
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes("admission") ? lines.slice(1) : lines;
      const nextSingle = { ...singleScores };
      const nextComponents = { ...componentScores };
      const nextAbsences = { ...absences };
      for (const line of dataLines) {
        const parts = line.split(",").map((value) => value.trim());
        const [admissionNumber, ...rest] = parts;
        const student = roster.find(
          (item) => item.studentEnrollment.student.admissionNumber === admissionNumber,
        );
        if (!student) continue;
        if (useComponents && rest.length >= components.length) {
          const scores: Record<string, string> = { ...(nextComponents[student.id] ?? {}) };
          components.forEach((component, index) => {
            scores[component.id] = rest[index] || "0";
          });
          nextComponents[student.id] = scores;
          const absentFlag = rest[components.length] ?? "0";
          nextAbsences[student.id] = ["1", "true", "yes", "absent"].includes(absentFlag.toLowerCase());
        } else {
          nextSingle[student.id] = rest[0] || "0";
          nextAbsences[student.id] = ["1", "true", "yes", "absent"].includes(
            (rest[1] ?? "").toLowerCase(),
          );
        }
      }
      setSingleScores(nextSingle);
      setComponentScores(nextComponents);
      setAbsences(nextAbsences);
      notifySuccess("CSV imported. Review and save the marks.");
    } catch {
      onError(
        useComponents
          ? "Unable to read CSV. Use admissionNumber,component1,component2,...,absent(0/1)."
          : "Unable to read CSV. Use admissionNumber,marks,absent(0/1).",
      );
    }
  }

  async function generateSlips() {
    const exam = exams.find((item) => item.id === slipExamId);
    const classSection = setup.classSections.find((item) => item.id === slipSectionId);
    if (!exam || !classSection) {
      onError("Select class, section, and exam to generate slips.");
      return;
    }
    const examSchedules = schedules.filter(
      (schedule) =>
        schedule.exam.id === slipExamId && schedule.classSection.id === slipSectionId,
    );
    if (!examSchedules.length) {
      onError("No scheduled subjects found for this class section and exam.");
      return;
    }
    let students = roster;
    try {
      students = await apiRequest<Roster[]>(
        `/exams/schedules/${examSchedules[0].id}/roster`,
        token,
      );
    } catch {
      students = roster;
    }
    if (!students.length) {
      onError("No students assigned for this exam class section yet.");
      return;
    }

    const html = `
      <html><head><title>Exam Slips - ${exam.name}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}
        .slip{border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin-bottom:16px;page-break-inside:avoid}
        h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:0 0 12px;color:#475569}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
        th{background:#f8fafc}
      </style></head><body>
      ${students
        .map((student) => {
          const name = studentName(student);
          return `<div class="slip">
            <h1>${exam.name}</h1>
            <h2>${classSection.academicClass.name} - ${classSection.section.name} · ${name} · Roll ${student.rollNumber ?? "—"}</h2>
            <table><thead><tr><th>Subject</th><th>Mark Fields</th><th>Max</th></tr></thead>
            <tbody>
              ${examSchedules
                .map((schedule) => {
                  const fields =
                    schedule.components?.length
                      ? schedule.components.map((c) => `${c.name} (${c.maximumMarks})`).join(", ")
                      : `Marks (${schedule.maximumMarks})`;
                  const max = schedule.components?.length
                    ? schedule.components.reduce((s, c) => s + Number(c.maximumMarks), 0)
                    : schedule.maximumMarks;
                  return `<tr><td>${schedule.classSubject.subject.name}</td><td>${fields}</td><td>${max}</td></tr>`;
                })
                .join("")}
            </tbody></table>
          </div>`;
        })
        .join("")}
      </body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      onError("Pop-up blocked. Allow pop-ups to print exam slips.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const subjectHeader = selectedSchedule
    ? `${selectedSchedule.classSubject.subject.name}${
        useComponents
          ? ""
          : ` (${selectedSchedule.maximumMarks})`
      }`
    : "Subject";

  const resultType = selectedSchedule?.exam.group.resultType ?? "SCHOOL_GRADING";

  return (
    <section className="mt-5 space-y-4">
      <input
        ref={fileRef}
        className="hidden"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          void importMarksCsv(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="nx-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 sm:max-w-[220px]">
            <span className="nx-label !normal-case !tracking-normal">Exam Group</span>
            <select
              className="nx-input bg-white"
              value={groupId}
              onChange={(event) => {
                setGroupId(event.target.value);
                setScheduleId("");
              }}
            >
              <option value="">All groups</option>
              {setup.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px] flex-1 sm:max-w-[170px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={classId}
              onChange={(event) => {
                const next = event.target.value;
                setClassId(next);
                const first = setup.classSections.find((item) => item.academicClass.id === next);
                setClassSectionId(first?.id ?? "");
                setScheduleId("");
              }}
            >
              <option value="">All classes</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1 sm:max-w-[140px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={classSectionId}
              disabled={!classId}
              onChange={(event) => {
                setClassSectionId(event.target.value);
                setScheduleId("");
              }}
            >
              <option value="">All sections</option>
              {sectionOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[200px] flex-1 sm:max-w-[260px]">
            <span className="nx-label !normal-case !tracking-normal">Subject</span>
            <select
              className="nx-input bg-white"
              value={scheduleId}
              onChange={(event) => setScheduleId(event.target.value)}
            >
              <option value="">Select subject schedule</option>
              {subjectSchedules.map((schedule) => {
                const fields = schedule.components?.length
                  ? schedule.components.map((item) => item.name).join(" + ")
                  : "Marks";
                return (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.classSubject.subject.name}
                    {fields ? ` (${fields})` : ""} · {schedule.exam.name}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="relative min-w-[200px] flex-1">
            <SearchOutlined
              sx={{ fontSize: 17 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input bg-white pl-9"
              placeholder="Search by name or roll no..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <button type="button" className="nx-btn-secondary" onClick={resetFilters}>
            <RefreshOutlined sx={{ fontSize: 16 }} /> Reset
          </button>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[900px]">
            <thead>
              <tr>
                <th rowSpan={useComponents ? 2 : 1} className="w-12">
                  #
                </th>
                <th rowSpan={useComponents ? 2 : 1}>Student Name</th>
                <th rowSpan={useComponents ? 2 : 1}>Roll No</th>
                {useComponents ? (
                  <th colSpan={components.length} className="text-center">
                    {subjectHeader}
                  </th>
                ) : (
                  <th>{subjectHeader}</th>
                )}
                <th rowSpan={useComponents ? 2 : 1}>Total ({maxTotal || "—"})</th>
                <th rowSpan={useComponents ? 2 : 1}>Grade</th>
                <th rowSpan={useComponents ? 2 : 1} className="w-10" aria-label="Info" />
              </tr>
              {useComponents ? (
                <tr>
                  {components.map((component) => (
                    <th key={component.id}>
                      {component.name} ({component.maximumMarks})
                    </th>
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const total = rowTotal(row.id);
                const percent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                const grade = gradeForPercent(percent, setup.grades, resultType);
                return (
                  <tr key={row.id}>
                    <td className="text-center text-slate-600">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="font-semibold text-slate-800">{studentName(row)}</td>
                    <td>{row.rollNumber ?? "—"}</td>
                    {useComponents ? (
                      components.map((component) => (
                        <td key={component.id}>
                          <input
                            className="nx-input !py-1.5"
                            type="number"
                            min="0"
                            max={Number(component.maximumMarks)}
                            disabled={absences[row.id]}
                            value={componentScores[row.id]?.[component.id] ?? "0"}
                            onChange={(event) =>
                              setComponentScores((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] ?? {}),
                                  [component.id]: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      ))
                    ) : (
                      <td>
                        <input
                          className="nx-input !py-1.5"
                          type="number"
                          min="0"
                          max={Number(selectedSchedule?.maximumMarks ?? 0)}
                          disabled={absences[row.id]}
                          value={singleScores[row.id] ?? "0"}
                          onChange={(event) =>
                            setSingleScores((prev) => ({ ...prev, [row.id]: event.target.value }))
                          }
                        />
                      </td>
                    )}
                    <td className="font-semibold text-emerald-600">{absences[row.id] ? "Absent" : total}</td>
                    <td>
                      {absences[row.id] ? (
                        <span className="nx-pill nx-pill-neutral">AB</span>
                      ) : (
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${grade.tone}`}>
                          {grade.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <label className="inline-flex cursor-pointer items-center text-slate-400" title="Mark absent">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={absences[row.id] ?? false}
                          onChange={(event) =>
                            setAbsences((prev) => ({ ...prev, [row.id]: event.target.checked }))
                          }
                        />
                        <InfoOutlined
                          sx={{ fontSize: 16 }}
                          className={absences[row.id] ? "text-rose-500" : undefined}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
              {!loading && !pageRows.length ? (
                <tr>
                  <td
                    colSpan={(useComponents ? components.length : 1) + 6}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    {scheduleId
                      ? "No students assigned for this schedule."
                      : "Select exam group, class, section, and subject to enter marks."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={filteredRoster.length}
              onPageChange={(next) => setPage(Math.min(next, pageCount))}
              label="students"
            />
            <label className="flex items-center gap-2 text-[12px] text-slate-500">
              <select
                className="nx-input !w-auto !py-1"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="nx-btn-primary"
            disabled={!roster.length || saving || selectedSchedule?.exam.status === "PUBLISHED"}
            onClick={() => void saveMarks()}
          >
            {saving ? "Saving…" : "Save marks"}
          </button>
        </div>
      </div>

      <div className="nx-card p-4">
        <h3 className="text-[15px] font-bold text-slate-900">Exam Slip Printing</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Generate subject slips for students to reference during mark entry.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={slipClassId}
              onChange={(event) => {
                setSlipClassId(event.target.value);
                const first = setup.classSections.find(
                  (item) => item.academicClass.id === event.target.value,
                );
                setSlipSectionId(first?.id ?? "");
              }}
            >
              <option value="">Select class</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[120px] flex-1 sm:max-w-[150px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={slipSectionId}
              disabled={!slipClassId}
              onChange={(event) => setSlipSectionId(event.target.value)}
            >
              <option value="">Select section</option>
              {setup.classSections
                .filter((item) => item.academicClass.id === slipClassId)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.section.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-[180px] flex-1 sm:max-w-[240px]">
            <span className="nx-label !normal-case !tracking-normal">Exam</span>
            <select
              className="nx-input bg-white"
              value={slipExamId}
              onChange={(event) => setSlipExamId(event.target.value)}
            >
              <option value="">Select exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="nx-btn-primary" onClick={() => void generateSlips()}>
            <DescriptionOutlined sx={{ fontSize: 16 }} /> Generate Slips
          </button>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          <InfoOutlined sx={{ fontSize: 15 }} className="mt-0.5 shrink-0" />
          Generates one slip per student listing their subjects and mark fields for mark entry
          reference.
        </div>
      </div>
    </section>
  );
}
