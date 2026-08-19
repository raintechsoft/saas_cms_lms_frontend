import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { EVENT_TYPE_COLORS } from "./components/eventColors";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import type { CalendarEventType } from "./types";

type BackendEventType = "ACADEMIC" | "EXAMINATION" | "HOLIDAY" | "MEETING" | "OTHER" | "IMPORTANT";

interface PortalAcademicEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  eventType: BackendEventType;
  startAt: string;
  endAt: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  location: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND: CalendarEventType[] = ["Holiday", "Exam", "Event", "PTM", "Important"];

const CHIP_TONE: Record<CalendarEventType, "red" | "green" | "purple" | "orange" | "blue"> = {
  Holiday: "green",
  Exam: "orange",
  Event: "purple",
  PTM: "blue",
  Important: "red",
};

function mapEventType(type: BackendEventType): CalendarEventType {
  switch (type) {
    case "EXAMINATION":
      return "Exam";
    case "HOLIDAY":
      return "Holiday";
    case "MEETING":
      return "PTM";
    case "IMPORTANT":
      return "Important";
    default:
      return "Event";
  }
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(ymd: string) {
  return parseYmd(ymd).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ParentAcademicCalendarPage() {
  const { activeChild, portalChild, accessToken } = useParentPortal();
  const studentId = portalChild?.student?.id;
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const load = useCallback(async () => {
    if (!accessToken || !studentId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Wider window so upcoming (next 30 days) stays useful near month edges
      const padFrom = new Date(year, month, 1);
      padFrom.setDate(padFrom.getDate() - 7);
      const padTo = new Date(year, month + 1, 0);
      padTo.setDate(padTo.getDate() + 45);
      const data = await apiRequest<PortalAcademicEvent[]>(
        `/portal/children/${studentId}/academic-calendar?from=${toYmd(padFrom)}&to=${toYmd(padTo)}`,
        accessToken,
      );
      setEvents(
        (data ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          date: toYmd(new Date(row.startAt)),
          type: mapEventType(row.eventType),
          location: row.location,
        })),
      );
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load academic calendar");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, studentId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of events) {
      const d = parseYmd(event.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [events, year, month]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return events
      .filter((event) => {
        const d = parseYmd(event.date);
        return d >= today && d <= end;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [events]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toYmd(new Date());
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Academic Calendar"
        subtitle={`Holidays, exams and school events for ${activeChild.name}'s class.`}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <section
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
          style={{ borderColor: PARENT_BORDER }}
        >
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
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: PARENT_BORDER }}>
              <div className="grid grid-cols-7" style={{ background: PARENT_PRIMARY_SUBTLE }}>
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
                  const dayEvents = eventsByDay.get(day) ?? [];
                  const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = key === todayKey;

                  return (
                    <div
                      key={day}
                      className="flex min-h-[88px] flex-col gap-1 p-1.5"
                      style={{ background: isToday ? PARENT_PRIMARY_SUBTLE : "#FFFFFF" }}
                    >
                      <span
                        className="inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold"
                        style={{
                          background: isToday ? PARENT_PRIMARY : "transparent",
                          color: isToday ? "#FFFFFF" : "#374151",
                        }}
                      >
                        {day}
                      </span>
                      {dayEvents.slice(0, 2).map((event) => {
                        const colors = EVENT_TYPE_COLORS[event.type];
                        return (
                          <span
                            key={event.id}
                            className="truncate rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold leading-tight"
                            style={{
                              background: colors.bg,
                              color: colors.text,
                              boxShadow: `inset 3px 0 0 ${colors.dot}`,
                            }}
                            title={event.title}
                          >
                            {event.title}
                          </span>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <span className="px-1 text-[9px] font-semibold text-[#6B7280]">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
            {LEGEND.map((type) => (
              <span key={type} className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
                <span className="size-2.5 rounded-full" style={{ background: EVENT_TYPE_COLORS[type].dot }} />
                {type}
              </span>
            ))}
          </div>
        </section>

        <aside
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
          style={{ borderColor: PARENT_BORDER }}
        >
          <h2 className="mb-1 text-[15px] font-bold text-[#1A1A2E]">Upcoming (30 days)</h2>
          <p className="mb-4 text-[12px] text-[#6B7280]">Published school and class events</p>
          <ul className="flex flex-col gap-3">
            {loading ? (
              <li className="text-[13px] text-[#6B7280]">Loading…</li>
            ) : upcoming.length === 0 ? (
              <li className="text-[13px] text-[#6B7280]">No upcoming events.</li>
            ) : (
              upcoming.map((event) => (
                <li
                  key={event.id}
                  className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  <div
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold"
                    style={{
                      background: EVENT_TYPE_COLORS[event.type].bg,
                      color: EVENT_TYPE_COLORS[event.type].text,
                    }}
                  >
                    {parseYmd(event.date).getDate()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{event.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      {formatDisplay(event.date)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                    <div className="mt-1.5">
                      <StatusChip label={event.type} tone={CHIP_TONE[event.type]} />
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
