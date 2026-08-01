import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  AssignmentOutlined,
  CalendarMonthOutlined,
  CastForEducationOutlined,
  GroupsOutlined,
  InsightsOutlined,
  PersonOutlined,
  ScheduleOutlined,
  SensorsOutlined,
} from "@mui/icons-material";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CmsPage, CmsScrollBody } from "../../components/cms/CmsLayout";
import { apiRequest, getDashboard, type DashboardResult } from "../../lib/api";
import { notifyError } from "../../lib/notify";

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
const WEEK_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
const WEEK_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

interface TimetableEntry {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  classSection: { academicClass: { name: string }; section: { name: string } };
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

interface ExamItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ExamSetup {
  groups: Array<{ id: string; name: string; exams: ExamItem[] }>;
}

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTimeRange(start: string, end: string) {
  const fmt = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    const date = new Date();
    date.setHours(h ?? 0, m ?? 0, 0, 0);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function startingIn(value: string) {
  const deltaMs = new Date(value).getTime() - Date.now();
  if (deltaMs <= 0) return "In progress";
  const days = Math.floor(deltaMs / (1000 * 60 * 60 * 24));
  if (days >= 1) return `Starting in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(deltaMs / (1000 * 60 * 60));
  if (hours >= 1) return `Starting in ${hours}h`;
  return "Starting soon";
}

function sectionLabel(entry: { academicClass: { name: string }; section: { name: string } }) {
  return `${entry.academicClass.name}-${entry.section.name}`;
}

function teacherName(teacher?: { firstName: string; lastName?: string | null } | null) {
  if (!teacher) return "Unassigned";
  return `${teacher.firstName} ${teacher.lastName ?? ""}`.trim();
}

function trendChip(value: number) {
  const up = value >= 0;
  const Icon = up ? ArrowUpwardRounded : ArrowDownwardRounded;
  return (
    <span className={`ov-trend ${up ? "ov-trend-up" : "ov-trend-down"}`}>
      <Icon sx={{ fontSize: 12 }} />
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

type SessionStatus = "live" | "upcoming" | "done";

function sessionStatus(entry: TimetableEntry, todayKey: string, nowMinutes: number): SessionStatus {
  if (entry.weekday !== todayKey) return "upcoming";
  if (nowMinutes >= timeToMinutes(entry.startTime) && nowMinutes < timeToMinutes(entry.endTime)) return "live";
  if (nowMinutes >= timeToMinutes(entry.endTime)) return "done";
  return "upcoming";
}

const SUBJECT_TINTS = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export function LmsDashboardPage() {
  const { accessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResult | null>(null);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [enrollmentBySection, setEnrollmentBySection] = useState<Record<string, number>>({});
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [tab, setTab] = useState<"overview" | "classes" | "homework">("overview");

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      try {
        const jobs: Promise<void>[] = [
          getDashboard(accessToken)
            .then(setDashboard)
            .catch(() => setDashboard(null)),
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
          apiRequest<ExamSetup>("/exams/setup", accessToken)
            .then((setup) => setExams((setup.groups ?? []).flatMap((group) => group.exams ?? [])))
            .catch(() => setExams([])),
        ];
        await Promise.all(jobs);
      } catch (cause) {
        notifyError(cause instanceof Error ? cause.message : "Unable to load LMS dashboard");
      }
    })();
  }, [accessToken]);

  const now = new Date();
  const todayKey = WEEKDAYS[now.getDay()];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.weekday === todayKey)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [entries, todayKey],
  );
  const liveNow = todayEntries.filter((entry) => sessionStatus(entry, todayKey, nowMinutes) === "live");

  // Live sessions first, then the next upcoming ones today; falls back to the week's schedule.
  const sessionCards = useMemo(() => {
    const active = todayEntries.filter((entry) => sessionStatus(entry, todayKey, nowMinutes) !== "done");
    if (active.length > 0) return active.slice(0, 3);
    if (todayEntries.length > 0) return todayEntries.slice(-3);
    return [...entries]
      .sort(
        (a, b) =>
          WEEK_ORDER.indexOf(a.weekday as (typeof WEEK_ORDER)[number]) -
            WEEK_ORDER.indexOf(b.weekday as (typeof WEEK_ORDER)[number]) ||
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
      )
      .slice(0, 3);
  }, [entries, todayEntries, todayKey, nowMinutes]);

  const weekLoad = useMemo(() => {
    const counts = WEEK_ORDER.map(
      (day) => entries.filter((entry) => entry.weekday === day).length,
    );
    return counts;
  }, [entries]);

  const stats = dashboard?.stats;
  const present = stats?.attendanceToday.present ?? 0;
  const totalAttendance = stats?.attendanceToday.total ?? 0;
  const presentPct = totalAttendance > 0 ? Math.round((present / totalAttendance) * 1000) / 10 : 0;

  const publishedHomework = homework.filter((item) => item.status !== "DRAFT");
  const totalSubmissions = publishedHomework.reduce((sum, item) => sum + (item._count?.submissions ?? 0), 0);
  const expectedSubmissions = publishedHomework.reduce(
    (sum, item) => sum + (enrollmentBySection[item.classSectionId] ?? 0),
    0,
  );
  const homeworkCompletionPct =
    expectedSubmissions > 0 ? Math.round((totalSubmissions / expectedSubmissions) * 1000) / 10 : 0;

  const upcomingExams = exams
    .filter((exam) => new Date(exam.endDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const nextExam = upcomingExams[0];
  const completedExams = exams.filter((exam) => new Date(exam.endDate).getTime() < Date.now()).length;
  const examCompletionPct = exams.length > 0 ? Math.round((completedExams / exams.length) * 100) : 0;

  const recentHomework = homework.slice(0, 6);

  const areaOptions: ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, fontFamily: "inherit", zoom: { enabled: false } },
    colors: ["#6366f1"],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.04, stops: [0, 90, 100] },
    },
    grid: { borderColor: "#eef0f4", strokeDashArray: 4 },
    xaxis: {
      categories: WEEK_ORDER.map((day) => WEEK_LABEL[day]),
      labels: { style: { colors: "#94a3b8", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: "#94a3b8", fontSize: "11px" } } },
    tooltip: { y: { formatter: (value: number) => `${value} periods` } },
  };

  if (!user) return null;

  const homeworkStatusPill = (status: string) => {
    if (status === "PUBLISHED") return { label: "Open", className: "nx-pill-success" };
    if (status === "CLOSED") return { label: "Closed", className: "nx-pill-neutral" };
    return { label: "Draft", className: "nx-pill-warning" };
  };

  return (
    <CmsPage>
      <CmsScrollBody>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
          {/* ------- Main column ------- */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className="ov-hero">
              <div className="ov-hero-glow" />
              <div className="ov-hero-inner">
                <span className="ov-hero-badge">LMS Dashboard</span>
                <h1 className="ov-hero-title">Welcome back, {user.firstName || "Administrator"}</h1>
                <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-indigo-100">
                  {liveNow.length > 0
                    ? `The institution is currently running ${liveNow.length} live class${liveNow.length === 1 ? "" : "es"}.`
                    : `${todayEntries.length} class${todayEntries.length === 1 ? "" : "es"} scheduled today.`}{" "}
                  {stats?.homeworkOpen ?? 0} homework assignment{(stats?.homeworkOpen ?? 0) === 1 ? " is" : "s are"} open.
                </p>
                <div className="ov-hero-actions">
                  <Link
                    to="/timetable"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    <ScheduleOutlined sx={{ fontSize: 15 }} />
                    Schedule Class
                  </Link>
                  <Link to="/reports" className="ov-hero-btn">
                    <InsightsOutlined sx={{ fontSize: 15 }} />
                    View Analytics
                  </Link>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="ov-kpi">
                <div className="ov-kpi-top">
                  <div className="ov-kpi-icon" style={{ background: "#6366f118", color: "#6366f1" }}>
                    <GroupsOutlined sx={{ fontSize: 18 }} />
                  </div>
                  {trendChip(dashboard?.trends?.studentsPct ?? 0)}
                </div>
                <p className="ov-kpi-label">Active Students</p>
                <p className="ov-kpi-value !mt-0.5">{stats?.students?.toLocaleString() ?? "—"}</p>
              </article>
              <article className="ov-kpi">
                <div className="ov-kpi-top">
                  <div className="ov-kpi-icon" style={{ background: "#0ea5e918", color: "#0ea5e9" }}>
                    <CastForEducationOutlined sx={{ fontSize: 18 }} />
                  </div>
                  {liveNow.length > 0 ? (
                    <span className="ov-trend ov-trend-up">
                      <SensorsOutlined sx={{ fontSize: 12 }} />
                      {liveNow.length} live
                    </span>
                  ) : null}
                </div>
                <p className="ov-kpi-label">Classes Today</p>
                <p className="ov-kpi-value !mt-0.5">{todayEntries.length}</p>
              </article>
              <article className="ov-kpi">
                <div className="ov-kpi-top">
                  <div className="ov-kpi-icon" style={{ background: "#8b5cf618", color: "#8b5cf6" }}>
                    <AssignmentOutlined sx={{ fontSize: 18 }} />
                  </div>
                </div>
                <p className="ov-kpi-label">Homework Completion</p>
                <p className="ov-kpi-value !mt-0.5">
                  {expectedSubmissions > 0 ? `${homeworkCompletionPct}%` : "—"}
                </p>
              </article>
              <article className="ov-kpi">
                <div className="ov-kpi-top">
                  <div className="ov-kpi-icon" style={{ background: "#10b98118", color: "#10b981" }}>
                    <CalendarMonthOutlined sx={{ fontSize: 18 }} />
                  </div>
                  {trendChip(dashboard?.trends?.attendancePct ?? 0)}
                </div>
                <p className="ov-kpi-label">Live Attendance</p>
                <p className="ov-kpi-value !mt-0.5">{totalAttendance > 0 ? `${presentPct}%` : "—"}</p>
              </article>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
              <div className="ov-tabs" role="tablist">
                {(
                  [
                    ["overview", "Overview"],
                    ["classes", "Live Classes"],
                    ["homework", "Homework & Tests"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    className={`ov-tab ${tab === key ? "ov-tab-active" : ""}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}
              </span>
            </div>

            {tab === "overview" ? (
              <>
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[16px] font-bold text-slate-900">Ongoing &amp; Upcoming Live Sessions</h2>
                      <p className="text-[12px] text-slate-500">Real-time monitoring of scheduled classrooms.</p>
                    </div>
                    <Link to="/timetable" className="nx-btn-secondary !rounded-lg !px-3 !py-1.5 text-[12px]">
                      Manage Classes
                    </Link>
                  </div>

                  {sessionCards.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sessionCards.map((entry, index) => {
                        const status = sessionStatus(entry, todayKey, nowMinutes);
                        const tint = SUBJECT_TINTS[index % SUBJECT_TINTS.length];
                        return (
                          <article
                            key={entry.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                          >
                            <div className={`relative flex h-24 items-end bg-gradient-to-br ${tint} p-3`}>
                              {status === "live" ? (
                                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                                  Live
                                </span>
                              ) : (
                                <span className="absolute left-3 top-3 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  {entry.weekday === todayKey ? "Today" : WEEK_LABEL[entry.weekday] ?? entry.weekday}
                                </span>
                              )}
                              <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {sectionLabel(entry.classSection)}
                                {entry.room ? ` · ${entry.room}` : ""}
                              </span>
                            </div>
                            <div className="p-3.5">
                              <h3 className="truncate text-[14px] font-bold text-slate-900">
                                {entry.classSubject.subject.name}
                              </h3>
                              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500">
                                <PersonOutlined sx={{ fontSize: 14 }} />
                                {teacherName(entry.teacher)}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
                                <ScheduleOutlined sx={{ fontSize: 14 }} />
                                {formatTimeRange(entry.startTime, entry.endTime)}
                              </p>
                              <Link
                                to="/timetable"
                                className={`mt-3 flex w-full items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                                  status === "live"
                                    ? "bg-[#6366f1] text-white hover:bg-indigo-600"
                                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {status === "live" ? "Monitor Classroom" : "View Schedule"}
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center">
                      <p className="text-[13px] font-medium text-slate-600">No classes scheduled yet.</p>
                      <Link to="/timetable" className="mt-2 inline-block text-[12px] font-semibold text-indigo-600 hover:underline">
                        Open timetable
                      </Link>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-[15px] font-bold text-slate-900">Class Load Trend</h2>
                  <p className="text-[12px] text-slate-500">Scheduled periods across the week from the timetable.</p>
                  <Chart
                    type="area"
                    height={220}
                    series={[{ name: "Periods", data: weekLoad }]}
                    options={areaOptions}
                  />
                </section>
              </>
            ) : null}

            {tab === "classes" ? (
              <section className="ov-panel">
                <div className="overflow-x-auto">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Room</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayEntries.map((entry) => {
                        const status = sessionStatus(entry, todayKey, nowMinutes);
                        const pill =
                          status === "live"
                            ? { label: "Live", className: "nx-pill-danger" }
                            : status === "done"
                              ? { label: "Completed", className: "nx-pill-neutral" }
                              : { label: "Upcoming", className: "nx-pill-success" };
                        return (
                          <tr key={entry.id}>
                            <td className="font-semibold text-slate-800">
                              {formatTimeRange(entry.startTime, entry.endTime)}
                            </td>
                            <td className="font-medium text-slate-800">{entry.classSubject.subject.name}</td>
                            <td className="text-slate-500">{sectionLabel(entry.classSection)}</td>
                            <td className="text-slate-500">{teacherName(entry.teacher)}</td>
                            <td className="text-slate-500">{entry.room || "—"}</td>
                            <td>
                              <span className={`nx-pill ${pill.className}`}>{pill.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!todayEntries.length ? (
                    <p className="px-5 py-12 text-center text-sm text-slate-500">
                      No classes scheduled for today.{" "}
                      <Link to="/timetable" className="font-semibold text-indigo-600 hover:underline">
                        Open timetable
                      </Link>
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            {tab === "homework" ? (
              <section className="ov-panel">
                <div className="overflow-x-auto">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Due Date</th>
                        <th>Submissions</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homework.slice(0, 8).map((item) => {
                        const pill = homeworkStatusPill(item.status);
                        const expected = enrollmentBySection[item.classSectionId] ?? 0;
                        return (
                          <tr key={item.id}>
                            <td>
                              <Link to="/homework" className="font-medium text-indigo-600 hover:underline">
                                {item.title}
                              </Link>
                            </td>
                            <td className="text-slate-500">{item.classSubject.subject.name}</td>
                            <td className="text-slate-500">{sectionLabel(item.classSection)}</td>
                            <td className="text-slate-500">{formatDate(item.submissionDate)}</td>
                            <td className="font-semibold text-slate-800">
                              {item._count?.submissions ?? 0}
                              {expected > 0 ? <span className="font-normal text-slate-400"> / {expected}</span> : null}
                            </td>
                            <td>
                              <span className={`nx-pill ${pill.className}`}>{pill.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!homework.length ? (
                    <p className="px-5 py-12 text-center text-sm text-slate-500">
                      No homework assigned yet.{" "}
                      <Link to="/homework" className="font-semibold text-indigo-600 hover:underline">
                        Create homework
                      </Link>
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {/* ------- Right column ------- */}
          <div className="flex min-w-0 flex-col gap-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-[15px] font-bold text-slate-900">Test Series Pipeline</h2>
              <p className="text-[12px] text-slate-500">Active and scheduled assessments.</p>

              {nextExam ? (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-600">
                    <AssignmentOutlined sx={{ fontSize: 18 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-800">{nextExam.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-slate-500">
                      {formatDate(nextExam.startDate)} · {startingIn(nextExam.startDate)}
                    </p>
                  </div>
                  <span className="nx-pill nx-pill-warning shrink-0">
                    {nextExam.status === "PUBLISHED" ? "Published" : "Pending"}
                  </span>
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-5 text-center text-[12.5px] text-slate-500">
                  No upcoming exams scheduled.
                </p>
              )}

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-slate-500">Total completion</span>
                  <span className="font-bold text-slate-800">
                    {completedExams}/{exams.length || 0} Exams
                  </span>
                </div>
                <div className="ov-progress">
                  <i style={{ width: `${examCompletionPct}%` }} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Exams Held</p>
                  <p className="mt-1 text-[18px] font-bold text-slate-900">{completedExams}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Upcoming</p>
                  <p className="mt-1 text-[18px] font-bold text-slate-900">{upcomingExams.length}</p>
                </div>
              </div>

              <Link
                to="/exams"
                className="mt-4 block text-center text-[12px] font-semibold text-indigo-600 hover:underline"
              >
                Full Test Series Report →
              </Link>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-[15px] font-bold text-slate-900">Homework Tracking</h2>
              <p className="text-[12px] text-slate-500">Recent assignments and submissions.</p>

              <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <span>Assignment</span>
                <span>Status</span>
              </div>
              <div className="mt-1 divide-y divide-slate-100">
                {recentHomework.map((item) => {
                  const pill = homeworkStatusPill(item.status);
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">{item.title}</p>
                        <p className="truncate text-[11px] text-slate-400">
                          {item.classSubject.subject.name} · {item._count?.submissions ?? 0} submission
                          {(item._count?.submissions ?? 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span className={`nx-pill ${pill.className} shrink-0`}>{pill.label}</span>
                    </div>
                  );
                })}
                {!recentHomework.length ? (
                  <p className="py-6 text-center text-[12.5px] text-slate-500">No homework assigned yet.</p>
                ) : null}
              </div>

              <Link
                to="/homework"
                className="mt-2 block text-center text-[12px] font-semibold text-indigo-600 hover:underline"
              >
                Open Homework Management →
              </Link>
            </section>
          </div>
        </div>
      </CmsScrollBody>
    </CmsPage>
  );
}
