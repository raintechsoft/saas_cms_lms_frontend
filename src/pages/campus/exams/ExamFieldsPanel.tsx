import { useState, type FormEvent } from "react";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { ExamWithGroup, Roster, ScheduleWithExam, Setup } from "./types";

export function ExamFieldsPanel({
  setup,
  exams,
  schedules,
  token,
  onSaved,
  onError,
  mode = "all",
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  schedules: ScheduleWithExam[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  mode?: "grades" | "aspects" | "all";
}) {
  const [grade, setGrade] = useState({
    resultType: "SCHOOL_GRADING",
    name: "",
    minPercent: "",
    maxPercent: "",
    gradePoint: "",
    passStatus: "PASS",
  });
  const [component, setComponent] = useState({ scheduleId: "", name: "", maximumMarks: "" });
  const [aspect, setAspect] = useState({ examId: "", name: "", maximumValue: "5" });
  const [aspectEntry, setAspectEntry] = useState({ scheduleId: "", aspectFieldId: "" });
  const [roster, setRoster] = useState<Roster[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const entrySchedule = schedules.find((item) => item.id === aspectEntry.scheduleId);
  const aspectOptions = exams.find((item) => item.id === entrySchedule?.exam.id)?.aspects ?? [];

  async function createGrade(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/exams/grades", token, {
        method: "POST",
        body: JSON.stringify({
          ...grade,
          minPercent: Number(grade.minPercent),
          maxPercent: Number(grade.maxPercent),
          gradePoint: grade.gradePoint ? Number(grade.gradePoint) : null,
        }),
      });
      setGrade({ ...grade, name: "", minPercent: "", maxPercent: "", gradePoint: "" });
      notifySuccess("Marks grade added");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create marks grade");
    }
  }

  async function editGrade(item: Setup["grades"][number]) {
    const name = window.prompt("Grade name", item.name)?.trim();
    if (!name) return;
    const minPercent = window.prompt("Min percent", String(item.minPercent))?.trim();
    if (minPercent == null || minPercent === "") return;
    const maxPercent = window.prompt("Max percent", String(item.maxPercent))?.trim();
    if (maxPercent == null || maxPercent === "") return;
    try {
      await apiRequest(`/exams/grades/${item.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name,
          minPercent: Number(minPercent),
          maxPercent: Number(maxPercent),
        }),
      });
      notifySuccess("Grade updated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update grade");
    }
  }

  async function removeGrade(item: Setup["grades"][number]) {
    const ok = await confirmDelete({
      title: "Delete grade?",
      text: `"${item.name}" (${item.minPercent}–${item.maxPercent}%) will be removed.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/grades/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Grade deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete grade");
    }
  }

  async function createComponent(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/exams/schedules/${component.scheduleId}/components`, token, {
        method: "POST",
        body: JSON.stringify({
          name: component.name,
          maximumMarks: Number(component.maximumMarks),
        }),
      });
      setComponent({ ...component, name: "", maximumMarks: "" });
      notifySuccess("Subject mark field added");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add subject mark field");
    }
  }

  async function createAspect(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/exams/${aspect.examId}/aspects`, token, {
        method: "POST",
        body: JSON.stringify({
          name: aspect.name,
          maximumValue: Number(aspect.maximumValue),
        }),
      });
      setAspect({ ...aspect, name: "" });
      notifySuccess("Aspect field created");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create aspect field");
    }
  }

  async function selectAspectSchedule(scheduleId: string) {
    setAspectEntry({ scheduleId, aspectFieldId: "" });
    if (!scheduleId) return setRoster([]);
    try {
      const next = await apiRequest<Roster[]>(`/exams/schedules/${scheduleId}/roster`, token);
      setRoster(next);
      setValues(Object.fromEntries(next.map((item) => [item.id, "0"])));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load aspect roster");
    }
  }

  async function saveAspectValues() {
    try {
      await apiRequest(`/exams/aspects/${aspectEntry.aspectFieldId}/values`, token, {
        method: "PUT",
        body: JSON.stringify({
          entries: roster.map((item) => ({
            examStudentId: item.id,
            value: Number(values[item.id] ?? 0),
          })),
        }),
      });
      notifySuccess("Aspect values saved");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save aspect values");
    }
  }

  const showGrades = mode === "all" || mode === "grades";
  const showAspects = mode === "all" || mode === "aspects";

  return (
    <section className="mt-5 space-y-5">
      <div className={`grid gap-5 ${showGrades && showAspects ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {showGrades ? (
          <form className="nx-card p-5" onSubmit={(event) => void createGrade(event)}>
            <h2 className="text-[15px] font-bold text-slate-900">Marks grade</h2>
            <select
              className="nx-input mt-4"
              value={grade.resultType}
              onChange={(e) => setGrade({ ...grade, resultType: e.target.value })}
            >
              <option value="GENERAL">General</option>
              <option value="SCHOOL_GRADING">School grading</option>
              <option value="COLLEGE_GRADING">College grading</option>
              <option value="GPA">GPA</option>
            </select>
            <input
              className="nx-input mt-3"
              required
              placeholder="Grade, e.g. B+"
              value={grade.name}
              onChange={(e) => setGrade({ ...grade, name: e.target.value })}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                className="nx-input"
                type="number"
                min="0"
                max="100"
                required
                placeholder="Min %"
                value={grade.minPercent}
                onChange={(e) => setGrade({ ...grade, minPercent: e.target.value })}
              />
              <input
                className="nx-input"
                type="number"
                min="0"
                max="100"
                required
                placeholder="Max %"
                value={grade.maxPercent}
                onChange={(e) => setGrade({ ...grade, maxPercent: e.target.value })}
              />
            </div>
            <input
              className="nx-input mt-3"
              type="number"
              min="0"
              placeholder="Grade point"
              value={grade.gradePoint}
              onChange={(e) => setGrade({ ...grade, gradePoint: e.target.value })}
            />
            <select
              className="nx-input mt-3"
              value={grade.passStatus}
              onChange={(e) => setGrade({ ...grade, passStatus: e.target.value })}
            >
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
            </select>
            <button className="nx-btn-primary mt-4" type="submit">
              Add grade
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {setup.grades.map((item) => (
                <span
                  className={`inline-flex items-center gap-2 ${
                    item.passStatus === "PASS" ? "badge-success" : "badge-danger"
                  }`}
                  key={item.id}
                >
                  {item.name} · {item.minPercent}–{item.maxPercent}%
                  <button className="text-xs underline" type="button" onClick={() => void editGrade(item)}>
                    Edit
                  </button>
                  <button className="text-xs underline" type="button" onClick={() => void removeGrade(item)}>
                    Delete
                  </button>
                </span>
              ))}
            </div>
          </form>
        ) : null}

        {showAspects ? (
          <>
            <form className="nx-card p-5" onSubmit={(event) => void createComponent(event)}>
              <h2 className="text-[15px] font-bold text-slate-900">Subject mark field</h2>
              <select
                className="nx-input mt-4"
                required
                value={component.scheduleId}
                onChange={(e) => setComponent({ ...component, scheduleId: e.target.value })}
              >
                <option value="">Subject schedule</option>
                {schedules
                  .filter((item) => item.exam.status === "DRAFT")
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.exam.name} · {item.classSubject.subject.name}
                    </option>
                  ))}
              </select>
              <input
                className="nx-input mt-3"
                required
                placeholder="Field, e.g. Theory"
                value={component.name}
                onChange={(e) => setComponent({ ...component, name: e.target.value })}
              />
              <input
                className="nx-input mt-3"
                type="number"
                min="1"
                required
                placeholder="Maximum marks"
                value={component.maximumMarks}
                onChange={(e) => setComponent({ ...component, maximumMarks: e.target.value })}
              />
              <button className="nx-btn-primary mt-4" type="submit">
                Link mark field
              </button>
            </form>
            <form className="nx-card p-5" onSubmit={(event) => void createAspect(event)}>
              <h2 className="text-[15px] font-bold text-slate-900">Co-scholastic aspect</h2>
              <select
                className="nx-input mt-4"
                required
                value={aspect.examId}
                onChange={(e) => setAspect({ ...aspect, examId: e.target.value })}
              >
                <option value="">Draft exam</option>
                {exams
                  .filter((item) => item.status === "DRAFT")
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <input
                className="nx-input mt-3"
                required
                placeholder="Aspect, e.g. Discipline"
                value={aspect.name}
                onChange={(e) => setAspect({ ...aspect, name: e.target.value })}
              />
              <input
                className="nx-input mt-3"
                type="number"
                min="1"
                required
                placeholder="Maximum value"
                value={aspect.maximumValue}
                onChange={(e) => setAspect({ ...aspect, maximumValue: e.target.value })}
              />
              <button className="nx-btn-primary mt-4" type="submit">
                Create aspect
              </button>
            </form>
          </>
        ) : null}
      </div>

      {showAspects ? (
        <div className="nx-card p-5">
          <h2 className="text-[15px] font-bold text-slate-900">Input aspect values</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              className="nx-input"
              value={aspectEntry.scheduleId}
              onChange={(e) => void selectAspectSchedule(e.target.value)}
            >
              <option value="">Exam class roster</option>
              {schedules
                .filter((item) => item.exam.status === "DRAFT" && item.exam.aspects.length)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.exam.name} · {item.classSection.academicClass.name}{" "}
                    {item.classSection.section.name}
                  </option>
                ))}
            </select>
            <select
              className="nx-input"
              value={aspectEntry.aspectFieldId}
              onChange={(e) => setAspectEntry({ ...aspectEntry, aspectFieldId: e.target.value })}
            >
              <option value="">Aspect field</option>
              {aspectOptions.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} / {item.maximumValue}
                </option>
              ))}
            </select>
          </div>
          {roster.length > 0 ? (
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border">
              {roster.map((item) => (
                <div className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_140px]" key={item.id}>
                  <span>
                    {item.studentEnrollment.student.firstName}{" "}
                    {item.studentEnrollment.student.lastName}
                  </span>
                  <input
                    className="nx-input"
                    type="number"
                    min="0"
                    value={values[item.id] ?? "0"}
                    onChange={(e) => setValues({ ...values, [item.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <button
            className="nx-btn-primary mt-4"
            type="button"
            disabled={!roster.length || !aspectEntry.aspectFieldId}
            onClick={() => void saveAspectValues()}
          >
            Save aspect values
          </button>
        </div>
      ) : null}
    </section>
  );
}
