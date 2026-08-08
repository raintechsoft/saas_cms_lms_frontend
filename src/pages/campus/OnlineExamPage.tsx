import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EmojiEventsOutlined,
  PlayArrowOutlined,
  QuizOutlined,
  RateReviewOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsKpiCard,
  CmsKpiGrid,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { ListPagination, paginateItems } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type Tab = "exams" | "questions" | "attempts" | "ranks";

interface OnlineExam {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  maxAttempts: number;
  passMarks: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  isActive: boolean;
  _count: { questions: number; attempts: number };
  academicSession: { id: string; name: string } | null;
  classSection: {
    id: string;
    academicClass: { name: string };
    section: { name: string };
  } | null;
}

interface OnlineQuestion {
  id: string;
  type: "MCQ" | "SUBJECTIVE";
  prompt: string;
  options: string[] | null;
  correctOption: number | null;
  marks: number;
  sortOrder: number;
}

interface OnlineAttempt {
  id: string;
  attemptNo: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
  score: string | number | null;
  maxScore: string | number | null;
  rank: number | null;
  startedAt: string;
  submittedAt: string | null;
  exam: { id: string; title: string; passMarks: number; status: string };
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  };
  answers: Array<{
    id: string;
    selectedOption: number | null;
    textAnswer: string | null;
    marksAwarded: string | number | null;
    question: {
      id: string;
      type: "MCQ" | "SUBJECTIVE";
      prompt: string;
      marks: number;
      options: string[] | null;
      correctOption: number | null;
    };
  }>;
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
}

interface PendingGradeRow {
  id: string;
  textAnswer: string | null;
  question: {
    id: string;
    type: "MCQ" | "SUBJECTIVE";
    prompt: string;
    marks: number;
  };
  attempt: {
    id: string;
    status: string;
    score: string | number | null;
    maxScore: string | number | null;
    exam: { id: string; title: string; passMarks: number };
    student: {
      id: string;
      admissionNumber: string;
      firstName: string;
      lastName: string | null;
    };
  };
}

interface Summary {
  exams: number;
  published: number;
  questions: number;
  attempts: number;
  pendingGrade: number;
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "exams", label: "Exams", shortLabel: "Exams", icon: QuizOutlined, tone: "violet" },
  { key: "questions", label: "Questions", shortLabel: "Ques", icon: AddOutlined, tone: "indigo" },
  { key: "attempts", label: "Attempts", shortLabel: "Attempts", icon: PlayArrowOutlined, tone: "sky" },
  { key: "ranks", label: "Ranks", shortLabel: "Ranks", icon: EmojiEventsOutlined, tone: "amber" },
];

const PAGE_SIZE = 8;

function studentLabel(s: { firstName: string; lastName: string | null; admissionNumber?: string }) {
  const name = `${s.firstName} ${s.lastName ?? ""}`.trim();
  return s.admissionNumber ? `${s.admissionNumber} · ${name}` : name;
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function OnlineExamPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("exams");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [questions, setQuestions] = useState<OnlineQuestion[]>([]);
  const [attempts, setAttempts] = useState<OnlineAttempt[]>([]);
  const [pendingGrades, setPendingGrades] = useState<PendingGradeRow[]>([]);
  const [ranks, setRanks] = useState<OnlineAttempt[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [showExamForm, setShowExamForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [passMarks, setPassMarks] = useState("0");
  const [qType, setQType] = useState<"MCQ" | "SUBJECTIVE">("MCQ");
  const [qPrompt, setQPrompt] = useState("");
  const [qOptions, setQOptions] = useState("Option A\nOption B\nOption C\nOption D");
  const [qCorrect, setQCorrect] = useState("0");
  const [qMarks, setQMarks] = useState("1");
  const [attemptStudentId, setAttemptStudentId] = useState("");
  const [activeAttempt, setActiveAttempt] = useState<OnlineAttempt | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, { selectedOption?: string; textAnswer?: string }>>({});
  const [gradeDraft, setGradeDraft] = useState<Record<string, string>>({});

  const canManage = user?.permissions.includes("online_exam.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(exams, page, PAGE_SIZE), [exams, page]);
  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) ?? null,
    [exams, selectedExamId],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(exams.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [exams.length, page]);

  function resetExamForm() {
    setTitle("");
    setDescription("");
    setDurationMinutes("60");
    setMaxAttempts("1");
    setPassMarks("0");
    setShowExamForm(false);
  }

  async function load() {
    try {
      const [summaryRow, examRows, attemptRows, pendingRows, studentList] = await Promise.all([
        apiRequest<Summary>("/online-exams/summary", accessToken),
        apiRequest<OnlineExam[]>("/online-exams", accessToken),
        apiRequest<OnlineAttempt[]>("/online-exams/attempts/list", accessToken),
        apiRequest<PendingGradeRow[]>("/online-exams/pending-grades", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken).catch(
          () => ({ items: [] as StudentOption[] }),
        ),
      ]);
      setSummary(summaryRow);
      setExams(Array.isArray(examRows) ? examRows : []);
      setAttempts(Array.isArray(attemptRows) ? attemptRows : []);
      setPendingGrades(Array.isArray(pendingRows) ? pendingRows : []);
      setStudents(studentList.items ?? []);
      if (!selectedExamId && examRows[0]) setSelectedExamId(examRows[0].id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load online exams");
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestions(examId: string) {
    if (!examId) {
      setQuestions([]);
      return;
    }
    try {
      setQuestions(await apiRequest<OnlineQuestion[]>(`/online-exams/${examId}/questions`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load questions");
    }
  }

  async function loadRanks(examId: string) {
    if (!examId) {
      setRanks([]);
      return;
    }
    try {
      const data = await apiRequest<{ rows: OnlineAttempt[] }>(`/online-exams/${examId}/ranks`, accessToken);
      setRanks(data.rows ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load ranks");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (selectedExamId) {
      void loadQuestions(selectedExamId);
      void loadRanks(selectedExamId);
    }
  }, [selectedExamId, accessToken]);

  async function saveExam(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    try {
      await apiRequest("/online-exams", accessToken, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          durationMinutes: Number(durationMinutes) || 60,
          maxAttempts: Number(maxAttempts) || 1,
          passMarks: Number(passMarks) || 0,
          status: "DRAFT",
        }),
      });
      notifySuccess("Online exam created");
      resetExamForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create exam");
    } finally {
      setSubmitting(false);
    }
  }

  async function setExamStatus(id: string, status: "DRAFT" | "PUBLISHED" | "CLOSED") {
    if (!canManage) return;
    try {
      await apiRequest(`/online-exams/${id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      notifySuccess(`Exam marked ${status.toLowerCase()}`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update exam");
    }
  }

  async function allowMoreAttempts(exam: OnlineExam) {
    if (!canManage) return;
    try {
      await apiRequest(`/online-exams/${exam.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ maxAttempts: exam.maxAttempts + 1 }),
      });
      notifySuccess(`Max attempts set to ${exam.maxAttempts + 1}`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update attempts");
    }
  }

  async function removeExam(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete online exam?",
      text: "Questions and attempts for this exam will be removed.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/online-exams/${id}`, accessToken, { method: "DELETE" });
      if (selectedExamId === id) setSelectedExamId("");
      notifySuccess("Exam deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete exam");
    }
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !selectedExamId) return;
    setSubmitting(true);
    try {
      const options =
        qType === "MCQ"
          ? qOptions
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          : null;
      await apiRequest(`/online-exams/${selectedExamId}/questions`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          type: qType,
          prompt: qPrompt,
          options,
          correctOption: qType === "MCQ" ? Number(qCorrect) || 0 : null,
          marks: Number(qMarks) || 1,
          sortOrder: questions.length,
        }),
      });
      notifySuccess("Question added");
      setQPrompt("");
      setQMarks(qType === "MCQ" ? "1" : "5");
      await loadQuestions(selectedExamId);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add question");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeQuestion(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({ title: "Delete question?", text: "Related answers will be removed." });
    if (!ok) return;
    try {
      await apiRequest(`/online-exams/questions/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Question deleted");
      await loadQuestions(selectedExamId);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete question");
    }
  }

  async function startAttempt(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !selectedExamId || !attemptStudentId) return;
    setSubmitting(true);
    try {
      const attempt = await apiRequest<OnlineAttempt>("/online-exams/attempts/start", accessToken, {
        method: "POST",
        body: JSON.stringify({ examId: selectedExamId, studentId: attemptStudentId }),
      });
      const detail = await apiRequest<OnlineExam & { questions: OnlineQuestion[] }>(
        `/online-exams/${selectedExamId}`,
        accessToken,
      );
      setActiveAttempt({
        ...attempt,
        answers: (detail.questions ?? []).map((question) => ({
          id: "",
          selectedOption: null,
          textAnswer: null,
          marksAwarded: null,
          question,
        })),
      });
      setAnswerDraft({});
      notifySuccess("Attempt started");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to start attempt");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAttempt(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !activeAttempt) return;
    setSubmitting(true);
    try {
      const answers = activeAttempt.answers.map((row) => ({
        questionId: row.question.id,
        selectedOption:
          answerDraft[row.question.id]?.selectedOption != null &&
          answerDraft[row.question.id]?.selectedOption !== ""
            ? Number(answerDraft[row.question.id]?.selectedOption)
            : null,
        textAnswer: answerDraft[row.question.id]?.textAnswer ?? null,
      }));
      const result = await apiRequest<OnlineAttempt>(
        `/online-exams/attempts/${activeAttempt.id}/submit`,
        accessToken,
        { method: "POST", body: JSON.stringify({ answers }) },
      );
      setActiveAttempt(null);
      notifySuccess(`Attempt submitted · score ${result.score ?? 0}`);
      await load();
      await loadRanks(selectedExamId);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit attempt");
    } finally {
      setSubmitting(false);
    }
  }

  async function gradeAnswer(answerId: string, maxMarks: number) {
    if (!canManage) return;
    const marks = Number(gradeDraft[answerId]);
    if (Number.isNaN(marks) || marks < 0 || marks > maxMarks) {
      notifyError(`Enter marks between 0 and ${maxMarks}`);
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/online-exams/answers/${answerId}/grade`, accessToken, {
        method: "POST",
        body: JSON.stringify({ marksAwarded: marks }),
      });
      notifySuccess("Subjective answer graded");
      await load();
      await loadRanks(selectedExamId);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to grade answer");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingSubjective = useMemo(() => {
    if (selectedExamId) {
      return pendingGrades.filter((row) => row.attempt.exam.id === selectedExamId);
    }
    return pendingGrades;
  }, [pendingGrades, selectedExamId]);

  return (
    <CmsPage>
      <CmsPageHeader
        title="Online Exam"
        description="Create MCQ/subjective exams, record attempts, grade, and rank students."
        actions={
          canManage && tab === "exams" ? (
            <button
              type="button"
              className="nx-btn-primary inline-flex items-center gap-1.5"
              onClick={() => setShowExamForm((v) => !v)}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showExamForm ? "Close form" : "Add exam"}
            </button>
          ) : null
        }
      />

      <CmsKpiGrid>
        <CmsKpiCard icon={<QuizOutlined sx={{ fontSize: 20 }} />} label="Exams" value={summary?.exams ?? 0} tint="#7c3aed" />
        <CmsKpiCard icon={<PlayArrowOutlined sx={{ fontSize: 20 }} />} label="Published" value={summary?.published ?? 0} tint="#4f46e5" />
        <CmsKpiCard icon={<AddOutlined sx={{ fontSize: 20 }} />} label="Attempts" value={summary?.attempts ?? 0} tint="#0284c7" />
        <button type="button" className="text-left" onClick={() => setTab("attempts")}>
          <CmsKpiCard
            icon={<RateReviewOutlined sx={{ fontSize: 20 }} />}
            label="Pending grade"
            value={summary?.pendingGrade ?? pendingGrades.length}
            tint="#d97706"
          />
        </button>
      </CmsKpiGrid>

      <CmsIconTabs
        ariaLabel="Online exam sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        items={TABS}
      />

      <CmsScrollBody className="space-y-4 pt-4">
        {(tab === "questions" || tab === "attempts" || tab === "ranks") && (
          <CmsSectionCard className="p-4">
            <label className="block max-w-md">
              <span className="nx-label">Working exam</span>
              <select
                className="nx-input w-full"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                <option value="">{exams.length ? "Select exam" : "No exams yet"}</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} · {exam.status} · {exam._count.questions} Q
                  </option>
                ))}
              </select>
            </label>
          </CmsSectionCard>
        )}

        {tab === "exams" ? (
          <>
            {canManage && showExamForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-slate-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50/40 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-900">Add online exam</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Create as draft, add questions, then publish.</p>
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveExam}>
                  <label className="sm:col-span-2">
                    <span className="nx-label">Title *</span>
                    <input className="nx-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Duration (min)</span>
                    <input className="nx-input w-full" type="number" min="5" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Max attempts</span>
                    <input className="nx-input w-full" type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Pass marks</span>
                    <input className="nx-input w-full" type="number" min="0" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} />
                  </label>
                  <label className="sm:col-span-2 lg:col-span-3">
                    <span className="nx-label">Description</span>
                    <textarea className="nx-input w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </label>
                  <div className="flex gap-2 sm:col-span-3">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>Create exam</button>
                    <button type="button" className="nx-btn-secondary" onClick={resetExamForm}>Cancel</button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Exam list</h2>
                <p className="text-xs text-slate-500">{exams.length} exam{exams.length === 1 ? "" : "s"}</p>
              </div>
              {loading ? (
                <EmptyState icon={<QuizOutlined />} title="Loading exams…" />
              ) : !exams.length ? (
                <EmptyState icon={<QuizOutlined />} title="No online exams yet" hint="Add an exam, then questions, then record attempts." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Exam</th>
                          <th>Status</th>
                          <th>Questions</th>
                          <th>Attempts</th>
                          <th>Pass</th>
                          {canManage ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((exam) => (
                          <tr key={exam.id}>
                            <td>
                              <p className="font-semibold text-slate-900">{exam.title}</p>
                              <p className="text-xs text-slate-500">{exam.durationMinutes} min · max {exam.maxAttempts} attempt(s)</p>
                            </td>
                            <td>
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{exam.status}</span>
                            </td>
                            <td>{exam._count.questions}</td>
                            <td>{exam._count.attempts}</td>
                            <td>{exam.passMarks}</td>
                            {canManage ? (
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => { setSelectedExamId(exam.id); setTab("questions"); }}>
                                    Questions
                                  </button>
                                  {exam.status !== "PUBLISHED" ? (
                                    <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => void setExamStatus(exam.id, "PUBLISHED")}>Publish</button>
                                  ) : (
                                    <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => void setExamStatus(exam.id, "CLOSED")}>Close</button>
                                  )}
                                  <button
                                    type="button"
                                    className="nx-btn-secondary !px-2 !py-1 text-xs"
                                    title="Let students attempt again"
                                    onClick={() => void allowMoreAttempts(exam)}
                                  >
                                    +1 attempt
                                  </button>
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs text-rose-700" onClick={() => void removeExam(exam.id)}>
                                    <DeleteOutline sx={{ fontSize: 14 }} />
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={exams.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "questions" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <CmsSectionCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900">Add question</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {selectedExam ? `For ${selectedExam.title}` : "Select a working exam first."}
              </p>
              {canManage && selectedExamId ? (
                <form className="mt-4 grid gap-3" onSubmit={saveQuestion}>
                  <label>
                    <span className="nx-label">Type</span>
                    <select className="nx-input w-full" value={qType} onChange={(e) => setQType(e.target.value as "MCQ" | "SUBJECTIVE")}>
                      <option value="MCQ">MCQ</option>
                      <option value="SUBJECTIVE">Subjective</option>
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Prompt *</span>
                    <textarea className="nx-input w-full" rows={3} value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} required />
                  </label>
                  {qType === "MCQ" ? (
                    <>
                      <label>
                        <span className="nx-label">Options (one per line) *</span>
                        <textarea className="nx-input w-full" rows={4} value={qOptions} onChange={(e) => setQOptions(e.target.value)} required />
                      </label>
                      <label>
                        <span className="nx-label">Correct option index (0-based)</span>
                        <input className="nx-input w-full" type="number" min="0" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} />
                      </label>
                    </>
                  ) : null}
                  <label>
                    <span className="nx-label">Marks</span>
                    <input className="nx-input w-full" type="number" min="1" value={qMarks} onChange={(e) => setQMarks(e.target.value)} />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Add question</button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Select an exam and ensure you have manage permission.</p>
              )}
            </CmsSectionCard>
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Question bank</h2>
              </div>
              {!questions.length ? (
                <EmptyState icon={<AddOutlined />} title="No questions yet" />
              ) : (
                <div className="divide-y divide-slate-100">
                  {questions.map((question, index) => (
                    <div key={question.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">Q{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{question.prompt}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {question.type} · {question.marks} mark{question.marks === 1 ? "" : "s"}
                          {question.type === "MCQ" && Array.isArray(question.options)
                            ? ` · ${question.options.length} options · correct #${question.correctOption}`
                            : ""}
                        </p>
                      </div>
                      {canManage ? (
                        <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs text-rose-700" onClick={() => void removeQuestion(question.id)}>
                          <DeleteOutline sx={{ fontSize: 14 }} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "attempts" ? (
          <div className="space-y-4">
            <CmsSectionCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900">Grade subjective answers</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Student portal shows MCQ score only until you save subjective marks here.
              </p>
              {!pendingSubjective.length ? (
                <p className="mt-4 text-sm text-slate-500">No pending subjective answers{selectedExamId ? " for this exam" : ""}.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {pendingSubjective.map((row) => (
                    <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {studentLabel(row.attempt.student)} · {row.attempt.exam.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{row.question.prompt}</p>
                      <p className="mt-2 rounded-lg bg-white p-2 text-sm text-slate-800">{row.textAnswer || "—"}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Current auto score (MCQ): {row.attempt.score ?? 0} / {row.attempt.maxScore ?? "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <label>
                          <span className="nx-label">Marks / {row.question.marks}</span>
                          <input
                            className="nx-input w-28"
                            type="number"
                            min="0"
                            max={row.question.marks}
                            value={gradeDraft[row.id] ?? ""}
                            onChange={(e) => setGradeDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          />
                        </label>
                        <button
                          type="button"
                          className="nx-btn-primary"
                          disabled={submitting || !canManage}
                          onClick={() => void gradeAnswer(row.id, row.question.marks)}
                        >
                          Save marks
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CmsSectionCard>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <CmsSectionCard className="p-5">
                <h2 className="text-sm font-bold text-slate-900">Start attempt (admin)</h2>
                <p className="mt-0.5 text-xs text-slate-500">Record a student attempt from the campus desk.</p>
                {canManage && selectedExamId ? (
                  <form className="mt-4 grid gap-3" onSubmit={startAttempt}>
                    <label>
                      <span className="nx-label">Student *</span>
                      <select className="nx-input w-full" value={attemptStudentId} onChange={(e) => setAttemptStudentId(e.target.value)} required>
                        <option value="">Select student</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>{studentLabel(student)}</option>
                        ))}
                      </select>
                    </label>
                    <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Start attempt</button>
                  </form>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Select an exam first.</p>
                )}
              </CmsSectionCard>

              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h2 className="text-sm font-bold text-slate-900">Recent attempts</h2>
                </div>
                {!attempts.length ? (
                  <EmptyState icon={<PlayArrowOutlined />} title="No attempts yet" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Exam</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempts.slice(0, 20).map((attempt) => (
                          <tr key={attempt.id}>
                            <td className="font-semibold text-slate-900">{studentLabel(attempt.student)}</td>
                            <td>{attempt.exam.title}</td>
                            <td>{attempt.status}</td>
                            <td>{attempt.score ?? "—"} / {attempt.maxScore ?? "—"}</td>
                            <td>{attempt.rank ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CmsSectionCard>
            </div>

            {activeAttempt ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-sm font-bold text-slate-900">
                  Answer paper · {studentLabel(activeAttempt.student)} · {activeAttempt.exam.title}
                </h2>
                <form className="mt-4 space-y-4" onSubmit={submitAttempt}>
                  {activeAttempt.answers.map((row, index) => (
                    <div key={row.question.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">Q{index + 1}. {row.question.prompt}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.question.type} · {row.question.marks} marks</p>
                      {row.question.type === "MCQ" ? (
                        <div className="mt-3 grid gap-2">
                          {(Array.isArray(row.question.options) ? row.question.options : []).map((option, optIndex) => (
                            <label key={`${row.question.id}-${optIndex}`} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={`q-${row.question.id}`}
                                checked={answerDraft[row.question.id]?.selectedOption === String(optIndex)}
                                onChange={() =>
                                  setAnswerDraft((prev) => ({
                                    ...prev,
                                    [row.question.id]: { selectedOption: String(optIndex) },
                                  }))
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <textarea
                          className="nx-input mt-3 w-full"
                          rows={3}
                          placeholder="Student answer"
                          value={answerDraft[row.question.id]?.textAnswer ?? ""}
                          onChange={(e) =>
                            setAnswerDraft((prev) => ({
                              ...prev,
                              [row.question.id]: { textAnswer: e.target.value },
                            }))
                          }
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>Submit attempt</button>
                    <button type="button" className="nx-btn-secondary" onClick={() => setActiveAttempt(null)}>Cancel</button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}
          </div>
        ) : null}

        {tab === "ranks" ? (
          <CmsSectionCard className="overflow-hidden !p-0">
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">
                Rank list {selectedExam ? `· ${selectedExam.title}` : ""}
              </h2>
            </div>
            {!selectedExamId ? (
              <EmptyState icon={<EmojiEventsOutlined />} title="Select an exam" />
            ) : !ranks.length ? (
              <EmptyState icon={<EmojiEventsOutlined />} title="No ranked attempts yet" hint="Submit graded attempts to populate ranks." />
            ) : (
              <div className="overflow-x-auto">
                <table className="nx-table min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranks.map((row) => (
                      <tr key={row.id}>
                        <td className="font-bold text-amber-700">{row.rank ?? "—"}</td>
                        <td>{studentLabel(row.student)}</td>
                        <td>{row.score ?? "—"} / {row.maxScore ?? "—"}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CmsSectionCard>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
