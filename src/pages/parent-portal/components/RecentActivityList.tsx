import { ArrowForwardRounded, ScheduleOutlined } from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { ActivityItem } from "../types";
import { PARENT_BORDER } from "../ParentPortalLayout";
import { ACTIVITY_STATUS_COLORS, ACTIVITY_STATUS_ICON } from "./activityStyles";

export function RecentActivityList({ activity }: { activity: ActivityItem[] }) {
  return (
    <section
      className="rounded-2xl border bg-white shadow-[0_2px_12px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="text-[14px] font-bold text-[#111827]">Recent Activity</h2>
        <Link
          to="/parent/activity"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4F46E5] hover:underline"
        >
          View all
          <ArrowForwardRounded sx={{ fontSize: 14 }} />
        </Link>
      </div>

      {activity.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12.5px] text-[#9CA3AF]">No recent activity yet.</p>
      ) : (
        <ul className="divide-y px-2" style={{ borderColor: PARENT_BORDER }}>
          {activity.slice(0, 6).map((item) => {
            const colors = ACTIVITY_STATUS_COLORS[item.status];
            const Icon = ACTIVITY_STATUS_ICON[item.status];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-2 py-3"
                style={{ borderColor: PARENT_BORDER }}
              >
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: colors.bg }}
                >
                  <Icon sx={{ fontSize: 16, color: colors.text }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#111827]">{item.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">{item.description}</p>
                </div>
                <span
                  className="hidden shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold sm:inline-flex"
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
      )}
    </section>
  );
}
