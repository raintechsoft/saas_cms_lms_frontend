import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EmojiEventsOutlined,
  LeaderboardOutlined,
  MilitaryTechOutlined,
  PlayArrowOutlined,
  QuizOutlined,
  TrendingUpRounded,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import type { PortalExamItem } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";

type OnlineExamCard = {
  id: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
  passMarks: number;
  attemptsRemaining: number;
  canAttempt: boolean;
  inProgressAttempt: { id: string } | null;
  latestAttempt: {
    status: string;
    score: string | number | null;
    maxScore: string | number | null;
  } | null;
};

const SUBJECT_COLORS = [
  "#534AB7",
  "#10B981",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
];

type GroupTab = "ALL" | string;

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

function gradeFromPercentage(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "E";
}

function gradeTone(grade: string) {
  if (grade.startsWith("A")) return { bg: "#ECFDF5", fg: "#059669" };
  if (grade.startsWith("B")) return { bg: "#EEF0FD", fg: PRIMARY };
  if (grade.startsWith("C")) return { bg: "#FFF7ED", fg: "#D97706" };
  return { bg: "#FEF2F2", fg: "#E11D48" };
}

function performanceLabel(pct: number) {
  if (pct >= 85) return { label: "Excellent Performance", color: "#059669" };
  if (pct >= 70) return { label: "Good Performance", color: "#059669" };
  if (pct >= 55) return { label: "Average Performance", color: "#D97706" };
  return { label: "Needs Improvement", color: "#E11D48" };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function subjectColor(subject: string, index: number) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[(hash + index) % SUBJECT_COLORS.length];
}

function Donut({
  average,
  slices,
}: {
  average: number;
  slices: Array<{ label: string; value: number; color: string }>;
}) {
  const size = 150;
  const r = 52;
  const c = 2 * Math.PI * r;
  const total = Math.max(
    slices.reduce((sum, s) => sum + Math.max(0, s.value), 0),
    1,
  );
  let offset = 0;
  return (
    <div className="relative mx-auto size-[150px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F2F6" strokeWidth="16" />
        {slices.map((slice) => {
          const len = (Math.max(0, slice.value) / total) * c;
          const el = (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[18px] font-bold text-[#1A1A1A]">{average.toFixed(1)}%</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Average</p>
        </div>
      </div>
    </div>
  );
}

function ExamDetailModal({
  exam,
  onClose,
}: {
  exam: PortalExamItem;
  onClose: () => void;
}) {
  const grade = gradeFromPercentage(exam.percentage);
  const tone = gradeTone(grade);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{exam.groupName}</p>
            <h2 className="mt-1 text-[18px] font-bold text-[#1A1A1A]">{exam.examName}</h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">{formatDate(exam.examDate)}</p>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
            Grade {grade}
          </span>
          <span className="rounded-full bg-[#EEF0FD] px-2.5 py-1 text-[11px] font-bold text-[#534AB7]">
            {exam.percentage}%
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              exam.passStatus === "PASS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
            }`}
          >
            {exam.passStatus}
          </span>
        </div>
        <div className="divide-y divide-[#F1F2F6]">
          {exam.subjects.map((subject, index) => (
            <div key={`${subject.subject}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <span className="inline-flex items-center gap-2 font-semibold text-[#1A1A1A]">
                <span className="size-2 rounded-full" style={{ background: subjectColor(subject.subject, index) }} />
                {subject.subject}
              </span>
              <span className="text-[#6B7280]">
                {subject.isAbsent ? "Absent" : `${subject.marksObtained} / ${subject.maximumMarks}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortalExamsPage() {
  const { child, overview, activeChild, setActiveChild, basePath, productMode, accessToken } = usePortal();
  const [groupTab, setGroupTab] = useState<GroupTab>("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [onlineExams, setOnlineExams] = useState<OnlineExamCard[]>([]);
  const showCms = isProductBucketAllowed(productMode, "CMS");

  const exams = child?.exams ?? [];
  const studentId = child?.student.id;

  const loadOnlineExams = useCallback(async () => {
    if (!studentId || !accessToken) return;
    try {
      const rows = await apiRequest<OnlineExamCard[]>(
        `/portal/children/${studentId}/online-exams`,
        accessToken,
      );
      setOnlineExams(Array.isArray(rows) ? rows : []);
    } catch {
      setOnlineExams([]);
    }
  }, [studentId, accessToken]);

  useEffect(() => {
    void loadOnlineExams();
  }, [loadOnlineExams]);

  const groupTabs = useMemo(() => {
    const names = [...new Set(exams.map((exam) => exam.groupName))];
    return ["ALL", ...names] as GroupTab[];
  }, [exams]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const exam of exams) for (const row of exam.subjects) set.add(row.subject);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [exams]);

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      if (groupTab !== "ALL" && exam.groupName !== groupTab) return false;
      if (subjectFilter !== "ALL" && !exam.subjects.some((s) => s.subject === subjectFilter)) return false;
      return true;
    });
  }, [exams, groupTab, subjectFilter]);

  const stats = useMemo(() => {
    if (exams.length === 0) {
      return { average: 0, highest: null as null | { pct: number; subject: string }, total: 0 };
    }
    const average = exams.reduce((sum, exam) => sum + exam.percentage, 0) / exams.length;
    let highest: { pct: number; subject: string } | null = null;
    for (const exam of exams) {
      for (const row of exam.subjects) {
        if (row.isAbsent || row.maximumMarks <= 0) continue;
        const pct = (row.marksObtained / row.maximumMarks) * 100;
        if (!highest || pct > highest.pct) highest = { pct, subject: row.subject };
      }
    }
    return { average, highest, total: exams.length };
  }, [exams]);

  const subjectAverages = useMemo(() => {
    const map = new Map<string, { obtained: number; maximum: number }>();
    for (const exam of exams) {
      for (const row of exam.subjects) {
        if (row.isAbsent) continue;
        const current = map.get(row.subject) ?? { obtained: 0, maximum: 0 };
        current.obtained += row.marksObtained;
        current.maximum += row.maximumMarks;
        map.set(row.subject, current);
      }
    }
    return [...map.entries()]
      .map(([label, value], index) => ({
        label,
        value: value.maximum ? (value.obtained / value.maximum) * 100 : 0,
        color: subjectColor(label, index),
      }))
      .sort((a, b) => b.value - a.value);
  }, [exams]);

  const recent = useMemo(() => {
    return [...exams]
      .sort((a, b) => {
        const da = new Date(a.publishedAt ?? a.examDate ?? 0).getTime();
        const db = new Date(b.publishedAt ?? b.examDate ?? 0).getTime();
        return db - da;
      })
      .slice(0, 4);
  }, [exams]);

  const weakSubjects = subjectAverages.filter((s) => s.value < 75).slice(-2).map((s) => s.label);
  const perf = performanceLabel(stats.average);
  const detail = exams.find((exam) => exam.examId === detailId) ?? null;
  const sessionLabel = child?.enrollment?.session ?? "This Academic Year";
  const classLabel = child?.enrollment
    ? `Class ${child.enrollment.className} - ${child.enrollment.section}`
    : "Class";

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Exams & Results</h1>
          <p className="mt-1 text-[12px] text-[#9CA3AF]">
            <Link to={basePath} className="hover:text-[#6B7280]">
              Dashboard
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-medium text-[#6B7280]">Exams & Results</span>
          </p>
        </div>

        {overview && overview.children.length > 1 ? (
          <select
            className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#1A1A1A] outline-none"
            value={activeChild}
            onChange={(event) => setActiveChild(Number(event.target.value))}
          >
            {overview.children.map((item, index) => (
              <option key={item.student.id} value={index}>
                {item.enrollment
                  ? `Class ${item.enrollment.className} - ${item.enrollment.section}`
                  : item.student.firstName}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#1A1A1A]">
            {classLabel}
          </span>
        )}
      </div>

      <Card className="!p-4" style={{ background: PRIMARY_SOFT, borderColor: "#D9DCF8" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-[#534AB7]">
              <QuizOutlined sx={{ fontSize: 22 }} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#1A1A1A]">Online Exams</p>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                {onlineExams.length
                  ? `${onlineExams.length} published exam${onlineExams.length === 1 ? "" : "s"} available to attempt`
                  : "Take MCQ / subjective exams published by your school"}
              </p>
            </div>
          </div>
          <Link
            to={`${basePath}/test-series`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#534AB7] px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            <PlayArrowOutlined sx={{ fontSize: 18 }} />
            Open Online Exams
          </Link>
        </div>
        {onlineExams.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {onlineExams.slice(0, 4).map((exam) => (
              <div key={exam.id} className="rounded-xl border border-white/80 bg-white/90 px-3 py-2.5">
                <p className="text-[13px] font-semibold text-[#1A1A1A]">{exam.title}</p>
                <p className="mt-0.5 text-[11px] text-[#6B7280]">
                  {exam.questionCount} Q · {exam.durationMinutes} min
                  {exam.latestAttempt
                    ? exam.latestAttempt.status === "GRADED" && exam.latestAttempt.score != null
                      ? ` · ${exam.latestAttempt.status} ${exam.latestAttempt.score}/${exam.latestAttempt.maxScore ?? "—"}`
                      : ` · ${exam.latestAttempt.status}${
                          exam.latestAttempt.status === "SUBMITTED" ? " (result pending)" : ""
                        }`
                    : ` · ${exam.attemptsRemaining} attempt(s) left`}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {exams.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-[#1A1A1A]">No published marksheet results yet.</p>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            This section shows offline exam results. For online attempts, use{" "}
            <Link to={`${basePath}/test-series`} className="font-semibold text-[#534AB7]">
              Online Exams
            </Link>
            .
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Overall Average",
                  value: `${stats.average.toFixed(1)}%`,
                  sub: perf.label,
                  subColor: perf.color,
                  Icon: EmojiEventsOutlined,
                  bg: PRIMARY_SOFT,
                  fg: PRIMARY,
                },
                {
                  label: "Highest Score",
                  value: stats.highest ? `${Math.round(stats.highest.pct)}%` : "—",
                  sub: stats.highest?.subject ?? "—",
                  subColor: "#059669",
                  Icon: TrendingUpRounded,
                  bg: "#ECFDF5",
                  fg: "#059669",
                },
                {
                  label: "Total Exams",
                  value: String(stats.total),
                  sub: sessionLabel,
                  subColor: "#6B7280",
                  Icon: MilitaryTechOutlined,
                  bg: "#FFF7ED",
                  fg: "#D97706",
                },
                {
                  label: "Rank",
                  value: "—",
                  sub: "Not published yet",
                  subColor: "#6B7280",
                  Icon: LeaderboardOutlined,
                  bg: "#E0F2FE",
                  fg: "#0284C7",
                },
              ].map((card) => (
                <Card key={card.label} className="flex items-center gap-3 !p-4">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl"
                    style={{ background: card.bg, color: card.fg }}
                  >
                    <card.Icon sx={{ fontSize: 22 }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#9CA3AF]">{card.label}</p>
                    <p className="text-[22px] font-bold leading-tight text-[#1A1A1A]">{card.value}</p>
                    <p className="truncate text-[11px] font-semibold" style={{ color: card.subColor }}>
                      {card.sub}
                    </p>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Exam Results</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold outline-none"
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                  >
                    <option value="ALL">All Subjects</option>
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                  <span className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#6B7280]">
                    {sessionLabel}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto border-b border-[#F1F2F6] px-5 py-3">
                {groupTabs.map((tab) => {
                  const active = groupTab === tab;
                  const label = tab === "ALL" ? "All Exams" : tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setGroupTab(tab)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                        active ? "text-white" : "bg-[#F6F7F9] text-[#6B7280] hover:bg-[#EEF0FD]"
                      }`}
                      style={active ? { background: PRIMARY } : undefined}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No exams match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead>
                      <tr className="border-y border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-5 py-3 font-semibold">Exam Name</th>
                        <th className="px-5 py-3 font-semibold">Date</th>
                        <th className="px-5 py-3 font-semibold">Subjects</th>
                        <th className="px-5 py-3 font-semibold">Total</th>
                        <th className="px-5 py-3 font-semibold">Obtained</th>
                        <th className="px-5 py-3 font-semibold">%</th>
                        <th className="px-5 py-3 font-semibold">Grade</th>
                        <th className="px-5 py-3 font-semibold">Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((exam) => {
                        const grade = gradeFromPercentage(exam.percentage);
                        const tone = gradeTone(grade);
                        return (
                          <tr
                            key={exam.examId}
                            className="cursor-pointer border-b border-[#F1F2F6] last:border-0 hover:bg-[#F8F9FC]"
                            onClick={() => setDetailId(exam.examId)}
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-[#1A1A1A]">{exam.examName}</p>
                              <p className="text-[11px] text-[#9CA3AF]">{exam.groupName}</p>
                            </td>
                            <td className="px-5 py-3.5 text-[#6B7280]">{formatDate(exam.examDate)}</td>
                            <td className="px-5 py-3.5 text-[#6B7280]">{exam.subjects.length}</td>
                            <td className="px-5 py-3.5 text-[#6B7280]">{exam.maximumMarks}</td>
                            <td className="px-5 py-3.5 font-semibold text-[#1A1A1A]">{exam.obtainedMarks}</td>
                            <td className="px-5 py-3.5 font-bold" style={{ color: tone.fg }}>
                              {exam.percentage.toFixed(2)}%
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={{ background: tone.bg, color: tone.fg }}
                              >
                                {grade}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#9CA3AF]">—</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-center border-t border-[#E5E7EB] px-5 py-4">
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-[13px] font-bold transition hover:bg-[#F6F7F9]"
                  style={{ borderColor: BORDER, color: PRIMARY }}
                  onClick={() => {
                    if (filtered[0]) setDetailId(filtered[0].examId);
                  }}
                >
                  View Detailed Report →
                </button>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <h2 className="mb-3 text-[15px] font-bold text-[#1A1A1A]">Subject Wise Performance</h2>
              <Donut
                average={stats.average}
                slices={subjectAverages.map((s) => ({ label: s.label, value: s.value, color: s.color }))}
              />
              <div className="mt-4 space-y-2">
                {subjectAverages.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[#6B7280]">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span className="font-bold text-[#1A1A1A]">{Math.round(row.value)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Recent Results</h2>
              <div className="flex flex-col gap-3">
                {recent.map((exam) => (
                  <button
                    key={exam.examId}
                    type="button"
                    className="flex items-start justify-between gap-2 rounded-xl px-1 py-1 text-left hover:bg-[#F8F9FC]"
                    onClick={() => setDetailId(exam.examId)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{exam.examName} Result</p>
                      <p className="text-[11px] text-[#9CA3AF]">{formatDate(exam.publishedAt ?? exam.examDate)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Published
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              className="relative overflow-hidden !border-transparent !bg-transparent text-white"
              style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #3F3A9A 100%)` }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
              <div className="relative">
                <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-white/15">
                  <EmojiEventsOutlined sx={{ fontSize: 22 }} />
                </span>
                <p className="text-[15px] font-bold">Keep it up!</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/85">
                  You are performing great!
                  {weakSubjects.length
                    ? ` Try to improve in ${weakSubjects.join(" and ")}.`
                    : " Keep maintaining consistency across all subjects."}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
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

      {detail ? <ExamDetailModal exam={detail} onClose={() => setDetailId(null)} /> : null}
    </div>
  );
}
