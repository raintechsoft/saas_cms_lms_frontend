import { useMemo, useState } from "react";
import {
  AppsRounded,
  CallEndRounded,
  DownloadRounded,
  MicNoneRounded,
  NotificationsNoneRounded,
  NotificationsActiveRounded,
  PanToolOutlined,
  ScreenShareOutlined,
  VideocamOffOutlined,
  VideocamRounded,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import { PORTAL_WEEKDAYS, type PortalTimetableItem } from "./portalTypes";

const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";

type LiveStatus = "LIVE" | "UPCOMING";

type LiveSession = {
  id: string;
  time: string;
  startMinutes: number;
  subject: string;
  topic: string;
  teacher: string;
  teacherInitials: string;
  color: string;
  status: LiveStatus;
  studentsJoined?: number;
  studentsTotal?: number;
  durationLabel?: string;
};

type Recording = {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  when: string;
  duration: string;
  color: string;
};

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER, ...style }}
    >
      {children}
    </section>
  );
}

function subjectMeta(subject: string) {
  const key = subject.toLowerCase();
  if (key.includes("math")) return { color: "#10B981", glyph: "∑" };
  if (key.includes("sci") || key.includes("chem") || key.includes("phy") || key.includes("bio"))
    return { color: "#3B82F6", glyph: "Sc" };
  if (key.includes("eng")) return { color: "#F59E0B", glyph: "En" };
  if (key.includes("social") || key.includes("history") || key.includes("geo") || key.includes("civ"))
    return { color: "#6366F1", glyph: "SS" };
  if (key.includes("hindi") || key.includes("हि")) return { color: "#059669", glyph: "अ" };
  if (key.includes("comp") || key.includes("it")) return { color: "#06B6D4", glyph: "IT" };
  return { color: PRIMARY, glyph: subject.slice(0, 2).toUpperCase() };
}

function initials(name: string) {
  const parts = name.replace(/^(Mr\.|Ms\.|Mrs\.)\s*/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatTime(value: string) {
  if (/[ap]m/i.test(value)) return value;
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function timeToMinutes(value: string) {
  const ampm = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw.slice(0, 2));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function todayWeekdayKey() {
  return PORTAL_WEEKDAYS[(new Date().getDay() + 6) % 7];
}

const DEMO_SESSIONS: LiveSession[] = [
  {
    id: "live-math",
    time: "09:00 AM",
    startMinutes: 9 * 60,
    subject: "Mathematics",
    topic: "Pythagoras Theorem",
    teacher: "Mr. Anil Sharma",
    teacherInitials: "AS",
    color: "#10B981",
    status: "LIVE",
    studentsJoined: 45,
    studentsTotal: 50,
    durationLabel: "45:32",
  },
  {
    id: "sci",
    time: "11:00 AM",
    startMinutes: 11 * 60,
    subject: "Science",
    topic: "Chemical Reactions and Equations",
    teacher: "Ms. Priya Nair",
    teacherInitials: "PN",
    color: "#3B82F6",
    status: "UPCOMING",
  },
  {
    id: "eng",
    time: "02:00 PM",
    startMinutes: 14 * 60,
    subject: "English",
    topic: "Report Writing Format and Examples",
    teacher: "Mr. Rohan Das",
    teacherInitials: "RD",
    color: "#F59E0B",
    status: "UPCOMING",
  },
  {
    id: "sst",
    time: "04:00 PM",
    startMinutes: 16 * 60,
    subject: "Social Science",
    topic: "The Indian Constitution Fundamental Rights",
    teacher: "Mr. Vivek Singh",
    teacherInitials: "VS",
    color: "#6366F1",
    status: "UPCOMING",
  },
  {
    id: "hin",
    time: "06:00 PM",
    startMinutes: 18 * 60,
    subject: "Hindi",
    topic: "अपठित गद्यांश और कविता",
    teacher: "Ms. Kavita Joshi",
    teacherInitials: "KJ",
    color: "#059669",
    status: "UPCOMING",
  },
];

const DEMO_RECORDINGS: Recording[] = [
  {
    id: "r1",
    subject: "Mathematics",
    topic: "Quadratic Equations — Completing the Square",
    teacher: "Mr. Anil Sharma",
    when: "Today · 08:00 AM",
    duration: "45 min",
    color: "#10B981",
  },
  {
    id: "r2",
    subject: "Science",
    topic: "Acids, Bases and Salts",
    teacher: "Ms. Priya Nair",
    when: "Yesterday · 11:00 AM",
    duration: "52 min",
    color: "#3B82F6",
  },
  {
    id: "r3",
    subject: "English",
    topic: "Letter Writing — Formal Tone",
    teacher: "Mr. Rohan Das",
    when: "28 May 2025 · 02:00 PM",
    duration: "38 min",
    color: "#F59E0B",
  },
  {
    id: "r4",
    subject: "Social Science",
    topic: "Nationalism in India",
    teacher: "Mr. Vivek Singh",
    when: "27 May 2025 · 04:00 PM",
    duration: "41 min",
    color: "#6366F1",
  },
];

const TOPIC_HINTS: Record<string, string> = {
  Mathematics: "Pythagoras Theorem",
  Science: "Chemical Reactions and Equations",
  English: "Report Writing Format and Examples",
  "Social Science": "The Indian Constitution Fundamental Rights",
  Hindi: "अपठित गद्यांश और कविता",
};

function sessionsFromTimetable(entries: PortalTimetableItem[]): LiveSession[] | null {
  const today = todayWeekdayKey();
  const dayEntries = entries
    .filter((e) => e.weekday === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (dayEntries.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return dayEntries.map((entry) => {
    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    const isLive = nowMinutes >= start && nowMinutes < end;
    const meta = subjectMeta(entry.subject);
    const teacher = entry.teacher ?? "Teacher";
    return {
      id: entry.id,
      time: formatTime(entry.startTime),
      startMinutes: start,
      subject: entry.subject,
      topic: TOPIC_HINTS[entry.subject] ?? `${entry.subject} Live Session`,
      teacher,
      teacherInitials: initials(teacher),
      color: meta.color,
      status: (isLive ? "LIVE" : "UPCOMING") as LiveStatus,
      studentsJoined: isLive ? 45 : undefined,
      studentsTotal: isLive ? 50 : undefined,
      durationLabel: isLive ? "45:32" : undefined,
    };
  });
}

function BlackboardPreview({ topic }: { topic: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1B2430]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(83,74,183,0.45), transparent 45%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.2), transparent 40%)",
        }}
      />
      <div className="relative flex min-h-[200px] flex-col justify-between p-4 sm:min-h-[220px]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
          <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
            45:32
          </span>
        </div>

        <div className="mx-auto my-4 w-full max-w-[280px] rounded-xl border border-white/10 bg-[#243041]/90 px-4 py-5 text-center shadow-inner">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">Board</p>
          <p className="mt-2 font-serif text-[22px] font-semibold tracking-wide text-[#E8F0E4]">
            a² + b² = c²
          </p>
          <p className="mt-2 text-[12px] text-white/55">{topic}</p>
          <svg viewBox="0 0 120 70" className="mx-auto mt-3 h-14 w-28 text-emerald-200/80" fill="none">
            <path d="M18 58 L18 18 L92 58 Z" stroke="currentColor" strokeWidth="2" />
            <path d="M18 48 H28 V58" stroke="currentColor" strokeWidth="1.5" />
            <text x="8" y="40" fill="currentColor" fontSize="10">
              a
            </text>
            <text x="50" y="66" fill="currentColor" fontSize="10">
              b
            </text>
            <text x="58" y="34" fill="currentColor" fontSize="10">
              c
            </text>
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {[
            { Icon: MicNoneRounded, label: "Mute" },
            { Icon: VideocamOffOutlined, label: "Camera" },
            { Icon: ScreenShareOutlined, label: "Share" },
            { Icon: PanToolOutlined, label: "Hand" },
            { Icon: AppsRounded, label: "More" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              type="button"
              title={label}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white/90 transition hover:bg-white/20"
            >
              <Icon sx={{ fontSize: 18 }} />
            </button>
          ))}
          <button
            type="button"
            title="Leave"
            className="grid size-9 place-items-center rounded-full bg-[#EF4444] text-white transition hover:bg-[#DC2626]"
          >
            <CallEndRounded sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortalLiveClassesPage() {
  const { child, basePath, productMode } = usePortal();
  const [classCode, setClassCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllRecordings, setShowAllRecordings] = useState(false);
  const showLms = isProductBucketAllowed(productMode, "LMS");

  const sessions = useMemo(() => {
    const fromTt = child?.timetable?.length ? sessionsFromTimetable(child.timetable) : null;
    if (fromTt && fromTt.length > 0) return fromTt;
    return DEMO_SESSIONS;
  }, [child?.timetable]);

  const live = sessions.find((s) => s.status === "LIVE") ?? null;
  const todayList = sessions.slice(0, 4);
  const upcoming = sessions.filter((s) => s.status === "UPCOMING");
  const upcomingVisible = showAllUpcoming ? upcoming : upcoming.slice(0, 4);
  const recordingsVisible = showAllRecordings ? DEMO_RECORDINGS : DEMO_RECORDINGS.slice(0, 4);

  const usingDemo = !(child?.timetable?.length && sessionsFromTimetable(child.timetable));

  function handleJoinCode(event: React.FormEvent) {
    event.preventDefault();
    const code = classCode.trim().replace(/^#/, "");
    if (!code) {
      setJoinMessage("Enter a class code from your teacher.");
      return;
    }
    setJoinMessage(`Class code “${code}” saved — join link will open when live classes are connected.`);
    setClassCode("");
  }

  function toggleReminder(id: string) {
    setReminders((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!showLms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Live Classes</h1>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          <Link to={basePath} className="hover:text-[#6B7280]">
            Dashboard
          </Link>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-[#6B7280]">Live Classes</span>
        </p>
        {usingDemo ? (
          <p className="mt-2 text-[11px] font-medium text-[#9CA3AF]">
            Preview schedule — will sync with live sessions when the LMS module is connected.
          </p>
        ) : null}
        {joinMessage ? (
          <p className="mt-2 rounded-xl border border-[#EEF0FD] bg-[#EEF0FD]/70 px-3 py-2 text-[12px] font-medium text-[#534AB7]">
            {joinMessage}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(260px,0.75fr)]">
        <Card className="!p-4 sm:!p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">Ongoing Live Class</h2>
            {live ? (
              <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#DC2626]">
                Live
              </span>
            ) : (
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">
                Idle
              </span>
            )}
          </div>

          {live ? (
            <>
              <BlackboardPreview topic={live.topic} />
              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-bold text-[#1A1A1A]">
                    {live.subject} — {live.topic}
                  </p>
                  <p className="mt-1 text-[12px] text-[#6B7280]">{live.teacher}</p>
                </div>
                {live.studentsJoined != null && live.studentsTotal != null ? (
                  <p className="text-[12px] font-semibold text-[#9CA3AF]">
                    {live.studentsJoined} / {live.studentsTotal} Students
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold text-white transition hover:opacity-95"
                style={{ background: PRIMARY }}
                onClick={() => setJoinMessage("Join link will open when live streaming is connected.")}
              >
                <VideocamRounded sx={{ fontSize: 20 }} />
                Join Class Now
              </button>
            </>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl bg-[#F6F7F9] px-6 text-center">
              <span className="grid size-14 place-items-center rounded-2xl bg-white text-[#534AB7] shadow-sm">
                <VideocamRounded sx={{ fontSize: 28 }} />
              </span>
              <p className="mt-4 text-[15px] font-bold text-[#1A1A1A]">No class is live right now</p>
              <p className="mt-1 text-[12px] text-[#6B7280]">
                Check today’s schedule below or join with a class code.
              </p>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">Today&apos;s Schedule</h2>
            <Link to={`${basePath}/timetable`} className="text-[12px] font-bold text-[#534AB7] hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {todayList.map((session) => {
              const liveNow = session.status === "LIVE";
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#F1F2F6] bg-[#FBFBFC] px-3 py-3"
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-[12px] font-bold" style={{ color: session.color }}>
                      {session.time.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-semibold text-[#9CA3AF]">{session.time.split(" ")[1]}</p>
                  </div>
                  <span className="h-10 w-0.5 rounded-full" style={{ background: session.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{session.subject}</p>
                    <p className="truncate text-[11px] text-[#9CA3AF]">
                      {session.topic} · {session.teacher}
                    </p>
                  </div>
                  {liveNow ? (
                    <span className="shrink-0 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-bold text-[#059669]">
                      Live Now
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#EEF0FD] px-2.5 py-1 text-[10px] font-bold text-[#534AB7]">
                      Upcoming
                    </span>
                  )}
                </div>
              );
            })}
            {todayList.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#6B7280]">No live classes scheduled today.</p>
            ) : null}
          </div>
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Join with Class Code</h2>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="relative mb-4">
              <div
                className="flex h-[88px] w-[120px] items-end justify-center rounded-xl border-2 border-[#534AB7]/25 bg-gradient-to-b from-[#EEF0FD] to-white pb-2 shadow-sm"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#534AB7] text-white">
                  <VideocamRounded sx={{ fontSize: 20 }} />
                </span>
              </div>
              <span className="absolute -bottom-1 left-1/2 h-2 w-16 -translate-x-1/2 rounded-full bg-[#534AB7]/15" />
            </div>
            <p className="max-w-[220px] text-[12px] leading-relaxed text-[#6B7280]">
              Enter the class code provided by your teacher to join instantly.
            </p>
            <form className="mt-4 w-full space-y-3" onSubmit={handleJoinCode}>
              <label className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 focus-within:border-[#534AB7] focus-within:bg-white">
                <span className="text-[14px] font-bold text-[#9CA3AF]">#</span>
                <input
                  value={classCode}
                  onChange={(e) => {
                    setClassCode(e.target.value);
                    setJoinMessage("");
                  }}
                  placeholder="Enter class code"
                  className="w-full bg-transparent text-[13px] font-semibold text-[#1A1A1A] outline-none placeholder:font-medium placeholder:text-[#9CA3AF]"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition hover:opacity-95"
                style={{ background: PRIMARY }}
              >
                Join Class →
              </button>
            </form>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">Upcoming Live Classes</h2>
            <button
              type="button"
              className="text-[12px] font-bold text-[#534AB7] hover:underline"
              onClick={() => setShowAllUpcoming((v) => !v)}
            >
              {showAllUpcoming ? "Show Less" : "View All"}
            </button>
          </div>
          {upcomingVisible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No upcoming live classes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-5 py-3 font-semibold">Time</th>
                    <th className="px-5 py-3 font-semibold">Subject</th>
                    <th className="px-5 py-3 font-semibold">Topic</th>
                    <th className="px-5 py-3 font-semibold">Teacher</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingVisible.map((session) => {
                    const meta = subjectMeta(session.subject);
                    const reminded = Boolean(reminders[session.id]);
                    return (
                      <tr key={session.id} className="border-b border-[#F1F2F6] last:border-0">
                        <td className="px-5 py-3.5 font-bold text-[#1A1A1A]">{session.time}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-2 font-semibold text-[#1A1A1A]">
                            <span
                              className="grid size-8 place-items-center rounded-xl text-[12px] font-bold text-white"
                              style={{ background: session.color || meta.color }}
                            >
                              {meta.glyph}
                            </span>
                            {session.subject}
                          </span>
                        </td>
                        <td className="max-w-[220px] px-5 py-3.5 text-[#6B7280]">
                          <span className="line-clamp-2">{session.topic}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="grid size-8 place-items-center rounded-full text-[11px] font-bold text-white"
                              style={{ background: PRIMARY }}
                            >
                              {session.teacherInitials}
                            </span>
                            <span className="font-semibold text-[#1A1A1A]">{session.teacher}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleReminder(session.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition ${
                              reminded
                                ? "border-[#534AB7] bg-[#EEF0FD] text-[#534AB7]"
                                : "border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F6F7F9]"
                            }`}
                          >
                            {reminded ? (
                              <NotificationsActiveRounded sx={{ fontSize: 16 }} />
                            ) : (
                              <NotificationsNoneRounded sx={{ fontSize: 16 }} />
                            )}
                            {reminded ? "Set" : "Reminder"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">Recent Recordings</h2>
            <button
              type="button"
              className="text-[12px] font-bold text-[#534AB7] hover:underline"
              onClick={() => setShowAllRecordings((v) => !v)}
            >
              {showAllRecordings ? "Show Less" : "View All"}
            </button>
          </div>
          <div className="space-y-3">
            {recordingsVisible.map((rec) => {
              const meta = subjectMeta(rec.subject);
              return (
                <div
                  key={rec.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#F1F2F6] bg-[#FBFBFC] p-2.5"
                >
                  <div
                    className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl text-white"
                    style={{ background: `linear-gradient(145deg, ${rec.color} 0%, #1B2430 120%)` }}
                  >
                    <span className="text-[14px] font-bold">{meta.glyph}</span>
                    <span className="absolute inset-0 grid place-items-center bg-black/25">
                      <VideocamRounded sx={{ fontSize: 18, color: "white" }} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{rec.topic}</p>
                    <p className="truncate text-[11px] text-[#9CA3AF]">
                      {rec.subject} · {rec.teacher}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-[#B0B5C0]">
                      {rec.when} · {rec.duration}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Download recording"
                    className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:bg-[#EEF0FD] hover:text-[#534AB7]"
                    onClick={() =>
                      setJoinMessage("Recording download will be available when LMS storage is connected.")
                    }
                  >
                    <DownloadRounded sx={{ fontSize: 18 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
