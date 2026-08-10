import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  DragIndicator,
  EditOutlined,
  InfoOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, ClassItem, ClassSection, Person } from "../academics/types";

type OutletCtx = { activeLabel?: string };

const CLASS_PAGE_SIZE = 10;

function Card({
  title,
  children,
  hint,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
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

function teacherName(person: Person | null | undefined) {
  if (!person) return "—";
  return `${person.firstName} ${person.lastName}`.trim();
}

function ActiveBadge() {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      Active
    </span>
  );
}

export function ClassSectionSetupPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Class & Section Setup";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["academics.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<AcademicSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [classPage, setClassPage] = useState(1);

  const [className, setClassName] = useState("");
  const [classOrder, setClassOrder] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const [sectionName, setSectionName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [capacity, setCapacity] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const [dragClassId, setDragClassId] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<AcademicSetup>("/academics/setup", accessToken);
      setSetup(data);
      setSelectedClassId((prev) => prev || data.classes[0]?.id || "");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load class setup");
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
  const teachers = setup?.teachers ?? [];
  const selectedClass = classes.find((item) => item.id === selectedClassId) ?? null;

  const sectionsForClass = useMemo(() => {
    if (!setup || !selectedClassId) return [] as ClassSection[];
    return setup.classSections
      .filter((item) => item.academicClass.id === selectedClassId)
      .sort((a, b) => a.section.name.localeCompare(b.section.name));
  }, [setup, selectedClassId]);

  const sectionCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of setup?.classSections ?? []) {
      map.set(item.academicClass.id, (map.get(item.academicClass.id) ?? 0) + 1);
    }
    return map;
  }, [setup]);

  const totalClassPages = Math.max(1, Math.ceil(classes.length / CLASS_PAGE_SIZE));
  const currentClassPage = Math.min(classPage, totalClassPages);
  const pagedClasses = classes.slice(
    (currentClassPage - 1) * CLASS_PAGE_SIZE,
    currentClassPage * CLASS_PAGE_SIZE,
  );

  function resetClassForm() {
    setClassName("");
    setClassOrder("");
    setEditingClassId(null);
  }

  function resetSectionForm() {
    setSectionName("");
    setTeacherId("");
    setRoomNo("");
    setCapacity("");
    setEditingSectionId(null);
  }

  function startEditClass(item: ClassItem) {
    setEditingClassId(item.id);
    setClassName(item.name);
    setClassOrder(String(item.sortOrder ?? ""));
    setSelectedClassId(item.id);
  }

  function startEditSection(item: ClassSection) {
    setEditingSectionId(item.id);
    setSectionName(item.section.name);
    setTeacherId(item.classTeacher?.id ?? "");
    setRoomNo(item.roomNo ?? "");
    setCapacity(item.capacity != null ? String(item.capacity) : "");
  }

  async function saveClass(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = className.trim();
    if (!name) {
      notifyError("Class name is required.");
      return;
    }
    setSaving(true);
    try {
      const sortOrder = classOrder.trim() ? Number(classOrder) : classes.length + 1;
      if (editingClassId) {
        await apiRequest(`/academics/classes/${editingClassId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify({ name, sortOrder }),
        });
        notifySuccess("Class updated");
      } else {
        await apiRequest("/academics/classes", accessToken, {
          method: "POST",
          body: JSON.stringify({ name, sortOrder }),
        });
        notifySuccess("Class added");
      }
      resetClassForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save class");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(item: ClassItem) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({
      title: "Delete class?",
      text: `"${item.name}" will be removed if it has no linked class sections.`,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/academics/classes/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Class deleted");
      if (selectedClassId === item.id) setSelectedClassId("");
      if (editingClassId === item.id) resetClassForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete class");
    } finally {
      setSaving(false);
    }
  }

  async function saveSection(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage || !setup?.currentSession || !selectedClassId) {
      if (!setup?.currentSession) notifyError("Create an active academic session first.");
      else if (!selectedClassId) notifyError("Select a class first.");
      return;
    }
    const name = sectionName.trim();
    if (!name) {
      notifyError("Section name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        classTeacherId: teacherId || null,
        roomNo: roomNo.trim() || null,
        capacity: capacity.trim() ? Number(capacity) : null,
      };
      if (editingSectionId) {
        await apiRequest(`/academics/class-sections/${editingSectionId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Section updated");
      } else {
        await apiRequest("/academics/class-sections", accessToken, {
          method: "POST",
          body: JSON.stringify({
            academicSessionId: setup.currentSession.id,
            classId: selectedClassId,
            sectionName: name,
            ...payload,
          }),
        });
        notifySuccess("Section added");
      }
      resetSectionForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save section");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(item: ClassSection) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({
      title: "Delete section?",
      text: `"${item.academicClass.name} - ${item.section.name}" will be removed if unused.`,
    });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/academics/class-sections/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Section deleted");
      if (editingSectionId === item.id) resetSectionForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete section");
    } finally {
      setSaving(false);
    }
  }

  async function onDropClass(targetId: string) {
    if (!accessToken || !canManage || !dragClassId || dragClassId === targetId || !setup) return;
    const ordered = [...classes];
    const from = ordered.findIndex((item) => item.id === dragClassId);
    const to = ordered.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setSetup({ ...setup, classes: ordered });
    setDragClassId(null);
    setSaving(true);
    try {
      await apiRequest("/academics/classes/reorder", accessToken, {
        method: "PUT",
        body: JSON.stringify({ orderedIds: ordered.map((item) => item.id) }),
      });
      notifySuccess("Class order updated");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to reorder classes");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (editingClassId || className.trim()) {
      await saveClass();
      return;
    }
    if (editingSectionId || sectionName.trim()) {
      await saveSection();
      return;
    }
    notifySuccess("Configuration is up to date");
  }

  const classRangeStart = classes.length ? (currentClassPage - 1) * CLASS_PAGE_SIZE + 1 : 0;
  const classRangeEnd = Math.min(currentClassPage * CLASS_PAGE_SIZE, classes.length);

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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Class & Section Setup</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage classes and sections for your institution.
            {loading ? " Loading…" : null}
            {!loading && !setup?.currentSession ? " No active academic session — sections need one." : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Card title="1. Classes">
              <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={(e) => void saveClass(e)}>
                <label className="block">
                  <FieldLabel required>Class Name</FieldLabel>
                  <input
                    className="nx-input w-full"
                    placeholder="e.g. LKG"
                    value={className}
                    disabled={!canManage || saving}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Numeric Order / Rank</FieldLabel>
                  <input
                    className="nx-input w-full"
                    type="number"
                    min={0}
                    placeholder="1"
                    value={classOrder}
                    disabled={!canManage || saving}
                    onChange={(e) => setClassOrder(e.target.value)}
                  />
                </label>
                <div className="flex items-end gap-2">
                  {editingClassId ? (
                    <button type="button" className="nx-btn-secondary" disabled={saving} onClick={resetClassForm}>
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                    disabled={!canManage || saving}
                  >
                    <AddOutlined sx={{ fontSize: 16 }} />
                    {editingClassId ? "Update" : "Add Class"}
                  </button>
                </div>
              </form>
            </Card>

            <Card title="Existing Classes" hint="Drag and drop to reorder classes.">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Order</th>
                      <th className="px-2 py-2.5">Class Name</th>
                      <th className="px-2 py-2.5">Sections</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedClasses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading ? "Loading…" : "No classes yet."}
                        </td>
                      </tr>
                    ) : (
                      pagedClasses.map((item, index) => {
                        const selected = item.id === selectedClassId;
                        return (
                          <tr
                            key={item.id}
                            draggable={canManage}
                            onDragStart={() => setDragClassId(item.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => void onDropClass(item.id)}
                            onClick={() => setSelectedClassId(item.id)}
                            className={[
                              "cursor-pointer border-b border-[#F3F4F6] last:border-b-0",
                              selected ? "bg-primary/[0.06]" : "hover:bg-[#F9FAFB]",
                            ].join(" ")}
                          >
                            <td className="px-2 py-3 text-[#6B7280]">
                              <span className="inline-flex items-center gap-1">
                                <DragIndicator sx={{ fontSize: 16 }} className="text-[#9CA3AF]" />
                                {(currentClassPage - 1) * CLASS_PAGE_SIZE + index + 1}
                              </span>
                            </td>
                            <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{item.name}</td>
                            <td className="px-2 py-3 text-[#6B7280]">
                              {sectionCountByClass.get(item.id) ?? 0}
                            </td>
                            <td className="px-2 py-3">
                              <ActiveBadge />
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                  disabled={!canManage || saving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditClass(item);
                                  }}
                                >
                                  <EditOutlined sx={{ fontSize: 18 }} />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                  disabled={!canManage || saving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteClass(item);
                                  }}
                                >
                                  <DeleteOutline sx={{ fontSize: 18 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                    disabled={currentClassPage <= 1}
                    onClick={() => setClassPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
                    {currentClassPage}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                    disabled={currentClassPage >= totalClassPages}
                    onClick={() => setClassPage((p) => Math.min(totalClassPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
                <p>
                  Showing {classRangeStart} to {classRangeEnd} of {classes.length} classes
                </p>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card
              title={`2. Sections${selectedClass ? ` (for ${selectedClass.name})` : ""}`}
            >
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveSection(e)}>
                <label className="block">
                  <FieldLabel required>Section Name</FieldLabel>
                  <input
                    className="nx-input w-full"
                    placeholder="e.g. A"
                    value={sectionName}
                    disabled={!canManage || saving || !selectedClassId || Boolean(editingSectionId)}
                    onChange={(e) => setSectionName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Class Teacher</FieldLabel>
                  <select
                    className="nx-input w-full"
                    value={teacherId}
                    disabled={!canManage || saving || !selectedClassId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.firstName} {teacher.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Room No.</FieldLabel>
                  <input
                    className="nx-input w-full"
                    placeholder="Optional"
                    value={roomNo}
                    disabled={!canManage || saving || !selectedClassId}
                    onChange={(e) => setRoomNo(e.target.value)}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Capacity</FieldLabel>
                  <input
                    className="nx-input w-full"
                    type="number"
                    min={1}
                    placeholder="e.g. 40"
                    value={capacity}
                    disabled={!canManage || saving || !selectedClassId}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </label>
                <div className="sm:col-span-2 flex flex-wrap justify-end gap-2">
                  {editingSectionId ? (
                    <button type="button" className="nx-btn-secondary" disabled={saving} onClick={resetSectionForm}>
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60"
                    disabled={!canManage || saving || !selectedClassId}
                  >
                    <AddOutlined sx={{ fontSize: 16 }} />
                    {editingSectionId ? "Update Section" : "Add Section"}
                  </button>
                </div>
              </form>
            </Card>

            <Card title={`Existing Sections${selectedClass ? ` (${selectedClass.name})` : ""}`}>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Section Name</th>
                      <th className="px-2 py-2.5">Class Teacher</th>
                      <th className="px-2 py-2.5">Room No.</th>
                      <th className="px-2 py-2.5">Capacity</th>
                      <th className="px-2 py-2.5">Students</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedClassId ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-[#6B7280]">
                          Select a class from the list on the left to view and manage its sections.
                        </td>
                      </tr>
                    ) : sectionsForClass.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-[#6B7280]">
                          No sections for this class yet.
                        </td>
                      </tr>
                    ) : (
                      sectionsForClass.map((item) => (
                        <tr key={item.id} className="border-b border-[#F3F4F6] last:border-b-0">
                          <td className="px-2 py-3 font-semibold text-[#1A1A1A]">
                            {item.academicClass.name} - {item.section.name}
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">{teacherName(item.classTeacher)}</td>
                          <td className="px-2 py-3 text-[#6B7280]">{item.roomNo || "—"}</td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {item.capacity != null ? item.capacity : "—"}
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">{item._count?.enrollments ?? 0}</td>
                          <td className="px-2 py-3">
                            <ActiveBadge />
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => startEditSection(item)}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => void deleteSection(item)}
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
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
                <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-sky-600" />
                <p>Select a class from the list on the left to view and manage its sections.</p>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#374151]">
          <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-primary" />
          <p>
            <span className="font-semibold text-[#1A1A1A]">Note:</span> Changes made here will be
            reflected across the system wherever class and section are used.
          </p>
        </div>
      </div>
    </div>
  );
}
