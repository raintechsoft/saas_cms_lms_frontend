import type { ActivityItem } from "../types";
import { SectionCard } from "./SectionCard";
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_ICON } from "./activityStyles";

export function RecentActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <SectionCard title="Recent Activity" linkLabel="View All" linkTo="/parent/activity">
      <ul className="flex flex-col gap-3.5">
        {activity.slice(0, 3).map((item) => {
          const colors = ACTIVITY_STATUS_COLORS[item.status];
          const Icon = ACTIVITY_STATUS_ICON[item.status];
          return (
            <li key={item.id} className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: colors.bg }}>
                <Icon sx={{ fontSize: 18, color: colors.text }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{item.title}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280]">{item.description}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-[11px] text-[#9CA3AF]">{item.timeAgo}</span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
