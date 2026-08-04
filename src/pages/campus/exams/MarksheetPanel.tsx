import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle,
  CloudUploadOutlined,
  InfoOutlined,
  KeyboardArrowRight,
  MoreVert,
  SaveOutlined,
  AddOutlined,
} from "@mui/icons-material";
import { ListPagination } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import { openPrintDocuments } from "../../../lib/print";
import type { ExamWithGroup, Setup } from "./types";

type Mode = "design" | "print";

type MarksheetTemplate = {
  id: string;
  type: "MARKSHEET";
  name: string;
  backgroundUrl: string | null;
  width: number;
  height: number;
  config: Record<string, unknown>;
  isActive: boolean;
  updatedAt?: string;
  createdAt?: string;
  _count?: { documents: number };
};

type StudentOption = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
};

type GeneratedMarksheet = {
  id: string;
  serialNumber: string;
  barcodeValue: string | null;
  generatedAt: string;
  template: { id: string; name: string };
  student: StudentOption | null;
  exam: { id: string; name: string } | null;
};

type FormState = {
  name: string;
  pageSize: "A4" | "Letter" | "A5";
  orientation: "portrait" | "landscape";
  backgroundType: "color" | "image";
  backgroundColor: string;
  backgroundUrl: string;
  showPhoto: boolean;
  showLogo: boolean;
  showBarcode: boolean;
  showRank: boolean;
  showGrade: boolean;
  footerNote: string;
  title: string;
  marksTablePlaceholder: "[table]" | "[table1]";
};

const PAGE_SIZES: Record<
  FormState["pageSize"],
  { label: string; portrait: [number, number]; landscape: [number, number] }
> = {
  A4: { label: "A4 (210 × 297 mm)", portrait: [794, 1123], landscape: [1123, 794] },
  Letter: { label: "Letter (8.5 × 11 in)", portrait: [816, 1056], landscape: [1056, 816] },
  A5: { label: "A5 (148 × 210 mm)", portrait: [559, 794], landscape: [794, 559] },
};

const BULK_PRINT_CAP = 150;

const DEFAULT_FOOTER =
  "This is a system generated marksheet and does not require signature.";

const emptyForm = (): FormState => ({
  name: "",
  pageSize: "A4",
  orientation: "portrait",
  backgroundType: "color",
  backgroundColor: "#ffffff",
  backgroundUrl: "",
  showPhoto: true,
  showLogo: true,
  showBarcode: true,
  showRank: true,
  showGrade: true,
  footerNote: DEFAULT_FOOTER,
  title: "Marksheet",
  marksTablePlaceholder: "[table]",
});

function dimensionsFor(form: FormState): { width: number; height: number } {
  const size = PAGE_SIZES[form.pageSize];
  const [width, height] = form.orientation === "portrait" ? size.portrait : size.landscape;
  return { width, height };
}

function pageSizeFromDims(width: number, height: number): {
  pageSize: FormState["pageSize"];
  orientation: FormState["orientation"];
} {
  for (const [key, value] of Object.entries(PAGE_SIZES) as Array<
    [FormState["pageSize"], (typeof PAGE_SIZES)[FormState["pageSize"]]]
  >) {
    if (width === value.portrait[0] && height === value.portrait[1]) {
      return { pageSize: key, orientation: "portrait" };
    }
    if (width === value.landscape[0] && height === value.landscape[1]) {
      return { pageSize: key, orientation: "landscape" };
    }
  }
  return {
    pageSize: "A4",
    orientation: width <= height ? "portrait" : "landscape",
  };
}

function formFromTemplate(template: MarksheetTemplate): FormState {
  const config = template.config ?? {};
  const dims = pageSizeFromDims(template.width, template.height);
  const backgroundType =
    (config.backgroundType as FormState["backgroundType"] | undefined) ??
    (template.backgroundUrl ? "image" : "color");
  return {
    name: template.name,
    pageSize: (config.pageSize as FormState["pageSize"] | undefined) ?? dims.pageSize,
    orientation:
      (config.orientation as FormState["orientation"] | undefined) ?? dims.orientation,
    backgroundType,
    backgroundColor: String(config.backgroundColor ?? "#ffffff"),
    backgroundUrl: template.backgroundUrl ?? "",
    showPhoto: Boolean(config.showPhoto ?? true),
    showLogo: Boolean(config.showLogo ?? true),
    showBarcode: Boolean(config.showBarcode ?? true),
    showRank: Boolean(config.showRank ?? true),
    showGrade: Boolean(config.showGrade ?? true),
    footerNote: String(config.footerNote ?? DEFAULT_FOOTER),
    title: String(config.title ?? template.name),
    marksTablePlaceholder:
      config.marksTablePlaceholder === "[table1]" ? "[table1]" : "[table]",
  };
}

function buildConfig(form: FormState): Record<string, unknown> {
  return {
    title: form.title.trim() || form.name.trim() || "Marksheet",
    showPhoto: form.showPhoto,
    showLogo: form.showLogo,
    showBarcode: form.showBarcode,
    showRank: form.showRank,
    showGrade: form.showGrade,
    footerNote: form.footerNote.trim(),
    pageSize: form.pageSize,
    orientation: form.orientation,
    backgroundType: form.backgroundType,
    backgroundColor: form.backgroundColor,
    marksTablePlaceholder: form.marksTablePlaceholder,
  };
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-[var(--nx-primary,#6366f1)]" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function TemplatePreview({
  form,
  compact = false,
}: {
  form: Pick<
    FormState,
    | "name"
    | "title"
    | "backgroundType"
    | "backgroundColor"
    | "backgroundUrl"
    | "showPhoto"
    | "showLogo"
    | "showBarcode"
    | "showRank"
    | "showGrade"
    | "orientation"
    | "footerNote"
    | "marksTablePlaceholder"
  >;
  compact?: boolean;
}) {
  const bg =
    form.backgroundType === "image" && form.backgroundUrl
      ? {
          backgroundImage: `url(${form.backgroundUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { backgroundColor: form.backgroundColor || "#fff" };

  return (
    <div
      className={`relative overflow-hidden rounded-md border border-slate-200 ${
        compact ? "aspect-[3/4]" : "min-h-[220px]"
      } ${form.orientation === "landscape" && !compact ? "aspect-[4/3]" : ""}`}
      style={bg}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/45 to-white/85" />
      <div className={`relative z-10 flex h-full flex-col ${compact ? "p-2" : "p-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`font-bold text-slate-800 ${compact ? "text-[10px]" : "text-sm"}`}>
              {form.title || form.name || "Marksheet"}
            </p>
            <p className={`text-slate-500 ${compact ? "text-[8px]" : "text-[11px]"}`}>
              Academic Result Sheet
            </p>
          </div>
          {form.showLogo ? (
            <div
              className={`grid place-items-center rounded-full border border-indigo-200 bg-indigo-50 font-bold text-indigo-600 ${
                compact ? "size-6 text-[7px]" : "size-10 text-[10px]"
              }`}
            >
              Logo
            </div>
          ) : null}
        </div>
        <div className={`mt-2 flex items-start gap-2 ${compact ? "" : "mt-3"}`}>
          {form.showPhoto ? (
            <div
              className={`grid place-items-center rounded border border-slate-300 bg-slate-100 text-slate-400 ${
                compact ? "size-8 text-[7px]" : "size-12 text-[10px]"
              }`}
            >
              Photo
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <div className={`rounded bg-white/80 ${compact ? "h-1.5 w-3/4" : "h-2 w-2/3"}`} />
            <div className={`rounded bg-white/70 ${compact ? "h-1.5 w-1/2" : "h-2 w-1/2"}`} />
          </div>
        </div>
        <div
          className={`mt-2 flex-1 rounded border border-dashed border-slate-300 bg-white/70 ${
            compact ? "min-h-[36px]" : "min-h-[72px] p-2"
          }`}
        >
          {!compact ? (
            <p className="text-[10px] font-medium text-slate-400">
              {form.marksTablePlaceholder} marks layout
            </p>
          ) : null}
          {(form.showRank || form.showGrade) && !compact ? (
            <div className="mt-2 flex gap-2">
              {form.showRank ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">Rank</span>
              ) : null}
              {form.showGrade ? (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700">Grade</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {form.showBarcode ? (
          <div
            className={`mt-2 bg-[repeating-linear-gradient(90deg,#0f172a_0_1px,transparent_1px_3px)] ${
              compact ? "h-3 w-full" : "h-5 w-40"
            }`}
          />
        ) : null}
        {!compact && form.footerNote ? (
          <p className="mt-2 line-clamp-2 text-[10px] text-slate-500">{form.footerNote}</p>
        ) : null}
      </div>
    </div>
  );
}

export function MarksheetPanel({
  setup,
  exams,
  token,
  onSaved,
  onError,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("design");
  const [templates, setTemplates] = useState<MarksheetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const [generatedPage, setGeneratedPage] = useState(1);
  const generatedPageSize = 10;
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [generated, setGenerated] = useState<GeneratedMarksheet[]>([]);
  const [printForm, setPrintForm] = useState({
    templateId: "",
    examId: "",
    classId: "",
    classSectionId: "",
  });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await apiRequest<MarksheetTemplate[]>(
        "/documents/templates?type=MARKSHEET",
        token,
      );
      setTemplates(data);
      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
        setEditingId(data[0].id);
        setForm(formFromTemplate(data[0]));
      } else if (selectedId) {
        const current = data.find((item) => item.id === selectedId);
        if (current) {
          setForm(formFromTemplate(current));
          setEditingId(current.id);
        }
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load marksheet templates");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrintData() {
    try {
      const docsPromise = apiRequest<GeneratedMarksheet[]>(
        "/documents/generated?type=MARKSHEET",
        token,
      );
      if (!printForm.examId) {
        setStudents([]);
        setSelectedStudentIds([]);
        setGenerated(await docsPromise);
        return;
      }
      const query = printForm.classSectionId
        ? `?classSectionId=${encodeURIComponent(printForm.classSectionId)}`
        : "";
      const [roster, docs] = await Promise.all([
        apiRequest<
          Array<{
            studentEnrollment: {
              student: {
                id: string;
                firstName: string;
                lastName: string | null;
                admissionNumber: string;
              };
              classSection: {
                id: string;
                academicClass: { id: string; name: string };
              };
            };
          }>
        >(`/exams/${printForm.examId}/students${query}`, token),
        docsPromise,
      ]);
      let options: StudentOption[] = roster.map((row) => ({
        id: row.studentEnrollment.student.id,
        firstName: row.studentEnrollment.student.firstName,
        lastName: row.studentEnrollment.student.lastName,
        admissionNumber: row.studentEnrollment.student.admissionNumber,
      }));
      if (printForm.classId && !printForm.classSectionId) {
        const sectionIds = new Set(
          setup.classSections
            .filter((item) => item.academicClass.id === printForm.classId)
            .map((item) => item.id),
        );
        options = roster
          .filter((row) => sectionIds.has(row.studentEnrollment.classSection.id))
          .map((row) => ({
            id: row.studentEnrollment.student.id,
            firstName: row.studentEnrollment.student.firstName,
            lastName: row.studentEnrollment.student.lastName,
            admissionNumber: row.studentEnrollment.student.admissionNumber,
          }));
      }
      setStudents(options);
      setSelectedStudentIds((prev) => {
        const allowed = new Set(options.map((item) => item.id));
        return prev.filter((id) => allowed.has(id));
      });
      setGenerated(docs);
      setGeneratedPage(1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load print data");
    }
  }

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (mode === "print") void loadPrintData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, printForm.examId, printForm.classId, printForm.classSectionId]);

  useEffect(() => {
    function onDocClick() {
      setMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const pageCount = Math.max(1, Math.ceil(templates.length / pageSize));
  const pageTemplates = templates.slice((page - 1) * pageSize, page * pageSize);

  const classOptions = useMemo(() => {
    const map = new Map(setup.classSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () =>
      setup.classSections.filter(
        (item) => !printForm.classId || item.academicClass.id === printForm.classId,
      ),
    [setup.classSections, printForm.classId],
  );

  function startCreate() {
    setSelectedId(null);
    setEditingId(null);
    setForm(emptyForm());
    setAdvancedOpen(false);
    setMode("design");
  }

  function selectTemplate(template: MarksheetTemplate) {
    setSelectedId(template.id);
    setEditingId(template.id);
    setForm(formFromTemplate(template));
    setAdvancedOpen(false);
    setMenuId(null);
  }

  async function onUploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      onError("Please choose a PNG or JPG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onError("Image must be 2MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setForm((prev) => ({
        ...prev,
        backgroundType: "image",
        backgroundUrl: result,
      }));
      notifySuccess("Background image ready");
    };
    reader.onerror = () => onError("Unable to read image file");
    reader.readAsDataURL(file);
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      onError("Template name is required");
      return;
    }
    const { width, height } = dimensionsFor(form);
    const backgroundUrl =
      form.backgroundType === "image" && form.backgroundUrl.trim()
        ? form.backgroundUrl.trim()
        : null;
    const payload = {
      name: form.name.trim(),
      backgroundUrl,
      width,
      height,
      config: buildConfig(form),
    };
    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(`/documents/templates/${editingId}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Template saved");
      } else {
        const created = await apiRequest<MarksheetTemplate>("/documents/templates", token, {
          method: "POST",
          body: JSON.stringify({ ...payload, type: "MARKSHEET" }),
        });
        setSelectedId(created.id);
        setEditingId(created.id);
        notifySuccess("Template created");
      }
      await Promise.all([loadTemplates(), onSaved()]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateTemplate(template: MarksheetTemplate) {
    const ok = await confirmDelete({
      text: `Deactivate “${template.name}”? It can be re-activated later.`,
      confirmText: "Yes, deactivate",
    });
    if (!ok) return;
    try {
      await apiRequest(`/documents/templates/${template.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      });
      notifySuccess("Template deactivated");
      if (selectedId === template.id) startCreate();
      await Promise.all([loadTemplates(), onSaved()]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to deactivate template");
    }
  }

  async function duplicateTemplate(template: MarksheetTemplate) {
    try {
      const created = await apiRequest<MarksheetTemplate>("/documents/templates", token, {
        method: "POST",
        body: JSON.stringify({
          type: "MARKSHEET",
          name: `${template.name} Copy`,
          backgroundUrl: template.backgroundUrl,
          width: template.width,
          height: template.height,
          config: template.config,
        }),
      });
      notifySuccess("Template duplicated");
      await Promise.all([loadTemplates(), onSaved()]);
      selectTemplate(created);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to duplicate template");
    }
  }

  async function generateBulk(studentIds: string[]) {
    if (!printForm.templateId || !printForm.examId) {
      onError("Template and exam are required");
      return;
    }
    if (studentIds.length === 0) {
      onError("Select at least one student");
      return;
    }
    setGenerating(true);
    try {
      const result = await apiRequest<{
        documents: Array<{ id: string; studentId: string; serialNumber: string }>;
      }>("/documents/generated/bulk", token, {
        method: "POST",
        body: JSON.stringify({
          templateId: printForm.templateId,
          examId: printForm.examId,
          studentIds,
        }),
      });
      const ids = result.documents.map((doc) => doc.id);
      notifySuccess(
        ids.length === 1
          ? "Marksheet generated"
          : `${ids.length} marksheets generated`,
      );
      await loadPrintData();
      if (ids.length > 0) {
        openPrintDocuments(ids);
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate marksheets");
    } finally {
      setGenerating(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  }

  const activeTemplates = templates.filter((item) => item.isActive);
  const filteredStudentIds = students.map((item) => item.id);
  const allFilteredSelected =
    filteredStudentIds.length > 0 &&
    filteredStudentIds.every((id) => selectedStudentIds.includes(id));
  const selectionOverCap = selectedStudentIds.length > BULK_PRINT_CAP;
  const filteredOverCap = filteredStudentIds.length > BULK_PRINT_CAP;
  const generatedPageCount = Math.max(1, Math.ceil(generated.length / generatedPageSize));
  const pagedGenerated = generated.slice(
    (generatedPage - 1) * generatedPageSize,
    generatedPage * generatedPageSize,
  );

  useEffect(() => {
    if (generatedPage > generatedPageCount) setGeneratedPage(generatedPageCount);
  }, [generatedPage, generatedPageCount]);

  return (
    <section className="mt-5 space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(["design", "print"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-md px-4 py-1.5 text-[13px] font-semibold capitalize transition ${
              mode === item
                ? "bg-[var(--nx-primary,#6366f1)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {mode === "design" ? (
        <div className="nx-card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="border-b border-slate-100 p-5 lg:border-r lg:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-900">Marksheet Templates</h2>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    Create and customize templates for marksheets.
                  </p>
                </div>
                <button type="button" className="nx-btn-secondary" onClick={startCreate}>
                  <AddOutlined sx={{ fontSize: 16 }} /> New Template
                </button>
              </div>

              {loading ? (
                <p className="mt-10 text-center text-sm text-slate-500">Loading templates…</p>
              ) : templates.length === 0 ? (
                <p className="mt-10 text-center text-sm text-slate-500">
                  No marksheet templates yet. Create one to get started.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {pageTemplates.map((template) => {
                      const previewForm = formFromTemplate(template);
                      const selected = selectedId === template.id;
                      const updated = template.updatedAt
                        ? new Date(template.updatedAt).toLocaleDateString()
                        : "—";
                      return (
                        <button
                          key={template.id}
                          type="button"
                          className={`relative overflow-hidden rounded-xl border bg-white text-left transition ${
                            selected
                              ? "border-[var(--nx-primary,#6366f1)] ring-1 ring-[var(--nx-primary,#6366f1)]"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          onClick={() => selectTemplate(template)}
                        >
                          {selected ? (
                            <span className="absolute top-2 right-2 z-10 grid size-5 place-items-center rounded-full bg-[var(--nx-primary,#6366f1)] text-white">
                              <CheckCircle sx={{ fontSize: 14 }} />
                            </span>
                          ) : null}
                          <div className="p-2 pb-0">
                            <TemplatePreview form={previewForm} compact />
                          </div>
                          <div className="flex items-start justify-between gap-2 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-slate-900">
                                {template.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">Updated on {updated}</p>
                              {!template.isActive ? (
                                <p className="mt-0.5 text-[10px] font-semibold text-amber-600">Inactive</p>
                              ) : null}
                            </div>
                            <div className="relative shrink-0">
                              <span
                                role="button"
                                tabIndex={0}
                                className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMenuId((id) => (id === template.id ? null : template.id));
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setMenuId((id) => (id === template.id ? null : template.id));
                                  }
                                }}
                              >
                                <MoreVert sx={{ fontSize: 16 }} />
                              </span>
                              {menuId === template.id ? (
                                <div className="absolute top-8 right-0 z-20 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      selectTemplate(template);
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void duplicateTemplate(template);
                                    }}
                                  >
                                    Duplicate
                                  </button>
                                  {template.isActive ? (
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-50"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void deactivateTemplate(template);
                                      }}
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        try {
                                          await apiRequest(`/documents/templates/${template.id}`, token, {
                                            method: "PUT",
                                            body: JSON.stringify({ isActive: true }),
                                          });
                                          notifySuccess("Template activated");
                                          await Promise.all([loadTemplates(), onSaved()]);
                                        } catch (cause) {
                                          onError(
                                            cause instanceof Error
                                              ? cause.message
                                              : "Unable to activate template",
                                          );
                                        }
                                      }}
                                    >
                                      Activate
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <ListPagination
                    page={Math.min(page, pageCount)}
                    pageSize={pageSize}
                    total={templates.length}
                    onPageChange={setPage}
                    label="templates"
                  />
                </>
              )}
            </div>

            <form className="flex flex-col p-5" onSubmit={(event) => void saveTemplate(event)}>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">Create / Edit Template</h2>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Configure your marksheet layout and visibility options.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="nx-label !normal-case !tracking-normal">
                    Template Name <span className="text-rose-500">*</span>
                  </span>
                  <input
                    className="nx-input bg-white"
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Default Template"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="nx-label !normal-case !tracking-normal">
                      Page Size <span className="text-rose-500">*</span>
                    </span>
                    <select
                      className="nx-input bg-white"
                      value={form.pageSize}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          pageSize: event.target.value as FormState["pageSize"],
                        })
                      }
                    >
                      {Object.entries(PAGE_SIZES).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="nx-label !normal-case !tracking-normal">Orientation</span>
                    <div className="mt-1 inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
                      {(["portrait", "landscape"] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-semibold capitalize ${
                            form.orientation === item
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500"
                          }`}
                          onClick={() => setForm({ ...form, orientation: item })}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="nx-label !normal-case !tracking-normal">Background</span>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                      <input
                        type="radio"
                        name="ms-bg-type"
                        checked={form.backgroundType === "color"}
                        onChange={() => setForm({ ...form, backgroundType: "color" })}
                      />
                      Color
                      <input
                        type="color"
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        value={form.backgroundColor}
                        disabled={form.backgroundType !== "color"}
                        onChange={(event) =>
                          setForm({ ...form, backgroundColor: event.target.value })
                        }
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-[13px] text-slate-700">
                      <input
                        type="radio"
                        name="ms-bg-type"
                        checked={form.backgroundType === "image"}
                        onChange={() => setForm({ ...form, backgroundType: "image" })}
                      />
                      Image
                    </label>
                    <button
                      type="button"
                      className="nx-btn-secondary"
                      disabled={form.backgroundType !== "image"}
                      onClick={() => fileRef.current?.click()}
                    >
                      <CloudUploadOutlined sx={{ fontSize: 16 }} /> Upload Image
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void onUploadImage(file);
                        event.target.value = "";
                      }}
                    />
                    <span className="text-[11px] text-slate-400">PNG, JPG up to 2MB</span>
                  </div>
                  {form.backgroundType === "image" ? (
                    <input
                      className="nx-input mt-2 bg-white"
                      placeholder="Or paste an image URL"
                      value={
                        form.backgroundUrl.startsWith("data:")
                          ? "(uploaded image)"
                          : form.backgroundUrl
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          backgroundUrl: event.target.value.startsWith("(")
                            ? form.backgroundUrl
                            : event.target.value,
                        })
                      }
                      disabled={form.backgroundUrl.startsWith("data:")}
                    />
                  ) : null}
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-[12.5px] text-sky-800">
                  <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p>
                      Use <code className="rounded bg-sky-100 px-1">[table]</code> for standard
                      subject rows or <code className="rounded bg-sky-100 px-1">[table1]</code> for
                      linked/bifurcated subjects.
                    </p>
                    <p>
                      Optional tokens in title/footer:{" "}
                      <code className="rounded bg-sky-100 px-1">[top_10_students]</code>,{" "}
                      <code className="rounded bg-sky-100 px-1">[comparative_analysis]</code>.
                    </p>
                  </div>
                </div>

                <label>
                  <span className="nx-label">Marks table placeholder</span>
                  <select
                    className="nx-input"
                    value={form.marksTablePlaceholder}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        marksTablePlaceholder: event.target.value as FormState["marksTablePlaceholder"],
                      })
                    }
                  >
                    <option value="[table]">[table] — standard subject marks</option>
                    <option value="[table1]">[table1] — linked / bifurcated layout</option>
                  </select>
                </label>

                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                      Show Student Image
                      <InfoOutlined
                        sx={{ fontSize: 14 }}
                        className="text-slate-400"
                        titleAccess="Include student photo on the marksheet"
                      />
                    </span>
                    <Toggle
                      checked={form.showPhoto}
                      onChange={(next) => setForm({ ...form, showPhoto: next })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                      Show School Logo
                      <InfoOutlined
                        sx={{ fontSize: 14 }}
                        className="text-slate-400"
                        titleAccess="Display school logo from tenant branding"
                      />
                    </span>
                    <Toggle
                      checked={form.showLogo}
                      onChange={(next) => setForm({ ...form, showLogo: next })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                      Show Barcode / QR
                      <InfoOutlined
                        sx={{ fontSize: 14 }}
                        className="text-slate-400"
                        titleAccess="Print a barcode for verification"
                      />
                    </span>
                    <Toggle
                      checked={form.showBarcode}
                      onChange={(next) => setForm({ ...form, showBarcode: next })}
                    />
                  </div>
                </div>

                <label className="block">
                  <span className="nx-label !normal-case !tracking-normal">Footer Note</span>
                  <textarea
                    className="nx-input min-h-[72px] bg-white"
                    value={form.footerNote}
                    onChange={(event) => setForm({ ...form, footerNote: event.target.value })}
                    placeholder={DEFAULT_FOOTER}
                  />
                </label>

                <div className="rounded-xl border border-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-semibold text-slate-800"
                    onClick={() => setAdvancedOpen((open) => !open)}
                  >
                    Advanced Options
                    <KeyboardArrowRight
                      sx={{ fontSize: 18 }}
                      className={`text-slate-400 transition ${advancedOpen ? "rotate-90" : ""}`}
                    />
                  </button>
                  {advancedOpen ? (
                    <div className="space-y-3 border-t border-slate-100 px-3 py-3">
                      <label className="block">
                        <span className="nx-label !normal-case !tracking-normal">Title text</span>
                        <input
                          className="nx-input bg-white"
                          value={form.title}
                          onChange={(event) => setForm({ ...form, title: event.target.value })}
                        />
                      </label>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-medium text-slate-700">Show rank</span>
                        <Toggle
                          checked={form.showRank}
                          onChange={(next) => setForm({ ...form, showRank: next })}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-medium text-slate-700">Show grade</span>
                        <Toggle
                          checked={form.showGrade}
                          onChange={(next) => setForm({ ...form, showGrade: next })}
                        />
                      </div>
                      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-2">
                        <p className="mb-2 text-[11px] font-medium text-slate-500">Live preview</p>
                        <TemplatePreview form={form} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button type="submit" className="nx-btn-primary" disabled={saving}>
                  <SaveOutlined sx={{ fontSize: 16 }} />
                  {saving ? "Saving…" : "Save & Design"}
                </button>
              </div>
            </form>
          </div>

          <div className="flex items-start gap-2 border-t border-sky-100 bg-sky-50 px-5 py-3 text-[12.5px] text-sky-800">
            <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
            <p>
              Switch to the &apos;Print&apos; tab to select students and generate marksheets using this
              template.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="nx-card p-5">
            <h2 className="text-[15px] font-bold text-slate-900">Print Marksheets</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Choose a template and exam, then select students to generate printable marksheets.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="nx-label !normal-case !tracking-normal">Template</span>
                <select
                  className="nx-input bg-white"
                  required
                  value={printForm.templateId}
                  onChange={(event) => setPrintForm({ ...printForm, templateId: event.target.value })}
                >
                  <option value="">Select template</option>
                  {activeTemplates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="nx-label !normal-case !tracking-normal">Exam</span>
                <select
                  className="nx-input bg-white"
                  required
                  value={printForm.examId}
                  onChange={(event) => setPrintForm({ ...printForm, examId: event.target.value })}
                >
                  <option value="">Select exam</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.group.name} · {exam.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="nx-label !normal-case !tracking-normal">Class (optional filter)</span>
                <select
                  className="nx-input bg-white"
                  value={printForm.classId}
                  onChange={(event) =>
                    setPrintForm({ ...printForm, classId: event.target.value, classSectionId: "" })
                  }
                >
                  <option value="">All classes</option>
                  {classOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="nx-label !normal-case !tracking-normal">Section (optional)</span>
                <select
                  className="nx-input bg-white"
                  value={printForm.classSectionId}
                  onChange={(event) =>
                    setPrintForm({ ...printForm, classSectionId: event.target.value })
                  }
                >
                  <option value="">All sections</option>
                  {sectionOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.section.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="nx-label !normal-case !tracking-normal">
                    Students ({selectedStudentIds.length} selected
                    {students.length ? ` of ${students.length}` : ""})
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="nx-btn-secondary !px-2.5 !py-1 text-[12px]"
                      disabled={students.length === 0 || allFilteredSelected}
                      onClick={() => setSelectedStudentIds(filteredStudentIds)}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="nx-btn-secondary !px-2.5 !py-1 text-[12px]"
                      disabled={selectedStudentIds.length === 0}
                      onClick={() => setSelectedStudentIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  {students.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">
                      {printForm.examId
                        ? "No students assigned to this exam yet. Go to Exam Groups → Assign Students, then return here."
                        : "Select an exam to load assigned students."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {students.map((student) => {
                        const checked = selectedStudentIds.includes(student.id);
                        return (
                          <li key={student.id}>
                            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-slate-300"
                                checked={checked}
                                onChange={() => toggleStudent(student.id)}
                              />
                              <span className="min-w-0 truncate">
                                {student.firstName} {student.lastName ?? ""} ·{" "}
                                {student.admissionNumber}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {selectionOverCap || filteredOverCap ? (
                  <p className="mt-2 text-[12px] text-amber-700">
                    Large batches (over {BULK_PRINT_CAP}) may be slow to generate and print. Prefer
                    smaller groups when possible.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  className="nx-btn-secondary"
                  disabled={generating || selectedStudentIds.length === 0}
                  onClick={() => void generateBulk(selectedStudentIds)}
                >
                  {generating ? "Generating…" : "Generate selected"}
                </button>
                <button
                  type="button"
                  className="nx-btn-primary"
                  disabled={generating || students.length === 0}
                  onClick={() => void generateBulk(filteredStudentIds)}
                >
                  {generating ? "Generating…" : "Generate all filtered"}
                </button>
              </div>
            </div>
            {!activeTemplates.length ? (
              <p className="mt-3 text-[12px] text-amber-700">
                No active templates. Switch to Design to create one.
                <button
                  type="button"
                  className="ml-2 font-semibold text-indigo-600 underline"
                  onClick={() => {
                    setMode("design");
                    notifyInfo("Create a template, then return to Print.");
                  }}
                >
                  Open Design
                </button>
              </p>
            ) : null}
          </div>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-[14px] font-bold text-slate-900">Generated marksheets</h3>
            </div>
            {generated.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                Generated marksheets will appear here for reprinting.
              </p>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {pagedGenerated.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-slate-900">
                          {doc.student
                            ? `${doc.student.firstName} ${doc.student.lastName ?? ""}`
                            : "Student"}{" "}
                          · {doc.template.name}
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {doc.exam?.name ?? "Exam"} · {doc.serialNumber} ·{" "}
                          {new Date(doc.generatedAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="nx-btn-secondary"
                        onClick={() => openPrintDocuments(doc.id)}
                      >
                        Open & print
                      </button>
                    </div>
                  ))}
                </div>
                <ListPagination
                  page={generatedPage}
                  pageSize={generatedPageSize}
                  total={generated.length}
                  onPageChange={setGeneratedPage}
                  label="marksheets"
                />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
