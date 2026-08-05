import type { UpcomingEvent } from "../types";
import { SectionCard } from "./SectionCard";
import { EVENT_TYPE_COLORS } from "./eventColors";

export function UpcomingEventsCard({ events }: { events: UpcomingEvent[] }) {
  return (
    <SectionCard title="Upcoming Events" linkLabel="View Calendar" linkTo="/parent/attendance-calendar/academic-calendar">
      <ul className="flex flex-col gap-3.5">
        {events.slice(0, 5).map((event) => {
          const colors = EVENT_TYPE_COLORS[event.type];
          return (
            <li key={event.id} className="flex items-center gap-3">
              <div
                className="flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5"
                style={{ background: colors.bg, color: colors.text }}
              >
                <span className="text-[15px] font-extrabold leading-none">{event.day}</span>
                <span className="mt-0.5 text-[9.5px] font-bold leading-none tracking-wide">{event.month}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{event.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280]">{event.timeLabel}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
