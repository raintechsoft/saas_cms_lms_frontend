import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircleRounded,
  EmojiEventsOutlined,
  PlayArrowOutlined,
  QuizOutlined,
  ScheduleRounded,
  TrackChangesOutlined,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { notifyError, notifySuccess } from "../../lib/notify";
import { usePortal } from "./PortalContext";

const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";

type PortalExam = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  maxAttempts: number;
  passMarks: number;
  questionCount: number;
  attemptsUsed: number;
  attemptsRemaining: number;
  canAttempt: boolean;
  latestAttempt: {
    id: string;
    status: string;
    score: string | number | null;
    maxScore: string | number | null;
    rank: number | null;
  } | null;
  inProgressAttempt: { id: string; status: string } | null;
};

type PortalQuestion = {
  id: string;
  type: "MCQ" | "SUBJECTIVE";
  prompt: string;
  options: string[] | null;
  marks: number;
  sortOrder: number;
};

type PortalPaper = {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passMarks: number;
  questions: PortalQuestion[];
};

type PortalAttemptRow = {
  id: string;
  attemptNo: number;
  status: string;
  score: string | number | null;
  maxScore: string | number | null;
  rank: number | null;
  startedAt: string;
  submittedAt: string | null;
  passed: boolean | null;
  resultPending?: boolean;
  exam: { id: string; title: string; passMarks: number };
};

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </section>
  );
}

export function PortalTestSeriesPage() {
  const { child, basePath, productMode, accessToken, role } = usePortal();
  const [exams, setExams] = useState<PortalExam[]>([]);
  const [attempts, setAttempts] = useState<PortalAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [paper, setPaper] = useState<PortalPaper | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, { selectedOption?: string; textAnswer?: string }>
  >({});
  const [endsAtMs, setEndsAtMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const showCms = isProductBucketAllowed(productMode, "CMS");
  const isStudent = role === "STUDENT";
  const firstName = child?.student.firstName ?? "Student";
  const studentId = child?.student.id;

  const remainingSec = useMemo(() => {
    if (!endsAtMs) return null;
    return Math.max(0, Math.floor((endsAtMs - nowMs) / 1000));
  }, [endsAtMs, nowMs]);

  const load = useCallback(async () => {
    if (!studentId || !accessToken) return;
    setLoading(true);
    try {
      const [examRows, attemptRows] = await Promise.all([
        apiRequest<PortalExam[]>(`/portal/children/${studentId}/online-exams`, accessToken),
        apiRequest<PortalAttemptRow[]>(
          `/portal/children/${studentId}/online-exams/attempts`,
          accessToken,
        ),
      ]);
      setExams(Array.isArray(examRows) ? examRows : []);
      setAttempts(Array.isArray(attemptRows) ? attemptRows : []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load online exams");
    } finally {
      setLoading(false);
    }
  }, [studentId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeAttemptId || endsAtMs == null) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttemptId, endsAtMs]);

  async function startExam(examId: string) {
    if (!studentId || !accessToken || !isStudent) return;
    setSubmitting(true);
    try {
      const data = await apiRequest<{
        attempt: { id: string; startedAt: string };
        paper: PortalPaper;
      }>(`/portal/children/${studentId}/online-exams/${examId}/attempts`, accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setActiveAttemptId(data.attempt.id);
      setPaper(data.paper);
      setAnswers({});
      setEndsAtMs(
        new Date(data.attempt.startedAt).getTime() + data.paper.durationMinutes * 60_000,
      );
      notifySuccess("Exam started — answer and submit before time ends");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to start exam");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExam(event?: FormEvent) {
    event?.preventDefault();
    if (!studentId || !accessToken || !activeAttemptId || !paper) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: paper.questions.map((question) => ({
          questionId: question.id,
          selectedOption:
            answers[question.id]?.selectedOption != null &&
            answers[question.id]?.selectedOption !== ""
              ? Number(answers[question.id]?.selectedOption)
              : null,
          textAnswer: answers[question.id]?.textAnswer ?? null,
        })),
      };
      const result = await apiRequest<{
        score: string | number | null;
        maxScore: string | number | null;
        status: string;
        resultPending?: boolean;
      }>(
        `/portal/children/${studentId}/online-exams/attempts/${activeAttemptId}/submit`,
        accessToken,
        { method: "POST", body: JSON.stringify(payload) },
      );
      if (result.resultPending || result.status === "SUBMITTED") {
        notifySuccess("Submitted. Result will appear after teacher grades subjective answers.");
      } else {
        notifySuccess(
          `Result ready · ${result.score ?? "—"} / ${result.maxScore ?? "—"}`,
        );
      }
      setActiveAttemptId(null);
      setPaper(null);
      setEndsAtMs(null);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit exam");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (remainingSec === 0 && activeAttemptId && paper && !submitting) {
      void submitExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec]);

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  const timerLabel =
    remainingSec == null
      ? null
      : `${String(Math.floor(remainingSec / 60)).padStart(2, "0")}:${String(remainingSec % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Online Exams</h1>
          <p className="mt-1 text-[12px] text-[#9CA3AF]">
            <Link to={basePath} className="hover:text-[#6B7280]">
              Dashboard
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-medium text-[#6B7280]">Online Exams</span>
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-[22px] font-bold text-[#1A1A1A]">Hi, {firstName}!</h2>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {isStudent
            ? "Take published online exams and track your attempts."
            : "View published exams and your child’s attempt history."}
        </p>
      </div>

      {paper && activeAttemptId ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#1A1A1A]">{paper.title}</h3>
              <p className="text-[12px] text-[#6B7280]">
                {paper.questions.length} questions · pass {paper.passMarks}
              </p>
            </div>
            {timerLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#EEF0FD] px-3 py-2 text-sm font-bold text-[#534AB7]">
                <ScheduleRounded sx={{ fontSize: 18 }} />
                {timerLabel}
              </span>
            ) : null}
          </div>
          <form className="space-y-4" onSubmit={submitExam}>
            {paper.questions.map((question, index) => (
              <div key={question.id} className="rounded-2xl border border-[#E5E7EB] p-4">
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  Q{index + 1}. {question.prompt}
                </p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  {question.type} · {question.marks} mark{question.marks === 1 ? "" : "s"}
                </p>
                {question.type === "MCQ" ? (
                  <div className="mt-3 grid gap-2">
                    {(question.options ?? []).map((option, optIndex) => (
                      <label key={`${question.id}-${optIndex}`} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          checked={answers[question.id]?.selectedOption === String(optIndex)}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: { selectedOption: String(optIndex) },
                            }))
                          }
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#534AB7]"
                    rows={3}
                    placeholder="Write your answer"
                    value={answers[question.id]?.textAnswer ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: { textAnswer: e.target.value },
                      }))
                    }
                  />
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: PRIMARY }}
              >
                Submit exam
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280]"
                onClick={() => {
                  setActiveAttemptId(null);
                  setPaper(null);
                  setEndsAtMs(null);
                }}
              >
                Close (keep in progress)
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TrackChangesOutlined sx={{ fontSize: 20, color: PRIMARY }} />
            <h3 className="text-base font-bold text-[#1A1A1A]">Available exams</h3>
          </div>
          {loading ? (
            <p className="text-sm text-[#6B7280]">Loading…</p>
          ) : !exams.length ? (
            <div className="rounded-2xl bg-[#F8F9FC] px-4 py-10 text-center">
              <QuizOutlined sx={{ fontSize: 28, color: "#9CA3AF" }} />
              <p className="mt-2 text-sm font-semibold text-[#1A1A1A]">No published exams yet</p>
              <p className="mt-1 text-xs text-[#6B7280]">
                When your school publishes an online exam, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] p-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1A1A1A]">{exam.title}</p>
                    <p className="mt-1 text-[12px] text-[#6B7280]">
                      {exam.questionCount} Q · {exam.durationMinutes} min · pass {exam.passMarks} ·{" "}
                      {exam.attemptsRemaining} attempt(s) left
                    </p>
                    {exam.latestAttempt ? (
                      <p className="mt-1 text-[11px] font-medium text-[#534AB7]">
                        Latest: {exam.latestAttempt.status}
                        {exam.latestAttempt.status === "GRADED" && exam.latestAttempt.score != null
                          ? ` · ${exam.latestAttempt.score}/${exam.latestAttempt.maxScore ?? "—"}`
                          : exam.latestAttempt.status === "SUBMITTED"
                            ? " · result pending teacher grade"
                            : ""}
                      </p>
                    ) : null}
                  </div>
                  {isStudent ? (
                    <button
                      type="button"
                      disabled={submitting || (!exam.canAttempt && !exam.inProgressAttempt)}
                      onClick={() => void startExam(exam.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: PRIMARY }}
                    >
                      <PlayArrowOutlined sx={{ fontSize: 18 }} />
                      {exam.inProgressAttempt ? "Continue" : "Start"}
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#9CA3AF]">View only</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <EmojiEventsOutlined sx={{ fontSize: 20, color: PRIMARY }} />
            <h3 className="text-base font-bold text-[#1A1A1A]">My attempts</h3>
          </div>
          {!attempts.length ? (
            <p className="text-sm text-[#6B7280]">No attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {attempts.slice(0, 12).map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-[#E5E7EB] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{row.exam.title}</p>
                      <p className="text-[11px] text-[#6B7280]">
                        Attempt #{row.attemptNo} · {row.status}
                      </p>
                    </div>
                    {row.status === "GRADED" && row.passed != null ? (
                      row.passed ? (
                        <CheckCircleRounded sx={{ fontSize: 18, color: "#059669" }} />
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-[#E11D48]">Fail</span>
                      )
                    ) : row.status === "SUBMITTED" ? (
                      <span className="text-[10px] font-bold uppercase text-amber-700">Pending</span>
                    ) : null}
                  </div>
                  {row.status === "GRADED" ? (
                    <p className="mt-1 text-[12px] font-medium text-[#534AB7]">
                      Score {row.score ?? "—"} / {row.maxScore ?? "—"}
                      {row.rank != null ? ` · Rank #${row.rank}` : ""}
                      {row.passed == null ? "" : row.passed ? " · Pass" : " · Fail"}
                    </p>
                  ) : row.status === "SUBMITTED" ? (
                    <p className="mt-1 text-[11px] font-medium text-amber-700">
                      Submitted. Score and Pass/Fail will show after teacher grades.
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-[#6B7280]">In progress</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
