import { useEffect, useMemo, useState } from "react";
import {
  AccountBalanceWalletOutlined,
  AssessmentOutlined,
  CalendarMonthOutlined,
  DownloadOutlined,
  EmojiEventsOutlined,
  GroupsOutlined,
  InfoOutlined,
  MenuBookOutlined,
  PlayArrowOutlined,
  QueryStatsOutlined,
  SchoolOutlined,
  TableViewOutlined,
  TuneOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import type { AcademicReportResult, AcademicSetup, ClassSection, ReportCatalogItem, Weekday } from "./types";
import { WEEKDAYS, WEEKDAY_LABELS, downloadCsv } from "./utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

const REPORT_META: Record<string, { category: string; icon: React.ReactNode; categoryClass: string }> = {
  students: { category: "Students", icon: <GroupsOutlined />, categoryClass: "bg-indigo-50 text-indigo-700" },
  attendance: { category: "Attendance", icon: <CalendarMonthOutlined />, categoryClass: "bg-emerald-50 text-emerald-700" },
  marks: { category: "Examination", icon: <MenuBookOutlined />, categoryClass: "bg-blue-50 text-blue-700" },
  toppers: { category: "Performance", icon: <EmojiEventsOutlined />, categoryClass: "bg-amber-50 text-amber-700" },
  timetable: { category: "Timetable", icon: <AssessmentOutlined />, categoryClass: "bg-violet-50 text-violet-700" },
  class_wise_subjects: { category: "Subjects", icon: <MenuBookOutlined />, categoryClass: "bg-indigo-50 text-indigo-700" },
  free_periods: { category: "Timetable", icon: <CalendarMonthOutlined />, categoryClass: "bg-emerald-50 text-emerald-700" },
  fees: { category: "Finance", icon: <AccountBalanceWalletOutlined />, categoryClass: "bg-teal-50 text-teal-700" },
  scholars: { category: "Scholarship", icon: <WorkspacePremiumOutlined />, categoryClass: "bg-rose-50 text-rose-700" },
  promotions: { category: "Academics", icon: <QueryStatsOutlined />, categoryClass: "bg-blue-50 text-blue-700" },
  teacher_workload: { category: "Teachers", icon: <SchoolOutlined />, categoryClass: "bg-amber-50 text-amber-700" },
  custom: { category: "Custom", icon: <TuneOutlined />, categoryClass: "bg-slate-100 text-slate-700" },
};

const REPORT_LABELS: Record<string, string> = {
  students: "Student List Report",
  attendance: "Attendance Summary",
  marks: "Subject Wise Marks Report",
  toppers: "Topper Report",
  timetable: "Timetable Report",
  class_wise_subjects: "Class wise Subject Report",
  free_periods: "Free Class Period Report",
  fees: "Due Fees Report",
  scholars: "Scholarship Report",
  promotions: "Active Enrollments Report",
  teacher_workload: "Teacher Workload Report",
  custom: "Custom Report",
};

type ExamOption = { id: string; name: string; sessionId?: string };

export function AcademicReportsPanel({
  setup,
  token,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  onError: (message: string) => void;
}) {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [reportKey, setReportKey] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [reportFilter, setReportFilter] = useState("");
  const [sessionId, setSessionId] = useState(setup.currentSession?.id ?? "");
  const [classId, setClassId] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [sessionClassSections, setSessionClassSections] = useState<ClassSection[]>(setup.classSections);
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [examId, setExamId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [weekday, setWeekday] = useState<Weekday>("MONDAY");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:45");
  const [result, setResult] = useState<AcademicReportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Record<string, string>>({});

  useEffect(() => {
    void apiRequest<ReportCatalogItem[]>("/academics/reports/catalog", token)
      .then((data) => {
        setCatalog(data);
        if (!reportKey && data.length) setReportKey(data[0].key);
      })
      .catch((cause) => onError(cause instanceof Error ? cause.message : "Unable to load report catalog"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    void apiRequest<{
      groups: Array<{ academicSession?: { id: string } | null; exams: Array<{ id: string; name: string }> }>;
    }>("/exams/setup", token)
      .then((data) => {
        const exams = (data.groups ?? []).flatMap((group) =>
          (group.exams ?? []).map((exam) => ({
            id: exam.id,
            name: exam.name,
            sessionId: group.academicSession?.id,
          })),
        );
        setExamOptions(exams);
      })
      .catch(() => setExamOptions([]));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const params = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    void apiRequest<{ classSections: ClassSection[] }>(`/academics/setup${params}`, token)
      .then((data) => {
        if (cancelled) return;
        setSessionClassSections(data.classSections ?? []);
        setClassId("");
        setClassSectionId("");
        setExamId("");
        setResult(null);
      })
      .catch(() => {
        if (!cancelled) setSessionClassSections(setup.classSections);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, token, setup.classSections]);

  const needsExam = reportKey === "marks" || reportKey === "toppers";
  const needsDateRange = reportKey === "attendance";
  const needsFreePeriodFilters = reportKey === "free_periods";
  const classSections = useMemo(
    () => sessionClassSections.filter((item) => !classId || item.academicClass.id === classId),
    [sessionClassSections, classId],
  );
  const filteredExams = useMemo(
    () => examOptions.filter((exam) => !sessionId || !exam.sessionId || exam.sessionId === sessionId),
    [examOptions, sessionId],
  );
  const categories = useMemo(
    () => [...new Set(catalog.map((item) => REPORT_META[item.key]?.category ?? "Other"))],
    [catalog],
  );
  const availableReports = useMemo(
    () =>
      catalog.filter((item) => {
        const category = REPORT_META[item.key]?.category ?? "Other";
        return (!categoryFilter || category === categoryFilter) && (!reportFilter || item.key === reportFilter);
      }),
    [catalog, categoryFilter, reportFilter],
  );

  function buildQuery(format: "json" | "csv", key = reportKey) {
    const params = new URLSearchParams({ reportKey: key, format });
    if (sessionId) params.set("sessionId", sessionId);
    if (classSectionId) params.set("classSectionId", classSectionId);
    else if (classId) params.set("classId", classId);
    if ((key === "marks" || key === "toppers") && examId) params.set("examId", examId);
    if (key === "attendance" && from) params.set("from", from);
    if (key === "attendance" && to) params.set("to", to);
    if (key === "free_periods") {
      params.set("weekday", weekday);
      if (startTime) params.set("startTime", startTime);
      if (endTime) params.set("endTime", endTime);
    }
    return params;
  }

  async function runReport(key = reportKey) {
    if (!key) return;
    setReportKey(key);
    if ((key === "marks" || key === "toppers") && !examId) {
      onError("Select an exam for this report.");
      return;
    }
    setRunning(true);
    try {
      const params = buildQuery("json", key);
      const data = await apiRequest<AcademicReportResult>(`/academics/reports/run?${params}`, token);
      setResult(data);
      setGeneratedAt((previous) => ({
        ...previous,
        [key]: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      }));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to run report");
    } finally {
      setRunning(false);
    }
  }

  async function exportCsvFromApi(key = reportKey) {
    if (!key) return;
    if ((key === "marks" || key === "toppers") && !examId) {
      onError("Select an exam for this report.");
      return;
    }
    try {
      setReportKey(key);
      const params = buildQuery("csv", key);
      const response = await fetch(`${API_URL}/academics/reports/run?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${key}-report.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to export report");
    }
  }

  function exportPreviewCsv() {
    if (!result) return;
    downloadCsv(
      `${reportKey}-report.csv`,
      result.columns,
      result.rows.map((row) => result.columns.map((col) => String(row[col] ?? ""))),
    );
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Reports</h2>
          <p className="mt-1 text-[12.5px] text-slate-500">Generate and download academic reports.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.95fr_0.95fr_auto] xl:items-end">
          <label>
            <span className="nx-label">Report Category</span>
            <select className="nx-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Report Name</span>
            <select
              className="nx-input"
              value={reportFilter}
              onChange={(e) => {
                setReportFilter(e.target.value);
                if (e.target.value) {
                  setReportKey(e.target.value);
                  setResult(null);
                }
              }}
            >
              <option value="">All Reports</option>
              {catalog.map((item) => (
                <option key={item.key} value={item.key}>
                  {REPORT_LABELS[item.key] ?? item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Academic Year</span>
            <select className="nx-input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Current / all years</option>
              {setup.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Class</span>
            <select
              className="nx-input"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setClassSectionId("");
              }}
            >
              <option value="">All Classes</option>
              {setup.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Section</span>
            <select className="nx-input" value={classSectionId} onChange={(e) => setClassSectionId(e.target.value)}>
              <option value="">All Sections</option>
              {classSections.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.section.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="nx-btn-secondary h-[38px] whitespace-nowrap border-indigo-500 text-indigo-700"
            disabled={running || !catalog.length}
            onClick={() => void runReport("custom")}
          >
            <TuneOutlined sx={{ fontSize: 16 }} /> {running ? "Generating…" : "Generate Custom Report"}
          </button>
        </div>

        {needsExam || needsDateRange || needsFreePeriodFilters ? (
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
            {needsExam ? (
              <label>
                <span className="nx-label">Exam</span>
                <select className="nx-input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  <option value="">Select exam</option>
                  {filteredExams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {needsDateRange ? (
              <>
                <label>
                  <span className="nx-label">From</span>
                  <input className="nx-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label>
                  <span className="nx-label">To</span>
                  <input className="nx-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
              </>
            ) : null}
            {needsFreePeriodFilters ? (
              <>
                <label>
                  <span className="nx-label">Weekday</span>
                  <select
                    className="nx-input"
                    value={weekday}
                    onChange={(e) => setWeekday(e.target.value as Weekday)}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {WEEKDAY_LABELS[day]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Start Time</span>
                  <input
                    className="nx-input"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </label>
                <label>
                  <span className="nx-label">End Time</span>
                  <input
                    className="nx-input"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-900">Available Reports</h3>
        </div>
        <div className="overflow-x-auto px-3 pt-1">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Report Name</th>
                <th>Category</th>
                <th>Description</th>
                <th>Format</th>
                <th>Last Generated</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {availableReports.map((item, index) => {
                const meta = REPORT_META[item.key] ?? REPORT_META.custom;
                return (
                  <tr key={item.key} className={reportKey === item.key ? "bg-indigo-50/30" : undefined}>
                    <td>{index + 1}</td>
                    <td>
                      <button
                        type="button"
                        className="flex items-center gap-3 text-left font-semibold text-slate-800"
                        onClick={() => {
                          setReportKey(item.key);
                          setResult(null);
                        }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center text-indigo-600 [&_svg]:text-[17px]">
                          {meta.icon}
                        </span>
                        {REPORT_LABELS[item.key] ?? item.label}
                      </button>
                    </td>
                    <td>
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${meta.categoryClass}`}>
                        {meta.category}
                      </span>
                    </td>
                    <td className="max-w-[320px] text-[12px] text-slate-500">{item.description}</td>
                    <td>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-600">
                          <TableViewOutlined sx={{ fontSize: 15 }} /> CSV
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-slate-600">{generatedAt[item.key] ?? "—"}</td>
                    <td>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-l-md border border-indigo-300 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
                          disabled={running}
                          onClick={() => void runReport(item.key)}
                        >
                          <PlayArrowOutlined sx={{ fontSize: 14 }} /> Generate
                        </button>
                        <button
                          type="button"
                          className="rounded-r-md border border-l-0 border-indigo-300 px-2 py-1.5 text-indigo-700 hover:bg-indigo-50"
                          title="Download CSV"
                          onClick={() => void exportCsvFromApi(item.key)}
                        >
                          <DownloadOutlined sx={{ fontSize: 15 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!availableReports.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    No reports match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="m-3 flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          <InfoOutlined sx={{ fontSize: 15 }} />
          Reports are generated based on the latest data available in the system.
        </div>
      </div>

      {result ? (
        <div className="nx-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">
              Preview ({result.rows.length} row{result.rows.length === 1 ? "" : "s"})
            </h3>
            <button type="button" className="nx-btn-secondary" onClick={exportPreviewCsv}>
              <DownloadOutlined sx={{ fontSize: 16 }} /> Export preview
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[640px]">
              <thead>
                <tr>
                  {result.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 200).map((row, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={index}>
                    {result.columns.map((col) => (
                      <td key={col}>{String(row[col] ?? "")}</td>
                    ))}
                  </tr>
                ))}
                {!result.rows.length ? (
                  <tr>
                    <td colSpan={result.columns.length || 1} className="px-5 py-12 text-center text-slate-500">
                      No data for the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {result.rows.length > 200 ? (
            <p className="border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
              Showing first 200 rows. Export CSV for the full data set.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
