import { useState, type FormEvent } from "react";
import { AddOutlined, CheckOutlined, CloseOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, SubjectDeliveryType, SubjectItem } from "./types";

interface DraftForm {
  name: string;
  code: string;
  deliveryType: SubjectDeliveryType;
  electiveCategoryId: string;
}

const emptyForm: DraftForm = {
  name: "",
  code: "",
  deliveryType: "THEORY",
  electiveCategoryId: "",
};

export function SubjectsPanel({
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
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftForm>(emptyForm);
  const [busyKey, setBusyKey] = useState("");

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiRequest("/academics/subjects", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || null,
          type: form.electiveCategoryId ? "ELECTIVE" : "CORE",
          deliveryType: form.deliveryType,
          electiveCategoryId: form.electiveCategoryId || null,
        }),
      });
      setForm(emptyForm);
      notifySuccess(`Subject "${form.name.trim()}" added.`);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add subject");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: SubjectItem) {
    setEditingId(item.id);
    setEditDraft({
      name: item.name,
      code: item.code ?? "",
      deliveryType: item.deliveryType,
      electiveCategoryId: item.electiveCategoryId ?? "",
    });
  }

  async function saveEdit(id: string) {
    if (!editDraft.name.trim()) return;
    setBusyKey(`edit-${id}`);
    try {
      await apiRequest(`/academics/subjects/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name: editDraft.name.trim(),
          code: editDraft.code.trim() || null,
          type: editDraft.electiveCategoryId ? "ELECTIVE" : "CORE",
          deliveryType: editDraft.deliveryType,
          electiveCategoryId: editDraft.electiveCategoryId || null,
        }),
      });
      setEditingId(null);
      notifySuccess("Subject updated.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update subject");
    } finally {
      setBusyKey("");
    }
  }

  async function remove(item: SubjectItem) {
    const ok = await confirmDelete({
      title: "Delete subject?",
      text: `"${item.name}" will be deleted if it is not assigned to a class section, group, or elective.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyKey(`delete-${item.id}`);
    try {
      await apiRequest(`/academics/subjects/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Subject deleted.");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete subject");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="mt-5">
      <div className={`grid items-start gap-4 ${canManage ? "lg:grid-cols-[230px_minmax(0,1fr)]" : ""}`}>
        {canManage ? (
          <form className="nx-card p-4" onSubmit={addSubject}>
            <h3 className="text-[15px] font-bold text-slate-900">Add Subject</h3>

            <label className="mt-5 block">
              <span className="nx-label !normal-case !tracking-normal">Subject Name</span>
              <input
                className="nx-input bg-white"
                placeholder="Enter subject name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <fieldset className="mt-5">
              <legend className="nx-label !normal-case !tracking-normal">Subject Type</legend>
              <div className="mt-2 flex items-center gap-7">
                {(["THEORY", "PRACTICAL"] as const).map((deliveryType) => (
                  <label
                    key={deliveryType}
                    className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-700"
                  >
                    <input
                      type="radio"
                      name="subject-delivery"
                      className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={form.deliveryType === deliveryType}
                      onChange={() => setForm({ ...form, deliveryType })}
                    />
                    {deliveryType === "THEORY" ? "Theory" : "Practical"}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 block">
              <span className="nx-label !normal-case !tracking-normal">Subject Code</span>
              <input
                className="nx-input bg-white"
                placeholder="Enter subject code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </label>

            <label className="mt-5 block">
              <span className="nx-label !normal-case !tracking-normal">Elective Category</span>
              <select
                className="nx-input bg-white"
                value={form.electiveCategoryId}
                onChange={(event) => setForm({ ...form, electiveCategoryId: event.target.value })}
              >
                <option value="">Select category</option>
                {setup.electiveCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-[10px] text-slate-500">Leave blank if compulsory</span>
            </label>

            <button className="nx-btn-primary mt-12 w-full" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 15 }} />
              {saving ? "Adding…" : "Add Subject"}
            </button>
          </form>
        ) : null}

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Existing Subjects</h3>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="nx-table !min-w-[680px]">
              <thead className="bg-slate-50/80">
                <tr>
                  <th>Subject Name</th>
                  <th>Type</th>
                  <th>Subject Code</th>
                  <th>Elective Category</th>
                  {canManage ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {setup.subjects.map((item) => {
                  const isEditing = editingId === item.id;
                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-indigo-50/30">
                        <td>
                          <input
                            className="nx-input bg-white !py-1.5"
                            value={editDraft.name}
                            onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={editDraft.deliveryType}
                            onChange={(event) =>
                              setEditDraft({
                                ...editDraft,
                                deliveryType: event.target.value as SubjectDeliveryType,
                              })
                            }
                          >
                            <option value="THEORY">Theory</option>
                            <option value="PRACTICAL">Practical</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="nx-input bg-white !py-1.5"
                            value={editDraft.code}
                            onChange={(event) => setEditDraft({ ...editDraft, code: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="nx-input bg-white !py-1.5"
                            value={editDraft.electiveCategoryId}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, electiveCategoryId: event.target.value })
                            }
                          >
                            <option value="">Compulsory</option>
                            {setup.electiveCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="rounded border border-emerald-300 p-1.5 text-emerald-600 hover:bg-emerald-50"
                              disabled={busyKey === `edit-${item.id}`}
                              onClick={() => void saveEdit(item.id)}
                              aria-label="Save subject"
                            >
                              <CheckOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel editing"
                            >
                              <CloseOutlined sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id}>
                      <td className="font-semibold text-slate-800">{item.name}</td>
                      <td>
                        <span
                          className={`nx-pill ${
                            item.deliveryType === "PRACTICAL"
                              ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                              : "border border-blue-100 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {item.deliveryType === "PRACTICAL" ? "Practical" : "Theory"}
                        </span>
                      </td>
                      <td className="font-medium text-slate-700">{item.code || "—"}</td>
                      <td>
                        <span
                          className={`nx-pill ${
                            item.type === "ELECTIVE"
                              ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                          title={item.electiveCategory?.name ?? undefined}
                        >
                          {item.type === "ELECTIVE" ? "Elective" : "Compulsory"}
                        </span>
                      </td>
                      {canManage ? (
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded border border-indigo-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                              onClick={() => startEdit(item)}
                            >
                              <EditOutlined sx={{ fontSize: 14 }} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded border border-rose-300 bg-white p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                              disabled={busyKey === `delete-${item.id}`}
                              onClick={() => void remove(item)}
                              aria-label={`Delete ${item.name}`}
                            >
                              <DeleteOutline sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {!setup.subjects.length ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="py-12 text-center text-sm text-slate-500">
                      No subjects yet. Add one from the form.
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
