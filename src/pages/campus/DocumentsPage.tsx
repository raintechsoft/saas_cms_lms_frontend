import {
  AddOutlined,
  ArrowForwardOutlined,
  BadgeOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  CloudUploadOutlined,
  ContentCopyOutlined,
  CreditCardOutlined,
  CropLandscapeOutlined,
  CropPortraitOutlined,
  DeleteOutlineOutlined,
  EditOutlined,
  FileDownloadOutlined,
  HistoryOutlined,
  MoreVertOutlined,
  NoteAddOutlined,
  PrintOutlined,
  SearchOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type TemplateType = "ADMIT_CARD" | "MARKSHEET" | "CERTIFICATE" | "ID_CARD";
type DesignType = "CERTIFICATE" | "ID_CARD";

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
interface ClassSection {
  id: string;
  academicClass: { id: string; name: string };
  section: { id: string; name: string };
}
interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  photoUrl?: string | null;
  enrollments?: Array<{ classSection: ClassSection }>;
}
interface Staff {
  id: string;
  employeeNumber: string;
  user: { firstName: string; lastName: string };
}
interface Generated {
  id: string;
  serialNumber: string;
  barcodeValue: string | null;
  generatedAt: string;
  template: { id: string; type: TemplateType; name: string };
  student: Student | null;
  staff: Staff | null;
  exam: { id: string; name: string } | null;
  generatedBy?: { firstName: string; lastName: string } | null;
}

type Tab = "design-cert" | "generate-cert" | "design-id" | "generate-id" | "history";

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "design-cert", label: "Design Certificate", icon: WorkspacePremiumOutlined, tone: "amber" },
  { key: "generate-cert", label: "Generate Certificate", icon: PrintOutlined, tone: "emerald" },
  { key: "design-id", label: "Design ID Card", icon: BadgeOutlined, tone: "sky" },
  { key: "generate-id", label: "Generate ID Card", icon: CreditCardOutlined, tone: "indigo" },
  { key: "history", label: "Generation History", icon: HistoryOutlined, tone: "slate" },
];

interface PageSizeOption {
  key: string;
  label: string;
  chip: string;
  width: number;
  height: number;
}

const CERTIFICATE_SIZES: PageSizeOption[] = [
  { key: "a4-landscape", label: "A4 Landscape (297 × 210 mm)", chip: "A4 Landscape", width: 1600, height: 1131 },
  { key: "a4-portrait", label: "A4 Portrait (210 × 297 mm)", chip: "A4 Portrait", width: 1131, height: 1600 },
  { key: "letter-landscape", label: "Letter Landscape (279 × 216 mm)", chip: "Letter Landscape", width: 1650, height: 1275 },
  { key: "letter-portrait", label: "Letter Portrait (216 × 279 mm)", chip: "Letter Portrait", width: 1275, height: 1650 },
];

const ID_CARD_SIZES: PageSizeOption[] = [
  { key: "horizontal", label: "Horizontal", chip: "Horizontal", width: 1013, height: 638 },
  { key: "vertical", label: "Vertical", chip: "Vertical", width: 638, height: 1013 },
];

function sizeOptions(type: DesignType) {
  return type === "CERTIFICATE" ? CERTIFICATE_SIZES : ID_CARD_SIZES;
}

function sizeChip(template: Template) {
  // ID cards are labelled by orientation regardless of exact pixel size.
  if (template.type === "ID_CARD") {
    return template.width >= template.height ? "Horizontal" : "Vertical";
  }
  const match = CERTIFICATE_SIZES.find(
    (option) => option.width === template.width && option.height === template.height,
  );
  return match ? match.chip : `${template.width} × ${template.height}px`;
}

function clampChannel(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 255;
  return Math.min(255, Math.max(0, Math.round(parsed)));
}

function rgbToHex(r: string, g: string, b: string) {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string): { r: string; g: string; b: string } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return { r: "255", g: "255", b: "255" };
  const value = match[1];
  return {
    r: String(parseInt(value.slice(0, 2), 16)),
    g: String(parseInt(value.slice(2, 4), 16)),
    b: String(parseInt(value.slice(4, 6), 16)),
  };
}

function personName(document: Generated) {
  if (document.student) {
    return `${document.student.firstName} ${document.student.lastName ?? ""}`.trim();
  }
  if (document.staff) {
    return `${document.staff.user.firstName} ${document.staff.user.lastName}`.trim();
  }
  return "—";
}

const TYPE_LABEL: Record<TemplateType, string> = {
  CERTIFICATE: "Certificate",
  ID_CARD: "ID Card",
  ADMIT_CARD: "Admit Card",
  MARKSHEET: "Marksheet",
};

/** The students endpoint caps page size at 100, so larger rosters are paged. */
async function loadAllStudents(token: string): Promise<Student[]> {
  const first = await apiRequest<{ items: Student[]; total: number }>(
    "/students?limit=100&page=1",
    token,
  );
  const items = [...first.items];
  let page = 2;
  while (items.length < first.total && page <= 20) {
    const next = await apiRequest<{ items: Student[] }>(`/students?limit=100&page=${page}`, token);
    if (!next.items.length) break;
    items.push(...next.items);
    page += 1;
  }
  return items;
}

export function DocumentsPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("design-cert");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classSections, setClassSections] = useState<ClassSection[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [documents, setDocuments] = useState<Generated[]>([]);
  const [formResetKey, setFormResetKey] = useState(0);

  async function load() {
    try {
      const [nextTemplates, nextStudents, setup, hr, nextDocuments] = await Promise.all([
        apiRequest<Template[]>("/documents/templates", accessToken),
        // The students module may be disabled for this tenant; the page still works.
        loadAllStudents(accessToken).catch(() => [] as Student[]),
        apiRequest<{ classSections: ClassSection[] }>("/students/setup", accessToken).catch(
          () => ({ classSections: [] }),
        ),
        apiRequest<{ staff: Staff[] }>("/hr/setup", accessToken).catch(() => ({ staff: [] })),
        apiRequest<Generated[]>("/documents/generated", accessToken),
      ]);
      setTemplates(nextTemplates);
      setStudents(nextStudents);
      setClassSections(setup.classSections);
      setStaff(hr.staff);
      setDocuments(nextDocuments);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load document center");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const designType: DesignType = tab === "design-id" || tab === "generate-id" ? "ID_CARD" : "CERTIFICATE";

  function startNewTemplate() {
    setTab(designType === "ID_CARD" ? "design-id" : "design-cert");
    setFormResetKey((key) => key + 1);
    window.setTimeout(() => {
      window.document
        .getElementById("template-designer-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="Certificates & ID Cards"
        description="Design templates and generate certificates or ID cards for students."
        actions={
          tab === "history" ? undefined : (
            <button className="nx-btn-primary" type="button" onClick={startNewTemplate}>
              <AddOutlined sx={{ fontSize: 17 }} />
              {designType === "ID_CARD" ? "New ID Card Template" : "New Certificate Template"}
            </button>
          )
        }
      />
      <CmsIconTabs
        ariaLabel="Documents sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        items={TABS}
      />
      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "design-cert" && (
          <DesignPanel
            type="CERTIFICATE"
            templates={templates.filter((item) => item.type === "CERTIFICATE")}
            token={accessToken}
            onSaved={load}
            resetKey={formResetKey}
          />
        )}
        {tab === "design-id" && (
          <DesignPanel
            type="ID_CARD"
            templates={templates.filter((item) => item.type === "ID_CARD")}
            token={accessToken}
            onSaved={load}
            resetKey={formResetKey}
          />
        )}
        {tab === "generate-cert" && (
          <GeneratePanel
            type="CERTIFICATE"
            templates={templates}
            students={students}
            classSections={classSections}
            staff={staff}
            token={accessToken}
            onSaved={load}
          />
        )}
        {tab === "generate-id" && (
          <GeneratePanel
            type="ID_CARD"
            templates={templates}
            students={students}
            classSections={classSections}
            staff={staff}
            token={accessToken}
            onSaved={load}
          />
        )}
        {tab === "history" && <HistoryPanel documents={documents} templates={templates} />}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}

/* ------------------------------- Design tab ------------------------------- */

interface DesignForm {
  name: string;
  sizeKey: string;
  width: string;
  height: string;
  backgroundUrl: string;
  r: string;
  g: string;
  b: string;
  showPhoto: boolean;
  showBarcode: boolean;
  showClass: boolean;
  title: string;
}

function defaultDesignForm(type: DesignType): DesignForm {
  const size = sizeOptions(type)[0];
  return {
    name: "",
    sizeKey: size.key,
    width: String(size.width),
    height: String(size.height),
    backgroundUrl: "",
    r: "255",
    g: "255",
    b: "255",
    showPhoto: type === "ID_CARD",
    showBarcode: true,
    showClass: type === "ID_CARD",
    title: type === "ID_CARD" ? "ID Card" : "Certificate",
  };
}

function DesignPanel({ type, templates, token, onSaved, resetKey }: {
  type: DesignType;
  templates: Template[];
  token: string;
  onSaved: () => Promise<void>;
  resetKey: number;
}) {
  const noun = type === "ID_CARD" ? "ID Card" : "Certificate";
  const lowerNoun = type === "ID_CARD" ? "ID card" : "certificate";
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<DesignForm>(() => defaultDesignForm(type));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    setEditing(null);
    setForm(defaultDesignForm(type));
  }, [resetKey, type]);

  function set<K extends keyof DesignForm>(key: K, value: DesignForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function startEdit(template: Template) {
    const config = template.config ?? {};
    const preset = sizeOptions(type).find(
      (option) => option.width === template.width && option.height === template.height,
    );
    const rgb = hexToRgb(typeof config.backgroundColor === "string" ? config.backgroundColor : "#ffffff");
    setEditing(template);
    setForm({
      name: template.name,
      sizeKey: preset?.key ?? "custom",
      width: String(template.width),
      height: String(template.height),
      backgroundUrl: template.backgroundUrl ?? "",
      ...rgb,
      showPhoto: config.showPhoto !== false,
      showBarcode: config.showBarcode !== false,
      showClass: Boolean(config.showClass ?? type === "ID_CARD"),
      title: String(config.title ?? template.name),
    });
    window.document
      .getElementById("template-designer-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultDesignForm(type));
  }

  function buildPayload() {
    const preset = sizeOptions(type).find((option) => option.key === form.sizeKey);
    const width = preset ? preset.width : Number(form.width);
    const height = preset ? preset.height : Number(form.height);
    return {
      name: form.name.trim(),
      backgroundUrl: form.backgroundUrl || null,
      width,
      height,
      config: {
        // Preserve any config keys added elsewhere (footer notes, logos, ...).
        ...(editing ? editing.config : {}),
        title: form.title.trim() || form.name.trim() || noun,
        showPhoto: form.showPhoto,
        showBarcode: form.showBarcode,
        backgroundColor: rgbToHex(form.r, form.g, form.b),
        pageSize: preset ? preset.chip : `${width} × ${height}px`,
        ...(type === "ID_CARD" ? { showClass: form.showClass } : {}),
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload.width || !payload.height || payload.width < 100 || payload.height < 100) {
      notifyError("Width and height must be at least 100px");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/documents/templates/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Template updated");
      } else {
        await apiRequest("/documents/templates", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, type }),
        });
        notifySuccess("Template created");
      }
      cancelEdit();
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(template: Template) {
    setBusyId(template.id);
    const base = {
      type: template.type,
      backgroundUrl: template.backgroundUrl,
      width: template.width,
      height: template.height,
      config: template.config,
    };
    try {
      try {
        await apiRequest("/documents/templates", token, {
          method: "POST",
          body: JSON.stringify({ ...base, name: `${template.name} (Copy)` }),
        });
      } catch {
        // A copy with that name already exists; retry with a unique suffix.
        await apiRequest("/documents/templates", token, {
          method: "POST",
          body: JSON.stringify({ ...base, name: `${template.name} (Copy ${Date.now() % 10000})` }),
        });
      }
      notifySuccess("Template duplicated");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to duplicate template");
    } finally {
      setBusyId("");
    }
  }

  async function remove(template: Template) {
    const ok = await confirmDelete({
      title: `Delete ${lowerNoun} template?`,
      text:
        template._count.documents > 0
          ? `"${template.name}" has ${template._count.documents} generated document(s), so it will be archived instead of deleted.`
          : `"${template.name}" will be permanently deleted.`,
    });
    if (!ok) return;
    setBusyId(template.id);
    try {
      const result = await apiRequest<{ deleted: boolean; deactivated: boolean }>(
        `/documents/templates/${template.id}`,
        token,
        { method: "DELETE" },
      );
      notifySuccess(result.deleted ? "Template deleted" : "Template archived — it was already used to generate documents");
      if (editing?.id === template.id) cancelEdit();
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete template");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <CmsSectionCard className="p-4">
        {templates.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                busy={busyId === template.id}
                onEdit={() => startEdit(template)}
                onDuplicate={() => void duplicate(template)}
                onDelete={() => void remove(template)}
              />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center gap-2 py-14 text-center">
            {type === "ID_CARD" ? (
              <BadgeOutlined sx={{ fontSize: 34 }} className="text-slate-300" />
            ) : (
              <WorkspacePremiumOutlined sx={{ fontSize: 34 }} className="text-slate-300" />
            )}
            <p className="text-sm font-semibold text-slate-500">No {lowerNoun} templates yet</p>
            <p className="text-xs text-slate-400">Use the form below to create your first template.</p>
          </div>
        )}
      </CmsSectionCard>

      <CmsSectionCard className="p-5" >
        <form id="template-designer-form" onSubmit={submit}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              {editing ? `Edit ${noun} Template` : `Create ${noun} Template`}
            </h2>
            {editing ? (
              <button className="nx-btn-secondary" type="button" onClick={cancelEdit}>
                Cancel editing
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-[1.05fr_1fr_1.35fr_1fr_0.75fr]">
            <div>
              <label className="nx-label">
                {noun} Name <span className="text-rose-500">*</span>
              </label>
              <input
                className="nx-input"
                required
                placeholder={`Enter ${lowerNoun} name`}
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                For internal reference only — not printed on the {lowerNoun}.
              </p>
            </div>

            <div>
              <label className="nx-label">
                {type === "ID_CARD" ? "Layout Size" : "Page Size"} <span className="text-rose-500">*</span>
              </label>
              <select
                className="nx-input"
                value={form.sizeKey}
                onChange={(event) => set("sizeKey", event.target.value)}
              >
                {sizeOptions(type).map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom size (px)</option>
              </select>
              {type === "ID_CARD" && form.sizeKey !== "custom" ? (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Use custom sizes carefully — very small sizes may not render well on the design canvas.
                </p>
              ) : null}
              {form.sizeKey === "custom" ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="nx-input"
                    type="number"
                    min={100}
                    max={5000}
                    required
                    placeholder="Width px"
                    value={form.width}
                    onChange={(event) => set("width", event.target.value)}
                  />
                  <input
                    className="nx-input"
                    type="number"
                    min={100}
                    max={5000}
                    required
                    placeholder="Height px"
                    value={form.height}
                    onChange={(event) => set("height", event.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label className="nx-label">Background Image</label>
              <ImageDrop value={form.backgroundUrl} onChange={(value) => set("backgroundUrl", value)} />
            </div>

            <div>
              <label className="nx-label">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Background color"
                  className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
                  value={rgbToHex(form.r, form.g, form.b)}
                  onChange={(event) => {
                    const rgb = hexToRgb(event.target.value);
                    setForm((previous) => ({ ...previous, ...rgb }));
                  }}
                />
                {(["r", "g", "b"] as const).map((channel, index) => (
                  <span className="flex items-center gap-2" key={channel}>
                    {index > 0 ? <span className="text-slate-300">/</span> : null}
                    <input
                      className="nx-input w-14 px-2 text-center"
                      type="number"
                      min={0}
                      max={255}
                      value={form[channel]}
                      onChange={(event) => set(channel, event.target.value)}
                      onBlur={(event) => set(channel, String(clampChannel(event.target.value)))}
                    />
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">( R / G / B )</p>
            </div>

            <div>
              <label className="nx-label">Show Student Image</label>
              <Toggle checked={form.showPhoto} onChange={(value) => set("showPhoto", value)} />
              {type === "ID_CARD" ? (
                <>
                  <label className="nx-label mt-3">Show Barcode</label>
                  <Toggle checked={form.showBarcode} onChange={(value) => set("showBarcode", value)} />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Automatically linked to the student&apos;s admission number.
                  </p>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="nx-label">Printed Title</label>
              <input
                className="nx-input"
                placeholder={noun}
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Heading printed at the top of the {lowerNoun}.
              </p>
            </div>
            {type === "CERTIFICATE" ? (
              <div>
                <label className="nx-label">Show Barcode</label>
                <Toggle checked={form.showBarcode} onChange={(value) => set("showBarcode", value)} />
              </div>
            ) : (
              <div>
                <label className="nx-label">Show Class / Section</label>
                <Toggle checked={form.showClass} onChange={(value) => set("showClass", value)} />
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col items-end gap-1.5">
            <button className="nx-btn-primary" disabled={saving} type="submit">
              {saving ? "Saving…" : editing ? "Update & Design" : "Save & Design"}
              <ArrowForwardOutlined sx={{ fontSize: 16 }} />
            </button>
            <p className="text-[11px] text-slate-400">
              The template appears above and is used in Generate {noun}.
            </p>
          </div>
        </form>
      </CmsSectionCard>
    </div>
  );
}

function TemplateCard({ template, busy, onEdit, onDuplicate, onDelete }: {
  template: Template;
  busy: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white p-3 transition hover:border-indigo-200 hover:shadow-md">
      <div className="absolute right-5 top-5 z-10 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
          type="button"
          title="Edit template"
          disabled={busy}
          onClick={onEdit}
        >
          <EditOutlined sx={{ fontSize: 15 }} />
        </button>
        <button
          className="grid size-7 place-items-center rounded-md text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
          type="button"
          title="Duplicate template"
          disabled={busy}
          onClick={onDuplicate}
        >
          <ContentCopyOutlined sx={{ fontSize: 15 }} />
        </button>
        <button
          className="grid size-7 place-items-center rounded-md text-rose-500 hover:bg-rose-50"
          type="button"
          title="Delete template"
          disabled={busy}
          onClick={onDelete}
        >
          <DeleteOutlineOutlined sx={{ fontSize: 16 }} />
        </button>
      </div>
      <TemplateThumb template={template} />
      <div className="mt-3 flex items-center justify-between gap-2 px-1 pb-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-800">{template.name}</p>
          <p className="text-[11px] text-slate-400">
            {template._count.documents} generated
            {template.isActive ? "" : " · Inactive"}
          </p>
        </div>
        <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
          {sizeChip(template)}
        </span>
      </div>
    </div>
  );
}

function TemplateThumb({ template }: { template: Template }) {
  const { user } = useAuth();
  const config = template.config ?? {};
  const school = (user?.tenant?.name ?? "School").toUpperCase();
  const backgroundColor =
    typeof config.backgroundColor === "string" ? config.backgroundColor : "#ffffff";
  const title = String(config.title ?? template.name);
  const horizontal = template.width >= template.height;
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-slate-100/80 p-2">
      {template.type === "ID_CARD" ? (
        <span className="absolute right-2 top-2 flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-semibold text-slate-500 shadow-sm">
          {horizontal ? (
            <CropLandscapeOutlined sx={{ fontSize: 15 }} />
          ) : (
            <CropPortraitOutlined sx={{ fontSize: 15 }} />
          )}
          {horizontal ? "Horizontal" : "Vertical"}
        </span>
      ) : null}
      <div
        className="relative overflow-hidden rounded-sm border border-slate-200 shadow-sm"
        style={{
          aspectRatio: `${template.width} / ${template.height}`,
          height: "100%",
          maxWidth: "100%",
          backgroundColor,
          backgroundImage: template.backgroundUrl ? `url(${template.backgroundUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {template.type === "ID_CARD" && horizontal ? (
          <div className="absolute inset-[7%] flex items-center gap-1.5 rounded-sm bg-white/75 p-1.5 text-left">
            {config.showPhoto !== false ? (
              <div className="grid h-12 w-10 shrink-0 place-items-center rounded-sm border border-slate-300 bg-slate-100 text-[5px] text-slate-400">
                PHOTO
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[6px] font-bold uppercase tracking-wider text-slate-600">
                {school}
              </p>
              <p className="text-[5px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {title}
              </p>
              <p className="mt-0.5 truncate text-[7.5px] font-bold text-slate-800">Student Name</p>
              {config.showClass !== false ? (
                <p className="text-[5.5px] text-slate-500">Class: 8 - A</p>
              ) : null}
              <p className="text-[5.5px] text-slate-500">ADM No.: ADM/2021/0001</p>
              {config.showBarcode !== false ? (
                <div className="mt-0.5 h-1.5 w-14 bg-[repeating-linear-gradient(90deg,#0f172a_0_1px,transparent_1px_3px)]" />
              ) : null}
            </div>
          </div>
        ) : template.type === "ID_CARD" ? (
          <div className="absolute inset-[7%] flex flex-col items-center justify-center gap-0.5 rounded-sm bg-white/75 p-1 text-center">
            <p className="w-full truncate text-[6px] font-bold uppercase tracking-[0.15em] text-slate-600">
              {school}
            </p>
            <p className="text-[5px] font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
            {config.showPhoto !== false ? (
              <div className="mt-0.5 grid size-9 place-items-center rounded-full border border-slate-300 bg-slate-100 text-[5px] text-slate-400">
                PHOTO
              </div>
            ) : null}
            <p className="mt-0.5 text-[7px] font-bold text-slate-800">Student Name</p>
            {config.showClass !== false ? (
              <p className="text-[5.5px] text-slate-500">Class: 8 - A</p>
            ) : null}
            <p className="text-[5.5px] text-slate-500">ADM No.: ADM/2021/0001</p>
            {config.showBarcode !== false ? (
              <div className="mt-0.5 h-2 w-12 bg-[repeating-linear-gradient(90deg,#0f172a_0_1px,transparent_1px_3px)]" />
            ) : null}
          </div>
        ) : (
          <div className="absolute inset-[6%] flex flex-col items-center justify-center rounded-sm border border-slate-400/40 bg-white/65 px-2 text-center">
            <p className="w-full truncate text-[5.5px] font-bold uppercase tracking-[0.25em] text-slate-500">
              {school}
            </p>
            <p className="mt-0.5 w-full truncate font-serif text-[10px] font-bold uppercase tracking-wide text-slate-800">
              {title}
            </p>
            <p className="mt-1 text-[5.5px] text-slate-500">This is to certify that</p>
            <p className="font-serif text-[9px] italic text-amber-600">Student Name</p>
            {config.showBarcode !== false ? (
              <div className="mt-1 h-2 w-16 bg-[repeating-linear-gradient(90deg,#0f172a_0_1px,transparent_1px_3px)]" />
            ) : null}
            <div className="mt-1.5 flex w-full justify-between px-2 text-[5px] text-slate-500">
              <span className="border-t border-slate-400 px-1">Principal</span>
              <span className="border-t border-slate-400 px-1">Date</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-xs font-semibold text-slate-500">{checked ? "Yes" : "No"}</span>
    </div>
  );
}

function ImageDrop({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      notifyError("Only JPG and PNG images are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifyError("Image must be 5MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function commitUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      notifyError("Image URL must start with http:// or https://");
      return;
    }
    onChange(trimmed);
    setUrlDraft("");
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <img src={value} alt="Background preview" className="h-14 w-20 rounded-md border border-slate-200 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-600">
            {value.startsWith("data:") ? "Uploaded image" : value}
          </p>
          <div className="mt-1 flex gap-3 text-[11px] font-semibold">
            <button className="text-indigo-600 hover:underline" type="button" onClick={() => inputRef.current?.click()}>
              Replace
            </button>
            <button className="text-rose-500 hover:underline" type="button" onClick={() => onChange("")}>
              Remove
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        className={`grid cursor-pointer place-items-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-center transition ${
          dragging ? "border-indigo-400 bg-indigo-50/60" : "border-slate-300 bg-slate-50/60 hover:border-indigo-300"
        }`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <CloudUploadOutlined sx={{ fontSize: 22 }} className="text-slate-400" />
        <p className="text-xs font-semibold text-slate-500">
          Drag &amp; drop image here <br /> or click to browse
        </p>
        <p className="text-[10px] text-slate-400">Supported: JPG, PNG (Max 5MB)</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        className="nx-input mt-2"
        placeholder="or paste an image URL and press Enter"
        value={urlDraft}
        onChange={(event) => setUrlDraft(event.target.value)}
        onBlur={commitUrl}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitUrl();
          }
        }}
      />
    </div>
  );
}

/* ------------------------------ Generate tabs ----------------------------- */

const GENERATE_PAGE_SIZE = 6;

function pageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const wanted = new Set(
    [1, 2, current - 1, current, current + 1, total - 1, total].filter(
      (page) => page >= 1 && page <= total,
    ),
  );
  const sorted = [...wanted].sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) items.push("ellipsis");
    items.push(page);
    previous = page;
  }
  return items;
}

function Avatar({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className="size-9 rounded-md border border-slate-200 object-cover" />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="grid size-9 place-items-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-600">
      {initials || "?"}
    </span>
  );
}

interface GenerateRow {
  id: string;
  name: string;
  photoUrl?: string | null;
  detail: string;
  reference: string;
  kind: "student" | "staff";
}

function GeneratePanel({ type, templates, students, classSections, staff, token, onSaved }: {
  type: DesignType;
  templates: Template[];
  students: Student[];
  classSections: ClassSection[];
  staff: Staff[];
  token: string;
  onSaved: () => Promise<void>;
}) {
  const noun = type === "ID_CARD" ? "ID Card" : "Certificate";
  const lowerNoun = type === "ID_CARD" ? "ID card" : "certificate";
  const activeTemplates = templates.filter((item) => item.type === type && item.isActive);
  const [audience, setAudience] = useState<"student" | "staff">("student");
  const [draft, setDraft] = useState({ classId: "", sectionId: "" });
  const [applied, setApplied] = useState({ classId: "", sectionId: "" });
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState("");
  const staffMode = type === "ID_CARD" && audience === "staff";

  const classes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const cs of classSections) seen.set(cs.academicClass.id, cs.academicClass.name);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [classSections]);
  const sections = useMemo(() => {
    const seen = new Map<string, string>();
    for (const cs of classSections) {
      if (draft.classId && cs.academicClass.id !== draft.classId) continue;
      seen.set(cs.section.id, cs.section.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [classSections, draft.classId]);

  const rows: GenerateRow[] = useMemo(() => {
    if (staffMode) {
      return staff.map((item) => ({
        id: item.id,
        name: `${item.user.firstName} ${item.user.lastName}`.trim(),
        detail: "Staff",
        reference: item.employeeNumber,
        kind: "staff" as const,
      }));
    }
    return students
      .filter((student) => {
        const cs = student.enrollments?.[0]?.classSection;
        if (applied.classId && cs?.academicClass.id !== applied.classId) return false;
        if (applied.sectionId && cs?.section.id !== applied.sectionId) return false;
        return true;
      })
      .map((student) => {
        const cs = student.enrollments?.[0]?.classSection;
        return {
          id: student.id,
          name: `${student.firstName} ${student.lastName ?? ""}`.trim(),
          photoUrl: student.photoUrl,
          detail: cs ? `${cs.academicClass.name} / ${cs.section.name}` : "—",
          reference: student.admissionNumber,
          kind: "student" as const,
        };
      });
  }, [staffMode, staff, students, applied]);

  const totalPages = Math.max(1, Math.ceil(rows.length / GENERATE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * GENERATE_PAGE_SIZE, safePage * GENERATE_PAGE_SIZE);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));

  function applyFilters() {
    setApplied(draft);
    setPage(1);
    setSelected(new Set());
  }

  function toggleRow(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((previous) => {
      const next = new Set(previous);
      if (allPageSelected) for (const row of pageRows) next.delete(row.id);
      else for (const row of pageRows) next.add(row.id);
      return next;
    });
  }

  async function generateSelected() {
    if (!templateId) {
      notifyError(`Choose a ${lowerNoun} template first`);
      return;
    }
    const targets = rows.filter((row) => selected.has(row.id));
    if (!targets.length) {
      notifyError(`Select at least one ${staffMode ? "staff member" : "student"}`);
      return;
    }
    let done = 0;
    let failed = 0;
    for (const target of targets) {
      setProgress(`Generating ${done + failed + 1}/${targets.length}…`);
      try {
        await apiRequest("/documents/generated", token, {
          method: "POST",
          body: JSON.stringify({
            templateId,
            studentId: target.kind === "student" ? target.id : undefined,
            staffId: target.kind === "staff" ? target.id : undefined,
          }),
        });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setProgress("");
    setSelected(new Set());
    if (done) notifySuccess(`${done} ${lowerNoun}${done === 1 ? "" : "s"} generated — open Print History to print`);
    if (failed) notifyError(`${failed} ${lowerNoun}${failed === 1 ? "" : "s"} could not be generated`);
    await onSaved();
  }

  const rangeStart = rows.length ? (safePage - 1) * GENERATE_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * GENERATE_PAGE_SIZE, rows.length);
  const targetNoun = staffMode ? "staff members" : "students";

  return (
    <div className="space-y-4">
      <CmsSectionCard className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            {type === "ID_CARD" ? (
              <div className="w-40">
                <label className="nx-label">Issue To</label>
                <select
                  className="nx-input"
                  value={audience}
                  onChange={(event) => {
                    setAudience(event.target.value as "student" | "staff");
                    setSelected(new Set());
                    setPage(1);
                  }}
                >
                  <option value="student">Students</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
            ) : null}
            {!staffMode ? (
              <>
                <div className="w-44">
                  <label className="nx-label">Class</label>
                  <select
                    className="nx-input"
                    value={draft.classId}
                    onChange={(event) => setDraft({ classId: event.target.value, sectionId: "" })}
                  >
                    <option value="">All Classes</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="nx-label">Section</label>
                  <select
                    className="nx-input"
                    value={draft.sectionId}
                    onChange={(event) => setDraft({ ...draft, sectionId: event.target.value })}
                  >
                    <option value="">All Sections</option>
                    {sections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <div className="w-52">
              <label className="nx-label">{noun} Template</label>
              <select
                className="nx-input"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value)}
              >
                <option value="">Select template</option>
                {activeTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            {!staffMode ? (
              <button className="nx-btn-primary" type="button" onClick={applyFilters}>
                <SearchOutlined sx={{ fontSize: 16 }} />
                Search
              </button>
            ) : null}
          </div>
          <button
            className="nx-btn-primary"
            type="button"
            disabled={Boolean(progress)}
            onClick={() => void generateSelected()}
          >
            <NoteAddOutlined sx={{ fontSize: 16 }} />
            {progress || `Generate Selected${selected.size ? ` (${selected.size})` : ""}`}
          </button>
        </div>
        {!activeTemplates.length ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            No active {lowerNoun} templates. Create one in the Design {noun} tab first.
          </p>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="nx-table !min-w-[640px]">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      className="size-4 accent-indigo-600"
                      checked={allPageSelected}
                      onChange={togglePage}
                    />
                  </th>
                  <th>Photo</th>
                  <th>{staffMode ? "Staff Name" : "Student Name"}</th>
                  <th>{staffMode ? "Role" : "Class / Section"}</th>
                  <th>{staffMode ? "Employee No." : "Admission No."}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => toggleRow(row.id)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.name}`}
                        className="size-4 accent-indigo-600"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </td>
                    <td>
                      <Avatar photoUrl={row.photoUrl} name={row.name} />
                    </td>
                    <td className="font-semibold text-slate-700">{row.name}</td>
                    <td className="text-slate-500">{row.detail}</td>
                    <td className="text-slate-500">{row.reference}</td>
                  </tr>
                ))}
                {!pageRows.length ? (
                  <tr>
                    <td className="py-10 text-center text-sm text-slate-400" colSpan={5}>
                      No {targetNoun} match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-400">
              Showing {rangeStart} to {rangeEnd} of {rows.length} {targetNoun}
            </p>
            <div className="flex items-center gap-1">
              <button
                className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeftOutlined sx={{ fontSize: 17 }} />
              </button>
              {pageItems(safePage, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={`grid size-8 place-items-center rounded-md border text-xs font-semibold transition ${
                      item === safePage
                        ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRightOutlined sx={{ fontSize: 17 }} />
              </button>
            </div>
          </div>
        </div>
      </CmsSectionCard>

      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white">
          <PrintOutlined sx={{ fontSize: 17 }} />
        </span>
        <div>
          <p className="text-xs font-bold text-indigo-700">
            We recommend using your browser&apos;s Save as PDF option before printing {lowerNoun}s.
          </p>
          <p className="text-[11px] text-slate-500">
            This ensures the best layout, fonts and alignment when printing. Generated documents are
            available under Print History.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- History tab ------------------------------ */

const HISTORY_PAGE_SIZE = 8;
const PRINT_COUNTS_KEY = "nx-doc-print-counts";

const TYPE_PILL_CLASS: Record<TemplateType, string> = {
  CERTIFICATE: "bg-purple-50 text-purple-700",
  ID_CARD: "bg-sky-50 text-sky-700",
  ADMIT_CARD: "bg-slate-100 text-slate-600",
  MARKSHEET: "bg-amber-50 text-amber-700",
};

function readPrintCounts(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(PRINT_COUNTS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function formatGeneratedAt(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day}, ${time}`;
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function HistoryPanel({ documents, templates }: { documents: Generated[]; templates: Template[] }) {
  const [draft, setDraft] = useState({ docType: "", templateId: "", from: "", to: "" });
  const [applied, setApplied] = useState({ docType: "", templateId: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [printCounts, setPrintCounts] = useState<Record<string, number>>(() => readPrintCounts());
  const [menuFor, setMenuFor] = useState("");

  const rows = useMemo(() => {
    return documents.filter((item) => {
      if (applied.docType && item.template.type !== applied.docType) return false;
      if (applied.templateId && item.template.id !== applied.templateId) return false;
      const generated = new Date(item.generatedAt).getTime();
      if (applied.from && generated < new Date(`${applied.from}T00:00:00`).getTime()) return false;
      if (applied.to && generated > new Date(`${applied.to}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [documents, applied]);

  const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * HISTORY_PAGE_SIZE, safePage * HISTORY_PAGE_SIZE);
  const rangeStart = rows.length ? (safePage - 1) * HISTORY_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * HISTORY_PAGE_SIZE, rows.length);

  function markPrinted(id: string) {
    setPrintCounts((previous) => {
      const next = { ...previous, [id]: (previous[id] ?? 0) + 1 };
      try {
        localStorage.setItem(PRINT_COUNTS_KEY, JSON.stringify(next));
      } catch {
        // Best effort only — status pills fall back to "Generated".
      }
      return next;
    });
  }

  function openPrintView(id: string, autoprint: boolean) {
    markPrinted(id);
    window.location.assign(`/print/documents/${id}${autoprint ? "?autoprint=1" : ""}`);
  }

  function exportCsv() {
    downloadCsv(
      "generation-history.csv",
      ["Name", "Document Type", "Template", "Serial Number", "Barcode", "Generated Date", "Generated By", "Status"],
      rows.map((item) => [
        personName(item),
        TYPE_LABEL[item.template.type],
        item.template.name,
        item.serialNumber,
        item.barcodeValue ?? "",
        formatGeneratedAt(item.generatedAt),
        item.generatedBy ? `${item.generatedBy.firstName} ${item.generatedBy.lastName}` : "",
        (printCounts[item.id] ?? 0) >= 2 ? "Reprinted" : "Generated",
      ]),
    );
    notifySuccess(`Exported ${rows.length} record${rows.length === 1 ? "" : "s"}`);
  }

  return (
    <CmsSectionCard className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className="nx-label">Document Type</label>
            <select
              className="nx-input"
              value={draft.docType}
              onChange={(event) => setDraft({ ...draft, docType: event.target.value, templateId: "" })}
            >
              <option value="">All</option>
              <option value="CERTIFICATE">Certificate</option>
              <option value="ID_CARD">ID Card</option>
              <option value="ADMIT_CARD">Admit Card</option>
              <option value="MARKSHEET">Marksheet</option>
            </select>
          </div>
          <div className="w-48">
            <label className="nx-label">Template</label>
            <select
              className="nx-input"
              value={draft.templateId}
              onChange={(event) => setDraft({ ...draft, templateId: event.target.value })}
            >
              <option value="">All Templates</option>
              {templates
                .filter((item) => !draft.docType || item.type === draft.docType)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="nx-label">Date Range</label>
            <div className="flex items-center gap-1.5">
              <input
                className="nx-input w-36"
                type="date"
                value={draft.from}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                className="nx-input w-36"
                type="date"
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              />
            </div>
          </div>
          <button
            className="nx-btn-primary"
            type="button"
            onClick={() => {
              setApplied(draft);
              setPage(1);
            }}
          >
            <SearchOutlined sx={{ fontSize: 16 }} />
            Search
          </button>
        </div>
        <button className="nx-btn-secondary !border-indigo-200 !text-indigo-600" type="button" onClick={exportCsv}>
          <FileDownloadOutlined sx={{ fontSize: 16 }} />
          Export CSV
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="nx-table">
            <thead className="bg-slate-50/80">
              <tr>
                <th>Name</th>
                <th>Document Type</th>
                <th>Template Used</th>
                <th>Generated Date</th>
                <th>Generated By</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => {
                const reprinted = (printCounts[item.id] ?? 0) >= 2;
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="flex items-center gap-3">
                        <Avatar photoUrl={item.student?.photoUrl} name={personName(item)} />
                        <span className="font-semibold text-slate-700">{personName(item)}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`nx-pill ${TYPE_PILL_CLASS[item.template.type]}`}>
                        {TYPE_LABEL[item.template.type]}
                      </span>
                    </td>
                    <td className="text-slate-600">{item.template.name}</td>
                    <td className="text-slate-500">{formatGeneratedAt(item.generatedAt)}</td>
                    <td className="text-slate-500">
                      {item.generatedBy
                        ? `${item.generatedBy.firstName} ${item.generatedBy.lastName}`
                        : "—"}
                    </td>
                    <td>
                      <span className={`nx-pill ${reprinted ? "nx-pill-warning" : "nx-pill-success"}`}>
                        {reprinted ? "Reprinted" : "Generated"}
                      </span>
                    </td>
                    <td>
                      <span className="relative flex items-center justify-end gap-1">
                        <button
                          className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                          type="button"
                          title="Download (Save as PDF)"
                          onClick={() => openPrintView(item.id, false)}
                        >
                          <FileDownloadOutlined sx={{ fontSize: 17 }} />
                        </button>
                        <button
                          className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                          type="button"
                          title="Print"
                          onClick={() => openPrintView(item.id, true)}
                        >
                          <PrintOutlined sx={{ fontSize: 17 }} />
                        </button>
                        <button
                          className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                          type="button"
                          title="More actions"
                          onClick={() => setMenuFor(menuFor === item.id ? "" : item.id)}
                        >
                          <MoreVertOutlined sx={{ fontSize: 17 }} />
                        </button>
                        {menuFor === item.id ? (
                          <>
                            <span
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuFor("")}
                            />
                            <span className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
                              <button
                                className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                type="button"
                                onClick={() => {
                                  setMenuFor("");
                                  openPrintView(item.id, false);
                                }}
                              >
                                Open print view
                              </button>
                              <button
                                className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(item.serialNumber);
                                  setMenuFor("");
                                  notifySuccess("Serial number copied");
                                }}
                              >
                                Copy serial number
                              </button>
                              <button
                                className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50"
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(item.barcodeValue ?? item.serialNumber);
                                  setMenuFor("");
                                  notifySuccess("Barcode value copied");
                                }}
                              >
                                Copy barcode value
                              </button>
                            </span>
                          </>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr>
                  <td className="py-10 text-center text-sm text-slate-400" colSpan={7}>
                    No generated documents match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-400">
            Showing {rangeStart} to {rangeEnd} of {rows.length} records
          </p>
          <div className="flex items-center gap-1">
            <button
              className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeftOutlined sx={{ fontSize: 17 }} />
            </button>
            {pageItems(safePage, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <span key={`gap-${index}`} className="px-1 text-xs text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`grid size-8 place-items-center rounded-md border text-xs font-semibold transition ${
                    item === safePage
                      ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRightOutlined sx={{ fontSize: 17 }} />
            </button>
          </div>
        </div>
      </div>
    </CmsSectionCard>
  );
}
