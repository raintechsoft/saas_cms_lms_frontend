import { useMemo, useState, type FormEvent } from "react";
import { AddOutlined, DeleteOutline } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup } from "./types";
import { classSectionLabel } from "./utils";

export function AssignSubjectsPanel({
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
  const [classId, setClassId] = useState(setup.classSections[0]?.academicClass.id ?? "");
  const [classSectionId, setClassSectionId] = useState(setup.classSections[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  const sectionsForClass = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === classId),
    [setup.classSections, classId],
  );

  const selectedSection =
    setup.classSections.find((item) => item.id === classSectionId) ?? sectionsForClass[0] ?? null;

  const assignedSubjectIds = new Set((selectedSection?.subjects ?? []).map((item) => item.subject.id));
  const availableSubjects = setup.subjects.filter((item) => !assignedSubjectIds.has(item.id));

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!classSectionId || !subjectId) {
      onError("Select class section and subject");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/academics/subject-assignments", token, {
        method: "POST",
        body: JSON.stringify({
          classSectionId,
          subjectId,
          teacherId: teacherId || null,
        }),
      });
      notifySuccess("Subject assigned to class section");
      setSubjectId("");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to assign subject");
    } finally {
      setBusy(false);
    }
  }

  async function updateTeacher(assignmentId: string, nextTeacherId: string) {
    const row = selectedSection?.subjects.find((item) => item.id === assignmentId);
    if (!row || !selectedSection) return;
    setBusyKey(assignmentId);
    try {
      await apiRequest("/academics/subject-assignments", token, {
        method: "POST",
        body: JSON.stringify({
          classSectionId: selectedSection.id,
          subjectId: row.subject.id,
          teacherId: nextTeacherId || null,
        }),
      });
      notifySuccess("Subject teacher updated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update teacher");
    } finally {
      setBusyKey("");
    }
  }

  async function remove(assignmentId: string, subjectName: string) {
    const ok = await confirmDelete({
      title: "Remove subject?",
      text: `Remove ${subjectName} from this class section?`,
      confirmText: "Yes, remove",
    });
    if (!ok) return;
    setBusyKey(`del-${assignmentId}`);
    try {
      await apiRequest(`/academics/subject-assignments/${assignmentId}`, token, { method: "DELETE" });
      notifySuccess("Subject removed from class section");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to remove subject");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="mt-5 grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {canManage ? (
        <form className="nx-card p-4" onSubmit={assign}>
          <h3 className="text-[15px] font-bold text-slate-900">Assign subject to class</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Subjects must be linked to a class-section before they appear in timetable, homework, or
            exams.
          </p>

          <label className="mt-4 block">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input mt-1 w-full bg-white"
              required
              value={classId}
              onChange={(e) => {
                const nextClassId = e.target.value;
                const first = setup.classSections.find(
                  (item) => item.academicClass.id === nextClassId,
                );
                setClassId(nextClassId);
                setClassSectionId(first?.id ?? "");
              }}
            >
              <option value="">Select class</option>
              {setup.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input mt-1 w-full bg-white"
              required
              disabled={!classId}
              value={classSectionId}
              onChange={(e) => setClassSectionId(e.target.value)}
            >
              <option value="">Select section</option>
              {sectionsForClass.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.section.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="nx-label !normal-case !tracking-normal">Subject</span>
            <select
              className="nx-input mt-1 w-full bg-white"
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select subject</option>
              {availableSubjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.code ? ` (${item.code})` : ""}
                </option>
              ))}
            </select>
            {!availableSubjects.length ? (
              <p className="mt-1 text-[12px] text-amber-700">
                All subjects are already assigned, or no subjects exist yet.
              </p>
            ) : null}
          </label>

          <label className="mt-3 block">
            <span className="nx-label !normal-case !tracking-normal">Teacher (optional)</span>
            <select
              className="nx-input mt-1 w-full bg-white"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {setup.teachers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="nx-btn-primary mt-5 w-full"
            disabled={busy || !classSectionId || !subjectId}
          >
            <AddOutlined sx={{ fontSize: 16 }} />
            {busy ? "Assigning…" : "Assign subject"}
          </button>
        </form>
      ) : null}

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-900">
            {selectedSection ? classSectionLabel(selectedSection) : "Class subjects"}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            Linked subjects for this class-section (used by timetable / homework / exams).
          </p>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="nx-table !min-w-[560px]">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th>Teacher</th>
                {canManage ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(selectedSection?.subjects ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold text-slate-800">{row.subject.name}</td>
                  <td className="text-slate-600">{row.subject.code ?? "—"}</td>
                  <td>
                    {canManage ? (
                      <select
                        className="nx-input !py-1.5 bg-white"
                        value={row.teacher?.id ?? ""}
                        disabled={busyKey === row.id}
                        onChange={(e) => void updateTeacher(row.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {setup.teachers.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.firstName} {person.lastName}
                          </option>
                        ))}
                      </select>
                    ) : row.teacher ? (
                      `${row.teacher.firstName} ${row.teacher.lastName}`
                    ) : (
                      <span className="nx-pill nx-pill-neutral">Unassigned</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        disabled={busyKey === `del-${row.id}`}
                        onClick={() => void remove(row.id, row.subject.name)}
                      >
                        <DeleteOutline sx={{ fontSize: 15 }} /> Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!selectedSection?.subjects.length ? (
                <tr>
                  <td
                    colSpan={canManage ? 4 : 3}
                    className="py-12 text-center text-sm text-slate-500"
                  >
                    No subjects linked yet. Assign Mathematics, English, etc. from the form.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
