import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  AssignmentOutlined,
  CheckBoxOutlined,
  DeleteOutline,
  DescriptionOutlined,
  EditOutlined,
  FilterAltOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, SubjectItem } from "./academics/types";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type PlanStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type View = "browse" | "create" | "detail" | "edit";

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface LessonPlanRow {
  id: string;
  title: string;
  topic: string | null;
  objectives: string | null;
  materials: string | null;
  activities: string | null;
  assessmentNotes: string | null;
  homework: string | null;
  subjectId: string | null;
  classId: string | null;
  plannedDate: string | null;
  durationMinutes: number | null;
  status: PlanStatus;
  createdAt: string;
  subject: NamedRef | null;
  academicClass: NamedRef | null;
  createdBy: { id: string; firstName: string; lastName: string; email?: string };
}

interface ListResult {
  items: LessonPlanRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface Stats {
  total: number;
  published: number;
  drafts: number;
  mine: number;
}

interface LessonPlanningSettings {
  allowTeachersToCreateLessonPlans: boolean;
}

const emptyForm = {
  title: "",
  topic: "",
  objectives: "",
  materials: "",
  activities: "",
  assessmentNotes: "",
  homework: "",
  subjectId: "",
  classId: "",
  plannedDate: "",
  durationMinutes: "",
};

const statusTone: Record<PlanStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-amber-50 text-amber-800",
};

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="max-w-md text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  bg,
  fg,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="inline-grid size-11 shrink-0 place-items-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-slate-600">{label}</p>
          <p className="mt-0.5 text-[20px] font-black leading-none tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 truncate text-[10.5px] text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export function LessonPlanningPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).includes("lesson_planning.manage");
  const canPublish = isAdmin;

  const [view, setView] = useState<View>("browse");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [selected, setSelected] = useState<LessonPlanRow | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, mine: 0 });
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [settings, setSettings] = useState<LessonPlanningSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanStatus | "">("");
  const [form, setForm] = useState(emptyForm);

  const teachersAllowed = settings?.allowTeachersToCreateLessonPlans ?? false;
  const canManage = hasManagePerm && (isAdmin || (isTeacher && teachersAllowed));
  const ownsSelected = !!selected && (!!isAdmin || selected.createdBy?.id === user?.id);
  const canEditSelected = canManage && ownsSelected && selected?.status === "DRAFT";

  const loadSetup = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [academics, lpSettings] = await Promise.all([
        apiRequest<AcademicSetup>("/academics/setup", accessToken),
        apiRequest<LessonPlanningSettings>("/lesson-planning/settings", accessToken).catch(() => null),
      ]);
      setSubjects(academics.subjects ?? []);
      setClasses(academics.classes ?? []);
      if (lpSettings) setSettings(lpSettings);
    } catch {
      // optional masters
    }
  }, [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiRequest<Stats>("/lesson-planning/stats", accessToken);
      setStats(data);
    } catch {
      setStats({ total: 0, published: 0, drafts: 0, mine: 0 });
    }
  }, [accessToken]);

  const loadPlans = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (filterSubjectId) params.set("subjectId", filterSubjectId);
      if (filterClassId) params.set("classId", filterClassId);
      const data = await apiRequest<ListResult>(`/lesson-planning?${params}`, accessToken);
      setPlans(data.items ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load lesson plans");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, statusFilter, filterSubjectId, filterClassId]);

  const openPlan = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<LessonPlanRow>(`/lesson-planning/${id}`, accessToken);
        setSelected(data);
        setView("detail");
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to open lesson plan");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadPlans();
    void loadStats();
  }, [loadPlans, loadStats]);

  const kpis = useMemo(
    () => ({
      total: stats.total,
      drafts: stats.drafts,
      published: stats.published,
      mine: stats.mine,
    }),
    [stats],
  );

  async function toggleTeacherCreate(next: boolean) {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<LessonPlanningSettings>("/lesson-planning/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ allowTeachersToCreateLessonPlans: next }),
      });
      setSettings(data);
      notifySuccess(next ? "Teachers can create lesson plans" : "Teacher creation disabled");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function startCreate() {
    setForm(emptyForm);
    setSelected(null);
    setView("create");
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      title: selected.title,
      topic: selected.topic ?? "",
      objectives: selected.objectives ?? "",
      materials: selected.materials ?? "",
      activities: selected.activities ?? "",
      assessmentNotes: selected.assessmentNotes ?? "",
      homework: selected.homework ?? "",
      subjectId: selected.subjectId ?? selected.subject?.id ?? "",
      classId: selected.classId ?? selected.academicClass?.id ?? "",
      plannedDate: toDateInput(selected.plannedDate),
      durationMinutes: selected.durationMinutes != null ? String(selected.durationMinutes) : "",
    });
    setView("edit");
  }

  function bodyFromForm() {
    return {
      title: form.title.trim(),
      topic: form.topic.trim() || null,
      objectives: form.objectives.trim() || null,
      materials: form.materials.trim() || null,
      activities: form.activities.trim() || null,
      assessmentNotes: form.assessmentNotes.trim() || null,
      homework: form.homework.trim() || null,
      subjectId: form.subjectId || null,
      classId: form.classId || null,
      plannedDate: form.plannedDate || null,
      durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
    };
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.title.trim()) {
      notifyError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const body = bodyFromForm();
      if (view === "edit" && selected) {
        const updated = await apiRequest<LessonPlanRow>(`/lesson-planning/${selected.id}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setSelected(updated);
        notifySuccess("Lesson plan updated");
        setView("detail");
      } else {
        const created = await apiRequest<LessonPlanRow>("/lesson-planning", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelected(created);
        notifySuccess("Lesson plan created as draft");
        setView("detail");
      }
      await Promise.all([loadPlans(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save lesson plan");
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<LessonPlanRow>(`/lesson-planning/${selected.id}/publish`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Lesson plan published");
      await Promise.all([loadPlans(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  async function archiveSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<LessonPlanRow>(`/lesson-planning/${selected.id}/archive`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Lesson plan archived");
      await Promise.all([loadPlans(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive failed");
    }
  }

  async function deleteSelected() {
    if (!accessToken || !selected || !canEditSelected) return;
    const ok = await confirmDelete({
      title: "Delete lesson plan?",
      text: `Delete draft “${selected.title}”? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/lesson-planning/${selected.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Lesson plan deleted");
      setSelected(null);
      setView("browse");
      await Promise.all([loadPlans(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function applyFilters() {
    setSearch(draftSearch);
  }

  const planForm = (
    <form onSubmit={(e) => void submitForm(e)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title *">
          <input
            className="nx-input !py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={300}
          />
        </Field>
        <Field label="Topic">
          <input
            className="nx-input !py-2"
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            maxLength={300}
          />
        </Field>
        <Field label="Subject">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.subjectId}
            onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
          >
            <option value="">No subject</option>
            {subjects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Class">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.classId}
            onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
          >
            <option value="">No class</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Planned date">
          <input
            type="date"
            className="nx-input !py-2"
            value={form.plannedDate}
            onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))}
          />
        </Field>
        <Field label="Duration (minutes)">
          <input
            type="number"
            min={1}
            max={600}
            className="nx-input !py-2"
            value={form.durationMinutes}
            onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
          />
        </Field>
      </div>
      {(
        [
          ["objectives", "Objectives"],
          ["materials", "Materials"],
          ["activities", "Activities"],
          ["assessmentNotes", "Assessment notes"],
          ["homework", "Homework"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea
            className="nx-input min-h-[88px] !py-2"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </Field>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="nx-btn-primary !px-4 !text-[12px]" disabled={saving}>
          {saving ? "Saving…" : view === "edit" ? "Save changes" : "Create draft"}
        </button>
        <button
          type="button"
          className="nx-btn-secondary !px-4 !text-[12px]"
          onClick={() => {
            if (selected) setView("detail");
            else setView("browse");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const browseMain = (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total Plans"
          value={kpis.total}
          hint="In this workspace"
          icon={<AssignmentOutlined sx={{ fontSize: 20 }} />}
          bg="#e9f1ff"
          fg="#1769ff"
        />
        <StatCard
          label="Drafts"
          value={kpis.drafts}
          hint="Not published yet"
          icon={<EditOutlined sx={{ fontSize: 20 }} />}
          bg="#fff2e7"
          fg="#ff7a00"
        />
        <StatCard
          label="Published"
          value={kpis.published}
          hint="Ready for campus use"
          icon={<CheckBoxOutlined sx={{ fontSize: 20 }} />}
          bg="#eaf8ef"
          fg="#11a34a"
        />
        <StatCard
          label="Mine"
          value={kpis.mine}
          hint="Created by you"
          icon={<DescriptionOutlined sx={{ fontSize: 20 }} />}
          bg="#efeaff"
          fg="#4b2cf7"
        />
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Class</span>
            <select
              className="nx-input !py-2 !font-semibold"
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Subject</span>
            <select
              className="nx-input !py-2 !font-semibold"
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Status</span>
            <select
              className="nx-input !py-2 !font-semibold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PlanStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="block min-w-[200px] flex-[1.4]">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Search</span>
            <input
              className="nx-input !py-2"
              placeholder="Search title or topic…"
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </label>
          <button
            type="button"
            className="nx-btn-secondary h-[38px] shrink-0 !px-3 !text-[12px]"
            onClick={applyFilters}
          >
            <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">Lesson Plans</h2>
          <span className="text-[12px] text-slate-500">{plans.length} shown</span>
        </div>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : plans.length === 0 ? (
          <EmptyState
            title="No lesson plans yet"
            hint={
              canManage
                ? "Create a draft with topic, objectives, activities, then ask an admin to publish."
                : "Plans will appear here once created."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void openPlan(row.id)}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm transition hover:border-[#bfdbfe]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-grid size-11 place-items-center rounded-xl bg-[#e9f1ff] text-[#1769ff]">
                    <AssignmentOutlined sx={{ fontSize: 22 }} />
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[row.status]}`}>
                    {row.status}
                  </span>
                </div>
                <p className="mt-3 truncate text-[14px] font-bold text-slate-900">{row.title}</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-500">
                  {row.topic || "No topic"}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-slate-600">
                  {formatDate(row.plannedDate)}
                  {row.subject ? ` · ${row.subject.name}` : ""}
                  {row.academicClass ? ` · ${row.academicClass.name}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightRail = (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[14px] font-bold text-slate-900">Quick Actions</h3>
        {canManage ? (
          <button
            type="button"
            onClick={startCreate}
            className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
          >
            <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#e9f1ff] text-[#1769ff]">
              <AddOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-slate-800">New lesson plan</span>
              <span className="text-[10.5px] text-slate-500">Start a draft for a class</span>
            </span>
          </button>
        ) : (
          <p className="text-[11.5px] text-slate-500">
            {isTeacher && !teachersAllowed
              ? "Teacher creation is disabled. Ask an administrator to enable it."
              : "You can browse published and draft plans available to your role."}
          </p>
        )}
      </CmsSectionCard>

      {isAdmin ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <div className="mb-2 flex items-center gap-2">
            <SettingsOutlined sx={{ fontSize: 16, color: "#64748b" }} />
            <h3 className="text-[14px] font-bold text-slate-900">Settings</h3>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={teachersAllowed}
              disabled={savingSettings || settings == null}
              onChange={(e) => void toggleTeacherCreate(e.target.checked)}
            />
            <span>
              <span className="block text-[12px] font-semibold text-slate-800">
                Allow teachers to create lesson plans
              </span>
              <span className="text-[10.5px] text-slate-500">
                Teachers still need an admin to publish or archive.
              </span>
            </span>
          </label>
        </CmsSectionCard>
      ) : null}
    </aside>
  );

  const detailMain = selected ? (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[selected.status]}`}>
                {selected.status}
              </span>
              <span className="text-[11px] text-slate-500">{formatDate(selected.plannedDate)}</span>
            </div>
            <h2 className="text-[18px] font-bold text-slate-900">{selected.title}</h2>
            <p className="mt-1 text-[12.5px] text-slate-600">{selected.topic || "No topic"}</p>
            <p className="mt-2 text-[11.5px] text-slate-500">
              {[selected.subject?.name, selected.academicClass?.name, selected.durationMinutes != null ? `${selected.durationMinutes} min` : null]
                .filter(Boolean)
                .join(" · ") || "No class / subject"}
              {" · "}
              by {selected.createdBy.firstName} {selected.createdBy.lastName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditSelected ? (
              <>
                <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={startEdit}>
                  <EditOutlined sx={{ fontSize: 16 }} /> Edit
                </button>
                <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={() => void deleteSelected()}>
                  <DeleteOutline sx={{ fontSize: 16 }} /> Delete
                </button>
              </>
            ) : null}
            {canPublish && selected.status !== "PUBLISHED" && selected.status !== "ARCHIVED" ? (
              <button type="button" className="nx-btn-primary !px-3 !text-[12px]" onClick={() => void publishSelected()}>
                Publish
              </button>
            ) : null}
            {canPublish && selected.status !== "ARCHIVED" ? (
              <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={() => void archiveSelected()}>
                Archive
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {(
        [
          ["Objectives", selected.objectives],
          ["Materials", selected.materials],
          ["Activities", selected.activities],
          ["Assessment notes", selected.assessmentNotes],
          ["Homework", selected.homework],
        ] as const
      ).map(([label, value]) => (
        <CmsSectionCard key={label} className="!p-4 hover:!transform-none">
          <h3 className="mb-2 text-[13px] font-bold text-slate-900">{label}</h3>
          <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
            {value?.trim() || "—"}
          </p>
        </CmsSectionCard>
      ))}
    </div>
  ) : null;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Lesson Planning"
        description="Draft teaching plans by subject and class. Admins publish when ready."
        actions={
          view !== "browse" ? (
            <button
              type="button"
              className="nx-btn-secondary !px-3 !text-[12px]"
              onClick={() => {
                setView("browse");
                setSelected(null);
              }}
            >
              <ArrowBackOutlined sx={{ fontSize: 16 }} /> Back
            </button>
          ) : canManage ? (
            <button type="button" className="nx-btn-primary !px-3 !text-[12px]" onClick={startCreate}>
              <AddOutlined sx={{ fontSize: 16 }} /> New plan
            </button>
          ) : null
        }
      />
      <CmsScrollBody>
        {view === "browse" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            {browseMain}
            {rightRail}
          </div>
        ) : null}
        {view === "create" || view === "edit" ? (
          <CmsSectionCard className="!p-4 hover:!transform-none">
            <h2 className="mb-3 text-[15px] font-bold text-slate-900">
              {view === "edit" ? "Edit lesson plan" : "New lesson plan"}
            </h2>
            {planForm}
          </CmsSectionCard>
        ) : null}
        {view === "detail" ? detailMain : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
