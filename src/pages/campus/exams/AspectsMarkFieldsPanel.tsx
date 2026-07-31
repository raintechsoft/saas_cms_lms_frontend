import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
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
import type { ExamWithGroup, Roster, ScheduleWithExam, Setup } from "./types";

type FieldType = "BEHAVIOR" | "SKILL" | "COMMENT";

type AspectField = {
  id: string;
  name: string;
  maximumValue: string;
  fieldType?: string;
  examId?: string;
  examName?: string;
};

const SCALE_OPTIONS = ["Excellent", "Very Good", "Good", "Average", "Poor"] as const;

const FIELD_TYPE_TONE: Record<string, string> = {
  BEHAVIOR: "bg-violet-50 text-violet-700",
  SKILL: "bg-sky-50 text-sky-700",
  COMMENT: "bg-amber-50 text-amber-700",
};

function scaleToValue(label: string, maximumValue: number) {
  const index = SCALE_OPTIONS.indexOf(label as (typeof SCALE_OPTIONS)[number]);
  if (index < 0) return 0;
  const ratio = 1 - index / (SCALE_OPTIONS.length - 1);
  return Number((maximumValue * ratio).toFixed(2));
}

function valueToScale(value: number, maximumValue: number) {
  if (!maximumValue) return "";
  const ratio = value / maximumValue;
  const index = Math.min(
    SCALE_OPTIONS.length - 1,
    Math.max(0, Math.round((1 - ratio) * (SCALE_OPTIONS.length - 1))),
  );
  return SCALE_OPTIONS[index];
}

function studentName(row: Roster) {
  return `${row.studentEnrollment.student.firstName} ${row.studentEnrollment.student.lastName ?? ""}`.trim();
}

export function AspectsMarkFieldsPanel({
  setup,
  exams,
  schedules,
  token,
  onSaved,
  onError,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  schedules: ScheduleWithExam[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const draftExams = useMemo(() => exams.filter((exam) => exam.status === "DRAFT"), [exams]);
  const [aspectExamId, setAspectExamId] = useState(draftExams[0]?.id ?? exams[0]?.id ?? "");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType | "">("");
  const [editingAspect, setEditingAspect] = useState<AspectField | null>(null);
  const [savingAspect, setSavingAspect] = useState(false);

  const [entryExamId, setEntryExamId] = useState(draftExams[0]?.id ?? exams[0]?.id ?? "");
  const [entryClassId, setEntryClassId] = useState("");
  const [entrySectionId, setEntrySectionId] = useState("");
  const [search, setSearch] = useState("");
  const [roster, setRoster] = useState<Roster[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [savingValues, setSavingValues] = useState(false);

  const [componentScheduleId, setComponentScheduleId] = useState("");
  const [componentFormOpen, setComponentFormOpen] = useState(false);
  const [componentForm, setComponentForm] = useState({ name: "", maximumMarks: "" });
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const existingLink = setup.subjectLinks?.[0];
  const [linkId, setLinkId] = useState(existingLink?.id ?? "");
  const [linkSubjects, setLinkSubjects] = useState<string[]>(
    (existingLink?.subjectIds as string[] | undefined) ?? [],
  );
  const [mergeType, setMergeType] = useState<"MERGE" | "AVERAGE">(
    existingLink?.mergeType === "AVERAGE" ? "AVERAGE" : "MERGE",
  );
  const [bifurcation, setBifurcation] = useState(String(existingLink?.bifurcationColumns ?? 2));
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    if (!aspectExamId && (draftExams[0] || exams[0])) {
      setAspectExamId(draftExams[0]?.id ?? exams[0]?.id ?? "");
    }
    if (!entryExamId && (draftExams[0] || exams[0])) {
      setEntryExamId(draftExams[0]?.id ?? exams[0]?.id ?? "");
    }
  }, [aspectExamId, entryExamId, draftExams, exams]);

  useEffect(() => {
    const link = setup.subjectLinks?.[0];
    if (!link) return;
    setLinkId(link.id);
    setLinkSubjects((link.subjectIds as string[]) ?? []);
    setMergeType(link.mergeType === "AVERAGE" ? "AVERAGE" : "MERGE");
    setBifurcation(String(link.bifurcationColumns ?? 2));
  }, [setup.subjectLinks]);

  const aspectExam = exams.find((exam) => exam.id === aspectExamId);
  const aspects: AspectField[] = useMemo(
    () =>
      (aspectExam?.aspects ?? []).map((item) => ({
        ...item,
        examId: aspectExam?.id,
        examName: aspectExam?.name,
      })),
    [aspectExam],
  );

  const entryExam = exams.find((exam) => exam.id === entryExamId);
  const entryAspects = entryExam?.aspects ?? [];

  const classOptions = useMemo(() => {
    const map = new Map(setup.classSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () =>
      setup.classSections.filter((item) => !entryClassId || item.academicClass.id === entryClassId),
    [setup.classSections, entryClassId],
  );

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of setup.classSections) {
      for (const item of section.subjects) {
        map.set(item.subject.id, item.subject.name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [setup.classSections]);

  const draftSchedules = useMemo(
    () => schedules.filter((item) => item.exam.status === "DRAFT"),
    [schedules],
  );

  useEffect(() => {
    if (!componentScheduleId && draftSchedules[0]) {
      setComponentScheduleId(draftSchedules[0].id);
    }
  }, [componentScheduleId, draftSchedules]);

  const selectedSchedule = schedules.find((item) => item.id === componentScheduleId);
  const components = useMemo(() => {
    const list = [...(selectedSchedule?.components ?? [])];
    list.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    );
    return list;
  }, [selectedSchedule]);

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((row) => {
      const haystack = `${studentName(row)} ${row.rollNumber ?? ""} ${row.studentEnrollment.student.admissionNumber}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [roster, search]);

  async function saveAspectField(event: FormEvent) {
    event.preventDefault();
    if (!fieldName.trim() || !fieldType) {
      onError("Field name and field type are required");
      return;
    }
    if (!aspectExamId) {
      onError("Select an exam for the aspect field");
      return;
    }
    setSavingAspect(true);
    try {
      const payload = {
        name: fieldName.trim(),
        fieldType,
        maximumValue: fieldType === "COMMENT" ? 1 : 5,
      };
      if (editingAspect) {
        await apiRequest(`/exams/aspects/${editingAspect.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Aspect field updated");
      } else {
        await apiRequest(`/exams/${aspectExamId}/aspects`, token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Aspect field created");
      }
      setFieldName("");
      setFieldType("");
      setEditingAspect(null);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save aspect field");
    } finally {
      setSavingAspect(false);
    }
  }

  function startEditAspect(item: AspectField) {
    setEditingAspect(item);
    setFieldName(item.name);
    setFieldType((item.fieldType as FieldType) || "BEHAVIOR");
    if (item.examId) setAspectExamId(item.examId);
  }

  async function removeAspect(item: AspectField) {
    const ok = await confirmDelete({
      text: `Delete aspect field “${item.name}”? Existing values will be removed.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/aspects/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Aspect field deleted");
      if (editingAspect?.id === item.id) {
        setEditingAspect(null);
        setFieldName("");
        setFieldType("");
      }
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete aspect field");
    }
  }

  async function loadAspectRoster() {
    if (!entryExamId || !entrySectionId) {
      setRoster([]);
      setMatrix({});
      return;
    }
    const schedule =
      schedules.find(
        (item) =>
          item.exam.id === entryExamId && item.classSection.id === entrySectionId,
      ) ??
      schedules.find(
        (item) =>
          item.exam.id === entryExamId &&
          item.classSection.academicClass.id === entryClassId,
      );
    if (!schedule) {
      onError("No exam schedule found for the selected class/section.");
      setRoster([]);
      return;
    }
    setLoadingRoster(true);
    try {
      const next = await apiRequest<Roster[]>(`/exams/schedules/${schedule.id}/roster`, token);
      setRoster(next);
      const nextMatrix: Record<string, Record<string, string>> = {};
      for (const row of next) {
        nextMatrix[row.id] = {};
        for (const aspect of entryAspects) {
          const existing = row.aspectValues?.find((value) => value.aspectFieldId === aspect.id);
          const type = (aspect.fieldType ?? "BEHAVIOR").toUpperCase();
          if (type === "COMMENT") {
            nextMatrix[row.id][aspect.id] = existing?.remarks ?? "";
          } else {
            nextMatrix[row.id][aspect.id] = existing
              ? valueToScale(Number(existing.value), Number(aspect.maximumValue))
              : "";
          }
        }
      }
      setMatrix(nextMatrix);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load students");
    } finally {
      setLoadingRoster(false);
    }
  }

  useEffect(() => {
    if (entryExamId && entrySectionId) void loadAspectRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryExamId, entrySectionId, entryAspects.map((item) => item.id).join(",")]);

  function resetEntryFilters() {
    setEntryExamId(draftExams[0]?.id ?? exams[0]?.id ?? "");
    setEntryClassId("");
    setEntrySectionId("");
    setSearch("");
    setRoster([]);
    setMatrix({});
  }

  async function saveAllAspectValues() {
    if (!entryAspects.length || !roster.length) return;
    setSavingValues(true);
    try {
      for (const aspect of entryAspects) {
        const type = (aspect.fieldType ?? "BEHAVIOR").toUpperCase();
        const entries = roster.map((row) => {
          const raw = matrix[row.id]?.[aspect.id] ?? "";
          if (type === "COMMENT") {
            return {
              examStudentId: row.id,
              value: 0,
              remarks: raw.trim() || null,
            };
          }
          return {
            examStudentId: row.id,
            value: raw ? scaleToValue(raw, Number(aspect.maximumValue)) : 0,
            remarks: null,
          };
        });
        await apiRequest(`/exams/aspects/${aspect.id}/values`, token, {
          method: "PUT",
          body: JSON.stringify({ entries }),
        });
      }
      notifySuccess("Aspect values saved");
      await onSaved();
      await loadAspectRoster();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save aspect values");
    } finally {
      setSavingValues(false);
    }
  }

  async function saveComponent(event: FormEvent) {
    event.preventDefault();
    if (!componentScheduleId) {
      onError("Select a subject schedule first");
      return;
    }
    try {
      if (editingComponentId) {
        await apiRequest(`/exams/components/${editingComponentId}`, token, {
          method: "PUT",
          body: JSON.stringify({
            name: componentForm.name,
            maximumMarks: Number(componentForm.maximumMarks),
          }),
        });
        notifySuccess("Mark field updated");
      } else {
        await apiRequest(`/exams/schedules/${componentScheduleId}/components`, token, {
          method: "POST",
          body: JSON.stringify({
            name: componentForm.name,
            maximumMarks: Number(componentForm.maximumMarks),
          }),
        });
        notifySuccess("Mark field added");
      }
      setComponentForm({ name: "", maximumMarks: "" });
      setEditingComponentId(null);
      setComponentFormOpen(false);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save mark field");
    }
  }

  async function removeComponent(id: string, name: string) {
    const ok = await confirmDelete({ text: `Delete mark field “${name}”?` });
    if (!ok) return;
    try {
      await apiRequest(`/exams/components/${id}`, token, { method: "DELETE" });
      notifySuccess("Mark field deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete mark field");
    }
  }

  async function applyReorder(nextIds: string[]) {
    if (!componentScheduleId) return;
    try {
      await apiRequest(`/exams/schedules/${componentScheduleId}/components/reorder`, token, {
        method: "PUT",
        body: JSON.stringify({ orderedIds: nextIds }),
      });
      notifySuccess("Sequence updated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to reorder mark fields");
    }
  }

  function onDropReorder(toIndex: number) {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    const ids = components.map((item) => item.id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(toIndex, 0, moved);
    setDragIndex(null);
    void applyReorder(ids);
  }

  async function saveSubjectLink(event: FormEvent) {
    event.preventDefault();
    if (linkSubjects.length < 2) {
      onError("Select at least two subjects");
      return;
    }
    setSavingLink(true);
    try {
      const saved = await apiRequest<{ id: string }>("/exams/subject-links", token, {
        method: linkId ? "PUT" : "POST",
        body: JSON.stringify({
          id: linkId || undefined,
          subjectIds: linkSubjects,
          mergeType,
          bifurcationColumns: Number(bifurcation) || 2,
        }),
      });
      setLinkId(saved.id);
      notifySuccess("Subject link saved");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save subject link");
    } finally {
      setSavingLink(false);
    }
  }

  function toggleLinkSubject(id: string) {
    setLinkSubjects((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="nx-card p-5">
          <h2 className="text-[15px] font-bold text-slate-900">1. Create Aspect Fields</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Define qualitative fields such as behavior, skills, or comments.
          </p>
          <label className="mt-4 block">
            <span className="nx-label !normal-case !tracking-normal">Exam</span>
            <select
              className="nx-input bg-white"
              value={aspectExamId}
              onChange={(event) => setAspectExamId(event.target.value)}
            >
              <option value="">Select exam</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.group.name} · {exam.name} · {exam.status}
                </option>
              ))}
            </select>
          </label>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(event) => void saveAspectField(event)}
          >
            <label className="min-w-[160px] flex-1">
              <span className="nx-label !normal-case !tracking-normal">
                Field Name <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input bg-white"
                required
                placeholder="e.g. Participation"
                value={fieldName}
                onChange={(event) => setFieldName(event.target.value)}
              />
            </label>
            <label className="min-w-[160px] flex-1">
              <span className="nx-label !normal-case !tracking-normal">
                Field Type <span className="text-rose-500">*</span>
              </span>
              <select
                className="nx-input bg-white"
                required
                value={fieldType}
                onChange={(event) => setFieldType(event.target.value as FieldType | "")}
              >
                <option value="">Select field type</option>
                <option value="BEHAVIOR">Behavior</option>
                <option value="SKILL">Skill</option>
                <option value="COMMENT">Comment</option>
              </select>
            </label>
            <button type="submit" className="nx-btn-primary" disabled={savingAspect}>
              {savingAspect ? "Saving…" : editingAspect ? "Update Field" : "Save Field"}
            </button>
            {editingAspect ? (
              <button
                type="button"
                className="nx-btn-secondary"
                onClick={() => {
                  setEditingAspect(null);
                  setFieldName("");
                  setFieldType("");
                }}
              >
                Cancel
              </button>
            ) : null}
          </form>
        </div>

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">Existing Aspect Fields</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Fields configured for the selected exam.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Field Name</th>
                  <th>Field Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {aspects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="!py-8 text-center text-slate-500">
                      No aspect fields yet.
                    </td>
                  </tr>
                ) : (
                  aspects.map((item, index) => {
                    const type = (item.fieldType ?? "BEHAVIOR").toUpperCase();
                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td className="font-medium text-slate-900">{item.name}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              FIELD_TYPE_TONE[type] ?? "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                              onClick={() => startEditAspect(item)}
                            >
                              <EditOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-rose-600 hover:bg-rose-50"
                              onClick={() => void removeAspect(item)}
                            >
                              <DeleteOutline sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-[15px] font-bold text-slate-900">2. Input Aspect Values</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Enter aspect ratings and comments for students in a class section.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[180px] flex-1">
              <span className="nx-label !normal-case !tracking-normal">
                Exam <span className="text-rose-500">*</span>
              </span>
              <select
                className="nx-input bg-white"
                value={entryExamId}
                onChange={(event) => {
                  setEntryExamId(event.target.value);
                  setRoster([]);
                }}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.group.name} · {exam.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[140px]">
              <span className="nx-label !normal-case !tracking-normal">
                Class <span className="text-rose-500">*</span>
              </span>
              <select
                className="nx-input bg-white"
                value={entryClassId}
                onChange={(event) => {
                  setEntryClassId(event.target.value);
                  setEntrySectionId("");
                  setRoster([]);
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
            <label className="min-w-[120px]">
              <span className="nx-label !normal-case !tracking-normal">
                Section <span className="text-rose-500">*</span>
              </span>
              <select
                className="nx-input bg-white"
                value={entrySectionId}
                onChange={(event) => setEntrySectionId(event.target.value)}
              >
                <option value="">Select section</option>
                {sectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[200px] flex-1">
              <span className="nx-label !normal-case !tracking-normal">Search</span>
              <div className="relative">
                <SearchOutlined
                  sx={{ fontSize: 16 }}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="nx-input bg-white !pl-9"
                  placeholder="Search student..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </label>
            <button type="button" className="nx-btn-secondary" onClick={resetEntryFilters}>
              <RefreshOutlined sx={{ fontSize: 16 }} /> Reset
            </button>
            <button
              type="button"
              className="nx-btn-primary"
              disabled={!filteredRoster.length || !entryAspects.length || savingValues}
              onClick={() => void saveAllAspectValues()}
            >
              {savingValues ? "Saving…" : "Save Values"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[900px]">
            <thead>
              <tr>
                <th>#</th>
                <th>Roll No</th>
                <th>Student Name</th>
                {entryAspects.map((aspect) => (
                  <th key={aspect.id}>
                    {aspect.name} ({(aspect.fieldType ?? "BEHAVIOR").toLowerCase()})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingRoster ? (
                <tr>
                  <td
                    colSpan={3 + entryAspects.length}
                    className="!py-10 text-center text-slate-500"
                  >
                    Loading students…
                  </td>
                </tr>
              ) : !entryAspects.length ? (
                <tr>
                  <td
                    colSpan={3 + entryAspects.length}
                    className="!py-10 text-center text-slate-500"
                  >
                    Create aspect fields for this exam first.
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + entryAspects.length}
                    className="!py-10 text-center text-slate-500"
                  >
                    Select exam, class, and section to load students.
                  </td>
                </tr>
              ) : (
                filteredRoster.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.rollNumber ?? "—"}</td>
                    <td className="font-medium text-slate-900">{studentName(row)}</td>
                    {entryAspects.map((aspect) => {
                      const type = (aspect.fieldType ?? "BEHAVIOR").toUpperCase();
                      const value = matrix[row.id]?.[aspect.id] ?? "";
                      return (
                        <td key={aspect.id}>
                          {type === "COMMENT" ? (
                            <input
                              className="nx-input bg-white"
                              value={value}
                              placeholder="Comment"
                              onChange={(event) =>
                                setMatrix((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    [aspect.id]: event.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            <select
                              className="nx-input bg-white"
                              value={value}
                              onChange={(event) =>
                                setMatrix((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...prev[row.id],
                                    [aspect.id]: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Select</option>
                              {SCALE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="nx-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">3. Subject Mark Fields</h2>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Define Theory, Practical, and other mark components for a schedule.
              </p>
            </div>
            <button
              type="button"
              className="nx-btn-secondary"
              onClick={() => {
                setEditingComponentId(null);
                setComponentForm({ name: "", maximumMarks: "" });
                setComponentFormOpen(true);
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} /> Add Field
            </button>
          </div>
          <div className="space-y-3 px-5 py-4">
            <label className="block">
              <span className="nx-label !normal-case !tracking-normal">Subject schedule</span>
              <select
                className="nx-input bg-white"
                value={componentScheduleId}
                onChange={(event) => setComponentScheduleId(event.target.value)}
              >
                <option value="">Select schedule</option>
                {draftSchedules.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.exam.name} · {item.classSubject.subject.name} ·{" "}
                    {item.classSection.academicClass.name} {item.classSection.section.name}
                  </option>
                ))}
              </select>
            </label>
            {componentFormOpen ? (
              <form
                className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                onSubmit={(event) => void saveComponent(event)}
              >
                <label className="min-w-[140px] flex-1">
                  <span className="nx-label !normal-case !tracking-normal">Field Name</span>
                  <input
                    className="nx-input bg-white"
                    required
                    value={componentForm.name}
                    onChange={(event) =>
                      setComponentForm({ ...componentForm, name: event.target.value })
                    }
                    placeholder="Theory"
                  />
                </label>
                <label className="min-w-[120px]">
                  <span className="nx-label !normal-case !tracking-normal">Max Marks</span>
                  <input
                    className="nx-input bg-white"
                    type="number"
                    min="1"
                    required
                    value={componentForm.maximumMarks}
                    onChange={(event) =>
                      setComponentForm({ ...componentForm, maximumMarks: event.target.value })
                    }
                  />
                </label>
                <button type="submit" className="nx-btn-primary">
                  {editingComponentId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  className="nx-btn-secondary"
                  onClick={() => {
                    setComponentFormOpen(false);
                    setEditingComponentId(null);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table">
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>#</th>
                  <th>Field Name</th>
                  <th>Sequence</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="!py-8 text-center text-slate-500">
                      No mark fields for this schedule.
                    </td>
                  </tr>
                ) : (
                  components.map((item, index) => (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => onDropReorder(index)}
                      className="cursor-grab"
                    >
                      <td className="text-slate-400">
                        <DragIndicator sx={{ fontSize: 18 }} />
                      </td>
                      <td>{index + 1}</td>
                      <td className="font-medium text-slate-900">
                        {item.name}
                        <span className="ml-2 text-[11px] font-normal text-slate-400">
                          / {item.maximumMarks}
                        </span>
                      </td>
                      <td>
                        <input
                          className="nx-input w-16 bg-white"
                          type="number"
                          min="1"
                          value={item.sortOrder ?? index + 1}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            if (!Number.isFinite(next) || next < 1) return;
                            const ids = components.map((component) => component.id);
                            const from = ids.indexOf(item.id);
                            if (from < 0) return;
                            ids.splice(from, 1);
                            ids.splice(Math.min(next - 1, ids.length), 0, item.id);
                            void applyReorder(ids);
                          }}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-indigo-600 hover:bg-indigo-50"
                            onClick={() => {
                              setEditingComponentId(item.id);
                              setComponentForm({
                                name: item.name,
                                maximumMarks: String(item.maximumMarks),
                              });
                              setComponentFormOpen(true);
                            }}
                          >
                            <EditOutlined sx={{ fontSize: 16 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-rose-600 hover:bg-rose-50"
                            onClick={() => void removeComponent(item.id, item.name)}
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-2 border-t border-sky-100 bg-sky-50 px-5 py-3 text-[12.5px] text-sky-800">
            <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
            <p>Drag the handle to change sequence. Sequence will be applied in marks entry and reports.</p>
          </div>
        </div>

        <form className="nx-card overflow-hidden" onSubmit={(event) => void saveSubjectLink(event)}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-[15px] font-bold text-slate-900">
              4. Link Subject (Merge / Average on Report Card)
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Group subjects for combined totals or averages on marksheets.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <span className="nx-label !normal-case !tracking-normal">
                Subjects <span className="text-rose-500">*</span>
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {subjectOptions.map((subject) => {
                  const selected = linkSubjects.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
                        selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      onClick={() => toggleLinkSubject(subject.id)}
                    >
                      {subject.name}
                    </button>
                  );
                })}
                {!subjectOptions.length ? (
                  <p className="text-[12px] text-slate-400">No subjects available in the current session.</p>
                ) : null}
              </div>
            </div>
            <div>
              <span className="nx-label !normal-case !tracking-normal">Merge Type</span>
              <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="merge-type"
                    checked={mergeType === "MERGE"}
                    onChange={() => setMergeType("MERGE")}
                  />
                  Merge (Show as total)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="merge-type"
                    checked={mergeType === "AVERAGE"}
                    onChange={() => setMergeType("AVERAGE")}
                  />
                  Average (Show as average)
                </label>
              </div>
            </div>
            <label className="block max-w-[200px]">
              <span className="nx-label !normal-case !tracking-normal">
                Marks Bifurcation Till Columns <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input bg-white"
                type="number"
                min="1"
                max="20"
                required
                value={bifurcation}
                onChange={(event) => setBifurcation(event.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button type="submit" className="nx-btn-primary" disabled={savingLink}>
                {savingLink ? "Saving…" : "Save Link"}
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 border-t border-sky-100 bg-sky-50 px-5 py-3 text-[12.5px] text-sky-800">
            <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
            <p>Works with [table1] variable only.</p>
          </div>
        </form>
      </div>
    </section>
  );
}
