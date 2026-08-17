import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  ArrowForwardIosOutlined,
  AssignmentOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DeleteOutline,
  DescriptionOutlined,
  EditOutlined,
  FileUploadOutlined,
  FilterAltOutlined,
  MoreVert,
  PeopleAltOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingsOutlined,
  ShareOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, SubjectItem } from "./academics/types";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { ListPagination } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type PlanStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type View = "browse" | "create" | "detail" | "edit";
type BrowseTab = "my" | "all" | "templates" | "shared";
type DisplayStatus = "Completed" | "In Progress" | "Upcoming" | "Draft" | "Overdue" | "Archived";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PAGE_SIZE = 8;

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

const SUBJECT_PILLS = [
  { bg: "#EEF2FF", text: "#4338CA" },
  { bg: "#ECFDF5", text: "#047857" },
  { bg: "#FFF7ED", text: "#C2410C" },
  { bg: "#FDF2F8", text: "#BE185D" },
  { bg: "#EFF6FF", text: "#1D4ED8" },
  { bg: "#F5F3FF", text: "#6D28D9" },
];

const DISPLAY_TONE: Record<DisplayStatus, { bg: string; text: string; dot: string }> = {
  Completed: { bg: "#ECFDF5", text: "#047857", dot: "#22C55E" },
  "In Progress": { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  Upcoming: { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  Draft: { bg: "#F5F3FF", text: "#6D28D9", dot: "#8B5CF6" },
  Overdue: { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444" },
  Archived: { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B" },
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function displayStatus(row: LessonPlanRow): DisplayStatus {
  if (row.status === "ARCHIVED") return "Archived";
  const today = startOfDay(new Date());
  const planned = row.plannedDate ? startOfDay(new Date(row.plannedDate)) : null;
  if (row.status === "PUBLISHED") {
    if (planned && planned > today) return "Upcoming";
    return "Completed";
  }
  if (planned && planned < today) return "Overdue";
  if (planned && planned > today) return "Upcoming";
  if (planned && planned.getTime() === today.getTime()) return "In Progress";
  return "Draft";
}

function subjectPill(name: string | null | undefined) {
  if (!name) return { bg: "#F1F5F9", text: "#64748B" };
  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % SUBJECT_PILLS.length;
  return SUBJECT_PILLS[hash]!;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
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
  hint?: string;
  icon: ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <div className="h-full rounded-2xl border border-[#E8EAF2] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <span
          className="inline-grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-500">{label}</p>
          <p className="mt-0.5 text-[22px] font-black leading-none tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 truncate text-[10.5px] text-slate-400">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(value: string | null) {
  if (!value) return { month: "—", day: "—" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return {
    month: d.toLocaleDateString("en-GB", { month: "short" }),
    day: String(d.getDate()),
  };
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="nx-label">{label}</span>
      {children}
    </label>
  );
}

function percent(part: number, total: number) {
  if (!total) return "0% of total";
  const n = (part / total) * 100;
  const label = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${label}% of total`;
}

export function LessonPlanningPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).includes("lesson_planning.manage");
  const canPublish = isAdmin;

  const [view, setView] = useState<View>("browse");
  const [tab, setTab] = useState<BrowseTab>("my");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [calendarPlans, setCalendarPlans] = useState<LessonPlanRow[]>([]);
  const [selected, setSelected] = useState<LessonPlanRow | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, mine: 0 });
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [settings, setSettings] = useState<LessonPlanningSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

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
  const placeholderTab = tab === "templates" || tab === "shared";
  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

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
    if (placeholderTab) {
      setPlans([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (filterSubjectId) params.set("subjectId", filterSubjectId);
      if (filterClassId) params.set("classId", filterClassId);
      if (tab === "my" && user?.id) params.set("createdById", user.id);
      const data = await apiRequest<ListResult>(`/lesson-planning?${params}`, accessToken);
      setPlans(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load lesson plans");
      setPlans([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    search,
    statusFilter,
    filterSubjectId,
    filterClassId,
    tab,
    page,
    user?.id,
    placeholderTab,
  ]);

  const loadCalendar = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (tab === "my" && user?.id) params.set("createdById", user.id);
      const data = await apiRequest<ListResult>(`/lesson-planning?${params}`, accessToken);
      setCalendarPlans(data.items ?? []);
    } catch {
      setCalendarPlans([]);
    }
  }, [accessToken, tab, user?.id]);

  const openPlan = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      setMenuId(null);
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
    void loadCalendar();
  }, [loadPlans, loadStats, loadCalendar]);

  const upcomingCount = useMemo(() => {
    const today = startOfDay(new Date());
    return calendarPlans.filter((row) => {
      if (!row.plannedDate || row.status === "ARCHIVED") return false;
      return startOfDay(new Date(row.plannedDate)) >= today;
    }).length;
  }, [calendarPlans]);

  const upcomingList = useMemo(() => {
    const today = startOfDay(new Date());
    return [...calendarPlans]
      .filter((row) => row.plannedDate && row.status !== "ARCHIVED" && startOfDay(new Date(row.plannedDate)) >= today)
      .sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate)))
      .slice(0, 3);
  }, [calendarPlans]);

  const calendarDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const marksByDay = useMemo(() => {
    const map = new Map<string, DisplayStatus>();
    for (const row of calendarPlans) {
      if (!row.plannedDate) continue;
      const d = new Date(row.plannedDate);
      if (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear()) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, displayStatus(row));
    }
    return map;
  }, [calendarPlans, cursor]);

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
    setMenuId(null);
    setView("create");
  }

  function startEdit(row?: LessonPlanRow) {
    const plan = row ?? selected;
    if (!plan) return;
    setForm({
      title: plan.title,
      topic: plan.topic ?? "",
      objectives: plan.objectives ?? "",
      materials: plan.materials ?? "",
      activities: plan.activities ?? "",
      assessmentNotes: plan.assessmentNotes ?? "",
      homework: plan.homework ?? "",
      subjectId: plan.subjectId ?? plan.subject?.id ?? "",
      classId: plan.classId ?? plan.academicClass?.id ?? "",
      plannedDate: toDateInput(plan.plannedDate),
      durationMinutes: plan.durationMinutes != null ? String(plan.durationMinutes) : "",
    });
    setSelected(plan);
    setMenuId(null);
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
      await Promise.all([loadPlans(), loadStats(), loadCalendar()]);
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
      await Promise.all([loadPlans(), loadStats(), loadCalendar()]);
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
      await Promise.all([loadPlans(), loadStats(), loadCalendar()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive failed");
    }
  }

  async function deleteSelected(row?: LessonPlanRow) {
    const plan = row ?? selected;
    if (!accessToken || !plan) return;
    const canDelete = canManage && (!!isAdmin || plan.createdBy?.id === user?.id) && plan.status === "DRAFT";
    if (!canDelete) return;
    const ok = await confirmDelete({
      title: "Delete lesson plan?",
      text: `Delete draft “${plan.title}”? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/lesson-planning/${plan.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Lesson plan deleted");
      setSelected(null);
      setMenuId(null);
      setView("browse");
      await Promise.all([loadPlans(), loadStats(), loadCalendar()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function applyFilters() {
    setPage(1);
    setSearch(draftSearch);
  }

  function changeTab(next: BrowseTab) {
    setTab(next);
    setPage(1);
    setMenuId(null);
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
        <Field label="Topic / chapter">
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
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard
          label="Total Plans"
          value={stats.total}
          icon={<AssignmentOutlined sx={{ fontSize: 20 }} />}
          bg="#EEF2FF"
          fg="#534AB7"
        />
        <StatCard
          label="Completed"
          value={stats.published}
          hint={percent(stats.published, stats.total)}
          icon={<CheckCircleOutline sx={{ fontSize: 20 }} />}
          bg="#ECFDF5"
          fg="#047857"
        />
        <StatCard
          label="In Progress"
          value={stats.drafts}
          hint={percent(stats.drafts, stats.total)}
          icon={<ScheduleOutlined sx={{ fontSize: 20 }} />}
          bg="#FFF7ED"
          fg="#C2410C"
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          hint={percent(upcomingCount, stats.total)}
          icon={<CalendarMonthOutlined sx={{ fontSize: 20 }} />}
          bg="#FDF2F8"
          fg="#BE185D"
        />
        <StatCard
          label="My Plans"
          value={stats.mine}
          icon={<PeopleAltOutlined sx={{ fontSize: 20 }} />}
          bg="#EFF6FF"
          fg="#1D4ED8"
        />
      </div>

      <div className="rounded-2xl border border-[#E8EAF2] bg-white p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            className="nx-input !h-9 !w-auto !min-w-[140px] !py-0 !text-[12px] !font-semibold"
            value={filterClassId}
            onChange={(e) => {
              setPage(1);
              setFilterClassId(e.target.value);
            }}
          >
            <option value="">All Classes</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="nx-input !h-9 !w-auto !min-w-[140px] !py-0 !text-[12px] !font-semibold"
            value={filterSubjectId}
            onChange={(e) => {
              setPage(1);
              setFilterSubjectId(e.target.value);
            }}
          >
            <option value="">All Subjects</option>
            {subjects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            className="nx-input !h-9 !w-auto !min-w-[132px] !py-0 !text-[12px] !font-semibold"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as PlanStatus | "");
            }}
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <div className="relative min-w-[200px] flex-1">
            <SearchOutlined
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input !h-9 !py-0 !pl-8 !text-[12px]"
              placeholder="Search lesson plans..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </div>
          <button type="button" className="nx-btn-secondary !h-9 !px-3 !text-[12px]" onClick={applyFilters}>
            <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E8EAF2] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[#EEF0F4] px-4 py-3">
          <h2 className="text-[14px] font-bold text-slate-900">
            Lesson Plans {placeholderTab ? "" : `(${total})`}
          </h2>
        </div>
        {placeholderTab ? (
          <EmptyState
            title={tab === "templates" ? "Templates coming next" : "Sharing is not enabled yet"}
            hint={
              tab === "templates"
                ? "Reusable lesson templates will live here. Create a plan from My Plans for now."
                : "Plans shared with you will appear here once sharing is added."
            }
          />
        ) : loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : plans.length === 0 ? (
          <EmptyState
            title="No lesson plans yet"
            hint={
              canManage
                ? "Create a draft with topic, objectives, and activities, then ask an admin to publish."
                : "Plans will appear here once created."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Title & Topic</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Unit / Chapter</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((row) => {
                  const shown = displayStatus(row);
                  const tone = DISPLAY_TONE[shown];
                  const pill = subjectPill(row.subject?.name);
                  const canEditRow =
                    canManage && (!!isAdmin || row.createdBy?.id === user?.id) && row.status === "DRAFT";
                  return (
                    <tr key={row.id} className="border-b border-[#F1F5F9] last:border-b-0">
                      <td>
                        <button
                          type="button"
                          className="flex max-w-[280px] items-start gap-2.5 text-left"
                          onClick={() => void openPlan(row.id)}
                        >
                          <span className="mt-0.5 inline-grid size-8 shrink-0 place-items-center rounded-lg bg-[#EEF2FF] text-[#534AB7]">
                            <DescriptionOutlined sx={{ fontSize: 16 }} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold text-slate-900">{row.title}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                              {row.topic || "No topic"}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        {row.subject?.name ? (
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{ background: pill.bg, color: pill.text }}
                          >
                            {row.subject.name}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[12.5px] font-semibold text-slate-700">
                        {row.academicClass?.name ?? "—"}
                      </td>
                      <td className="max-w-[140px] truncate text-[12.5px] text-slate-600">{row.topic || "—"}</td>
                      <td className="whitespace-nowrap text-[12.5px] text-slate-600">{formatDate(row.plannedDate)}</td>
                      <td className="whitespace-nowrap text-[12.5px] text-slate-600">
                        {row.durationMinutes != null ? `${row.durationMinutes} min` : "—"}
                      </td>
                      <td>
                        <span
                          className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{ background: tone.bg, color: tone.text }}
                        >
                          {shown}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="relative inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="inline-grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
                            onClick={() => void openPlan(row.id)}
                            aria-label="View plan"
                          >
                            <VisibilityOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="inline-grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId((id) => (id === row.id ? null : row.id));
                            }}
                            aria-label="More actions"
                          >
                            <MoreVert sx={{ fontSize: 18 }} />
                          </button>
                          {menuId === row.id ? (
                            <div
                              className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-xl border border-[#E8EAF2] bg-white py-1 shadow-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => void openPlan(row.id)}
                              >
                                View
                              </button>
                              {canEditRow ? (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                  onClick={() => startEdit(row)}
                                >
                                  Edit
                                </button>
                              ) : null}
                              {canEditRow ? (
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50"
                                  onClick={() => void deleteSelected(row)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              label="lesson plans"
            />
          </div>
        )}
      </div>
    </div>
  );

  const rightRail = (
    <aside className="min-w-0 space-y-4 xl:sticky xl:top-0 xl:self-start">
      <CmsSectionCard className="!p-4 hover:!transform-none">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            className="inline-grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeftOutlined sx={{ fontSize: 18 }} />
          </button>
          <h3 className="text-[13px] font-bold text-slate-900">{monthLabel}</h3>
          <button
            type="button"
            aria-label="Next month"
            className="inline-grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-50"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRightOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {d.slice(0, 2)}
            </span>
          ))}
          {calendarDays.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday =
              day.getDate() === new Date().getDate() &&
              day.getMonth() === new Date().getMonth() &&
              day.getFullYear() === new Date().getFullYear();
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const mark = marksByDay.get(key);
            return (
              <div key={day.toISOString()} className="grid place-items-center py-0.5">
                <span
                  className="relative grid size-7 place-items-center rounded-full text-[11px] font-semibold"
                  style={{
                    color: !inMonth ? "#D1D5DB" : isToday ? "#FFFFFF" : "#374151",
                    background: isToday ? "#534AB7" : "transparent",
                  }}
                >
                  {day.getDate()}
                  {mark && inMonth ? (
                    <span
                      className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
                      style={{ background: isToday ? "#FFFFFF" : DISPLAY_TONE[mark].dot }}
                    />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-[#EEF0F4] pt-3">
          {(
            [
              ["Completed", "Completed"],
              ["In Progress", "In Progress"],
              ["Upcoming", "Scheduled"],
              ["Draft", "Draft"],
              ["Overdue", "Overdue"],
            ] as const
          ).map(([id, label]) => (
            <span key={id} className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-slate-500">
              <span className="size-1.5 rounded-full" style={{ background: DISPLAY_TONE[id].dot }} />
              {label}
            </span>
          ))}
        </div>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-3 text-[13px] font-bold text-slate-900">Upcoming Lessons</h3>
        {upcomingList.length === 0 ? (
          <p className="text-[12px] text-slate-500">No upcoming lessons scheduled.</p>
        ) : (
          <ul className="space-y-2.5">
            {upcomingList.map((row) => {
              const date = formatDateShort(row.plannedDate);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-[#F8F7FF]"
                    onClick={() => void openPlan(row.id)}
                  >
                    <span className="grid size-11 shrink-0 place-content-center rounded-xl bg-[#F5F3FF] text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#534AB7]">{date.month}</span>
                      <span className="text-[14px] font-black leading-none text-slate-900">{date.day}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-slate-900">{row.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {[row.subject?.name, row.academicClass?.name].filter(Boolean).join(" · ") || "Lesson"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                      {row.durationMinutes != null ? `${row.durationMinutes} min` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">Quick Actions</h3>
        <div className="divide-y divide-[#EEF0F4]">
          {canManage ? (
            <button
              type="button"
              onClick={startCreate}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[#F8F7FF]"
            >
              <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-[#EEF2FF] text-[#534AB7]">
                <AddOutlined sx={{ fontSize: 18 }} />
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-slate-800">Create Lesson Plan</span>
              <ArrowForwardIosOutlined sx={{ fontSize: 12, color: "#94A3B8" }} />
            </button>
          ) : (
            <p className="py-2 text-[12px] text-slate-500">
              {isTeacher && !teachersAllowed
                ? "Teacher creation is disabled. Ask an administrator to enable it."
                : "You can browse plans available to your role."}
            </p>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2.5 text-left text-slate-400"
            onClick={() => notifySuccess("Templates will be added in a later release")}
          >
            <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-slate-500">
              <DescriptionOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold">Use Template</span>
            <ArrowForwardIosOutlined sx={{ fontSize: 12, color: "#CBD5E1" }} />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2.5 text-left text-slate-400"
            onClick={() => notifySuccess("Import from resources will be added later")}
          >
            <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-slate-500">
              <FileUploadOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold">Import from Resource</span>
            <ArrowForwardIosOutlined sx={{ fontSize: 12, color: "#CBD5E1" }} />
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 py-2.5 text-left text-slate-400"
            onClick={() => notifySuccess("Sharing will be added later")}
          >
            <span className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-[#F1F5F9] text-slate-500">
              <ShareOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold">Share Lesson Plan</span>
            <ArrowForwardIosOutlined sx={{ fontSize: 12, color: "#CBD5E1" }} />
          </button>
        </div>
      </CmsSectionCard>

      {isAdmin ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <div className="mb-2.5 flex items-center gap-2">
            <SettingsOutlined sx={{ fontSize: 16, color: "#64748b" }} />
            <h3 className="text-[13px] font-bold text-slate-900">Settings</h3>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#EEF0F4] bg-[#FAFBFF] p-3">
            <input
              type="checkbox"
              className="mt-0.5 accent-[#534AB7]"
              checked={teachersAllowed}
              disabled={savingSettings || settings == null}
              onChange={(e) => void toggleTeacherCreate(e.target.checked)}
            />
            <span>
              <span className="block text-[12px] font-semibold text-slate-800">Allow teachers to create lesson plans</span>
              <span className="text-[11px] leading-snug text-slate-500">
                Teachers still need an admin to publish or archive.
              </span>
            </span>
          </label>
        </CmsSectionCard>
      ) : null}
    </aside>
  );

  const detailMain = selected ? (
    <div className="mx-auto min-w-0 max-w-3xl space-y-4">
      <div className="overflow-hidden rounded-2xl border border-[#E8EAF2] bg-white">
        <div className="h-1.5 bg-[#534AB7]" />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {(() => {
                  const shown = displayStatus(selected);
                  const tone = DISPLAY_TONE[shown];
                  return (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: tone.bg, color: tone.text }}
                    >
                      {shown}
                    </span>
                  );
                })()}
                <span className="text-[11px] text-slate-500">{formatDate(selected.plannedDate)}</span>
              </div>
              <h2 className="text-[20px] font-bold tracking-tight text-slate-900">{selected.title}</h2>
              <p className="mt-1 text-[13px] text-slate-600">{selected.topic || "No topic"}</p>
              <p className="mt-2 text-[12px] text-slate-500">
                {[
                  selected.subject?.name,
                  selected.academicClass?.name,
                  selected.durationMinutes != null ? `${selected.durationMinutes} min` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No class / subject"}
                {" · "}
                by {selected.createdBy.firstName} {selected.createdBy.lastName}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditSelected ? (
                <>
                  <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={() => startEdit()}>
                    <EditOutlined sx={{ fontSize: 16 }} /> Edit
                  </button>
                  <button
                    type="button"
                    className="nx-btn-secondary !px-3 !text-[12px]"
                    onClick={() => void deleteSelected()}
                  >
                    <DeleteOutline sx={{ fontSize: 16 }} /> Delete
                  </button>
                </>
              ) : null}
              {canPublish && selected.status === "DRAFT" ? (
                <button type="button" className="nx-btn-primary !px-3 !text-[12px]" onClick={() => void publishSelected()}>
                  Publish
                </button>
              ) : null}
              {canPublish && selected.status !== "ARCHIVED" ? (
                <button
                  type="button"
                  className="nx-btn-secondary !px-3 !text-[12px]"
                  onClick={() => void archiveSelected()}
                >
                  Archive
                </button>
              ) : null}
            </div>
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
        <CmsSectionCard key={label} className="!p-5 hover:!transform-none">
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{label}</h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{value?.trim() || "—"}</p>
        </CmsSectionCard>
      ))}
    </div>
  ) : null;

  return (
    <CmsPage>
      <div className="shrink-0">
        <CmsPageHeader
          title="Lesson Planning"
          description={
            <span>
              <span className="text-[#534AB7]">Home</span>
              <span className="text-[#676b8f]">{" / Lesson Planning"}</span>
            </span>
          }
          actions={
            view !== "browse" ? (
              <button
                type="button"
                className="nx-btn-secondary !text-[12px]"
                onClick={() => {
                  setView("browse");
                  setSelected(null);
                }}
              >
                <ArrowBackOutlined sx={{ fontSize: 16 }} /> Back
              </button>
            ) : canManage ? (
              <button type="button" className="nx-btn-primary !text-[12px]" onClick={startCreate}>
                <AddOutlined sx={{ fontSize: 16 }} /> Create Lesson Plan
              </button>
            ) : null
          }
        />
        {view === "browse" ? (
          <CmsTabs>
            <CmsTab active={tab === "my"} onClick={() => changeTab("my")}>
              My Plans
            </CmsTab>
            <CmsTab active={tab === "all"} onClick={() => changeTab("all")}>
              All Plans
            </CmsTab>
            <CmsTab active={tab === "templates"} onClick={() => changeTab("templates")}>
              Templates
            </CmsTab>
            <CmsTab active={tab === "shared"} onClick={() => changeTab("shared")}>
              Shared with Me
            </CmsTab>
          </CmsTabs>
        ) : null}
      </div>
      <CmsScrollBody>
        {view === "browse" ? (
          <div
            className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]"
            onClick={() => setMenuId(null)}
          >
            {browseMain}
            {rightRail}
          </div>
        ) : null}
        {view === "create" || view === "edit" ? (
          <CmsSectionCard className="mx-auto !max-w-3xl !p-5 hover:!transform-none">
            <h2 className="mb-4 text-[16px] font-bold tracking-tight text-slate-900">
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
