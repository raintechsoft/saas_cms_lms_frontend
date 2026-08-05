import { CampaignOutlined, CelebrationOutlined, EventBusyOutlined, ScienceOutlined } from "@mui/icons-material";
import type { Announcement, AnnouncementTag } from "../types";
import { SectionCard } from "./SectionCard";

const TAG_STYLES: Record<AnnouncementTag, { bg: string; text: string }> = {
  New: { bg: "#FEE2E2", text: "#DC2626" },
  Holiday: { bg: "#DBEAFE", text: "#2563EB" },
  Event: { bg: "#FFEDD5", text: "#EA580C" },
  Notice: { bg: "#EEF2FF", text: "#4F46E5" },
};

const TAG_ICON: Record<AnnouncementTag, typeof CampaignOutlined> = {
  New: CelebrationOutlined,
  Holiday: EventBusyOutlined,
  Event: ScienceOutlined,
  Notice: CampaignOutlined,
};

export function AnnouncementsCard({ announcements }: { announcements: Announcement[] }) {
  return (
    <SectionCard title="Announcements" linkLabel="View All" linkTo="/parent/communication/announcements">
      <ul className="flex flex-col gap-3.5">
        {announcements.map((item) => {
          const Icon = TAG_ICON[item.tag];
          const tagStyle = TAG_STYLES[item.tag];
          return (
            <li key={item.id} className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: tagStyle.bg }}>
                <Icon sx={{ fontSize: 18, color: tagStyle.text }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[#1A1A2E]">{item.title}</p>
                <p className="mt-0.5 line-clamp-1 text-[11.5px] text-[#6B7280]">{item.description}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11.5px] text-[#6B7280]">{item.date}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: tagStyle.bg, color: tagStyle.text }}
                  >
                    {item.tag}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
