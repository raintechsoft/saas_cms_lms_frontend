import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type ExamRow = {
  examId: string;
  examName: string;
  groupName: string;
  status: string;
  published: boolean;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  passStatus: string;
  subjects: Array<{
    subject: string;
    marksObtained: number;
    maximumMarks: number;
    isAbsent: boolean;
  }>;
};

type SubjectsPayload = {
  enrollment: { session: string; className: string; section: string } | null;
  coreSubjects: Array<{
    id: string;
    subject: { id: string; name: string; code: string | null; type: string };
    teacher: string | null;
  }>;
  electives: Array<{
    id: string;
    subject: { id: string; name: string; code: string | null; type: string };
    category: string | null;
  }>;
};

type TimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  at: string;
};

type PortalAccount = {
  userId: string | null;
  role: "STUDENT" | "PARENT";
  email: string | null;
  name: string;
  status: string | null;
  hasLogin: boolean;
  relation?: string | null;
  isPrimary?: boolean;
};

type ResetResult = {
  email: string;
  password: string;
  role: "STUDENT" | "PARENT";
  relation: string | null;
  emailSent: boolean;
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExamsTab({ studentId, token }: { studentId: string; token: string }) {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ exams: ExamRow[] }>(`/students/${studentId}/exams`, token)
      .then((data) => setExams(data?.exams ?? []))
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load exams"))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  if (loading) return <p className="mt-6 text-sm text-slate-500">Loading exams…</p>;

  return (
    <div className="nx-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-[15px] font-bold text-slate-900">Exam details</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">Marks and results for this student.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {exams.map((exam) => (
          <div key={exam.examId} className="px-5 py-4">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 text-left"
              onClick={() => setExpanded((current) => (current === exam.examId ? null : exam.examId))}
            >
              <div>
                <p className="text-[14px] font-semibold text-slate-900">{exam.examName}</p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  {exam.groupName} · {exam.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[14px] font-bold text-slate-800">
                  {exam.obtainedMarks}/{exam.maximumMarks}
                </p>
                <span
                  className={`nx-pill mt-1 ${
                    exam.passStatus === "PASS" ? "nx-pill-success" : "nx-pill-danger"
                  }`}
                >
                  {exam.passStatus} · {exam.percentage}%
                </span>
              </div>
            </button>
            {expanded === exam.examId ? (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                <table className="nx-table min-w-[480px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2 text-left">Subject</th>
                      <th className="px-3 py-2 text-left">Marks</th>
                      <th className="px-3 py-2 text-left">Max</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exam.subjects.map((subject) => (
                      <tr key={`${exam.examId}-${subject.subject}`}>
                        <td className="px-3 py-2 text-[13px] font-medium text-slate-800">
                          {subject.subject}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-slate-700">
                          {subject.isAbsent ? "—" : subject.marksObtained}
                        </td>
                        <td className="px-3 py-2 text-[13px] text-slate-700">
                          {subject.maximumMarks}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`nx-pill ${subject.isAbsent ? "nx-pill-danger" : "nx-pill-neutral"}`}>
                            {subject.isAbsent ? "Absent" : "Present"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))}
        {!exams.length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No exam records yet.</p>
        ) : null}
      </div>
    </div>
  );
}

export function SubjectsTab({ studentId, token }: { studentId: string; token: string }) {
  const [data, setData] = useState<SubjectsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<SubjectsPayload>(`/students/${studentId}/subjects`, token)
      .then(setData)
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load subjects"))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  if (loading) return <p className="mt-6 text-sm text-slate-500">Loading subjects…</p>;

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-900">Class subjects</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {data?.enrollment
              ? `${data.enrollment.className} ${data.enrollment.section} · ${data.enrollment.session}`
              : "No active enrolment"}
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.coreSubjects ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{item.subject.name}</p>
                <p className="text-[12px] text-slate-500">
                  {item.subject.code || item.subject.type}
                  {item.teacher ? ` · ${item.teacher}` : ""}
                </p>
              </div>
              <span className="nx-pill nx-pill-neutral">{item.subject.type}</span>
            </div>
          ))}
          {!data?.coreSubjects?.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No subjects assigned.</p>
          ) : null}
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-900">Elective subjects</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">Optional subjects chosen for this student.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.electives ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{item.subject.name}</p>
                <p className="text-[12px] text-slate-500">{item.category || "Elective"}</p>
              </div>
            </div>
          ))}
          {!data?.electives?.length ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No electives assigned.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TimelineTab({ studentId, token }: { studentId: string; token: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ items: TimelineItem[] }>(`/students/${studentId}/timeline`, token)
      .then((data) => setItems(data?.items ?? []))
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load timeline"))
      .finally(() => setLoading(false));
  }, [studentId, token]);

  if (loading) return <p className="mt-6 text-sm text-slate-500">Loading timeline…</p>;

  return (
    <div className="nx-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-[15px] font-bold text-slate-900">Student timeline</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Admission, fees, documents, attendance, and system activity.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="nx-pill nx-pill-neutral mt-0.5 shrink-0">{item.type}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-[12.5px] text-slate-500">{item.detail}</p>
            </div>
            <p className="shrink-0 text-[11.5px] text-slate-400">{formatWhen(item.at)}</p>
          </div>
        ))}
        {!items.length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No timeline events yet.</p>
        ) : null}
      </div>
    </div>
  );
}

export function LoginDetailsTab({ studentId, token }: { studentId: string; token: string }) {
  const [studentAccount, setStudentAccount] = useState<PortalAccount | null>(null);
  const [parentAccounts, setParentAccounts] = useState<PortalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<{
        studentAccount: PortalAccount;
        parentAccounts: PortalAccount[];
      }>(`/students/${studentId}/portal-accounts`, token);
      setStudentAccount(data.studentAccount);
      setParentAccounts(data.parentAccounts ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load login details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, token]);

  async function resetPassword(role: "STUDENT" | "PARENT", guardianUserId?: string | null) {
    setBusy(true);
    try {
      const result = await apiRequest<ResetResult>(
        `/students/${studentId}/portal-password-reset`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            role,
            guardianUserId: guardianUserId ?? null,
            sendEmail: true,
          }),
        },
      );
      setResetResult(result);
      notifySuccess(
        result.emailSent
          ? `Password reset and emailed to ${result.email}`
          : `Password reset for ${result.email} (email not sent)`,
      );
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="mt-6 text-sm text-slate-500">Loading login details…</p>;

  const accounts = [
    ...(studentAccount ? [studentAccount] : []),
    ...parentAccounts,
  ];

  return (
    <div className="nx-card mt-5 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-[15px] font-bold text-slate-900">Login details</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Portal emails for student and parents. Reset generates a temporary password.
        </p>
      </div>

      {resetResult ? (
        <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-4">
          <p className="text-[13px] font-bold text-indigo-900">Temporary password generated</p>
          <p className="mt-1 text-[13px] text-indigo-800">
            {resetResult.role} · {resetResult.email}
          </p>
          <p className="mt-1 font-mono text-[14px] font-semibold text-slate-900">
            {resetResult.password}
          </p>
          <p className="mt-1 text-[12px] text-indigo-700">
            Copy this now. It will not be shown again after you leave this page.
          </p>
        </div>
      ) : null}

      <div className="divide-y divide-slate-100">
        {accounts.map((account) => (
          <div
            key={`${account.role}-${account.userId ?? account.email ?? "none"}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {account.role === "STUDENT"
                  ? "Student login"
                  : `Parent login${account.relation ? ` (${account.relation})` : ""}`}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-slate-900">{account.name || "—"}</p>
              <p className="mt-0.5 text-[13px] text-slate-600">{account.email || "No email"}</p>
              <p className="mt-1 text-[12px] text-slate-500">
                {account.hasLogin ? `Status: ${account.status ?? "ACTIVE"}` : "No portal login linked"}
              </p>
            </div>
            {account.hasLogin && account.userId ? (
              <button
                type="button"
                className="nx-btn-secondary"
                disabled={busy}
                onClick={() =>
                  void resetPassword(
                    account.role,
                    account.role === "PARENT" ? account.userId : null,
                  )
                }
              >
                {busy ? "Resetting…" : "Reset & send password"}
              </button>
            ) : (
              <span className="text-[12px] text-slate-400">Cannot reset</span>
            )}
          </div>
        ))}
        {!accounts.length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No portal accounts found.</p>
        ) : null}
      </div>
    </div>
  );
}
