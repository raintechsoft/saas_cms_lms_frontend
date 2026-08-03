import { useMemo, useState, type FormEvent } from "react";
import { AddOutlined, CloseOutlined, DeleteOutline, EditOutlined, SearchOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup } from "./types";

type ElectiveBoard = {
  classSection: { id: string; academicClass: { id: string; name: string }; section: { id: string; name: string } };
  electiveSubjects: Array<{
    id: string;
    name: string;
    electiveCategory: { id: string; name: string; maxSelect?: number } | null;
  }>;
  students: Array<{
    enrollmentId: string;
    student: { id: string; firstName: string; lastName: string | null; admissionNumber: string };
    selectedSubjectIds: string[];
  }>;
};

export function ElectiveSubjectsPanel({
  setup,
  token,
  canManage,
  focus = "all",
  onSaved,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  canManage: boolean;
  focus?: "categories" | "assign" | "all";
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const showCategories = focus === "categories" || focus === "all";
  const showAssign = focus === "assign" || focus === "all";

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", classId: "", maxSelect: 1 });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState("");

  const [classId, setClassId] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [board, setBoard] = useState<ElectiveBoard | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [boardLoading, setBoardLoading] = useState(false);

  const classSections = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === classId),
    [setup.classSections, classId],
  );
  const subjectGroups = useMemo(
    () => setup.subjectGroups.filter((item) => item.classSectionId === classSectionId),
    [setup.subjectGroups, classSectionId],
  );
  const visibleElectiveSubjects = useMemo(() => {
    if (!board) return [];
    if (!subjectGroupId) return board.electiveSubjects;
    const group = subjectGroups.find((item) => item.id === subjectGroupId);
    const allowedSubjectIds = new Set(group?.items.map((item) => item.classSubject.subject.id) ?? []);
    return board.electiveSubjects.filter((subject) => allowedSubjectIds.has(subject.id));
  }, [board, subjectGroupId, subjectGroups]);
  const boardMaxSelect = useMemo(() => {
    const values = visibleElectiveSubjects.map(
      (subject) =>
        subject.electiveCategory?.maxSelect ??
        setup.electiveCategories.find((category) => category.id === subject.electiveCategory?.id)?.maxSelect ??
        1,
    );
    return Math.max(1, ...values, 1);
  }, [visibleElectiveSubjects, setup.electiveCategories]);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    setSaving("category");
    try {
      await apiRequest(
        editingCategoryId
          ? `/academics/elective-categories/${editingCategoryId}`
          : "/academics/elective-categories",
        token,
        {
        method: editingCategoryId ? "PUT" : "POST",
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          classId: categoryForm.classId || null,
          maxSelect: Number(categoryForm.maxSelect) || 1,
        }),
      });
      setCategoryForm({ name: "", description: "", classId: "", maxSelect: 1 });
      setEditingCategoryId(null);
      notifySuccess(editingCategoryId ? "Elective category updated." : "Elective category created.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create elective category");
    } finally {
      setSaving("");
    }
  }

  function startCategoryEdit(id: string) {
    const category = setup.electiveCategories.find((item) => item.id === id);
    if (!category) return;
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      classId: category.classId ?? "",
      maxSelect: category.maxSelect,
    });
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
    setCategoryForm({ name: "", description: "", classId: "", maxSelect: 1 });
  }

  async function deleteCategory(id: string) {
    const ok = await confirmDelete({
      title: "Delete elective category?",
      text: "Subjects linked to this category will keep their type but lose the category link.",
      confirmText: "Delete",
    });
    if (!ok) return;
    setSaving(`category-delete-${id}`);
    try {
      await apiRequest(`/academics/elective-categories/${id}`, token, { method: "DELETE" });
      notifySuccess("Elective category deleted.");
      if (editingCategoryId === id) cancelCategoryEdit();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete elective category");
    } finally {
      setSaving("");
    }
  }

  async function loadBoard() {
    if (!classSectionId) {
      onError("Select a class section first.");
      return;
    }
    setBoardLoading(true);
    try {
      const data = await apiRequest<ElectiveBoard>(
        `/academics/electives/board?classSectionId=${encodeURIComponent(classSectionId)}`,
        token,
      );
      setBoard(data);
      const next: Record<string, string[]> = {};
      for (const row of data.students) next[row.enrollmentId] = [...row.selectedSubjectIds];
      setSelections(next);
      notifySuccess(`Loaded ${data.students.length} students for elective assignment.`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load elective board");
    } finally {
      setBoardLoading(false);
    }
  }

  function setSelection(enrollmentId: string, subjectId: string) {
    setSelections((prev) => ({ ...prev, [enrollmentId]: subjectId ? [subjectId] : [] }));
  }

  function toggleSelection(enrollmentId: string, subjectId: string, maxSelect: number) {
    setSelections((prev) => {
      const current = prev[enrollmentId] ?? [];
      if (current.includes(subjectId)) {
        return { ...prev, [enrollmentId]: current.filter((id) => id !== subjectId) };
      }
      if (current.length >= maxSelect) {
        onError(`You can select up to ${maxSelect} elective subject(s).`);
        return prev;
      }
      return { ...prev, [enrollmentId]: [...current, subjectId] };
    });
  }

  async function saveAssignments() {
    if (!classSectionId || !board) {
      onError("Load elective board first.");
      return;
    }
    setSaving("assign");
    try {
      await apiRequest("/academics/electives/assignments", token, {
        method: "PUT",
        body: JSON.stringify({
          classSectionId,
          items: board.students.map((row) => ({
            studentEnrollmentId: row.enrollmentId,
            subjectIds: selections[row.enrollmentId] ?? [],
          })),
        }),
      });
      notifySuccess("Elective subjects saved for students.");
      await loadBoard();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save elective assignments");
    } finally {
      setSaving("");
    }
  }

  return (
    <section className="mt-5 space-y-5">
      {showCategories ? (
      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-[15px] font-bold text-slate-900">Elective Categories</h3>
        </div>
        <div className={`grid items-start gap-4 p-4 ${canManage ? "lg:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
          {canManage ? (
            <form onSubmit={addCategory}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-slate-700">
                  {editingCategoryId ? "Edit Category" : "New Category"}
                </span>
                {editingCategoryId ? (
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100"
                    onClick={cancelCategoryEdit}
                    aria-label="Cancel editing category"
                  >
                    <CloseOutlined sx={{ fontSize: 16 }} />
                  </button>
                ) : null}
              </div>
              <label className="mt-3 block">
                <span className="nx-label !normal-case !tracking-normal">Category Name</span>
                <input
                  className="nx-input bg-white"
                  required
                  value={categoryForm.name}
                  onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                  placeholder="Enter category name"
                />
              </label>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Description</span>
                <input
                  className="nx-input bg-white"
                  value={categoryForm.description}
                  onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}
                  placeholder="Optional description"
                />
              </label>
              <label className="mt-4 block">
                <span className="nx-label !normal-case !tracking-normal">Class</span>
                <select
                  className="nx-input bg-white"
                  value={categoryForm.classId}
                  onChange={(event) => setCategoryForm({ ...categoryForm, classId: event.target.value })}
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
                <span className="nx-label !normal-case !tracking-normal">Max Select</span>
                <input
                  className="nx-input bg-white"
                  type="number"
                  min={1}
                  required
                  value={categoryForm.maxSelect}
                  onChange={(event) =>
                    setCategoryForm({ ...categoryForm, maxSelect: Math.max(1, Number(event.target.value) || 1) })
                  }
                />
              </label>
              <button className="nx-btn-primary mt-4 w-full" type="submit" disabled={saving === "category"}>
                <AddOutlined sx={{ fontSize: 15 }} />
                {saving === "category" ? "Saving…" : editingCategoryId ? "Save Category" : "Add Category"}
              </button>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="nx-table !min-w-[640px]">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Category Name</th>
                  <th>Class</th>
                  <th>Max Select</th>
                  <th>Subjects Assigned</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {setup.electiveCategories.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-slate-800">{item.name}</td>
                    <td className="text-slate-700">{item.academicClass?.name ?? "All classes"}</td>
                    <td className="font-medium text-slate-700">{item.maxSelect}</td>
                    <td className="font-medium text-slate-700">{item._count.subjects}</td>
                    {canManage ? (
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                            onClick={() => startCategoryEdit(item.id)}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-300 bg-white p-1.5 text-rose-500 hover:bg-rose-50"
                            disabled={saving.startsWith("category-delete")}
                            onClick={() => void deleteCategory(item.id)}
                            aria-label={`Delete ${item.name}`}
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!setup.electiveCategories.length ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="py-8 text-center text-sm text-slate-500">
                      No elective categories yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : null}

      {showAssign ? (
      <div className="nx-card p-4">
        <h3 className="text-[15px] font-bold text-slate-900">Assign Elective Subjects</h3>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setClassSectionId("");
                setSubjectGroupId("");
                setBoard(null);
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
          <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={classSectionId}
              disabled={!classId}
              onChange={(event) => {
                setClassSectionId(event.target.value);
                setSubjectGroupId("");
                setBoard(null);
              }}
            >
              <option value="">Select section</option>
              {classSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[170px] flex-1 sm:max-w-[220px]">
            <span className="nx-label !normal-case !tracking-normal">Subject Group</span>
            <select
              className="nx-input bg-white"
              value={subjectGroupId}
              disabled={!classSectionId}
              onChange={(event) => setSubjectGroupId(event.target.value)}
            >
              <option value="">All subject groups</option>
              {subjectGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
            disabled={boardLoading || !classSectionId}
            onClick={() => void loadBoard()}
          >
            <SearchOutlined sx={{ fontSize: 17 }} />
            {boardLoading ? "Searching…" : "Search"}
          </button>
          {canManage && board ? (
            <button
              type="button"
              className="nx-btn-primary ml-auto"
              disabled={saving === "assign" || !board.students.length}
              onClick={() => void saveAssignments()}
            >
              {saving === "assign" ? "Saving…" : "Save Choices"}
            </button>
          ) : null}
        </div>

        {board ? (
          <div className="mt-4 overflow-x-auto rounded border border-slate-200">
            {!visibleElectiveSubjects.length ? (
              <p className="bg-amber-50 px-4 py-8 text-center text-sm text-amber-700">
                No elective subjects are available for this selection.
              </p>
            ) : (
              <table className="nx-table !min-w-[720px]">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="w-10" aria-label="Row number" />
                    <th>Student Name</th>
                    <th>Admission No.</th>
                    <th>Current Elective Category</th>
                    <th>Elective Choice</th>
                  </tr>
                </thead>
                <tbody>
                  {board.students.map((row, index) => {
                    const selectedIds = selections[row.enrollmentId] ?? [];
                    const selectedSubjects = board.electiveSubjects.filter((subject) =>
                      selectedIds.includes(subject.id),
                    );
                    const categoryNames = [
                      ...new Set(
                        selectedSubjects
                          .map((subject) => subject.electiveCategory?.name)
                          .filter(Boolean),
                      ),
                    ];
                    return (
                      <tr key={row.enrollmentId}>
                        <td className="text-center font-medium text-slate-700">{index + 1}</td>
                        <td className="font-semibold text-slate-800">
                          {row.student.firstName} {row.student.lastName ?? ""}
                        </td>
                        <td className="font-medium text-slate-700">{row.student.admissionNumber}</td>
                        <td>
                          {categoryNames.length ? (
                            <div className="flex flex-wrap gap-1">
                              {categoryNames.map((name) => (
                                <span
                                  key={String(name)}
                                  className="nx-pill border border-indigo-200 bg-indigo-50 text-indigo-700"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          {boardMaxSelect > 1 ? (
                            <div className="flex max-h-28 min-w-[220px] flex-col gap-1 overflow-auto rounded border border-slate-200 bg-white p-2">
                              {visibleElectiveSubjects.map((subject) => {
                                const checked = selectedIds.includes(subject.id);
                                return (
                                  <label
                                    key={subject.id}
                                    className="flex items-center gap-2 text-[12px] text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!canManage}
                                      checked={checked}
                                      onChange={() =>
                                        toggleSelection(row.enrollmentId, subject.id, boardMaxSelect)
                                      }
                                    />
                                    {subject.name}
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <select
                              className="nx-input bg-white !py-1.5"
                              disabled={!canManage}
                              value={selectedIds[0] ?? ""}
                              onChange={(event) => setSelection(row.enrollmentId, event.target.value)}
                            >
                              <option value="">Select elective subject</option>
                              {visibleElectiveSubjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!board.students.length ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                        No active students in this class section.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
      </div>
      ) : null}
    </section>
  );
}
