import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddOutlined,
  CalendarMonthOutlined,
  CropLandscapeOutlined,
  CropPortraitOutlined,
  DrawOutlined,
  FitScreenOutlined,
  ImageOutlined,
  InfoOutlined,
  LineWeightOutlined,
  PreviewOutlined,
  QrCode2Outlined,
  RedoOutlined,
  RestartAltOutlined,
  SaveOutlined,
  ShapeLineOutlined,
  TableChartOutlined,
  TextFieldsOutlined,
  UndoOutlined,
  UploadOutlined,
  VerifiedOutlined,
  ViewWeekOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CommentOutlined,
  MenuBookOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Template = {
  id: string;
  name: string;
  type: "MARKSHEET";
  width: number;
  height: number;
  backgroundUrl: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
};

type FieldKey =
  | "studentName"
  | "admissionNo"
  | "rollNumber"
  | "className"
  | "section"
  | "session"
  | "photo"
  | "subjectName"
  | "marksObtained"
  | "maxMarks"
  | "grade"
  | "gradePoint"
  | "percentage"
  | "rank"
  | "attendance"
  | "remarks"
  | "date"
  | "signature"
  | "subjectsTable"
  | "coScholastic"
  | "gradingScale";

type DesignerState = {
  name: string;
  sizeKey: "a4-portrait" | "a4-landscape";
  orientation: "PORTRAIT" | "LANDSCAPE";
  themeColor: string;
  headerBackground: string;
  fontFamily: string;
  fontSize: number;
  borderStyle: "solid" | "dashed" | "none";
  borderWidth: number;
  cellPadding: number;
  zoom: number;
  enabledFields: FieldKey[];
  showPhoto: boolean;
  showBarcode: boolean;
  showLogo: boolean;
  showRank: boolean;
  showGrade: boolean;
  footerNote: string;
  backgroundUrl: string | null;
};

const SIZE_PRESETS = {
  "a4-portrait": { label: "A4 Portrait", width: 1131, height: 1600, orientation: "PORTRAIT" as const },
  "a4-landscape": { label: "A4 Landscape", width: 1600, height: 1131, orientation: "LANDSCAPE" as const },
};

const THEME_PRESETS = [
  { key: "blue", name: "Blue Classic", themeColor: "#1D4ED8", headerBackground: "#1E40AF" },
  { key: "green", name: "Green Modern", themeColor: "#059669", headerBackground: "#047857" },
  { key: "purple", name: "Purple Elegant", themeColor: "#7C3AED", headerBackground: "#6D28D9" },
  { key: "maroon", name: "Maroon Professional", themeColor: "#B91C1C", headerBackground: "#991B1B" },
  { key: "teal", name: "Teal Clean", themeColor: "#0F766E", headerBackground: "#0D9488" },
];

const STUDENT_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "studentName", label: "Student Name" },
  { key: "admissionNo", label: "Admission No." },
  { key: "rollNumber", label: "Roll Number" },
  { key: "className", label: "Class" },
  { key: "section", label: "Section" },
  { key: "session", label: "Academic Session" },
  { key: "photo", label: "Student Photo" },
];

const ACADEMIC_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "subjectName", label: "Subject Name" },
  { key: "marksObtained", label: "Marks Obtained" },
  { key: "maxMarks", label: "Max Marks" },
  { key: "grade", label: "Grade" },
  { key: "gradePoint", label: "Grade Point" },
  { key: "percentage", label: "Percentage" },
  { key: "rank", label: "Rank" },
  { key: "subjectsTable", label: "Subjects Table" },
];

const OTHER_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "attendance", label: "Attendance" },
  { key: "remarks", label: "Remarks" },
  { key: "date", label: "Date" },
  { key: "signature", label: "Signature" },
  { key: "coScholastic", label: "Co-Scholastic Area" },
  { key: "gradingScale", label: "Grading Scale" },
];

const DEFAULT_FIELDS: FieldKey[] = [
  "studentName",
  "admissionNo",
  "rollNumber",
  "className",
  "section",
  "session",
  "photo",
  "subjectsTable",
  "grade",
  "percentage",
  "rank",
  "attendance",
  "remarks",
  "date",
  "signature",
  "coScholastic",
  "gradingScale",
];

const SAMPLE_SUBJECTS = [
  { name: "English", max: 100, pa: [18, 17, 19, 18], annual: 72, grade: "A" },
  { name: "Hindi", max: 100, pa: [16, 15, 17, 16], annual: 68, grade: "B+" },
  { name: "Mathematics", max: 100, pa: [19, 18, 20, 19], annual: 84, grade: "A+" },
  { name: "Science", max: 100, pa: [17, 18, 16, 17], annual: 75, grade: "A" },
  { name: "Social Science", max: 100, pa: [15, 16, 15, 16], annual: 70, grade: "B+" },
];

function defaultState(theme = THEME_PRESETS[0]): DesignerState {
  return {
    name: theme.name,
    sizeKey: "a4-portrait",
    orientation: "PORTRAIT",
    themeColor: theme.themeColor,
    headerBackground: theme.headerBackground,
    fontFamily: "Poppins",
    fontSize: 12,
    borderStyle: "solid",
    borderWidth: 1,
    cellPadding: 8,
    zoom: 100,
    enabledFields: [...DEFAULT_FIELDS],
    showPhoto: true,
    showBarcode: false,
    showLogo: true,
    showRank: true,
    showGrade: true,
    footerNote: "Class Teacher's Remarks",
    backgroundUrl: null,
  };
}

function hasField(fields: FieldKey[], key: FieldKey) {
  return fields.includes(key);
}

function Card({
  title,
  actions,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-[#F3F4F6] px-3 py-2.5">
          {title ? <h3 className="text-sm font-bold text-[#1A1A1A]">{title}</h3> : <span />}
          {actions}
        </div>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

function ReportCardPreview({
  state,
  schoolName,
  compact = false,
}: {
  state: DesignerState;
  schoolName: string;
  compact?: boolean;
}) {
  const size = SIZE_PRESETS[state.sizeKey];
  const scale = compact ? 0.16 : Math.min(1, state.zoom / 100) * 0.48;
  const width = size.width * scale;
  const height = size.height * scale;
  const fields = state.enabledFields;
  const pad = Math.max(2, state.cellPadding * scale * 0.4);
  const font = Math.max(6, state.fontSize * scale * 0.7);

  return (
    <div
      className="overflow-hidden bg-white shadow-lg"
      style={{
        width,
        height,
        fontFamily: `"${state.fontFamily}", Inter, sans-serif`,
        fontSize: font,
        border:
          state.borderStyle === "none"
            ? "1px solid #E5E7EB"
            : `${state.borderWidth}px ${state.borderStyle} ${state.themeColor}`,
      }}
    >
      <div
        className="flex items-center gap-2 text-white"
        style={{ background: state.headerBackground, padding: pad * 1.5 }}
      >
        {state.showLogo ? (
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/95 text-[7px] font-bold text-slate-500">
            LOGO
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-bold uppercase tracking-wide" style={{ fontSize: font * 1.3 }}>
            {schoolName}
          </p>
          <p className="truncate opacity-90" style={{ fontSize: font * 0.85 }}>
            Excellence in Education · School Address · Phone
          </p>
          <p className="font-semibold" style={{ fontSize: font * 0.95 }}>
            STUDENT REPORT CARD
          </p>
        </div>
      </div>

      <div style={{ padding: pad * 1.2 }}>
        <div className="mb-2 flex gap-2">
          {state.showPhoto && hasField(fields, "photo") ? (
            <div
              className="grid shrink-0 place-items-center border bg-slate-100 text-[7px] text-slate-400"
              style={{ width: 42 * (compact ? 0.7 : 1), height: 52 * (compact ? 0.7 : 1), borderColor: state.themeColor }}
            >
              PHOTO
            </div>
          ) : null}
          <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-2 gap-y-0.5" style={{ fontSize: font * 0.9 }}>
            {hasField(fields, "studentName") ? (
              <p>
                <span className="text-slate-500">Name:</span>{" "}
                <strong>Aarav Sharma</strong>
              </p>
            ) : null}
            {hasField(fields, "rollNumber") ? (
              <p>
                <span className="text-slate-500">Roll No:</span> 12
              </p>
            ) : null}
            {hasField(fields, "admissionNo") ? (
              <p>
                <span className="text-slate-500">Adm No:</span> ADM/2025/0088
              </p>
            ) : null}
            {hasField(fields, "className") || hasField(fields, "section") ? (
              <p>
                <span className="text-slate-500">Class:</span> Grade 8 - A
              </p>
            ) : null}
            {hasField(fields, "session") ? (
              <p>
                <span className="text-slate-500">Session:</span> 2025-26
              </p>
            ) : null}
            <p>
              <span className="text-slate-500">DOB:</span> 14 Jan 2013
            </p>
            <p className="col-span-2">
              <span className="text-slate-500">Parents:</span> Ravi Sharma / Neha Sharma
            </p>
          </div>
        </div>

        {hasField(fields, "subjectsTable") ? (
          <div className="mb-2">
            <p className="mb-1 font-bold" style={{ color: state.themeColor, fontSize: font }}>
              Scholastic Area
            </p>
            <table className="w-full border-collapse" style={{ fontSize: font * 0.75 }}>
              <thead>
                <tr style={{ background: `${state.themeColor}18` }}>
                  {["Subject", "Max", "PA1", "PA2", "PA3", "PA4", "Annual", "Grade"].map((h) => (
                    <th
                      key={h}
                      className="border text-left font-semibold"
                      style={{
                        borderColor: "#CBD5E1",
                        padding: pad * 0.35,
                        display:
                          (h === "Grade" && !state.showGrade && !hasField(fields, "grade")) ||
                          (["PA1", "PA2", "PA3", "PA4"].includes(h) && !hasField(fields, "marksObtained"))
                            ? undefined
                            : undefined,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_SUBJECTS.map((row) => (
                  <tr key={row.name}>
                    <td className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.3 }}>
                      {hasField(fields, "subjectName") ? row.name : "—"}
                    </td>
                    <td className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.3 }}>
                      {hasField(fields, "maxMarks") ? row.max : "—"}
                    </td>
                    {row.pa.map((v, i) => (
                      <td key={i} className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.3 }}>
                        {hasField(fields, "marksObtained") ? v : "—"}
                      </td>
                    ))}
                    <td className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.3 }}>
                      {hasField(fields, "marksObtained") ? row.annual : "—"}
                    </td>
                    <td className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.3 }}>
                      {state.showGrade || hasField(fields, "grade") ? row.grade : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 flex flex-wrap gap-3" style={{ fontSize: font * 0.85 }}>
              {hasField(fields, "percentage") ? <p>Percentage: <strong>78.4%</strong></p> : null}
              {state.showRank || hasField(fields, "rank") ? <p>Rank: <strong>5</strong></p> : null}
              {hasField(fields, "gradePoint") ? <p>GPA: <strong>8.2</strong></p> : null}
            </div>
          </div>
        ) : null}

        <div className="mb-2 grid grid-cols-2 gap-2">
          {hasField(fields, "coScholastic") ? (
            <div>
              <p className="mb-1 font-bold" style={{ color: state.themeColor, fontSize: font }}>
                Co-Scholastic Area
              </p>
              <table className="w-full border-collapse" style={{ fontSize: font * 0.75 }}>
                <tbody>
                  {[
                    ["Work Education", "A"],
                    ["Art Education", "A+"],
                    ["Health & PE", "B+"],
                    ["Discipline", "A"],
                  ].map(([label, grade]) => (
                    <tr key={label}>
                      <td className="border" style={{ borderColor: "#E2E8F0", padding: pad * 0.25 }}>
                        {label}
                      </td>
                      <td className="border text-center" style={{ borderColor: "#E2E8F0", padding: pad * 0.25 }}>
                        {grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="space-y-2">
            {hasField(fields, "attendance") ? (
              <div>
                <p className="mb-1 font-bold" style={{ color: state.themeColor, fontSize: font }}>
                  Attendance
                </p>
                <p style={{ fontSize: font * 0.8 }}>Total Days: 210 · Present: 198 · %: 94.3</p>
              </div>
            ) : null}
            {hasField(fields, "gradingScale") ? (
              <div>
                <p className="mb-1 font-bold" style={{ color: state.themeColor, fontSize: font }}>
                  Grading Scale
                </p>
                <p style={{ fontSize: font * 0.7 }}>A+ 91-100 · A 81-90 · B+ 71-80 · B 61-70 · C 51-60</p>
              </div>
            ) : null}
          </div>
        </div>

        {hasField(fields, "remarks") ? (
          <div className="mb-2 rounded border border-slate-200 p-1.5" style={{ fontSize: font * 0.85 }}>
            <p className="font-semibold text-slate-600">{state.footerNote}</p>
            <p className="mt-1 text-slate-500">A sincere and hardworking student. Keep it up!</p>
          </div>
        ) : null}

        <div className="mt-2 flex items-end justify-between" style={{ fontSize: font * 0.8 }}>
          {hasField(fields, "signature") ? (
            <>
              <div className="text-center">
                <div className="mb-0.5 w-20 border-b border-slate-400" />
                <p>Class Teacher</p>
              </div>
              <div className="text-center">
                <div className="mb-0.5 w-20 border-b border-slate-400" />
                <p>Principal</p>
              </div>
            </>
          ) : (
            <span />
          )}
          {hasField(fields, "date") ? <p>Date: 30 May 2026</p> : null}
        </div>
      </div>
    </div>
  );
}

export function ReportCardTemplatePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Report Card Template";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["documents.manage", "erp.manage", "settings.manage", "exams.manage"].includes(p),
    ),
  );
  const schoolName = user?.tenant?.name ?? "Sunshine Public School";

  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<DesignerState>(defaultState());
  const [history, setHistory] = useState<DesignerState[]>([]);
  const [future, setFuture] = useState<DesignerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(true);
  const [academicOpen, setAcademicOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);

  function patch(partial: Partial<DesignerState>, pushHistory = true) {
    setState((prev) => {
      if (pushHistory) {
        setHistory((h) => [...h.slice(-29), prev]);
        setFuture([]);
      }
      return { ...prev, ...partial };
    });
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [state, ...f]);
      setState(prev);
      return h.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, state]);
      setState(next);
      return f.slice(1);
    });
  }

  function toggleField(key: FieldKey) {
    const enabled = new Set(state.enabledFields);
    if (enabled.has(key)) enabled.delete(key);
    else enabled.add(key);
    const next = [...enabled] as FieldKey[];
    patch({
      enabledFields: next,
      showPhoto: next.includes("photo"),
      showRank: next.includes("rank"),
      showGrade: next.includes("grade"),
    });
  }

  function stateFromTemplate(template: Template): DesignerState {
    const config = template.config ?? {};
    const theme =
      THEME_PRESETS.find((item) => item.name === template.name) ?? THEME_PRESETS[0];
    const orientation =
      template.width >= template.height ? ("LANDSCAPE" as const) : ("PORTRAIT" as const);
    const enabledFields = Array.isArray(config.enabledFields)
      ? (config.enabledFields as FieldKey[])
      : [...DEFAULT_FIELDS];
    return {
      ...defaultState(theme),
      name: template.name,
      sizeKey: orientation === "LANDSCAPE" ? "a4-landscape" : "a4-portrait",
      orientation,
      themeColor: typeof config.themeColor === "string" ? config.themeColor : theme.themeColor,
      headerBackground:
        typeof config.headerBackground === "string"
          ? config.headerBackground
          : typeof config.backgroundColor === "string"
            ? config.backgroundColor
            : theme.headerBackground,
      fontFamily: typeof config.fontFamily === "string" ? config.fontFamily : "Poppins",
      fontSize: Number(config.fontSize ?? 12),
      borderStyle: (config.borderStyle as DesignerState["borderStyle"]) || "solid",
      borderWidth: Number(config.borderWidth ?? 1),
      cellPadding: Number(config.cellPadding ?? 8),
      enabledFields,
      showPhoto: config.showPhoto !== false,
      showBarcode: Boolean(config.showBarcode),
      showLogo: config.showLogo !== false,
      showRank: config.showRank !== false,
      showGrade: config.showGrade !== false,
      footerNote:
        typeof config.footerNote === "string" ? config.footerNote : "Class Teacher's Remarks",
      backgroundUrl: template.backgroundUrl,
      zoom: 100,
    };
  }

  function buildPayload() {
    const preset = SIZE_PRESETS[state.sizeKey];
    return {
      name: state.name,
      width: preset.width,
      height: preset.height,
      backgroundUrl: state.backgroundUrl,
      config: {
        title: "Student Report Card",
        showPhoto: state.showPhoto && hasField(state.enabledFields, "photo"),
        showBarcode: state.showBarcode,
        showLogo: state.showLogo,
        showRank: state.showRank && hasField(state.enabledFields, "rank"),
        showGrade: state.showGrade && hasField(state.enabledFields, "grade"),
        footerNote: state.footerNote,
        backgroundColor: state.headerBackground,
        pageSize: preset.label,
        orientation: state.orientation,
        themeColor: state.themeColor,
        headerBackground: state.headerBackground,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        borderStyle: state.borderStyle,
        borderWidth: state.borderWidth,
        cellPadding: state.cellPadding,
        enabledFields: state.enabledFields,
        marksTablePlaceholder: "[table]",
        designer: "erp-report-card",
      },
    };
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Template[]>(
        "/documents/templates?type=MARKSHEET",
        accessToken,
      );
      const list = (data ?? []).filter((item) => item.isActive !== false);
      setTemplates(list);
      if (list.length) {
        const current = list.find((item) => item.id === selectedId) ?? list[0];
        setSelectedId(current.id);
        setState(stateFromTemplate(current));
        setHistory([]);
        setFuture([]);
      } else {
        setSelectedId(null);
        setState(defaultState());
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load report card templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function saveTemplate() {
    if (!accessToken || !canManage) return;
    const payload = buildPayload();
    if (!payload.name.trim()) {
      notifyError("Template name is required");
      return;
    }
    setSaving(true);
    try {
      if (selectedId) {
        const updated = await apiRequest<Template>(
          `/documents/templates/${selectedId}`,
          accessToken,
          { method: "PUT", body: JSON.stringify(payload) },
        );
        setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedId(updated.id);
        notifySuccess("Report card template saved");
      } else {
        const created = await apiRequest<Template>("/documents/templates", accessToken, {
          method: "POST",
          body: JSON.stringify({ type: "MARKSHEET", ...payload }),
        });
        setTemplates((prev) => [created, ...prev]);
        setSelectedId(created.id);
        notifySuccess("Report card template created");
      }
      setHistory([]);
      setFuture([]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  function selectTemplate(template: Template) {
    setSelectedId(template.id);
    setState(stateFromTemplate(template));
    setHistory([]);
    setFuture([]);
    setStep(2);
  }

  function createFromTheme(theme: (typeof THEME_PRESETS)[number]) {
    setSelectedId(null);
    setState(defaultState(theme));
    setHistory([]);
    setFuture([]);
    setStep(2);
  }

  const tools = useMemo(
    () =>
      [
        { label: "Add Text", icon: <TextFieldsOutlined className="!text-[16px]" />, field: "studentName" as FieldKey },
        { label: "Add Image", icon: <ImageOutlined className="!text-[16px]" />, field: "photo" as FieldKey },
        { label: "Add Table", icon: <TableChartOutlined className="!text-[16px]" />, field: "subjectsTable" as FieldKey },
        { label: "Line", icon: <LineWeightOutlined className="!text-[16px]" />, field: null },
        { label: "Shape", icon: <ShapeLineOutlined className="!text-[16px]" />, field: null },
        { label: "QR Code", icon: <QrCode2Outlined className="!text-[16px]" />, field: null },
        { label: "Barcode", icon: <ViewWeekOutlined className="!text-[16px]" />, field: null },
        { label: "Logo", icon: <UploadOutlined className="!text-[16px]" />, field: null },
        { label: "Subjects Table", icon: <MenuBookOutlined className="!text-[16px]" />, field: "subjectsTable" as FieldKey },
        { label: "Signature", icon: <DrawOutlined className="!text-[16px]" />, field: "signature" as FieldKey },
        { label: "Date", icon: <CalendarMonthOutlined className="!text-[16px]" />, field: "date" as FieldKey },
        { label: "Remarks Box", icon: <CommentOutlined className="!text-[16px]" />, field: "remarks" as FieldKey },
      ] as const,
    [],
  );

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading report card designer…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Report Card Template</h1>
          <p className="text-xs text-[#6B7280]">
            Design and customize report card templates for student result reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            Manage Templates
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <PreviewOutlined className="!text-[18px]" />
            Preview
          </button>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void saveTemplate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
          {[
            { id: 1 as const, label: "1. Choose Template" },
            { id: 2 as const, label: "2. Design Report Card" },
            { id: 3 as const, label: "3. Template Settings" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold",
                step === item.id ? "bg-primary text-white" : "bg-[#F3F4F6] text-[#4B5563]",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
          <Link to="/exams" className="ml-auto text-xs font-semibold text-primary hover:underline">
            Open Exams / Marksheets
          </Link>
        </div>

        {step === 1 ? (
          <Card title="Choose Template">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={[
                    "rounded-xl border p-3 text-left",
                    selectedId === template.id
                      ? "border-primary bg-[#F5F3FF]"
                      : "border-[#E5E7EB] bg-white",
                  ].join(" ")}
                >
                  <div className="mb-2 flex justify-center">
                    <ReportCardPreview
                      state={stateFromTemplate(template)}
                      schoolName={schoolName}
                      compact
                    />
                  </div>
                  <p className="truncate text-sm font-semibold">{template.name}</p>
                </button>
              ))}
              {THEME_PRESETS.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => createFromTheme(theme)}
                  className="rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFC] p-3 text-left"
                >
                  <div className="mb-2 flex justify-center">
                    <ReportCardPreview
                      state={defaultState(theme)}
                      schoolName={schoolName}
                      compact
                    />
                  </div>
                  <p className="text-sm font-semibold">{theme.name}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => createFromTheme(THEME_PRESETS[0])}
                className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] text-[#6B7280]"
              >
                <AddOutlined />
                <span className="text-sm font-semibold">Create New Template</span>
              </button>
            </div>
          </Card>
        ) : null}

        {step === 2 || step === 3 ? (
          <>
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
              {tools.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    if (item.field) toggleField(item.field);
                    else if (item.label === "Logo") patch({ showLogo: !state.showLogo });
                    else if (item.label === "Barcode") patch({ showBarcode: !state.showBarcode });
                    else notifySuccess(`${item.label} is available in the layout`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-xs font-semibold text-[#374151]"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_260px]">
              <Card title="Fields">
                {(
                  [
                    ["Student Information", studentOpen, setStudentOpen, STUDENT_FIELDS],
                    ["Academics", academicOpen, setAcademicOpen, ACADEMIC_FIELDS],
                    ["Other Fields", otherOpen, setOtherOpen, OTHER_FIELDS],
                  ] as const
                ).map(([label, open, setOpen, items]) => (
                  <div key={label} className="mb-2">
                    <button
                      type="button"
                      className="mb-1 flex w-full items-center justify-between text-left text-sm font-semibold"
                      onClick={() => setOpen((v) => !v)}
                    >
                      {label}
                      <span className="text-xs text-[#6B7280]">{open ? "−" : "+"}</span>
                    </button>
                    {open ? (
                      <div className="space-y-1">
                        {items.map((field) => {
                          const active = hasField(state.enabledFields, field.key);
                          return (
                            <button
                              key={field.key}
                              type="button"
                              disabled={!canManage}
                              onClick={() => toggleField(field.key)}
                              className={[
                                "w-full rounded-lg border px-2 py-1.5 text-left text-xs font-medium",
                                active
                                  ? "border-primary bg-[#F5F3FF] text-primary"
                                  : "border-[#E5E7EB] text-[#374151]",
                              ].join(" ")}
                            >
                              {field.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </Card>

              <Card
                title="Design Canvas"
                actions={
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={undo} className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
                      <UndoOutlined className="!text-[18px]" />
                    </button>
                    <button type="button" onClick={redo} className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
                      <RedoOutlined className="!text-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ zoom: Math.max(60, state.zoom - 10) }, false)}
                      className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <ZoomOutOutlined className="!text-[18px]" />
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold">{state.zoom}%</span>
                    <button
                      type="button"
                      onClick={() => patch({ zoom: Math.min(140, state.zoom + 10) }, false)}
                      className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      <ZoomInOutlined className="!text-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ zoom: 100 }, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold"
                    >
                      <FitScreenOutlined className="!text-[16px]" />
                      Fit
                    </button>
                  </div>
                }
              >
                <div className="flex min-h-[480px] items-start justify-center overflow-auto rounded-lg bg-[#F8FAFC] p-4">
                  <ReportCardPreview state={state} schoolName={schoolName} />
                </div>
              </Card>

              <Card title={step === 3 ? "Template Settings" : "Design Properties"}>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Template Name
                    </span>
                    <input
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.name}
                      disabled={!canManage}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Page Size</span>
                    <select
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.sizeKey}
                      disabled={!canManage}
                      onChange={(e) => {
                        const sizeKey = e.target.value as DesignerState["sizeKey"];
                        patch({ sizeKey, orientation: SIZE_PRESETS[sizeKey].orientation });
                      }}
                    >
                      {Object.entries(SIZE_PRESETS).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Orientation
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["PORTRAIT", "Portrait", <CropPortraitOutlined key="p" className="!text-[16px]" />],
                          ["LANDSCAPE", "Landscape", <CropLandscapeOutlined key="l" className="!text-[16px]" />],
                        ] as const
                      ).map(([value, label, icon]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            patch({
                              orientation: value,
                              sizeKey: value === "PORTRAIT" ? "a4-portrait" : "a4-landscape",
                            })
                          }
                          className={[
                            "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold",
                            state.orientation === value
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          {icon}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Theme Color
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {THEME_PRESETS.map((theme) => (
                        <button
                          key={theme.key}
                          type="button"
                          disabled={!canManage}
                          title={theme.name}
                          onClick={() =>
                            patch({
                              themeColor: theme.themeColor,
                              headerBackground: theme.headerBackground,
                            })
                          }
                          className={[
                            "size-6 rounded-full border-2",
                            state.themeColor === theme.themeColor
                              ? "border-slate-900"
                              : "border-transparent",
                          ].join(" ")}
                          style={{ background: theme.themeColor }}
                        />
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Font Family
                    </span>
                    <select
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.fontFamily}
                      disabled={!canManage}
                      onChange={(e) => patch({ fontFamily: e.target.value })}
                    >
                      <option>Poppins</option>
                      <option>Inter</option>
                      <option>Roboto</option>
                      <option>Georgia</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Font Size ({state.fontSize}px)
                    </span>
                    <input
                      type="number"
                      min={8}
                      max={24}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.fontSize}
                      disabled={!canManage}
                      onChange={(e) => patch({ fontSize: Number(e.target.value) || 12 })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Header Background
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={state.headerBackground}
                        disabled={!canManage}
                        onChange={(e) => patch({ headerBackground: e.target.value })}
                      />
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm uppercase outline-none focus:border-primary"
                        value={state.headerBackground}
                        disabled={!canManage}
                        onChange={(e) => patch({ headerBackground: e.target.value })}
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Border Style
                    </span>
                    <select
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.borderStyle}
                      disabled={!canManage}
                      onChange={(e) =>
                        patch({ borderStyle: e.target.value as DesignerState["borderStyle"] })
                      }
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Border Width ({state.borderWidth}px)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      value={state.borderWidth}
                      disabled={!canManage}
                      onChange={(e) => patch({ borderWidth: Number(e.target.value) })}
                      className="w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Cell Padding ({state.cellPadding}px)
                    </span>
                    <input
                      type="range"
                      min={2}
                      max={16}
                      value={state.cellPadding}
                      disabled={!canManage}
                      onChange={(e) => patch({ cellPadding: Number(e.target.value) })}
                      className="w-full"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => {
                      setState(defaultState(THEME_PRESETS[0]));
                      setHistory([]);
                      setFuture([]);
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
                  >
                    <RestartAltOutlined className="!text-[18px]" />
                    Reset Design
                  </button>
                </div>
              </Card>
            </div>
          </>
        ) : null}

        <Card title="Template Gallery">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={[
                  "relative w-40 shrink-0 rounded-xl border p-2 text-left",
                  selectedId === template.id
                    ? "border-primary bg-[#F5F3FF]"
                    : "border-[#E5E7EB] bg-white",
                ].join(" ")}
              >
                {selectedId === template.id ? (
                  <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-white">
                    <VerifiedOutlined className="!text-[14px]" />
                  </span>
                ) : null}
                <div className="mb-2 flex justify-center">
                  <ReportCardPreview
                    state={stateFromTemplate(template)}
                    schoolName={schoolName}
                    compact
                  />
                </div>
                <p className="truncate text-xs font-semibold">{template.name}</p>
              </button>
            ))}
            {THEME_PRESETS.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => createFromTheme(theme)}
                className="w-40 shrink-0 rounded-xl border border-[#E5E7EB] bg-white p-2 text-left"
              >
                <div className="mb-2 flex justify-center">
                  <ReportCardPreview state={defaultState(theme)} schoolName={schoolName} compact />
                </div>
                <p className="truncate text-xs font-semibold">{theme.name}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => createFromTheme(THEME_PRESETS[0])}
              className="flex w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D1D5DB] text-[#6B7280]"
            >
              <AddOutlined />
              <span className="text-xs font-semibold">Create New Template</span>
            </button>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs text-[#1E40AF]">
          <InfoOutlined className="!text-[16px] shrink-0" />
          <p>
            Note: Templates are saved as marksheet document templates and can be used from Exams when
            generating report cards.
          </p>
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Preview · {state.name}</h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="flex justify-center bg-[#F6F7F9] p-4">
              <ReportCardPreview state={{ ...state, zoom: 120 }} schoolName={schoolName} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
