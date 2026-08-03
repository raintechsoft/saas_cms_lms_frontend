import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  AssessmentOutlined,
  BadgeOutlined,
  BookOutlined,
  CakeOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  CancelOutlined,
  Diversity3Outlined,
  DownloadOutlined,
  EmojiEventsOutlined,
  EventBusyOutlined,
  ExpandLessOutlined,
  ExpandMoreOutlined,
  FamilyRestroomOutlined,
  FemaleOutlined,
  FilterAltOutlined,
  GroupsOutlined,
  HistoryOutlined,
  HowToRegOutlined,
  LocalAtmOutlined,
  LoginOutlined,
  MenuBookOutlined,
  PercentOutlined,
  PaymentsOutlined,
  PersonSearchOutlined,
  PlayArrowOutlined,
  ReceiptLongOutlined,
  SchoolOutlined,
  SummarizeOutlined,
  SupervisorAccountOutlined,
  TableViewOutlined,
  TodayOutlined,
  WarningAmberOutlined,
  WorkOutline,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type CoreReportKey =
  | "active_students"
  | "due_fees"
  | "fee_collection"
  | "daily_attendance"
  | "attendance_summary"
  | "exam_rank";

type ReportModule =
  | "students"
  | "finance"
  | "attendance"
  | "examinations"
  | "timetable"
  | "homework"
  | "hr"
  | "audit";

interface Hub {
  currentSession: { id: string; name: string } | null;
  exams: Array<{ id: string; name: string; status: string; examGroup: { name: string } }>;
  coreReports: Array<{
    key: CoreReportKey;
    label: string;
    description: string;
    bucket: "SHARED" | "CMS";
    needsExam?: boolean;
  }>;
  studentReports?: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  feeReports?: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  modules: Array<{ key: ReportModule; label: string; metrics: Record<string, string | number | null> }>;
}

interface CoreReportResult {
  reportKey: string;
  title: string;
  session: { id: string; name: string } | null;
  summary: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  exam?: { id: string; name: string; status: string };
}

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

const HIDDEN_COLUMNS = new Set(["id", "studentId", "examStudentId"]);

function csvEscape(value: unknown) {
  if (value == null) return "";
  let text = "";
  if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else if (Array.isArray(value)) text = value.join("; ");
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCoreReportCsv(data: CoreReportResult) {
  const columns = data.rows[0]
    ? Object.keys(data.rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key))
    : [];

  if (!columns.length && !Object.keys(data.summary ?? {}).length) {
    notifyError("No rows available to download");
    return;
  }

  const lines: string[] = [];
  if (columns.length) {
    lines.push(columns.map((key) => csvEscape(key)).join(","));
    for (const row of data.rows) {
      lines.push(columns.map((key) => csvEscape(row[key])).join(","));
    }
  } else {
    lines.push("metric,value");
    for (const [key, value] of Object.entries(data.summary ?? {})) {
      if (typeof value === "object") continue;
      lines.push(`${csvEscape(key)},${csvEscape(value)}`);
    }
  }

  // BOM helps Excel open UTF-8 CSV correctly
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeTitle = (data.title || data.reportKey || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${safeTitle || "report"}-${stamp}.csv`;

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Keep URL briefly so Electron / slow browsers can finish the download
    window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    notifySuccess("CSV downloaded");
  } catch (error) {
    URL.revokeObjectURL(url);
    notifyError(error instanceof Error ? error.message : "Unable to download CSV");
  }
}

const REPORT_CARD_STYLE: Record<
  CoreReportKey,
  {
    icon: ComponentType<{ sx?: object }>;
    iconWrap: string;
    card: string;
    selected: string;
    badge: string;
  }
> = {
  active_students: {
    icon: GroupsOutlined,
    iconWrap: "bg-sky-100 text-sky-700",
    card: "border-sky-200 bg-gradient-to-br from-sky-50 to-white hover:border-sky-300",
    selected: "border-sky-400 ring-2 ring-sky-100",
    badge: "bg-sky-100 text-sky-700",
  },
  due_fees: {
    icon: AccountBalanceWalletOutlined,
    iconWrap: "bg-rose-100 text-rose-700",
    card: "border-rose-200 bg-gradient-to-br from-rose-50 to-white hover:border-rose-300",
    selected: "border-rose-400 ring-2 ring-rose-100",
    badge: "bg-rose-100 text-rose-700",
  },
  fee_collection: {
    icon: PaymentsOutlined,
    iconWrap: "bg-emerald-100 text-emerald-700",
    card: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300",
    selected: "border-emerald-400 ring-2 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  daily_attendance: {
    icon: TodayOutlined,
    iconWrap: "bg-amber-100 text-amber-700",
    card: "border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300",
    selected: "border-amber-400 ring-2 ring-amber-100",
    badge: "bg-amber-100 text-amber-800",
  },
  attendance_summary: {
    icon: SummarizeOutlined,
    iconWrap: "bg-violet-100 text-violet-700",
    card: "border-violet-200 bg-gradient-to-br from-violet-50 to-white hover:border-violet-300",
    selected: "border-violet-400 ring-2 ring-violet-100",
    badge: "bg-violet-100 text-violet-700",
  },
  exam_rank: {
    icon: EmojiEventsOutlined,
    iconWrap: "bg-indigo-100 text-indigo-700",
    card: "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300",
    selected: "border-indigo-400 ring-2 ring-indigo-100",
    badge: "bg-indigo-100 text-indigo-700",
  },
};

const STUDENT_REPORT_STYLE: Record<
  string,
  { icon: ComponentType<{ sx?: object }>; tone: string }
> = {
  new_admissions: { icon: HowToRegOutlined, tone: "bg-emerald-100 text-emerald-700" },
  old_admissions: { icon: HistoryOutlined, tone: "bg-amber-100 text-amber-800" },
  active_students: { icon: GroupsOutlined, tone: "bg-sky-100 text-sky-700" },
  disabled_students: { icon: CancelOutlined, tone: "bg-rose-100 text-rose-700" },
  alumni_students: { icon: SchoolOutlined, tone: "bg-violet-100 text-violet-700" },
  student_history: { icon: SummarizeOutlined, tone: "bg-slate-200 text-slate-700" },
  student_login_status: { icon: LoginOutlined, tone: "bg-cyan-100 text-cyan-700" },
  student_profile: { icon: BadgeOutlined, tone: "bg-indigo-100 text-indigo-700" },
  student_gender: { icon: FemaleOutlined, tone: "bg-fuchsia-100 text-fuchsia-700" },
  student_birthday: { icon: CakeOutlined, tone: "bg-pink-100 text-pink-700" },
  student_siblings: { icon: Diversity3Outlined, tone: "bg-teal-100 text-teal-700" },
  student_guardian: { icon: FamilyRestroomOutlined, tone: "bg-orange-100 text-orange-700" },
  student_teacher: { icon: SupervisorAccountOutlined, tone: "bg-lime-100 text-lime-800" },
  online_admissions: { icon: PersonSearchOutlined, tone: "bg-blue-100 text-blue-700" },
  at_school_admissions: { icon: SchoolOutlined, tone: "bg-emerald-100 text-emerald-800" },
};

const STUDENT_REPORT_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Admissions",
    keys: ["new_admissions", "old_admissions", "online_admissions", "at_school_admissions"],
  },
  {
    title: "Status & access",
    keys: ["active_students", "disabled_students", "alumni_students", "student_login_status"],
  },
  {
    title: "Profile & analytics",
    keys: ["student_profile", "student_history", "student_gender", "student_birthday"],
  },
  {
    title: "Family & teachers",
    keys: ["student_siblings", "student_guardian", "student_teacher"],
  },
];

const FEE_REPORT_STYLE: Record<string, { icon: ComponentType<{ sx?: object }>; tone: string }> = {
  due_fees: { icon: AccountBalanceWalletOutlined, tone: "bg-rose-100 text-rose-700" },
  fee_collection: { icon: PaymentsOutlined, tone: "bg-emerald-100 text-emerald-700" },
  fee_master: { icon: MenuBookOutlined, tone: "bg-indigo-100 text-indigo-700" },
  fee_assigned: { icon: HowToRegOutlined, tone: "bg-sky-100 text-sky-700" },
  fee_summary: { icon: SummarizeOutlined, tone: "bg-violet-100 text-violet-700" },
  day_book: { icon: BookOutlined, tone: "bg-amber-100 text-amber-800" },
  till_date_due: { icon: TodayOutlined, tone: "bg-orange-100 text-orange-700" },
  balance_fee: { icon: LocalAtmOutlined, tone: "bg-rose-100 text-rose-800" },
  parents_wise_due: { icon: FamilyRestroomOutlined, tone: "bg-teal-100 text-teal-700" },
  students_wise_fee: { icon: GroupsOutlined, tone: "bg-cyan-100 text-cyan-700" },
  fine_report: { icon: WarningAmberOutlined, tone: "bg-amber-100 text-amber-800" },
  discount_report: { icon: PercentOutlined, tone: "bg-fuchsia-100 text-fuchsia-700" },
  online_fee: { icon: ReceiptLongOutlined, tone: "bg-blue-100 text-blue-700" },
  daily_fees_collection: { icon: CalendarMonthOutlined, tone: "bg-emerald-100 text-emerald-800" },
};

const FEE_REPORT_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "Dues & balances",
    keys: ["due_fees", "till_date_due", "balance_fee", "parents_wise_due"],
  },
  {
    title: "Collection",
    keys: ["fee_collection", "daily_fees_collection", "day_book", "online_fee"],
  },
  {
    title: "Structure & assignment",
    keys: ["fee_master", "fee_assigned", "fee_summary", "students_wise_fee"],
  },
  {
    title: "Adjustments",
    keys: ["fine_report", "discount_report"],
  },
];

const MODULE_CARD_STYLE: Record<
  ReportModule,
  { icon: ComponentType<{ sx?: object }>; wrap: string; card: string }
> = {
  students: { icon: GroupsOutlined, wrap: "bg-sky-100 text-sky-700", card: "border-sky-200 bg-sky-50/70" },
  finance: { icon: PaymentsOutlined, wrap: "bg-emerald-100 text-emerald-700", card: "border-emerald-200 bg-emerald-50/70" },
  attendance: { icon: TodayOutlined, wrap: "bg-amber-100 text-amber-700", card: "border-amber-200 bg-amber-50/70" },
  examinations: { icon: EmojiEventsOutlined, wrap: "bg-indigo-100 text-indigo-700", card: "border-indigo-200 bg-indigo-50/70" },
  timetable: { icon: CalendarMonthOutlined, wrap: "bg-cyan-100 text-cyan-700", card: "border-cyan-200 bg-cyan-50/70" },
  homework: { icon: MenuBookOutlined, wrap: "bg-fuchsia-100 text-fuchsia-700", card: "border-fuchsia-200 bg-fuchsia-50/70" },
  hr: { icon: WorkOutline, wrap: "bg-slate-200 text-slate-700", card: "border-slate-200 bg-slate-50" },
  audit: { icon: HistoryOutlined, wrap: "bg-orange-100 text-orange-700", card: "border-orange-200 bg-orange-50/70" },
};

function summaryTone(key: string) {
  const k = key.toUpperCase();
  if (k.includes("PRESENT") || k.includes("PASS") || k.includes("COLLECTED") || k === "TOTAL") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (k.includes("ABSENT") || k.includes("FAIL") || k.includes("DUE") || k.includes("OUTSTANDING")) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (k.includes("LATE") || k.includes("HALF")) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (k.includes("HOLIDAY") || k.includes("STUDENTS") || k.includes("PAYMENTS")) {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusPill(value: string): ReactNode {
  const v = value.toUpperCase();
  if (v === "PRESENT" || v === "PASS" || v === "ACTIVE" || v === "PAID" || v === "COLLECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <CheckCircleOutline sx={{ fontSize: 14 }} />
        {value}
      </span>
    );
  }
  if (v === "ABSENT" || v === "FAIL" || v === "DISABLED" || v === "OVERDUE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
        <CancelOutlined sx={{ fontSize: 14 }} />
        {value}
      </span>
    );
  }
  if (v === "LATE" || v === "HALF_DAY" || v === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
        <WarningAmberOutlined sx={{ fontSize: 14 }} />
        {value}
      </span>
    );
  }
  if (v === "HOLIDAY" || v === "ALUMNI") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
        <EventBusyOutlined sx={{ fontSize: 14 }} />
        {value}
      </span>
    );
  }
  return <span className="font-medium text-slate-700">{value}</span>;
}

export function ReportsPage() {
  const { accessToken } = useAuth();
  const [hub, setHub] = useState<Hub | null>(null);
  const [tab, setTab] = useState<"core" | "students" | "fees" | "modules">("core");
  const [selectedCore, setSelectedCore] = useState<CoreReportKey>("active_students");
  const [filters, setFilters] = useState({
    from: monthStart,
    to: today,
    examId: "",
  });
  const [coreData, setCoreData] = useState<CoreReportResult | null>(null);
  const [selectedStudentReport, setSelectedStudentReport] = useState<string | null>(null);
  const [selectedFeeReport, setSelectedFeeReport] = useState<string | null>(null);
  const [module, setModule] = useState<ReportModule | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiRequest<Hub>("/reports", accessToken)
      .then((data) => {
        setHub(data);
        if (data.coreReports.length) setSelectedCore(data.coreReports[0]!.key);
        if (data.exams.length) setFilters((prev) => ({ ...prev, examId: data.exams[0]!.id }));
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof Error ? cause.message : "Unable to load report hub");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!coreData || tab === "modules") return;
    setCatalogOpen(false);
    const timer = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [coreData, tab]);

  const selectedMeta = useMemo(
    () => hub?.coreReports.find((item) => item.key === selectedCore) ?? null,
    [hub, selectedCore],
  );

  const studentReportMap = useMemo(() => {
    const map = new Map<string, { key: string; label: string; description: string }>();
    for (const item of hub?.studentReports ?? []) map.set(item.key, item);
    return map;
  }, [hub?.studentReports]);

  const feeReportMap = useMemo(() => {
    const map = new Map<string, { key: string; label: string; description: string }>();
    for (const item of hub?.feeReports ?? []) map.set(item.key, item);
    return map;
  }, [hub?.feeReports]);

  async function runCore(reportKey = selectedCore) {
    setLoading(true);
    setModule(null);
    setModuleData(null);
    setSelectedStudentReport(null);
    setSelectedFeeReport(null);
    setSelectedCore(reportKey);
    setTab("core");
    try {
      const query = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      });
      if (hub?.currentSession) query.set("sessionId", hub.currentSession.id);
      if (reportKey === "exam_rank") {
        if (!filters.examId) {
          notifyError("Select an exam for rank report");
          return;
        }
        query.set("examId", filters.examId);
      }
      const data = await apiRequest<CoreReportResult>(
        `/reports/core/${reportKey}?${query}`,
        accessToken,
      );
      setCoreData(data);
      notifySuccess(`${data.title} ready`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function runStudentReport(reportKey: string) {
    setLoading(true);
    setModule(null);
    setModuleData(null);
    setSelectedFeeReport(null);
    setSelectedStudentReport(reportKey);
    setTab("students");
    try {
      const query = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      });
      if (hub?.currentSession) query.set("sessionId", hub.currentSession.id);
      const data = await apiRequest<CoreReportResult>(
        `/reports/student/${reportKey}?${query}`,
        accessToken,
      );
      setCoreData(data);
      notifySuccess(`${data.title} ready`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate student report");
    } finally {
      setLoading(false);
    }
  }

  async function runFeeReport(reportKey: string) {
    setLoading(true);
    setModule(null);
    setModuleData(null);
    setSelectedStudentReport(null);
    setSelectedFeeReport(reportKey);
    setTab("fees");
    try {
      const query = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      });
      if (hub?.currentSession) query.set("sessionId", hub.currentSession.id);
      const data = await apiRequest<CoreReportResult>(
        `/reports/fee/${reportKey}?${query}`,
        accessToken,
      );
      setCoreData(data);
      notifySuccess(`${data.title} ready`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate fee report");
    } finally {
      setLoading(false);
    }
  }

  async function runModule(selected: ReportModule) {
    setLoading(true);
    setCoreData(null);
    setSelectedStudentReport(null);
    setSelectedFeeReport(null);
    setModule(selected);
    setTab("modules");
    try {
      const query = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        includeDisabled: "false",
      });
      if (hub?.currentSession) query.set("sessionId", hub.currentSession.id);
      setModuleData(await apiRequest(`/reports/${selected}?${query}`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate module report");
    } finally {
      setLoading(false);
    }
  }

  function runSelected() {
    if (tab === "students") {
      if (!selectedStudentReport) {
        notifyError("Select a student report first");
        return;
      }
      void runStudentReport(selectedStudentReport);
      return;
    }
    if (tab === "fees") {
      if (!selectedFeeReport) {
        notifyError("Select a fee report first");
        return;
      }
      void runFeeReport(selectedFeeReport);
      return;
    }
    if (tab === "modules") {
      if (!module) {
        notifyError("Select a module report first");
        return;
      }
      void runModule(module);
      return;
    }
    void runCore();
  }

  type ReportsTab = "core" | "students" | "fees" | "modules";

  const reportTabItems = useMemo((): Array<CmsIconTabItem<ReportsTab>> => {
    const items: Array<CmsIconTabItem<ReportsTab>> = [
      {
        key: "core",
        label: "Core reports",
        icon: AssessmentOutlined,
        tone: "indigo",
        badge: (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
            {hub?.coreReports.length ?? 0}
          </span>
        ),
      },
    ];
    if ((hub?.studentReports?.length ?? 0) > 0) {
      items.push({
        key: "students",
        label: "Student reports",
        icon: GroupsOutlined,
        tone: "sky",
        badge: (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
            {hub?.studentReports?.length ?? 0}
          </span>
        ),
      });
    }
    if ((hub?.feeReports?.length ?? 0) > 0) {
      items.push({
        key: "fees",
        label: "Fee reports",
        icon: PaymentsOutlined,
        tone: "emerald",
        badge: (
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
            {hub?.feeReports?.length ?? 0}
          </span>
        ),
      });
    }
    items.push({
      key: "modules",
      label: "Module dumps",
      icon: TableViewOutlined,
      tone: "violet",
      badge: (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
          {hub?.modules.length ?? 0}
        </span>
      ),
    });
    return items;
  }, [hub]);

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Data reports"
        title="School reports"
        description="Pick a report, set filters, then run. Results open above the list with download."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {coreData && (coreData.rows?.length || Object.keys(coreData.summary ?? {}).length) ? (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                type="button"
                onClick={() => downloadCoreReportCsv(coreData)}
              >
                <DownloadOutlined sx={{ fontSize: 18 }} />
                Download CSV
              </button>
            ) : null}
            <button className="button-secondary" type="button" onClick={() => window.print()}>
              Print
            </button>
          </div>
        }
      />

      <div className="page-scroll">
        <CmsIconTabs
          ariaLabel="Report categories"
          value={tab}
          onChange={(key) => {
            setTab(key);
            setCatalogOpen(true);
          }}
          columnsClass="grid-cols-2 sm:grid-cols-4"
          items={reportTabItems}
        />

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <FilterAltOutlined sx={{ fontSize: 18 }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Filters</p>
                <p className="text-xs text-slate-500">
                  {hub?.currentSession ? `Session: ${hub.currentSession.name}` : "No current session set"}
                </p>
              </div>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
              type="button"
              disabled={loading}
              onClick={runSelected}
            >
              <PlayArrowOutlined sx={{ fontSize: 18 }} />
              {loading ? "Running…" : "Run selected"}
            </button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              From
              <input
                className="input mt-1"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              To
              <input
                className="input mt-1"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Exam (core rank only)
              <select
                className="input mt-1"
                value={filters.examId}
                onChange={(e) => setFilters({ ...filters, examId: e.target.value })}
              >
                <option value="">Select exam</option>
                {(hub?.exams ?? []).map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.examGroup.name} · {exam.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {coreData && tab !== "modules" ? (
          <div ref={resultsRef} className="scroll-mt-4">
            <CoreReportView
              data={coreData}
              metaLabel={
                selectedFeeReport
                  ? hub?.feeReports?.find((r) => r.key === selectedFeeReport)?.label
                  : selectedStudentReport
                    ? hub?.studentReports?.find((r) => r.key === selectedStudentReport)?.label
                    : selectedMeta?.label
              }
            />
          </div>
        ) : null}

        {tab !== "modules" ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
              onClick={() => setCatalogOpen((open) => !open)}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {tab === "students"
                    ? "Choose student report"
                    : tab === "fees"
                      ? "Choose fee report"
                      : "Choose core report"}
                </p>
                <p className="text-xs text-slate-500">
                  {coreData
                    ? catalogOpen
                      ? "Pick another report, or collapse this list"
                      : "Report ready above — expand to pick another"
                    : "Select a report to run"}
                </p>
              </div>
              {catalogOpen ? (
                <ExpandLessOutlined className="text-slate-500" />
              ) : (
                <ExpandMoreOutlined className="text-slate-500" />
              )}
            </button>

            {catalogOpen ? (
              <div className="border-t border-slate-100">
                {tab === "core" ? (
                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(hub?.coreReports ?? []).map((item) => {
                      const style = REPORT_CARD_STYLE[item.key];
                      const Icon = style.icon;
                      const isSelected =
                        selectedCore === item.key &&
                        Boolean(coreData) &&
                        !selectedStudentReport &&
                        !selectedFeeReport;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => void runCore(item.key)}
                          className={`rounded-2xl border bg-white p-4 text-left transition hover:border-slate-300 ${
                            isSelected
                              ? "border-indigo-400 ring-2 ring-indigo-100"
                              : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}
                            >
                              <Icon sx={{ fontSize: 20 }} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                              {item.needsExam ? (
                                <span className="mt-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                  Needs exam
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {tab === "students" ? (
                  <div className="grid gap-0 lg:grid-cols-2">
                    {STUDENT_REPORT_GROUPS.map((group) => {
                      const rows = group.keys
                        .map((key) => studentReportMap.get(key))
                        .filter(Boolean) as Array<{
                        key: string;
                        label: string;
                        description: string;
                      }>;
                      if (!rows.length) return null;
                      return (
                        <div
                          key={group.title}
                          className="border-b border-slate-100 lg:[&:nth-child(odd)]:border-r"
                        >
                          <div className="bg-slate-50 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            {group.title}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {rows.map((item) => {
                              const style = STUDENT_REPORT_STYLE[item.key] ?? {
                                icon: AssessmentOutlined,
                                tone: "bg-slate-100 text-slate-600",
                              };
                              const Icon = style.icon;
                              const isSelected =
                                selectedStudentReport === item.key && Boolean(coreData);
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => void runStudentReport(item.key)}
                                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 ${
                                    isSelected ? "bg-indigo-50/70" : "bg-white"
                                  }`}
                                >
                                  <span
                                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${style.tone}`}
                                  >
                                    <Icon sx={{ fontSize: 18 }} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-900">
                                      {item.label.replace(/ Report$/i, "")}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {item.description}
                                    </span>
                                  </span>
                                  {isSelected ? (
                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                                      Active
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {tab === "fees" ? (
                  <div className="grid gap-0 lg:grid-cols-2">
                    {FEE_REPORT_GROUPS.map((group) => {
                      const rows = group.keys
                        .map((key) => feeReportMap.get(key))
                        .filter(Boolean) as Array<{
                        key: string;
                        label: string;
                        description: string;
                      }>;
                      if (!rows.length) return null;
                      return (
                        <div
                          key={group.title}
                          className="border-b border-slate-100 lg:[&:nth-child(odd)]:border-r"
                        >
                          <div className="bg-slate-50 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            {group.title}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {rows.map((item) => {
                              const style = FEE_REPORT_STYLE[item.key] ?? {
                                icon: AssessmentOutlined,
                                tone: "bg-slate-100 text-slate-600",
                              };
                              const Icon = style.icon;
                              const isSelected =
                                selectedFeeReport === item.key && Boolean(coreData);
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => void runFeeReport(item.key)}
                                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 ${
                                    isSelected ? "bg-indigo-50/70" : "bg-white"
                                  }`}
                                >
                                  <span
                                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${style.tone}`}
                                  >
                                    <Icon sx={{ fontSize: 18 }} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-slate-900">
                                      {item.label.replace(/ Report$/i, "")}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {item.description}
                                    </span>
                                  </span>
                                  {isSelected ? (
                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                                      Active
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "modules" ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Module dumps</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Raw module extracts for deeper data pulls.
              </p>
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
              {(hub?.modules ?? []).map((item) => {
                const style = MODULE_CARD_STYLE[item.key];
                const Icon = style.icon;
                const active = module === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                    onClick={() => void runModule(item.key)}
                  >
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-lg ${style.wrap}`}
                    >
                      <Icon sx={{ fontSize: 18 }} />
                    </span>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  </button>
                );
              })}
            </div>
            {module && moduleData ? <ModuleDump module={module} data={moduleData} /> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function CoreReportView({ data, metaLabel }: { data: CoreReportResult; metaLabel?: string }) {
  const coreStyle = REPORT_CARD_STYLE[data.reportKey as CoreReportKey];
  const studentStyle = STUDENT_REPORT_STYLE[data.reportKey];
  const feeStyle = FEE_REPORT_STYLE[data.reportKey];
  const Icon = coreStyle?.icon ?? studentStyle?.icon ?? feeStyle?.icon ?? AssessmentOutlined;
  const iconWrap =
    coreStyle?.iconWrap ?? studentStyle?.tone ?? feeStyle?.tone ?? "bg-slate-100 text-slate-700";
  const headerTone = coreStyle?.card ?? "border-slate-100 bg-slate-50";
  const summaryEntries = Object.entries(data.summary ?? {}).filter(
    ([, value]) => typeof value !== "object",
  );
  const columns = data.rows[0]
    ? Object.keys(data.rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key))
    : [];
  const canDownload = Boolean(columns.length || summaryEntries.length);

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-md">
      <div
        className={`sticky top-0 z-20 flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 backdrop-blur ${headerTone}`}
      >
        <div className="flex items-start gap-3">
          <span className={`inline-flex size-11 items-center justify-center rounded-xl ${iconWrap}`}>
            <Icon sx={{ fontSize: 22 }} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{data.title}</h2>
            <p className="text-sm text-slate-600">
              {metaLabel ?? data.reportKey}
              {data.session ? ` · ${data.session.name}` : ""}
              {data.exam ? ` · ${data.exam.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            {summaryEntries.map(([key, value]) => (
              <span
                key={key}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${summaryTone(key)}`}
              >
                <span className="mr-1 uppercase tracking-wide opacity-70">{key}</span>
                <strong>{String(value)}</strong>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
            disabled={!canDownload}
            onClick={() => downloadCoreReportCsv(data)}
          >
            <DownloadOutlined sx={{ fontSize: 18 }} />
            Download CSV
          </button>
        </div>
      </div>

      {!data.rows.length ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No rows for this report with the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((key) => (
                  <th key={key} className="px-4 py-3 font-semibold">
                    {key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row, index) => (
                <tr key={String(row.id ?? row.admissionNumber ?? index)} className="hover:bg-slate-50/80">
                  {columns.map((key) => (
                    <td key={`${index}-${key}`} className="px-4 py-3 text-slate-700">
                      {renderCell(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function renderCell(key: string, value: unknown): ReactNode {
  if (value == null) return "—";
  if (key.toLowerCase().includes("status") || key === "passStatus") {
    return statusPill(String(value));
  }
  if (typeof value === "number") {
    if (key.toLowerCase().includes("balance") || key.toLowerCase().includes("amount") || key === "collected") {
      return <span className="font-semibold text-slate-900">₹{value.toLocaleString()}</span>;
    }
    if (key.toLowerCase().includes("percentage")) {
      return <span className="font-semibold text-indigo-700">{value}%</span>;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ModuleDump({ module, data }: { module: ReportModule; data: unknown }) {
  const style = MODULE_CARD_STYLE[module];
  const Icon = style.icon;
  return (
    <div className="border-t border-slate-100 p-5">
      <div className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 ${style.card}`}>
        <span className={`inline-flex size-8 items-center justify-center rounded-lg ${style.wrap}`}>
          <Icon sx={{ fontSize: 16 }} />
        </span>
        <p className="font-semibold capitalize text-slate-900">{module} module report</p>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
