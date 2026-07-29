import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  AssessmentOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  CancelOutlined,
  DownloadOutlined,
  EmojiEventsOutlined,
  EventBusyOutlined,
  FilterAltOutlined,
  GroupsOutlined,
  HistoryOutlined,
  MenuBookOutlined,
  PaymentsOutlined,
  PlayArrowOutlined,
  SummarizeOutlined,
  TodayOutlined,
  WarningAmberOutlined,
  WorkOutline,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
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
  modules: Array<{ key: ReportModule; label: string; metrics: Record<string, string | number | null> }>;
}

interface CoreReportResult {
  reportKey: CoreReportKey;
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
  if (!columns.length) {
    notifyError("No rows available to download");
    return;
  }

  const header = columns.map((key) => csvEscape(key)).join(",");
  const lines = data.rows.map((row) => columns.map((key) => csvEscape(row[key])).join(","));
  // BOM helps Excel open UTF-8 CSV correctly
  const csv = ["\uFEFF" + header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const safeTitle = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  anchor.href = url;
  anchor.download = `${safeTitle || data.reportKey}-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  notifySuccess("CSV downloaded");
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
  const [selectedCore, setSelectedCore] = useState<CoreReportKey>("active_students");
  const [filters, setFilters] = useState({
    from: monthStart,
    to: today,
    examId: "",
  });
  const [coreData, setCoreData] = useState<CoreReportResult | null>(null);
  const [module, setModule] = useState<ReportModule | null>(null);
  const [moduleData, setModuleData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

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

  const selectedMeta = useMemo(
    () => hub?.coreReports.find((item) => item.key === selectedCore) ?? null,
    [hub, selectedCore],
  );

  async function runCore(reportKey = selectedCore) {
    setLoading(true);
    setModule(null);
    setModuleData(null);
    setSelectedCore(reportKey);
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

  async function runModule(selected: ReportModule) {
    setLoading(true);
    setCoreData(null);
    setModule(selected);
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

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Data reports"
        title="Core school reports"
        description="Run the most used campus reports for students, fees, attendance, and exams."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {coreData?.rows?.length ? (
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

      <section className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 shadow-sm">
        <div className="flex items-center gap-2 border-b border-indigo-100/80 px-5 py-3">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <FilterAltOutlined sx={{ fontSize: 18 }} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Report filters</p>
            <p className="text-xs text-slate-500">
              {hub?.currentSession ? `Session: ${hub.currentSession.name}` : "No current session set"}
            </p>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <label className="rounded-xl border border-sky-100 bg-white/80 p-3">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
              <CalendarMonthOutlined sx={{ fontSize: 14 }} /> From
            </span>
            <input
              className="input"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </label>
          <label className="rounded-xl border border-violet-100 bg-white/80 p-3">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <CalendarMonthOutlined sx={{ fontSize: 14 }} /> To
            </span>
            <input
              className="input"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </label>
          <label className="rounded-xl border border-amber-100 bg-white/80 p-3">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <EmojiEventsOutlined sx={{ fontSize: 14 }} /> Exam (for rank)
            </span>
            <select
              className="input"
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
          <div className="flex items-end">
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
              type="button"
              disabled={loading}
              onClick={() => void runCore()}
            >
              <PlayArrowOutlined sx={{ fontSize: 18 }} />
              {loading ? "Running…" : "Run selected report"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(hub?.coreReports ?? []).map((item) => {
          const style = REPORT_CARD_STYLE[item.key];
          const Icon = style.icon;
          const isSelected = selectedCore === item.key && Boolean(coreData);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => void runCore(item.key)}
              className={`rounded-2xl border p-5 text-left transition ${style.card} ${
                isSelected ? style.selected : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${style.iconWrap}`}>
                  <Icon sx={{ fontSize: 22 }} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  {item.needsExam ? (
                    <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}>
                      Needs exam
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {coreData ? <CoreReportView data={coreData} metaLabel={selectedMeta?.label} /> : null}

      <section className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
            <AssessmentOutlined sx={{ fontSize: 20 }} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">More module reports</h2>
            <p className="text-sm text-slate-500">Extra module-level extracts for deeper dumps.</p>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {(hub?.modules ?? []).map((item) => {
            const style = MODULE_CARD_STYLE[item.key];
            const Icon = style.icon;
            const active = module === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`rounded-xl border p-4 text-left transition ${style.card} ${
                  active ? "ring-2 ring-indigo-200" : "hover:brightness-95"
                }`}
                onClick={() => void runModule(item.key)}
              >
                <span className={`mb-3 inline-flex size-9 items-center justify-center rounded-lg ${style.wrap}`}>
                  <Icon sx={{ fontSize: 18 }} />
                </span>
                <p className="font-semibold text-slate-900">{item.label}</p>
              </button>
            );
          })}
        </div>
        {module && moduleData ? <ModuleDump module={module} data={moduleData} /> : null}
      </section>
    </main>
  );
}

function CoreReportView({ data, metaLabel }: { data: CoreReportResult; metaLabel?: string }) {
  const style = REPORT_CARD_STYLE[data.reportKey];
  const Icon = style.icon;
  const summaryEntries = Object.entries(data.summary ?? {}).filter(
    ([, value]) => typeof value !== "object",
  );
  const columns = data.rows[0]
    ? Object.keys(data.rows[0]).filter((key) => !HIDDEN_COLUMNS.has(key))
    : [];

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex flex-wrap items-start justify-between gap-4 border-b px-5 py-4 ${style.card}`}>
        <div className="flex items-start gap-3">
          <span className={`inline-flex size-11 items-center justify-center rounded-xl ${style.iconWrap}`}>
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
            disabled={!data.rows.length}
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
