import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddOutlined,
  CropLandscapeOutlined,
  CropPortraitOutlined,
  FitScreenOutlined,
  ImageOutlined,
  InfoOutlined,
  InsertDriveFileOutlined,
  LineWeightOutlined,
  PersonOutlined,
  PreviewOutlined,
  QrCode2Outlined,
  RedoOutlined,
  SaveOutlined,
  ShapeLineOutlined,
  TextFieldsOutlined,
  UndoOutlined,
  UploadOutlined,
  ViewWeekOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Template = {
  id: string;
  name: string;
  type: "ID_CARD";
  width: number;
  height: number;
  backgroundUrl: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
};

type FieldKey =
  | "fullName"
  | "admissionNo"
  | "rollNumber"
  | "className"
  | "section"
  | "dateOfBirth"
  | "bloodGroup"
  | "phone"
  | "address"
  | "photo"
  | "guardianName"
  | "barcode"
  | "qrCode"
  | "logo"
  | "signature";

type DesignerState = {
  name: string;
  sizeKey: "cr80-landscape" | "cr80-portrait" | "horizontal" | "vertical";
  orientation: "LANDSCAPE" | "PORTRAIT";
  backgroundMode: "COLOR" | "IMAGE";
  backgroundColor: string;
  themeColor: string;
  accentColor: string;
  cornerRadius: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  zoom: number;
  enabledFields: FieldKey[];
  title: string;
  showPhoto: boolean;
  showBarcode: boolean;
  showClass: boolean;
  backgroundUrl: string | null;
};

const SIZE_PRESETS = {
  "cr80-landscape": { label: "CR80 (85.6 × 54 mm)", width: 1013, height: 638, orientation: "LANDSCAPE" as const },
  "cr80-portrait": { label: "CR80 Portrait (54 × 85.6 mm)", width: 638, height: 1013, orientation: "PORTRAIT" as const },
  horizontal: { label: "Horizontal", width: 1013, height: 638, orientation: "LANDSCAPE" as const },
  vertical: { label: "Vertical", width: 638, height: 1013, orientation: "PORTRAIT" as const },
};

const STUDENT_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "fullName", label: "Full Name" },
  { key: "admissionNo", label: "Admission No." },
  { key: "rollNumber", label: "Roll Number" },
  { key: "className", label: "Class" },
  { key: "section", label: "Section" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "phone", label: "Phone Number" },
  { key: "address", label: "Address" },
  { key: "photo", label: "Student Photo" },
  { key: "guardianName", label: "Parent/Guardian Name" },
];

const OTHER_FIELDS: Array<{ key: FieldKey; label: string }> = [
  { key: "barcode", label: "Barcode" },
  { key: "qrCode", label: "QR Code" },
  { key: "logo", label: "School Logo" },
  { key: "signature", label: "Principal Signature" },
];

const THEME_PRESETS = [
  { key: "blue", name: "Student ID Card - Blue", themeColor: "#1E3A8A", accentColor: "#FACC15" },
  { key: "green", name: "Student ID Card - Green", themeColor: "#047857", accentColor: "#86EFAC" },
  { key: "orange", name: "Student ID Card - Orange", themeColor: "#C2410C", accentColor: "#FDBA74" },
  { key: "purple", name: "Student ID Card - Purple", themeColor: "#6D28D9", accentColor: "#C4B5FD" },
];

const DEFAULT_FIELDS: FieldKey[] = [
  "fullName",
  "admissionNo",
  "rollNumber",
  "className",
  "section",
  "dateOfBirth",
  "bloodGroup",
  "phone",
  "photo",
  "barcode",
  "logo",
  "signature",
];

function defaultState(theme = THEME_PRESETS[0]): DesignerState {
  return {
    name: theme.name,
    sizeKey: "cr80-landscape",
    orientation: "LANDSCAPE",
    backgroundMode: "COLOR",
    backgroundColor: "#FFFFFF",
    themeColor: theme.themeColor,
    accentColor: theme.accentColor,
    cornerRadius: 8,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    zoom: 100,
    enabledFields: [...DEFAULT_FIELDS],
    title: "STUDENT IDENTITY CARD",
    showPhoto: true,
    showBarcode: true,
    showClass: true,
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

function IdCardPreview({
  state,
  schoolName,
  compact = false,
}: {
  state: DesignerState;
  schoolName: string;
  compact?: boolean;
}) {
  const size = SIZE_PRESETS[state.sizeKey];
  const landscape = state.orientation === "LANDSCAPE";
  const fields = state.enabledFields;
  const scale = compact ? 0.28 : Math.min(1, state.zoom / 100);
  const width = size.width * scale * (compact ? 1 : 0.55);
  const height = size.height * scale * (compact ? 1 : 0.55);

  return (
    <div
      className="relative overflow-hidden border border-[#D1D5DB] bg-white shadow-lg"
      style={{
        width,
        height,
        borderRadius: state.cornerRadius * (compact ? 0.4 : 0.55),
        backgroundColor: state.backgroundMode === "COLOR" ? state.backgroundColor : "#fff",
        backgroundImage:
          state.backgroundMode === "IMAGE" && state.backgroundUrl
            ? `url(${state.backgroundUrl})`
            : undefined,
        backgroundSize: "cover",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-2 px-3"
        style={{
          height: landscape ? "22%" : "18%",
          background: state.themeColor,
          paddingTop: state.marginTop,
          paddingLeft: state.marginLeft,
          paddingRight: state.marginRight,
        }}
      >
        {hasField(fields, "logo") ? (
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/95 text-[8px] font-bold text-slate-500">
            LOGO
          </div>
        ) : null}
        <div className="min-w-0 text-white">
          <p className="truncate text-[10px] font-bold uppercase tracking-wide">{schoolName}</p>
          <p className="truncate text-[7px] opacity-90">{state.title}</p>
          <p className="truncate text-[6px] opacity-75">School Address · Phone · Website</p>
        </div>
      </div>

      <div
        className="absolute inset-x-0"
        style={{
          top: landscape ? "22%" : "18%",
          bottom: landscape ? "18%" : "22%",
          padding: `${state.marginTop}px ${state.marginRight}px ${state.marginBottom}px ${state.marginLeft}px`,
        }}
      >
        <div className={`flex h-full ${landscape ? "flex-row items-center gap-3" : "flex-col items-center gap-2 text-center"}`}>
          {state.showPhoto && hasField(fields, "photo") ? (
            <div
              className="grid shrink-0 place-items-center border-2 bg-slate-100 text-[9px] font-semibold text-slate-400"
              style={{
                width: landscape ? "28%" : "36%",
                aspectRatio: "3 / 4",
                borderColor: state.themeColor,
              }}
            >
              PHOTO
            </div>
          ) : null}
          <div className={`min-w-0 flex-1 ${landscape ? "text-left" : "text-center"}`}>
            {hasField(fields, "fullName") ? (
              <p className="truncate text-sm font-extrabold uppercase" style={{ color: state.themeColor }}>
                Arjun Sharma
              </p>
            ) : null}
            <div className="mt-1 space-y-0.5 text-[10px] text-slate-600">
              {hasField(fields, "admissionNo") ? <p>Admission No.: ADM/2025/0142</p> : null}
              {hasField(fields, "rollNumber") ? <p>Roll Number: 18</p> : null}
              {state.showClass && (hasField(fields, "className") || hasField(fields, "section")) ? (
                <p>
                  Class / Section:{" "}
                  {hasField(fields, "className") ? "Grade 8" : ""}
                  {hasField(fields, "className") && hasField(fields, "section") ? " - " : ""}
                  {hasField(fields, "section") ? "A" : ""}
                </p>
              ) : null}
              {hasField(fields, "dateOfBirth") ? <p>DOB: 12 Mar 2012</p> : null}
              {hasField(fields, "bloodGroup") ? <p>Blood Group: B+</p> : null}
              {hasField(fields, "phone") ? <p>Phone: +91 98765 43210</p> : null}
              {hasField(fields, "guardianName") ? <p>Guardian: Rakesh Sharma</p> : null}
              {hasField(fields, "address") ? <p className="truncate">Address: 21 Park Street</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3"
        style={{
          height: landscape ? "18%" : "22%",
          background: `linear-gradient(90deg, ${state.themeColor} 70%, ${state.accentColor} 70%)`,
          paddingBottom: state.marginBottom,
          paddingLeft: state.marginLeft,
          paddingRight: state.marginRight,
        }}
      >
        <div className="pb-1">
          {state.showBarcode && hasField(fields, "barcode") ? (
            <div>
              <div className="h-4 w-24 bg-[repeating-linear-gradient(90deg,#fff_0_1px,transparent_1px_3px)]" />
              <p className="mt-0.5 text-[7px] font-semibold text-white">ID-2025-0142</p>
            </div>
          ) : null}
          {hasField(fields, "qrCode") ? (
            <div className="mt-1 grid size-6 place-items-center bg-white text-[7px] text-slate-500">QR</div>
          ) : null}
        </div>
        <div className="pb-1 text-right">
          {hasField(fields, "signature") ? (
            <div>
              <div className="mb-0.5 h-5 border-b border-white/70 text-[8px] italic text-white/90">Signature</div>
              <p className="text-[7px] font-semibold text-white">Principal</p>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="absolute bottom-0 left-0 right-0 text-center text-[7px] font-bold uppercase tracking-wide text-slate-900"
        style={{ background: state.accentColor, padding: "2px 0" }}
      >
        Valid for Academic Year 2025-26
      </div>
    </div>
  );
}

export function IdCardDesignerPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "ID Card Designer";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["documents.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );
  const schoolName = user?.tenant?.name ?? "School Name";

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
  const [staffOpen, setStaffOpen] = useState(false);
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
      showBarcode: next.includes("barcode"),
      showClass: next.includes("className") || next.includes("section"),
    });
  }

  function applySize(sizeKey: DesignerState["sizeKey"]) {
    const preset = SIZE_PRESETS[sizeKey];
    patch({ sizeKey, orientation: preset.orientation });
  }

  function applyOrientation(orientation: "LANDSCAPE" | "PORTRAIT") {
    const sizeKey = orientation === "LANDSCAPE" ? "cr80-landscape" : "cr80-portrait";
    applySize(sizeKey);
  }

  function stateFromTemplate(template: Template): DesignerState {
    const config = template.config ?? {};
    const themeColor =
      typeof config.themeColor === "string" ? config.themeColor : THEME_PRESETS[0].themeColor;
    const accentColor =
      typeof config.accentColor === "string" ? config.accentColor : THEME_PRESETS[0].accentColor;
    const orientation =
      template.width >= template.height ? ("LANDSCAPE" as const) : ("PORTRAIT" as const);
    const sizeKey =
      orientation === "LANDSCAPE" ? ("cr80-landscape" as const) : ("cr80-portrait" as const);
    const enabledFields = Array.isArray(config.enabledFields)
      ? (config.enabledFields as FieldKey[])
      : [...DEFAULT_FIELDS];
    return {
      name: template.name,
      sizeKey,
      orientation,
      backgroundMode: template.backgroundUrl ? "IMAGE" : "COLOR",
      backgroundColor:
        typeof config.backgroundColor === "string" ? config.backgroundColor : "#FFFFFF",
      themeColor,
      accentColor,
      cornerRadius: Number(config.cornerRadius ?? 8),
      marginTop: Number(config.marginTop ?? 5),
      marginBottom: Number(config.marginBottom ?? 5),
      marginLeft: Number(config.marginLeft ?? 5),
      marginRight: Number(config.marginRight ?? 5),
      zoom: 100,
      enabledFields,
      title: typeof config.title === "string" ? config.title : "STUDENT IDENTITY CARD",
      showPhoto: config.showPhoto !== false,
      showBarcode: config.showBarcode !== false,
      showClass: config.showClass !== false,
      backgroundUrl: template.backgroundUrl,
    };
  }

  function buildConfig() {
    const preset = SIZE_PRESETS[state.sizeKey];
    return {
      name: state.name,
      width: preset.width,
      height: preset.height,
      backgroundUrl: state.backgroundMode === "IMAGE" ? state.backgroundUrl : null,
      config: {
        title: state.title,
        showPhoto: state.showPhoto && hasField(state.enabledFields, "photo"),
        showBarcode: state.showBarcode && hasField(state.enabledFields, "barcode"),
        showClass: state.showClass,
        backgroundColor: state.backgroundColor,
        pageSize: preset.label,
        themeColor: state.themeColor,
        accentColor: state.accentColor,
        cornerRadius: state.cornerRadius,
        marginTop: state.marginTop,
        marginBottom: state.marginBottom,
        marginLeft: state.marginLeft,
        marginRight: state.marginRight,
        orientation: state.orientation,
        enabledFields: state.enabledFields,
        designer: "erp-id-card",
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
        "/documents/templates?type=ID_CARD",
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
      notifyError(cause instanceof Error ? cause.message : "Unable to load ID card templates");
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
    const payload = buildConfig();
    if (!payload.name.trim()) {
      notifyError("Card name is required");
      return;
    }
    setSaving(true);
    try {
      if (selectedId) {
        const updated = await apiRequest<Template>(`/documents/templates/${selectedId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setTemplates((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedId(updated.id);
        notifySuccess("ID card template saved");
      } else {
        const created = await apiRequest<Template>("/documents/templates", accessToken, {
          method: "POST",
          body: JSON.stringify({ type: "ID_CARD", ...payload }),
        });
        setTemplates((prev) => [created, ...prev]);
        setSelectedId(created.id);
        notifySuccess("ID card template created");
      }
      setHistory([]);
      setFuture([]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function createFromTheme(theme: (typeof THEME_PRESETS)[number]) {
    if (!canManage) {
      setState(defaultState(theme));
      setSelectedId(null);
      setStep(2);
      return;
    }
    setState(defaultState(theme));
    setSelectedId(null);
    setStep(2);
    setHistory([]);
    setFuture([]);
  }

  function selectTemplate(template: Template) {
    setSelectedId(template.id);
    setState(stateFromTemplate(template));
    setHistory([]);
    setFuture([]);
    setStep(2);
  }

  const toolbarItems = useMemo(
    () =>
      [
        { label: "Add Text", icon: <TextFieldsOutlined className="!text-[16px]" />, field: "fullName" as FieldKey },
        { label: "Add Image", icon: <ImageOutlined className="!text-[16px]" />, field: "photo" as FieldKey },
        { label: "Add Shape", icon: <ShapeLineOutlined className="!text-[16px]" />, field: null },
        { label: "Barcode", icon: <ViewWeekOutlined className="!text-[16px]" />, field: "barcode" as FieldKey },
        { label: "QR Code", icon: <QrCode2Outlined className="!text-[16px]" />, field: "qrCode" as FieldKey },
        { label: "Line", icon: <LineWeightOutlined className="!text-[16px]" />, field: null },
        { label: "Upload Logo", icon: <UploadOutlined className="!text-[16px]" />, field: "logo" as FieldKey },
      ] as const,
    [],
  );

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading ID card designer…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">ID Card Designer</h1>
          <p className="text-xs text-[#6B7280]">
            Design student and staff ID cards with fields, branding, and print-ready layouts.
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
            { id: 2 as const, label: "2. Design Card" },
            { id: 3 as const, label: "3. Card Settings" },
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
                    <IdCardPreview
                      state={stateFromTemplate(template)}
                      schoolName={schoolName}
                      compact
                    />
                  </div>
                  <p className="truncate text-sm font-semibold text-[#1A1A1A]">{template.name}</p>
                  <p className="text-xs text-[#6B7280]">
                    {template.width >= template.height ? "Landscape" : "Portrait"}
                  </p>
                </button>
              ))}
              {THEME_PRESETS.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => void createFromTheme(theme)}
                  className="rounded-xl border border-dashed border-[#C7D2FE] bg-[#F8FAFC] p-3 text-left hover:border-primary"
                >
                  <div className="mb-2 flex justify-center">
                    <IdCardPreview state={defaultState(theme)} schoolName={schoolName} compact />
                  </div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{theme.name}</p>
                  <p className="text-xs text-[#6B7280]">Start from {theme.key} theme</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setState(defaultState());
                  setStep(2);
                }}
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
            <div className="flex flex-wrap gap-2 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
              {toolbarItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    if (item.field) toggleField(item.field);
                    else notifySuccess(`${item.label} is available as a layout accent on save`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40"
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
              <Card title="Field Variables">
                <button
                  type="button"
                  className="mb-2 flex w-full items-center justify-between text-left text-sm font-semibold text-[#1A1A1A]"
                  onClick={() => setStudentOpen((v) => !v)}
                >
                  Student Fields
                  <span className="text-xs text-[#6B7280]">{studentOpen ? "−" : "+"}</span>
                </button>
                {studentOpen ? (
                  <div className="mb-3 space-y-1">
                    {STUDENT_FIELDS.map((field) => {
                      const active = hasField(state.enabledFields, field.key);
                      return (
                        <button
                          key={field.key}
                          type="button"
                          disabled={!canManage}
                          onClick={() => toggleField(field.key)}
                          className={[
                            "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium",
                            active
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          <PersonOutlined className="!text-[14px]" />
                          {field.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="mb-2 flex w-full items-center justify-between text-left text-sm font-semibold text-[#1A1A1A]"
                  onClick={() => setStaffOpen((v) => !v)}
                >
                  Staff Fields
                  <span className="text-xs text-[#6B7280]">{staffOpen ? "−" : "+"}</span>
                </button>
                {staffOpen ? (
                  <p className="mb-3 text-xs text-[#6B7280]">
                    Staff ID layouts reuse the same designer. Generate for staff from Documents.
                  </p>
                ) : null}

                <button
                  type="button"
                  className="mb-2 flex w-full items-center justify-between text-left text-sm font-semibold text-[#1A1A1A]"
                  onClick={() => setOtherOpen((v) => !v)}
                >
                  Other Fields
                  <span className="text-xs text-[#6B7280]">{otherOpen ? "−" : "+"}</span>
                </button>
                {otherOpen ? (
                  <div className="space-y-1">
                    {OTHER_FIELDS.map((field) => {
                      const active = hasField(state.enabledFields, field.key);
                      return (
                        <button
                          key={field.key}
                          type="button"
                          disabled={!canManage}
                          onClick={() => toggleField(field.key)}
                          className={[
                            "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-medium",
                            active
                              ? "border-primary bg-[#F5F3FF] text-primary"
                              : "border-[#E5E7EB] text-[#374151]",
                          ].join(" ")}
                        >
                          <InsertDriveFileOutlined className="!text-[14px]" />
                          {field.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </Card>

              <Card
                title="Design Canvas"
                actions={
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={undo} className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]" title="Undo">
                      <UndoOutlined className="!text-[18px]" />
                    </button>
                    <button type="button" onClick={redo} className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]" title="Redo">
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
                <div className="flex min-h-[360px] items-center justify-center rounded-lg bg-[#EEF2FF]/10] p-4">
                  <IdCardPreview state={state} schoolName={schoolName} />
                </div>
              </Card>

              <Card title={step === 3 ? "Card Settings" : "Card Properties"}>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Card Name</span>
                    <input
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-primary"
                      value={state.name}
                      disabled={!canManage}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Card Size</span>
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
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Orientation</span>
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
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Background</span>
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
                        placeholder="https://... or data:image/..."
                        onChange={(e) => patch({ backgroundUrl: e.target.value || null })}
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Theme Color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={state.themeColor}
                        disabled={!canManage}
                        onChange={(e) => patch({ themeColor: e.target.value })}
                      />
                      <input
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm uppercase outline-none focus:border-primary"
                        value={state.themeColor}
                        disabled={!canManage}
                        onChange={(e) => patch({ themeColor: e.target.value })}
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                      Corner Radius
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={24}
                        value={state.cornerRadius}
                        disabled={!canManage}
                        onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
                        className="flex-1"
                      />
                      <span className="w-12 text-right text-xs font-semibold text-[#374151]">
                        {state.cornerRadius} px
                      </span>
                    </div>
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
                            max={20}
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
                  "w-44 shrink-0 rounded-xl border p-2 text-left",
                  selectedId === template.id
                    ? "border-primary bg-[#F5F3FF]"
                    : "border-[#E5E7EB] bg-white",
                ].join(" ")}
              >
                <div className="mb-2 flex justify-center">
                  <IdCardPreview
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
                onClick={() => void createFromTheme(theme)}
                className="w-44 shrink-0 rounded-xl border border-[#E5E7EB] bg-white p-2 text-left"
              >
                <div className="mb-2 flex justify-center">
                  <IdCardPreview state={defaultState(theme)} schoolName={schoolName} compact />
                </div>
                <p className="truncate text-xs font-semibold text-[#1A1A1A]">{theme.name}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setState(defaultState());
                setStep(2);
              }}
              className="flex w-44 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280]"
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
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
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
              <IdCardPreview state={{ ...state, zoom: 120 }} schoolName={schoolName} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
