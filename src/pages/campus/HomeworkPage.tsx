import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

interface Named { id: string; name: string }
interface Student { firstName: string; lastName: string | null; admissionNumber: string }
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
  submissions?: Array<{ id: string; status: Submission["status"]; review: string | null; attempt: number }>;
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
interface HomeworkRoster { homework: Homework; roster: RosterItem[] }
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

export function HomeworkPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<"assignments" | "evaluate" | "reports">("assignments");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [roster, setRoster] = useState<HomeworkRoster | null>(null);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [review, setReview] = useState("Reviewed");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setSetup(await apiRequest<Setup>("/homework/setup", accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load homework");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function loadRoster(id: string) {
    setSelectedId(id);
    if (!id) return setRoster(null);
    try {
      setRoster(await apiRequest<HomeworkRoster>(`/homework/${id}/submissions`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load homework submissions");
    }
  }

  async function evaluate(id: string, status: "COMPLETED" | "EVALUATED" | "RESUBMIT_REQUESTED") {
    try {
      await apiRequest(`/homework/submissions/${id}/evaluate`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status, review }),
      });
      setMessage(status === "RESUBMIT_REQUESTED" ? "Resubmission requested" : "Homework evaluated");
      await loadRoster(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to evaluate homework");
    }
  }

  async function runReport() {
    if (!setup?.currentSession) return;
    try {
      setReport(await apiRequest<ReportRow[]>(`/homework-reports?sessionId=${setup.currentSession.id}`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load homework report");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Shared learning"
        title="Homework management"
        description="Assign work, accept controlled submissions, evaluate, request resubmission, and track completion."
        action={<span className="badge">{setup?.homework.length ?? 0} assignments</span>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      {message && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <div className="mt-8 flex gap-2 border-b border-slate-200">
        {(["assignments", "evaluate", "reports"] as const).filter((item) => item === "assignments" || user?.permissions.includes("homework.evaluate")).map((item) => <button className={`tab ${tab === item ? "tab-active" : ""}`} key={item} onClick={() => { setTab(item); if (item === "reports") void runReport(); }}>{item === "assignments" ? "Assignments" : item === "evaluate" ? "Submissions & evaluation" : "Reports"}</button>)}
      </div>
      {setup && tab === "assignments" && <AssignmentsPanel setup={setup} token={accessToken} canManage={Boolean(user?.permissions.includes("homework.manage"))} canSubmit={Boolean(user?.permissions.includes("homework.submit"))} onSaved={load} onError={setError} />}
      {setup && tab === "evaluate" && (
        <section className="mt-6">
          <select className="input max-w-xl" value={selectedId} onChange={(e) => void loadRoster(e.target.value)}><option value="">Select homework</option>{setup.homework.map((item) => <option key={item.id} value={item.id}>{item.classSection.academicClass.name} {item.classSection.section.name} · {item.classSubject.subject.name} · {item.title}</option>)}</select>
          {roster && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="card divide-y divide-slate-100 overflow-hidden">{roster.roster.map((item) => {
              const submission = item.homeworkSubmissions[0];
              return <div className="p-5" key={item.id}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-medium">{item.student.firstName} {item.student.lastName}</p><p className="text-sm text-slate-500">{item.student.admissionNumber} · {submission ? `${submission.status} · Attempt ${submission.attempt}` : "Not submitted"}</p>{submission?.answerText && <p className="mt-2 text-sm">{submission.answerText}</p>}{submission?.review && <p className="mt-2 text-sm text-indigo-700">Review: {submission.review}</p>}</div>{submission?.status === "SUBMITTED" && <div className="flex flex-wrap gap-2"><button className="button-secondary" onClick={() => void evaluate(submission.id, "RESUBMIT_REQUESTED")}>Request resubmit</button><button className="button-primary" onClick={() => void evaluate(submission.id, "COMPLETED")}>Complete</button></div>}</div></div>;
            })}</div>
            <div>
              <label className="label">Teacher review</label><textarea className="input min-h-24" value={review} onChange={(e) => setReview(e.target.value)} />
              <StudentSubmissionForm homeworkId={roster.homework.id} roster={roster.roster} token={accessToken} onSaved={() => loadRoster(roster.homework.id)} onError={setError} />
            </div>
          </div>}
        </section>
      )}
      {tab === "reports" && (
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{report.map((item) => <div className="card p-5" key={item.homework.id}><div className="flex justify-between gap-3"><p className="font-semibold">{item.homework.title}</p><span className="badge">{item.progressPercent}%</span></div><p className="mt-1 text-sm text-slate-500">{item.homework.classSection.academicClass.name} {item.homework.classSection.section.name} · {item.homework.classSubject.subject.name}</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span>Assigned {item.assigned}</span><span>Submitted {item.submitted}</span><span>Complete {item.completed}</span><span className={item.due ? "text-rose-600" : "text-emerald-700"}>Due {item.due}</span></div></div>)}</section>
      )}
    </main>
  );
}

function AssignmentsPanel({ setup, token, canManage, canSubmit, onSaved, onError }: {
  setup: Setup; token: string; canManage: boolean; canSubmit: boolean; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ academicSessionId: setup.currentSession?.id ?? "", classSectionId: "", classSubjectId: "", title: "", description: "", attachmentUrl: "", homeworkDate: today, submissionDate: today, status: "PUBLISHED" });
  const section = setup.classSections.find(({ id }) => id === form.classSectionId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/homework", token, { method: "POST", body: JSON.stringify({ ...form, attachmentUrl: form.attachmentUrl || null }) });
      setForm({ ...form, title: "", description: "", attachmentUrl: "" }); await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create homework"); }
  }
  return <section className={`mt-6 grid gap-5 ${canManage ? "lg:grid-cols-[380px_1fr]" : ""}`}>
    {canManage && <form className="card p-5" onSubmit={submit}><h2 className="font-semibold">Create homework</h2>
      <select className="input mt-4" required value={form.classSectionId} onChange={(e) => setForm({ ...form, classSectionId: e.target.value, classSubjectId: "" })}><option value="">Class section</option>{setup.classSections.map((item) => <option key={item.id} value={item.id}>{item.academicClass.name} · {item.section.name}</option>)}</select>
      <select className="input mt-3" required value={form.classSubjectId} onChange={(e) => setForm({ ...form, classSubjectId: e.target.value })}><option value="">Subject</option>{section?.subjects.map((item) => <option key={item.id} value={item.id}>{item.subject.name}</option>)}</select>
      <input className="input mt-3" required placeholder="Homework title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea className="input mt-3 min-h-24" required placeholder="Instructions" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input className="input mt-3" type="url" placeholder="Attachment URL" value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} />
      <div className="mt-3 grid grid-cols-2 gap-3"><input className="input" type="date" value={form.homeworkDate} onChange={(e) => setForm({ ...form, homeworkDate: e.target.value })} /><input className="input" type="date" value={form.submissionDate} onChange={(e) => setForm({ ...form, submissionDate: e.target.value })} /></div>
      <button className="button-primary mt-4">Publish homework</button>
    </form>}
    <div className="card divide-y divide-slate-100 overflow-hidden">{setup.homework.map((item) => {
      const enrollment = setup.studentEnrollments.find(({ classSectionId }) => classSectionId === item.classSection.id);
      const mySubmission = item.submissions?.[0];
      const maySubmit = !mySubmission || mySubmission.status === "RESUBMIT_REQUESTED";
      return <div className="p-5" key={item.id}><div className="flex justify-between gap-3"><div><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">{item.classSection.academicClass.name} {item.classSection.section.name} · {item.classSubject.subject.name} · Due {new Date(item.submissionDate).toLocaleDateString()}</p></div><span className={item.status === "PUBLISHED" ? "badge-success" : "badge"}>{item.status}</span></div><p className="mt-2 text-sm">{item.description}</p>{canManage && <p className="mt-2 text-xs text-slate-500">{item._count.submissions} submissions</p>}{mySubmission && <p className="mt-3 text-sm text-indigo-700">My status: {mySubmission.status}{mySubmission.review ? ` · ${mySubmission.review}` : ""}</p>}{canSubmit && enrollment && maySubmit && <SelfSubmissionForm homeworkId={item.id} enrollmentId={enrollment.id} token={token} onSaved={onSaved} onError={onError} />}</div>;
    })}{!setup.homework.length && <p className="p-8 text-center text-sm text-slate-500">No homework yet.</p>}</div>
  </section>;
}

function SelfSubmissionForm({ homeworkId, enrollmentId, token, onSaved, onError }: {
  homeworkId: string; enrollmentId: string; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  return <form className="mt-4 rounded-xl bg-slate-50 p-4" onSubmit={async (event) => {
    event.preventDefault();
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, { method: "POST", body: JSON.stringify({ studentEnrollmentId: enrollmentId, answerText, attachmentUrl: attachmentUrl || null }) });
      setAnswerText(""); setAttachmentUrl(""); await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to submit homework"); }
  }}><p className="text-sm font-semibold">My submission</p><textarea className="input mt-2" required value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Answer or submission note" /><input className="input mt-2" type="url" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Attachment URL" /><button className="button-primary mt-3">Submit homework</button></form>;
}

function StudentSubmissionForm({ homeworkId, roster, token, onSaved, onError }: {
  homeworkId: string; roster: RosterItem[]; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const eligible = useMemo(() => roster.filter((item) => !item.homeworkSubmissions.length || item.homeworkSubmissions[0].status === "RESUBMIT_REQUESTED"), [roster]);
  const [form, setForm] = useState({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, { method: "POST", body: JSON.stringify({ ...form, attachmentUrl: form.attachmentUrl || null }) });
      setForm({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" }); await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to submit homework"); }
  }
  return <form className="card mt-5 p-5" onSubmit={submit}><h3 className="font-semibold">Record student submission</h3><p className="mt-1 text-xs text-slate-500">A submitted student appears again only after resubmission is requested.</p><select className="input mt-4" required value={form.studentEnrollmentId} onChange={(e) => setForm({ ...form, studentEnrollmentId: e.target.value })}><option value="">Eligible student</option>{eligible.map((item) => <option key={item.id} value={item.id}>{item.student.firstName} {item.student.lastName}</option>)}</select><textarea className="input mt-3" required placeholder="Answer or submission note" value={form.answerText} onChange={(e) => setForm({ ...form, answerText: e.target.value })} /><input className="input mt-3" type="url" placeholder="Attachment URL" value={form.attachmentUrl} onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })} /><button className="button-primary mt-4" disabled={!eligible.length}>Submit</button></form>;
}
