import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  CancelOutlined,
  DeleteOutline,
  EditOutlined,
  FilterAltOutlined,
  SettingsOutlined,
  VideocamOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, ClassSection, SubjectItem } from "./academics/types";
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

type SessionStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
type SchedulePhase = "UPCOMING" | "LIVE" | "ENDED" | null;
type View = "browse" | "create" | "detail" | "edit";

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface LiveClassRow {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  meetingUrl: string | null;
  provider: string | null;
  subjectId: string | null;
  classId: string | null;
  classSectionId: string | null;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  schedulePhase: SchedulePhase;
  hostTeacherId: string;
  createdAt: string;
  subject: NamedRef | null;
  academicClass: NamedRef | null;
  classSection: {
    id: string;
    section: NamedRef;
    academicClass: NamedRef;
  } | null;
  hostTeacher: PersonRef;
  createdBy: PersonRef;
}

interface ListResult {
  items: LiveClassRow[];
  total: number;
}

interface Stats {
  total: number;
  drafts: number;
  published: number;
  cancelled: number;
  mine: number;
  liveNow: number;
}

interface LiveClassesSettings {
  allowTeachersToCreateLiveClasses: boolean;
}

interface CampusUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: Array<{ role: { code: string } }>;
}

const emptyForm = {
  title: "",
  topic: "",
  description: "",
  meetingUrl: "",
  provider: "",
  subjectId: "",
  classId: "",
  classSectionId: "",
  startsAt: "",
  endsAt: "",
  hostTeacherId: "",
};

const statusTone: Record<SessionStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

const phaseTone: Record<Exclude<SchedulePhase, null>, string> = {
  UPCOMING: "bg-sky-50 text-sky-700",
  LIVE: "bg-red-50 text-red-700",
  ENDED: "bg-slate-100 text-slate-600",
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function personName(p: PersonRef) {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function LiveClassesPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).includes("live_classes.manage");
  const canPublish = isAdmin;

  const [view, setView] = useState<View>("browse");
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<LiveClassRow[]>([]);
  const [selected, setSelected] = useState<LiveClassRow | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    drafts: 0,
    published: 0,
    cancelled: 0,
    mine: 0,
    liveNow: 0,
  });
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [hosts, setHosts] = useState<CampusUser[]>([]);
  const [settings, setSettings] = useState<LiveClassesSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "">("");
  const [form, setForm] = useState(emptyForm);

  const teachersAllowed = settings?.allowTeachersToCreateLiveClasses ?? false;
  const canManage = hasManagePerm && (isAdmin || (isTeacher && teachersAllowed));
  const ownsSelected = !!selected && (!!isAdmin || selected.createdBy?.id === user?.id);
  const canEditSelected = canManage && ownsSelected && selected?.status === "DRAFT";

  const sectionsForClass = useMemo(() => {
    if (!form.classId) return classSections;
    return classSections.filter((row) => row.academicClass.id === form.classId);
  }, [classSections, form.classId]);

  const loadSetup = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [academics, lcSettings, users] = await Promise.all([
        apiRequest<AcademicSetup>("/academics/setup", accessToken),
        apiRequest<LiveClassesSettings>("/live-classes/settings", accessToken).catch(() => null),
        apiRequest<CampusUser[]>("/users", accessToken).catch(() => [] as CampusUser[]),
      ]);
      setSubjects(academics.subjects ?? []);
      setClasses(academics.classes ?? []);
      setClassSections(academics.classSections ?? []);
      const hostCandidates = (users ?? []).filter((u) =>
        u.roles?.some((r) => ["TEACHER", "INSTITUTION_ADMIN", "STAFF"].includes(r.role.code)),
      );
      setHosts(hostCandidates.length ? hostCandidates : users ?? []);
      if (lcSettings) setSettings(lcSettings);
    } catch {
      // optional masters
    }
  }, [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      setStats(await apiRequest<Stats>("/live-classes/stats", accessToken));
    } catch {
      setStats({ total: 0, drafts: 0, published: 0, cancelled: 0, mine: 0, liveNow: 0 });
    }
  }, [accessToken]);

  const loadSessions = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (filterSubjectId) params.set("subjectId", filterSubjectId);
      if (filterClassId) params.set("classId", filterClassId);
      const data = await apiRequest<ListResult>(`/live-classes?${params}`, accessToken);
      setSessions(data.items ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load live classes");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, statusFilter, filterSubjectId, filterClassId]);

  const openSession = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<LiveClassRow>(`/live-classes/${id}`, accessToken);
        setSelected(data);
        setView("detail");
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to open session");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadSessions();
    void loadStats();
  }, [loadSessions, loadStats]);

  async function toggleTeacherCreate(next: boolean) {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<LiveClassesSettings>("/live-classes/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ allowTeachersToCreateLiveClasses: next }),
      });
      setSettings(data);
      notifySuccess(next ? "Teachers can create live classes" : "Teacher creation disabled");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function startCreate() {
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setForm({
      ...emptyForm,
      hostTeacherId: user?.id ?? "",
      startsAt: toLocalInput(now.toISOString()),
      endsAt: toLocalInput(end.toISOString()),
    });
    setSelected(null);
    setView("create");
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      title: selected.title,
      topic: selected.topic ?? "",
      description: selected.description ?? "",
      meetingUrl: selected.meetingUrl ?? "",
      provider: selected.provider ?? "",
      subjectId: selected.subjectId ?? selected.subject?.id ?? "",
      classId: selected.classId ?? selected.academicClass?.id ?? "",
      classSectionId: selected.classSectionId ?? selected.classSection?.id ?? "",
      startsAt: toLocalInput(selected.startsAt),
      endsAt: toLocalInput(selected.endsAt),
      hostTeacherId: selected.hostTeacherId ?? selected.hostTeacher?.id ?? "",
    });
    setView("edit");
  }

  function bodyFromForm() {
    return {
      title: form.title.trim(),
      topic: form.topic.trim() || null,
      description: form.description.trim() || null,
      meetingUrl: form.meetingUrl.trim() || null,
      provider: form.provider || null,
      subjectId: form.subjectId || null,
      classId: form.classId || null,
      classSectionId: form.classSectionId || null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      hostTeacherId: form.hostTeacherId || null,
    };
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.title.trim()) {
      notifyError("Title is required");
      return;
    }
    if (!form.startsAt || !form.endsAt) {
      notifyError("Start and end time are required");
      return;
    }
    setSaving(true);
    try {
      const body = bodyFromForm();
      if (view === "edit" && selected) {
        const updated = await apiRequest<LiveClassRow>(`/live-classes/${selected.id}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setSelected(updated);
        notifySuccess("Live class updated");
        setView("detail");
      } else {
        const created = await apiRequest<LiveClassRow>("/live-classes", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelected(created);
        notifySuccess("Live class created as draft");
        setView("detail");
      }
      await Promise.all([loadSessions(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save live class");
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<LiveClassRow>(`/live-classes/${selected.id}/publish`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Live class published — students can see the join link");
      await Promise.all([loadSessions(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  async function cancelSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<LiveClassRow>(`/live-classes/${selected.id}/cancel`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Live class cancelled");
      await Promise.all([loadSessions(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Cancel failed");
    }
  }

  async function deleteSelected() {
    if (!accessToken || !selected || !canEditSelected) return;
    const ok = await confirmDelete({
      title: "Delete live class?",
      text: `Delete draft “${selected.title}”? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/live-classes/${selected.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Live class deleted");
      setSelected(null);
      setView("browse");
      await Promise.all([loadSessions(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  const sessionForm = (
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
        <Field label="Class (required to publish)">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.classId}
            onChange={(e) =>
              setForm((f) => ({ ...f, classId: e.target.value, classSectionId: "" }))
            }
          >
            <option value="">Select class</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section (optional)">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.classSectionId}
            onChange={(e) => setForm((f) => ({ ...f, classSectionId: e.target.value }))}
            disabled={!form.classId}
          >
            <option value="">All sections</option>
            {sectionsForClass.map((row) => (
              <option key={row.id} value={row.id}>
                {row.academicClass.name} — {row.section.name}
              </option>
            ))}
          </select>
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
        <Field label="Host teacher">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.hostTeacherId}
            onChange={(e) => setForm((f) => ({ ...f, hostTeacherId: e.target.value }))}
          >
            <option value="">Me (creator)</option>
            {hosts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.firstName} {row.lastName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts at *">
          <input
            type="datetime-local"
            className="nx-input !py-2"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            required
          />
        </Field>
        <Field label="Ends at *">
          <input
            type="datetime-local"
            className="nx-input !py-2"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            required
          />
        </Field>
        <Field label="Meeting URL (required to publish)">
          <input
            className="nx-input !py-2"
            placeholder="https://…"
            value={form.meetingUrl}
            onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
          />
        </Field>
        <Field label="Provider">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          >
            <option value="">Unspecified</option>
            <option value="zoom">Zoom</option>
            <option value="meet">Google Meet</option>
            <option value="teams">Microsoft Teams</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className="nx-input min-h-[88px] !py-2"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </Field>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total"
          value={stats.total}
          hint="All sessions"
          icon={<VideocamOutlined sx={{ fontSize: 20 }} />}
          bg="#fee2e2"
          fg="#ef4444"
        />
        <StatCard
          label="Live now"
          value={stats.liveNow}
          hint="Published & in window"
          icon={<VideocamOutlined sx={{ fontSize: 20 }} />}
          bg="#ffe4e6"
          fg="#e11d48"
        />
        <StatCard
          label="Published"
          value={stats.published}
          hint="Visible to students"
          icon={<VideocamOutlined sx={{ fontSize: 20 }} />}
          bg="#eaf8ef"
          fg="#11a34a"
        />
        <StatCard
          label="Drafts"
          value={stats.drafts}
          hint="Not published"
          icon={<EditOutlined sx={{ fontSize: 20 }} />}
          bg="#fff2e7"
          fg="#ff7a00"
        />
        <StatCard
          label="Mine"
          value={stats.mine}
          hint="Created by you"
          icon={<VideocamOutlined sx={{ fontSize: 20 }} />}
          bg="#e9f1ff"
          fg="#1769ff"
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
              onChange={(e) => setStatusFilter(e.target.value as SessionStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CANCELLED">Cancelled</option>
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
                if (e.key === "Enter") setSearch(draftSearch);
              }}
            />
          </label>
          <button
            type="button"
            className="nx-btn-secondary h-[38px] shrink-0 !px-3 !text-[12px]"
            onClick={() => setSearch(draftSearch)}
          >
            <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">Sessions</h2>
          <span className="text-[12px] text-slate-500">{sessions.length} shown</span>
        </div>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="No live classes yet"
            hint={
              canManage
                ? "Create a draft, add a meeting URL and class, then ask an admin to publish."
                : "Sessions will appear here once scheduled."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void openSession(row.id)}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm transition hover:border-[#fecaca]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-grid size-11 place-items-center rounded-xl bg-[#fee2e2] text-[#ef4444]">
                    <VideocamOutlined sx={{ fontSize: 22 }} />
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[row.status]}`}>
                      {row.status}
                    </span>
                    {row.schedulePhase ? (
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${phaseTone[row.schedulePhase]}`}>
                        {row.schedulePhase}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 truncate text-[14px] font-bold text-slate-900">{row.title}</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-500">
                  {row.topic || "No topic"}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-slate-600">
                  {formatWhen(row.startsAt)}
                  {row.academicClass ? ` · ${row.academicClass.name}` : ""}
                  {row.hostTeacher ? ` · ${personName(row.hostTeacher)}` : ""}
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
            <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#fee2e2] text-[#ef4444]">
              <AddOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-slate-800">Schedule live class</span>
              <span className="text-[10.5px] text-slate-500">Draft a one-off session</span>
            </span>
          </button>
        ) : (
          <p className="text-[11.5px] text-slate-500">
            {isTeacher && !teachersAllowed
              ? "Teacher creation is disabled. Ask an administrator to enable it."
              : "You can browse scheduled sessions available to your role."}
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
                Allow teachers to create live classes
              </span>
              <span className="text-[10.5px] text-slate-500">
                Teachers still need an admin to publish or cancel.
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
              {selected.schedulePhase ? (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${phaseTone[selected.schedulePhase]}`}
                >
                  {selected.schedulePhase}
                </span>
              ) : null}
            </div>
            <h2 className="text-[18px] font-bold text-slate-900">{selected.title}</h2>
            <p className="mt-1 text-[12.5px] text-slate-600">{selected.topic || "No topic"}</p>
            <p className="mt-2 text-[11.5px] text-slate-500">
              {formatWhen(selected.startsAt)} → {formatWhen(selected.endsAt)}
              {selected.academicClass ? ` · ${selected.academicClass.name}` : ""}
              {selected.classSection ? ` · Sec ${selected.classSection.section.name}` : ""}
              {selected.subject ? ` · ${selected.subject.name}` : ""}
            </p>
            <p className="mt-1 text-[11.5px] text-slate-500">
              Host: {personName(selected.hostTeacher)} · Created by {personName(selected.createdBy)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditSelected ? (
              <>
                <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={startEdit}>
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
              <button
                type="button"
                className="nx-btn-primary !px-3 !text-[12px]"
                onClick={() => void publishSelected()}
              >
                Publish
              </button>
            ) : null}
            {canPublish && selected.status !== "CANCELLED" ? (
              <button
                type="button"
                className="nx-btn-secondary !px-3 !text-[12px]"
                onClick={() => void cancelSelected()}
              >
                <CancelOutlined sx={{ fontSize: 16 }} /> Cancel
              </button>
            ) : null}
            {selected.meetingUrl && selected.status === "PUBLISHED" ? (
              <a
                href={selected.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="nx-btn-primary !px-3 !text-[12px]"
              >
                Open join link
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">Meeting</h3>
        <p className="text-[12.5px] text-slate-700">
          {selected.provider ? selected.provider.toUpperCase() : "Provider unspecified"}
        </p>
        <p className="mt-1 break-all text-[12px] text-slate-600">
          {selected.meetingUrl || "No meeting URL yet"}
        </p>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">Description</h3>
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
          {selected.description?.trim() || "—"}
        </p>
      </CmsSectionCard>
    </div>
  ) : null;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Live Classes"
        description="Schedule one-off sessions with a join link. Students see published classes for their section."
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
              <AddOutlined sx={{ fontSize: 16 }} /> Schedule
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
              {view === "edit" ? "Edit live class" : "Schedule live class"}
            </h2>
            {sessionForm}
          </CmsSectionCard>
        ) : null}
        {view === "detail" ? detailMain : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
