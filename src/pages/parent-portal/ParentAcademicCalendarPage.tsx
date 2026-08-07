import { useMemo, useState } from "react";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { EVENT_TYPE_COLORS } from "./components/eventColors";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import type { CalendarEventType } from "./types";

interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LEGEND: CalendarEventType[] = ["Holiday", "Exam", "Event", "PTM"];

const CHIP_TONE: Record<CalendarEventType, "red" | "green" | "purple" | "orange"> = {
  Holiday: "red",
  Exam: "green",
  Event: "purple",
  PTM: "orange",
};

/** Shared school calendar — same for all children; easy to swap for API later. */
const MOCK_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Labour Day Holiday", date: "2025-05-01", type: "Holiday" },
  { id: "e2", title: "Science Exhibition", date: "2025-05-15", type: "Event" },
  { id: "e3", title: "Maths Unit Test", date: "2025-05-25", type: "Exam" },
  { id: "e4", title: "English Unit Test", date: "2025-05-28", type: "Exam" },
  { id: "e5", title: "Parent-Teacher Meeting", date: "2025-05-31", type: "PTM" },
  { id: "e6", title: "Regional Holiday", date: "2025-06-01", type: "Holiday" },
  { id: "e7", title: "World Environment Day", date: "2025-06-05", type: "Event" },
  { id: "e8", title: "Science Mid-Term", date: "2025-06-12", type: "Exam" },
  { id: "e9", title: "Sports Day", date: "2025-06-20", type: "Event" },
  { id: "e10", title: "Term Break Begins", date: "2025-06-28", type: "Holiday" },
  { id: "e11", title: "Mid-Term PTM", date: "2025-07-05", type: "PTM" },
];

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplay(ymd: string) {
  return parseYmd(ymd).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ParentAcademicCalendarPage() {
  const { activeChild } = useParentPortal();
  const [cursor, setCursor] = useState(() => new Date(2025, 4, 1)); // May 2025

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of MOCK_EVENTS) {
      const d = parseYmd(event.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
    return map;
  }, [year, month]);

  const upcoming = useMemo(() => {
    // Anchor "today" to mid-May 2025 so mock upcoming list is populated
    const today = new Date(2025, 4, 7);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return MOCK_EVENTS.filter((event) => {
      const d = parseYmd(event.date);
      return d >= today && d <= end;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toYmd(new Date(2025, 4, 7));
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Academic Calendar"
        subtitle={`Holidays, exams and school events for ${activeChild.name}'s class.`}
      />
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        School calendar API is not available yet. Showing sample events until it is wired.
      </p>

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

          <div className="mb-2 grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-[11px] font-semibold text-[#9CA3AF]">
                {d}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day == null) return <div key={`e-${index}`} className="min-h-[72px]" />;
              const dayEvents = eventsByDay.get(day) ?? [];
              const primary = dayEvents[0];
              const colors = primary ? EVENT_TYPE_COLORS[primary.type] : null;
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = key === todayKey;

              return (
                <div
                  key={day}
                  className="flex min-h-[72px] flex-col gap-1 rounded-xl border p-1.5"
                  style={{
                    borderColor: isToday ? PARENT_PRIMARY : PARENT_BORDER,
                    background: colors ? colors.bg : isToday ? PARENT_PRIMARY_SUBTLE : "#FFFFFF",
                  }}
                >
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: colors ? colors.text : isToday ? PARENT_PRIMARY : "#374151" }}
                  >
                    {day}
                  </span>
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded-md px-1 py-0.5 text-[9px] font-semibold leading-tight text-white"
                      style={{ background: EVENT_TYPE_COLORS[event.type].dot }}
                      title={event.title}
                    >
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] font-semibold text-[#6B7280]">+{dayEvents.length - 2} more</span>
                  )}
                </div>
              );
            })}
          </div>

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
          <p className="mb-4 text-[12px] text-[#6B7280]">Events from 7 May – 6 Jun 2025</p>
          <ul className="flex flex-col gap-3">
            {upcoming.length === 0 ? (
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
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">{formatDisplay(event.date)}</p>
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
