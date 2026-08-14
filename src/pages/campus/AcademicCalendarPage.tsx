import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DownloadOutlined,
  EditOutlined,
  EventNoteOutlined,
  SettingsOutlined,
  TodayOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem } from "./academics/types";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type EventStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type EventType = "ACADEMIC" | "EXAMINATION" | "HOLIDAY" | "MEETING" | "OTHER" | "IMPORTANT";
type Tab = "calendar" | "list" | "holidays" | "exams";
type View = "browse" | "create" | "edit" | "detail";

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

interface AcademicEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  eventType: EventType;
  status: EventStatus;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  classId: string | null;
  academicClass: NamedRef | null;
  createdBy: PersonRef;
}

interface ListResult {
  items: AcademicEvent[];
  total: number;
}

interface Stats {
  total: number;
  published: number;
  drafts: number;
  archived: number;
  byType: Record<EventType, number>;
}

interface CalendarSettings {
  allowTeachersToCreateEvents: boolean;
  importantNotes: string | null;
}

const EVENT_TYPES: { id: EventType; label: string; color: string; dot: string }[] = [
  { id: "ACADEMIC", label: "Academic Event", color: "#534AB7", dot: "#534AB7" },
  { id: "EXAMINATION", label: "Examination", color: "#ea580c", dot: "#f97316" },
  { id: "HOLIDAY", label: "Holiday", color: "#15803d", dot: "#22c55e" },
  { id: "MEETING", label: "Meeting", color: "#1d4ed8", dot: "#3b82f6" },
  { id: "OTHER", label: "Other Event", color: "#64748b", dot: "#94a3b8" },
  { id: "IMPORTANT", label: "Important", color: "#be185d", dot: "#ec4899" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm = {
  title: "",
  description: "",
  location: "",
  eventType: "ACADEMIC" as EventType,
  startAt: "",
  endAt: "",
  allDay: true,
  classId: "",
};

const statusTone: Record<EventStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-amber-50 text-amber-800",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function typeMeta(type: EventType) {
  return EVENT_TYPES.find((t) => t.id === type) ?? EVENT_TYPES[0]!;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" });
}

function relativeBadge(iso: string) {
  const start = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function eventOnDay(event: AcademicEvent, day: Date) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : start;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function AcademicCalendarPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).includes("academic_calendar.manage");
  const canPublish = isAdmin;

  const [view, setView] = useState<View>("browse");
  const [tab, setTab] = useState<Tab>("calendar");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AcademicEvent[]>([]);
  const [selected, setSelected] = useState<AcademicEvent | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [filterType, setFilterType] = useState<EventType | "">("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterStatus, setFilterStatus] = useState<EventStatus | "">("");
  const [form, setForm] = useState(emptyForm);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  const teachersAllowed = settings?.allowTeachersToCreateEvents ?? false;
  const canManage = hasManagePerm && (isAdmin || (isTeacher && teachersAllowed));
  const ownsSelected = !!selected && (!!isAdmin || selected.createdBy?.id === user?.id);
  const canEditSelected =
    canManage &&
    ownsSelected &&
    !!selected &&
    (selected.status === "DRAFT" || (isAdmin && selected.status === "PUBLISHED"));
  const canDeleteSelected = canManage && ownsSelected && selected?.status === "DRAFT";

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const rangeFrom = startOfMonth(cursor).toISOString();
  const rangeTo = endOfMonth(cursor).toISOString();

  const loadSetup = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [academics, calSettings] = await Promise.all([
        apiRequest<AcademicSetup>("/academics/setup", accessToken),
        apiRequest<CalendarSettings>("/academic-calendar/settings", accessToken).catch(() => null),
      ]);
      setClasses(academics.classes ?? []);
      if (calSettings) {
        setSettings(calSettings);
        setNotesDraft(calSettings.importantNotes ?? "");
      }
    } catch {
      // optional
    }
  }, [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams({ from: rangeFrom, to: rangeTo });
      setStats(await apiRequest<Stats>(`/academic-calendar/stats?${params}`, accessToken));
    } catch {
      setStats(null);
    }
  }, [accessToken, rangeFrom, rangeTo]);

  const loadRows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "200",
        from: rangeFrom,
        to: rangeTo,
      });
      if (filterType) params.set("eventType", filterType);
      if (filterClassId) params.set("classId", filterClassId);
      if (filterStatus) params.set("status", filterStatus);
      if (tab === "holidays") params.set("eventType", "HOLIDAY");
      if (tab === "exams") params.set("eventType", "EXAMINATION");
      const data = await apiRequest<ListResult>(`/academic-calendar?${params}`, accessToken);
      setRows(data.items ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load calendar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, rangeFrom, rangeTo, filterType, filterClassId, filterStatus, tab]);

  const openRow = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<AcademicEvent>(`/academic-calendar/${id}`, accessToken);
        setSelected(data);
        setView("detail");
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to open event");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadRows();
    void loadStats();
  }, [loadRows, loadStats]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(cursor);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...rows]
      .filter((r) => new Date(r.startAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
      .filter((r) => r.status !== "ARCHIVED")
      .slice(0, 5);
  }, [rows]);

  async function toggleTeacherCreate(next: boolean) {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<CalendarSettings>("/academic-calendar/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ allowTeachersToCreateEvents: next }),
      });
      setSettings(data);
      notifySuccess(next ? "Teachers can add calendar events" : "Teacher creation disabled");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveImportantNotes() {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<CalendarSettings>("/academic-calendar/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ importantNotes: notesDraft.trim() || null }),
      });
      setSettings(data);
      setNotesDraft(data.importantNotes ?? "");
      setEditingNotes(false);
      notifySuccess("Important notes saved");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save notes");
    } finally {
      setSavingSettings(false);
    }
  }

  function startCreate() {
    const today = toDateInput(new Date().toISOString());
    setForm({ ...emptyForm, startAt: today, endAt: today });
    setSelected(null);
    setView("create");
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      title: selected.title,
      description: selected.description ?? "",
      location: selected.location ?? "",
      eventType: selected.eventType,
      startAt: toDateInput(selected.startAt),
      endAt: selected.endAt ? toDateInput(selected.endAt) : "",
      allDay: selected.allDay,
      classId: selected.classId ?? selected.academicClass?.id ?? "",
    });
    setView("edit");
  }

  function bodyFromForm() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      eventType: form.eventType,
      startAt: new Date(`${form.startAt}T00:00:00`).toISOString(),
      endAt: form.endAt ? new Date(`${form.endAt}T23:59:59`).toISOString() : null,
      allDay: form.allDay,
      classId: form.classId || null,
    };
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.title.trim() || !form.startAt) {
      notifyError("Title and start date are required");
      return;
    }
    setSaving(true);
    try {
      const body = bodyFromForm();
      if (view === "edit" && selected) {
        const updated = await apiRequest<AcademicEvent>(`/academic-calendar/${selected.id}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setSelected(updated);
        notifySuccess("Event updated");
        setView("detail");
      } else {
        const created = await apiRequest<AcademicEvent>("/academic-calendar", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelected(created);
        notifySuccess("Event created as draft");
        setView("detail");
      }
      await Promise.all([loadRows(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save event");
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<AcademicEvent>(`/academic-calendar/${selected.id}/publish`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Published — students and parents can see this event");
      await Promise.all([loadRows(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  async function archiveSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<AcademicEvent>(`/academic-calendar/${selected.id}/archive`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Event archived");
      await Promise.all([loadRows(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive failed");
    }
  }

  async function deleteSelected() {
    if (!accessToken || !selected || !canDeleteSelected) return;
    const ok = await confirmDelete({
      title: "Delete event?",
      text: `Delete draft “${selected.title}”? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/academic-calendar/${selected.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Event deleted");
      setSelected(null);
      setView("browse");
      await Promise.all([loadRows(), loadStats()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function exportCsv() {
    const header = ["Title", "Type", "Status", "Start", "End", "Class", "Location"];
    const lines = rows.map((r) =>
      [
        r.title,
        r.eventType,
        r.status,
        r.startAt,
        r.endAt ?? "",
        r.academicClass?.name ?? "",
        r.location ?? "",
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academic-calendar-${cursor.getFullYear()}-${cursor.getMonth() + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const eventForm = (
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
        <Field label="Event type">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.eventType}
            onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value as EventType }))}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date *">
          <input
            type="date"
            className="nx-input !py-2"
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            required
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            className="nx-input !py-2"
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
          />
        </Field>
        <Field label="Class (optional)">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.classId}
            onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
          >
            <option value="">All classes / school-wide</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <input
            className="nx-input !py-2"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. School Auditorium"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className="nx-input min-h-[80px] !py-2"
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

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <button
        type="button"
        className="inline-grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
      >
        <ChevronLeftOutlined sx={{ fontSize: 18 }} />
      </button>
      <p className="min-w-[140px] text-center text-[14px] font-bold text-slate-900">{monthLabel}</p>
      <button
        type="button"
        className="inline-grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
      >
        <ChevronRightOutlined sx={{ fontSize: 18 }} />
      </button>
      <select
        className="nx-input !h-[34px] !w-auto !py-0 !text-[12px] !font-semibold"
        value={filterType}
        onChange={(e) => setFilterType(e.target.value as EventType | "")}
        disabled={tab === "holidays" || tab === "exams"}
      >
        <option value="">All Event Types</option>
        {EVENT_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <select
        className="nx-input !h-[34px] !w-auto !py-0 !text-[12px] !font-semibold"
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
      <select
        className="nx-input !h-[34px] !w-auto !py-0 !text-[12px] !font-semibold"
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value as EventStatus | "")}
      >
        <option value="">All Statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="PUBLISHED">Published</option>
        <option value="ARCHIVED">Archived</option>
      </select>
      <button
        type="button"
        className="nx-btn-secondary !h-[34px] !px-3 !text-[12px]"
        onClick={() => setCursor(startOfMonth(new Date()))}
      >
        <TodayOutlined sx={{ fontSize: 16 }} /> Today
      </button>
    </div>
  );

  const monthGrid = (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-[#fafbfd]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, new Date());
          const dayEvents = rows.filter((ev) => eventOnDay(ev, day)).slice(0, 3);
          const more = rows.filter((ev) => eventOnDay(ev, day)).length - dayEvents.length;
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[96px] border-b border-r border-slate-100 p-1.5 ${
                inMonth ? "bg-white" : "bg-[#f8fafc]"
              }`}
            >
              <p
                className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  isToday
                    ? "bg-[#534AB7] text-white"
                    : inMonth
                      ? "text-slate-800"
                      : "text-slate-400"
                }`}
              >
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayEvents.map((ev) => {
                  const meta = typeMeta(ev.eventType);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => void openRow(ev.id)}
                      className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[9.5px] font-semibold leading-tight text-white shadow-sm hover:opacity-90"
                      style={{ background: meta.color }}
                      title={`${ev.title} (${ev.status})`}
                    >
                      {ev.title}
                    </button>
                  );
                })}
                {more > 0 ? (
                  <p className="px-1 text-[10px] font-semibold text-slate-400">+{more} more</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const listPanel = (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No events in this month.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((ev) => {
            const meta = typeMeta(ev.eventType);
            return (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => void openRow(ev.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#fafbfe]"
                >
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: meta.dot }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-slate-900">{ev.title}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[ev.status]}`}>
                        {ev.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-slate-500">
                      {formatDayLabel(ev.startAt)}
                      {ev.academicClass ? ` · ${ev.academicClass.name}` : ""}
                      {ev.location ? ` · ${ev.location}` : ""}
                      {` · ${meta.label}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const browseMain = (
    <div className="min-w-0 space-y-4">
      {toolbar}
      {tab === "calendar" ? monthGrid : listPanel}
      <div className="relative overflow-hidden rounded-xl border border-[#ddd6fe] bg-gradient-to-r from-[#f5f3ff] to-[#eff6ff] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#534AB7] shadow-sm">
            <EventNoteOutlined sx={{ fontSize: 20 }} />
          </span>
          <div className="min-w-0 flex-1 max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-bold text-slate-900">Important Notes</h3>
              {isAdmin && !editingNotes ? (
                <button
                  type="button"
                  className="text-[11px] font-bold text-[#534AB7] hover:underline"
                  onClick={() => {
                    setNotesDraft(settings?.importantNotes ?? "");
                    setEditingNotes(true);
                  }}
                >
                  Edit
                </button>
              ) : null}
            </div>
            {editingNotes && isAdmin ? (
              <div className="mt-2 space-y-2">
                <textarea
                  className="nx-input min-h-[88px] !py-2 text-[12px]"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="One note per line"
                  maxLength={5000}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="nx-btn-primary !px-3 !text-[11px]"
                    disabled={savingSettings}
                    onClick={() => void saveImportantNotes()}
                  >
                    {savingSettings ? "Saving…" : "Save notes"}
                  </button>
                  <button
                    type="button"
                    className="nx-btn-secondary !px-3 !text-[11px]"
                    onClick={() => {
                      setNotesDraft(settings?.importantNotes ?? "");
                      setEditingNotes(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1 space-y-1 text-[12px] leading-relaxed text-slate-600">
                {(settings?.importantNotes ||
                  "Events and dates are subject to change. Please check regularly for updates.\nFor any queries regarding the academic calendar, contact the school administration.")
                  .split("\n")
                  .filter(Boolean)
                  .map((line) => (
                    <p key={line}>• {line}</p>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const rightRail = (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
      <CmsSectionCard className="!p-4 hover:!transform-none">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-slate-900">Event Summary</h3>
          <span className="text-[10.5px] font-semibold text-slate-400">{monthLabel}</span>
        </div>
        <ul className="space-y-2">
          {(
            [
              ["ACADEMIC", "Academic Events"],
              ["EXAMINATION", "Examinations"],
              ["HOLIDAY", "Holidays"],
              ["MEETING", "Meetings"],
              ["OTHER", "Others"],
              ["IMPORTANT", "Important"],
            ] as const
          ).map(([id, label]) => {
            const meta = typeMeta(id);
            const count = stats?.byType?.[id] ?? 0;
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  <span className="size-2 rounded-full" style={{ background: meta.dot }} />
                  {label}
                </span>
                <span className="font-bold text-slate-900">{count}</span>
              </li>
            );
          })}
        </ul>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Upcoming Events</h3>
        {upcoming.length === 0 ? (
          <p className="text-[11.5px] text-slate-500">No upcoming events this month.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void openRow(ev.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {formatDayLabel(ev.startAt)} ({formatWeekday(ev.startAt)})
                      </p>
                      <p className="mt-0.5 text-[12.5px] font-bold text-slate-900">{ev.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {ev.location || ev.academicClass?.name || typeMeta(ev.eventType).label}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-bold text-[#534AB7]">
                      {relativeBadge(ev.startAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Legend</h3>
        <ul className="space-y-2">
          {EVENT_TYPES.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
              <span className="size-2.5 rounded-full" style={{ background: t.dot }} />
              {t.label}
            </li>
          ))}
        </ul>
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
                Allow teachers to create events
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
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[selected.status]}`}>
                {selected.status}
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: typeMeta(selected.eventType).color }}
              >
                {typeMeta(selected.eventType).label}
              </span>
            </div>
            <h2 className="mt-2 text-[18px] font-bold text-slate-900">{selected.title}</h2>
            <p className="mt-1 text-[12.5px] text-slate-600">
              {formatDayLabel(selected.startAt)}
              {selected.endAt ? ` – ${formatDayLabel(selected.endAt)}` : ""}
              {selected.academicClass ? ` · ${selected.academicClass.name}` : " · School-wide"}
              {selected.location ? ` · ${selected.location}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditSelected ? (
              <>
                <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={startEdit}>
                  <EditOutlined sx={{ fontSize: 16 }} /> Edit
                </button>
                {canDeleteSelected ? (
                  <button
                    type="button"
                    className="nx-btn-secondary !px-3 !text-[12px]"
                    onClick={() => void deleteSelected()}
                  >
                    Delete
                  </button>
                ) : null}
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
      <div className="shrink-0">
        <CmsPageHeader
          title="Academic Calendar"
          description={
            <span>
              <span className="text-[#534AB7]">Home</span>
              <span className="text-[#676b8f]">{" / Academic Calendar"}</span>
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
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="nx-btn-secondary !text-[12px]" onClick={exportCsv}>
                  <DownloadOutlined sx={{ fontSize: 16 }} /> Export Calendar
                </button>
                {canManage ? (
                  <button type="button" className="nx-btn-primary !text-[12px]" onClick={startCreate}>
                    <AddOutlined sx={{ fontSize: 16 }} /> Add Event
                  </button>
                ) : null}
              </div>
            )
          }
        />
        {view === "browse" ? (
          <CmsTabs>
            <CmsTab
              active={tab === "calendar"}
              onClick={() => {
                setTab("calendar");
                setFilterType("");
              }}
            >
              Calendar View
            </CmsTab>
            <CmsTab
              active={tab === "list"}
              onClick={() => {
                setTab("list");
                setFilterType("");
              }}
            >
              List View
            </CmsTab>
            <CmsTab
              active={tab === "holidays"}
              onClick={() => {
                setTab("holidays");
                setFilterType("HOLIDAY");
              }}
            >
              School Holidays
            </CmsTab>
            <CmsTab
              active={tab === "exams"}
              onClick={() => {
                setTab("exams");
                setFilterType("EXAMINATION");
              }}
            >
              Exam Schedule
            </CmsTab>
          </CmsTabs>
        ) : null}
      </div>

      <CmsScrollBody>
        {view === "browse" ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            {browseMain}
            {rightRail}
          </div>
        ) : null}
        {view === "create" || view === "edit" ? (
          <CmsSectionCard className="!p-4 hover:!transform-none">
            <h2 className="mb-3 text-[15px] font-bold text-slate-900">
              {view === "edit" ? "Edit event" : "New event"}
            </h2>
            {eventForm}
          </CmsSectionCard>
        ) : null}
        {view === "detail" ? detailMain : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
