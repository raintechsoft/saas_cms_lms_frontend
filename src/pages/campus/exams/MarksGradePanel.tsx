import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { Setup } from "./types";
import { resultTypeLabel } from "./utils";

const RESULT_TYPES = ["GENERAL", "SCHOOL_GRADING", "COLLEGE_GRADING", "GPA"] as const;

type GradeItem = Setup["grades"][number];

type FormState = {
  name: string;
  minPercent: string;
  maxPercent: string;
  gradePoint: string;
  description: string;
  passStatus: "PASS" | "FAIL";
};

const emptyForm = (): FormState => ({
  name: "",
  minPercent: "",
  maxPercent: "",
  gradePoint: "",
  description: "",
  passStatus: "PASS",
});

function gradeTone(name: string, passStatus: string) {
  if (passStatus === "FAIL" || name.toUpperCase() === "F") return "bg-rose-50 text-rose-700";
  const upper = name.toUpperCase();
  if (upper.startsWith("A+")) return "bg-emerald-50 text-emerald-700";
  if (upper.startsWith("A")) return "bg-emerald-50/80 text-emerald-600";
  if (upper.startsWith("B+")) return "bg-sky-50 text-sky-700";
  if (upper.startsWith("B")) return "bg-blue-50 text-blue-600";
  if (upper.startsWith("C")) return "bg-amber-50 text-amber-700";
  if (upper.startsWith("D")) return "bg-pink-50 text-pink-700";
  return "bg-slate-100 text-slate-700";
}

export function MarksGradePanel({
  setup,
  token,
  onSaved,
  onError,
  showAddRow = false,
  onAddRowHandled,
}: {
  setup: Setup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  showAddRow?: boolean;
  onAddRowHandled?: () => void;
}) {
  const [resultType, setResultType] = useState<string>("SCHOOL_GRADING");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GradeItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (showAddRow) {
      setEditing(null);
      setForm(emptyForm());
      setFormOpen(true);
      onAddRowHandled?.();
    }
  }, [showAddRow, onAddRowHandled]);

  const grades = useMemo(
    () =>
      setup.grades
        .filter((item) => item.resultType === resultType)
        .slice()
        .sort((a, b) => Number(b.minPercent) - Number(a.minPercent)),
    [setup.grades, resultType],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(item: GradeItem) {
    setEditing(item);
    setForm({
      name: item.name,
      minPercent: String(item.minPercent),
      maxPercent: String(item.maxPercent),
      gradePoint: item.gradePoint != null ? String(item.gradePoint) : "",
      description: item.description ?? "",
      passStatus: item.passStatus === "FAIL" ? "FAIL" : "PASS",
    });
    setFormOpen(true);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      onError("Grade name is required.");
      return;
    }
    setSaving(true);
    try {
      const passStatus =
        form.passStatus === "FAIL" ||
        name.toUpperCase() === "F" ||
        form.description.trim().toLowerCase() === "fail"
          ? "FAIL"
          : "PASS";
      const payload = {
        name,
        minPercent: Number(form.minPercent),
        maxPercent: Number(form.maxPercent),
        gradePoint: form.gradePoint === "" ? null : Number(form.gradePoint),
        passStatus,
        description: form.description.trim() || null,
      };
      if (editing) {
        await apiRequest(`/exams/grades/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Grade updated.");
      } else {
        await apiRequest("/exams/grades", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, resultType }),
        });
        notifySuccess("Grade added.");
      }
      cancelForm();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save grade");
    } finally {
      setSaving(false);
    }
  }

  async function removeGrade(item: GradeItem) {
    const ok = await confirmDelete({
      title: "Delete grade?",
      text: `"${item.name}" (${item.minPercent}–${item.maxPercent}%) will be removed.`,
    });
    if (!ok) return;
    setBusyKey(`del-${item.id}`);
    try {
      await apiRequest(`/exams/grades/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Grade deleted.");
      if (editing?.id === item.id) cancelForm();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete grade");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="mt-5">
      <div className="nx-card overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <label className="min-w-[220px]">
            <span className="nx-label !normal-case !tracking-normal">Exam Type</span>
            <select
              className="nx-input bg-white"
              value={resultType}
              onChange={(event) => {
                setResultType(event.target.value);
                cancelForm();
              }}
            >
              {RESULT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {resultTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[880px]">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Grade Name</th>
                <th>Percent From (%)</th>
                <th>Percent To (%)</th>
                <th>Grade Point</th>
                <th>Description</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((item, index) => (
                <tr key={item.id} className={editing?.id === item.id ? "bg-indigo-50/30" : undefined}>
                  <td className="text-center text-slate-600">{index + 1}</td>
                  <td>
                    <span
                      className={`rounded px-2 py-1 text-[11px] font-bold ${gradeTone(
                        item.name,
                        item.passStatus,
                      )}`}
                    >
                      {item.name}
                    </span>
                  </td>
                  <td>{Number(item.minPercent)}</td>
                  <td>{Number(item.maxPercent)}</td>
                  <td>
                    {item.gradePoint != null && item.gradePoint !== ""
                      ? Number(item.gradePoint).toFixed(2)
                      : "—"}
                  </td>
                  <td className="text-slate-600">{item.description || "—"}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border border-indigo-300 p-1.5 text-indigo-600 hover:bg-indigo-50"
                        onClick={() => openEdit(item)}
                        aria-label="Edit grade"
                      >
                        <EditOutlined sx={{ fontSize: 16 }} />
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 p-1.5 text-rose-500 hover:bg-rose-50"
                        disabled={busyKey === `del-${item.id}`}
                        onClick={() => void removeGrade(item)}
                        aria-label="Delete grade"
                      >
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {formOpen ? (
                <tr className="bg-slate-50/80">
                  <td className="text-center text-indigo-500">
                    <AddOutlined sx={{ fontSize: 18 }} />
                  </td>
                  <td colSpan={6}>
                    <form
                      className="grid gap-2 py-1 md:grid-cols-[0.8fr_0.9fr_0.9fr_0.9fr_1.2fr_auto]"
                      onSubmit={(event) => void submit(event)}
                    >
                      <input
                        className="nx-input !py-1.5"
                        required
                        placeholder="Grade name"
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                      />
                      <input
                        className="nx-input !py-1.5"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        placeholder="Percent from"
                        value={form.minPercent}
                        onChange={(event) => setForm({ ...form, minPercent: event.target.value })}
                      />
                      <input
                        className="nx-input !py-1.5"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        placeholder="Percent to"
                        value={form.maxPercent}
                        onChange={(event) => setForm({ ...form, maxPercent: event.target.value })}
                      />
                      <input
                        className="nx-input !py-1.5"
                        type="number"
                        min="0"
                        max="20"
                        step="0.01"
                        placeholder="Grade point"
                        value={form.gradePoint}
                        onChange={(event) => setForm({ ...form, gradePoint: event.target.value })}
                      />
                      <input
                        className="nx-input !py-1.5"
                        placeholder="Description"
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                      />
                      <div className="flex items-center gap-2">
                        <button className="nx-btn-primary !py-1.5" type="submit" disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="nx-btn-secondary !py-1.5 border-indigo-300 text-indigo-700"
                          onClick={cancelForm}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : null}

              {!grades.length && !formOpen ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No grades configured for {resultTypeLabel(resultType)}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="m-3 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          <InfoOutlined sx={{ fontSize: 15 }} className="mt-0.5 shrink-0" />
          Grade points will be used in GPA calculation for GPA-based exam types.
        </div>
      </div>
    </section>
  );
}
