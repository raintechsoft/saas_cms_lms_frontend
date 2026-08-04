import { useMemo, useState } from "react";
import {
  AddRounded,
  ArrowForwardRounded,
  AssignmentOutlined,
  CalendarMonthOutlined,
  CampaignOutlined,
  HeadphonesOutlined,
  InfoOutlined,
  PaymentsOutlined,
  QuizOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import { PORTAL_WEEKDAYS } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";
const SUBTLE = "#9CA3AF";

function timeAgo(iso: string) {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(deltaMs / 60000);
  if (min < 60) return `${Math.max(min, 0)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatTime(value: string) {
  // Accept "08:00" or "08:00:00" → "08:00 AM"
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`} style={{ borderColor: BORDER }}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-[#1A1A1A]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ViewAllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="text-[12px] font-bold hover:underline" style={{ color: PRIMARY }}>
      View All
    </Link>
  );
}

/** Soft “3D” icon tile matching the landing mock */
function ActionIcon({
  tone,
  children,
}: {
  tone: "violet" | "amber" | "rose" | "sky";
  children: React.ReactNode;
}) {
  const tones = {
    violet: "from-[#E8E7FF] to-[#D4D2FF] text-[#534AB7]",
    amber: "from-[#FFF3D6] to-[#FFE2A8] text-[#D97706]",
    rose: "from-[#FFE4EC] to-[#FFC9D8] text-[#E11D48]",
    sky: "from-[#E0F2FE] to-[#BAE6FD] text-[#0284C7]",
  } as const;
  return (
    <div
      className={`relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br shadow-[0_8px_16px_rgba(83,74,183,0.12)] ${tones[tone]}`}
    >
      <div className="absolute inset-x-2 top-1 h-3 rounded-full bg-white/50 blur-[1px]" />
      {children}
    </div>
  );
}

function ActionCard({
  to,
  title,
  subtitle,
  tone,
  icon,
}: {
  to: string;
  title: string;
  subtitle: string;
  tone: "violet" | "amber" | "rose" | "sky";
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(28,27,60,0.08)]"
      style={{ borderColor: BORDER }}
    >
      <ActionIcon tone={tone}>{icon}</ActionIcon>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{title}</p>
        <p className="truncate text-[11px] text-[#6B7280]">{subtitle}</p>
      </div>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-white transition group-hover:scale-105"
        style={{ background: PRIMARY }}
      >
        <ArrowForwardRounded sx={{ fontSize: 16 }} />
      </span>
    </Link>
  );
}

function ProgressRing({
  pct,
  label,
  color,
}: {
  pct: number;
  label: string;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-[88px]">
        <svg className="size-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
          <circle cx="44" cy="44" r={r} fill="none" stroke="#F1F2F6" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-[15px] font-bold text-[#1A1A1A]">{clamped}%</span>
        </div>
      </div>
      <p className="max-w-[96px] text-center text-[11px] font-semibold leading-tight text-[#6B7280]">{label}</p>
    </div>
  );
}

function statusTone(status: string): { bg: string; fg: string; label: string } {
  switch (status) {
    case "SUBMITTED":
    case "EVALUATED":
    case "COMPLETED":
      return { bg: "#ECFDF5", fg: "#059669", label: "In Progress" };
    case "RESUBMIT_REQUESTED":
      return { bg: "#FFF7ED", fg: "#D97706", label: "Pending" };
    default:
      return { bg: "#F3F4F6", fg: "#6B7280", label: "Not Started" };
  }
}

function subjectTone(subject: string) {
  const key = subject.toLowerCase();
  if (key.includes("math")) return { bg: "#EEF0FD", fg: PRIMARY };
  if (key.includes("sci") || key.includes("physics") || key.includes("chem") || key.includes("bio"))
    return { bg: "#ECFDF5", fg: "#059669" };
  if (key.includes("eng")) return { bg: "#FFF7ED", fg: "#D97706" };
  if (key.includes("hist") || key.includes("social")) return { bg: "#FEF2F2", fg: "#E11D48" };
  return { bg: PRIMARY_SOFT, fg: PRIMARY };
}

function AttendanceCalendar({
  recent,
}: {
  recent: Array<{ date: string; status: string }>;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of recent) {
      const key = row.date.slice(0, 10);
      if (!map.has(key)) map.set(key, row.status);
    }
    return map;
  }, [recent]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstDow = new Date(year, month, 1).getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: Array<{ day: number | null; key?: string; status?: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key, status: byDate.get(key) });
  }

  function dotColor(status?: string) {
    if (!status) return null;
    const s = status.toUpperCase();
    if (s === "PRESENT" || s === "HALF_DAY") return "#10B981";
    if (s === "ABSENT") return "#EF4444";
    if (s === "LATE") return "#F59E0B";
    if (s === "HOLIDAY") return PRIMARY;
    return SUBTLE;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="text-[13px] font-bold text-[#1A1A1A]">{monthLabel}</p>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#9CA3AF]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell.day == null) return <span key={`e-${idx}`} className="h-8" />;
          const isToday = cell.key === todayKey;
          const color = dotColor(cell.status);
          return (
            <div key={cell.key} className="flex h-8 flex-col items-center justify-center gap-0.5">
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold ${
                  isToday ? "text-white" : "text-[#1A1A1A]"
                }`}
                style={isToday ? { background: PRIMARY } : undefined}
              >
                {cell.day}
              </span>
              {color ? <span className="size-1 rounded-full" style={{ background: color }} /> : <span className="size-1" />}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-medium text-[#6B7280]">
        {[
          { label: "Present", color: "#10B981" },
          { label: "Absent", color: "#EF4444" },
          { label: "Late", color: "#F59E0B" },
          { label: "Holiday", color: PRIMARY },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function noticeIcon(title: string, audience: string) {
  const hay = `${title} ${audience}`.toLowerCase();
  if (hay.includes("fee") || hay.includes("payment") || hay.includes("₹") || hay.includes("rs")) {
    return { bg: "#FEF2F2", fg: "#E11D48", Icon: PaymentsOutlined };
  }
  if (hay.includes("homework") || hay.includes("assignment")) {
    return { bg: "#FFFBEB", fg: "#D97706", Icon: AssignmentOutlined };
  }
  if (hay.includes("exam") || hay.includes("test") || hay.includes("result")) {
    return { bg: PRIMARY_SOFT, fg: PRIMARY, Icon: QuizOutlined };
  }
  if (hay.includes("holiday") || hay.includes("closed") || hay.includes("circular")) {
    return { bg: "#F3F4F6", fg: "#6B7280", Icon: InfoOutlined };
  }
  return { bg: PRIMARY_SOFT, fg: PRIMARY, Icon: CampaignOutlined };
}

function homeworkProgress(item: {
  submission: { status: string } | null;
  submissionDate: string;
}) {
  if (!item.submission) return 0;
  if (item.submission.status === "EVALUATED" || item.submission.status === "COMPLETED") return 100;
  if (item.submission.status === "SUBMITTED") return 75;
  if (item.submission.status === "RESUBMIT_REQUESTED") return 40;
  return 15;
}

export function PortalHomePage() {
  const { child, overview, role, productMode, basePath } = usePortal();
  const showCms = isProductBucketAllowed(productMode, "CMS");
  const showLms = isProductBucketAllowed(productMode, "LMS");

  if (!child || !overview) {
    return (
      <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No student profile linked to this account.
      </div>
    );
  }

  const { student, enrollment, attendance, fees, homework, exams, timetable } = child;
  const presentPct = attendance.summary?.percentage ?? 0;
  const feesPaidPct = fees && fees.totals.base > 0 ? Math.round((fees.totals.paid / fees.totals.base) * 100) : 0;
  const syllabusPct = exams.length
    ? Math.round(exams.reduce((sum, exam) => sum + exam.percentage, 0) / exams.length)
    : Math.min(100, Math.round(presentPct * 0.9 + 8));

  const todayKey = PORTAL_WEEKDAYS[(new Date().getDay() + 6) % 7];
  const todaysClasses = [...timetable]
    .filter((item) => item.weekday === todayKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const upcomingHomework = [...homework]
    .sort((a, b) => new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime())
    .slice(0, 4);

  const barTones = [PRIMARY, "#10B981", "#E11D48", "#D97706", "#0284C7"];

  const dueInstallment =
    fees?.items.find((item) => item.balance > 0)?.name ??
    (fees && fees.totals.balance > 0 ? "Next installment" : null);

  return (
    <div className="flex min-h-full flex-col gap-5">
      {/* Greeting + shortcuts */}
      <section className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex w-full flex-col justify-center xl:w-[220px] xl:shrink-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#1A1A1A]">
            Hi, {student.firstName}! 👋
          </h1>
          <p className="mt-1.5 text-[13px] leading-snug text-[#6B7280]">
            {role === "PARENT"
              ? `Here's what's happening with ${student.firstName} today.`
              : "Here's what's happening in your learning journey today."}
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <button
            type="button"
            className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-[20px] border border-dashed border-[#C7C9D9] bg-white/60 text-[#9CA3AF] transition hover:border-[#534AB7] hover:text-[#534AB7]"
            title="Customize dashboard shortcuts"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#F6F7F9]">
              <AddRounded sx={{ fontSize: 20 }} />
            </span>
            <span className="text-[11px] font-semibold">Add Shortcut</span>
          </button>

          {showLms ? (
            <ActionCard
              to={`${basePath}/timetable`}
              title="View Timetable"
              subtitle="See today's schedule"
              tone="violet"
              icon={<CalendarMonthOutlined sx={{ fontSize: 26 }} />}
            />
          ) : (
            <ActionCard
              to={`${basePath}/attendance`}
              title="Attendance"
              subtitle="Check your attendance"
              tone="violet"
              icon={<CalendarMonthOutlined sx={{ fontSize: 26 }} />}
            />
          )}

          <ActionCard
            to={`${basePath}/homework`}
            title="Homework"
            subtitle="View & submit assignments"
            tone="amber"
            icon={<AssignmentOutlined sx={{ fontSize: 26 }} />}
          />

          {showCms ? (
            <ActionCard
              to={`${basePath}/fees`}
              title="Fee Payment"
              subtitle="Check fees & pay online"
              tone="rose"
              icon={<PaymentsOutlined sx={{ fontSize: 26 }} />}
            />
          ) : (
            <ActionCard
              to={`${basePath}/exams`}
              title="Exams"
              subtitle="Schedule & results"
              tone="rose"
              icon={<QuizOutlined sx={{ fontSize: 26 }} />}
            />
          )}

          <ActionCard
            to={`${basePath}/ai-tutor`}
            title="Ask AI Tutor"
            subtitle="Get help with your doubts"
            tone="sky"
            icon={<HeadphonesOutlined sx={{ fontSize: 26 }} />}
          />
        </div>
      </section>

      {/* Notifications · Timetable · Calendar */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Notifications" action={<ViewAllLink to={`${basePath}/notifications`} />}>
          {overview.notices.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-[#6B7280]">No notifications right now.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {overview.notices.slice(0, 4).map((notice) => {
                const { bg, fg, Icon } = noticeIcon(notice.title, notice.audience);
                return (
                  <div key={notice.id} className="flex items-start gap-3">
                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: bg, color: fg }}>
                      <Icon sx={{ fontSize: 16 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-[#1A1A1A]">{notice.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{timeAgo(notice.publishedAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Today's Timetable"
          action={
            showLms ? (
              <Link to={`${basePath}/timetable`} className="text-[12px] font-bold hover:underline" style={{ color: PRIMARY }}>
                View Full Timetable
              </Link>
            ) : null
          }
        >
          {todaysClasses.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-[#6B7280]">No classes scheduled today.</p>
          ) : (
            <div className="relative flex flex-col gap-4 pl-1">
              <span className="absolute bottom-2 left-[7px] top-2 w-[2px] rounded-full bg-[#E8E7FF]" aria-hidden />
              {todaysClasses.slice(0, 5).map((item, index) => (
                <div key={item.id} className="relative flex items-start gap-3">
                  <span
                    className="relative z-[1] mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-white shadow-sm"
                    style={{ background: barTones[index % barTones.length] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      {formatTime(item.startTime)} – {formatTime(item.endTime)}
                    </p>
                    <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{item.subject}</p>
                    <p className="truncate text-[11px] text-[#6B7280]">{item.teacher ?? "—"}</p>
                  </div>
                  {item.room ? (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                    >
                      {item.room.startsWith("Room") || item.room.startsWith("Lab") ? item.room : `Room ${item.room}`}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Calendar">
          <AttendanceCalendar recent={attendance.recent} />
        </Panel>
      </div>

      {/* Assignments · Progress · Fee CTA */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Upcoming Assignments" action={<ViewAllLink to={`${basePath}/homework`} />}>
          {upcomingHomework.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-[#6B7280]">Nothing due soon.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {upcomingHomework.map((item) => {
                const tone = subjectTone(item.subject);
                const status = statusTone(item.submission?.status ?? "");
                const pct = homeworkProgress(item);
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                      title={item.subject}
                    >
                      {item.subject.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-[#1A1A1A]">{item.title}</p>
                      <p className="text-[11px] text-[#6B7280]">
                        Due: {new Date(item.submissionDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F2F6]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PRIMARY }} />
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{ background: status.bg, color: status.fg }}
                    >
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Your Progress">
          <div className="flex items-start justify-around gap-2 py-2">
            <ProgressRing pct={presentPct} label="Attendance" color="#10B981" />
            <ProgressRing pct={fees ? feesPaidPct : 0} label="Fees Paid" color={PRIMARY} />
            <ProgressRing pct={syllabusPct} label="Syllabus Covered" color="#3B82F6" />
          </div>
        </Panel>

        {showCms ? (
          <section
            className="relative overflow-hidden rounded-[20px] p-5 text-white shadow-[0_8px_28px_rgba(83,74,183,0.28)]"
            style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #3F3A9A 100%)` }}
          >
            <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 right-8 size-24 rounded-full bg-white/10" />
            <div className="relative flex h-full min-h-[200px] flex-col">
              <div className="mb-4 flex justify-end">
                <div className="relative">
                  <div className="grid size-16 place-items-center rounded-2xl bg-white/15 shadow-inner backdrop-blur-sm">
                    <PaymentsOutlined sx={{ fontSize: 34 }} />
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-amber-300 text-[11px] font-bold text-amber-900 shadow">
                    ₹
                  </span>
                </div>
              </div>
              <p className="text-[15px] font-bold leading-snug">
                {fees && fees.totals.balance > 0
                  ? `Complete your fee payment. ${dueInstallment} is due${
                      fees.totals.balance ? ` — ₹${fees.totals.balance.toLocaleString()} pending` : ""
                    }.`
                  : "You're all caught up on fees. Keep your receipts handy anytime."}
              </p>
              {enrollment ? (
                <p className="mt-1 text-[12px] text-white/75">
                  {enrollment.className} {enrollment.section} · {enrollment.session}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <Link
                  to={`${basePath}/fees`}
                  className="inline-flex items-center gap-1 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold shadow-sm transition hover:bg-white/95"
                  style={{ color: PRIMARY }}
                >
                  Pay Now <ArrowForwardRounded sx={{ fontSize: 16 }} />
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <Panel title="Upcoming Exams" action={<ViewAllLink to={`${basePath}/exams`} />}>
            {exams.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-[#6B7280]">No exams published yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {exams.slice(0, 3).map((exam) => (
                  <div key={exam.examId} className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F7F9] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-[#1A1A1A]">{exam.examName}</p>
                      <p className="text-[11px] text-[#6B7280]">{exam.groupName}</p>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: PRIMARY }}>
                      {Math.round(exam.percentage)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-2 flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Your School Name. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 font-medium">
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Privacy Policy
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Terms of Use
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Help & Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
