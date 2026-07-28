import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

interface ErpSetup {
  integrations: Array<{ category: string; provider: string | null; isEnabled: boolean; config: Record<string, unknown>; hasSecrets: boolean }>;
  paymentMethods: Array<{ id: string; code: string; name: string; isActive: boolean; instructions: string | null }>;
  modules: Array<{ moduleKey: string; adminEnabled: boolean; studentEnabled: boolean; parentEnabled: boolean }>;
  languages: Array<{ code: string; name: string; isEnabled: boolean; isDefault: boolean }>;
  customFields: Array<{ id: string; target: string; key: string; label: string; type: string; isActive: boolean }>;
  systemFields: Array<{ target: string; fieldKey: string; label: string; isEnabled: boolean; isRequired: boolean }>;
  shortcuts: Array<{ actionKey: string; shortcut: string; isEnabled: boolean }>;
  profileRights: Array<{ fieldKey: string; studentVisible: boolean; parentVisible: boolean; studentEditable: boolean; parentEditable: boolean }>;
  holidays: Array<{ id: string; title: string; startDate: string; endDate: string; academicSession: { name: string } | null }>;
  folders: Array<{ id: string; name: string; parentId: string | null; _count: { documents: number; children: number } }>;
  documents: Array<{ id: string; name: string; fileUrl: string; student: { firstName: string; lastName: string | null }; folder: { name: string } }>;
  backups: Array<{ id: string; name: string; createdAt: string; restoredAt: string | null; createdBy: { firstName: string; lastName: string } }>;
  sessions: Array<{ id: string; name: string; isCurrent: boolean }>;
  students: Array<{ id: string; admissionNumber: string; firstName: string; lastName: string | null }>;
}
type Tab = "integrations" | "access" | "fields" | "calendar" | "documents" | "backups";
const categories = ["NOTIFICATION", "SMS", "EMAIL", "WEBSITE", "LIVE_CLASS"];
const moduleKeys = ["dashboard", "students", "academics", "timetable", "attendance", "fees", "examinations", "homework", "hr", "documents", "reports"];

export function ErpSettingsPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<ErpSetup | null>(null);
  const [tab, setTab] = useState<Tab>("integrations");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    try { setSetup(await apiRequest<ErpSetup>("/erp/setup", accessToken)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load ERP settings"); }
  }
  useEffect(() => { void load(); }, [accessToken]);
  const run = async (action: () => Promise<unknown>, success: string) => {
    setError(""); setMessage("");
    try { await action(); setMessage(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ERP setting could not be saved"); }
  };
  return <main className="page-main">
    <PageHeader eyebrow="ERP settings" title="CMS control center" description="Configure providers, payment methods, panel modules, fields, holidays, documents, and recoverable tenant settings." />
    {error && <p className="alert-error mt-6">{error}</p>}{message && <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
    <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200">{(["integrations", "access", "fields", "calendar", "documents", "backups"] as Tab[]).map((item) => <button className={`tab ${tab === item ? "tab-active" : ""}`} key={item} onClick={() => setTab(item)}>{item === "access" ? "Modules & languages" : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {!setup ? <p className="mt-8 text-sm text-slate-500">Loading ERP settings…</p> : <>
      {tab === "integrations" && <IntegrationPanel setup={setup} token={accessToken} run={run} />}
      {tab === "access" && <AccessPanel setup={setup} token={accessToken} run={run} />}
      {tab === "fields" && <FieldsPanel setup={setup} token={accessToken} run={run} />}
      {tab === "calendar" && <CalendarPanel setup={setup} token={accessToken} run={run} />}
      {tab === "documents" && <DocumentsPanel setup={setup} token={accessToken} run={run} />}
      {tab === "backups" && <BackupsPanel setup={setup} token={accessToken} run={run} />}
    </>}
  </main>;
}

type Run = (action: () => Promise<unknown>, success: string) => Promise<void>;

function IntegrationPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [integration, setIntegration] = useState({ category: "NOTIFICATION", provider: "", isEnabled: false, config: "{}", secrets: "{}" });
  const [payment, setPayment] = useState({ code: "", name: "", instructions: "" });
  const current = setup.integrations.find((item) => item.category === integration.category);

  function selectCategory(category: string) {
    const found = setup.integrations.find((item) => item.category === category);
    const emptyConfig = !found?.config || Object.keys(found.config).length === 0;
    let config = JSON.stringify(found?.config ?? {}, null, 2);
    let provider = found?.provider ?? "";
    if (category === "SMS" && emptyConfig) {
      provider = provider || "twilio";
      config = JSON.stringify({ fromNumber: "+91XXXXXXXXXX" }, null, 2);
    }
    if (category === "EMAIL" && emptyConfig) {
      provider = provider || "SMTP";
      config = JSON.stringify(
        { host: "smtp.gmail.com", port: 587, secure: false, from: "noreply@school.com", fromName: "School" },
        null,
        2,
      );
    }
    setIntegration({
      category,
      provider,
      isEnabled: found?.isEnabled ?? false,
      config,
      secrets: category === "SMS"
        ? '{\n  "accountSid": "ACxxxxxxxx",\n  "authToken": "your_auth_token"\n}'
        : category === "EMAIL"
          ? '{\n  "user": "smtp-user",\n  "pass": "smtp-password"\n}'
          : "{}",
    });
  }

  async function saveIntegration(event: FormEvent) {
    event.preventDefault();
    const secrets = JSON.parse(integration.secrets) as Record<string, string>;
    const placeholderSecrets =
      Object.values(secrets).some((value) =>
        /ACxxxxxxxx|your_auth_token|smtp-user|smtp-password|XXXXXX/i.test(String(value)),
      );
    await run(
      () =>
        apiRequest(`/erp/integrations/${integration.category}`, token, {
          method: "PUT",
          body: JSON.stringify({
            provider: integration.provider || null,
            isEnabled: integration.isEnabled,
            config: JSON.parse(integration.config),
            // Skip placeholder / empty secrets so we don't wipe real credentials
            secrets: placeholderSecrets || !Object.keys(secrets).length ? undefined : secrets,
          }),
        }),
      "Integration setting saved",
    );
  }

  async function savePayment(event: FormEvent) {
    event.preventDefault();
    await run(() => apiRequest("/erp/payment-methods", token, { method: "POST", body: JSON.stringify(payment) }), "Payment method added");
    setPayment({ code: "", name: "", instructions: "" });
  }
  return <section className="mt-6 grid gap-5 lg:grid-cols-2">
    <form className="card p-5" onSubmit={(event) => void saveIntegration(event)}><h2 className="font-semibold">Provider configuration</h2><p className="mt-1 text-sm text-slate-500">Credentials are encrypted at rest and never returned by the API.</p>
      <select className="input mt-4" value={integration.category} onChange={(e) => selectCategory(e.target.value)}>{categories.map((category) => <option key={category} value={category}>{category.replace("_", " ")}</option>)}</select>
      <input className="input mt-3" placeholder="Provider, e.g. SMTP or Twilio" value={integration.provider} onChange={(e) => setIntegration({ ...integration, provider: e.target.value })} />
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={integration.isEnabled} onChange={(e) => setIntegration({ ...integration, isEnabled: e.target.checked })} />Enabled</label>
      {current?.hasSecrets ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">Secrets are saved for this provider. Leave Secrets as {"{}"} to keep them, or paste new values to replace.</p>
      ) : (
        <p className="mt-2 text-xs font-medium text-amber-700">No secrets saved yet for this provider. Paste real credentials before enabling.</p>
      )}
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {integration.category === "EMAIL"
          ? 'EMAIL config: {"host","port","secure","from","fromName"}. Secrets: {"user","pass"}'
          : integration.category === "SMS"
            ? 'SMS config: {"fromNumber":"+91..."}. Secrets: {"accountSid":"AC...","authToken":"..."}. Provider: twilio. Replace placeholders with real Twilio values, then Save.'
            : "Enable and save provider settings used by campus notifications and reminders."}
      </p>
      <label className="label mt-4">Public config (JSON)</label><textarea className="input min-h-28 font-mono text-xs" value={integration.config} onChange={(e) => setIntegration({ ...integration, config: e.target.value })} />
      <label className="label mt-3">Secrets (JSON, leave {"{}"} to preserve)</label><textarea className="input min-h-20 font-mono text-xs" value={integration.secrets} onChange={(e) => setIntegration({ ...integration, secrets: e.target.value })} />
      <button className="button-primary mt-4">Save integration</button>
    </form>
    <div>
      <form className="card p-5" onSubmit={(event) => void savePayment(event)}><h2 className="font-semibold">Payment methods</h2><div className="mt-4 grid grid-cols-2 gap-3"><input className="input" required placeholder="Code" value={payment.code} onChange={(e) => setPayment({ ...payment, code: e.target.value })} /><input className="input" required placeholder="Display name" value={payment.name} onChange={(e) => setPayment({ ...payment, name: e.target.value })} /></div><textarea className="input mt-3" placeholder="Payment instructions" value={payment.instructions} onChange={(e) => setPayment({ ...payment, instructions: e.target.value })} /><button className="button-primary mt-4">Add method</button></form>
      <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">{setup.paymentMethods.map((item) => <div className="flex items-center justify-between p-4" key={item.id}><div><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.code} · {item.isActive ? "Active" : "Disabled"}</p></div><button className="text-sm font-semibold text-rose-600" onClick={() => void run(() => apiRequest(`/erp/payment-methods/${item.id}`, token, { method: "DELETE" }), "Payment method deleted")}>Delete</button></div>)}</div>
    </div>
  </section>;
}

function AccessPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [language, setLanguage] = useState({ code: "", name: "", isEnabled: true, isDefault: false });
  return <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]"><div className="card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-semibold">Panel module visibility</h2><p className="text-sm text-slate-500">Role permissions still apply after a panel module is enabled.</p></div><div className="divide-y divide-slate-100">{moduleKeys.map((key) => {
    const current = setup.modules.find((item) => item.moduleKey === key) ?? { adminEnabled: true, studentEnabled: true, parentEnabled: true };
    const save = (field: "adminEnabled" | "studentEnabled" | "parentEnabled", value: boolean) => run(() => apiRequest(`/erp/modules/${key}`, token, { method: "PUT", body: JSON.stringify({ ...current, [field]: value }) }), `${key} visibility saved`);
    return <div className="grid grid-cols-[1fr_repeat(3,80px)] items-center gap-2 p-4 text-sm" key={key}><span className="font-medium capitalize">{key}</span>{(["adminEnabled", "studentEnabled", "parentEnabled"] as const).map((field) => <label className="text-center" key={field}><span className="block text-xs text-slate-500">{field.replace("Enabled", "")}</span><input type="checkbox" checked={current[field]} onChange={(e) => void save(field, e.target.checked)} /></label>)}</div>;
  })}</div></div>
    <div><form className="card p-5" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/erp/languages", token, { method: "PUT", body: JSON.stringify(language) }), "Language saved"); }}><h2 className="font-semibold">Languages</h2><input className="input mt-4" required placeholder="Code (en)" value={language.code} onChange={(e) => setLanguage({ ...language, code: e.target.value })} /><input className="input mt-3" required placeholder="Language name" value={language.name} onChange={(e) => setLanguage({ ...language, name: e.target.value })} /><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={language.isDefault} onChange={(e) => setLanguage({ ...language, isDefault: e.target.checked })} />Default language</label><button className="button-primary mt-4">Save language</button></form><div className="card mt-5 divide-y divide-slate-100">{setup.languages.map((item) => <div className="p-4" key={item.code}><p className="font-medium">{item.name} <span className="text-xs text-slate-500">({item.code})</span></p>{item.isDefault && <span className="badge-success">Default</span>}</div>)}</div></div>
  </section>;
}

function FieldsPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [custom, setCustom] = useState({ target: "STUDENT", key: "", label: "", type: "TEXT", isRequired: false });
  const [system, setSystem] = useState({ target: "STUDENT", fieldKey: "", label: "", isEnabled: true, isRequired: false });
  const [shortcut, setShortcut] = useState({ actionKey: "", shortcut: "", isEnabled: true });
  const [right, setRight] = useState({ fieldKey: "", studentVisible: true, parentVisible: true, studentEditable: false, parentEditable: false });
  return <section className="mt-6 grid gap-5 lg:grid-cols-2">
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest("/erp/custom-fields", token, { method: "POST", body: JSON.stringify(custom) }), "Custom field added"); }}><h2 className="font-semibold">Custom fields</h2><div className="mt-4 grid grid-cols-2 gap-3"><select className="input" value={custom.target} onChange={(e) => setCustom({ ...custom, target: e.target.value })}><option>STUDENT</option><option>STAFF</option><option>ADMISSION</option></select><select className="input" value={custom.type} onChange={(e) => setCustom({ ...custom, type: e.target.value })}><option>TEXT</option><option>TEXTAREA</option><option>NUMBER</option><option>DATE</option><option>SELECT</option><option>CHECKBOX</option></select><input className="input" required placeholder="Key" value={custom.key} onChange={(e) => setCustom({ ...custom, key: e.target.value })} /><input className="input" required placeholder="Label" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} /></div><button className="button-primary mt-4">Add custom field</button><div className="mt-4 divide-y divide-slate-100">{setup.customFields.map((item) => <div className="flex justify-between py-3 text-sm" key={item.id}><span>{item.target} · {item.label} ({item.type})</span><button className="font-semibold text-rose-600" type="button" onClick={() => void run(() => apiRequest(`/erp/custom-fields/${item.id}`, token, { method: "DELETE" }), "Custom field deleted")}>Delete</button></div>)}</div></form>
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest(`/erp/system-fields/${system.fieldKey}`, token, { method: "PUT", body: JSON.stringify({ ...system, fieldKey: undefined }) }), "System field saved"); }}><h2 className="font-semibold">System fields</h2><div className="mt-4 grid grid-cols-2 gap-3"><select className="input" value={system.target} onChange={(e) => setSystem({ ...system, target: e.target.value })}><option>STUDENT</option><option>STAFF</option><option>ADMISSION</option></select><input className="input" required placeholder="Field key" value={system.fieldKey} onChange={(e) => setSystem({ ...system, fieldKey: e.target.value })} /><input className="input col-span-2" required placeholder="Label" value={system.label} onChange={(e) => setSystem({ ...system, label: e.target.value })} /></div><div className="mt-3 flex gap-4 text-sm"><label><input type="checkbox" checked={system.isEnabled} onChange={(e) => setSystem({ ...system, isEnabled: e.target.checked })} /> Enabled</label><label><input type="checkbox" checked={system.isRequired} onChange={(e) => setSystem({ ...system, isRequired: e.target.checked })} /> Required</label></div><button className="button-primary mt-4">Save system field</button></form>
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest(`/erp/shortcuts/${shortcut.actionKey}`, token, { method: "PUT", body: JSON.stringify({ shortcut: shortcut.shortcut, isEnabled: shortcut.isEnabled }) }), "Shortcut saved"); }}><h2 className="font-semibold">Shortcut keys</h2><input className="input mt-4" required placeholder="Action key, e.g. add_student" value={shortcut.actionKey} onChange={(e) => setShortcut({ ...shortcut, actionKey: e.target.value })} /><input className="input mt-3" required placeholder="Shortcut, e.g. Ctrl+Shift+S" value={shortcut.shortcut} onChange={(e) => setShortcut({ ...shortcut, shortcut: e.target.value })} /><button className="button-primary mt-4">Save shortcut</button><div className="mt-4 text-sm">{setup.shortcuts.map((item) => <p className="py-1" key={item.actionKey}>{item.actionKey}: <kbd>{item.shortcut}</kbd></p>)}</div></form>
    <form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest(`/erp/profile-rights/${right.fieldKey}`, token, { method: "PUT", body: JSON.stringify({ ...right, fieldKey: undefined }) }), "Student profile right saved"); }}><h2 className="font-semibold">Student profile rights</h2><input className="input mt-4" required placeholder="Student field key" value={right.fieldKey} onChange={(e) => setRight({ ...right, fieldKey: e.target.value })} /><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{(["studentVisible", "parentVisible", "studentEditable", "parentEditable"] as const).map((field) => <label key={field}><input type="checkbox" checked={right[field]} onChange={(e) => setRight({ ...right, [field]: e.target.checked })} /> {field.replace(/([A-Z])/g, " $1")}</label>)}</div><button className="button-primary mt-4">Save rights</button></form>
  </section>;
}

function CalendarPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [form, setForm] = useState({ academicSessionId: setup.sessions.find(({ isCurrent }) => isCurrent)?.id ?? "", title: "", startDate: "", endDate: "", description: "" });
  return <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]"><form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest("/erp/holidays", token, { method: "POST", body: JSON.stringify(form) }), "Holiday added"); }}><h2 className="font-semibold">Add holiday</h2><select className="input mt-4" value={form.academicSessionId} onChange={(e) => setForm({ ...form, academicSessionId: e.target.value })}><option value="">All sessions</option>{setup.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="input mt-3" required placeholder="Holiday title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><div className="mt-3 grid grid-cols-2 gap-3"><input className="input" required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><input className="input" required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div><textarea className="input mt-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><button className="button-primary mt-4">Add holiday</button></form><div className="card divide-y divide-slate-100">{setup.holidays.map((item) => <div className="flex justify-between gap-3 p-5" key={item.id}><div><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">{new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()} · {item.academicSession?.name ?? "All sessions"}</p></div><button className="text-sm font-semibold text-rose-600" onClick={() => void run(() => apiRequest(`/erp/holidays/${item.id}`, token, { method: "DELETE" }), "Holiday deleted")}>Delete</button></div>)}</div></section>;
}

function DocumentsPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [folder, setFolder] = useState({ name: "", parentId: "" });
  const [document, setDocument] = useState({ studentId: "", folderId: "", name: "", fileUrl: "", mimeType: "", sizeBytes: null });
  return <section className="mt-6 grid gap-5 lg:grid-cols-[380px_1fr]"><div><form className="card p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest("/erp/document-folders", token, { method: "POST", body: JSON.stringify({ ...folder, parentId: folder.parentId || null }) }), "Document folder created"); }}><h2 className="font-semibold">Student document folder</h2><input className="input mt-4" required placeholder="Folder name" value={folder.name} onChange={(e) => setFolder({ ...folder, name: e.target.value })} /><select className="input mt-3" value={folder.parentId} onChange={(e) => setFolder({ ...folder, parentId: e.target.value })}><option value="">Top-level folder</option>{setup.folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button-primary mt-4">Create folder</button></form>
    <form className="card mt-5 p-5" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest("/erp/student-documents", token, { method: "POST", body: JSON.stringify(document) }), "Student document linked"); }}><h2 className="font-semibold">Add student document</h2><select className="input mt-4" required value={document.studentId} onChange={(e) => setDocument({ ...document, studentId: e.target.value })}><option value="">Student</option>{setup.students.map((item) => <option key={item.id} value={item.id}>{item.admissionNumber} · {item.firstName} {item.lastName}</option>)}</select><select className="input mt-3" required value={document.folderId} onChange={(e) => setDocument({ ...document, folderId: e.target.value })}><option value="">Folder</option>{setup.folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="input mt-3" required placeholder="Document name" value={document.name} onChange={(e) => setDocument({ ...document, name: e.target.value })} /><input className="input mt-3" required type="url" placeholder="Secure file URL" value={document.fileUrl} onChange={(e) => setDocument({ ...document, fileUrl: e.target.value })} /><button className="button-primary mt-4">Link document</button></form></div>
    <div className="card divide-y divide-slate-100">{setup.documents.map((item) => <div className="flex justify-between gap-3 p-5" key={item.id}><div><a className="font-medium text-indigo-700" href={item.fileUrl} target="_blank" rel="noreferrer">{item.name}</a><p className="text-sm text-slate-500">{item.student.firstName} {item.student.lastName} · {item.folder.name}</p></div><button className="text-sm font-semibold text-rose-600" onClick={() => void run(() => apiRequest(`/erp/student-documents/${item.id}`, token, { method: "DELETE" }), "Student document removed")}>Delete</button></div>)}{!setup.documents.length && <p className="p-8 text-center text-sm text-slate-500">No student documents linked.</p>}</div>
  </section>;
}

function BackupsPanel({ setup, token, run }: { setup: ErpSetup; token: string; run: Run }) {
  const [name, setName] = useState(`Configuration ${new Date().toISOString().slice(0, 10)}`);
  return <section className="mt-6"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Configuration backups contain tenant branding, general/fee settings, encrypted provider configuration, payment methods, module visibility, languages, and field/access configuration. Business transactions and uploaded file content are intentionally excluded.</div><form className="card mt-5 flex flex-col gap-3 p-5 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run(() => apiRequest("/erp/backups", token, { method: "POST", body: JSON.stringify({ name }) }), "Configuration backup created"); }}><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /><button className="button-primary whitespace-nowrap">Create backup</button></form><div className="card mt-5 divide-y divide-slate-100">{setup.backups.map((item) => <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={item.id}><div><p className="font-medium">{item.name}</p><p className="text-sm text-slate-500">Created {new Date(item.createdAt).toLocaleString()} by {item.createdBy.firstName} {item.createdBy.lastName}{item.restoredAt ? ` · Restored ${new Date(item.restoredAt).toLocaleString()}` : ""}</p></div><button className="button-secondary" onClick={() => { if (window.confirm("Restore this configuration? Current configuration values will be replaced.")) void run(() => apiRequest(`/erp/backups/${item.id}/restore`, token, { method: "POST" }), "Configuration restored"); }}>Restore</button></div>)}</div></section>;
}
