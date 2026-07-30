import { useMemo, useState, type FormEvent } from "react";
import { AddOutlined, CloseOutlined, DeleteOutline, EditOutlined, GroupAddOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, SubjectGroup } from "./types";

export function SubjectGroupsPanel({
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
  const [editing, setEditing] = useState<SubjectGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formClassSectionId, setFormClassSectionId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  const formClassSection = setup.classSections.find((cs) => cs.id === formClassSectionId);
  const availableClassSections = useMemo(
    () => setup.classSections.filter((classSection) => classSection.academicClass.id === formClassId),
    [setup.classSections, formClassId],
  );

  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setFormClassId("");
    setFormClassSectionId("");
    setSelectedSubjectIds([]);
  }

  function startEdit(group: SubjectGroup) {
    setEditing(group);
    setName(group.name);
    setDescription(group.description ?? "");
    setFormClassId(group.classSection.academicClass.id);
    setFormClassSectionId(group.classSectionId);
    setSelectedSubjectIds(group.items.map((item) => item.classSubject.id));
  }

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!formClassSectionId) {
      onError("Select a class section for this group.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/academics/subject-groups/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            classSubjectIds: selectedSubjectIds,
          }),
        });
      } else {
        await apiRequest("/academics/subject-groups", token, {
          method: "POST",
          body: JSON.stringify({
            classSectionId: formClassSectionId,
            name: name.trim(),
            description: description.trim() || null,
            classSubjectIds: selectedSubjectIds,
          }),
        });
      }
      reset();
      notifySuccess(editing ? "Subject group updated." : "Subject group created.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save subject group");
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: SubjectGroup) {
    const ok = await confirmDelete({
      title: "Delete subject group?",
      text: `"${group.name}" will be removed.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyKey(`delete-${group.id}`);
    try {
      await apiRequest(`/academics/subject-groups/${group.id}`, token, { method: "DELETE" });
      notifySuccess("Subject group deleted.");
      if (editing?.id === group.id) reset();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete subject group");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="mt-5">
      <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        {canManage ? (
          <form className="nx-card p-4" onSubmit={(event) => void submit(event)}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-slate-900">
                {editing ? "Edit Subject Group" : "Add Subject Group"}
              </h3>
              {editing ? (
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                  onClick={reset}
                  aria-label="Cancel editing"
                >
                  <CloseOutlined sx={{ fontSize: 17 }} />
                </button>
              ) : null}
            </div>

            <label className="mt-5 block">
              <span className="nx-label !normal-case !tracking-normal">Group Name</span>
              <input
                className="nx-input bg-white"
                required
                placeholder="Enter group name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="mt-5 block">
              <span className="nx-label !normal-case !tracking-normal">Class</span>
              <select
                className="nx-input bg-white"
                required
                disabled={Boolean(editing)}
                value={formClassId}
                onChange={(event) => {
                  setFormClassId(event.target.value);
                  setFormClassSectionId("");
                  setSelectedSubjectIds([]);
                }}
              >
                <option value="">Select class</option>
                {setup.classes.map((academicClass) => (
                  <option key={academicClass.id} value={academicClass.id}>
                    {academicClass.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span className="nx-label !normal-case !tracking-normal">Section</span>
              <select
                className="nx-input bg-white"
                required
                disabled={!formClassId || Boolean(editing)}
                value={formClassSectionId}
                onChange={(event) => {
                  setFormClassSectionId(event.target.value);
                  setSelectedSubjectIds([]);
                }}
              >
                <option value="">Select section</option>
                {availableClassSections.map((classSection) => (
                  <option key={classSection.id} value={classSection.id}>
                    {classSection.section.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="mt-5">
              <legend className="nx-label !normal-case !tracking-normal">Select Subjects</legend>
              <div className="mt-2 max-h-[190px] space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                {(formClassSection?.subjects ?? []).map((classSubject) => (
                  <label
                    key={classSubject.id}
                    className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedSubjectIds.includes(classSubject.id)}
                      onChange={() => toggleSubject(classSubject.id)}
                    />
                    {classSubject.subject.name}
                  </label>
                ))}
                {!formClassSection ? (
                  <p className="py-2 text-[11px] text-slate-400">Select a class and section first.</p>
                ) : !formClassSection.subjects.length ? (
                  <p className="py-2 text-[11px] text-slate-400">No subjects assigned to this section.</p>
                ) : null}
              </div>
            </fieldset>

            <button className="nx-btn-primary mt-4 w-full" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 15 }} />
              {saving ? "Saving…" : editing ? "Save Group" : "Create Group"}
            </button>

            {editing ? (
              <button
                type="button"
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                disabled={busyKey === `delete-${editing.id}`}
                onClick={() => void remove(editing)}
              >
                <DeleteOutline sx={{ fontSize: 15 }} />
                Delete Group
              </button>
            ) : null}
          </form>
        ) : null}

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Existing Subject Groups</h3>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="nx-table !min-w-[760px]">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Group Name</th>
                  <th>Class / Section</th>
                  <th>Subjects Included</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {setup.subjectGroups.map((group) => (
                  <tr key={group.id}>
                    <td className="font-semibold text-slate-800">{group.name}</td>
                    <td className="whitespace-nowrap text-slate-700">
                      {group.classSection.academicClass.name} - {group.classSection.section.name}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item, index) => (
                          <span
                            key={item.id}
                            className={`nx-pill border ${
                              item.classSubject.subject.type === "ELECTIVE"
                                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                : index % 4 === 3
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                  : "border-blue-100 bg-blue-50 text-blue-700"
                            }`}
                          >
                            {item.classSubject.subject.name}
                          </span>
                        ))}
                        {!group.items.length ? <span className="text-slate-400">No subjects</span> : null}
                      </div>
                    </td>
                    {canManage ? (
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            onClick={() => startEdit(group)}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            onClick={() => startEdit(group)}
                          >
                            <GroupAddOutlined sx={{ fontSize: 14 }} />
                            Assign Elective Subjects
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!setup.subjectGroups.length ? (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="py-12 text-center text-sm text-slate-500">
                      No subject groups yet. Create one from the form.
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
