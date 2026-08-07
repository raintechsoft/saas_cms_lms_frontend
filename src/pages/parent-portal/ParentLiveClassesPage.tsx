import { useMemo } from "react";
import { VideocamOutlined } from "@mui/icons-material";
import { PORTAL_WEEKDAYS } from "../student-parent/portalTypes";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

function formatTime(value: string) {
  if (/[ap]m/i.test(value)) return value;
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function todayWeekdayKey() {
  return PORTAL_WEEKDAYS[(new Date().getDay() + 6) % 7];
}

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(value: string) {
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw.slice(0, 2));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function ParentLiveClassesPage() {
  const { activeChild, portalChild } = useParentPortal();
  const today = todayWeekdayKey();
  const now = minutesNow();

  const sessions = useMemo(() => {
    return (portalChild?.timetable ?? [])
      .filter((item) => item.weekday === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((item) => {
        const start = toMinutes(item.startTime);
        const end = toMinutes(item.endTime);
        let status: "Live" | "Upcoming" | "Ended" = "Upcoming";
        if (now >= end) status = "Ended";
        else if (now >= start) status = "Live";
        return { ...item, status };
      });
  }, [portalChild?.timetable, today, now]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Live Classes"
        subtitle={`Today's periods for ${activeChild.name}. Join links appear when the school enables live sessions.`}
      />

      <section
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Today</h2>
        </div>
        {sessions.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">
            No timetable periods for today. Live class links are not available yet from the backend.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: PARENT_BORDER }}>
            {sessions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                >
                  <VideocamOutlined sx={{ fontSize: 20 }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#1A1A2E]">{item.subject}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    {formatTime(item.startTime)} – {formatTime(item.endTime)}
                    {item.teacher ? ` · ${item.teacher}` : ""}
                  </p>
                </div>
                <StatusChip
                  label={item.status}
                  tone={item.status === "Live" ? "green" : item.status === "Ended" ? "blue" : "orange"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
