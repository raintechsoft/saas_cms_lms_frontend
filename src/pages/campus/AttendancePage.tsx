import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "HOLIDAY";
interface Named { id: string; name: string }
interface ClassSection { id: string; academicClass: Named; section: Named }
interface Student { id: string; admissionNumber: string; firstName: string; lastName: string | null }
interface RosterItem {
  id: string;
  rollNumber: string | null;
  student: Student;
  attendanceRecords: Array<{ status: AttendanceStatus; inTime: string | null; outTime: string | null }>;
  leaveRequests: Array<{ id: string }>;
}
interface Leave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  studentEnrollment: {
    student: Student;
    classSection: ClassSection;
  };
}
interface Setup {
  attendanceType: "DAY_WISE" | "PERIOD_WISE" | "BIOMETRIC";
  currentSession: Named | null;
  classSections: ClassSection[];
  roster: RosterItem[];
  pendingLeaves: Leave[];
}
interface Report {
  summaries: Array<{
    student: Student;
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    total: number;
    percentage: number;
  }>;
}

const today = new Date().toISOString().slice(0, 10);

export function AttendancePage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"mark" | "leave" | "reports">("mark");
  const [classSectionId, setClassSectionId] = useState("");
  const [date, setDate] = useState(today);
  const [periodKey, setPeriodKey] = useState("PERIOD-1");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(sectionId = classSectionId, selectedDate = date) {
    try {
      const params = new URLSearchParams({ date: selectedDate, periodKey });
      if (sectionId) params.set("classSectionId", sectionId);
      const next = await apiRequest<Setup>(`/attendance/setup?${params}`, accessToken);
      setSetup(next);
      setStatuses(Object.fromEntries(next.roster.map((item) => [
        item.id,
        item.attendanceRecords[0]?.status ?? (item.leaveRequests.length ? "ABSENT" : "PRESENT"),
      ])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load attendance");
    }
  }
  useEffect(() => { void load("", today); }, [accessToken]);

  async function mark() {
    if (!classSectionId || !setup) return;
    try {
      const result = await apiRequest<{ marked: number }>("/attendance/records", accessToken, {
        method: "POST",
        body: JSON.stringify({
          classSectionId,
          attendanceDate: date,
          periodKey,
          records: setup.roster.map((item) => ({
            studentEnrollmentId: item.id,
            status: statuses[item.id] ?? "PRESENT",
          })),
        }),
      });
      setMessage(`${result.marked} attendance records saved`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark attendance");
    }
  }

  async function awardPoint(enrollmentId: string) {
    if (!setup?.currentSession) return;
    try {
      await apiRequest("/attendance/points", accessToken, {
        method: "POST",
        body: JSON.stringify({ studentEnrollmentId: enrollmentId, pointDate: date, points: 1, note: "Attendance point" }),
      });
      setMessage("Attendance point awarded");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to award point"); }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="CMS + LMS shared core"
        title="Student attendance"
        description="Mark day or period attendance, approve leave, and review summaries."
        action={setup && <span className="badge">{setup.attendanceType.replaceAll("_", " ")}</span>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      {message && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <div className="mt-8 flex gap-2 border-b border-slate-200">
        {(["mark", "leave", "reports"] as const).map((item) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>
            {item === "mark" ? "Mark attendance" : item === "leave" ? "Leave approval" : "Reports"}
          </button>
        ))}
      </div>

      {tab === "mark" && (
        <section className="mt-6">
          <div className="card grid gap-4 p-5 md:grid-cols-3">
            <select className="input" value={classSectionId} onChange={(e) => {
              setClassSectionId(e.target.value);
              void load(e.target.value, date);
            }}>
              <option value="">Select class section</option>
              {setup?.classSections.map((item) => <option key={item.id} value={item.id}>
                {item.academicClass.name} · {item.section.name}
              </option>)}
            </select>
            <input className="input" type="date" value={date} onChange={(e) => {
              setDate(e.target.value);
              void load(classSectionId, e.target.value);
            }} />
            {setup?.attendanceType === "PERIOD_WISE" && (
              <input className="input" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}
                placeholder="Period, e.g. PERIOD-1" />
            )}
          </div>
          {classSectionId && (
            <div className="card mt-5 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {setup?.roster.map((item) => (
                  <div className="grid items-center gap-3 px-5 py-4 md:grid-cols-[1fr_180px_100px]" key={item.id}>
                    <div>
                      <p className="font-medium">{item.student.firstName} {item.student.lastName}</p>
                      <p className="text-sm text-slate-500">
                        Roll {item.rollNumber ?? "—"} · {item.student.admissionNumber}
                        {item.leaveRequests.length ? " · Approved leave" : ""}
                      </p>
                    </div>
                    <select className="input" value={statuses[item.id] ?? "PRESENT"}
                      onChange={(e) => setStatuses({ ...statuses, [item.id]: e.target.value as AttendanceStatus })}>
                      <option value="PRESENT">Present</option>
                      <option value="LATE">Late</option>
                      <option value="ABSENT">Absent</option>
                      <option value="HALF_DAY">Half day</option>
                      <option value="HOLIDAY">Holiday</option>
                    </select>
                    <button className="button-secondary" onClick={() => void awardPoint(item.id)}>+1 point</button>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <button className="button-primary" onClick={() => void mark()} disabled={!setup?.roster.length}>
                  Save attendance
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "leave" && setup && (
        <LeavePanel setup={setup} classSectionId={classSectionId} token={accessToken}
          onSaved={() => load()} onError={setError} />
      )}
      {tab === "reports" && setup && (
        <AttendanceReportPanel setup={setup} token={accessToken} onError={setError} />
      )}
    </main>
  );
}

function LeavePanel({ setup, classSectionId, token, onSaved, onError }: {
  setup: Setup; classSectionId: string; token: string;
  onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ studentEnrollmentId: "", fromDate: today, toDate: today, reason: "" });
  const roster = setup.roster;
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/attendance/leaves", token, { method: "POST", body: JSON.stringify(form) });
      setForm({ studentEnrollmentId: "", fromDate: today, toDate: today, reason: "" });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create leave request"); }
  }
  async function review(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await apiRequest(`/attendance/leaves/${id}/review`, token, {
        method: "PUT", body: JSON.stringify({ status }),
      });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to review leave"); }
  }
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="card p-5" onSubmit={submit}>
        <h2 className="font-semibold">New leave request</h2>
        {!classSectionId && <p className="mt-2 text-sm text-amber-700">Select a class in Mark attendance first.</p>}
        <select className="input mt-4" required value={form.studentEnrollmentId}
          onChange={(e) => setForm({ ...form, studentEnrollmentId: e.target.value })}>
          <option value="">Select student</option>
          {roster.map((item) => <option key={item.id} value={item.id}>
            {item.student.firstName} {item.student.lastName}
          </option>)}
        </select>
        <input className="input mt-3" type="date" required value={form.fromDate}
          onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
        <input className="input mt-3" type="date" required value={form.toDate}
          onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
        <textarea className="input mt-3" required placeholder="Reason" value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button className="button-primary mt-4" type="submit">Submit request</button>
      </form>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Pending approvals</div>
        <div className="divide-y divide-slate-100">
          {setup.pendingLeaves.map((leave) => (
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={leave.id}>
              <div><p className="font-medium">{leave.studentEnrollment.student.firstName} {leave.studentEnrollment.student.lastName}</p>
                <p className="text-sm text-slate-500">{leave.reason} · {new Date(leave.fromDate).toLocaleDateString()}–{new Date(leave.toDate).toLocaleDateString()}</p></div>
              <div className="flex gap-2">
                <button className="button-secondary" onClick={() => void review(leave.id, "REJECTED")}>Reject</button>
                <button className="button-primary" onClick={() => void review(leave.id, "APPROVED")}>Approve</button>
              </div>
            </div>
          ))}
          {!setup.pendingLeaves.length && <p className="p-8 text-center text-sm text-slate-500">No pending leave requests.</p>}
        </div>
      </div>
    </section>
  );
}

function AttendanceReportPanel({ setup, token, onError }: {
  setup: Setup; token: string; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ classSectionId: "", fromDate: today, toDate: today });
  const [report, setReport] = useState<Report | null>(null);
  async function run(event: FormEvent) {
    event.preventDefault();
    try {
      const query = new URLSearchParams(form);
      setReport(await apiRequest<Report>(`/attendance/reports?${query}`, token));
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to load report"); }
  }
  return (
    <section className="mt-6">
      <form className="card grid gap-4 p-5 md:grid-cols-4" onSubmit={run}>
        <select className="input" required value={form.classSectionId}
          onChange={(e) => setForm({ ...form, classSectionId: e.target.value })}>
          <option value="">Class section</option>
          {setup.classSections.map((item) => <option key={item.id} value={item.id}>
            {item.academicClass.name} · {item.section.name}
          </option>)}
        </select>
        <input className="input" type="date" value={form.fromDate}
          onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
        <input className="input" type="date" value={form.toDate}
          onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
        <button className="button-primary" type="submit">Generate report</button>
      </form>
      {report && <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
        {report.summaries.map((item) => <div className="grid gap-3 p-5 sm:grid-cols-[1fr_repeat(4,100px)]" key={item.student.id}>
          <div><p className="font-medium">{item.student.firstName} {item.student.lastName}</p>
            <p className="text-sm text-slate-500">{item.student.admissionNumber}</p></div>
          <span>Present {item.present}</span><span>Late {item.late}</span>
          <span>Absent {item.absent}</span><strong>{item.percentage}%</strong>
        </div>)}
      </div>}
    </section>
  );
}
