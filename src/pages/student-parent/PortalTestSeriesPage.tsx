import { useMemo, useState } from "react";
import {
  AssignmentOutlined,
  BarChartRounded,
  CheckCircleRounded,
  CancelRounded,
  EmojiEventsOutlined,
  MenuBookOutlined,
  QuizOutlined,
  ScheduleRounded,
  TrackChangesOutlined,
  TrendingUpRounded,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";

const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";

type Difficulty = "Easy" | "Medium" | "Hard";

type RecommendedTest = {
  id: string;
  title: string;
  chapter: string;
  subject: string;
  difficulty: Difficulty;
  questions: number;
  durationMin: number;
  color: string;
  glyph: string;
};

type SeriesCard = {
  id: string;
  title: string;
  completed: number;
  total: number;
  color: string;
  Icon: typeof QuizOutlined;
};

type Attempt = {
  id: string;
  title: string;
  subject: string;
  when: string;
  scorePct: number;
  correct: number;
  total: number;
  passed: boolean;
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

function difficultyTone(level: Difficulty) {
  if (level === "Easy") return { bg: "#ECFDF5", fg: "#059669" };
  if (level === "Medium") return { bg: "#FFF7ED", fg: "#D97706" };
  return { bg: "#FEF2F2", fg: "#E11D48" };
}

const RECOMMENDED: RecommendedTest[] = [
  {
    id: "r1",
    title: "Mathematics — Chapter Test",
    chapter: "Real Numbers",
    subject: "Mathematics",
    difficulty: "Medium",
    questions: 20,
    durationMin: 30,
    color: "#10B981",
    glyph: "∑",
  },
  {
    id: "r2",
    title: "Science — Quick Quiz",
    chapter: "Chemical Reactions and Equations",
    subject: "Science",
    difficulty: "Easy",
    questions: 15,
    durationMin: 20,
    color: "#3B82F6",
    glyph: "Sc",
  },
  {
    id: "r3",
    title: "English — Practice Paper",
    chapter: "Grammar & Writing Skills",
    subject: "English",
    difficulty: "Medium",
    questions: 25,
    durationMin: 40,
    color: "#F59E0B",
    glyph: "En",
  },
  {
    id: "r4",
    title: "Social Science — Chapter Test",
    chapter: "The Rise of Nationalism in Europe",
    subject: "Social Science",
    difficulty: "Hard",
    questions: 30,
    durationMin: 45,
    color: "#6366F1",
    glyph: "SS",
  },
];

const SERIES: SeriesCard[] = [
  {
    id: "s1",
    title: "Class 10 — Full Syllabus",
    completed: 12,
    total: 20,
    color: PRIMARY,
    Icon: QuizOutlined,
  },
  {
    id: "s2",
    title: "Chapter Wise Tests",
    completed: 18,
    total: 30,
    color: "#10B981",
    Icon: MenuBookOutlined,
  },
  {
    id: "s3",
    title: "Previous Year Papers",
    completed: 5,
    total: 10,
    color: "#F59E0B",
    Icon: AssignmentOutlined,
  },
  {
    id: "s4",
    title: "Daily Practice",
    completed: 22,
    total: 28,
    color: "#3B82F6",
    Icon: TrackChangesOutlined,
  },
];

const ATTEMPTS: Attempt[] = [
  {
    id: "a1",
    title: "Real Numbers — Quiz",
    subject: "Mathematics",
    when: "Today · 09:15 AM",
    scorePct: 80,
    correct: 16,
    total: 20,
    passed: true,
  },
  {
    id: "a2",
    title: "Acids Bases & Salts",
    subject: "Science",
    when: "Yesterday · 06:40 PM",
    scorePct: 45,
    correct: 9,
    total: 20,
    passed: false,
  },
  {
    id: "a3",
    title: "Formal Letter Writing",
    subject: "English",
    when: "28 May · 04:10 PM",
    scorePct: 72,
    correct: 18,
    total: 25,
    passed: true,
  },
];

const PERF = {
  correct: 241,
  incorrect: 89,
  skipped: 26,
};

function PerformanceDonut({ average }: { average: number }) {
  const size = 160;
  const r = 54;
  const c = 2 * Math.PI * r;
  const total = PERF.correct + PERF.incorrect + PERF.skipped;
  const slices = [
    { value: PERF.correct, color: "#10B981" },
    { value: PERF.incorrect, color: PRIMARY },
    { value: PERF.skipped, color: "#F59E0B" },
  ];
  let offset = 0;

  return (
    <div className="relative mx-auto size-[160px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F2F6" strokeWidth="16" />
        {slices.map((slice, index) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[22px] font-bold text-[#1A1A1A]">{average}%</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Average</p>
        </div>
      </div>
    </div>
  );
}

export function PortalTestSeriesPage() {
  const { child, basePath, productMode } = usePortal();
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [period, setPeriod] = useState("This Month");
  const [startedId, setStartedId] = useState<string | null>(null);
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const showLms = isProductBucketAllowed(productMode, "LMS");

  const firstName = child?.student.firstName ?? "Student";

  const subjects = useMemo(() => {
    return [...new Set(RECOMMENDED.map((t) => t.subject))].sort((a, b) => a.localeCompare(b));
  }, []);

  const recommended = useMemo(() => {
    if (subjectFilter === "ALL") return RECOMMENDED;
    return RECOMMENDED.filter((t) => t.subject === subjectFilter);
  }, [subjectFilter]);

  const attempts = showAllAttempts ? ATTEMPTS : ATTEMPTS.slice(0, 3);
  const perfTotal = PERF.correct + PERF.incorrect + PERF.skipped;

  if (!showLms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Test Series & Practice</h1>
          <p className="mt-1 text-[12px] text-[#9CA3AF]">
            <Link to={basePath} className="hover:text-[#6B7280]">
              Dashboard
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-medium text-[#6B7280]">Test Series & Practice</span>
          </p>
        </div>
        <select
          className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold text-[#1A1A1A] outline-none"
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
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-[#1A1A1A]">Hi, {firstName}!</h2>
          <p className="mt-1 text-[13px] text-[#6B7280]">Practice more, perform better. Keep it up!</p>
        </div>
      </div>

      {startedId ? (
        <p className="rounded-xl border border-[#EEF0FD] bg-[#EEF0FD]/70 px-3 py-2 text-[12px] font-medium text-[#534AB7]">
          Test launch will open here when the LMS practice engine is connected.
        </p>
      ) : null}

      <p className="text-[11px] font-medium text-[#9CA3AF]">
        Preview practice data — will sync with real test series when the LMS module is connected.
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Tests Attempted",
                value: "24",
                sub: "↑ 12% this month",
                subColor: "#059669",
                Icon: AssignmentOutlined,
                bg: "#EEF0FD",
                fg: PRIMARY,
              },
              {
                label: "Average Score",
                value: "68%",
                sub: "↑ 8% this month",
                subColor: "#059669",
                Icon: BarChartRounded,
                bg: "#ECFDF5",
                fg: "#059669",
              },
              {
                label: "Best Score",
                value: "92%",
                sub: "In Mathematics",
                subColor: "#D97706",
                Icon: EmojiEventsOutlined,
                bg: "#FFF7ED",
                fg: "#D97706",
              },
              {
                label: "Questions Solved",
                value: "356",
                sub: "↑ 15% this month",
                subColor: "#059669",
                Icon: TrackChangesOutlined,
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
            <div className="border-b border-[#E5E7EB] px-5 py-4">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Recommended for You</h3>
            </div>
            {recommended.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No tests for this subject.</p>
            ) : (
              <div className="divide-y divide-[#F1F2F6]">
                {recommended.map((test) => {
                  const tone = difficultyTone(test.difficulty);
                  return (
                    <div
                      key={test.id}
                      className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap"
                    >
                      <span
                        className="grid size-11 shrink-0 place-items-center rounded-2xl text-[13px] font-bold text-white"
                        style={{ background: test.color }}
                      >
                        {test.glyph}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-[#1A1A1A]">{test.title}</p>
                        <p className="truncate text-[12px] text-[#9CA3AF]">{test.chapter}</p>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {test.difficulty}
                      </span>
                      <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <QuizOutlined sx={{ fontSize: 16 }} />
                          {test.questions} Questions
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <ScheduleRounded sx={{ fontSize: 16 }} />
                          {test.durationMin} min
                        </span>
                      </div>
                      <button
                        type="button"
                        className="rounded-xl border px-3.5 py-2 text-[12px] font-bold transition hover:bg-[#EEF0FD]"
                        style={{ borderColor: PRIMARY, color: PRIMARY }}
                        onClick={() => setStartedId(test.id)}
                      >
                        Start Test
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div>
            <h3 className="mb-3 text-[15px] font-bold text-[#1A1A1A]">Test Series</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SERIES.map((series) => {
                const pct = Math.round((series.completed / series.total) * 100);
                return (
                  <Card key={series.id} className="!p-4">
                    <span
                      className="mb-3 grid size-11 place-items-center rounded-2xl text-white"
                      style={{ background: series.color }}
                    >
                      <series.Icon sx={{ fontSize: 22 }} />
                    </span>
                    <p className="min-h-[40px] text-[13px] font-bold leading-snug text-[#1A1A1A]">
                      {series.title}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F1F2F6]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: series.color }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold" style={{ color: series.color }}>
                        {pct}%
                      </span>
                      <span className="font-semibold text-[#9CA3AF]">
                        {series.completed} / {series.total} Tests
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Performance Overview</h3>
              <select
                className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-semibold text-[#6B7280] outline-none"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>This Month</option>
                <option>Last Month</option>
                <option>This Term</option>
              </select>
            </div>
            <PerformanceDonut average={68} />
            <div className="mt-4 space-y-2">
              {[
                { label: "Correct", value: PERF.correct, color: "#10B981" },
                { label: "Incorrect", value: PERF.incorrect, color: PRIMARY },
                { label: "Skipped", value: PERF.skipped, color: "#F59E0B" },
              ].map((row) => {
                const pct = Math.round((row.value / perfTotal) * 100);
                return (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#6B7280]">
                      <span className="size-2.5 rounded-full" style={{ background: row.color }} />
                      {row.label}
                    </span>
                    <span className="font-bold text-[#1A1A1A]">
                      {row.value}{" "}
                      <span className="font-semibold text-[#9CA3AF]">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] font-medium leading-relaxed text-white"
              style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #3F3A9A 100%)` }}
            >
              <TrendingUpRounded sx={{ fontSize: 18, marginTop: "1px" }} />
              <p>You are doing better than last month! Keep practicing to improve more.</p>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Recent Test Attempts</h3>
            <div className="space-y-3">
              {attempts.map((attempt) => (
                <button
                  key={attempt.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#F1F2F6] bg-[#FBFBFC] px-3 py-3 text-left transition hover:bg-[#F6F7F9]"
                  onClick={() => setStartedId(attempt.id)}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${
                      attempt.passed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {attempt.passed ? (
                      <CheckCircleRounded sx={{ fontSize: 20 }} />
                    ) : (
                      <CancelRounded sx={{ fontSize: 20 }} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{attempt.title}</p>
                    <p className="truncate text-[11px] text-[#9CA3AF]">
                      {attempt.subject} · {attempt.when}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="text-[13px] font-bold"
                      style={{ color: attempt.passed ? "#059669" : "#E11D48" }}
                    >
                      {attempt.scorePct}%
                    </p>
                    <p className="text-[10px] font-semibold text-[#9CA3AF]">
                      {attempt.correct}/{attempt.total}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full text-center text-[12px] font-bold text-[#534AB7] hover:underline"
              onClick={() => setShowAllAttempts((v) => !v)}
            >
              {showAllAttempts ? "Show Less" : "View All Attempts →"}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
