import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AddOutlined,
  ArchiveOutlined,
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
  VisibilityOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { FieldError } from "../../../components/forms/Field";
import {
  applyApiFieldErrors,
  clearFieldError,
  type FieldErrors,
  validateRequired,
} from "../../../lib/formErrors";
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
const MENU_WIDTH = 176;

type ExamStudentRow = {
  id: string;
  rollNumber: string | null;
  studentEnrollment: {
    student: { firstName: string; lastName: string | null; admissionNumber: string };
    classSection: {
      academicClass: { name: string };
      section: { name: string };
    };
  };
};

function nullableDescription(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function menuPosition(anchor: HTMLElement, estimatedHeight: number) {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < estimatedHeight + 12;
  const top = openUp
    ? Math.max(8, rect.top - estimatedHeight - 6)
    : rect.bottom + 6;
  const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
  return { top, left };
}

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
  defaultResultType = "SCHOOL_GRADING",
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
  defaultResultType?: ExamResultType | string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(setup.groups[0]?.id ?? null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [busyKey, setBusyKey] = useState("");
  const [linkExamIds, setLinkExamIds] = useState<string[]>([]);
  const [linkName, setLinkName] = useState("");
  const [linkResultType, setLinkResultType] = useState<ExamResultType>("SCHOOL_GRADING");
  const [merging, setMerging] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [mergePreview, setMergePreview] = useState<Result[] | null>(null);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);

  const [groupForm, setGroupForm] = useState({
    academicSessionId: setup.currentSession?.id ?? "",
    name: "",
    description: "",
    resultType: (defaultResultType || "SCHOOL_GRADING") as string,
  });
  const [editingGroup, setEditingGroup] = useState<ExamGroup | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({
    name: "",
    description: "",
    resultType: (defaultResultType || "SCHOOL_GRADING") as string,
  });

  const [examModalGroupId, setExamModalGroupId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    name: "",
    description: "",
    startDate: today,
    endDate: today,
  });
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [editExamForm, setEditExamForm] = useState({
    name: "",
    description: "",
    startDate: today,
    endDate: today,
  });
  const [saving, setSaving] = useState(false);
  const [groupFieldErrors, setGroupFieldErrors] = useState<FieldErrors>({});
  const [editGroupFieldErrors, setEditGroupFieldErrors] = useState<FieldErrors>({});
  const [viewStudents, setViewStudents] = useState<{
    examId: string;
    examName: string;
    classSectionId: string;
  } | null>(null);
  const [viewStudentsRows, setViewStudentsRows] = useState<ExamStudentRow[]>([]);
  const [viewStudentsLoading, setViewStudentsLoading] = useState(false);

  const allExams = useMemo(
    () => setup.groups.flatMap((group) => group.exams.map((exam) => ({ ...exam, group }))),
    [setup.groups],
  );

  const activeGroupMenu = useMemo(
    () => setup.groups.find((group) => group.id === menuOpenId) ?? null,
    [menuOpenId, setup.groups],
  );

  const activeRowMenu = useMemo(() => {
    if (!rowMenuKey) return null;
    for (const group of setup.groups) {
      const row = nestedRowsForGroup(group).find((item) => item.key === rowMenuKey);
      if (row) return row;
    }
    return null;
  }, [rowMenuKey, setup.groups]);

  function closeMenus() {
    setMenuOpenId(null);
    setRowMenuKey(null);
    setMenuCoords(null);
  }

  function openGroupMenu(groupId: string, anchor: HTMLElement) {
    if (menuOpenId === groupId) {
      closeMenus();
      return;
    }
    setRowMenuKey(null);
    setMenuOpenId(groupId);
    setMenuCoords(menuPosition(anchor, 96));
  }

  function openRowMenu(menuKey: string, exam: Exam, anchor: HTMLElement) {
    if (rowMenuKey === menuKey) {
      closeMenus();
      return;
    }
    const itemCount =
      (exam.status !== "ARCHIVED" ? 2 : 0) + (exam.status !== "PUBLISHED" ? 1 : 0);
    setMenuOpenId(null);
    setRowMenuKey(menuKey);
    setMenuCoords(menuPosition(anchor, Math.max(48, itemCount * 40)));
  }

  useEffect(() => {
    if (!menuOpenId && !rowMenuKey) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-exam-action-menu]")) return;
      if (target?.closest("[data-exam-menu-trigger]")) return;
      closeMenus();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenus();
    }
    function onRepositionClose() {
      closeMenus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onRepositionClose, true);
    window.addEventListener("resize", onRepositionClose);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onRepositionClose, true);
      window.removeEventListener("resize", onRepositionClose);
    };
  }, [menuOpenId, rowMenuKey]);

  useEffect(() => {
    if (!createGroupOpen) return;
    setGroupFieldErrors({});
    setGroupForm({
      academicSessionId: setup.currentSession?.id ?? "",
      name: "",
      description: "",
      resultType: (defaultResultType || "SCHOOL_GRADING") as string,
    });
  }, [createGroupOpen, defaultResultType, setup.currentSession?.id]);

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const next = validateRequired(
      { academicSessionId: groupForm.academicSessionId, name: groupForm.name },
      [
        { key: "academicSessionId", label: "Academic session" },
        { key: "name", label: "Exam group name" },
      ],
    );
    setGroupFieldErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await apiRequest("/exams/groups", token, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: groupForm.academicSessionId,
          name: groupForm.name.trim(),
          resultType: groupForm.resultType,
          description: nullableDescription(groupForm.description),
        }),
      });
      setGroupForm({
        academicSessionId: setup.currentSession?.id ?? "",
        name: "",
        description: "",
        resultType: (defaultResultType || "SCHOOL_GRADING") as string,
      });
      onCloseCreateGroup();
      notifySuccess("Exam group created.");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setGroupFieldErrors)) {
        onError(cause instanceof Error ? cause.message : "Unable to create exam group");
      }
    } finally {
      setSaving(false);
    }
  }

  function openEditGroup(group: ExamGroup) {
    setEditGroupFieldErrors({});
    setEditingGroup(group);
    setEditGroupForm({
      name: group.name,
      description: group.description ?? "",
      resultType: group.resultType,
    });
    closeMenus();
  }

  async function saveEditGroup(event: FormEvent) {
    event.preventDefault();
    if (!editingGroup) return;
    const next = validateRequired({ name: editGroupForm.name }, [
      { key: "name", label: "Exam group name" },
    ]);
    setEditGroupFieldErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await apiRequest(`/exams/groups/${editingGroup.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name: editGroupForm.name.trim(),
          resultType: editGroupForm.resultType,
          description: nullableDescription(editGroupForm.description),
        }),
      });
      setEditingGroup(null);
      notifySuccess("Exam group updated.");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setEditGroupFieldErrors)) {
        onError(cause instanceof Error ? cause.message : "Unable to update exam group");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(group: ExamGroup) {
    closeMenus();
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
          description: nullableDescription(examForm.description),
        }),
      });
      setExamForm({ name: "", description: "", startDate: today, endDate: today });
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
      description: exam.description ?? "",
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
          description: nullableDescription(editExamForm.description),
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

  async function openViewStudents(exam: Exam, classSectionId: string) {
    setViewStudents({ examId: exam.id, examName: exam.name, classSectionId });
    setViewStudentsRows([]);
    setViewStudentsLoading(true);
    try {
      const query = classSectionId
        ? `?classSectionId=${encodeURIComponent(classSectionId)}`
        : "";
      const rows = await apiRequest<ExamStudentRow[]>(
        `/exams/${exam.id}/students${query}`,
        token,
      );
      setViewStudentsRows(rows);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load exam students");
      setViewStudents(null);
    } finally {
      setViewStudentsLoading(false);
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
    if (linkResultType === "SCHOOL_GRADING") {
      const sessions = [...new Set(selected.map((exam) => exam.group.academicSession.id))];
      if (sessions.length > 1) {
        onError("School grading links require exams in the same academic session.");
        return;
      }
    }
    setMerging(true);
    try {
      const name =
        linkName.trim() ||
        `Linked · ${selected.map((exam) => exam.name).join(" + ")}`.slice(0, 100);
      const created = await apiRequest<{ id: string }>(`/exams/links`, token, {
        method: "POST",
        body: JSON.stringify({
          name,
          resultType: linkResultType,
          examIds: linkExamIds,
        }),
      });
      const report = await apiRequest<{ results: Result[] }>(
        `/exams/links/${created.id}/results`,
        token,
      );
      setActiveLinkId(created.id);
      setMergePreview(report.results.slice(0, 8));
      notifySuccess(`Saved link and loaded results for ${selected.length} exams.`);
      await onSaved();
      if (groupIds.length === 1) onOpenGroupResults(groupIds[0]!);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to link exam results");
    } finally {
      setMerging(false);
    }
  }

  async function openSavedLink(linkId: string) {
    setSavingLink(true);
    try {
      const report = await apiRequest<{ results: Result[]; link: { examIds: string[] } }>(
        `/exams/links/${linkId}/results`,
        token,
      );
      setActiveLinkId(linkId);
      setLinkExamIds(report.link.examIds ?? []);
      setMergePreview(report.results.slice(0, 8));
      notifySuccess("Loaded linked exam results.");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load linked results");
    } finally {
      setSavingLink(false);
    }
  }

  async function removeSavedLink(linkId: string) {
    if (!(await confirmDelete({ text: "Delete this exam link?" }))) return;
    setBusyKey(`link-${linkId}`);
    try {
      await apiRequest(`/exams/links/${linkId}`, token, { method: "DELETE" });
      if (activeLinkId === linkId) {
        setActiveLinkId(null);
        setMergePreview(null);
      }
      notifySuccess("Exam link deleted.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete exam link");
    } finally {
      setBusyKey("");
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
                      <td className="font-semibold text-slate-900">
                        <div>{group.name}</div>
                        {group.description ? (
                          <p
                            className="mt-0.5 max-w-[320px] truncate text-[11px] font-normal text-slate-500"
                            title={group.description}
                          >
                            {group.description}
                          </p>
                        ) : null}
                      </td>
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
                      <td className="text-right">
                        <div className="relative inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                            onClick={() => {
                              setExpandedId(group.id);
                              setExamModalGroupId(group.id);
                            }}
                          >
                            <PersonOutlined sx={{ fontSize: 15 }} /> Manage Exams
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            onClick={() => openEditGroup(group)}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} /> Edit
                          </button>
                          <button
                            type="button"
                            data-exam-menu-trigger
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                            onClick={(event) => openGroupMenu(group.id, event.currentTarget)}
                            aria-label="More actions"
                          >
                            <MoreVert sx={{ fontSize: 18 }} />
                          </button>
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
                                <table className="nx-table min-w-[760px]">
                                  <thead>
                                    <tr>
                                      <th>Exam Name</th>
                                      <th>Class/Section</th>
                                      <th>Subject Count</th>
                                      <th>Date Range</th>
                                      <th className="w-[1%] whitespace-nowrap text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {nested.map((row) => {
                                      const menuKey = row.key;
                                      return (
                                      <tr key={row.key}>
                                        <td className="font-medium text-slate-800">
                                          <div>{row.exam.name}</div>
                                          {row.exam.description ? (
                                            <p
                                              className="mt-0.5 max-w-[280px] truncate text-[11px] font-normal text-slate-500"
                                              title={row.exam.description}
                                            >
                                              {row.exam.description}
                                            </p>
                                          ) : null}
                                        </td>
                                        <td>{row.classLabel}</td>
                                        <td>
                                          {row.subjectCount
                                            ? `${row.subjectCount} Subject${row.subjectCount === 1 ? "" : "s"}`
                                            : "—"}
                                        </td>
                                        <td className="whitespace-nowrap text-slate-600">
                                          {formatDateRange(row.dateStart, row.dateEnd)}
                                        </td>
                                        <td className="text-right">
                                          <div className="relative inline-flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                              disabled={busyKey === `assign-${row.exam.id}-${row.classSectionId}`}
                                              onClick={() =>
                                                void assignStudents(row.exam.id, row.classSectionId)
                                              }
                                              title="Assign Students"
                                            >
                                              <PersonAddAlt1Outlined sx={{ fontSize: 15 }} /> Assign
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                              onClick={() =>
                                                void openViewStudents(row.exam, row.classSectionId)
                                              }
                                              title="View Students"
                                            >
                                              <VisibilityOutlined sx={{ fontSize: 15 }} /> View
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700"
                                              onClick={() =>
                                                onOpenSchedule(row.exam.id, row.classSectionId || undefined)
                                              }
                                              title="Exam Subjects"
                                            >
                                              <MenuBookOutlined sx={{ fontSize: 15 }} /> Subjects
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                              disabled={!row.firstScheduleId}
                                              onClick={() => {
                                                if (row.firstScheduleId) onOpenMarks(row.firstScheduleId);
                                              }}
                                              title={
                                                row.firstScheduleId
                                                  ? "Enter Marks"
                                                  : "Add exam subjects first to enable Marks"
                                              }
                                            >
                                              <RateReviewOutlined sx={{ fontSize: 15 }} /> Marks
                                            </button>
                                            <button
                                              type="button"
                                              data-exam-menu-trigger
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                              onClick={(event) =>
                                                openRowMenu(menuKey, row.exam, event.currentTarget)
                                              }
                                              aria-label="More exam actions"
                                            >
                                              <MoreVert sx={{ fontSize: 18 }} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      );
                                    })}
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
          Persist a multi-exam link and open consolidated results. College grading may span sessions.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label>
            <span className="nx-label">Link name</span>
            <input
              className="nx-input"
              placeholder="e.g. Term 1 + Term 2"
              value={linkName}
              onChange={(event) => setLinkName(event.target.value)}
            />
          </label>
          <label>
            <span className="nx-label">Result type</span>
            <select
              className="nx-input"
              value={linkResultType}
              onChange={(event) => setLinkResultType(event.target.value as ExamResultType)}
            >
              {RESULT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {resultTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
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
                    {exam.name} · {exam.group.name} · {exam.group.academicSession.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="nx-btn-primary"
            disabled={merging || linkExamIds.length < 2}
            title={
              linkExamIds.length < 2
                ? "Select at least two exams to enable Save & Open Results"
                : undefined
            }
            onClick={() => void mergeLinkedExams()}
          >
            <LinkOutlined sx={{ fontSize: 16 }} />
            {merging ? "Saving…" : "Save & Open Results"}
          </button>
        </div>
        {linkExamIds.length > 0 && linkExamIds.length < 2 ? (
          <p className="mt-2 text-[12px] font-medium text-amber-700">
            Select at least one more exam — linking needs 2 or more exams.
          </p>
        ) : null}
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
          Last selected exam is treated as the final exam. School grading requires one academic session;
          college grading may link across sessions.
        </div>
        {setup.links?.length ? (
          <div className="mt-4 space-y-2">
            <p className="text-[12px] font-semibold text-slate-700">Saved links</p>
            {setup.links.map((link) => (
              <div
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{link.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {resultTypeLabel(link.resultType)} · {(link.examIds ?? []).length} exams
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="nx-btn-secondary text-[12px]"
                    disabled={savingLink}
                    onClick={() => void openSavedLink(link.id)}
                  >
                    Open results
                  </button>
                  <button
                    type="button"
                    className="rounded border border-rose-200 px-2 py-1 text-[12px] text-rose-600 hover:bg-rose-50"
                    disabled={busyKey === `link-${link.id}`}
                    onClick={() => void removeSavedLink(link.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
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
                className={`nx-input${groupFieldErrors.academicSessionId ? " is-invalid" : ""}`}
                value={groupForm.academicSessionId}
                onChange={(event) => {
                  setGroupFieldErrors((prev) => clearFieldError(prev, "academicSessionId"));
                  setGroupForm({ ...groupForm, academicSessionId: event.target.value });
                }}
              >
                <option value="">Select session</option>
                {setup.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
              <FieldError error={groupFieldErrors.academicSessionId} />
            </label>
            <label className="block">
              <span className="nx-label">Exam group name</span>
              <input
                className={`nx-input${groupFieldErrors.name ? " is-invalid" : ""}`}
                placeholder="Annual Examination 2024-25"
                value={groupForm.name}
                onChange={(event) => {
                  setGroupFieldErrors((prev) => clearFieldError(prev, "name"));
                  setGroupForm({ ...groupForm, name: event.target.value });
                }}
              />
              <FieldError error={groupFieldErrors.name} />
            </label>
            <label className="block">
              <span className="nx-label">Description</span>
              <textarea
                className="nx-input min-h-[72px]"
                placeholder="Optional notes about this exam group"
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm({ ...groupForm, description: event.target.value })
                }
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
                className={`nx-input${editGroupFieldErrors.name ? " is-invalid" : ""}`}
                value={editGroupForm.name}
                onChange={(event) => {
                  setEditGroupFieldErrors((prev) => clearFieldError(prev, "name"));
                  setEditGroupForm({ ...editGroupForm, name: event.target.value });
                }}
              />
              <FieldError error={editGroupFieldErrors.name} />
            </label>
            <label className="block">
              <span className="nx-label">Description</span>
              <textarea
                className="nx-input min-h-[72px]"
                placeholder="Optional notes about this exam group"
                value={editGroupForm.description}
                onChange={(event) =>
                  setEditGroupForm({ ...editGroupForm, description: event.target.value })
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
            <label className="block">
              <span className="nx-label">Description</span>
              <textarea
                className="nx-input min-h-[72px]"
                placeholder="Optional notes about this exam"
                value={examForm.description}
                onChange={(event) =>
                  setExamForm({ ...examForm, description: event.target.value })
                }
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
            <label className="block">
              <span className="nx-label">Description</span>
              <textarea
                className="nx-input min-h-[72px]"
                placeholder="Optional notes about this exam"
                value={editExamForm.description}
                onChange={(event) =>
                  setEditExamForm({ ...editExamForm, description: event.target.value })
                }
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

      {viewStudents ? (
        <Modal
          title={`Students · ${viewStudents.examName}`}
          onClose={() => {
            setViewStudents(null);
            setViewStudentsRows([]);
          }}
          wide
        >
          <p className="mb-3 text-[12.5px] text-slate-500">
            {viewStudentsLoading
              ? "Loading students…"
              : `${viewStudentsRows.length} student${viewStudentsRows.length === 1 ? "" : "s"}`}
          </p>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="nx-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Admission No</th>
                  <th>Class/Section</th>
                </tr>
              </thead>
              <tbody>
                {!viewStudentsLoading && !viewStudentsRows.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No students assigned yet.
                    </td>
                  </tr>
                ) : null}
                {viewStudentsRows.map((row) => {
                  const student = row.studentEnrollment.student;
                  const classSection = row.studentEnrollment.classSection;
                  return (
                    <tr key={row.id}>
                      <td>{row.rollNumber || "—"}</td>
                      <td className="font-medium text-slate-800">
                        {student.firstName} {student.lastName ?? ""}
                      </td>
                      <td>{student.admissionNumber}</td>
                      <td>
                        {classSection.academicClass.name} / {classSection.section.name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}

      {menuCoords && activeGroupMenu
        ? createPortal(
            <div
              data-exam-action-menu
              className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              style={{ top: menuCoords.top, left: menuCoords.left, width: MENU_WIDTH }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setExamModalGroupId(activeGroupMenu.id);
                  closeMenus();
                }}
              >
                <AddOutlined sx={{ fontSize: 15 }} /> Add exam
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-rose-600 hover:bg-rose-50"
                disabled={busyKey === `group-del-${activeGroupMenu.id}`}
                onClick={() => void removeGroup(activeGroupMenu)}
              >
                <DeleteOutline sx={{ fontSize: 15 }} /> Delete group
              </button>
            </div>,
            document.body,
          )
        : null}

      {menuCoords && activeRowMenu
        ? createPortal(
            <div
              data-exam-action-menu
              className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              style={{ top: menuCoords.top, left: menuCoords.left, width: MENU_WIDTH }}
            >
              {activeRowMenu.exam.status !== "ARCHIVED" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    openEditExam(activeRowMenu.exam);
                    closeMenus();
                  }}
                >
                  <EditOutlined sx={{ fontSize: 15 }} /> Edit exam
                </button>
              ) : null}
              {activeRowMenu.exam.status !== "ARCHIVED" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={busyKey === `archive-${activeRowMenu.exam.id}`}
                  onClick={() => {
                    void archiveExam(activeRowMenu.exam);
                    closeMenus();
                  }}
                >
                  <ArchiveOutlined sx={{ fontSize: 15 }} /> Archive
                </button>
              ) : null}
              {activeRowMenu.exam.status !== "PUBLISHED" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  disabled={busyKey === `exam-del-${activeRowMenu.exam.id}`}
                  onClick={() => {
                    void removeExam(activeRowMenu.exam);
                    closeMenus();
                  }}
                >
                  <DeleteOutline sx={{ fontSize: 15 }} /> Delete
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={`w-full overflow-hidden rounded-xl bg-white shadow-xl ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
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
