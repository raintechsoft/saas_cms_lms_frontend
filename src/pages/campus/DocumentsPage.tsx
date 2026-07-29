import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type TemplateType = "ADMIT_CARD" | "MARKSHEET" | "CERTIFICATE" | "ID_CARD";
interface Template {
  id: string;
  type: TemplateType;
  name: string;
  backgroundUrl: string | null;
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

interface TemplateForm {
  type: TemplateType;
  name: string;
  backgroundUrl: string;
  width: string;
  height: string;
  title: string;
  showPhoto: boolean;
  showBarcode: boolean;
  showSchedule: boolean;
  showRank: boolean;
  showGrade: boolean;
  showClass: boolean;
}

const defaultForm: TemplateForm = {
  type: "CERTIFICATE",
  name: "",
  backgroundUrl: "",
  width: "1600",
  height: "1131",
  title: "Certificate",
  showPhoto: true,
  showBarcode: true,
  showSchedule: false,
  showRank: false,
  showGrade: false,
  showClass: false,
};

function buildConfig(form: TemplateForm): Record<string, unknown> {
  const config: Record<string, unknown> = {
    title: form.title.trim() || form.name.trim() || "Document",
    showPhoto: form.showPhoto,
    showBarcode: form.showBarcode,
  };
  if (form.type === "ADMIT_CARD") config.showSchedule = form.showSchedule;
  if (form.type === "MARKSHEET") {
    config.showRank = form.showRank;
    config.showGrade = form.showGrade;
  }
  if (form.type === "ID_CARD") config.showClass = form.showClass;
  return config;
}

function formFromTemplate(template: Template): TemplateForm {
  const config = template.config;
  return {
    type: template.type,
    name: template.name,
    backgroundUrl: template.backgroundUrl ?? "",
    width: String(template.width),
    height: String(template.height),
    title: String(config.title ?? template.name),
    showPhoto: Boolean(config.showPhoto ?? true),
    showBarcode: Boolean(config.showBarcode ?? true),
    showSchedule: Boolean(config.showSchedule ?? false),
    showRank: Boolean(config.showRank ?? false),
    showGrade: Boolean(config.showGrade ?? false),
    showClass: Boolean(config.showClass ?? false),
  };
}

export function DocumentsPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"templates" | "generate" | "history">("templates");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [documents, setDocuments] = useState<Generated[]>([]);

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
      notifyError(cause instanceof Error ? cause.message : "Unable to load document center");
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
      <div className="mt-8 flex gap-2 border-b border-slate-200">
        {(["templates", "generate", "history"] as const).map((item) => (
          <button className={`tab ${tab === item ? "tab-active" : ""}`} key={item} onClick={() => setTab(item)}>
            {item === "templates" ? "Design templates" : item === "generate" ? "Generate" : "Print history"}
          </button>
        ))}
      </div>
      {tab === "templates" && <TemplatePanel templates={templates} token={accessToken} onSaved={load} onError={notifyError} />}
      {tab === "generate" && (
        <GeneratePanel templates={templates} students={students} staff={staff} exams={exams}
          token={accessToken} onSaved={async () => { notifySuccess("Document generated"); await load(); setTab("history"); }}
          onError={notifyError} />
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(defaultForm);
  const [advancedJson, setAdvancedJson] = useState("");
  const [useAdvanced, setUseAdvanced] = useState(false);
  const config = useMemo(() => {
    if (useAdvanced) {
      try {
        return JSON.parse(advancedJson) as Record<string, unknown>;
      } catch {
        return buildConfig(form);
      }
    }
    return buildConfig(form);
  }, [advancedJson, form, useAdvanced]);

  function resetForm() {
    setEditingId(null);
    setForm(defaultForm);
    setAdvancedJson(JSON.stringify(buildConfig(defaultForm), null, 2));
    setUseAdvanced(false);
  }

  function startEdit(template: Template) {
    const next = formFromTemplate(template);
    setEditingId(template.id);
    setForm(next);
    setAdvancedJson(JSON.stringify(template.config, null, 2));
    setUseAdvanced(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    let nextConfig = buildConfig(form);
    if (useAdvanced) {
      try {
        nextConfig = JSON.parse(advancedJson) as Record<string, unknown>;
      } catch {
        onError("Advanced JSON is invalid");
        return;
      }
    }
    const payload = {
      name: form.name,
      backgroundUrl: form.backgroundUrl || null,
      width: Number(form.width),
      height: Number(form.height),
      config: nextConfig,
    };
    try {
      if (editingId) {
        await apiRequest(`/documents/templates/${editingId}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/documents/templates", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, type: form.type }),
        });
      }
      resetForm();
      notifySuccess(editingId ? "Template updated" : "Template created");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : editingId ? "Unable to update template" : "Unable to create template");
    }
  }

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[420px_1fr]">
      <form className="card p-5" onSubmit={submit}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{editingId ? "Edit template" : "New custom template"}</h2>
          {editingId && (
            <button className="button-secondary" type="button" onClick={resetForm}>Cancel</button>
          )}
        </div>
        <select
          className="input mt-4"
          value={form.type}
          disabled={Boolean(editingId)}
          onChange={(e) => {
            const type = e.target.value as TemplateType;
            setForm({
              ...form,
              type,
              title: type === "CERTIFICATE" ? "Certificate"
                : type === "ID_CARD" ? "ID Card"
                : type === "ADMIT_CARD" ? "Admit Card"
                : "Marksheet",
              showSchedule: type === "ADMIT_CARD",
              showRank: type === "MARKSHEET",
              showGrade: type === "MARKSHEET",
              showClass: type === "ID_CARD",
            });
          }}
        >
          <option value="CERTIFICATE">Certificate</option>
          <option value="ID_CARD">ID card</option>
          <option value="ADMIT_CARD">Admit card</option>
          <option value="MARKSHEET">Marksheet</option>
        </select>
        <input className="input mt-3" required placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input mt-3" placeholder="Background image URL (optional)" value={form.backgroundUrl} onChange={(e) => setForm({ ...form, backgroundUrl: e.target.value })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input className="input" type="number" min="100" required placeholder="Width" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} />
          <input className="input" type="number" min="100" required placeholder="Height" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} />
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Title text</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showPhoto} onChange={(e) => setForm({ ...form, showPhoto: e.target.checked })} />Show photo</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showBarcode} onChange={(e) => setForm({ ...form, showBarcode: e.target.checked })} />Show barcode</label>
          {form.type === "ADMIT_CARD" && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.showSchedule} onChange={(e) => setForm({ ...form, showSchedule: e.target.checked })} />Show schedule</label>
          )}
          {form.type === "MARKSHEET" && (
            <>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.showRank} onChange={(e) => setForm({ ...form, showRank: e.target.checked })} />Show rank</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.showGrade} onChange={(e) => setForm({ ...form, showGrade: e.target.checked })} />Show grade</label>
            </>
          )}
          {form.type === "ID_CARD" && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.showClass} onChange={(e) => setForm({ ...form, showClass: e.target.checked })} />Show class</label>
          )}
        </div>
        <details
          className="mt-4 rounded-xl border border-slate-200 p-3"
          open={useAdvanced}
          onToggle={(event) => {
            const open = (event.currentTarget as HTMLDetailsElement).open;
            setUseAdvanced(open);
            if (open) setAdvancedJson(JSON.stringify(buildConfig(form), null, 2));
          }}
        >
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Advanced JSON</summary>
          <textarea
            className="input mt-3 min-h-32 font-mono text-xs"
            value={advancedJson || JSON.stringify(buildConfig(form), null, 2)}
            onChange={(e) => { setAdvancedJson(e.target.value); setUseAdvanced(true); }}
          />
        </details>
        <button className="button-primary mt-4">{editingId ? "Update design" : "Save design"}</button>
      </form>
      <div className="space-y-5">
        <div
          className="card relative grid place-items-center overflow-hidden p-6 text-center"
          style={{
            minHeight: 280,
            backgroundImage: form.backgroundUrl ? `url(${form.backgroundUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 w-full max-w-md rounded-2xl border-2 border-dashed border-slate-300 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{form.type.replaceAll("_", " ")}</p>
            <h3 className="mt-2 text-2xl font-semibold">{String((config.title ?? form.title) || "Document title")}</h3>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {Boolean(config.showPhoto) && (
                <div className="grid size-20 place-items-center rounded-xl border border-slate-300 bg-slate-100 text-xs text-slate-500">Photo</div>
              )}
              {form.type === "ID_CARD" && Boolean(config.showClass) && (
                <span className="badge">Class / Section</span>
              )}
              {form.type === "ADMIT_CARD" && Boolean(config.showSchedule) && (
                <span className="badge">Exam schedule</span>
              )}
              {form.type === "MARKSHEET" && Boolean(config.showRank) && (
                <span className="badge">Rank</span>
              )}
              {form.type === "MARKSHEET" && Boolean(config.showGrade) && (
                <span className="badge">Grade</span>
              )}
            </div>
            {Boolean(config.showBarcode) && (
              <div className="mt-5 mx-auto h-10 w-40 bg-[repeating-linear-gradient(90deg,#0f172a_0_2px,transparent_2px_4px)]" />
            )}
            <p className="mt-4 text-xs text-slate-500">{form.width} × {form.height}px preview</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <div className="card p-5" key={template.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-slate-500">{template.width} × {template.height}px</p>
                </div>
                <span className="badge">{template.type.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-5 grid aspect-[1.414/1] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                {String(template.config.title ?? template.name)}
                <br />
                {[
                  template.config.showPhoto ? "Photo" : null,
                  template.config.showBarcode ? "Barcode" : null,
                  template.config.showSchedule ? "Schedule" : null,
                  template.config.showRank ? "Rank" : null,
                  template.config.showGrade ? "Grade" : null,
                  template.config.showClass ? "Class" : null,
                ].filter(Boolean).join(" · ") || "No optional elements"}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{template._count.documents} generated</p>
                <button className="button-secondary" type="button" onClick={() => startEdit(template)}>Edit</button>
              </div>
            </div>
          ))}
        </div>
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
