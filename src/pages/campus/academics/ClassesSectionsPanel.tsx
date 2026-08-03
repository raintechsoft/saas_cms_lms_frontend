import { Fragment, useMemo, useState, type FormEvent } from "react";
import { AddOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, ClassSection } from "./types";

type Focus = "sections" | "classes" | "incharge";

export function ClassesSectionsPanel({
  setup,
  token,
  canManage,
  focus = "classes",
  onSaved,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  canManage: boolean;
  focus?: Focus;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [sectionName, setSectionName] = useState("");
  const [savingSection, setSavingSection] = useState(false);
  const [editSectionId, setEditSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState("");

  const [className, setClassName] = useState("");
  const [classSectionIds, setClassSectionIds] = useState<string[]>([]);
  const [inTime, setInTime] = useState("");
  const [halfDayTime, setHalfDayTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [savingClass, setSavingClass] = useState(false);

  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editInTime, setEditInTime] = useState("");
  const [editHalfDayTime, setEditHalfDayTime] = useState("");
  const [editOutTime, setEditOutTime] = useState("");

  const [addSectionClassId, setAddSectionClassId] = useState<string | null>(null);
  const [addSectionId, setAddSectionId] = useState("");

  const [inchargeClassId, setInchargeClassId] = useState("");
  const [inchargeClassSectionId, setInchargeClassSectionId] = useState("");
  const [inchargeTeacherId, setInchargeTeacherId] = useState("");
  const [savingIncharge, setSavingIncharge] = useState(false);

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

  const inchargeSections = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === inchargeClassId),
    [setup.classSections, inchargeClassId],
  );

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

  async function updateSection(id: string) {
    const name = editSectionName.trim();
    if (!name) {
      onError("Section name is required");
      return;
    }
    setBusyKey(`section-${id}`);
    try {
      await apiRequest(`/academics/sections/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      notifySuccess("Section updated.");
      setEditSectionId(null);
      setEditSectionName("");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update section");
    } finally {
      setBusyKey("");
    }
  }

  async function deleteSection(id: string, name: string) {
    const ok = await confirmDelete({
      title: "Delete section?",
      text: `"${name}" will be removed if it is not linked to classes.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyKey(`section-delete-${id}`);
    try {
      await apiRequest(`/academics/sections/${id}`, token, { method: "DELETE" });
      notifySuccess("Section deleted.");
      if (editSectionId === id) {
        setEditSectionId(null);
        setEditSectionName("");
      }
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete section");
    } finally {
      setBusyKey("");
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
          inTime: inTime || null,
          halfDayTime: halfDayTime || null,
          outTime: outTime || null,
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
      setInTime("");
      setHalfDayTime("");
      setOutTime("");
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

  function openEditClass(cls: { id: string; name: string; code?: string | null; inTime?: string | null; halfDayTime?: string | null; outTime?: string | null }) {
    setAddSectionClassId(null);
    setEditClassId(cls.id);
    setEditName(cls.name);
    setEditCode(cls.code ?? "");
    setEditInTime(cls.inTime ?? "");
    setEditHalfDayTime(cls.halfDayTime ?? "");
    setEditOutTime(cls.outTime ?? "");
  }

  function closeEditClass() {
    setEditClassId(null);
    setEditName("");
    setEditCode("");
    setEditInTime("");
    setEditHalfDayTime("");
    setEditOutTime("");
  }

  async function updateClass(id: string) {
    const name = editName.trim();
    if (!name) {
      onError("Class name is required");
      return;
    }
    setBusyKey(`class-${id}`);
    try {
      await apiRequest(`/academics/classes/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name,
          code: editCode.trim() || null,
          inTime: editInTime || null,
          halfDayTime: editHalfDayTime || null,
          outTime: editOutTime || null,
        }),
      });
      notifySuccess("Class updated.");
      closeEditClass();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update class");
    } finally {
      setBusyKey("");
    }
  }

  async function linkSectionToClass(classId: string) {
    if (!hasSession) {
      onError("Activate a session to link sections.");
      return;
    }
    if (!addSectionId) {
      onError("Select a section to add.");
      return;
    }
    setBusyKey(`link-${classId}`);
    try {
      await apiRequest("/academics/class-sections", token, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: setup.currentSession!.id,
          classId,
          sectionId: addSectionId,
        }),
      });
      notifySuccess("Section linked to class.");
      setAddSectionClassId(null);
      setAddSectionId("");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add section to class");
    } finally {
      setBusyKey("");
    }
  }

  async function saveIncharge(event: FormEvent) {
    event.preventDefault();
    if (!inchargeClassSectionId) {
      onError("Select a class and section.");
      return;
    }
    setSavingIncharge(true);
    try {
      await apiRequest(`/academics/class-sections/${inchargeClassSectionId}`, token, {
        method: "PUT",
        body: JSON.stringify({ classTeacherId: inchargeTeacherId || null }),
      });
      notifySuccess("Class teacher updated.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update class teacher");
    } finally {
      setSavingIncharge(false);
    }
  }

  if (focus === "sections") {
    return (
      <section className="mt-5">
        <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[196px_minmax(0,1fr)]" : ""}`}>
          {canManage ? (
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
                {savingSection ? "Saving…" : "Save"}
              </button>
            </form>
          ) : null}

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[15px] font-bold text-slate-900">Sections</h3>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="nx-table !min-w-[420px]">
                <thead>
                  <tr>
                    <th>Section Name</th>
                    {canManage ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {setup.sections.map((section) => (
                    <Fragment key={section.id}>
                      <tr>
                        <td className="font-semibold text-slate-800">{section.name}</td>
                        {canManage ? (
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                                onClick={() => {
                                  setEditSectionId(editSectionId === section.id ? null : section.id);
                                  setEditSectionName(section.name);
                                }}
                              >
                                <EditOutlined sx={{ fontSize: 14 }} />
                                Rename
                              </button>
                              <button
                                type="button"
                                className="rounded border border-rose-300 bg-white p-1.5 text-rose-500 hover:bg-rose-50"
                                disabled={busyKey === `section-delete-${section.id}`}
                                onClick={() => void deleteSection(section.id, section.name)}
                                aria-label={`Delete ${section.name}`}
                              >
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                      {editSectionId === section.id ? (
                        <tr className="!bg-indigo-50/40">
                          <td colSpan={canManage ? 2 : 1}>
                            <form
                              className="flex flex-wrap items-end gap-3"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void updateSection(section.id);
                              }}
                            >
                              <label className="min-w-[210px] flex-1">
                                <span className="nx-label">Section Name</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  required
                                  autoFocus
                                  value={editSectionName}
                                  onChange={(event) => setEditSectionName(event.target.value)}
                                />
                              </label>
                              <button
                                type="submit"
                                className="nx-btn-primary !py-1.5 text-[12px]"
                                disabled={busyKey === `section-${section.id}`}
                              >
                                {busyKey === `section-${section.id}` ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="nx-btn-secondary !py-1.5 text-[12px]"
                                onClick={() => {
                                  setEditSectionId(null);
                                  setEditSectionName("");
                                }}
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                  {!setup.sections.length ? (
                    <tr>
                      <td colSpan={canManage ? 2 : 1} className="py-12 text-center text-sm text-slate-500">
                        No sections yet. Add one from the form.
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

  if (focus === "incharge") {
    return (
      <section className="mt-5">
        <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[260px_minmax(0,1fr)]" : ""}`}>
          {canManage ? (
            <form className="nx-card p-4" onSubmit={saveIncharge}>
              <h3 className="text-[15px] font-bold text-slate-900">Assign Class Incharge</h3>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Class</span>
                <select
                  className="nx-input bg-white"
                  required
                  value={inchargeClassId}
                  onChange={(event) => {
                    const nextClassId = event.target.value;
                    const first = setup.classSections.find((item) => item.academicClass.id === nextClassId);
                    setInchargeClassId(nextClassId);
                    setInchargeClassSectionId(first?.id ?? "");
                    setInchargeTeacherId(first?.classTeacher?.id ?? "");
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
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Section</span>
                <select
                  className="nx-input bg-white"
                  required
                  disabled={!inchargeClassId}
                  value={inchargeClassSectionId}
                  onChange={(event) => {
                    const section = inchargeSections.find((item) => item.id === event.target.value);
                    setInchargeClassSectionId(event.target.value);
                    setInchargeTeacherId(section?.classTeacher?.id ?? "");
                  }}
                >
                  <option value="">Select section</option>
                  {inchargeSections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Class Teacher</span>
                <select
                  className="nx-input bg-white"
                  value={inchargeTeacherId}
                  onChange={(event) => setInchargeTeacherId(event.target.value)}
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
                className="nx-btn-primary mt-5 w-full"
                type="submit"
                disabled={savingIncharge || !inchargeClassSectionId}
              >
                {savingIncharge ? "Saving…" : "Save"}
              </button>
            </form>
          ) : null}

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[15px] font-bold text-slate-900">Class Incharge</h3>
            </div>
            <div className="overflow-x-auto p-3">
              <table className="nx-table !min-w-[560px]">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Class Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.classSections.map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold text-slate-800">{item.academicClass.name}</td>
                      <td className="font-medium text-slate-700">{item.section.name}</td>
                      <td>
                        {item.classTeacher ? (
                          <span className="text-slate-700">
                            {item.classTeacher.firstName} {item.classTeacher.lastName}
                          </span>
                        ) : (
                          <span className="nx-pill nx-pill-neutral !font-medium">Not assigned</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!setup.classSections.length ? (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-sm text-slate-500">
                        No class sections yet.
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

  // focus === "classes"
  return (
    <section className="mt-5">
      <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        {canManage ? (
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

            <label className="mt-4 block">
              <span className="nx-label !normal-case !tracking-normal">RFID In-time</span>
              <input
                className="nx-input bg-white"
                type="time"
                value={inTime}
                onChange={(event) => setInTime(event.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="nx-label !normal-case !tracking-normal">Half day-time</span>
              <input
                className="nx-input bg-white"
                type="time"
                value={halfDayTime}
                onChange={(event) => setHalfDayTime(event.target.value)}
              />
            </label>
            <label className="mt-3 block">
              <span className="nx-label !normal-case !tracking-normal">Out-time</span>
              <input
                className="nx-input bg-white"
                type="time"
                value={outTime}
                onChange={(event) => setOutTime(event.target.value)}
              />
            </label>

            {!hasSession ? (
              <p className="mt-3 text-[11px] leading-4 text-amber-700">
                Activate a session to link selected sections.
              </p>
            ) : null}

            <button className="nx-btn-primary mt-5 w-full" type="submit" disabled={savingClass}>
              <AddOutlined sx={{ fontSize: 15 }} />
              {savingClass ? "Saving…" : "Save"}
            </button>
          </form>
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
                  <th>RFID Times</th>
                  <th>Total Students</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {setup.classes.map((cls) => {
                  const sections = classSectionsByClass.get(cls.id) ?? [];
                  const totalStudents = sections.reduce((total, section) => total + section._count.enrollments, 0);
                  const linkedSectionIds = new Set(sections.map((item) => item.section.id));
                  const availableSections = setup.sections.filter((section) => !linkedSectionIds.has(section.id));
                  return (
                    <Fragment key={cls.id}>
                      <tr>
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
                        <td className="text-[11px] text-slate-600">
                          {[cls.inTime, cls.halfDayTime, cls.outTime].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="font-medium text-slate-700">{totalStudents}</td>
                        {canManage ? (
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                disabled={!availableSections.length || !hasSession}
                                onClick={() => {
                                  setEditClassId(null);
                                  setAddSectionClassId(addSectionClassId === cls.id ? null : cls.id);
                                  setAddSectionId(availableSections[0]?.id ?? "");
                                }}
                              >
                                Add section
                              </button>
                              <button
                                type="button"
                                className="rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                                onClick={() =>
                                  editClassId === cls.id ? closeEditClass() : openEditClass(cls)
                                }
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                      {editClassId === cls.id ? (
                        <tr className="!bg-indigo-50/40">
                          <td colSpan={canManage ? 5 : 4}>
                            <form
                              className="flex flex-wrap items-end gap-3"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void updateClass(cls.id);
                              }}
                            >
                              <label className="min-w-[180px] flex-1">
                                <span className="nx-label">Class Name</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  required
                                  autoFocus
                                  value={editName}
                                  onChange={(event) => setEditName(event.target.value)}
                                />
                              </label>
                              <label className="min-w-[120px]">
                                <span className="nx-label">Short Code</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  placeholder="e.g. C8"
                                  value={editCode}
                                  onChange={(event) => setEditCode(event.target.value)}
                                />
                              </label>
                              <label className="min-w-[120px]">
                                <span className="nx-label">In-time</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  type="time"
                                  value={editInTime}
                                  onChange={(event) => setEditInTime(event.target.value)}
                                />
                              </label>
                              <label className="min-w-[120px]">
                                <span className="nx-label">Half day</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  type="time"
                                  value={editHalfDayTime}
                                  onChange={(event) => setEditHalfDayTime(event.target.value)}
                                />
                              </label>
                              <label className="min-w-[120px]">
                                <span className="nx-label">Out-time</span>
                                <input
                                  className="nx-input bg-white !py-1.5"
                                  type="time"
                                  value={editOutTime}
                                  onChange={(event) => setEditOutTime(event.target.value)}
                                />
                              </label>
                              <button
                                type="submit"
                                className="nx-btn-primary !py-1.5 text-[12px]"
                                disabled={busyKey === `class-${cls.id}`}
                              >
                                {busyKey === `class-${cls.id}` ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="nx-btn-secondary !py-1.5 text-[12px]"
                                onClick={closeEditClass}
                              >
                                Cancel
                              </button>
                            </form>
                          </td>
                        </tr>
                      ) : null}
                      {addSectionClassId === cls.id ? (
                        <tr className="!bg-indigo-50/40">
                          <td colSpan={canManage ? 5 : 4}>
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="min-w-[180px]">
                                <span className="nx-label">Section</span>
                                <select
                                  className="nx-input bg-white !py-1.5"
                                  value={addSectionId}
                                  onChange={(event) => setAddSectionId(event.target.value)}
                                >
                                  <option value="">Select section</option>
                                  {availableSections.map((section) => (
                                    <option key={section.id} value={section.id}>
                                      {section.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                className="nx-btn-primary !py-1.5 text-[12px]"
                                disabled={!addSectionId || busyKey === `link-${cls.id}`}
                                onClick={() => void linkSectionToClass(cls.id)}
                              >
                                {busyKey === `link-${cls.id}` ? "Saving…" : "Save"}
                              </button>
                              <button
                                type="button"
                                className="nx-btn-secondary !py-1.5 text-[12px]"
                                onClick={() => {
                                  setAddSectionClassId(null);
                                  setAddSectionId("");
                                }}
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
