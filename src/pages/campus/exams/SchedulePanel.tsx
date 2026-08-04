import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  CloseOutlined,
  DeleteOutline,
  DragIndicator,
  EditOutlined,
  InfoOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { ExamWithGroup, Schedule, ScheduleWithExam, Setup } from "./types";
import {
  durationLabel,
  formatExamDate,
  formatTimeRange,
  today,
  toDateInput,
} from "./utils";

type FormState = {
  examId: string;
  classSectionId: string;
  classSubjectId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: string;
  maximumMarks: string;
  minimumMarks: string;
  creditHours: string;
  markField: string;
};

function emptyForm(examId = "", classSectionId = ""): FormState {
  return {
    examId,
    classSectionId,
    classSubjectId: "",
    examDate: today,
    startTime: "09:00",
    endTime: "12:00",
    room: "",
    maximumMarks: "100",
    minimumMarks: "40",
    creditHours: "",
    markField: "Theory",
  };
}

export function SchedulePanel({
  setup,
  exams,
  token,
  onSaved,
  onError,
  initialExamId = "",
  initialClassSectionId = "",
  showAddForm = false,
  onAddFormHandled,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  initialExamId?: string;
  initialClassSectionId?: string;
  showAddForm?: boolean;
  onAddFormHandled?: () => void;
}) {
  const initialClass = setup.classSections.find((item) => item.id === initialClassSectionId);
  const [examFilter, setExamFilter] = useState(initialExamId);
  const [classFilter, setClassFilter] = useState(initialClass?.academicClass.id ?? "");
  const [sectionFilter, setSectionFilter] = useState(initialClassSectionId);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(Boolean(showAddForm));
  const [editing, setEditing] = useState<ScheduleWithExam | null>(null);
  const [form, setForm] = useState<FormState>(
    emptyForm(initialExamId, initialClassSectionId),
  );
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (initialExamId) setExamFilter(initialExamId);
    if (initialClassSectionId) {
      const classSection = setup.classSections.find((item) => item.id === initialClassSectionId);
      setClassFilter(classSection?.academicClass.id ?? "");
      setSectionFilter(initialClassSectionId);
      setForm((prev) => ({
        ...prev,
        examId: initialExamId || prev.examId,
        classSectionId: initialClassSectionId,
      }));
    }
  }, [initialExamId, initialClassSectionId, setup.classSections]);

  useEffect(() => {
    if (showAddForm) {
      setFormOpen(true);
      setEditing(null);
      setForm((prev) => ({
        ...emptyForm(examFilter || prev.examId, sectionFilter || prev.classSectionId),
        examId: examFilter || prev.examId,
        classSectionId: sectionFilter || prev.classSectionId,
      }));
      onAddFormHandled?.();
    }
  }, [showAddForm, examFilter, sectionFilter, onAddFormHandled]);

  const classOptions = useMemo(() => {
    const map = new Map(setup.classSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () => setup.classSections.filter((item) => !classFilter || item.academicClass.id === classFilter),
    [setup.classSections, classFilter],
  );

  const selectedExam = exams.find((exam) => exam.id === (editing?.exam.id || form.examId || examFilter));
  const showCreditHours = selectedExam?.group.resultType === "GPA";

  const formClassSection = setup.classSections.find((item) => item.id === form.classSectionId);
  const availableSubjects = formClassSection?.subjects ?? [];

  const allSchedules = useMemo(
    () => exams.flatMap((exam) => exam.schedules.map((schedule) => ({ ...schedule, exam }))),
    [exams],
  );

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSchedules.filter((schedule) => {
      if (examFilter && schedule.exam.id !== examFilter) return false;
      if (classFilter && schedule.classSection.academicClass.id !== classFilter) return false;
      if (sectionFilter && schedule.classSection.id !== sectionFilter) return false;
      if (!q) return true;
      const haystack = `${schedule.classSubject.subject.name} ${schedule.room ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allSchedules, examFilter, classFilter, sectionFilter, search]);

  function resetFilters() {
    setExamFilter("");
    setClassFilter("");
    setSectionFilter("");
    setSearch("");
  }

  function openCreate() {
    setEditing(null);
    setForm(
      emptyForm(
        examFilter || exams.find((exam) => exam.status === "DRAFT")?.id || "",
        sectionFilter,
      ),
    );
    setFormOpen(true);
  }

  function openEdit(schedule: ScheduleWithExam) {
    setEditing(schedule);
    setForm({
      examId: schedule.exam.id,
      classSectionId: schedule.classSection.id,
      classSubjectId: schedule.classSubject.id,
      examDate: toDateInput(schedule.examDate),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room ?? "",
      maximumMarks: String(schedule.maximumMarks),
      minimumMarks: String(schedule.minimumMarks),
      creditHours:
        schedule.creditHours != null && schedule.creditHours !== ""
          ? String(schedule.creditHours)
          : "",
      markField: schedule.components?.[0]?.name ?? "Theory",
    });
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm(examFilter, sectionFilter));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.examId) {
      onError("Select an exam before scheduling a subject.");
      return;
    }
    if (!form.classSectionId) {
      onError("Select a class section.");
      return;
    }
    setSaving(true);
    try {
      const creditHoursPayload =
        showCreditHours && form.creditHours.trim() !== ""
          ? { creditHours: Number(form.creditHours) }
          : showCreditHours
            ? { creditHours: null }
            : {};
      if (editing) {
        await apiRequest(`/exams/schedules/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify({
            examDate: form.examDate,
            startTime: form.startTime.slice(0, 5),
            endTime: form.endTime.slice(0, 5),
            room: form.room.trim() || null,
            maximumMarks: Number(form.maximumMarks) || 100,
            minimumMarks: Number(form.minimumMarks) || 0,
            ...creditHoursPayload,
          }),
        });
        notifySuccess("Schedule updated.");
      } else {
        const created = await apiRequest<{ id: string }>(`/exams/${form.examId}/schedules`, token, {
          method: "POST",
          body: JSON.stringify({
            classSectionId: form.classSectionId,
            classSubjectId: form.classSubjectId,
            examDate: form.examDate,
            startTime: form.startTime.slice(0, 5),
            endTime: form.endTime.slice(0, 5),
            room: form.room.trim() || null,
            maximumMarks: Number(form.maximumMarks) || 100,
            minimumMarks: Number(form.minimumMarks) || 40,
            ...creditHoursPayload,
          }),
        });
        await apiRequest(`/exams/${form.examId}/students`, token, {
          method: "POST",
          body: JSON.stringify({ classSectionId: form.classSectionId }),
        });
        if (form.markField.trim() && created?.id) {
          try {
            await apiRequest(`/exams/schedules/${created.id}/components`, token, {
              method: "POST",
              body: JSON.stringify({
                name: form.markField.trim(),
                maximumMarks: Number(form.maximumMarks) || 100,
              }),
            });
          } catch {
            // Schedule still saved even if mark field create fails.
          }
        }
        notifySuccess("Subject added to schedule.");
      }
      cancelForm();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(schedule: Schedule, examName: string) {
    const ok = await confirmDelete({
      title: "Delete schedule?",
      text: `Remove ${examName} · ${schedule.classSubject.subject.name}?`,
    });
    if (!ok) return;
    setBusyKey(`del-${schedule.id}`);
    try {
      await apiRequest(`/exams/schedules/${schedule.id}`, token, { method: "DELETE" });
      notifySuccess("Schedule deleted.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete schedule");
    } finally {
      setBusyKey("");
    }
  }

  const markFieldLabel = (schedule: ScheduleWithExam) =>
    schedule.components?.[0]?.name ?? "Theory";

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1 sm:max-w-[220px]">
            <span className="nx-label !normal-case !tracking-normal">Exam</span>
            <select
              className="nx-input bg-white"
              value={examFilter}
              onChange={(event) => {
                setExamFilter(event.target.value);
                setForm((prev) => ({ ...prev, examId: event.target.value }));
              }}
            >
              <option value="">All exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.status})
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={classFilter}
              onChange={(event) => {
                const nextClassId = event.target.value;
                setClassFilter(nextClassId);
                const first = setup.classSections.find(
                  (item) => item.academicClass.id === nextClassId,
                );
                setSectionFilter(first?.id ?? "");
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
          <label className="min-w-[120px] flex-1 sm:max-w-[150px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={sectionFilter}
              disabled={!classFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
            >
              <option value="">All sections</option>
              {sectionOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.section.name}
                </option>
              ))}
            </select>
          </label>
          <div className="relative min-w-[220px] flex-1">
            <SearchOutlined
              sx={{ fontSize: 17 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input bg-white pl-9"
              placeholder="Search by subject or room no..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="button" className="nx-btn-secondary" onClick={resetFilters}>
            <RefreshOutlined sx={{ fontSize: 16 }} /> Reset
          </button>
          <button type="button" className="nx-btn-primary" onClick={openCreate}>
            <AddOutlined sx={{ fontSize: 16 }} /> Add subject
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-blue-700">
          <InfoOutlined sx={{ fontSize: 14 }} />
          Credit Hours column is shown only for GPA-based exam types.
        </p>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10" aria-label="Reorder" />
                <th>Subject</th>
                <th>Date</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Room No</th>
                {showCreditHours ? <th>Credit Hours</th> : null}
                <th>Mark Field</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map((schedule) => {
                const canEdit = schedule.exam.status === "DRAFT";
                return (
                  <tr key={schedule.id}>
                    <td className="text-slate-300">
                      <DragIndicator sx={{ fontSize: 18 }} className="cursor-grab" />
                    </td>
                    <td className="font-semibold text-slate-800">
                      {schedule.classSubject.subject.name}
                      <p className="text-[11px] font-normal text-slate-400">
                        {schedule.exam.name} · {schedule.classSection.academicClass.name}-
                        {schedule.classSection.section.name}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">{formatExamDate(schedule.examDate)}</td>
                    <td className="whitespace-nowrap">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </td>
                    <td>{durationLabel(schedule.startTime, schedule.endTime)}</td>
                    <td>{schedule.room || "—"}</td>
                    {showCreditHours ? (
                      <td>
                        {schedule.creditHours != null && schedule.creditHours !== ""
                          ? String(schedule.creditHours)
                          : "—"}
                      </td>
                    ) : null}
                    <td>{markFieldLabel(schedule)}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded border border-indigo-300 p-1.5 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                          disabled={!canEdit}
                          onClick={() => openEdit(schedule)}
                          aria-label="Edit"
                        >
                          <EditOutlined sx={{ fontSize: 16 }} />
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                          disabled={!canEdit || busyKey === `del-${schedule.id}`}
                          onClick={() => void removeSchedule(schedule, schedule.exam.name)}
                          aria-label="Delete"
                        >
                          <DeleteOutline sx={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredSchedules.length ? (
                <tr>
                  <td
                    colSpan={showCreditHours ? 9 : 8}
                    className="px-5 py-12 text-center text-slate-500"
                  >
                    No subjects scheduled for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen ? (
        <div className="nx-card overflow-hidden">
          <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-bold text-indigo-900">
                {editing ? "Edit subject schedule" : "Add new subject to schedule"}
              </h3>
              <button
                type="button"
                className="rounded p-1 text-indigo-400 hover:bg-indigo-100"
                onClick={cancelForm}
                aria-label="Close form"
              >
                <CloseOutlined sx={{ fontSize: 16 }} />
              </button>
            </div>
          </div>
          <form className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => void submit(event)}>
            {!editing ? (
              <>
                <label className="xl:col-span-2">
                  <span className="nx-label">
                    Exam <span className="text-rose-500">*</span>
                  </span>
                  <select
                    className="nx-input"
                    required
                    value={form.examId}
                    onChange={(event) => setForm({ ...form, examId: event.target.value })}
                  >
                    <option value="">Select exam</option>
                    {exams
                      .filter((exam) => exam.status === "DRAFT")
                      .map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.group.name} · {exam.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="xl:col-span-2">
                  <span className="nx-label">
                    Class / Section <span className="text-rose-500">*</span>
                  </span>
                  <select
                    className="nx-input"
                    required
                    value={form.classSectionId}
                    onChange={(event) =>
                      setForm({ ...form, classSectionId: event.target.value, classSubjectId: "" })
                    }
                  >
                    <option value="">Select class section</option>
                    {setup.classSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.academicClass.name} - {item.section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="xl:col-span-2">
                  <span className="nx-label">
                    Subject <span className="text-rose-500">*</span>
                  </span>
                  <select
                    className="nx-input"
                    required
                    value={form.classSubjectId}
                    onChange={(event) => setForm({ ...form, classSubjectId: event.target.value })}
                  >
                    <option value="">Select subject</option>
                    {availableSubjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.subject.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="xl:col-span-2">
                <span className="nx-label">Subject</span>
                <p className="nx-input flex items-center bg-slate-50 font-medium text-slate-700">
                  {editing.classSubject.subject.name}
                </p>
              </div>
            )}
            <label>
              <span className="nx-label">
                Date <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input"
                type="date"
                required
                value={form.examDate}
                onChange={(event) => setForm({ ...form, examDate: event.target.value })}
              />
            </label>
            <label>
              <span className="nx-label">
                Time From <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input"
                type="time"
                required
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              />
            </label>
            <label>
              <span className="nx-label">
                Time To <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input"
                type="time"
                required
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
              />
            </label>
            <label>
              <span className="nx-label">Duration</span>
              <input
                className="nx-input bg-slate-50"
                readOnly
                value={durationLabel(form.startTime, form.endTime)}
              />
            </label>
            <label>
              <span className="nx-label">Room No</span>
              <input
                className="nx-input"
                placeholder="Enter room no"
                value={form.room}
                onChange={(event) => setForm({ ...form, room: event.target.value })}
              />
            </label>
            {showCreditHours ? (
              <label>
                <span className="nx-label">Credit Hours</span>
                <input
                  className="nx-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 3"
                  value={form.creditHours}
                  onChange={(event) => setForm({ ...form, creditHours: event.target.value })}
                />
              </label>
            ) : null}
            <label>
              <span className="nx-label">
                Max Marks <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input"
                type="number"
                min="1"
                required
                value={form.maximumMarks}
                onChange={(event) => setForm({ ...form, maximumMarks: event.target.value })}
              />
            </label>
            <label>
              <span className="nx-label">
                Min Marks <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input"
                type="number"
                min="0"
                required
                value={form.minimumMarks}
                onChange={(event) => setForm({ ...form, minimumMarks: event.target.value })}
              />
            </label>
            {!editing ? (
              <label>
                <span className="nx-label">Mark Field</span>
                <input
                  className="nx-input"
                  placeholder="e.g. Theory"
                  value={form.markField}
                  onChange={(event) => setForm({ ...form, markField: event.target.value })}
                />
              </label>
            ) : null}
            <div className="flex items-end gap-2 xl:col-span-6">
              <button className="nx-btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="nx-btn-secondary border-indigo-300 text-indigo-700"
                onClick={cancelForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
