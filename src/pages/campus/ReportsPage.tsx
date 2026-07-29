import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";

type ReportModule = "students" | "finance" | "attendance" | "examinations" | "timetable" | "homework" | "hr" | "audit";
interface HubModule {
  key: ReportModule;
  label: string;
  metrics: Record<string, string | number | null>;
}
interface Hub { currentSession: { id: string; name: string } | null; modules: HubModule[] }
interface StudentReport {
  id: string; admissionNumber: string; firstName: string; lastName: string | null; status: string;
  enrollments: Array<{ classSection: { academicClass: { name: string }; section: { name: string } } }>;
}
interface FinanceReport { summary: { assigned: number; collected: number; outstanding: number }; payments: Array<{ id: string; receiptNumber: string; amount: string; paymentDate: string; student: { firstName: string; lastName: string | null } }> }
interface AttendanceReport { summary: Record<string, number>; records: Array<{ id: string; attendanceDate: string; status: string; studentEnrollment: { student: { firstName: string; lastName: string | null } } }> }
interface ExamReport { id: string; name: string; status: string; examGroup: { name: string }; _count: { schedules: number; students: number } }
interface HrReport { summary: { gross: number; net: number; deductions: number }; staff: Array<{ id: string; employeeNumber: string; status: string; user: { firstName: string; lastName: string }; department: { name: string } | null }> }
interface AuditReport { auditLogs: Array<{ id: string; action: string; entityType: string; createdAt: string; user: { firstName: string; lastName: string } }>; generatedDocuments: Array<{ id: string; serialNumber: string; generatedAt: string; template: { name: string; type: string } }> }

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export function ReportsPage() {
  const { accessToken } = useAuth();
  const [hub, setHub] = useState<Hub | null>(null);
  const [module, setModule] = useState<ReportModule>("students");
  const [filters, setFilters] = useState({ from: monthStart, to: today, includeDisabled: "true" });
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    apiRequest<Hub>("/reports", accessToken).then(setHub).catch((cause: unknown) => {
      notifyError(cause instanceof Error ? cause.message : "Unable to load report hub");
    });
  }, [accessToken]);

  async function run(selected = module) {
    try {
      setModule(selected);
      const query = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        includeDisabled: filters.includeDisabled,
      });
      if (hub?.currentSession) query.set("sessionId", hub.currentSession.id);
      setData(await apiRequest(`/reports/${selected}?${query}`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate report");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Data reports"
        title="Consolidated report hub"
        description="Run student, finance, attendance, examination, HR, payroll, document, and audit reports."
        action={<button className="button-secondary" onClick={() => window.print()}>Print report</button>}
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {hub?.modules.map((item) => (
          <button key={item.key} onClick={() => void run(item.key)}
            className={`card p-5 text-left transition hover:border-indigo-300 ${module === item.key && data ? "border-indigo-400 ring-2 ring-indigo-100" : ""}`}>
            <p className="font-semibold">{item.label}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(item.metrics).map(([key, value]) => <span className="badge" key={key}>{key}: {value ?? "—"}</span>)}
            </div>
          </button>
        ))}
      </section>
      <section className="card mt-6 grid gap-4 p-5 sm:grid-cols-4">
        <input className="input" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input className="input" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <select className="input" value={filters.includeDisabled} onChange={(e) => setFilters({ ...filters, includeDisabled: e.target.value })}>
          <option value="true">Include disabled</option><option value="false">Active only</option>
        </select>
        <button className="button-primary" onClick={() => void run()}>Refresh report</button>
      </section>
      <ReportResult module={module} data={data} />
    </main>
  );
}

function ReportResult({ module, data }: { module: ReportModule; data: unknown }) {
  if (!data) return <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">Choose a report module to generate live tenant data.</div>;
  if (module === "students") {
    const rows = data as StudentReport[];
    return <div className="card mt-6 divide-y divide-slate-100 overflow-hidden">{rows.map((student) => <div className={`flex justify-between gap-3 p-5 ${student.status === "DISABLED" ? "bg-rose-50" : ""}`} key={student.id}><div><p className="font-medium">{student.firstName} {student.lastName}</p><p className="text-sm text-slate-500">{student.admissionNumber} · {student.enrollments[0] ? `${student.enrollments[0].classSection.academicClass.name} ${student.enrollments[0].classSection.section.name}` : "Not enrolled"}</p></div><span className={student.status === "DISABLED" ? "badge-danger" : "badge-success"}>{student.status}</span></div>)}</div>;
  }
  if (module === "finance") {
    const report = data as FinanceReport;
    return <section className="mt-6"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Assigned" value={`₹${report.summary.assigned.toLocaleString()}`} /><Metric label="Collected" value={`₹${report.summary.collected.toLocaleString()}`} /><Metric label="Outstanding" value={`₹${report.summary.outstanding.toLocaleString()}`} /></div><div className="card mt-5 divide-y divide-slate-100">{report.payments.map((payment) => <div className="flex justify-between p-5" key={payment.id}><div><p className="font-medium">{payment.student.firstName} {payment.student.lastName}</p><p className="text-sm text-slate-500">{payment.receiptNumber} · {new Date(payment.paymentDate).toLocaleDateString()}</p></div><strong>₹{Number(payment.amount).toLocaleString()}</strong></div>)}</div></section>;
  }
  if (module === "attendance") {
    const report = data as AttendanceReport;
    return <section className="mt-6"><div className="flex flex-wrap gap-3">{Object.entries(report.summary).map(([status, count]) => <Metric key={status} label={status} value={String(count)} />)}</div><div className="card mt-5 divide-y divide-slate-100">{report.records.slice(0, 100).map((record) => <div className="flex justify-between p-4" key={record.id}><span>{record.studentEnrollment.student.firstName} {record.studentEnrollment.student.lastName}</span><span className="badge">{record.status} · {new Date(record.attendanceDate).toLocaleDateString()}</span></div>)}</div></section>;
  }
  if (module === "examinations") {
    const rows = data as ExamReport[];
    return <div className="card mt-6 divide-y divide-slate-100">{rows.map((exam) => <div className="flex justify-between p-5" key={exam.id}><div><p className="font-medium">{exam.examGroup.name} · {exam.name}</p><p className="text-sm text-slate-500">{exam._count.schedules} schedules · {exam._count.students} students</p></div><span className={exam.status === "PUBLISHED" ? "badge-success" : "badge"}>{exam.status}</span></div>)}</div>;
  }
  if (module === "timetable") {
    const rows = data as Array<{ id: string; weekday: string; startTime: string; endTime: string; classSection: { academicClass: { name: string }; section: { name: string } }; classSubject: { subject: { name: string } }; teacher: { firstName: string; lastName: string } | null }>;
    return <div className="card mt-6 divide-y divide-slate-100">{rows.map((row) => <div className="flex justify-between gap-3 p-5" key={row.id}><div><p className="font-medium">{row.classSection.academicClass.name} {row.classSection.section.name} · {row.classSubject.subject.name}</p><p className="text-sm text-slate-500">{row.teacher ? `${row.teacher.firstName} ${row.teacher.lastName}` : "No teacher"}</p></div><span className="badge">{row.weekday} · {row.startTime}–{row.endTime}</span></div>)}</div>;
  }
  if (module === "homework") {
    const rows = data as Array<{ homework: { id: string; title: string; classSubject: { subject: { name: string } } }; assigned: number; completed: number; due: number; progressPercent: number }>;
    return <div className="card mt-6 divide-y divide-slate-100">{rows.map((row) => <div className="flex justify-between gap-3 p-5" key={row.homework.id}><div><p className="font-medium">{row.homework.title}</p><p className="text-sm text-slate-500">{row.homework.classSubject.subject.name} · {row.completed}/{row.assigned} complete · {row.due} due</p></div><span className="badge">{row.progressPercent}%</span></div>)}</div>;
  }
  if (module === "hr") {
    const report = data as HrReport;
    return <section className="mt-6"><div className="grid gap-4 sm:grid-cols-3"><Metric label="Gross payroll" value={`₹${report.summary.gross.toLocaleString()}`} /><Metric label="Deductions" value={`₹${report.summary.deductions.toLocaleString()}`} /><Metric label="Net payroll" value={`₹${report.summary.net.toLocaleString()}`} /></div><div className="card mt-5 divide-y divide-slate-100">{report.staff.map((member) => <div className={`flex justify-between p-5 ${member.status === "DISABLED" ? "bg-rose-50" : ""}`} key={member.id}><div><p className="font-medium">{member.user.firstName} {member.user.lastName}</p><p className="text-sm text-slate-500">{member.employeeNumber} · {member.department?.name ?? "No department"}</p></div><span className={member.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{member.status}</span></div>)}</div></section>;
  }
  const report = data as AuditReport;
  return <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="card divide-y divide-slate-100"><div className="p-4 font-semibold">Audit trail</div>{report.auditLogs.map((log) => <div className="p-4" key={log.id}><p className="font-medium">{log.action} · {log.entityType}</p><p className="text-sm text-slate-500">{log.user.firstName} {log.user.lastName} · {new Date(log.createdAt).toLocaleString()}</p></div>)}</div><div className="card divide-y divide-slate-100"><div className="p-4 font-semibold">Generated documents</div>{report.generatedDocuments.map((document) => <div className="p-4" key={document.id}><p className="font-medium">{document.template.name}</p><p className="text-sm text-slate-500">{document.serialNumber} · {new Date(document.generatedAt).toLocaleString()}</p></div>)}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card min-w-40 p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label.replaceAll("_", " ")}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
}
