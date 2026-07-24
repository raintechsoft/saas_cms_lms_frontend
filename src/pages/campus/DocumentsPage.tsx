import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

type TemplateType = "ADMIT_CARD" | "MARKSHEET" | "CERTIFICATE" | "ID_CARD";
interface Template {
  id: string;
  type: TemplateType;
  name: string;
  width: number;
  height: number;
  config: Record<string, unknown>;
  isActive: boolean;
  _count: { documents: number };
}
interface Student { id: string; admissionNumber: string; firstName: string; lastName: string | null }
interface Staff { id: string; employeeNumber: string; user: { firstName: string; lastName: string } }
interface Exam { id: string; name: string; status: string }
interface Generated {
  id: string;
  serialNumber: string;
  barcodeValue: string | null;
  generatedAt: string;
  template: Template;
  student: Student | null;
  staff: Staff | null;
  exam: Exam | null;
  payload: Record<string, unknown>;
}

export function DocumentsPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"templates" | "generate" | "history">("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [documents, setDocuments] = useState<Generated[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [nextTemplates, nextStudents, hr, examSetup, nextDocuments] = await Promise.all([
        apiRequest<Template[]>("/documents/templates", accessToken),
        apiRequest<{ items: Student[] }>("/students?limit=100", accessToken),
        apiRequest<{ staff: Staff[] }>("/hr/setup", accessToken)
          .catch(() => ({ staff: [] })),
        apiRequest<{ groups: Array<{ exams: Exam[] }> }>("/exams/setup", accessToken),
        apiRequest<Generated[]>("/documents/generated", accessToken),
      ]);
      setTemplates(nextTemplates);
      setStudents(nextStudents.items);
      setStaff(hr.staff);
      setExams(examSetup.groups.flatMap((group) => group.exams));
      setDocuments(nextDocuments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load document center");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Certificates and ID cards"
        title="Document design studio"
        description="Design reusable backgrounds and fields, then generate barcoded exam and identity documents."
        action={<span className="badge">{templates.length} templates</span>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      {message && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
      <div className="mt-8 flex gap-2 border-b border-slate-200">
        {(["templates", "generate", "history"] as const).map((item) => (
          <button className={`tab ${tab === item ? "tab-active" : ""}`} key={item} onClick={() => setTab(item)}>
            {item === "templates" ? "Design templates" : item === "generate" ? "Generate" : "Print history"}
          </button>
        ))}
      </div>
      {tab === "templates" && <TemplatePanel templates={templates} token={accessToken} onSaved={load} onError={setError} />}
      {tab === "generate" && (
        <GeneratePanel templates={templates} students={students} staff={staff} exams={exams}
          token={accessToken} onSaved={async () => { setMessage("Document generated"); await load(); setTab("history"); }}
          onError={setError} />
      )}
      {tab === "history" && (
        <div className="card mt-6 divide-y divide-slate-100 overflow-hidden">
          {documents.map((document) => (
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={document.id}>
              <div>
                <p className="font-medium">{document.template.name} · {document.student ? `${document.student.firstName} ${document.student.lastName ?? ""}` : `${document.staff?.user.firstName} ${document.staff?.user.lastName}`}</p>
                <p className="text-sm text-slate-500">{document.serialNumber} · Barcode {document.barcodeValue ?? "—"} · {new Date(document.generatedAt).toLocaleString()}</p>
              </div>
              <button className="button-secondary" onClick={() => window.location.assign(`/print/documents/${document.id}`)}>Open & print</button>
            </div>
          ))}
          {!documents.length && <p className="p-8 text-center text-sm text-slate-500">No generated documents yet.</p>}
        </div>
      )}
    </main>
  );
}

function TemplatePanel({ templates, token, onSaved, onError }: {
  templates: Template[]; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ type: "CERTIFICATE" as TemplateType, name: "", backgroundUrl: "", width: "1600", height: "1131", config: '{"title":"Certificate","showPhoto":true,"showBarcode":true}' });
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/documents/templates", token, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          backgroundUrl: form.backgroundUrl || null,
          width: Number(form.width),
          height: Number(form.height),
          config: JSON.parse(form.config) as Record<string, unknown>,
        }),
      });
      setForm({ ...form, name: "" }); await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create template"); }
  }
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]">
      <form className="card p-5" onSubmit={submit}>
        <h2 className="font-semibold">New custom template</h2>
        <select className="input mt-4" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TemplateType })}>
          <option value="CERTIFICATE">Certificate</option><option value="ID_CARD">ID card</option><option value="ADMIT_CARD">Admit card</option><option value="MARKSHEET">Marksheet</option>
        </select>
        <input className="input mt-3" required placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input mt-3" placeholder="Background image URL (optional)" value={form.backgroundUrl} onChange={(e) => setForm({ ...form, backgroundUrl: e.target.value })} />
        <div className="mt-3 grid grid-cols-2 gap-3"><input className="input" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /><input className="input" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></div>
        <textarea className="input mt-3 min-h-32 font-mono text-xs" value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} />
        <button className="button-primary mt-4">Save design</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <div className="card p-5" key={template.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-medium">{template.name}</p><p className="text-sm text-slate-500">{template.width} × {template.height}px</p></div><span className="badge">{template.type.replaceAll("_", " ")}</span></div>
            <div className="mt-5 grid aspect-[1.414/1] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">{String(template.config.title ?? template.name)}<br />Photo · Dynamic fields · Barcode</div>
            <p className="mt-3 text-xs text-slate-500">{template._count.documents} generated</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function GeneratePanel({ templates, students, staff, exams, token, onSaved, onError }: {
  templates: Template[]; students: Student[]; staff: Staff[]; exams: Exam[]; token: string;
  onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ templateId: "", studentId: "", staffId: "", examId: "", barcodeValue: "" });
  const template = useMemo(() => templates.find((item) => item.id === form.templateId), [templates, form.templateId]);
  const staffTarget = template?.type === "ID_CARD" && Boolean(form.staffId);
  const needsExam = template?.type === "ADMIT_CARD" || template?.type === "MARKSHEET";
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/documents/generated", token, {
        method: "POST",
        body: JSON.stringify({
          templateId: form.templateId,
          studentId: staffTarget ? undefined : form.studentId || undefined,
          staffId: staffTarget ? form.staffId : undefined,
          examId: needsExam ? form.examId : undefined,
          barcodeValue: form.barcodeValue || undefined,
        }),
      });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to generate document"); }
  }
  return (
    <form className="card mt-6 max-w-2xl p-5" onSubmit={submit}>
      <h2 className="font-semibold">Generate document</h2>
      <select className="input mt-4" required value={form.templateId} onChange={(e) => setForm({ templateId: e.target.value, studentId: "", staffId: "", examId: "", barcodeValue: "" })}>
        <option value="">Select active template</option>{templates.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.type.replaceAll("_", " ")} · {item.name}</option>)}
      </select>
      {template?.type === "ID_CARD" && (
        <select className="input mt-3" value={form.staffId ? "staff" : "student"} onChange={(e) => setForm({ ...form, studentId: "", staffId: e.target.value === "staff" ? staff[0]?.id ?? "" : "" })}>
          <option value="student">Student ID card</option><option value="staff">Staff ID card</option>
        </select>
      )}
      {staffTarget ? (
        <select className="input mt-3" required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}><option value="">Staff member</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.user.firstName} {item.user.lastName} · {item.employeeNumber}</option>)}</select>
      ) : (
        <select className="input mt-3" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.admissionNumber}</option>)}</select>
      )}
      {needsExam && <select className="input mt-3" required value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}><option value="">Exam</option>{exams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select>}
      <input className="input mt-3" placeholder="Custom barcode (auto-generated if blank)" value={form.barcodeValue} onChange={(e) => setForm({ ...form, barcodeValue: e.target.value })} />
      <button className="button-primary mt-4">Generate and record</button>
    </form>
  );
}
