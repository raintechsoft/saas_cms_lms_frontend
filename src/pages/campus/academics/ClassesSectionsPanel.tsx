import { Fragment, useMemo, useState, type FormEvent } from "react";
import { AddOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, ClassSection } from "./types";

export function ClassesSectionsPanel({
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
  const [sectionName, setSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  const [className, setClassName] = useState("");
  const [classSectionIds, setClassSectionIds] = useState<string[]>([]);
  const [savingClass, setSavingClass] = useState(false);

  const [assignClassId, setAssignClassId] = useState<string | null>(null);
  const [assignSectionId, setAssignSectionId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const hasSession = Boolean(setup.currentSession);
  const teachers = setup.teachers;

  const classSectionsByClass = useMemo(() => {
    const map = new Map<string, ClassSection[]>();
    for (const cs of setup.classSections) {
      const list = map.get(cs.academicClass.id) ?? [];
      list.push(cs);
      map.set(cs.academicClass.id, list);
    }
    return map;
  }, [setup.classSections]);

  async function addSection(event: FormEvent) {
    event.preventDefault();
    if (!sectionName.trim()) return;
    setSavingSection(true);
    try {
      await apiRequest("/academics/sections", token, {
        method: "POST",
        body: JSON.stringify({ name: sectionName.trim() }),
      });
      setSectionName("");
      notifySuccess("Section added.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add section");
    } finally {
      setSavingSection(false);
    }
  }

  async function addClass(event: FormEvent) {
    event.preventDefault();
    if (!className.trim()) return;
    setSavingClass(true);
    try {
      await apiRequest("/academics/classes", token, {
        method: "POST",
        body: JSON.stringify({
          name: className.trim(),
          ...(hasSession && classSectionIds.length
            ? {
                academicSessionId: setup.currentSession!.id,
                sectionIds: classSectionIds,
              }
            : {}),
        }),
      });
      setClassName("");
      setClassSectionIds([]);
      notifySuccess("Class added.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add class");
    } finally {
      setSavingClass(false);
    }
  }

  function toggleSectionId(id: string) {
    setClassSectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function promptEditClass(id: string, name: string, code: string | null | undefined) {
    const nextName = window.prompt("Class name", name);
    if (nextName == null || !nextName.trim()) return;
    const nextCode = window.prompt("Short code (optional)", code ?? "");
    if (nextCode == null) return;
    void updateClass(id, nextName.trim(), nextCode.trim() || null);
  }

  async function updateClass(id: string, name: string, code: string | null) {
    setBusyKey(`class-${id}`);
    try {
      await apiRequest(`/academics/classes/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ name, code }),
      });
      notifySuccess("Class updated.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update class");
    } finally {
      setBusyKey("");
    }
  }

  async function updateClassTeacher(classSectionId: string, teacherId: string) {
    setBusyKey(`teacher-${classSectionId}`);
    try {
      await apiRequest(`/academics/class-sections/${classSectionId}`, token, {
        method: "PUT",
        body: JSON.stringify({ classTeacherId: teacherId || null }),
      });
      notifySuccess("Class teacher updated.");
      setAssignClassId(null);
      setAssignSectionId("");
      setAssignTeacherId("");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update class teacher");
    } finally {
      setBusyKey("");
    }
  }

  function openTeacherAssignment(classId: string, sections: ClassSection[]) {
    const first = sections[0];
    setAssignClassId(classId);
    setAssignSectionId(first?.id ?? "");
    setAssignTeacherId(first?.classTeacher?.id ?? "");
  }

  function teacherLabel(sections: ClassSection[]) {
    const names = [
      ...new Set(
        sections
          .filter((section) => section.classTeacher)
          .map((section) => `${section.classTeacher!.firstName} ${section.classTeacher!.lastName}`),
      ),
    ];
    if (!names.length) return null;
    return names.length === 1 ? names[0] : "Multiple teachers";
  }

  return (
    <section className="mt-5">
      <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[196px_minmax(0,1fr)]" : ""}`}>
        {canManage ? (
          <div className="space-y-4">
            <form className="nx-card p-4" onSubmit={addSection}>
              <h3 className="text-[15px] font-bold text-slate-900">Add Section</h3>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Section Name</span>
                <input
                  className="nx-input bg-white"
                  placeholder="Enter section name"
                  required
                  value={sectionName}
                  onChange={(event) => setSectionName(event.target.value)}
                />
              </label>
              <button className="nx-btn-primary mt-4 w-full" type="submit" disabled={savingSection}>
                <AddOutlined sx={{ fontSize: 15 }} />
                {savingSection ? "Adding…" : "Add Section"}
              </button>
            </form>

            <form className="nx-card p-4" onSubmit={addClass}>
              <h3 className="text-[15px] font-bold text-slate-900">Add Class</h3>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Class Name</span>
                <input
                  className="nx-input bg-white"
                  placeholder="Enter class name"
                  required
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </label>

              <fieldset className="mt-4">
                <legend className="nx-label !normal-case !tracking-normal">Sections</legend>
                <div className="mt-2 space-y-2.5">
                  {setup.sections.map((section) => (
                    <label
                      key={section.id}
                      className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={classSectionIds.includes(section.id)}
                        onChange={() => toggleSectionId(section.id)}
                      />
                      {section.name} Section
                    </label>
                  ))}
                  {!setup.sections.length ? (
                    <p className="text-[12px] text-slate-400">Add a section first.</p>
                  ) : null}
                </div>
              </fieldset>

              {!hasSession ? (
                <p className="mt-3 text-[11px] leading-4 text-amber-700">
                  Activate a session to link selected sections.
                </p>
              ) : null}

              <button className="nx-btn-primary mt-5 w-full" type="submit" disabled={savingClass}>
                <AddOutlined sx={{ fontSize: 15 }} />
                {savingClass ? "Adding…" : "Add Class"}
              </button>
            </form>
          </div>
        ) : null}

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Existing Classes</h3>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="nx-table !min-w-[680px]">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Sections</th>
                  <th>Class Teacher</th>
                  <th>Total Students</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
          {setup.classes.map((cls) => {
            const sections = classSectionsByClass.get(cls.id) ?? [];
            const teacher = teacherLabel(sections);
            const totalStudents = sections.reduce((total, section) => total + section._count.enrollments, 0);
            const isAssigning = assignClassId === cls.id;
            return (
              <Fragment key={cls.id}>
                <tr key={cls.id}>
                  <td className="font-semibold text-slate-800">{cls.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {sections.map((section, index) => (
                        <span
                          key={section.id}
                          className={`inline-flex h-6 min-w-6 items-center justify-center rounded border px-1.5 text-[11px] font-bold ${
                            index % 3 === 0
                              ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                              : index % 3 === 1
                                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                : "border-amber-100 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {section.section.name}
                        </span>
                      ))}
                      {!sections.length ? <span className="text-slate-400">—</span> : null}
                    </div>
                  </td>
                  <td>
                    {teacher ? (
                      <span className="text-slate-700">{teacher}</span>
                    ) : (
                      <span className="nx-pill nx-pill-neutral !font-medium">Not assigned</span>
                    )}
                  </td>
                  <td className="font-medium text-slate-700">{totalStudents}</td>
                  {canManage ? (
                    <td>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                          disabled={!sections.length}
                          onClick={() => openTeacherAssignment(cls.id, sections)}
                        >
                          Assign Incharge
                        </button>
                        <button
                          type="button"
                          className="rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                          onClick={() => promptEditClass(cls.id, cls.name, cls.code)}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
                {isAssigning ? (
                  <tr key={`${cls.id}-assignment`} className="!bg-indigo-50/40">
                    <td colSpan={canManage ? 5 : 4}>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="min-w-[150px]">
                          <span className="nx-label">Section</span>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={assignSectionId}
                            onChange={(event) => {
                              const section = sections.find((item) => item.id === event.target.value);
                              setAssignSectionId(event.target.value);
                              setAssignTeacherId(section?.classTeacher?.id ?? "");
                            }}
                          >
                            {sections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {cls.name} - {section.section.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-[210px] flex-1">
                          <span className="nx-label">Class Teacher</span>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={assignTeacherId}
                            onChange={(event) => setAssignTeacherId(event.target.value)}
                          >
                            <option value="">Not assigned</option>
                            {teachers.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.firstName} {person.lastName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="nx-btn-primary !py-1.5 text-[12px]"
                          disabled={!assignSectionId || busyKey === `teacher-${assignSectionId}`}
                          onClick={() => void updateClassTeacher(assignSectionId, assignTeacherId)}
                        >
                          {busyKey === `teacher-${assignSectionId}` ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="nx-btn-secondary !py-1.5 text-[12px]"
                          onClick={() => setAssignClassId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
          {!setup.classes.length ? (
            <tr>
              <td colSpan={canManage ? 5 : 4} className="py-12 text-center text-sm text-slate-500">
                No classes yet. Add one from the form.
              </td>
            </tr>
          ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
