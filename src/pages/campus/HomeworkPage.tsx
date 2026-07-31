import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  AssignmentTurnedInOutlined,
  AttachFileOutlined,
  ReplayOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Named {
  id: string;
  name: string;
}
interface Student {
  firstName: string;
  lastName: string | null;
  admissionNumber: string;
}
interface ClassSection {
  id: string;
  academicSessionId: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named }>;
}
interface Homework {
  id: string;
  title: string;
  description: string;
  attachmentUrl: string | null;
  homeworkDate: string;
  submissionDate: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
  teacher: { firstName: string; lastName: string };
  _count: { submissions: number };
  submissions?: Array<{
    id: string;
    status: Submission["status"];
    review: string | null;
    attempt: number;
  }>;
}
interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  classSections: ClassSection[];
  homework: Homework[];
  studentEnrollments: Array<{ id: string; classSectionId: string }>;
}
interface Submission {
  id: string;
  status: "SUBMITTED" | "EVALUATED" | "RESUBMIT_REQUESTED" | "COMPLETED";
  attempt: number;
  answerText: string | null;
  attachmentUrl: string | null;
  review: string | null;
}
interface RosterItem {
  id: string;
  rollNumber: string | null;
  student: Student;
  homeworkSubmissions: Submission[];
}
interface HomeworkRoster {
  homework: Homework;
  roster: RosterItem[];
}
interface ReportRow {
  homework: Homework;
  assigned: number;
  submitted: number;
  completed: number;
  resubmitRequested: number;
  due: number;
  progressPercent: number;
}

const today = new Date().toISOString().slice(0, 10);

const STATUS_PILL: Record<Homework["status"], string> = {
  PUBLISHED: "nx-pill-success",
  DRAFT: "nx-pill-warning",
  CLOSED: "nx-pill-neutral",
};

const SUBMISSION_PILL: Record<Submission["status"], string> = {
  SUBMITTED: "nx-pill-indigo",
  EVALUATED: "nx-pill-warning",
  RESUBMIT_REQUESTED: "nx-pill-danger",
  COMPLETED: "nx-pill-success",
};

const SUBMISSION_LABEL: Record<Submission["status"], string> = {
  SUBMITTED: "Submitted",
  EVALUATED: "Evaluated",
  RESUBMIT_REQUESTED: "Resubmit Requested",
  COMPLETED: "Completed",
};

function sectionLabel(section: ClassSection) {
  return `${section.academicClass.name} - ${section.section.name}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HomeworkPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<"assignments" | "evaluate" | "reports">("assignments");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);

  const canManage = Boolean(user?.permissions.includes("homework.manage"));
  const canEvaluate = Boolean(user?.permissions.includes("homework.evaluate"));
  const canSubmit = Boolean(user?.permissions.includes("homework.submit"));

  async function load() {
    setLoading(true);
    try {
      setSetup(await apiRequest<Setup>("/homework/setup", accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load homework");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const TABS = [
    ["assignments", "Assignments"],
    ...(canEvaluate
      ? ([
          ["evaluate", "Submissions & Evaluation"],
          ["reports", "Reports"],
        ] as const)
      : []),
  ] as Array<[typeof tab, string]>;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Homework Management"
        description="Assign work, accept submissions, evaluate, request resubmission, and track completion."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {setup?.currentSession ? (
              <span className="nx-pill nx-pill-indigo">{setup.currentSession.name}</span>
            ) : (
              <span className="nx-pill nx-pill-warning">No active session</span>
            )}
            <span className="nx-pill nx-pill-neutral">
              {setup?.homework.length ?? 0} assignments
            </span>
          </div>
        }
      />

      <CmsTabs>
        {TABS.map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </CmsTab>
        ))}
      </CmsTabs>

      <CmsScrollBody>
        {!setup ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            {loading ? "Loading homework…" : "Unable to load homework."}
          </p>
        ) : (
          <>
            {tab === "assignments" ? (
              <AssignmentsPanel
                setup={setup}
                token={accessToken}
                canManage={canManage}
                canSubmit={canSubmit}
                onSaved={load}
              />
            ) : null}
            {tab === "evaluate" ? <EvaluatePanel setup={setup} token={accessToken} /> : null}
            {tab === "reports" ? <ReportsPanel setup={setup} token={accessToken} /> : null}
          </>
        )}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}

function AssignmentsPanel({
  setup,
  token,
  canManage,
  canSubmit,
  onSaved,
}: {
  setup: Setup;
  token: string;
  canManage: boolean;
  canSubmit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    classSectionId: "",
    classSubjectId: "",
    title: "",
    description: "",
    attachmentUrl: "",
    homeworkDate: today,
    submissionDate: today,
    status: "PUBLISHED",
  });
  const [busy, setBusy] = useState(false);

  const formSection = setup.classSections.find(({ id }) => id === form.classSectionId);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return setup.homework
      .filter((item) => !sectionFilter || item.classSection.id === sectionFilter)
      .filter((item) => !statusFilter || item.status === statusFilter)
      .filter(
        (item) =>
          !query ||
          item.title.toLowerCase().includes(query) ||
          item.classSubject.subject.name.toLowerCase().includes(query),
      );
  }, [setup.homework, sectionFilter, statusFilter, search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession) {
      notifyError("Homework requires an active academic session");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/homework", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          academicSessionId: setup.currentSession.id,
          attachmentUrl: form.attachmentUrl || null,
        }),
      });
      setForm({ ...form, title: "", description: "", attachmentUrl: "" });
      notifySuccess("Homework published");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mt-4 grid gap-4 ${canManage ? "xl:grid-cols-[380px_1fr]" : ""}`}>
      {canManage ? (
        <form className="nx-card h-fit p-5" onSubmit={submit}>
          <h2 className="text-[14px] font-bold text-slate-900">Create homework</h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            Published homework is visible to students of the selected class.
          </p>
          <label className="mt-4 block">
            <span className="nx-label">Class Section *</span>
            <select
              className="nx-input mt-1 w-full"
              required
              value={form.classSectionId}
              onChange={(e) =>
                setForm({ ...form, classSectionId: e.target.value, classSubjectId: "" })
              }
            >
              <option value="">Select class section</option>
              {setup.classSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {sectionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="nx-label">Subject *</span>
            <select
              className="nx-input mt-1 w-full"
              required
              value={form.classSubjectId}
              onChange={(e) => setForm({ ...form, classSubjectId: e.target.value })}
            >
              <option value="">Select subject</option>
              {formSection?.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block">
            <span className="nx-label">Title *</span>
            <input
              className="nx-input mt-1 w-full"
              required
              placeholder="Homework title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="mt-3 block">
            <span className="nx-label">Instructions *</span>
            <textarea
              className="nx-input mt-1 w-full"
              rows={3}
              required
              placeholder="What should students do?"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="mt-3 block">
            <span className="nx-label">Attachment URL</span>
            <input
              className="nx-input mt-1 w-full"
              type="url"
              placeholder="https://… (optional)"
              value={form.attachmentUrl}
              onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="nx-label">Homework Date</span>
              <input
                className="nx-input mt-1 w-full"
                type="date"
                value={form.homeworkDate}
                onChange={(e) => setForm({ ...form, homeworkDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="nx-label">Submission Date</span>
              <input
                className="nx-input mt-1 w-full"
                type="date"
                value={form.submissionDate}
                onChange={(e) => setForm({ ...form, submissionDate: e.target.value })}
              />
            </label>
          </div>
          <button className="nx-btn-primary mt-4 w-full" disabled={busy}>
            <AddOutlined sx={{ fontSize: 16 }} /> {busy ? "Publishing…" : "Publish homework"}
          </button>
        </form>
      ) : null}

      <div className="min-w-0 space-y-4">
        <div className="nx-card flex flex-wrap items-end justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="nx-label">Class</span>
              <select
                className="nx-input mt-1 w-44"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
              >
                <option value="">All Classes</option>
                {setup.classSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {sectionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="nx-label">Status</span>
              <select
                className="nx-input mt-1 w-36"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <div className="relative">
              <SearchOutlined
                sx={{ fontSize: 17 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="nx-input w-60 pl-9"
                placeholder="Search by title or subject…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => {
              setSectionFilter("");
              setStatusFilter("");
              setSearch("");
            }}
          >
            <ReplayOutlined sx={{ fontSize: 16 }} /> Clear Filters
          </button>
        </div>

        <div className="nx-card divide-y divide-slate-100 overflow-hidden">
          {rows.map((item) => {
            const enrollment = setup.studentEnrollments.find(
              ({ classSectionId }) => classSectionId === item.classSection.id,
            );
            const mySubmission = item.submissions?.[0];
            const maySubmit = !mySubmission || mySubmission.status === "RESUBMIT_REQUESTED";
            return (
              <div key={item.id} className="p-4 transition hover:bg-indigo-50/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                      {sectionLabel(item.classSection)} · {item.classSubject.subject.name} ·
                      Assigned {formatDate(item.homeworkDate)} · Due{" "}
                      {formatDate(item.submissionDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManage ? (
                      <span className="nx-pill nx-pill-neutral">
                        {item._count.submissions} submission
                        {item._count.submissions === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    <span className={`nx-pill ${STATUS_PILL[item.status]}`}>
                      {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[13px] text-slate-600">{item.description}</p>
                {item.attachmentUrl ? (
                  <a
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600 hover:underline"
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <AttachFileOutlined sx={{ fontSize: 14 }} /> Attachment
                  </a>
                ) : null}
                {mySubmission ? (
                  <p className="mt-2 text-[12.5px] text-indigo-700">
                    My status: {SUBMISSION_LABEL[mySubmission.status]}
                    {mySubmission.review ? ` · ${mySubmission.review}` : ""}
                  </p>
                ) : null}
                {canSubmit && enrollment && maySubmit ? (
                  <SelfSubmissionForm
                    homeworkId={item.id}
                    enrollmentId={enrollment.id}
                    token={token}
                    onSaved={onSaved}
                  />
                ) : null}
              </div>
            );
          })}
          {!rows.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No homework matches the current filters.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function EvaluatePanel({ setup, token }: { setup: Setup; token: string }) {
  const [selectedId, setSelectedId] = useState("");
  const [roster, setRoster] = useState<HomeworkRoster | null>(null);
  const [review, setReview] = useState("Reviewed");

  async function loadRoster(id: string) {
    setSelectedId(id);
    if (!id) {
      setRoster(null);
      return;
    }
    try {
      setRoster(await apiRequest<HomeworkRoster>(`/homework/${id}/submissions`, token));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load submissions");
    }
  }

  async function evaluate(id: string, status: "COMPLETED" | "RESUBMIT_REQUESTED") {
    try {
      await apiRequest(`/homework/submissions/${id}/evaluate`, token, {
        method: "PUT",
        body: JSON.stringify({ status, review }),
      });
      notifySuccess(
        status === "RESUBMIT_REQUESTED" ? "Resubmission requested" : "Homework completed",
      );
      await loadRoster(selectedId);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to evaluate homework");
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="nx-card flex flex-wrap items-end gap-3 px-4 py-3">
        <label className="block min-w-0 flex-1 basis-72">
          <span className="nx-label">Homework</span>
          <select
            className="nx-input mt-1 w-full"
            value={selectedId}
            onChange={(e) => void loadRoster(e.target.value)}
          >
            <option value="">Select homework to review</option>
            {setup.homework.map((item) => (
              <option key={item.id} value={item.id}>
                {sectionLabel(item.classSection)} · {item.classSubject.subject.name} ·{" "}
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 flex-1 basis-72">
          <span className="nx-label">Teacher review note</span>
          <input
            className="nx-input mt-1 w-full"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Saved with each evaluation"
          />
        </label>
      </div>

      {roster ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="nx-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Submission</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.roster.map((item) => {
                    const submission = item.homeworkSubmissions[0];
                    return (
                      <tr key={item.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {item.student.firstName} {item.student.lastName}
                          </p>
                          <p className="text-[12px] text-slate-400">
                            {item.student.admissionNumber}
                            {item.rollNumber ? ` · Roll ${item.rollNumber}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {submission ? (
                            <div>
                              <span className={`nx-pill ${SUBMISSION_PILL[submission.status]}`}>
                                {SUBMISSION_LABEL[submission.status]}
                              </span>
                              <p className="mt-1 text-[11.5px] text-slate-400">
                                Attempt {submission.attempt}
                              </p>
                            </div>
                          ) : (
                            <span className="nx-pill nx-pill-neutral">Not submitted</span>
                          )}
                        </td>
                        <td className="max-w-72 px-3 py-3 text-[12.5px] text-slate-600">
                          {submission?.answerText ? (
                            <span className="line-clamp-2">{submission.answerText}</span>
                          ) : (
                            "—"
                          )}
                          {submission?.review ? (
                            <p className="mt-1 text-indigo-700">Review: {submission.review}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {submission?.status === "SUBMITTED" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                                onClick={() => void evaluate(submission.id, "RESUBMIT_REQUESTED")}
                              >
                                Request resubmit
                              </button>
                              <button
                                type="button"
                                className="nx-btn-primary !px-3 !py-1.5 text-[12px]"
                                onClick={() => void evaluate(submission.id, "COMPLETED")}
                              >
                                Complete
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-[12px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!roster.roster.length ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No students enrolled in this class section.
                </p>
              ) : null}
            </div>
          </div>

          <StudentSubmissionForm
            homeworkId={roster.homework.id}
            roster={roster.roster}
            token={token}
            onSaved={() => loadRoster(roster.homework.id)}
          />
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-slate-500">
          Select a homework assignment to review student submissions.
        </p>
      )}
    </section>
  );
}

function ReportsPanel({ setup, token }: { setup: Setup; token: string }) {
  const [report, setReport] = useState<ReportRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!setup.currentSession) return;
      try {
        const rows = await apiRequest<ReportRow[]>(
          `/homework-reports?sessionId=${setup.currentSession.id}`,
          token,
        );
        if (!cancelled) setReport(rows);
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load homework report");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [setup.currentSession, token]);

  if (!setup.currentSession) {
    return (
      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
        Homework reports require an active academic session.
      </p>
    );
  }

  return (
    <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {(report ?? []).map((item) => (
        <div key={item.homework.id} className="nx-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{item.homework.title}</p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {sectionLabel(item.homework.classSection)} ·{" "}
                {item.homework.classSubject.subject.name}
              </p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <AssignmentTurnedInOutlined sx={{ fontSize: 18 }} />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-slate-500">Completion</span>
              <span className="font-bold text-slate-900">{item.progressPercent}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, item.progressPercent)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px] text-slate-600">
            <span>
              Assigned <strong className="text-slate-900">{item.assigned}</strong>
            </span>
            <span>
              Submitted <strong className="text-slate-900">{item.submitted}</strong>
            </span>
            <span>
              Completed <strong className="text-emerald-700">{item.completed}</strong>
            </span>
            <span className={item.due ? "text-rose-600" : ""}>
              Due <strong>{item.due}</strong>
            </span>
          </div>
        </div>
      ))}
      {report && !report.length ? (
        <p className="col-span-full px-5 py-12 text-center text-sm text-slate-500">
          No homework recorded for the current session yet.
        </p>
      ) : null}
      {!report ? (
        <p className="col-span-full px-5 py-12 text-center text-sm text-slate-500">
          Loading homework report…
        </p>
      ) : null}
    </section>
  );
}

function SelfSubmissionForm({
  homeworkId,
  enrollmentId,
  token,
  onSaved,
}: {
  homeworkId: string;
  enrollmentId: string;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [answerText, setAnswerText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({
          studentEnrollmentId: enrollmentId,
          answerText,
          attachmentUrl: attachmentUrl || null,
        }),
      });
      setAnswerText("");
      setAttachmentUrl("");
      notifySuccess("Homework submitted");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-3 rounded-xl bg-slate-50 p-3.5" onSubmit={submit}>
      <p className="text-[13px] font-bold text-slate-900">My submission</p>
      <textarea
        className="nx-input mt-2 w-full"
        rows={2}
        required
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        placeholder="Answer or submission note"
      />
      <input
        className="nx-input mt-2 w-full"
        type="url"
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        placeholder="Attachment URL (optional)"
      />
      <button className="nx-btn-primary mt-2.5" disabled={busy}>
        {busy ? "Submitting…" : "Submit homework"}
      </button>
    </form>
  );
}

function StudentSubmissionForm({
  homeworkId,
  roster,
  token,
  onSaved,
}: {
  homeworkId: string;
  roster: RosterItem[];
  token: string;
  onSaved: () => Promise<void>;
}) {
  const eligible = useMemo(
    () =>
      roster.filter(
        (item) =>
          !item.homeworkSubmissions.length ||
          item.homeworkSubmissions[0].status === "RESUBMIT_REQUESTED",
      ),
    [roster],
  );
  const [form, setForm] = useState({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({ ...form, attachmentUrl: form.attachmentUrl || null }),
      });
      setForm({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" });
      notifySuccess("Homework submitted");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="nx-card h-fit p-4" onSubmit={submit}>
      <h3 className="text-[14px] font-bold text-slate-900">Record student submission</h3>
      <p className="mt-0.5 text-[12px] text-slate-500">
        A submitted student appears again only after resubmission is requested.
      </p>
      <label className="mt-3 block">
        <span className="nx-label">Eligible student</span>
        <select
          className="nx-input mt-1 w-full"
          required
          value={form.studentEnrollmentId}
          onChange={(e) => setForm({ ...form, studentEnrollmentId: e.target.value })}
        >
          <option value="">Select student</option>
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {item.student.firstName} {item.student.lastName} · {item.student.admissionNumber}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="nx-label">Answer / note</span>
        <textarea
          className="nx-input mt-1 w-full"
          rows={3}
          required
          placeholder="Answer or submission note"
          value={form.answerText}
          onChange={(e) => setForm({ ...form, answerText: e.target.value })}
        />
      </label>
      <label className="mt-3 block">
        <span className="nx-label">Attachment URL</span>
        <input
          className="nx-input mt-1 w-full"
          type="url"
          placeholder="https://… (optional)"
          value={form.attachmentUrl}
          onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
        />
      </label>
      <button className="nx-btn-primary mt-4 w-full" disabled={busy || !eligible.length}>
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
