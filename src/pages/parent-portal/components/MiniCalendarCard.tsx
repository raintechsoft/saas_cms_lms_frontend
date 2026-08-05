import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { MOCK_CALENDAR_DAYS, MOCK_CALENDAR_MONTH_LABEL, MOCK_UPCOMING_EVENTS } from "../mockData";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "../ParentPortalLayout";
import { EVENT_TYPE_COLORS } from "./eventColors";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEGEND: Array<{ label: string; color: string }> = [
  { label: "Exam", color: EVENT_TYPE_COLORS.Exam.dot },
  { label: "Event", color: EVENT_TYPE_COLORS.Event.dot },
  { label: "PTM", color: EVENT_TYPE_COLORS.PTM.dot },
  { label: "Holiday", color: EVENT_TYPE_COLORS.Holiday.dot },
];

export function MiniCalendarCard() {
  return (
    <div
      className="flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[#1A1A2E]">Mini Calendar</h2>
        <Link to="/parent/attendance-calendar/academic-calendar" className="text-[12px] font-semibold text-[#4F46E5] hover:underline">
          View Full Calendar
        </Link>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" className="grid size-7 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]">
          <ChevronLeftRounded sx={{ fontSize: 18 }} />
        </button>
        <p className="text-[13px] font-bold text-[#1A1A2E]">{MOCK_CALENDAR_MONTH_LABEL}</p>
        <button type="button" aria-label="Next month" className="grid size-7 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]">
          <ChevronRightRounded sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[10.5px] font-semibold text-[#9CA3AF]">
            {day}
          </span>
        ))}
        {MOCK_CALENDAR_DAYS.map((day, index) => {
          const colors = day.type ? EVENT_TYPE_COLORS[day.type] : null;
          return (
            <div key={`${day.date}-${index}`} className="grid place-items-center py-0.5">
              <span
                className="grid size-7 place-items-center rounded-full text-[11.5px] font-semibold"
                style={{
                  color: !day.inCurrentMonth ? "#D1D5DB" : colors ? "#FFFFFF" : day.isToday ? PARENT_PRIMARY : "#374151",
                  background: colors ? colors.dot : day.isToday ? PARENT_PRIMARY_SUBTLE : "transparent",
                }}
              >
                {day.date}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
            <span className="size-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <ul className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
        {MOCK_UPCOMING_EVENTS.slice(0, 5).map((event) => {
          const colors = EVENT_TYPE_COLORS[event.type];
          return (
            <li key={event.id} className="flex items-center gap-2.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colors.dot }} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#374151]">{event.title}</span>
              <span className="shrink-0 text-[11px] font-semibold text-[#6B7280]">
                {event.day} {event.month}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
