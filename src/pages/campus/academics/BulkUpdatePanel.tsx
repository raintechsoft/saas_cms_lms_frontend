import { useEffect, useMemo, useState } from "react";
import {
  AccountCircleOutlined,
  CalendarMonthOutlined,
  CurrencyRupeeOutlined,
  GroupsOutlined,
  InfoOutlined,
  MenuBookOutlined,
  PreviewOutlined,
  SaveOutlined,
  SearchOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, BulkUpdateType, ClassSection, StudentListItem } from "./types";
import { studentDisplayName } from "./utils";

const MODES: Array<{ key: BulkUpdateType; label: string; description: string }> = [
  { key: "SECTION_MOVE", label: "Update Class / Section", description: "Move or update students to different class or section." },
  { key: "SUBJECT_ASSIGN", label: "Update Subject", description: "Add, remove or update subjects for students." },
  { key: "CONCESSION", label: "Update Fees Concession", description: "Apply or update concession for multiple students." },
  { key: "SESSION_CLASS", label: "Update Session", description: "Update academic session for students." },
  { key: "STATUS", label: "Update Status", description: "Update active/inactive status for students." },
];

interface Row {
  studentId: string;
  enrollmentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string;
  selected: boolean;
}

interface Discount {
  id: string;
  name: string;
}

function modeIcon(mode: BulkUpdateType) {
  if (mode === "SECTION_MOVE") return <GroupsOutlined sx={{ fontSize: 20 }} />;
  if (mode === "SUBJECT_ASSIGN") return <MenuBookOutlined sx={{ fontSize: 20 }} />;
  if (mode === "CONCESSION") return <CurrencyRupeeOutlined sx={{ fontSize: 20 }} />;
  if (mode === "SESSION_CLASS") return <CalendarMonthOutlined sx={{ fontSize: 20 }} />;
  return <AccountCircleOutlined sx={{ fontSize: 20 }} />;
}

export function BulkUpdatePanel({
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
  const [mode, setMode] = useState<BulkUpdateType>("SECTION_MOVE");
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceClassSectionId, setSourceClassSectionId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);
  const [applying, setApplying] = useState(false);

  const [targetClassSectionId, setTargetClassSectionId] = useState("");

  const [newStatus, setNewStatus] = useState<"ACTIVE" | "ALUMNI" | "DISABLED">("DISABLED");
  const [disabledReason, setDisabledReason] = useState("");

  const [targetSessionId, setTargetSessionId] = useState("");
  const [targetSessionClassSections, setTargetSessionClassSections] = useState<ClassSection[]>([]);
  const [sessionTargetClassSectionId, setSessionTargetClassSectionId] = useState("");

  const [subjectId, setSubjectId] = useState("");
  const [subjectTeacherId, setSubjectTeacherId] = useState("");
  const [subjectMode, setSubjectMode] = useState<"ASSIGN" | "UNASSIGN">("ASSIGN");

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [feeDiscountId, setFeeDiscountId] = useState("");
  const [concessionSessionId, setConcessionSessionId] = useState(setup.currentSession?.id ?? "");

  const needsStudentSelection = mode !== "SUBJECT_ASSIGN";

  useEffect(() => {
    setRows([]);
    setSearch("");
  }, [mode, sourceClassSectionId]);

  useEffect(() => {
    if (mode !== "CONCESSION" || discounts.length) return;
    void apiRequest<{ discounts: Discount[] }>("/fees/setup", token)
      .then((data) => setDiscounts(data.discounts ?? []))
      .catch(() => setDiscounts([]));
  }, [mode, token, discounts.length]);

  useEffect(() => {
    if (mode !== "SESSION_CLASS" || !targetSessionId) {
      setTargetSessionClassSections([]);
      return;
    }
    void apiRequest<{ classSections: ClassSection[] }>(
      `/academics/setup?sessionId=${encodeURIComponent(targetSessionId)}`,
      token,
    )
      .then((data) => setTargetSessionClassSections(data.classSections ?? []))
      .catch(() => setTargetSessionClassSections([]));
  }, [mode, targetSessionId, token]);

  async function loadStudents() {
    if (!sourceClassSectionId) {
      onError("Select a source class section first.");
      return;
    }
    setLoadingRows(true);
    try {
      const limit = 100;
      const allItems: StudentListItem[] = [];
      let page = 1;
      for (;;) {
        const data = await apiRequest<{ items: StudentListItem[]; total: number }>(
          `/students?status=ACTIVE&classSectionId=${encodeURIComponent(sourceClassSectionId)}&page=${page}&limit=${limit}`,
          token,
        );
        allItems.push(...(data.items ?? []));
        if (!data.items?.length || data.items.length < limit || allItems.length >= (data.total ?? 0)) break;
        page += 1;
      }
      const sessionId = setup.currentSession?.id ?? "";
      const nextRows: Row[] = allItems
        .map((student) => {
          const enrollment = student.enrollments.find(
            (e) => e.classSection.id === sourceClassSectionId && (!sessionId || e.academicSession.id === sessionId),
          );
          if (!enrollment) return null;
          return {
            studentId: student.id,
            enrollmentId: enrollment.id,
            name: studentDisplayName(student),
            admissionNumber: student.admissionNumber,
            rollNumber: enrollment.rollNumber ?? "",
            selected: true,
          } satisfies Row;
        })
        .filter(Boolean) as Row[];
      setRows(nextRows);
      notifySuccess(`Loaded ${nextRows.length} students.`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load students");
    } finally {
      setLoadingRows(false);
    }
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.admissionNumber.toLowerCase().includes(q));
  }, [rows, search]);

  const selectedRows = rows.filter((r) => r.selected);
  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => r.selected);

  function toggleAll(checked: boolean) {
    const ids = new Set(filteredRows.map((r) => r.enrollmentId));
    setRows((prev) => prev.map((r) => (ids.has(r.enrollmentId) ? { ...r, selected: checked } : r)));
  }

  const sameClassTargets = useMemo(() => {
    const source = setup.classSections.find((cs) => cs.id === sourceClassSectionId);
    if (!source) return [];
    return setup.classSections.filter((cs) => cs.id !== source.id && cs.academicClass.id === source.academicClass.id);
  }, [setup.classSections, sourceClassSectionId]);

  const sourceClassSections = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === sourceClassId),
    [setup.classSections, sourceClassId],
  );
  const sourceClassSection = setup.classSections.find((item) => item.id === sourceClassSectionId);

  const previewText = useMemo(() => {
    switch (mode) {
      case "SECTION_MOVE": {
        const target = sameClassTargets.find((cs) => cs.id === targetClassSectionId);
        return target
          ? `Move ${selectedRows.length} student(s) to ${target.academicClass.name} · ${target.section.name}.`
          : "Select a target section.";
      }
      case "STATUS":
        return `Mark ${selectedRows.length} student(s) as ${newStatus}.`;
      case "SESSION_CLASS": {
        const target = targetSessionClassSections.find((cs) => cs.id === sessionTargetClassSectionId);
        const session = setup.sessions.find((s) => s.id === targetSessionId);
        return target && session
          ? `Move ${selectedRows.length} enrollment(s) to ${target.academicClass.name} · ${target.section.name} (${session.name}).`
          : "Select a target session and class section.";
      }
      case "SUBJECT_ASSIGN": {
        const cs = setup.classSections.find((x) => x.id === sourceClassSectionId);
        const subject = setup.subjects.find((s) => s.id === subjectId);
        if (!cs || !subject) return "Select a class section and subject.";
        return subjectMode === "ASSIGN"
          ? `Assign "${subject.name}" to ${cs.academicClass.name} · ${cs.section.name}.`
          : `Unassign "${subject.name}" from ${cs.academicClass.name} · ${cs.section.name}.`;
      }
      case "CONCESSION": {
        const discount = discounts.find((d) => d.id === feeDiscountId);
        return `${discount ? `Apply "${discount.name}"` : "Clear fee discount"} for ${selectedRows.length} student(s).`;
      }
      default:
        return "";
    }
  }, [
    mode,
    selectedRows.length,
    sameClassTargets,
    targetClassSectionId,
    newStatus,
    targetSessionClassSections,
    sessionTargetClassSectionId,
    setup.sessions,
    targetSessionId,
    setup.classSections,
    setup.subjects,
    sourceClassSectionId,
    subjectId,
    subjectMode,
    discounts,
    feeDiscountId,
  ]);

  async function apply() {
    if (needsStudentSelection && !selectedRows.length) {
      onError("Select at least one student.");
      return;
    }
    const ok = await confirmDelete({
      title: "Apply bulk update?",
      text: previewText,
      confirmText: "Apply",
    });
    if (!ok) return;

    setApplying(true);
    try {
      const payload: Record<string, unknown> = { updateType: mode, summary: previewText };
      if (mode === "SECTION_MOVE") {
        if (!targetClassSectionId) throw new Error("Select a target section.");
        payload.sectionMove = {
          fromClassSectionId: sourceClassSectionId,
          toClassSectionId: targetClassSectionId,
          items: selectedRows.map((r) => ({ studentEnrollmentId: r.enrollmentId, rollNumber: r.rollNumber || null })),
        };
      } else if (mode === "STATUS") {
        payload.statusUpdate = {
          studentIds: selectedRows.map((r) => r.studentId),
          status: newStatus,
          disabledReason: newStatus === "DISABLED" ? disabledReason.trim() || null : null,
        };
      } else if (mode === "SESSION_CLASS") {
        if (!targetSessionId || !sessionTargetClassSectionId) throw new Error("Select target session and class section.");
        payload.sessionClassUpdate = {
          academicSessionId: targetSessionId,
          classSectionId: sessionTargetClassSectionId,
          studentEnrollmentIds: selectedRows.map((r) => r.enrollmentId),
        };
      } else if (mode === "SUBJECT_ASSIGN") {
        if (!sourceClassSectionId || !subjectId) throw new Error("Select a class section and subject.");
        payload.subjectAssign = {
          classSectionId: sourceClassSectionId,
          subjectId,
          teacherId: subjectTeacherId || null,
          mode: subjectMode,
        };
      } else if (mode === "CONCESSION") {
        payload.concessionUpdate = {
          studentIds: selectedRows.map((r) => r.studentId),
          feeDiscountId: feeDiscountId || null,
          academicSessionId: concessionSessionId || setup.currentSession?.id || "",
        };
      }

      await apiRequest("/academics/bulk-update", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      notifySuccess("Bulk update applied.");
      setRows([]);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to apply bulk update");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-3">
        <h3 className="text-[13px] font-bold text-slate-900">1. Select Update Type</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {MODES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`flex min-h-[72px] items-center gap-3 rounded-lg border p-3 text-left transition ${
                mode === item.key
                  ? "border-indigo-400 bg-indigo-50/50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-indigo-200"
              }`}
              onClick={() => setMode(item.key)}
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  mode === item.key ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                }`}
              >
                {modeIcon(item.key)}
              </span>
              <span>
                <span className="block text-[11px] font-bold text-slate-800">{item.label}</span>
                <span className="mt-1 block text-[9px] leading-3 text-slate-500">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="nx-card p-3">
          <h3 className="text-[13px] font-bold text-slate-900">2. Select Students</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label>
              <span className="nx-label !normal-case !tracking-normal">Academic Year</span>
              <select className="nx-input bg-white" value={setup.currentSession?.id ?? ""} disabled>
                <option value={setup.currentSession?.id ?? ""}>{setup.currentSession?.name ?? "No session"}</option>
              </select>
            </label>
            <label>
              <span className="nx-label !normal-case !tracking-normal">Class</span>
              <select
                className="nx-input bg-white"
                value={sourceClassId}
                onChange={(event) => {
                  setSourceClassId(event.target.value);
                  setSourceClassSectionId("");
                }}
              >
                <option value="">All Classes</option>
                {setup.classes.map((academicClass) => (
                  <option key={academicClass.id} value={academicClass.id}>
                    {academicClass.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="nx-label !normal-case !tracking-normal">Section</span>
              <select
                className="nx-input bg-white"
                value={sourceClassSectionId}
                disabled={!sourceClassId}
                onChange={(event) => setSourceClassSectionId(event.target.value)}
              >
                <option value="">All Sections</option>
                {sourceClassSections.map((classSection) => (
                  <option key={classSection.id} value={classSection.id}>
                    {classSection.section.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 block">
            <span className="nx-label !normal-case !tracking-normal">Search Students</span>
            <div className="flex gap-3">
              <div className="relative min-w-0 flex-1">
              <SearchOutlined
                  sx={{ fontSize: 17 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                  className="nx-input bg-white pl-9"
                  placeholder="Search by name, admission no., roll no."
                value={search}
                  onChange={(event) => setSearch(event.target.value)}
              />
            </div>
              <button
                type="button"
                className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
                disabled={loadingRows || !sourceClassSectionId || !needsStudentSelection}
                onClick={() => void loadStudents()}
              >
                <SearchOutlined sx={{ fontSize: 16 }} />
                {loadingRows ? "Searching…" : "Search"}
              </button>
            </div>
          </label>
        </div>

        <div className="nx-card p-3">
          <h3 className="text-[13px] font-bold text-slate-900">3. Update Details</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {mode === "SECTION_MOVE" ? (
              <>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Move To Class</span>
                  <select className="nx-input bg-white" value={sourceClassId} disabled>
                    <option value={sourceClassId}>{sourceClassSection?.academicClass.name ?? "Select source"}</option>
                  </select>
                </label>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Move To Section</span>
                  <select
                    className="nx-input bg-white"
                    value={targetClassSectionId}
                    onChange={(event) => setTargetClassSectionId(event.target.value)}
                    disabled={!sourceClassSectionId}
                  >
                    <option value="">Select section</option>
                    {sameClassTargets.map((classSection) => (
                      <option key={classSection.id} value={classSection.id}>
                        {classSection.section.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {mode === "STATUS" ? (
              <>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">New Status</span>
                  <select
                    className="nx-input bg-white"
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value as typeof newStatus)}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="ALUMNI">Alumni</option>
                  </select>
                </label>
                {newStatus === "DISABLED" ? (
                  <label className="sm:col-span-2">
                    <span className="nx-label !normal-case !tracking-normal">Reason</span>
                    <input
                      className="nx-input bg-white"
                      value={disabledReason}
                      onChange={(event) => setDisabledReason(event.target.value)}
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {mode === "SESSION_CLASS" ? (
              <>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Target Session</span>
                  <select
                    className="nx-input bg-white"
                    value={targetSessionId}
                    onChange={(event) => {
                      setTargetSessionId(event.target.value);
                      setSessionTargetClassSectionId("");
                    }}
                  >
                    <option value="">Select session</option>
                    {setup.sessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.name}</option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="nx-label !normal-case !tracking-normal">Target Class / Section</span>
                  <select
                    className="nx-input bg-white"
                    value={sessionTargetClassSectionId}
                    disabled={!targetSessionId}
                    onChange={(event) => setSessionTargetClassSectionId(event.target.value)}
                  >
                    <option value="">Select class section</option>
                    {targetSessionClassSections.map((classSection) => (
                      <option key={classSection.id} value={classSection.id}>
                        {classSection.academicClass.name} - {classSection.section.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            {mode === "SUBJECT_ASSIGN" ? (
              <>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Subject</span>
                  <select className="nx-input bg-white" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                    <option value="">Select subject</option>
                    {setup.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Teacher</span>
                  <select
                    className="nx-input bg-white"
                    value={subjectTeacherId}
                    onChange={(event) => setSubjectTeacherId(event.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {setup.teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Action</span>
                  <select
                    className="nx-input bg-white"
                    value={subjectMode}
                    onChange={(event) => setSubjectMode(event.target.value as typeof subjectMode)}
                  >
                    <option value="ASSIGN">Assign</option>
                    <option value="UNASSIGN">Unassign</option>
                  </select>
                </label>
              </>
            ) : null}

            {mode === "CONCESSION" ? (
              <>
                <label>
                  <span className="nx-label !normal-case !tracking-normal">Academic Session</span>
                  <select className="nx-input bg-white" value={concessionSessionId} onChange={(event) => setConcessionSessionId(event.target.value)}>
                    <option value="">Select session</option>
                    {setup.sessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.name}</option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="nx-label !normal-case !tracking-normal">Fees Concession</span>
                  <select className="nx-input bg-white" value={feeDiscountId} onChange={(event) => setFeeDiscountId(event.target.value)}>
                    <option value="">Clear concession</option>
                    {discounts.map((discount) => (
                      <option key={discount.id} value={discount.id}>{discount.name}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded border border-blue-100 bg-blue-50/60 px-3 py-2 text-[10px] text-blue-700">
            <InfoOutlined sx={{ fontSize: 15 }} />
            {previewText}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-3">
            <h3 className="text-[13px] font-bold text-slate-900">4. Selected Students ({selectedRows.length})</h3>
          </div>
          <div className="overflow-x-auto p-2">
            <table className="nx-table !min-w-[680px]">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" checked={allSelected} disabled={!filteredRows.length} onChange={(event) => toggleAll(event.target.checked)} />
                  </th>
                  <th className="w-10">#</th>
                  <th>Student Name</th>
                  <th>Admission No.</th>
                  <th>Current Class - Section</th>
                  <th>Roll No.</th>
                  <th>Current Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={row.enrollmentId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(event) =>
                          setRows((previous) =>
                            previous.map((item) =>
                              item.enrollmentId === row.enrollmentId ? { ...item, selected: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="text-center font-medium text-slate-700">{index + 1}</td>
                    <td className="font-semibold text-slate-800">{row.name}</td>
                    <td className="font-medium text-slate-700">{row.admissionNumber}</td>
                    <td className="font-medium text-slate-700">
                      {sourceClassSection
                        ? `${sourceClassSection.academicClass.name} - ${sourceClassSection.section.name}`
                        : "—"}
                    </td>
                    <td className="font-medium text-slate-700">{row.rollNumber || "—"}</td>
                    <td><span className="nx-pill nx-pill-success">Active</span></td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      Search to load students.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {rows.length ? (
            <p className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
              Showing 1 to {filteredRows.length} of {rows.length} students
            </p>
          ) : null}
        </div>

        <aside className="nx-card self-start p-3">
          <h3 className="text-[13px] font-bold text-slate-900">Update Summary</h3>
          <dl className="mt-3 divide-y divide-slate-100 rounded border border-slate-200 px-2 text-[10px]">
            <div className="flex justify-between gap-3 py-2"><dt>Update Type</dt><dd className="font-semibold">{MODES.find((item) => item.key === mode)?.label}</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt>From</dt><dd className="font-semibold">{sourceClassSection ? `${sourceClassSection.academicClass.name} - ${sourceClassSection.section.name}` : "—"}</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt>Total Students</dt><dd className="font-semibold">{selectedRows.length}</dd></div>
          </dl>
          <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800">
            <WarningAmberOutlined sx={{ fontSize: 16 }} className="shrink-0" />
            Please review the details before applying bulk update. This action cannot be undone.
          </div>
          <button
            type="button"
            className="nx-btn-primary mt-3 w-full !py-1.5"
            onClick={() => notifySuccess(`Preview: ${previewText}`)}
          >
            <PreviewOutlined sx={{ fontSize: 15 }} />
            Preview Changes
          </button>
          {canManage ? (
            <button
              type="button"
              className="nx-btn-secondary mt-2 w-full border-indigo-300 bg-white text-indigo-700 !py-1.5"
              disabled={applying}
              onClick={() => void apply()}
            >
              <SaveOutlined sx={{ fontSize: 15 }} />
              {applying ? "Applying…" : "Apply Update"}
            </button>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
