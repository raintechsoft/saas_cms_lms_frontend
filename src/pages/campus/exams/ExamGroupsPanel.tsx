import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CloseOutlined,
  DeleteOutline,
  EditOutlined,
  ExpandLess,
  ExpandMore,
  InfoOutlined,
  LinkOutlined,
  MenuBookOutlined,
  MoreVert,
  PersonAddAlt1Outlined,
  PersonOutlined,
  RateReviewOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { Exam, ExamGroup, ExamResultType, Result, Setup } from "./types";
import {
  formatDateRange,
  groupStatus,
  groupStatusLabel,
  groupStatusPillClass,
  nestedRowsForGroup,
  resultTypeLabel,
  resultTypePillClass,
  today,
  toDateInput,
} from "./utils";

const RESULT_TYPES: ExamResultType[] = ["GENERAL", "SCHOOL_GRADING", "COLLEGE_GRADING", "GPA"];

export function ExamGroupsPanel({
  setup,
  token,
  createGroupOpen,
  onCloseCreateGroup,
  onSaved,
  onError,
  onOpenSchedule,
  onOpenMarks,
  onOpenGroupResults,
}: {
  setup: Setup;
  token: string;
  createGroupOpen: boolean;
  onCloseCreateGroup: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onOpenSchedule: (examId: string, classSectionId?: string) => void;
  onOpenMarks: (scheduleId: string) => void;
  onOpenGroupResults: (groupId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(setup.groups[0]?.id ?? null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [linkExamIds, setLinkExamIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergePreview, setMergePreview] = useState<Result[] | null>(null);

  const [groupForm, setGroupForm] = useState({
    academicSessionId: setup.currentSession?.id ?? "",
    name: "",
    resultType: "SCHOOL_GRADING" as string,
  });
  const [editingGroup, setEditingGroup] = useState<ExamGroup | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({ name: "", resultType: "SCHOOL_GRADING" });

  const [examModalGroupId, setExamModalGroupId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({ name: "", startDate: today, endDate: today });
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editExamForm, setEditExamForm] = useState({ name: "", startDate: today, endDate: today });
  const [saving, setSaving] = useState(false);

  const allExams = useMemo(
    () => setup.groups.flatMap((group) => group.exams.map((exam) => ({ ...exam, group }))),
    [setup.groups],
  );

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/exams/groups", token, {
        method: "POST",
        body: JSON.stringify(groupForm),
      });
      setGroupForm({
        academicSessionId: setup.currentSession?.id ?? "",
        name: "",
        resultType: "SCHOOL_GRADING",
      });
      onCloseCreateGroup();
      notifySuccess("Exam group created.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create exam group");
    } finally {
      setSaving(false);
    }
  }

  function openEditGroup(group: ExamGroup) {
    setEditingGroup(group);
    setEditGroupForm({ name: group.name, resultType: group.resultType });
    setMenuOpenId(null);
  }

  async function saveEditGroup(event: FormEvent) {
    event.preventDefault();
    if (!editingGroup) return;
    setSaving(true);
    try {
      await apiRequest(`/exams/groups/${editingGroup.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name: editGroupForm.name.trim(),
          resultType: editGroupForm.resultType,
        }),
      });
      setEditingGroup(null);
      notifySuccess("Exam group updated.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update exam group");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(group: ExamGroup) {
    setMenuOpenId(null);
    if (group.exams.length > 0) {
      onError("Remove all exams from this group before deleting it.");
      return;
    }
    const ok = await confirmDelete({
      title: "Delete exam group?",
      text: `"${group.name}" will be permanently deleted.`,
    });
    if (!ok) return;
    setBusyKey(`group-del-${group.id}`);
    try {
      await apiRequest(`/exams/groups/${group.id}`, token, { method: "DELETE" });
      notifySuccess("Exam group deleted.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete exam group");
    } finally {
      setBusyKey("");
    }
  }

  async function createExam(event: FormEvent) {
    event.preventDefault();
    if (!examModalGroupId) return;
    setSaving(true);
    try {
      await apiRequest("/exams", token, {
        method: "POST",
        body: JSON.stringify({
          examGroupId: examModalGroupId,
          name: examForm.name.trim(),
          startDate: examForm.startDate,
          endDate: examForm.endDate,
        }),
      });
      setExamForm({ name: "", startDate: today, endDate: today });
      setExamModalGroupId(null);
      notifySuccess("Exam created.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create exam");
    } finally {
      setSaving(false);
    }
  }

  function openEditExam(exam: Exam) {
    if (exam.status === "ARCHIVED") return;
    setEditingExam(exam);
    setEditExamForm({
      name: exam.name,
      startDate: toDateInput(exam.startDate),
      endDate: toDateInput(exam.endDate),
    });
  }

  async function saveEditExam(event: FormEvent) {
    event.preventDefault();
    if (!editingExam) return;
    setSaving(true);
    try {
      await apiRequest(`/exams/${editingExam.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name: editExamForm.name.trim(),
          startDate: editExamForm.startDate,
          endDate: editExamForm.endDate,
        }),
      });
      setEditingExam(null);
      notifySuccess("Exam updated.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update exam");
    } finally {
      setSaving(false);
    }
  }

  async function archiveExam(exam: Exam) {
    if (exam.status === "ARCHIVED") return;
    setBusyKey(`archive-${exam.id}`);
    try {
      await apiRequest(`/exams/${exam.id}/archive`, token, { method: "PUT" });
      notifySuccess("Exam archived.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to archive exam");
    } finally {
      setBusyKey("");
    }
  }

  async function removeExam(exam: Exam) {
    if (exam.status === "PUBLISHED") {
      onError("Published exams cannot be deleted. Archive them instead.");
      return;
    }
    const ok = await confirmDelete({
      title: "Delete exam?",
      text: `"${exam.name}" will be permanently deleted.`,
    });
    if (!ok) return;
    setBusyKey(`exam-del-${exam.id}`);
    try {
      await apiRequest(`/exams/${exam.id}`, token, { method: "DELETE" });
      notifySuccess("Exam deleted.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete exam");
    } finally {
      setBusyKey("");
    }
  }

  async function assignStudents(examId: string, classSectionId: string) {
    if (!classSectionId) {
      onError("Schedule a class section before assigning students.");
      return;
    }
    setBusyKey(`assign-${examId}-${classSectionId}`);
    try {
      await apiRequest(`/exams/${examId}/students`, token, {
        method: "POST",
        body: JSON.stringify({ classSectionId }),
      });
      notifySuccess("Students assigned to this exam.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to assign students");
    } finally {
      setBusyKey("");
    }
  }

  function toggleLinkExam(examId: string) {
    setLinkExamIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId],
    );
    setMergePreview(null);
  }

  function removeLinkExam(examId: string) {
    setLinkExamIds((prev) => prev.filter((id) => id !== examId));
    setMergePreview(null);
  }

  async function mergeLinkedExams() {
    if (linkExamIds.length < 2) {
      onError("Select two or more exams to merge their results.");
      return;
    }
    const selected = allExams.filter((exam) => linkExamIds.includes(exam.id));
    const groupIds = [...new Set(selected.map((exam) => exam.group.id))];
    if (groupIds.length !== 1) {
      onError("Selected exams must belong to the same exam group.");
      return;
    }
    setMerging(true);
    try {
      const reports = await Promise.all(
        selected.map((exam) =>
          apiRequest<{ results: Result[] }>(`/exams/${exam.id}/results`, token),
        ),
      );
      const combined = new Map<
        string,
        Result & { obtainedMarks: number; maximumMarks: number; percentage: number }
      >();
      for (const report of reports) {
        for (const row of report.results) {
          const key = row.student.admissionNumber;
          const current = combined.get(key);
          if (!current) {
            combined.set(key, { ...row });
            continue;
          }
          current.obtainedMarks += row.obtainedMarks;
          current.maximumMarks += row.maximumMarks;
          current.percentage = current.maximumMarks
            ? Number(((current.obtainedMarks / current.maximumMarks) * 100).toFixed(2))
            : 0;
          if (row.passStatus === "FAIL") current.passStatus = "FAIL";
        }
      }
      const merged = [...combined.values()].sort((a, b) => b.obtainedMarks - a.obtainedMarks);
      let rank = 0;
      let last: number | null = null;
      const ranked = merged.map((row, index) => {
        if (row.obtainedMarks !== last) rank = index + 1;
        last = row.obtainedMarks;
        return { ...row, rank };
      });
      setMergePreview(ranked.slice(0, 8));
      notifySuccess(`Merged results for ${selected.length} selected exams.`);
      onOpenGroupResults(groupIds[0]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to merge exam results");
    } finally {
      setMerging(false);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[960px]">
            <thead>
              <tr>
                <th className="w-10" aria-label="Expand" />
                <th>Exam Name</th>
                <th>Exam Type</th>
                <th>Session</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {setup.groups.map((group) => {
                const status = groupStatus(group);
                const expanded = expandedId === group.id;
                const nested = nestedRowsForGroup(group);
                return (
                  <Fragment key={group.id}>
                    <tr className={expanded ? "bg-indigo-50/20" : undefined}>
                      <td>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-500 hover:bg-slate-100"
                          onClick={() => setExpandedId(expanded ? null : group.id)}
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                        </button>
                      </td>
                      <td className="font-semibold text-slate-900">{group.name}</td>
                      <td>
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-semibold ${resultTypePillClass(group.resultType)}`}
                        >
                          {resultTypeLabel(group.resultType)}
                        </span>
                      </td>
                      <td className="text-slate-600">{group.academicSession.name}</td>
                      <td>
                        <span className={`nx-pill ${groupStatusPillClass(status)}`}>
                          {groupStatusLabel(status)}
                        </span>
                      </td>
                      <td>
                        <div className="relative flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            onClick={() => {
                              setExpandedId(group.id);
                              setExamModalGroupId(group.id);
                            }}
                          >
                            <PersonOutlined sx={{ fontSize: 14 }} /> Manage Exams
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            onClick={() => openEditGroup(group)}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} /> Edit
                          </button>
                          <button
                            type="button"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                            onClick={() => setMenuOpenId(menuOpenId === group.id ? null : group.id)}
                            aria-label="More actions"
                          >
                            <MoreVert sx={{ fontSize: 18 }} />
                          </button>
                          {menuOpenId === group.id ? (
                            <div className="absolute right-0 top-9 z-20 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                onClick={() => {
                                  setExamModalGroupId(group.id);
                                  setMenuOpenId(null);
                                }}
                              >
                                Add exam
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-50"
                                disabled={busyKey === `group-del-${group.id}`}
                                onClick={() => void removeGroup(group)}
                              >
                                Delete group
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr>
                        <td colSpan={6} className="bg-slate-50/70 p-0">
                          <div className="border-t border-slate-100 px-4 py-3">
                            {!nested.length ? (
                              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6">
                                <p className="text-[13px] text-slate-500">No exams in this group yet.</p>
                                <button
                                  type="button"
                                  className="nx-btn-primary !py-1.5"
                                  onClick={() => setExamModalGroupId(group.id)}
                                >
                                  <AddOutlined sx={{ fontSize: 16 }} /> Add exam
                                </button>
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <table className="nx-table min-w-[880px]">
                                  <thead>
                                    <tr>
                                      <th>Exam Name</th>
                                      <th>Class/Section</th>
                                      <th>Subject Count</th>
                                      <th>Date Range</th>
                                      <th className="text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nested.map((row) => (
                                      <tr key={row.key}>
                                        <td className="font-medium text-slate-800">{row.exam.name}</td>
                                        <td>{row.classLabel}</td>
                                        <td>
                                          {row.subjectCount
                                            ? `${row.subjectCount} Subject${row.subjectCount === 1 ? "" : "s"}`
                                            : "—"}
                                        </td>
                                        <td className="whitespace-nowrap text-slate-600">
                                          {formatDateRange(row.dateStart, row.dateEnd)}
                                        </td>
                                        <td>
                                          <div className="flex flex-wrap justify-end gap-2">
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                                              disabled={busyKey === `assign-${row.exam.id}-${row.classSectionId}`}
                                              onClick={() =>
                                                void assignStudents(row.exam.id, row.classSectionId)
                                              }
                                            >
                                              <PersonAddAlt1Outlined sx={{ fontSize: 13 }} /> Assign Students
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                                              onClick={() =>
                                                onOpenSchedule(row.exam.id, row.classSectionId || undefined)
                                              }
                                            >
                                              <MenuBookOutlined sx={{ fontSize: 13 }} /> Exam Subjects
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50"
                                              disabled={!row.firstScheduleId}
                                              onClick={() => {
                                                if (row.firstScheduleId) onOpenMarks(row.firstScheduleId);
                                              }}
                                            >
                                              <RateReviewOutlined sx={{ fontSize: 13 }} /> Enter Marks
                                            </button>
                                            {row.exam.status !== "ARCHIVED" ? (
                                              <button
                                                type="button"
                                                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
                                                onClick={() => openEditExam(row.exam)}
                                                aria-label="Edit exam"
                                              >
                                                <EditOutlined sx={{ fontSize: 14 }} />
                                              </button>
                                            ) : null}
                                            {row.exam.status !== "ARCHIVED" ? (
                                              <button
                                                type="button"
                                                className="rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                                                disabled={busyKey === `archive-${row.exam.id}`}
                                                onClick={() => void archiveExam(row.exam)}
                                              >
                                                Archive
                                              </button>
                                            ) : null}
                                            {row.exam.status !== "PUBLISHED" ? (
                                              <button
                                                type="button"
                                                className="rounded border border-rose-200 p-1 text-rose-500 hover:bg-rose-50"
                                                disabled={busyKey === `exam-del-${row.exam.id}`}
                                                onClick={() => void removeExam(row.exam)}
                                                aria-label="Delete exam"
                                              >
                                                <DeleteOutline sx={{ fontSize: 14 }} />
                                              </button>
                                            ) : null}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {!setup.groups.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No exam groups yet. Create one with “New exam group”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="nx-card p-4">
        <h3 className="text-[15px] font-bold text-slate-900">Link Exams</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Select two or more exams to merge their results.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1">
            <span className="nx-label">Select Exams *</span>
            <select
              className="nx-input"
              value=""
              onChange={(event) => {
                if (event.target.value) toggleLinkExam(event.target.value);
              }}
            >
              <option value="">Add an exam…</option>
              {allExams
                .filter((exam) => !linkExamIds.includes(exam.id))
                .map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name} · {exam.group.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="nx-btn-primary"
            disabled={merging || linkExamIds.length < 2}
            onClick={() => void mergeLinkedExams()}
          >
            <LinkOutlined sx={{ fontSize: 16 }} />
            {merging ? "Merging…" : "Merge Selected Exams"}
          </button>
        </div>
        {linkExamIds.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {linkExamIds.map((id) => {
              const exam = allExams.find((item) => item.id === id);
              if (!exam) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                  onClick={() => removeLinkExam(id)}
                >
                  {exam.name}
                  <CloseOutlined sx={{ fontSize: 12 }} />
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          <InfoOutlined sx={{ fontSize: 15 }} className="mt-0.5 shrink-0" />
          Works best with School-Based Grading; result uses the last linked exam.
        </div>
        {mergePreview?.length ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="nx-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Marks</th>
                  <th>%</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {mergePreview.map((result) => (
                  <tr key={result.examStudentId}>
                    <td>#{result.rank}</td>
                    <td>
                      {result.student.firstName} {result.student.lastName ?? ""}
                    </td>
                    <td>
                      {result.obtainedMarks}/{result.maximumMarks}
                    </td>
                    <td>{result.percentage}%</td>
                    <td>
                      <span
                        className={`nx-pill ${
                          result.passStatus === "PASS" ? "nx-pill-success" : "nx-pill-danger"
                        }`}
                      >
                        {result.passStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {createGroupOpen ? (
        <Modal title="New exam group" onClose={onCloseCreateGroup}>
          <form className="space-y-3" onSubmit={(event) => void createGroup(event)}>
            <label className="block">
              <span className="nx-label">Academic session</span>
              <select
                className="nx-input"
                required
                value={groupForm.academicSessionId}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, academicSessionId: event.target.value })
                }
              >
                <option value="">Select session</option>
                {setup.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="nx-label">Exam group name</span>
              <input
                className="nx-input"
                required
                placeholder="Annual Examination 2024-25"
                value={groupForm.name}
                onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="nx-label">Exam type</span>
              <select
                className="nx-input"
                value={groupForm.resultType}
                onChange={(event) => setGroupForm({ ...groupForm, resultType: event.target.value })}
              >
                {RESULT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {resultTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create exam group"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editingGroup ? (
        <Modal title="Edit exam group" onClose={() => setEditingGroup(null)}>
          <form className="space-y-3" onSubmit={(event) => void saveEditGroup(event)}>
            <label className="block">
              <span className="nx-label">Exam group name</span>
              <input
                className="nx-input"
                required
                value={editGroupForm.name}
                onChange={(event) =>
                  setEditGroupForm({ ...editGroupForm, name: event.target.value })
                }
              />
            </label>
            <label className="block">
              <span className="nx-label">Exam type</span>
              <select
                className="nx-input"
                value={editGroupForm.resultType}
                onChange={(event) =>
                  setEditGroupForm({ ...editGroupForm, resultType: event.target.value })
                }
              >
                {RESULT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {resultTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[12px] text-slate-500">
              Session: {editingGroup.academicSession.name} (cannot be changed)
            </p>
            <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Modal>
      ) : null}

      {examModalGroupId ? (
        <Modal title="Add exam" onClose={() => setExamModalGroupId(null)}>
          <form className="space-y-3" onSubmit={(event) => void createExam(event)}>
            <label className="block">
              <span className="nx-label">Exam name</span>
              <input
                className="nx-input"
                required
                placeholder="Annual Examination 2024-25"
                value={examForm.name}
                onChange={(event) => setExamForm({ ...examForm, name: event.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="nx-label">Start date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={examForm.startDate}
                  onChange={(event) => setExamForm({ ...examForm, startDate: event.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">End date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={examForm.endDate}
                  onChange={(event) => setExamForm({ ...examForm, endDate: event.target.value })}
                />
              </label>
            </div>
            <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create exam"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editingExam ? (
        <Modal title="Edit exam" onClose={() => setEditingExam(null)}>
          <form className="space-y-3" onSubmit={(event) => void saveEditExam(event)}>
            <label className="block">
              <span className="nx-label">Exam name</span>
              <input
                className="nx-input"
                required
                value={editExamForm.name}
                onChange={(event) => setEditExamForm({ ...editExamForm, name: event.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="nx-label">Start date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={editExamForm.startDate}
                  onChange={(event) =>
                    setEditExamForm({ ...editExamForm, startDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="nx-label">End date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={editExamForm.endDate}
                  onChange={(event) =>
                    setEditExamForm({ ...editExamForm, endDate: event.target.value })
                  }
                />
              </label>
            </div>
            <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
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
            aria-label="Close"
          >
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
