import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { isProductBucketAllowed } from "../../lib/productMode";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { usePortal } from "./PortalContext";

type BackendEventType = "ACADEMIC" | "EXAMINATION" | "HOLIDAY" | "MEETING" | "OTHER" | "IMPORTANT";

type PortalAcademicEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  eventType: BackendEventType;
  startAt: string;
  endAt: string | null;
};

type UiType = "ACADEMIC" | "EXAMINATION" | "HOLIDAY" | "MEETING" | "OTHER" | "IMPORTANT";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_META: Record<UiType, { label: string; color: string; bg: string }> = {
  ACADEMIC: { label: "Academic", color: "#534AB7", bg: "#EEF2FF" },
  EXAMINATION: { label: "Exam", color: "#ea580c", bg: "#FFEDD5" },
  HOLIDAY: { label: "Holiday", color: "#15803d", bg: "#DCFCE7" },
  MEETING: { label: "Meeting", color: "#1d4ed8", bg: "#DBEAFE" },
  OTHER: { label: "Other", color: "#64748b", bg: "#F1F5F9" },
  IMPORTANT: { label: "Important", color: "#be185d", bg: "#FCE7F3" },
};

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventOnDay(event: PortalAcademicEvent, day: Date) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : start;
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export function PortalCalendarPage() {
  const { child, basePath, productMode, accessToken } = usePortal();
  const showLms = isProductBucketAllowed(productMode, "LMS");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<PortalAcademicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    if (!accessToken || !child?.student?.id) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const padFrom = new Date(year, month, 1);
      padFrom.setDate(padFrom.getDate() - 7);
      const padTo = new Date(year, month + 1, 0);
      padTo.setDate(padTo.getDate() + 45);
      const data = await apiRequest<PortalAcademicEvent[]>(
        `/portal/children/${child.student.id}/academic-calendar?from=${toYmd(padFrom)}&to=${toYmd(padTo)}`,
        accessToken,
      );
      setEvents(data ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load academic calendar");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, child?.student?.id, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return events
      .filter((ev) => {
        const d = new Date(ev.startAt);
        d.setHours(0, 0, 0, 0);
        return d >= today && d <= end;
      })
      .slice(0, 8);
  }, [events]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toYmd(new Date());
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  if (!showLms) return <Navigate to={basePath} replace />;
  if (!child) return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">Academic Calendar</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Published holidays, exams, and school events for your class.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <section className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-[#1A1A2E]">Monthly View</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
                onClick={() => setCursor(new Date(year, month - 1, 1))}
              >
                <ChevronLeftRounded sx={{ fontSize: 20 }} />
              </button>
              <span className="min-w-[140px] text-center text-[13px] font-bold text-[#1A1A2E]">{monthLabel}</span>
              <button
                type="button"
                aria-label="Next month"
                className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
                onClick={() => setCursor(new Date(year, month + 1, 1))}
              >
                <ChevronRightRounded sx={{ fontSize: 20 }} />
              </button>
            </div>
          </div>

          {loading ? (
            <p className="py-16 text-center text-[13px] text-[#6B7280]">Loading calendar…</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#EEF0F4]">
              <div className="grid grid-cols-7 bg-[#F7F6FF]">
                {WEEKDAYS.map((d) => (
                  <span
                    key={d}
                    className="py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 [&>div]:border-t [&>div]:border-r [&>div]:border-[#EEF0F4] [&>div:nth-child(7n)]:border-r-0">
                {cells.map((day, index) => {
                  if (day == null) return <div key={`e-${index}`} className="min-h-[88px] bg-[#F8FAFC]" />;
                  const date = new Date(year, month, day);
                  const dayEvents = events.filter((ev) => eventOnDay(ev, date)).slice(0, 2);
                  const more = events.filter((ev) => eventOnDay(ev, date)).length - dayEvents.length;
                  const key = toYmd(date);
                  const isToday = key === todayKey;

                  return (
                    <div
                      key={day}
                      className={`flex min-h-[88px] flex-col gap-1 p-1.5 ${isToday ? "bg-[#F5F3FF]" : "bg-white"}`}
                    >
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${
                          isToday ? "bg-[#534AB7] text-white" : "text-[#374151]"
                        }`}
                      >
                        {day}
                      </span>
                      {dayEvents.map((event) => {
                        const meta = TYPE_META[event.eventType];
                        return (
                          <span
                            key={event.id}
                            className="truncate rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold leading-tight"
                            style={{
                              background: meta.bg,
                              color: meta.color,
                              boxShadow: `inset 3px 0 0 ${meta.color}`,
                            }}
                            title={event.title}
                          >
                            {event.title}
                          </span>
                        );
                      })}
                      {more > 0 ? (
                        <span className="px-1 text-[9px] font-semibold text-[#6B7280]">+{more} more</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#E5E7EB] pt-3">
            {(Object.keys(TYPE_META) as UiType[]).map((type) => (
              <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
                <span className="size-2.5 rounded-full" style={{ background: TYPE_META[type].color }} />
                {TYPE_META[type].label}
              </span>
            ))}
          </div>
        </section>

        <aside className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5">
          <h2 className="mb-1 text-[15px] font-bold text-[#1A1A2E]">Upcoming (30 days)</h2>
          <p className="mb-4 text-[12px] text-[#6B7280]">Published school and class events</p>
          <ul className="flex flex-col gap-3">
            {loading ? (
              <li className="text-[13px] text-[#6B7280]">Loading…</li>
            ) : upcoming.length === 0 ? (
              <li className="text-[13px] text-[#6B7280]">No upcoming events.</li>
            ) : (
              upcoming.map((event) => {
                const meta = TYPE_META[event.eventType];
                const start = new Date(event.startAt);
                return (
                  <li key={event.id} className="flex items-start gap-3 border-b border-[#E5E7EB] pb-3 last:border-b-0 last:pb-0">
                    <div
                      className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      {start.getDate()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{event.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#6B7280]">
                        {start.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                      <span
                        className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
