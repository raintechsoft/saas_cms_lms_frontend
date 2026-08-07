import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { PORTAL_WEEKDAYS, type PortalTimetableItem } from "../student-parent/portalTypes";
import { PageHeader } from "./components/PageHeader";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

const DAY_TABS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

function formatTime(value: string) {
  if (/[ap]m/i.test(value)) return value;
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function dayLabel(day: string) {
  return day[0] + day.slice(1).toLowerCase();
}

function todayWeekdayKey() {
  return PORTAL_WEEKDAYS[(new Date().getDay() + 6) % 7];
}

export function ParentSubjectsTimetablePage() {
  const { activeChild, portalChild, accessToken, productMode } = useParentPortal();
  const showLms = isProductBucketAllowed(productMode, "LMS");
  const studentId = portalChild?.student.id;
  const [entries, setEntries] = useState<PortalTimetableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState<string>(() => {
    const today = todayWeekdayKey();
    return DAY_TABS.includes(today as (typeof DAY_TABS)[number]) ? today : "MONDAY";
  });

  useEffect(() => {
    if (!studentId || !showLms) {
      setLoading(false);
      setEntries(portalChild?.timetable ?? []);
      return;
    }
    setLoading(true);
    setError("");
    apiRequest<PortalTimetableItem[]>(`/portal/children/${studentId}/timetable`, accessToken)
      .then((data) => setEntries(data ?? []))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load timetable");
        setEntries(portalChild?.timetable ?? []);
      })
      .finally(() => setLoading(false));
  }, [accessToken, studentId, showLms, portalChild?.timetable]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((item) => item.weekday === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [entries, day],
  );

  const subjects = useMemo(() => {
    const map = new Map<string, { subject: string; teacher: string | null; count: number }>();
    for (const item of entries) {
      const current = map.get(item.subject) ?? {
        subject: item.subject,
        teacher: item.teacher,
        count: 0,
      };
      current.count += 1;
      if (!current.teacher && item.teacher) current.teacher = item.teacher;
      map.set(item.subject, current);
    }
    return [...map.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  }, [entries]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Subjects & Timetable"
        subtitle={`Weekly schedule for ${activeChild.name} · ${activeChild.className} - ${activeChild.section}`}
      />

      {!showLms && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Timetable is available when the school has LMS enabled. Showing any overview data if present.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {DAY_TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setDay(key)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-bold transition"
            style={{
              background: day === key ? PARENT_PRIMARY : PARENT_PRIMARY_SUBTLE,
              color: day === key ? "#fff" : PARENT_PRIMARY,
            }}
          >
            {dayLabel(key)}
          </button>
        ))}
      </div>

      <section
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">{dayLabel(day)} timetable</h2>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">Loading timetable…</p>
        ) : dayEntries.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No periods for this day.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: PARENT_BORDER }}>
            {dayEntries.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-[120px] text-[12px] font-bold text-[#4F46E5]">
                  {formatTime(item.startTime)} – {formatTime(item.endTime)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[#1A1A2E]">{item.subject}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    {item.teacher ?? "Teacher TBA"}
                    {item.room ? ` · ${item.room}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="mb-3 text-[15px] font-bold text-[#1A1A2E]">Subjects this week</h2>
        {subjects.length === 0 ? (
          <p className="text-[13px] text-[#6B7280]">No subjects found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((item) => (
              <div
                key={item.subject}
                className="rounded-xl border px-4 py-3"
                style={{ borderColor: PARENT_BORDER, background: PARENT_PRIMARY_SUBTLE }}
              >
                <p className="text-[13px] font-bold text-[#1A1A2E]">{item.subject}</p>
                <p className="mt-0.5 text-[12px] text-[#6B7280]">
                  {item.teacher ?? "—"} · {item.count} period{item.count === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
