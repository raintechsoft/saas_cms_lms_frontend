import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CloseOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import { confirmDelete } from "../../../lib/confirm";
import type { FeeDiscount, FeeSetup, Student, StudentFees } from "./types";
import { formatMoney, studentDisplayName } from "./utils";

const PAGE_SIZE = 5;

const DISCOUNT_CATEGORIES = [
  "RTE",
  "SCHOLARSHIP",
  "SIBLING",
  "STAFF WARD",
  "MERIT",
  "OTHER",
] as const;

export function DiscountsPanel({
  setup,
  token,
  onSaved,
  onError,
  openCreateSignal = 0,
  openAssignSignal = 0,
}: {
  setup: FeeSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  openCreateSignal?: number;
  openAssignSignal?: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignDiscountId, setAssignDiscountId] = useState("");
  const [editing, setEditing] = useState<FeeDiscount | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [amountType, setAmountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [appliedClassName, setAppliedClassName] = useState("");
  const [appliedSectionName, setAppliedSectionName] = useState("");
  const [appliedStudentSearch, setAppliedStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});
  const [includeSiblings, setIncludeSiblings] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const rows = useMemo(() => setup.discounts, [setup.discounts]);
  const pageRows = useMemo(() => paginateItems(rows, page, PAGE_SIZE), [rows, page]);

  const allSessionStudents = useMemo(() => {
    const list: Array<Student & { roll: string; rte: boolean; classLabel: string }> = [];
    const seen = new Set<string>();
    setup.classSections.forEach((cs) => {
      cs.enrollments.forEach(({ student }) => {
        if (seen.has(student.id)) return;
        seen.add(student.id);
        list.push({
          ...student,
          roll: student.admissionNumber,
          rte: Boolean(student.rteEnabled),
          classLabel: `${cs.academicClass.name} - ${cs.section.name}`,
        });
      });
    });
    return list;
  }, [setup.classSections]);

  const siblingCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of allSessionStudents) {
      if (!student.siblingGroupId) continue;
      counts.set(student.siblingGroupId, (counts.get(student.siblingGroupId) ?? 0) + 1);
    }
    return counts;
  }, [allSessionStudents]);

  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((cs) => cs.academicClass.name))].sort(),
    [setup.classSections],
  );
  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((cs) => !className || cs.academicClass.name === className)
      .map((cs) => cs.section.name);
    return [...new Set(sections)].sort();
  }, [setup.classSections, className]);

  const assignStudents = useMemo(() => {
    if (!searched) return [];
    const list: Array<Student & { roll: string; rte: boolean; classLabel: string }> = [];
    const seen = new Set<string>();
    setup.classSections.forEach((cs) => {
      if (appliedClassName && cs.academicClass.name !== appliedClassName) return;
      if (appliedSectionName && cs.section.name !== appliedSectionName) return;
      cs.enrollments.forEach(({ student }) => {
        if (seen.has(student.id)) return;
        seen.add(student.id);
        list.push({
          ...student,
          roll: student.admissionNumber,
          rte: Boolean(student.rteEnabled),
          classLabel: `${cs.academicClass.name} - ${cs.section.name}`,
        });
      });
    });
    const q = appliedStudentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        studentDisplayName(s).toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q),
    );
  }, [
    setup.classSections,
    searched,
    appliedClassName,
    appliedSectionName,
    appliedStudentSearch,
  ]);

  function expandWithSiblings(studentIds: string[]) {
    if (!includeSiblings) return [...new Set(studentIds)];
    const selected = new Set(studentIds);
    const groups = new Set(
      allSessionStudents
        .filter((s) => selected.has(s.id) && s.siblingGroupId)
        .map((s) => s.siblingGroupId as string),
    );
    for (const student of allSessionStudents) {
      if (student.siblingGroupId && groups.has(student.siblingGroupId)) {
        selected.add(student.id);
      }
    }
    return [...selected];
  }

  function selectSiblingsFor(student: Student) {
    if (!student.siblingGroupId) {
      onError("This student has no linked siblings");
      return;
    }
    const next = { ...selectedStudentIds };
    allSessionStudents.forEach((s) => {
      if (s.siblingGroupId === student.siblingGroupId) next[s.id] = true;
    });
    setSelectedStudentIds(next);
    notifySuccess("Linked siblings selected");
  }

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, page]);

  useEffect(() => {
    if (!openCreateSignal) return;
    reset();
    setShowForm(true);
  }, [openCreateSignal]);

  useEffect(() => {
    if (!openAssignSignal) return;
    openAssign();
  }, [openAssignSignal]);

  function reset() {
    setEditing(null);
    setName("");
    setCode("");
    setCategory("");
    setAmountType("FIXED");
    setValue("");
    setDescription("");
    setShowForm(false);
  }

  function openAssign(discount?: FeeDiscount) {
    setAssignDiscountId(discount?.id ?? setup.discounts.find((d) => d.isActive !== false)?.id ?? "");
    setClassName(classOptions[0] ?? "");
    setSectionName("");
    setStudentSearch("");
    setSearched(false);
    setAppliedClassName("");
    setAppliedSectionName("");
    setAppliedStudentSearch("");
    setSelectedStudentIds({});
    setIncludeSiblings(true);
    setShowAssign(true);
  }

  function runAssignSearch() {
    setAppliedClassName(className);
    setAppliedSectionName(sectionName);
    setAppliedStudentSearch(studentSearch);
    setSearched(true);
    setSelectedStudentIds({});
  }

  function startEdit(item: FeeDiscount) {
    setShowForm(true);
    setEditing(item);
    setName(item.name);
    setCode(item.code ?? "");
    setCategory(item.category ?? "");
    setAmountType(item.type);
    setValue(String(Number(item.value)));
    setDescription(item.description ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        type: amountType,
        value: Number(value),
      };
      if (editing) {
        await apiRequest(`/fees/discounts/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/fees/discounts", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      reset();
      setPage(1);
      notifySuccess(editing ? "Discount updated" : "Discount saved");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save discount");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: FeeDiscount) {
    const ok = await confirmDelete({
      title: "Delete discount?",
      text: `"${item.name}" will be removed if not in use.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/discounts/${item.id}`, token, { method: "DELETE" });
      if (editing?.id === item.id) reset();
      notifySuccess("Discount deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete discount");
    }
  }

  async function applyAssign() {
    if (!assignDiscountId) {
      onError("Select a discount to assign");
      return;
    }
    if (!searched) {
      onError("Select class/section and click Search first");
      return;
    }
    const ids = expandWithSiblings(
      Object.entries(selectedStudentIds)
        .filter(([, on]) => on)
        .map(([id]) => id),
    );
    if (!ids.length) {
      onError("Select at least one student");
      return;
    }
    setAssigning(true);
    try {
      let applied = 0;
      for (const studentId of ids) {
        const fees = await apiRequest<StudentFees>(`/fees/students/${studentId}`, token);
        const targets = fees.assignments.filter((a) => a.totals.balance > 0);
        const list = targets.length ? targets : fees.assignments;
        for (const assignment of list) {
          await apiRequest(`/fees/assignments/${assignment.id}/discount`, token, {
            method: "PUT",
            body: JSON.stringify({ discountId: assignDiscountId }),
          });
          applied += 1;
        }
      }
      notifySuccess(
        applied
          ? `Discount applied to ${applied} fee assignment(s) across ${ids.length} student(s)`
          : "No fee assignments found for selected students",
      );
      setShowAssign(false);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to assign discount");
    } finally {
      setAssigning(false);
    }
  }

  function categoryPill(categoryValue?: string | null) {
    const valueText = (categoryValue || "OTHER").toUpperCase();
    if (valueText === "RTE") return "nx-pill nx-pill-indigo";
    if (valueText === "SCHOLARSHIP" || valueText === "MERIT") return "nx-pill nx-pill-warning";
    if (valueText === "SIBLING") return "nx-pill nx-pill-neutral";
    if (valueText.includes("STAFF")) return "nx-pill nx-pill-success";
    return "nx-pill nx-pill-neutral";
  }

  const pageStudentIds = assignStudents.map((s) => s.id);
  const allStudentsChecked =
    pageStudentIds.length > 0 && pageStudentIds.every((id) => selectedStudentIds[id]);

  return (
    <section className="mt-5 space-y-4">
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="flex w-full max-w-xl max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onSubmit={(e) => void submit(e)}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-[18px] font-bold text-slate-900">
                {editing ? "Edit discount" : "Add discount"}
              </h3>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={reset}
                aria-label="Close"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="grid shrink-0 gap-3 px-5 py-4 sm:grid-cols-2">
              <div>
                <label className="nx-label">Discount Name</label>
                <input
                  className="nx-input"
                  placeholder="Enter discount name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="nx-label">Discount Code</label>
                <input
                  className="nx-input"
                  placeholder="Enter discount code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label className="nx-label">Type</label>
                <select
                  className="nx-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select type</option>
                  {DISCOUNT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="nx-label">Amount ₹</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-500">
                    {amountType === "PERCENTAGE" ? "%" : "₹"}
                  </span>
                  <input
                    className="nx-input pl-8"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="nx-label">Amount Type</label>
                <div className="mt-1.5 flex flex-wrap gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-[14px] text-slate-700">
                    <input
                      type="radio"
                      name="amountType"
                      className="size-4 accent-[#6366f1]"
                      checked={amountType === "FIXED"}
                      onChange={() => setAmountType("FIXED")}
                    />
                    Fixed amount
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[14px] text-slate-700">
                    <input
                      type="radio"
                      name="amountType"
                      className="size-4 accent-[#6366f1]"
                      checked={amountType === "PERCENTAGE"}
                      onChange={() => setAmountType("PERCENTAGE")}
                    />
                    Percentage
                  </label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="nx-label">Description (Optional)</label>
                <textarea
                  className="nx-input min-h-[72px] resize-none"
                  rows={2}
                  placeholder="Enter description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              <button className="nx-btn-primary w-full !py-2.5" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Discount"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showAssign ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex w-full max-w-3xl max-h-[min(92vh,820px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">Assign / View Discount</h3>
                <p className="mt-1 text-[13px] text-slate-500">
                  Select class and section, click Search, then choose students and save.
                </p>
              </div>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
                onClick={() => setShowAssign(false)}
                aria-label="Close"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="nx-label">Discount</span>
                  <select
                    className="nx-input"
                    value={assignDiscountId}
                    onChange={(e) => setAssignDiscountId(e.target.value)}
                  >
                    <option value="">Select discount</option>
                    {setup.discounts
                      .filter((d) => d.isActive !== false)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Class</span>
                  <select
                    className="nx-input"
                    value={className}
                    onChange={(e) => {
                      setClassName(e.target.value);
                      setSectionName("");
                      setSearched(false);
                    }}
                  >
                    <option value="">All Classes</option>
                    {classOptions.map((nameOption) => (
                      <option key={nameOption} value={nameOption}>
                        {nameOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Section</span>
                  <select
                    className="nx-input"
                    value={sectionName}
                    onChange={(e) => {
                      setSectionName(e.target.value);
                      setSearched(false);
                    }}
                  >
                    <option value="">All Sections</option>
                    {sectionOptions.map((nameOption) => (
                      <option key={nameOption} value={nameOption}>
                        {nameOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[220px] flex-1">
                  <span className="nx-label">Name / roll (optional)</span>
                  <div className="relative">
                    <SearchOutlined
                      sx={{ fontSize: 18 }}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      className="nx-input pl-10"
                      placeholder="Name or roll no..."
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setSearched(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          runAssignSearch();
                        }
                      }}
                    />
                  </div>
                </label>
                <button type="button" className="nx-btn-primary !py-2.5" onClick={runAssignSearch}>
                  <SearchOutlined sx={{ fontSize: 16 }} />
                  Search
                </button>
              </div>
              <label className="flex items-start gap-2 text-[13px] text-slate-600">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#6366f1]"
                  checked={includeSiblings}
                  onChange={(e) => setIncludeSiblings(e.target.checked)}
                />
                <span>
                  Also assign to linked siblings (students sharing a sibling group, even in another
                  class)
                </span>
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="nx-table min-w-full">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={allStudentsChecked}
                        disabled={!searched || !pageStudentIds.length}
                        onChange={(e) => {
                          const next = { ...selectedStudentIds };
                          pageStudentIds.forEach((id) => {
                            next[id] = e.target.checked;
                          });
                          setSelectedStudentIds(next);
                        }}
                      />
                    </th>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>Class</th>
                    <th>RTE</th>
                    <th>Siblings</th>
                  </tr>
                </thead>
                <tbody>
                  {assignStudents.map((student) => {
                    const siblingTotal = student.siblingGroupId
                      ? (siblingCountByGroup.get(student.siblingGroupId) ?? 0)
                      : 0;
                    const hasSiblings = siblingTotal > 1;
                    return (
                      <tr key={student.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedStudentIds[student.id]}
                            onChange={(e) =>
                              setSelectedStudentIds({
                                ...selectedStudentIds,
                                [student.id]: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td className="font-semibold text-slate-900">
                          {studentDisplayName(student)}
                        </td>
                        <td className="font-mono text-[12px] text-slate-600">{student.roll}</td>
                        <td className="text-[12px] text-slate-600">{student.classLabel}</td>
                        <td>
                          <span
                            className={
                              student.rte ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"
                            }
                          >
                            {student.rte ? "Yes" : "No"}
                          </span>
                        </td>
                        <td>
                          {hasSiblings ? (
                            <button
                              type="button"
                              className="text-[12px] font-semibold text-indigo-600 hover:underline"
                              onClick={() => selectSiblingsFor(student)}
                            >
                              Select {siblingTotal - 1} sibling
                              {siblingTotal - 1 === 1 ? "" : "s"}
                            </button>
                          ) : (
                            <span className="text-[12px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!searched ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                        Select class and section, then click <strong>Search</strong> to load students.
                      </td>
                    </tr>
                  ) : null}
                  {searched && !assignStudents.length ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                        No students match the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="flex items-start gap-2 text-[12px] text-slate-500">
                <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0 text-indigo-500" />
                Linked siblings are managed in Student profile. With “Also assign to linked siblings”
                on, Save includes them automatically.
              </p>
              <button
                type="button"
                className="nx-btn-primary"
                disabled={assigning || !searched}
                onClick={() => void applyAssign()}
              >
                {assigning ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[22px] font-bold text-slate-900">Active Discounts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[920px]">
            <thead>
              <tr>
                <th>Discount Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Assigned</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold text-slate-900">{item.name}</td>
                  <td className="text-slate-500">{item.code || "—"}</td>
                  <td>
                    <span className={categoryPill(item.category)}>
                      {item.category || "CUSTOM"}
                    </span>
                  </td>
                  <td className="font-semibold text-slate-900">
                    {item.type === "PERCENTAGE"
                      ? `${Number(item.value)}%`
                      : formatMoney(item.value)}
                  </td>
                  <td className="font-semibold text-slate-700">
                    {item._count?.assignments ?? 0}
                  </td>
                  <td>
                    <span
                      className={`nx-pill ${item.isActive === false ? "nx-pill-neutral" : "nx-pill-success"}`}
                    >
                      {item.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="text-[12px] font-bold uppercase tracking-wide text-indigo-600 hover:underline"
                        onClick={() => openAssign(item)}
                      >
                        Assign / View
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                        onClick={() => startEdit(item)}
                      >
                        <EditOutlined sx={{ fontSize: 18 }} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => void remove(item)}
                      >
                        <DeleteOutline sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No discounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
          label="categories"
        />
      </div>
    </section>
  );
}
