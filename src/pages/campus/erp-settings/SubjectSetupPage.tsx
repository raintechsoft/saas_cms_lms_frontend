import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  DragIndicator,
  EditOutlined,
  FilterListOutlined,
  InfoOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, SubjectDeliveryType, SubjectItem } from "../academics/types";

type OutletCtx = { activeLabel?: string };

const PAGE_SIZE = 10;

function Card({
  title,
  children,
  hint,
  actions,
  className = "",
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function TypeBadge({ type }: { type: SubjectDeliveryType }) {
  const styles: Record<SubjectDeliveryType, string> = {
    THEORY: "bg-violet-50 text-violet-700",
    PRACTICAL: "bg-emerald-50 text-emerald-700",
    BOTH: "bg-orange-50 text-orange-700",
  };
  const labels: Record<SubjectDeliveryType, string> = {
    THEORY: "Theory",
    PRACTICAL: "Practical",
    BOTH: "Both",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

function ActiveBadge({ active = true }: { active?: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      Inactive
    </span>
  );
}

function ClassMultiSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedLabels = options.filter((item) => value.includes(item.id)).map((item) => item.name);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else onChange([...value, id]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="nx-input flex w-full items-center justify-between text-left disabled:opacity-60"
      >
        <span className={selectedLabels.length ? "text-[#1A1A1A]" : "text-[#9CA3AF]"}>
          {selectedLabels.length ? selectedLabels.join(", ") : "Select classes"}
        </span>
        <span className="text-[#9CA3AF]">▾</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-sm text-[#6B7280]">No classes available.</p>
          ) : (
            options.map((item) => {
              const checked = value.includes(item.id);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#F9FAFB]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                    className="size-4 accent-primary"
                  />
                  <span>{item.name}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SubjectSetupPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Subject Setup";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["academics.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<AcademicSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | SubjectDeliveryType>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [deliveryType, setDeliveryType] = useState<SubjectDeliveryType>("THEORY");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [maxMarks, setMaxMarks] = useState("100");
  const [passMarks, setPassMarks] = useState("33");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<AcademicSetup>("/academics/setup", accessToken);
      setSetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load subject setup");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const classes = setup?.classes ?? [];
  const subjects = setup?.subjects ?? [];

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects.filter((item) => {
      if (typeFilter !== "ALL" && item.deliveryType !== typeFilter) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.code ?? "",
        ...(item.applicableClasses ?? []).map((c) => c.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [subjects, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSubjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedSubjects = filteredSubjects.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const rangeStart = filteredSubjects.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredSubjects.length);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  function resetForm() {
    setName("");
    setCode("");
    setDeliveryType("THEORY");
    setClassIds([]);
    setMaxMarks("100");
    setPassMarks("33");
    setEditingId(null);
  }

  function startEdit(item: SubjectItem) {
    setEditingId(item.id);
    setName(item.name);
    setCode(item.code ?? "");
    setDeliveryType(item.deliveryType);
    setClassIds((item.applicableClasses ?? []).map((c) => c.id));
    setMaxMarks(item.maxMarks != null ? String(item.maxMarks) : "100");
    setPassMarks(item.passMarks != null ? String(item.passMarks) : "33");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveSubject(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      notifyError("Subject name is required.");
      return;
    }
    if (!classIds.length) {
      notifyError("Select at least one applicable class.");
      return;
    }
    const max = maxMarks.trim() ? Number(maxMarks) : null;
    const pass = passMarks.trim() ? Number(passMarks) : null;
    if (max != null && (!Number.isFinite(max) || max < 1)) {
      notifyError("Max marks must be a positive number.");
      return;
    }
    if (pass != null && (!Number.isFinite(pass) || pass < 0)) {
      notifyError("Pass marks must be a valid number.");
      return;
    }
    if (max != null && pass != null && pass > max) {
      notifyError("Pass marks cannot exceed max marks.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        code: code.trim() || null,
        deliveryType,
        maxMarks: max,
        passMarks: pass,
        classIds,
        type: "CORE" as const,
      };
      if (editingId) {
        await apiRequest(`/academics/subjects/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Subject updated");
      } else {
        await apiRequest("/academics/subjects", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Subject added");
      }
      resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save subject");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(item: SubjectItem) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete subject "${item.name}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/academics/subjects/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Subject deleted");
      if (editingId === item.id) resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete subject");
    } finally {
      setSaving(false);
    }
  }

  async function onDropSubject(targetId: string) {
    if (!accessToken || !canManage || !dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ordered = [...subjects];
    const from = ordered.findIndex((item) => item.id === dragId);
    const to = ordered.findIndex((item) => item.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setSetup((prev) => (prev ? { ...prev, subjects: ordered } : prev));
    setSaving(true);
    try {
      await apiRequest("/academics/subjects/reorder", accessToken, {
        method: "PUT",
        body: JSON.stringify({ orderedIds: ordered.map((item) => item.id) }),
      });
      notifySuccess("Subject order updated");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to reorder subjects");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (editingId || name.trim()) {
      await saveSubject();
      return;
    }
    notifySuccess("Configuration is up to date");
  }

  const typeOptions: Array<{ value: SubjectDeliveryType; label: string }> = [
    { value: "THEORY", label: "Theory" },
    { value: "PRACTICAL", label: "Practical" },
    { value: "BOTH", label: "Both" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
          onClick={() => void saveConfiguration()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Subject Setup</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Add subjects and assign them to applicable classes.
            {loading ? " Loading…" : null}
            {!loading && !setup?.currentSession
              ? " No active academic session — class assignment needs one."
              : null}
          </p>
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card
            title={editingId ? "Edit Subject" : "Add New Subject"}
            hint="Create a new subject and define its basic details."
          >
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveSubject(e)}>
              <label className="block sm:col-span-1">
                <FieldLabel required>Subject Name</FieldLabel>
                <input
                  className="nx-input w-full"
                  placeholder="Enter subject name (e.g., Mathematics)"
                  value={name}
                  disabled={!canManage || saving}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block sm:col-span-1">
                <FieldLabel>Subject Code</FieldLabel>
                <input
                  className="nx-input w-full"
                  placeholder="Enter subject code (e.g., MATH)"
                  value={code}
                  disabled={!canManage || saving}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>

              <div className="sm:col-span-2">
                <FieldLabel required>Type</FieldLabel>
                <div className="flex flex-wrap gap-4 pt-1">
                  {typeOptions.map((option) => (
                    <label key={option.value} className="inline-flex items-center gap-2 text-sm text-[#374151]">
                      <input
                        type="radio"
                        name="subject-delivery-type"
                        checked={deliveryType === option.value}
                        disabled={!canManage || saving}
                        onChange={() => setDeliveryType(option.value)}
                        className="size-4 accent-primary"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="block sm:col-span-2">
                <FieldLabel required>Applicable Classes</FieldLabel>
                <ClassMultiSelect
                  options={classes}
                  value={classIds}
                  onChange={setClassIds}
                  disabled={!canManage || saving}
                />
              </label>

              <label className="block">
                <FieldLabel>Max Marks (Default)</FieldLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={1}
                  placeholder="Enter max marks (e.g., 100)"
                  value={maxMarks}
                  disabled={!canManage || saving}
                  onChange={(e) => setMaxMarks(e.target.value)}
                />
              </label>
              <label className="block">
                <FieldLabel>Pass Marks (Default)</FieldLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={0}
                  placeholder="Enter pass marks (e.g., 33)"
                  value={passMarks}
                  disabled={!canManage || saving}
                  onChange={(e) => setPassMarks(e.target.value)}
                />
              </label>

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving}
                >
                  <AddOutlined sx={{ fontSize: 18 }} />
                  {editingId ? "Update Subject" : "Add Subject"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
                    disabled={saving}
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </Card>

          <section className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <InfoOutlined sx={{ fontSize: 18 }} className="text-sky-600" />
              <h2 className="text-sm font-bold text-[#1A1A1A]">Quick Tips</h2>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-[#374151]">
              <li>• Keep subject codes unique (e.g. MATH, SCI, ENG).</li>
              <li>• Multi-select classes to assign a subject across grades.</li>
              <li>• Max/pass marks are defaults — they can be overridden per exam.</li>
              <li>• Drag rows in the list below to set display order.</li>
              <li>• Subjects in use (timetable/groups) cannot be deleted.</li>
            </ul>
          </section>
        </div>

        <Card
          title="Existing Subjects"
          hint="Manage and view all subjects in your institution."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <SearchOutlined
                  sx={{ fontSize: 16 }}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  className="nx-input w-48 pl-8 sm:w-56"
                  placeholder="Search subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <FilterListOutlined sx={{ fontSize: 16 }} />
                Filters
              </button>
            </div>
          }
        >
          {showFilters ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#6B7280]">Type:</span>
              {(["ALL", "THEORY", "PRACTICAL", "BOTH"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    typeFilter === value
                      ? "bg-primary text-white"
                      : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]",
                  ].join(" ")}
                >
                  {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  <th className="px-2 py-2.5">#</th>
                  <th className="px-2 py-2.5">Subject Name</th>
                  <th className="px-2 py-2.5">Subject Code</th>
                  <th className="px-2 py-2.5">Type</th>
                  <th className="px-2 py-2.5">Applicable Classes</th>
                  <th className="px-2 py-2.5">Max Marks</th>
                  <th className="px-2 py-2.5">Pass Marks</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-8 text-center text-[#6B7280]">
                      {loading ? "Loading…" : "No subjects found."}
                    </td>
                  </tr>
                ) : (
                  pagedSubjects.map((item, index) => (
                    <tr
                      key={item.id}
                      draggable={canManage && !search && typeFilter === "ALL"}
                      onDragStart={() => setDragId(item.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void onDropSubject(item.id)}
                      className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                    >
                      <td className="px-2 py-3 text-[#6B7280]">
                        <span className="inline-flex items-center gap-1">
                          <DragIndicator sx={{ fontSize: 16 }} className="text-[#9CA3AF]" />
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </span>
                      </td>
                      <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{item.name}</td>
                      <td className="px-2 py-3 text-[#6B7280]">{item.code || "—"}</td>
                      <td className="px-2 py-3">
                        <TypeBadge type={item.deliveryType} />
                      </td>
                      <td className="px-2 py-3 text-[#6B7280]">
                        {(item.applicableClasses ?? []).map((c) => c.name).join(", ") || "—"}
                      </td>
                      <td className="px-2 py-3 text-[#6B7280]">{item.maxMarks ?? "—"}</td>
                      <td className="px-2 py-3 text-[#6B7280]">{item.passMarks ?? "—"}</td>
                      <td className="px-2 py-3">
                        <ActiveBadge active={item.isActive !== false} />
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                            disabled={!canManage || saving}
                            onClick={() => startEdit(item)}
                          >
                            <EditOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                            disabled={!canManage || saving}
                            onClick={() => void deleteSubject(item)}
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
            <p>
              Showing {rangeStart} to {rangeEnd} of {filteredSubjects.length} subjects
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 5)
                .map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={[
                      "inline-flex size-8 items-center justify-center rounded-lg text-sm font-semibold",
                      num === currentPage
                        ? "bg-primary text-white"
                        : "hover:bg-[#F6F7F9]",
                    ].join(" ")}
                  >
                    {num}
                  </button>
                ))}
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
