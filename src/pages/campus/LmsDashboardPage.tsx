import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  AssignmentOutlined,
  CalendarMonthOutlined,
  CastForEducationOutlined,
  EventNoteOutlined,
  GroupsOutlined,
  NotificationsActiveOutlined,
  PersonOutlined,
  SchoolOutlined,
  TuneOutlined,
} from "@mui/icons-material";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CmsPage, CmsScrollBody, CmsFooter } from "../../components/cms/CmsLayout";
import { apiRequest, getDashboard, type DashboardResult } from "../../lib/api";
import { notifyError } from "../../lib/notify";

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const WEEK_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const WEEK_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
};

interface TimetableEntry {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  classSection: { id: string; academicClass: { name: string }; section: { name: string } };
  classSubject: { subject: { name: string } };
  teacher?: { firstName: string; lastName?: string | null } | null;
}

interface TimetableSetup {
  entries: TimetableEntry[];
}

interface HomeworkItem {
  id: string;
  title: string;
  status: string;
  homeworkDate: string;
  submissionDate: string;
  classSectionId: string;
  classSection: { academicClass: { name: string }; section: { name: string } };
  classSubject: { subject: { name: string } };
  _count?: { submissions: number };
}

interface HomeworkSetup {
  homework: HomeworkItem[];
  classSections: Array<{ id: string; _count?: { enrollments: number } }>;
}

interface CampusNotice {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
}

const CLASS_PERFORMANCE = [
  { name: "Class 10 - A", score: 87, color: "#22c55e" },
  { name: "Class 9 - B", score: 76, color: "#3b82f6" },
  { name: "Class 8 - A", score: 68, color: "#f59e0b" },
  { name: "Class 7 - C", score: 58, color: "#ef4444" },
];

const LIVE_GRADIENTS = [
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)",
];

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime12(value: string) {
  const [h, m] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(h ?? 0, m ?? 0, 0, 0);
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function sectionLabel(entry: { academicClass: { name: string }; section: { name: string } }) {
  return `${entry.academicClass.name} - ${entry.section.name}`;
}

function teacherName(teacher?: { firstName: string; lastName?: string | null } | null) {
  if (!teacher) return "Unassigned";
  return `${teacher.firstName} ${teacher.lastName ?? ""}`.trim();
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

type SessionStatus = "live" | "upcoming" | "done";

function sessionStatus(entry: TimetableEntry, todayKey: string, nowMinutes: number): SessionStatus {
  if (entry.weekday !== todayKey) return "upcoming";
  if (nowMinutes >= timeToMinutes(entry.startTime) && nowMinutes < timeToMinutes(entry.endTime)) return "live";
  if (nowMinutes >= timeToMinutes(entry.endTime)) return "done";
  return "upcoming";
}

function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
  trendLabel,
  footer,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  footer?: ReactNode;
}) {
  const up = trend !== undefined && trend >= 0;
  const TrendIcon = up ? ArrowUpwardRounded : ArrowDownwardRounded;
  return (
    <article className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {footer}
      </div>
      <p className="mt-3 text-[12px] font-medium text-[#6B7280]">{label}</p>
      <p className="mt-0.5 text-[26px] font-bold leading-tight text-[#1A1A1A]">{value}</p>
      {trend !== undefined && trendLabel ? (
        <p className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
          <TrendIcon sx={{ fontSize: 12 }} />
          {up ? "+" : ""}
          {trend}% <span className="font-normal text-[#9CA3AF]">{trendLabel}</span>
        </p>
      ) : null}
    </article>
  );
}

function PanelCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-[#E5E7EB] bg-white shadow-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-3">
        <h2 className="text-[14px] font-bold text-[#1A1A1A]">{title}</h2>
        {action}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function DropdownPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#6B7280]">
      {label}
      <span className="text-[10px] text-[#9CA3AF]">&#9662;</span>
    </span>
  );
}

export function LmsDashboardPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [enrollmentBySection, setEnrollmentBySection] = useState<Record<string, number>>({});
  const [notices, setNotices] = useState<CampusNotice[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        await Promise.all([
          getDashboard(accessToken).then(setDashboard).catch(() => setDashboard(null)),
          apiRequest<TimetableSetup>("/timetable/setup", accessToken)
            .then((setup) => setEntries(setup.entries ?? []))
            .catch(() => setEntries([])),
          apiRequest<HomeworkSetup>("/homework/setup", accessToken)
            .then((setup) => {
              setHomework(setup.homework ?? []);
              const map: Record<string, number> = {};
              for (const section of setup.classSections ?? []) {
                map[section.id] = section._count?.enrollments ?? 0;
              }
              setEnrollmentBySection(map);
            })
            .catch(() => setHomework([])),
          apiRequest<CampusNotice[]>("/notices", accessToken)
            .then((data) => setNotices(data.slice(0, 5)))
            .catch(() => setNotices([])),
        ]);
      } catch (cause) {
        notifyError(cause instanceof Error ? cause.message : "Unable to load LMS dashboard");
      }
    })();
  }, [accessToken]);

  const now = new Date();
  const todayKey = WEEKDAYS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayFormatted = now.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.weekday === todayKey)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [entries, todayKey],
  );

  const liveNow = todayEntries.filter((entry) => sessionStatus(entry, todayKey, nowMinutes) === "live");
  const stats = dashboard?.stats;
  const totalStudents = stats?.students ?? 0;
  const totalClasses = stats?.classSections ?? 0;
  const present = stats?.attendanceToday.present ?? 0;
  const totalAttendance = stats?.attendanceToday.total ?? 0;
  const attendanceTodayPct =
    totalAttendance > 0 ? Math.round((present / totalAttendance) * 1000) / 10 : 0;

  const pendingCount = homework.filter((item) => item.status === "PUBLISHED").length;
  const recentHomework = homework.filter((h) => h.status !== "DRAFT").slice(0, 3);

  const attendanceLineData = useMemo(() => [72, 78, 94, 88, 85, 91], []);

  const attendanceLineOptions: ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, fontFamily: "inherit", zoom: { enabled: false } },
    colors: ["#6366f1"],
    stroke: { curve: "smooth", width: 2.5 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.02, stops: [0, 90, 100] },
    },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
    xaxis: {
      categories: WEEK_ORDER.map((d) => WEEK_LABEL[d]),
      labels: { style: { colors: "#9CA3AF", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      labels: { style: { colors: "#9CA3AF", fontSize: "11px" }, formatter: (v) => `${v}%` },
    },
    tooltip: { y: { formatter: (v: number) => `${v}%` } },
    markers: { size: 4, colors: ["#6366f1"], strokeColors: "#fff", strokeWidth: 2 },
  };

  const liveClassCards =
    liveNow.length > 0
      ? liveNow.slice(0, 2)
      : todayEntries.filter((e) => sessionStatus(e, todayKey, nowMinutes) !== "done").slice(0, 2);

  if (!user) return null;

  return (
    <CmsPage>
      {/* Page header — matches mockup */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 pb-4">
        <div>
          <p className="text-[12px] text-[#6B7280]">
            Home <span className="mx-1 text-[#D1D5DB]">/</span> Dashboard
          </p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-[#1A1A1A]">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-medium text-[#374151]">
            <CalendarMonthOutlined sx={{ fontSize: 16 }} className="text-[#6B7280]" />
            {todayFormatted}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#534AB7] px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#4338a8]"
          >
            <TuneOutlined sx={{ fontSize: 16 }} />
            Customize
          </button>
        </div>
      </div>

      <CmsScrollBody>
        {/* Row 1 — 5 KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            icon={<GroupsOutlined sx={{ fontSize: 20 }} />}
            iconBg="#EEF2FF"
            iconColor="#6366f1"
            label="Total Students"
            value={totalStudents.toLocaleString()}
            trend={dashboard?.trends?.studentsPct ?? 12.5}
            trendLabel="vs last month"
          />
          <KpiCard
            icon={<SchoolOutlined sx={{ fontSize: 20 }} />}
            iconBg="#E0F2FE"
            iconColor="#0ea5e9"
            label="Total Classes"
            value={String(totalClasses)}
            trend={5.3}
            trendLabel="vs last month"
          />
          <KpiCard
            icon={<EventNoteOutlined sx={{ fontSize: 20 }} />}
            iconBg="#D1FAE5"
            iconColor="#10b981"
            label="Attendance Today"
            value={totalAttendance > 0 ? `${attendanceTodayPct}%` : "—"}
            trend={dashboard?.trends?.attendancePct ?? 3.8}
            trendLabel="vs last week"
          />
          <KpiCard
            icon={<AssignmentOutlined sx={{ fontSize: 20 }} />}
            iconBg="#FEF3C7"
            iconColor="#f59e0b"
            label="Pending Homework"
            value={String(pendingCount)}
            trend={-8.6}
            trendLabel="vs last week"
          />
          <KpiCard
            icon={<CastForEducationOutlined sx={{ fontSize: 20 }} />}
            iconBg="#FCE7F3"
            iconColor="#ec4899"
            label="Live Classes Today"
            value={String(todayEntries.length)}
            footer={
              <Link to="/timetable" className="text-[11px] font-semibold text-[#534AB7] hover:underline">
                View Schedule
              </Link>
            }
          />
        </div>

        {/* Row 2 — Attendance | Class Performance | Today's Schedule */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <PanelCard
            title="Attendance Overview"
            action={<DropdownPill label="This Week" />}
          >
            <Chart
              type="area"
              height={210}
              series={[{ name: "Attendance", data: attendanceLineData }]}
              options={attendanceLineOptions}
            />
          </PanelCard>

          <PanelCard
            title="Class Performance"
            action={<DropdownPill label="This Term" />}
          >
            <div className="space-y-3.5">
              {CLASS_PERFORMANCE.map((cls) => (
                <div key={cls.name}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[#374151]">{cls.name}</span>
                    <span className="text-[#6B7280]">Average Score {cls.score}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cls.score}%`, background: cls.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/results-performance"
              className="mt-3 block text-[12px] font-semibold text-[#534AB7] hover:underline"
            >
              View all classes &gt;
            </Link>
          </PanelCard>

          <PanelCard
            title="Today's Schedule"
            action={
              <Link to="/timetable" className="text-[11px] font-semibold text-[#534AB7] hover:underline">
                View Timetable &gt;
              </Link>
            }
          >
            {todayEntries.length > 0 ? (
              <div className="space-y-0">
                {todayEntries.slice(0, 6).map((entry) => {
                  const status = sessionStatus(entry, todayKey, nowMinutes);
                  const isLive = status === "live";
                  return (
                    <div
                      key={entry.id}
                      className="flex gap-3 border-b border-[#F9FAFB] py-2.5 last:border-b-0"
                    >
                      <div className="w-16 shrink-0 text-[11px] font-semibold text-[#6B7280]">
                        {formatTime12(entry.startTime)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1A1A1A]">
                          {entry.classSubject.subject.name}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF]">{sectionLabel(entry.classSection)}</p>
                      </div>
                      <span
                        className={`shrink-0 self-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isLive
                            ? "bg-[#EEF2FF] text-[#534AB7] ring-1 ring-[#C7D2FE]"
                            : status === "done"
                              ? "bg-[#F3F4F6] text-[#9CA3AF]"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {isLive ? "Live Class" : status === "done" ? "Done" : "Scheduled"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-[#9CA3AF]">No classes scheduled today.</p>
            )}
          </PanelCard>
        </div>

        {/* Row 3 — Recent Homework | Live Classes | Announcements */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <PanelCard
            title="Recent Homework"
            action={
              <Link to="/homework" className="text-[11px] font-semibold text-[#534AB7] hover:underline">
                View All &gt;
              </Link>
            }
          >
            {recentHomework.length > 0 ? (
              <div className="divide-y divide-[#F3F4F6]">
                {recentHomework.map((item) => {
                  const expected = enrollmentBySection[item.classSectionId] ?? 0;
                  const submitted = item._count?.submissions ?? 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#EEF2FF] text-[#534AB7]">
                        <AssignmentOutlined sx={{ fontSize: 18 }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#1A1A1A]">{item.title}</p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          {sectionLabel(item.classSection)} &middot; {item.classSubject.subject.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-bold text-[#374151]">
                          {submitted}/{expected || "?"}
                        </p>
                        <span className="text-[10px] font-bold text-rose-500">Pending</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-[#9CA3AF]">No homework assigned yet.</p>
            )}
          </PanelCard>

          <PanelCard
            title="Live Classes"
            action={
              <Link to="/timetable" className="text-[11px] font-semibold text-[#534AB7] hover:underline">
                View All &gt;
              </Link>
            }
          >
            {liveClassCards.length > 0 ? (
              <div className="space-y-3">
                {liveClassCards.map((entry, idx) => {
                  const isLive = sessionStatus(entry, todayKey, nowMinutes) === "live";
                  const enrolled = enrollmentBySection[entry.classSection.id] ?? 0;
                  return (
                    <div key={entry.id} className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                      <div
                        className="relative flex h-[72px] items-end p-3"
                        style={{ background: LIVE_GRADIENTS[idx % LIVE_GRADIENTS.length] }}
                      >
                        {isLive ? (
                          <span className="absolute left-3 top-2.5 inline-flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            <span className="size-1.5 animate-pulse rounded-full bg-white" />
                            Live
                          </span>
                        ) : null}
                        <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          {sectionLabel(entry.classSection)}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-[13px] font-bold text-[#1A1A1A]">{entry.classSubject.subject.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#6B7280]">
                          <PersonOutlined sx={{ fontSize: 13 }} />
                          By {teacherName(entry.teacher)}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-[#9CA3AF]">
                            {enrolled > 0 ? `${enrolled} Students Online` : "Class session"}
                          </span>
                          <Link
                            to="/timetable"
                            className="rounded-lg bg-[#534AB7] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#4338a8]"
                          >
                            Join Now
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-[#9CA3AF]">
                No live classes right now.{" "}
                <Link to="/timetable" className="font-semibold text-[#534AB7] hover:underline">
                  View Schedule
                </Link>
              </p>
            )}
          </PanelCard>

          <PanelCard
            title="Announcements"
            action={
              <Link to="/notices" className="text-[11px] font-semibold text-[#534AB7] hover:underline">
                View All &gt;
              </Link>
            }
          >
            {notices.length > 0 ? (
              <div className="divide-y divide-[#F3F4F6]">
                {notices.slice(0, 3).map((notice) => (
                  <div key={notice.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                      <NotificationsActiveOutlined sx={{ fontSize: 16 }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#1A1A1A]">{notice.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#6B7280]">
                        {notice.body}
                      </p>
                      <p className="mt-1 text-[10px] text-[#9CA3AF]">{timeAgo(notice.publishedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-[#9CA3AF]">No announcements yet.</p>
            )}
          </PanelCard>
        </div>
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
