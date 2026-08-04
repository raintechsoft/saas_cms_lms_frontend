import { useEffect, useMemo, useState } from "react";
import {
  AccessTimeRounded,
  ArrowBackIosNewRounded,
  ArrowForwardIosRounded,
  ArrowForwardRounded,
  CalendarMonthOutlined,
  DownloadRounded,
  InfoOutlined,
  MenuBookOutlined,
  PersonOutlineRounded,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import { PORTAL_WEEKDAYS, type PortalTimetableItem } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";

const DAY_TABS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

const SUBJECT_COLORS = [
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </section>
  );
}

function formatTime(value: string) {
  if (/[ap]m/i.test(value)) return value;
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function timeToMinutes(value: string) {
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw.slice(0, 2));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function dayLabel(day: string) {
  return day[0] + day.slice(1).toLowerCase();
}

function subjectColor(subject: string) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

function roomLabel(room: string | null) {
  if (!room) return "—";
  if (/^(room|lab)\b/i.test(room)) return room;
  return `Room ${room}`;
}

function todayWeekdayKey() {
  return PORTAL_WEEKDAYS[(new Date().getDay() + 6) % 7];
}

function downloadTimetablePdf(
  entries: PortalTimetableItem[],
  studentName: string,
  classLabel: string,
) {
  const rows = DAY_TABS.flatMap((day) => {
    const dayEntries = entries
      .filter((e) => e.weekday === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (dayEntries.length === 0) return "";
    const lines = dayEntries
      .map(
        (e, i) =>
          `<tr><td>${i + 1}</td><td>${formatTime(e.startTime)} – ${formatTime(e.endTime)}</td><td>${e.subject}</td><td>${e.teacher ?? "—"}</td><td>${roomLabel(e.room)}</td></tr>`,
      )
      .join("");
    return `<h2>${dayLabel(day)}</h2><table><thead><tr><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead><tbody>${lines}</tbody></table>`;
  }).join("");

  const html = `<!doctype html><html><head><title>Timetable – ${studentName}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1a1a1a}
      h1{font-size:20px;margin:0 0 4px} p{color:#6b7280;margin:0 0 20px;font-size:13px}
      h2{font-size:14px;margin:20px 0 8px;color:#534AB7}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
      th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
      th{background:#f6f7f9}
    </style></head><body>
    <h1>Class Timetable</h1>
    <p>${studentName} · ${classLabel}</p>
    ${rows || "<p>No timetable entries.</p>"}
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export function PortalTimetablePage() {
  const { accessToken, child, productMode, basePath, overview, activeChild, setActiveChild } = usePortal();
  const [entries, setEntries] = useState<PortalTimetableItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = todayWeekdayKey();
    return DAY_TABS.includes(today as (typeof DAY_TABS)[number]) ? today : "MONDAY";
  });
  const showLms = isProductBucketAllowed(productMode, "LMS");

  useEffect(() => {
    if (!showLms || !child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<PortalTimetableItem[]>(`/portal/children/${child.student.id}/timetable`, accessToken)
      .then((data) => {
        setEntries(data);
        const today = todayWeekdayKey();
        if (data.some((e) => e.weekday === today) && DAY_TABS.includes(today as (typeof DAY_TABS)[number])) {
          setSelectedDay(today);
        } else {
          const first = DAY_TABS.find((day) => data.some((e) => e.weekday === day));
          if (first) setSelectedDay(first);
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load timetable");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id, showLms]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.weekday === selectedDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [entries, selectedDay],
  );

  const todayKey = todayWeekdayKey();
  const todayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.weekday === todayKey)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [entries, todayKey],
  );

  const stats = useMemo(() => {
    const subjects = new Set(entries.map((e) => e.subject));
    return {
      subjects: subjects.size,
      periods: entries.length,
      teacher: child?.enrollment?.classTeacher ?? "—",
    };
  }, [entries, child?.enrollment?.classTeacher]);

  const nowNext = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    let currentId: string | null = null;
    let nextId: string | null = null;
    for (const entry of todayEntries) {
      const start = timeToMinutes(entry.startTime);
      const end = timeToMinutes(entry.endTime);
      if (mins >= start && mins < end) currentId = entry.id;
      else if (mins < start && !nextId) nextId = entry.id;
    }
    return { currentId, nextId };
  }, [todayEntries]);

  const classLabel = child?.enrollment
    ? `Class ${child.enrollment.className} - ${child.enrollment.section}`
    : "Class";

  const todayDateLabel = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "long",
  });

  const shiftDay = (delta: number) => {
    const idx = DAY_TABS.indexOf(selectedDay as (typeof DAY_TABS)[number]);
    const base = idx >= 0 ? idx : 0;
    const next = (base + delta + DAY_TABS.length) % DAY_TABS.length;
    setSelectedDay(DAY_TABS[next]);
  };

  if (!showLms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Class Timetable</h1>
          <p className="mt-1 text-[12px] text-[#9CA3AF]">
            <Link to={basePath} className="hover:text-[#6B7280]">
              Dashboard
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-medium text-[#6B7280]">Timetable</span>
          </p>
        </div>

        {overview && overview.children.length > 1 ? (
          <select
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#1A1A1A] outline-none"
            value={activeChild}
            onChange={(event) => setActiveChild(Number(event.target.value))}
            aria-label="Select class / child"
          >
            {overview.children.map((item, index) => (
              <option key={item.student.id} value={index}>
                {item.enrollment
                  ? `Class ${item.enrollment.className} - ${item.enrollment.section}`
                  : item.student.firstName}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#1A1A1A]">
            {classLabel}
          </span>
        )}
      </div>

      {error && <p className="alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading timetable…</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Today's Date",
                value: todayDateLabel,
                Icon: CalendarMonthOutlined,
                tone: PRIMARY,
                bg: PRIMARY_SOFT,
              },
              {
                label: "Total Subjects",
                value: `${stats.subjects} This Week`,
                Icon: MenuBookOutlined,
                tone: "#059669",
                bg: "#ECFDF5",
              },
              {
                label: "Total Periods",
                value: `${stats.periods} This Week`,
                Icon: AccessTimeRounded,
                tone: "#D97706",
                bg: "#FFF7ED",
              },
              {
                label: "Class Teacher",
                value: stats.teacher,
                Icon: PersonOutlineRounded,
                tone: "#0284C7",
                bg: "#E0F2FE",
              },
            ].map((card) => (
              <Card key={card.label} className="flex items-center gap-3 !p-4">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-2xl"
                  style={{ background: card.bg, color: card.tone }}
                >
                  <card.Icon sx={{ fontSize: 22 }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#9CA3AF]">{card.label}</p>
                  <p className="truncate text-[14px] font-bold text-[#1A1A1A]">{card.value}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            {/* Weekly timetable */}
            <Card className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Weekly Timetable</h2>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-white"
                    style={{ background: PRIMARY }}
                    onClick={() => {
                      const today = todayWeekdayKey();
                      if (DAY_TABS.includes(today as (typeof DAY_TABS)[number])) setSelectedDay(today);
                    }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9]"
                    onClick={() => shiftDay(-1)}
                    aria-label="Previous day"
                  >
                    <ArrowBackIosNewRounded sx={{ fontSize: 14 }} />
                  </button>
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9]"
                    onClick={() => shiftDay(1)}
                    aria-label="Next day"
                  >
                    <ArrowForwardIosRounded sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto px-5 py-3">
                {DAY_TABS.map((day) => {
                  const active = selectedDay === day;
                  const count = entries.filter((e) => e.weekday === day).length;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                        active ? "text-white" : "bg-[#F6F7F9] text-[#6B7280] hover:bg-[#EEF0FD]"
                      }`}
                      style={active ? { background: PRIMARY } : undefined}
                    >
                      {dayLabel(day)}
                      {count > 0 ? <span className="ml-1 opacity-70">({count})</span> : null}
                    </button>
                  );
                })}
              </div>

              {dayEntries.length === 0 ? (
                <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">No periods scheduled for {dayLabel(selectedDay)}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-y border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-5 py-3 font-semibold">Period</th>
                        <th className="px-5 py-3 font-semibold">Time</th>
                        <th className="px-5 py-3 font-semibold">Subject</th>
                        <th className="px-5 py-3 font-semibold">Teacher</th>
                        <th className="px-5 py-3 font-semibold">Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEntries.map((entry, index) => (
                        <tr key={entry.id} className="border-b border-[#F1F2F6] last:border-0">
                          <td className="px-5 py-3.5 font-bold text-[#1A1A1A]">{index + 1}</td>
                          <td className="px-5 py-3.5 text-[#6B7280]">
                            {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-2 font-semibold text-[#1A1A1A]">
                              <span className="size-2 rounded-full" style={{ background: subjectColor(entry.subject) }} />
                              {entry.subject}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#6B7280]">{entry.teacher ?? "—"}</td>
                          <td className="px-5 py-3.5">
                            {entry.room ? (
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                              >
                                {roomLabel(entry.room)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="m-5 mt-2 flex items-start gap-2 rounded-xl bg-[#EEF0FD] px-3.5 py-3 text-[12px] text-[#534AB7]">
                <InfoOutlined sx={{ fontSize: 16, marginTop: "1px" }} />
                <p>Please arrive 5 minutes before the class starts.</p>
              </div>
            </Card>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              <Card>
                <h2 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Today&apos;s Schedule</h2>
                {todayEntries.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-[#6B7280]">No classes scheduled today.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {todayEntries.map((entry) => {
                      const badge =
                        entry.id === nowNext.currentId
                          ? { label: "Now", bg: PRIMARY_SOFT, fg: PRIMARY }
                          : entry.id === nowNext.nextId
                            ? { label: "Next", bg: "#F3F4F6", fg: "#6B7280" }
                            : null;
                      return (
                        <div key={entry.id} className="flex gap-3">
                          <span
                            className="mt-1 w-1 shrink-0 rounded-full"
                            style={{ background: subjectColor(entry.subject) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[#9CA3AF]">
                                  {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
                                </p>
                                <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{entry.subject}</p>
                                <p className="truncate text-[11px] text-[#6B7280]">{entry.teacher ?? "—"}</p>
                              </div>
                              {badge ? (
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                  style={{ background: badge.bg, color: badge.fg }}
                                >
                                  {badge.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  className="mt-5 flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-[13px] font-bold text-white"
                  style={{ background: PRIMARY }}
                  onClick={() => {
                    if (DAY_TABS.includes(todayKey as (typeof DAY_TABS)[number])) setSelectedDay(todayKey);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  View Full Timetable <ArrowForwardRounded sx={{ fontSize: 16 }} />
                </button>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute -right-4 -top-4 size-20 rounded-full bg-[#EEF0FD]" />
                <div className="relative">
                  <div
                    className="mb-3 grid size-12 place-items-center rounded-2xl"
                    style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                  >
                    <CalendarMonthOutlined sx={{ fontSize: 24 }} />
                  </div>
                  <p className="text-[14px] font-bold text-[#1A1A1A]">Download your complete timetable</p>
                  <p className="mt-1 text-[12px] text-[#6B7280]">
                    Get a printable PDF of the full weekly schedule for {classLabel}.
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-bold transition hover:bg-[#F6F7F9]"
                    style={{ borderColor: BORDER, color: PRIMARY }}
                    onClick={() =>
                      downloadTimetablePdf(
                        entries,
                        `${child.student.firstName} ${child.student.lastName ?? ""}`.trim(),
                        classLabel,
                      )
                    }
                  >
                    <DownloadRounded sx={{ fontSize: 16 }} />
                    Download PDF
                  </button>
                </div>
              </Card>
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Your School Name. All rights reserved.</p>
            <div className="flex flex-wrap gap-4 font-medium">
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Privacy Policy
              </Link>
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Terms of Use
              </Link>
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Help & Support
              </Link>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
