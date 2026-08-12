import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DownloadOutlined,
  PrintOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsScrollBody } from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

interface Named {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClassSection {
  id: string;
  academicSessionId: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named; teacher: Teacher | null }>;
}

interface Entry {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
  teacher: Teacher | null;
}

interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  classSections: ClassSection[];
  teachers: Teacher[];
  entries: Entry[];
}

const GRID_DAYS: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const DAY_SHORT: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const SUBJECT_STYLES: Record<string, { bg: string; text: string }> = {
  Mathematics: { bg: "#EDE9FE", text: "#5B21B6" },
  Science: { bg: "#D1FAE5", text: "#047857" },
  English: { bg: "#DBEAFE", text: "#1D4ED8" },
  "Social Science": { bg: "#FFEDD5", text: "#C2410C" },
  Hindi: { bg: "#FEF9C3", text: "#A16207" },
  Sanskrit: { bg: "#FEF9C3", text: "#A16207" },
  Computer: { bg: "#FCE7F3", text: "#BE185D" },
  "Physical Education": { bg: "#CCFBF1", text: "#0F766E" },
  Art: { bg: "#E0E7FF", text: "#4338CA" },
  Music: { bg: "#E0E7FF", text: "#4338CA" },
  Library: { bg: "#E0E7FF", text: "#4338CA" },
};

const LEGEND = [
  { label: "Mathematics", color: "#EDE9FE" },
  { label: "Science", color: "#D1FAE5" },
  { label: "English", color: "#DBEAFE" },
  { label: "Social Science", color: "#FFEDD5" },
  { label: "Languages", color: "#FEF9C3" },
  { label: "Computer", color: "#FCE7F3" },
  { label: "Physical Education", color: "#CCFBF1" },
  { label: "Arts & CCA", color: "#E0E7FF" },
  { label: "Library", color: "#E0E7FF" },
  { label: "Break / Lunch", color: "#F3F4F6" },
];

const UPCOMING_CHANGES = [
  {
    date: "24 May 2025 (Sat)",
    text: "Science Lab moved to Lab 3",
    by: "P. Sharma",
    status: "Pending" as const,
  },
  {
    date: "26 May 2025 (Mon)",
    text: "Computer period time updated",
    by: "K. Malhotra",
    status: "Approved" as const,
  },
];

function subjectStyle(name: string) {
  return SUBJECT_STYLES[name] ?? { bg: "#F3F4F6", text: "#374151" };
}

function teacherShort(teacher: Teacher | null) {
  if (!teacher) return "—";
  const initial = teacher.lastName?.[0] ? `${teacher.lastName[0]}.` : "";
  return `${teacher.firstName} ${initial}`.trim();
}

function formatTime12(value: string) {
  const [h, m] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(h ?? 0, m ?? 0, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function sectionLabel(section: ClassSection) {
  return `${section.academicClass.name} - ${section.section.name}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatColumnHeader(day: Weekday, date: Date) {
  return `${DAY_SHORT[day]} ${date.getDate()} ${date.toLocaleDateString("en-IN", { month: "short" })}`;
}

function slotKey(start: string, end: string) {
  return `${start}|${end}`;
}

function isBreakSlot(start: string, end: string) {
  const startM = Number(start.split(":")[0]) * 60 + Number(start.split(":")[1]);
  const endM = Number(end.split(":")[0]) * 60 + Number(end.split(":")[1]);
  const duration = endM - startM;
  const label =
    duration <= 20 ? "Break" : duration >= 45 && startM >= 11 * 60 ? "Lunch Break" : null;
  return label;
}

export function TimetablePage() {
  const { accessToken, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("timetable.manage"));
  const [setup, setSetup] = useState<Setup | null>(null);
  const [classSectionId, setClassSectionId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    academicSessionId: "",
    classSectionId: "",
    classSubjectId: "",
    teacherId: "",
    weekday: "MONDAY" as Weekday,
    startTime: "09:00",
    endTime: "10:00",
    room: "",
  });

  async function load() {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set("sessionId", sessionId);
      if (classSectionId) params.set("classSectionId", classSectionId);
      const next = await apiRequest<Setup>(
        `/timetable/setup${params.size ? `?${params}` : ""}`,
        accessToken,
      );
      setSetup(next);
      if (!classSectionId && next.classSections[0]) {
        setClassSectionId(next.classSections[0].id);
      }
      if (!sessionId && next.currentSession?.id) {
        setSessionId(next.currentSession.id);
      }
      setForm((current) => ({
        ...current,
        academicSessionId: current.academicSessionId || next.currentSession?.id || "",
        classSectionId: current.classSectionId || next.classSections[0]?.id || "",
      }));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load timetable");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionId, classSectionId]);

  const selectedSection = setup?.classSections.find((s) => s.id === classSectionId) ?? null;

  const entries = useMemo(() => {
    if (!setup) return [];
    return setup.entries.filter((e) => !classSectionId || e.classSection.id === classSectionId);
  }, [setup, classSectionId]);

  const timeSlots = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>();
    for (const entry of entries) {
      const key = slotKey(entry.startTime, entry.endTime);
      if (!map.has(key)) map.set(key, { start: entry.startTime, end: entry.endTime });
    }
    return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
  }, [entries]);

  const gridBySlotDay = useMemo(() => {
    const grid: Record<string, Partial<Record<Weekday, Entry>>> = {};
    for (const slot of timeSlots) {
      grid[slotKey(slot.start, slot.end)] = {};
    }
    for (const entry of entries) {
      const key = slotKey(entry.startTime, entry.endTime);
      if (!grid[key]) grid[key] = {};
      grid[key]![entry.weekday] = entry;
    }
    return grid;
  }, [entries, timeSlots]);

  const weekEnd = addDays(weekStart, 5);
  const weekRangeLabel = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const classTeacher =
    selectedSection?.subjects.find((s) => s.teacher)?.teacher ??
    (user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null);

  const formSection = setup?.classSections.find((s) => s.id === form.classSectionId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    try {
      await apiRequest("/timetable/entries", accessToken, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          teacherId: form.teacherId || null,
          room: form.room || null,
        }),
      });
      notifySuccess("Timetable period added");
      setCreateOpen(false);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add period");
    }
  }

  function downloadCsv() {
    const rows = [
      ["Day", "Start", "End", "Subject", "Teacher", "Room", "Class"],
      ...entries.map((e) => [
        e.weekday,
        e.startTime,
        e.endTime,
        e.classSubject.subject.name,
        e.teacher ? `${e.teacher.firstName} ${e.teacher.lastName}` : "",
        e.room ?? "",
        sectionLabel(e.classSection),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timetable.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayDays = viewMode === "week" ? GRID_DAYS : [GRID_DAYS[weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1]!];

  return (
    <CmsPage>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 pb-4">
        <div>
          <p className="text-[12px] text-[#6B7280]">
            Home <span className="mx-1 text-[#D1D5DB]">/</span> Timetable
          </p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-[#1A1A1A]">Timetable</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="nx-btn-secondary !text-[12px]" onClick={downloadCsv}>
            <DownloadOutlined sx={{ fontSize: 16 }} /> Download
          </button>
          <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => window.print()}>
            <PrintOutlined sx={{ fontSize: 16 }} /> Print
          </button>
          {canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#4338a8]"
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  classSectionId: classSectionId || f.classSectionId,
                  academicSessionId: sessionId || f.academicSessionId,
                }));
                setCreateOpen(true);
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} /> Create Timetable
            </button>
          ) : null}
        </div>
      </div>

      <CmsScrollBody>
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
          <select
            className="nx-input max-w-[180px] !text-[12px]"
            value={classSectionId}
            onChange={(e) => setClassSectionId(e.target.value)}
          >
            {setup?.classSections.map((item) => (
              <option key={item.id} value={item.id}>
                {sectionLabel(item)}
              </option>
            ))}
          </select>
          <select
            className="nx-input max-w-[140px] !text-[12px]"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            {setup?.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-lg border border-[#E5E7EB] p-0.5">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${viewMode === "week" ? "bg-[#534AB7] text-white" : "text-[#6B7280]"}`}
              onClick={() => setViewMode("week")}
            >
              Week View
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${viewMode === "day" ? "bg-[#534AB7] text-white" : "text-[#6B7280]"}`}
              onClick={() => setViewMode("day")}
            >
              Day View
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="nx-icon-btn"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              <ChevronLeftOutlined sx={{ fontSize: 18 }} />
            </button>
            <span className="min-w-[140px] text-center text-[12px] font-semibold text-[#374151]">
              {weekRangeLabel}
            </span>
            <button
              type="button"
              className="nx-icon-btn"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              <ChevronRightOutlined sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <th className="w-28 px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      Time
                    </th>
                    {displayDays.map((day, idx) => (
                      <th
                        key={day}
                        className="px-2 py-3 text-center text-[12px] font-bold text-[#374151]"
                      >
                        {formatColumnHeader(day, addDays(weekStart, idx))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.length === 0 ? (
                    <tr>
                      <td
                        colSpan={displayDays.length + 1}
                        className="px-4 py-16 text-center text-[13px] text-[#9CA3AF]"
                      >
                        No periods scheduled for this class.{" "}
                        {canManage ? (
                          <button
                            type="button"
                            className="font-semibold text-[#534AB7] hover:underline"
                            onClick={() => setCreateOpen(true)}
                          >
                            Add a period
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ) : (
                    timeSlots.map((slot) => {
                      const key = slotKey(slot.start, slot.end);
                      const breakLabel = isBreakSlot(slot.start, slot.end);
                      return (
                        <tr key={key} className="border-b border-[#F3F4F6] last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2 align-top text-[11px] font-semibold text-[#6B7280]">
                            {formatTime12(slot.start)}
                            <br />
                            <span className="font-normal text-[#9CA3AF]">{formatTime12(slot.end)}</span>
                          </td>
                          {displayDays.map((day) => {
                            const entry = gridBySlotDay[key]?.[day];
                            if (breakLabel && !entry) {
                              return (
                                <td key={day} className="px-1.5 py-1.5 align-top">
                                  <div className="rounded-lg bg-[#F3F4F6] px-2 py-3 text-center text-[11px] font-semibold text-[#9CA3AF]">
                                    {breakLabel}
                                  </div>
                                </td>
                              );
                            }
                            if (!entry) {
                              return <td key={day} className="px-1.5 py-1.5 align-top" />;
                            }
                            const style = subjectStyle(entry.classSubject.subject.name);
                            return (
                              <td key={day} className="px-1.5 py-1.5 align-top">
                                <div
                                  className="rounded-lg px-2.5 py-2"
                                  style={{ background: style.bg, color: style.text }}
                                >
                                  <p className="text-[12px] font-bold leading-tight">
                                    {entry.classSubject.subject.name}
                                  </p>
                                  <p className="mt-0.5 text-[10px] opacity-80">
                                    {teacherShort(entry.teacher)}
                                  </p>
                                  <p className="text-[10px] opacity-70">{entry.room ?? "—"}</p>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-bold text-[#1A1A1A]">Timetable Info</h2>
              <dl className="mt-3 space-y-2.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Class</dt>
                  <dd className="font-semibold text-[#1A1A1A]">
                    {selectedSection ? sectionLabel(selectedSection) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Class Teacher</dt>
                  <dd className="font-semibold text-[#1A1A1A]">
                    {classTeacher
                      ? `${classTeacher.firstName} ${classTeacher.lastName ?? ""}`.trim()
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Total Periods / Week</dt>
                  <dd className="font-semibold text-[#1A1A1A]">{entries.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6B7280]">Effective From</dt>
                  <dd className="font-semibold text-[#1A1A1A]">
                    {weekStart.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
              <button type="button" className="mt-3 text-[12px] font-semibold text-[#534AB7] hover:underline">
                View Timetable Rules &gt;
              </button>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-bold text-[#1A1A1A]">Upcoming Changes</h2>
              <div className="mt-3 space-y-3">
                {UPCOMING_CHANGES.map((item) => (
                  <div key={item.date + item.text} className="rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-[#6B7280]">{item.date}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          item.status === "Pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] font-semibold text-[#1A1A1A]">{item.text}</p>
                    <p className="text-[10px] text-[#9CA3AF]">By {item.by}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="text-[14px] font-bold text-[#1A1A1A]">Legend</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {LEGEND.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-sm border border-black/5"
                      style={{ background: item.color }}
                    />
                    <span className="text-[11px] text-[#6B7280]">{item.label}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </CmsScrollBody>

      {createOpen && canManage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onSubmit={submit}
          >
            <h2 className="text-[16px] font-bold text-[#1A1A1A]">Add Timetable Period</h2>
            <div className="mt-4 space-y-3">
              <select
                className="nx-input w-full"
                required
                value={form.classSectionId}
                onChange={(e) =>
                  setForm({ ...form, classSectionId: e.target.value, classSubjectId: "", teacherId: "" })
                }
              >
                <option value="">Class section</option>
                {setup?.classSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {sectionLabel(item)}
                  </option>
                ))}
              </select>
              <select
                className="nx-input w-full"
                required
                value={form.classSubjectId}
                onChange={(e) => {
                  const subject = formSection?.subjects.find((s) => s.id === e.target.value);
                  setForm({
                    ...form,
                    classSubjectId: e.target.value,
                    teacherId: subject?.teacher?.id ?? "",
                  });
                }}
              >
                <option value="">Subject</option>
                {formSection?.subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject.name}
                  </option>
                ))}
              </select>
              <select
                className="nx-input w-full"
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: e.target.value as Weekday })}
              >
                {GRID_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day[0]}
                    {day.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="nx-input"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
                <input
                  className="nx-input"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
              <input
                className="nx-input w-full"
                placeholder="Room (e.g. Room 201)"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="nx-btn-secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="nx-btn-primary">
                Save Period
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <CmsFooter />
    </CmsPage>
  );
}
