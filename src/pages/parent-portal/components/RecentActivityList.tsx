import { ArrowForwardRounded, ScheduleOutlined } from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { ActivityItem } from "../types";
import { PARENT_BORDER } from "../ParentPortalLayout";
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_ICON } from "./activityStyles";

export function RecentActivityList({ activity }: { activity: ActivityItem[] }) {
  return (
    <div
      className="flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-4"
      style={{ borderColor: PARENT_BORDER }}
    >
      <h2 className="mb-2.5 text-[14px] font-bold text-[#1A1A2E]">Recent Activity</h2>

      <ul className="flex flex-col divide-y" style={{ borderColor: PARENT_BORDER }}>
        {activity.map((item) => {
          const colors = ACTIVITY_STATUS_COLORS[item.status];
          const Icon = ACTIVITY_STATUS_ICON[item.status];
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-2.5 py-2.5 first:pt-0 last:pb-0" style={{ borderColor: PARENT_BORDER }}>
              <div className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ background: colors.bg }}>
                <Icon sx={{ fontSize: 16, color: colors.text }} />
              </div>
              <div className="min-w-[140px] flex-1">
                <p className="text-[13px] font-semibold text-[#1A1A2E]">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] text-[#6B7280]">{item.description}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={{ background: colors.bg, color: colors.text }}
              >
                {item.status}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#9CA3AF]">
                <ScheduleOutlined sx={{ fontSize: 13 }} />
                {item.timeAgo}
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        to="/parent/activity"
        className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#4F46E5] hover:underline"
      >
        View All Activity
        <ArrowForwardRounded sx={{ fontSize: 16 }} />
      </Link>
    </div>
  );
}
