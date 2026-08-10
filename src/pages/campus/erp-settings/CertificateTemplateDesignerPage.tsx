import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddOutlined,
  CalendarMonthOutlined,
  CropLandscapeOutlined,
  CropPortraitOutlined,
  FitScreenOutlined,
  FormatAlignCenter,
  FormatAlignJustify,
  FormatAlignLeft,
  FormatAlignRight,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  ImageOutlined,
  InfoOutlined,
  LineWeightOutlined,
  PreviewOutlined,
  QrCode2Outlined,
  RedoOutlined,
  SaveOutlined,
  ShapeLineOutlined,
  TextFieldsOutlined,
  UndoOutlined,
  UploadOutlined,
  VerifiedOutlined,
  ViewWeekOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DrawOutlined,
  TableChartOutlined,
  DataObjectOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Template = {
  id: string;
  name: string;
  type: "CERTIFICATE";
  width: number;
  height: number;
  backgroundUrl: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
};

type Tool =
  | "text"
  | "image"
  | "shape"
  | "logo"
  | "line"
  | "badge"
  | "qr"
  | "barcode"
  | "signature"
  | "table"
  | "date"
  | "variable";

type DesignerState = {
  name: string;
  sizeKey: "a4-landscape" | "a4-portrait" | "letter-landscape" | "letter-portrait";
  orientation: "LANDSCAPE" | "PORTRAIT";
  backgroundMode: "COLOR" | "IMAGE";
  backgroundColor: string;
  themeColor: string;
  accentColor: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  cornerRadius: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  zoom: number;
  title: string;
  subtitle: string;
  bodyText: string;
  courseText: string;
  yearText: string;
  studentName: string;
  fontFamily: string;
  fontSize: number;
  fontBold: boolean;
  fontItalic: boolean;
  fontUnderline: boolean;
  textAlign: "left" | "center" | "right" | "justify";
  textColor: string;
  letterSpacing: number;
  lineHeight: number;
  showLogo: boolean;
  showBadge: boolean;
  showBarcode: boolean;
  showQr: boolean;
  showSignature: boolean;
  showDate: boolean;
  showPhoto: boolean;
  backgroundUrl: string | null;
};

const SIZE_PRESETS = {
  "a4-landscape": {
    label: "A4 (Landscape) 29.7 × 21 cm",
    chip: "A4 Landscape",
    width: 1600,
    height: 1131,
    orientation: "LANDSCAPE" as const,
  },
  "a4-portrait": {
    label: "A4 (Portrait) 21 × 29.7 cm",
    chip: "A4 Portrait",
    width: 1131,
    height: 1600,
    orientation: "PORTRAIT" as const,
  },
  "letter-landscape": {
    label: "Letter Landscape (279 × 216 mm)",
    chip: "Letter Landscape",
    width: 1650,
    height: 1275,
    orientation: "LANDSCAPE" as const,
  },
  "letter-portrait": {
    label: "Letter Portrait (216 × 279 mm)",
    chip: "Letter Portrait",
    width: 1275,
    height: 1650,
    orientation: "PORTRAIT" as const,
  },
};

const THEME_PRESETS = [
  {
    key: "blue-gold",
    name: "Achievement - Blue Gold",
    themeColor: "#0D47A1",
    accentColor: "#D4AF37",
    title: "Certificate of Achievement",
  },
  {
    key: "green",
    name: "Excellence - Green",
    themeColor: "#065F46",
    accentColor: "#34D399",
    title: "Certificate of Excellence",
  },
  {
    key: "modern",
    name: "Completion - Modern",
    themeColor: "#1F2937",
    accentColor: "#38BDF8",
    title: "Certificate of Completion",
  },
  {
    key: "elegant",
    name: "Participation - Elegant",
    themeColor: "#7C3AED",
    accentColor: "#F472B6",
    title: "Certificate of Participation",
  },
  {
    key: "classic",
    name: "Recognition - Classic",
    themeColor: "#7C2D12",
    accentColor: "#F59E0B",
    title: "Certificate of Recognition",
  },
];

const VARIABLES = [
  { key: "{{student_name}}", label: "Student Name" },
  { key: "{{course_name}}", label: "Course Name" },
  { key: "{{academic_year}}", label: "Academic Year" },
  { key: "{{issue_date}}", label: "Issue Date" },
  { key: "{{school_name}}", label: "School Name" },
  { key: "{{class_section}}", label: "Class / Section" },
];

function defaultState(theme = THEME_PRESETS[0]): DesignerState {
  return {
    name: theme.name,
    sizeKey: "a4-landscape",
    orientation: "LANDSCAPE",
    backgroundMode: "COLOR",
    backgroundColor: "#FFFFFF",
    themeColor: theme.themeColor,
    accentColor: theme.accentColor,
    borderEnabled: true,
    borderColor: theme.accentColor,
    borderWidth: 6,
    cornerRadius: 10,
    marginTop: 15,
    marginBottom: 15,
    marginLeft: 20,
    marginRight: 20,
    zoom: 100,
    title: theme.title,
    subtitle: "This is to certify that",
    bodyText: "has successfully completed the course of",
    courseText: "Advanced Mathematics",
    yearText: "for the Academic Year 2025 - 2026",
    studentName: "Arjun Sharma",
    fontFamily: "Playfair Display",
    fontSize: 48,
    fontBold: true,
    fontItalic: false,
    fontUnderline: false,
    textAlign: "center",
    textColor: theme.themeColor,
    letterSpacing: 0,
    lineHeight: 1.2,
    showLogo: true,
    showBadge: true,
    showBarcode: false,
    showQr: false,
    showSignature: true,
    showDate: true,
    showPhoto: false,
    backgroundUrl: null,
  };
}

function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white shadow-sm ${className}`}>
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

function CertificatePreview({
  state,
  schoolName,
  compact = false,
}: {
  state: DesignerState;
  schoolName: string;
  compact?: boolean;
}) {
  const size = SIZE_PRESETS[state.sizeKey];
  const scale = compact ? 0.18 : Math.min(1, state.zoom / 100) * 0.42;
  const width = size.width * scale;
  const height = size.height * scale;
  const titleSize = Math.max(12, state.fontSize * scale * 0.55);

  return (
    <div
      className="relative overflow-hidden bg-white shadow-lg"
      style={{
        width,
        height,
        backgroundColor: state.backgroundMode === "COLOR" ? state.backgroundColor : "#fff",
        backgroundImage:
          state.backgroundMode === "IMAGE" && state.backgroundUrl
            ? `url(${state.backgroundUrl})`
            : undefined,
        backgroundSize: "cover",
        borderRadius: state.cornerRadius * scale,
        border: state.borderEnabled
          ? `${Math.max(2, state.borderWidth * scale * 0.5)}px solid ${state.borderColor}`
          : "1px solid #E5E7EB",
      }}
    >
      <div
        className="pointer-events-none absolute inset-2 rounded-sm"
        style={{
          border: `2px solid ${state.themeColor}`,
          boxShadow: `inset 0 0 0 3px ${state.accentColor}55`,
        }}
      />

      <div
        className="absolute inset-0 flex flex-col items-center"
        style={{
          padding: `${state.marginTop * scale}px ${state.marginRight * scale}px ${state.marginBottom * scale}px ${state.marginLeft * scale}px`,
          textAlign: state.textAlign,
        }}
      >
        {state.showLogo ? (
          <div
            className="mb-2 grid place-items-center rounded-full border-2 bg-white text-[8px] font-bold"
            style={{
              width: 36 * (compact ? 0.7 : 1),
              height: 36 * (compact ? 0.7 : 1),
              borderColor: state.accentColor,
              color: state.themeColor,
            }}
          >
            LOGO
          </div>
        ) : null}

        <p className="text-[8px] font-semibold uppercase tracking-[0.25em] text-slate-500">
          {schoolName}
        </p>

        <h2
          className="mt-1 w-full px-2"
          style={{
            color: state.textColor,
            fontFamily: `"${state.fontFamily}", Georgia, serif`,
            fontSize: titleSize,
            fontWeight: state.fontBold ? 800 : 500,
            fontStyle: state.fontItalic ? "italic" : "normal",
            textDecoration: state.fontUnderline ? "underline" : "none",
            letterSpacing: state.letterSpacing,
            lineHeight: state.lineHeight,
            textAlign: state.textAlign,
          }}
        >
          {state.title}
        </h2>

        <p className="mt-2 text-[10px] text-slate-500">{state.subtitle}</p>
        <p
          className="mt-1 px-2 font-serif text-[18px] italic"
          style={{ color: state.accentColor, fontSize: Math.max(12, 22 * scale) }}
        >
          {state.studentName}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">{state.bodyText}</p>
        <p className="mt-1 text-[12px] font-bold" style={{ color: state.themeColor }}>
          {state.courseText}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">{state.yearText}</p>

        <div className="mt-auto flex w-full items-end justify-between px-2 pb-1">
          <div className="text-left">
            {state.showDate ? (
              <div>
                <p className="text-[9px] font-semibold text-slate-700">30 May 2026</p>
                <p className="text-[8px] text-slate-400">Date</p>
              </div>
            ) : null}
            {state.showBarcode ? (
              <div className="mt-1 h-3 w-16 bg-[repeating-linear-gradient(90deg,#111_0_1px,transparent_1px_3px)]" />
            ) : null}
            {state.showQr ? (
              <div className="mt-1 grid size-7 place-items-center border border-slate-300 text-[8px] text-slate-400">
                QR
              </div>
            ) : null}
          </div>

          {state.showBadge ? (
            <div className="flex flex-col items-center">
              <div
                className="grid place-items-center rounded-full border-4 text-[8px] font-bold text-white"
                style={{
                  width: 42,
                  height: 42,
                  background: state.accentColor,
                  borderColor: state.themeColor,
                }}
              >
                SEAL
              </div>
              <div className="mt-0.5 h-3 w-1 bg-rose-500" />
            </div>
          ) : null}

          <div className="text-right">
            {state.showSignature ? (
              <div>
                <div className="mb-0.5 border-b border-slate-400 px-3 text-[10px] italic text-slate-500">
                  Signature
                </div>
                <p className="text-[8px] font-semibold text-slate-600">Principal</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CertificateTemplateDesignerPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Certificate Template Designer";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["documents.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );
  const schoolName = user?.tenant?.name ?? "School Name";

  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [tool, setTool] = useState<Tool>("text");
  const [panelTab, setPanelTab] = useState<"content" | "variables">("content");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState<DesignerState>(defaultState());
  const [history, setHistory] = useState<DesignerState[]>([]);
  const [future, setFuture] = useState<DesignerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  function applySize(sizeKey: DesignerState["sizeKey"]) {
    const preset = SIZE_PRESETS[sizeKey];
    patch({ sizeKey, orientation: preset.orientation });
  }

  function applyOrientation(orientation: "LANDSCAPE" | "PORTRAIT") {
    const sizeKey =
      orientation === "LANDSCAPE"
        ? state.sizeKey.includes("letter")
          ? "letter-landscape"
          : "a4-landscape"
        : state.sizeKey.includes("letter")
          ? "letter-portrait"
          : "a4-portrait";
    applySize(sizeKey as DesignerState["sizeKey"]);
  }

  function stateFromTemplate(template: Template): DesignerState {
    const config = template.config ?? {};
    const theme = THEME_PRESETS.find((item) => item.name === template.name) ?? THEME_PRESETS[0];
    const orientation =
      template.width >= template.height ? ("LANDSCAPE" as const) : ("PORTRAIT" as const);
    const matched =
      (Object.entries(SIZE_PRESETS).find(
        ([, value]) => value.width === template.width && value.height === template.height,
      )?.[0] as DesignerState["sizeKey"] | undefined) ??
      (orientation === "LANDSCAPE" ? "a4-landscape" : "a4-portrait");

    return {
      ...defaultState(theme),
      name: template.name,
      sizeKey: matched,
      orientation,
      backgroundMode: template.backgroundUrl ? "IMAGE" : "COLOR",
      backgroundColor:
        typeof config.backgroundColor === "string" ? config.backgroundColor : "#FFFFFF",
      themeColor: typeof config.themeColor === "string" ? config.themeColor : theme.themeColor,
      accentColor: typeof config.accentColor === "string" ? config.accentColor : theme.accentColor,
      borderEnabled: config.borderEnabled !== false,
      borderColor: typeof config.borderColor === "string" ? config.borderColor : theme.accentColor,
      borderWidth: Number(config.borderWidth ?? 6),
      cornerRadius: Number(config.cornerRadius ?? 10),
      marginTop: Number(config.marginTop ?? 15),
      marginBottom: Number(config.marginBottom ?? 15),
      marginLeft: Number(config.marginLeft ?? 20),
      marginRight: Number(config.marginRight ?? 20),
      title: typeof config.title === "string" ? config.title : theme.title,
      subtitle: typeof config.subtitle === "string" ? config.subtitle : "This is to certify that",
      bodyText:
        typeof config.bodyText === "string"
          ? config.bodyText
          : "has successfully completed the course of",
      courseText: typeof config.courseText === "string" ? config.courseText : "Advanced Mathematics",
      yearText:
        typeof config.yearText === "string" ? config.yearText : "for the Academic Year 2025 - 2026",
      studentName: typeof config.studentName === "string" ? config.studentName : "Arjun Sharma",
      fontFamily: typeof config.fontFamily === "string" ? config.fontFamily : "Playfair Display",
      fontSize: Number(config.fontSize ?? 48),
      fontBold: config.fontBold !== false,
      fontItalic: Boolean(config.fontItalic),
      fontUnderline: Boolean(config.fontUnderline),
      textAlign: (config.textAlign as DesignerState["textAlign"]) || "center",
      textColor: typeof config.textColor === "string" ? config.textColor : theme.themeColor,
      letterSpacing: Number(config.letterSpacing ?? 0),
      lineHeight: Number(config.lineHeight ?? 1.2),
      showLogo: config.showLogo !== false,
      showBadge: config.showBadge !== false,
      showBarcode: Boolean(config.showBarcode),
      showQr: Boolean(config.showQr),
      showSignature: config.showSignature !== false,
      showDate: config.showDate !== false,
      showPhoto: Boolean(config.showPhoto),
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
      backgroundUrl: state.backgroundMode === "IMAGE" ? state.backgroundUrl : null,
      config: {
        title: state.title,
        subtitle: state.subtitle,
        bodyText: state.bodyText,
        courseText: state.courseText,
        yearText: state.yearText,
        studentName: state.studentName,
        showPhoto: state.showPhoto,
        showBarcode: state.showBarcode,
        showLogo: state.showLogo,
        showBadge: state.showBadge,
        showQr: state.showQr,
        showSignature: state.showSignature,
        showDate: state.showDate,
        backgroundColor: state.backgroundColor,
        pageSize: preset.chip,
        themeColor: state.themeColor,
        accentColor: state.accentColor,
        borderEnabled: state.borderEnabled,
        borderColor: state.borderColor,
        borderWidth: state.borderWidth,
        cornerRadius: state.cornerRadius,
        marginTop: state.marginTop,
        marginBottom: state.marginBottom,
        marginLeft: state.marginLeft,
        marginRight: state.marginRight,
        orientation: state.orientation,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        fontBold: state.fontBold,
        fontItalic: state.fontItalic,
        fontUnderline: state.fontUnderline,
        textAlign: state.textAlign,
        textColor: state.textColor,
        letterSpacing: state.letterSpacing,
        lineHeight: state.lineHeight,
        designer: "erp-certificate",
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
        "/documents/templates?type=CERTIFICATE",
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
      notifyError(cause instanceof Error ? cause.message : "Unable to load certificate templates");
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
        notifySuccess("Certificate template saved");
      } else {
        const created = await apiRequest<Template>("/documents/templates", accessToken, {
          method: "POST",
          body: JSON.stringify({ type: "CERTIFICATE", ...payload }),
        });
        setTemplates((prev) => [created, ...prev]);
        setSelectedId(created.id);
        notifySuccess("Certificate template created");
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
        { id: "text" as const, label: "Text", icon: <TextFieldsOutlined className="!text-[16px]" /> },
        { id: "image" as const, label: "Image", icon: <ImageOutlined className="!text-[16px]" /> },
        { id: "shape" as const, label: "Shape", icon: <ShapeLineOutlined className="!text-[16px]" /> },
        { id: "logo" as const, label: "Logo", icon: <UploadOutlined className="!text-[16px]" /> },
        { id: "line" as const, label: "Line", icon: <LineWeightOutlined className="!text-[16px]" /> },
        { id: "badge" as const, label: "Badge", icon: <WorkspacePremiumOutlined className="!text-[16px]" /> },
        { id: "qr" as const, label: "QR Code", icon: <QrCode2Outlined className="!text-[16px]" /> },
        { id: "barcode" as const, label: "Barcode", icon: <ViewWeekOutlined className="!text-[16px]" /> },
        { id: "signature" as const, label: "Signature", icon: <DrawOutlined className="!text-[16px]" /> },
        { id: "table" as const, label: "Table", icon: <TableChartOutlined className="!text-[16px]" /> },
        { id: "date" as const, label: "Date", icon: <CalendarMonthOutlined className="!text-[16px]" /> },
        { id: "variable" as const, label: "Variable", icon: <DataObjectOutlined className="!text-[16px]" /> },
      ] as const,
    [],
  );

  function onToolClick(id: Tool) {
    setTool(id);
    if (id === "logo") patch({ showLogo: !state.showLogo });
    if (id === "badge") patch({ showBadge: !state.showBadge });
    if (id === "qr") patch({ showQr: !state.showQr });
    if (id === "barcode") patch({ showBarcode: !state.showBarcode });
    if (id === "signature") patch({ showSignature: !state.showSignature });
    if (id === "date") patch({ showDate: !state.showDate });
    if (id === "variable") setPanelTab("variables");
    if (id === "text") setPanelTab("content");
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading certificate designer…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Certificate Template Designer</h1>
          <p className="text-xs text-[#6B7280]">
            Create and customize certificate templates for students and staff.
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
            { id: 2 as const, label: "2. Design Certificate" },
            { id: 3 as const, label: "3. Template Settings" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                step === item.id
                  ? "bg-primary text-white"
                  : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
          <Link to="/documents" className="ml-auto text-xs font-semibold text-primary hover:underline">
            Open Documents module
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
                    "rounded-xl border p-3 text-left transition",
                    selectedId === template.id
                      ? "border-primary bg-[#F5F3FF]"
                      : "border-[#E5E7EB] bg-white hover:border-[#C7D2FE]",
                  ].join(" ")}
                >
                  <div className="mb-2 flex justify-center">
                    <CertificatePreview
                      state={stateFromTemplate(template)}
                      schoolName={schoolName}
                      compact
                    />
                  </div>
                  <p className="truncate text-sm font-semibold text-[#1A1A1A]">{template.name}</p>
                </button>
              ))}
              {THEME_PRESETS.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => createFromTheme(theme)}
                  className="rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFC] p-3 text-left hover:border-primary"
                >
                  <div className="mb-2 flex justify-center">
                    <CertificatePreview
                      state={defaultState(theme)}
                      schoolName={schoolName}
                      compact
                    />
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{theme.name}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => createFromTheme(THEME_PRESETS[0])}
                className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] bg-white text-[#6B7280] hover:border-primary hover:text-primary"
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
                  key={item.id}
                  type="button"
                  onClick={() => onToolClick(item.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                    tool === item.id
                      ? "border-primary bg-[#F5F3FF] text-primary"
                      : "border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]",
                  ].join(" ")}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
              <Card
                title={tool === "text" || tool === "variable" ? "Add Text" : "Element Options"}
                actions={
                  tool === "text" || tool === "variable" ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPanelTab("content")}
                        className={[
                          "rounded px-2 py-0.5 text-[11px] font-semibold",
                          panelTab === "content" ? "bg-primary text-white" : "text-[#6B7280]",
                        ].join(" ")}
                      >
                        Content
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanelTab("variables")}
                        className={[
                          "rounded px-2 py-0.5 text-[11px] font-semibold",
                          panelTab === "variables" ? "bg-primary text-white" : "text-[#6B7280]",
                        ].join(" ")}
                      >
                        Variables
                      </button>
                    </div>
                  ) : null
                }
              >
                {panelTab === "variables" ? (
                  <div className="space-y-1">
                    {VARIABLES.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        disabled={!canManage}
                        onClick={() => {
                          patch({ studentName: item.key });
                          notifySuccess(`Inserted ${item.label}`);
                        }}
                        className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-left text-xs"
                      >
                        <span className="font-semibold text-[#1A1A1A]">{item.label}</span>
                        <code className="text-[10px] text-primary">{item.key}</code>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Text
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                        value={state.title}
                        disabled={!canManage}
                        onChange={(e) => patch({ title: e.target.value })}
                      />
                    </label>
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
                        <option>Playfair Display</option>
                        <option>Georgia</option>
                        <option>Times New Roman</option>
                        <option>Cormorant Garamond</option>
                        <option>Inter</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Font Size
                      </span>
                      <input
                        type="number"
                        min={12}
                        max={96}
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                        value={state.fontSize}
                        disabled={!canManage}
                        onChange={(e) => patch({ fontSize: Number(e.target.value) || 48 })}
                      />
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ["fontBold", <FormatBold key="b" className="!text-[16px]" />],
                          ["fontItalic", <FormatItalic key="i" className="!text-[16px]" />],
                          ["fontUnderline", <FormatUnderlined key="u" className="!text-[16px]" />],
                        ] as const
                      ).map(([key, icon]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={!canManage}
                          onClick={() => patch({ [key]: !state[key] })}
                          className={[
                            "rounded border p-1.5",
                            state[key]
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          {icon}
                        </button>
                      ))}
                      {(
                        [
                          ["left", <FormatAlignLeft key="l" className="!text-[16px]" />],
                          ["center", <FormatAlignCenter key="c" className="!text-[16px]" />],
                          ["right", <FormatAlignRight key="r" className="!text-[16px]" />],
                          ["justify", <FormatAlignJustify key="j" className="!text-[16px]" />],
                        ] as const
                      ).map(([align, icon]) => (
                        <button
                          key={align}
                          type="button"
                          disabled={!canManage}
                          onClick={() => patch({ textAlign: align })}
                          className={[
                            "rounded border p-1.5",
                            state.textAlign === align
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={state.textColor}
                          disabled={!canManage}
                          onChange={(e) => patch({ textColor: e.target.value })}
                        />
                        <input
                          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm uppercase outline-none focus:border-primary"
                          value={state.textColor}
                          disabled={!canManage}
                          onChange={(e) => patch({ textColor: e.target.value })}
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Letter Spacing ({state.letterSpacing})
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={0.5}
                        value={state.letterSpacing}
                        disabled={!canManage}
                        onChange={(e) => patch({ letterSpacing: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Line Height ({state.lineHeight})
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={2}
                        step={0.1}
                        value={state.lineHeight}
                        disabled={!canManage}
                        onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Student Name Preview
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                        value={state.studentName}
                        disabled={!canManage}
                        onChange={(e) => patch({ studentName: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Course Text
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                        value={state.courseText}
                        disabled={!canManage}
                        onChange={(e) => patch({ courseText: e.target.value })}
                      />
                    </label>
                  </div>
                )}
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
                    <span className="min-w-12 text-center text-xs font-semibold text-[#374151]">
                      {state.zoom}%
                    </span>
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
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold text-[#374151]"
                    >
                      <FitScreenOutlined className="!text-[16px]" />
                      Fit to Canvas
                    </button>
                  </div>
                }
              >
                <div className="flex min-h-[420px] items-center justify-center rounded-lg bg-[#F8FAFC] p-4">
                  <CertificatePreview state={state} schoolName={schoolName} />
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
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Certificate Size
                    </span>
                    <select
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.sizeKey}
                      disabled={!canManage}
                      onChange={(e) => applySize(e.target.value as DesignerState["sizeKey"])}
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
                          ["LANDSCAPE", "Landscape", <CropLandscapeOutlined key="l" className="!text-[16px]" />],
                          ["PORTRAIT", "Portrait", <CropPortraitOutlined key="p" className="!text-[16px]" />],
                        ] as const
                      ).map(([value, label, icon]) => (
                        <button
                          key={value}
                          type="button"
                          disabled={!canManage}
                          onClick={() => applyOrientation(value)}
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
                      Background
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["COLOR", "IMAGE"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={!canManage}
                          onClick={() => patch({ backgroundMode: mode })}
                          className={[
                            "rounded-lg border px-2 py-2 text-xs font-semibold",
                            state.backgroundMode === mode
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          {mode === "COLOR" ? "Color" : "Image"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {state.backgroundMode === "COLOR" ? (
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Background Color
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={state.backgroundColor}
                          disabled={!canManage}
                          onChange={(e) => patch({ backgroundColor: e.target.value })}
                        />
                        <input
                          className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm uppercase outline-none focus:border-primary"
                          value={state.backgroundColor}
                          disabled={!canManage}
                          onChange={(e) => patch({ backgroundColor: e.target.value })}
                        />
                      </div>
                    </label>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Background Image URL
                      </span>
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                        value={state.backgroundUrl ?? ""}
                        disabled={!canManage}
                        onChange={(e) => patch({ backgroundUrl: e.target.value || null })}
                      />
                    </label>
                  )}
                  <div className="flex items-center justify-between rounded-lg border border-[#F3F4F6] px-3 py-2">
                    <span className="text-sm font-medium text-[#1A1A1A]">Border</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.borderEnabled}
                      disabled={!canManage}
                      onClick={() => patch({ borderEnabled: !state.borderEnabled })}
                      className={[
                        "relative h-6 w-11 rounded-full transition disabled:opacity-50",
                        state.borderEnabled ? "bg-primary" : "bg-[#D1D5DB]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "absolute top-0.5 size-5 rounded-full bg-white shadow transition",
                          state.borderEnabled ? "left-[22px]" : "left-0.5",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                  {state.borderEnabled ? (
                    <>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                          Border Color
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={state.borderColor}
                            disabled={!canManage}
                            onChange={(e) => patch({ borderColor: e.target.value })}
                          />
                          <input
                            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm uppercase outline-none focus:border-primary"
                            value={state.borderColor}
                            disabled={!canManage}
                            onChange={(e) => patch({ borderColor: e.target.value })}
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                          Border Width ({state.borderWidth} px)
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={20}
                          value={state.borderWidth}
                          disabled={!canManage}
                          onChange={(e) => patch({ borderWidth: Number(e.target.value) })}
                          className="w-full"
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Corner Radius ({state.cornerRadius} px)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      value={state.cornerRadius}
                      disabled={!canManage}
                      onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
                      className="w-full"
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Margins (mm)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ["marginTop", "Top"],
                          ["marginBottom", "Bottom"],
                          ["marginLeft", "Left"],
                          ["marginRight", "Right"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block">
                          <span className="mb-0.5 block text-[11px] text-[#9CA3AF]">{label}</span>
                          <input
                            type="number"
                            min={0}
                            max={40}
                            className="w-full rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm outline-none focus:border-primary"
                            value={state[key]}
                            disabled={!canManage}
                            onChange={(e) => patch({ [key]: Number(e.target.value) || 0 })}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
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
                  "relative w-48 shrink-0 rounded-xl border p-2 text-left",
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
                  <CertificatePreview
                    state={stateFromTemplate(template)}
                    schoolName={schoolName}
                    compact
                  />
                </div>
                <p className="truncate text-xs font-semibold text-[#1A1A1A]">{template.name}</p>
              </button>
            ))}
            {THEME_PRESETS.map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => createFromTheme(theme)}
                className="w-48 shrink-0 rounded-xl border border-[#E5E7EB] bg-white p-2 text-left"
              >
                <div className="mb-2 flex justify-center">
                  <CertificatePreview state={defaultState(theme)} schoolName={schoolName} compact />
                </div>
                <p className="truncate text-xs font-semibold text-[#1A1A1A]">{theme.name}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => createFromTheme(THEME_PRESETS[0])}
              className="flex w-48 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280]"
            >
              <AddOutlined />
              <span className="text-xs font-semibold">Create New Template</span>
            </button>
          </div>
        </Card>

        <div className="flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs text-[#1E40AF]">
          <InfoOutlined className="!text-[16px] shrink-0" />
          <p>Note: Changes are auto-kept in the editor. Click Save Template to use this template.</p>
        </div>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1A1A1A]">Preview · {state.name}</h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="flex justify-center bg-[#F6F7F9] p-6">
              <CertificatePreview state={{ ...state, zoom: 130 }} schoolName={schoolName} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
