import { useMemo, useState } from "react";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { CalendarEventType, UpcomingEvent } from "../types";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "../ParentPortalLayout";
import { EVENT_TYPE_COLORS } from "./eventColors";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEGEND: Array<{ label: string; color: string }> = [
  { label: "Exam", color: EVENT_TYPE_COLORS.Exam.dot },
  { label: "Event", color: EVENT_TYPE_COLORS.Event.dot },
  { label: "PTM", color: EVENT_TYPE_COLORS.PTM.dot },
  { label: "Holiday", color: EVENT_TYPE_COLORS.Holiday.dot },
  { label: "Important", color: EVENT_TYPE_COLORS.Important.dot },
];

function buildMonthGrid(year: number, month: number, marks: Map<number, CalendarEventType>) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const cells: Array<{
    date: number;
    inCurrentMonth: boolean;
    isToday?: boolean;
    type?: CalendarEventType;
  }> = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: prevDays - startOffset + i + 1, inCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: d,
      inCurrentMonth: true,
      isToday:
        today.getFullYear() === year && today.getMonth() === month && today.getDate() === d,
      type: marks.get(d),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: cells.length - (startOffset + daysInMonth) + 1, inCurrentMonth: false });
  }
  return cells;
}

export function MiniCalendarCard({ events = [] }: { events?: UpcomingEvent[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const marks = useMemo(() => {
    const map = new Map<number, CalendarEventType>();
    const monthKey = cursor.toLocaleString("en-IN", { month: "short" }).toUpperCase();
    for (const event of events) {
      if (event.month.toUpperCase() === monthKey) map.set(event.day, event.type);
    }
    return map;
  }, [events, cursor]);

  const cells = useMemo(() => buildMonthGrid(year, month, marks), [year, month, marks]);
  const monthEvents = events.slice(0, 4);

  return (
    <section
      className="rounded-2xl border bg-white shadow-[0_2px_12px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="text-[14px] font-bold text-[#111827]">Calendar</h2>
        <Link
          to="/parent/attendance-calendar/academic-calendar"
          className="text-[12px] font-semibold text-[#4F46E5] hover:underline"
        >
          Full view
        </Link>
      </div>

      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            <ChevronLeftRounded sx={{ fontSize: 18 }} />
          </button>
          <p className="text-[13px] font-bold text-[#111827]">{monthLabel}</p>
          <button
            type="button"
            aria-label="Next month"
            className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            <ChevronRightRounded sx={{ fontSize: 18 }} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAYS.map((day) => (
            <span key={day} className="text-[10.5px] font-semibold text-[#9CA3AF]">
              {day}
            </span>
          ))}
          {cells.map((day, index) => {
            const colors = day.type ? EVENT_TYPE_COLORS[day.type] : null;
            return (
              <div key={`${day.date}-${index}`} className="grid place-items-center py-0.5">
                <span
                  className="grid size-7 place-items-center rounded-full text-[11.5px] font-semibold"
                  style={{
                    color: !day.inCurrentMonth
                      ? "#D1D5DB"
                      : colors
                        ? "#FFFFFF"
                        : day.isToday
                          ? PARENT_PRIMARY
                          : "#374151",
                    background: colors
                      ? colors.dot
                      : day.isToday
                        ? PARENT_PRIMARY_SUBTLE
                        : "transparent",
                  }}
                >
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3"
          style={{ borderColor: PARENT_BORDER }}
        >
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
              <span className="size-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>

        <ul className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
          {monthEvents.length === 0 ? (
            <li className="py-1 text-[12px] text-[#9CA3AF]">No upcoming exams marked.</li>
          ) : (
            monthEvents.map((event) => {
              const colors = EVENT_TYPE_COLORS[event.type];
              return (
                <li key={event.id} className="flex items-center gap-2.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: colors.dot }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#374151]">
                    {event.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                    {event.day} {event.month}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}
