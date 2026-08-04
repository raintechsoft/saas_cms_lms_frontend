import { useEffect, useMemo, useRef, useState } from "react";
import {
  CancelOutlined,
  CheckCircleOutline,
  CloudUploadOutlined,
  DescriptionOutlined,
  EditOutlined,
  GroupsOutlined,
  KeyboardArrowDown,
  MoreVert,
  PrintOutlined,
  ScheduleOutlined,
  SearchOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { DonutChart } from "../../../components/charts/PremiumCharts";
import { ListPagination } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import type { ExamWithGroup, Result, Setup } from "./types";

type ActivityItem = {
  id: string;
  initials: string;
  student: string;
  action: string;
  time: string;
  at: number;
};

type ResultsPayload = {
  results: Result[];
  published?: boolean;
  exam?: { id: string; name: string; status: string; publishedAt?: string | null };
  group?: { id: string; name: string; exams: Array<{ id: string; name: string; status: string }> };
};

function studentName(result: Result) {
  return `${result.student.firstName} ${result.student.lastName ?? ""}`.trim();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function gradeTone(name: string | null, passStatus: string) {
  if (!name || passStatus === "FAIL" || name.toUpperCase() === "F") {
    return "bg-rose-50 text-rose-700";
  }
  const upper = name.toUpperCase();
  if (upper.startsWith("A+")) return "bg-emerald-50 text-emerald-700";
  if (upper.startsWith("A")) return "bg-emerald-50/80 text-emerald-600";
  if (upper.startsWith("B+")) return "bg-sky-50 text-sky-700";
  if (upper.startsWith("B")) return "bg-blue-50 text-blue-600";
  if (upper.startsWith("C")) return "bg-amber-50 text-amber-700";
  if (upper.startsWith("D")) return "bg-pink-50 text-pink-700";
  return "bg-slate-100 text-slate-700";
}

function relativeTime(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds || 1} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (cell: string) => `"${String(cell).replaceAll('"', '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 88;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${
        checked ? "bg-[var(--nx-primary,#6366f1)]" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function ExamResultsPanel({
  setup,
  exams,
  token,
  onSaved,
  onError,
  initialSelection = "",
  onOpenMarks,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  initialSelection?: string;
  onOpenMarks?: (classSectionId?: string) => void;
}) {
  const initialGroupId = initialSelection.startsWith("group:")
    ? initialSelection.slice(6)
    : exams.find((exam) => exam.id === initialSelection)?.group.id ?? setup.groups[0]?.id ?? "";

  const [groupId, setGroupId] = useState(initialGroupId);
  const [classId, setClassId] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({
    groupId: initialGroupId,
    classId: "",
    classSectionId: "",
    search: "",
  });
  const [selectionKey, setSelectionKey] = useState(
    initialSelection || (initialGroupId ? `group:${initialGroupId}` : ""),
  );
  const [results, setResults] = useState<Result[]>([]);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Result | null>(null);
  const [showOnPortal, setShowOnPortal] = useState<Record<string, boolean>>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const bulkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialSelection) return;
    if (initialSelection.startsWith("group:")) {
      const id = initialSelection.slice(6);
      setGroupId(id);
      setApplied((prev) => ({ ...prev, groupId: id }));
      setSelectionKey(initialSelection);
    } else {
      const exam = exams.find((item) => item.id === initialSelection);
      if (exam) {
        setGroupId(exam.group.id);
        setApplied((prev) => ({ ...prev, groupId: exam.group.id }));
        setSelectionKey(initialSelection);
      }
    }
  }, [initialSelection, exams]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!bulkRef.current?.contains(event.target as Node)) setBulkOpen(false);
      setRowMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function loadResults(key: string) {
    setSelectionKey(key);
    if (!key) {
      setResults([]);
      setPublished(false);
      return;
    }
    setLoading(true);
    try {
      const path = key.startsWith("group:")
        ? `/exams/groups/${key.slice(6)}/results`
        : `/exams/${key}/results`;
      const data = await apiRequest<ResultsPayload>(path, token);
      setResults(data.results);
      setPublished(Boolean(data.published));
      setSelectedIds([]);
      setShowOnPortal(
        Object.fromEntries(
          data.results.map((item) => [
            item.examStudentId,
            item.showOnPortal ?? Boolean(data.published),
          ]),
        ),
      );
      setPage(1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load results");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectionKey) void loadResults(selectionKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, token]);

  const classOptions = useMemo(() => {
    const map = new Map(setup.classSections.map((item) => [item.academicClass.id, item.academicClass]));
    return [...map.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () =>
      setup.classSections.filter((item) => !classId || item.academicClass.id === classId),
    [setup.classSections, classId],
  );

  const selectedGroup = setup.groups.find((group) => group.id === applied.groupId);
  const groupExams = useMemo(
    () => exams.filter((exam) => exam.group.id === applied.groupId),
    [exams, applied.groupId],
  );

  const filtered = useMemo(() => {
    const query = applied.search.trim().toLowerCase();
    return results.filter((result) => {
      if (applied.classId && result.classSection?.academicClass.id !== applied.classId) return false;
      if (applied.classSectionId && result.classSection?.id !== applied.classSectionId) return false;
      if (!query) return true;
      const haystack = [
        studentName(result),
        result.student.admissionNumber,
        result.rollNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [results, applied]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const passed = filtered.filter((item) => item.passStatus === "PASS").length;
  const failed = filtered.length - passed;
  const avgPercent =
    filtered.length > 0
      ? filtered.reduce((sum, item) => sum + item.percentage, 0) / filtered.length
      : 0;
  const highest = filtered.length ? Math.max(...filtered.map((item) => item.obtainedMarks)) : 0;
  const lowest = filtered.length ? Math.min(...filtered.map((item) => item.obtainedMarks)) : 0;
  const passPct = filtered.length ? (passed / filtered.length) * 100 : 0;

  const publishedGroups = setup.groups.filter((group) =>
    group.exams.length > 0 && group.exams.every((exam) => exam.status === "PUBLISHED"),
  ).length;
  const groupsWithExams = setup.groups.filter((group) => group.exams.length > 0).length;
  const publishedPct = groupsWithExams ? Math.round((publishedGroups / groupsWithExams) * 100) : 0;

  function pushActivity(student: string, action: string) {
    setActivities((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        initials: initials(student || "AD"),
        student: student || "Admin",
        action,
        time: relativeTime(Date.now()),
        at: Date.now(),
      },
      ...prev,
    ].slice(0, 8));
  }

  function applyFilter() {
    const examStillValid =
      Boolean(selectionKey) &&
      !selectionKey.startsWith("group:") &&
      exams.find((exam) => exam.id === selectionKey)?.group.id === groupId;
    const nextKey = examStillValid ? selectionKey : groupId ? `group:${groupId}` : "";
    setApplied({ groupId, classId, classSectionId, search });
    setPage(1);
    if (nextKey !== selectionKey) setSelectionKey(nextKey);
    else if (nextKey) void loadResults(nextKey);
  }

  function resetFilter() {
    const fallback = setup.groups[0]?.id ?? "";
    setGroupId(fallback);
    setClassId("");
    setClassSectionId("");
    setSearch("");
    setApplied({ groupId: fallback, classId: "", classSectionId: "", search: "" });
    setPage(1);
    setSelectionKey(fallback ? `group:${fallback}` : "");
  }

  async function publishTargets(examIds: string[]) {
    if (!examIds.length) {
      notifyInfo("No draft exams to publish in this selection.");
      return;
    }
    setBusy(true);
    try {
      for (const examId of examIds) {
        await apiRequest(`/exams/${examId}/publish`, token, { method: "PUT" });
      }
      notifySuccess(examIds.length > 1 ? "Results published" : "Result published");
      pushActivity("Admin", `published ${selectedGroup?.name ?? "exam"} results`);
      await Promise.all([onSaved(), loadResults(selectionKey)]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to publish result");
    } finally {
      setBusy(false);
      setBulkOpen(false);
    }
  }

  async function unpublishTargets(examIds: string[]) {
    if (!examIds.length) {
      notifyInfo("No published exams to unpublish in this selection.");
      return;
    }
    setBusy(true);
    try {
      for (const examId of examIds) {
        await apiRequest(`/exams/${examId}/unpublish`, token, { method: "PUT" });
      }
      notifySuccess(examIds.length > 1 ? "Results unpublished" : "Result unpublished");
      pushActivity("Admin", `unpublished ${selectedGroup?.name ?? "exam"} results`);
      await Promise.all([onSaved(), loadResults(selectionKey)]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to unpublish result");
    } finally {
      setBusy(false);
      setBulkOpen(false);
    }
  }

  function draftExamIds() {
    if (selectionKey.startsWith("group:")) {
      return groupExams.filter((exam) => exam.status === "DRAFT").map((exam) => exam.id);
    }
    const exam = exams.find((item) => item.id === selectionKey);
    return exam?.status === "DRAFT" ? [exam.id] : [];
  }

  function publishedExamIds() {
    if (selectionKey.startsWith("group:")) {
      return groupExams.filter((exam) => exam.status === "PUBLISHED").map((exam) => exam.id);
    }
    const exam = exams.find((item) => item.id === selectionKey);
    return exam?.status === "PUBLISHED" ? [exam.id] : [];
  }

  function exportExcel(rows: Result[]) {
    downloadCsv(
      `exam-results-${selectedGroup?.name ?? "export"}.csv`,
      [
        "Rank",
        "Student Name",
        "Admission No",
        "Roll No",
        "Total Marks",
        "Obtained Marks",
        "Percentage",
        "Grade",
        "Status",
      ],
      rows.map((row) => [
        String(row.rank),
        studentName(row),
        row.student.admissionNumber,
        row.rollNumber ?? "",
        String(row.maximumMarks),
        String(row.obtainedMarks),
        String(row.percentage),
        row.grade ?? "",
        row.passStatus,
      ]),
    );
    notifySuccess("Excel (CSV) exported");
    pushActivity("Admin", "exported exam results to Excel");
    setBulkOpen(false);
  }

  function exportPdf(rows: Result[]) {
    const title = selectedGroup?.name ?? "Exam Results";
    const html = `<!doctype html><html><head><title>${title}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
        h1{font-size:18px;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
        th{background:#f8fafc}
      </style></head><body>
      <h1>${title}</h1>
      <table><thead><tr>
        <th>#</th><th>Student</th><th>Admission</th><th>Roll</th><th>Marks</th><th>%</th><th>Grade</th><th>Status</th>
      </tr></thead><tbody>
      ${rows
        .map(
          (row) => `<tr>
          <td>${row.rank}</td>
          <td>${studentName(row)}</td>
          <td>${row.student.admissionNumber}</td>
          <td>${row.rollNumber ?? "—"}</td>
          <td>${row.obtainedMarks}/${row.maximumMarks}</td>
          <td>${row.percentage}%</td>
          <td>${row.grade ?? "—"}</td>
          <td>${row.passStatus}</td>
        </tr>`,
        )
        .join("")}
      </tbody></table></body></html>`;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
    if (!popup) {
      onError("Pop-up blocked. Allow pop-ups to export PDF.");
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
    notifySuccess("PDF print dialog opened");
    pushActivity("Admin", "exported exam results to PDF");
    setBulkOpen(false);
  }

  function printRow(result: Result) {
    exportPdf([result]);
  }

  const allSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.examStudentId));
  const sparkAvg = [avgPercent * 0.85, avgPercent * 0.9, avgPercent * 0.95, avgPercent, avgPercent * 0.98];
  const sparkHigh = [highest * 0.7, highest * 0.8, highest * 0.88, highest * 0.95, highest];
  const sparkLow = [lowest * 1.4, lowest * 1.2, lowest * 1.1, lowest * 1.05, lowest];
  const sparkPass = [passPct * 0.8, passPct * 0.88, passPct * 0.92, passPct * 0.96, passPct];

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1">
            <span className="nx-label !normal-case !tracking-normal">Exam Group</span>
            <select
              className="nx-input bg-white"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">Select exam group</option>
              {setup.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px]">
            <span className="nx-label !normal-case !tracking-normal">Class</span>
            <select
              className="nx-input bg-white"
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setClassSectionId("");
              }}
            >
              <option value="">All Classes</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px]">
            <span className="nx-label !normal-case !tracking-normal">Section</span>
            <select
              className="nx-input bg-white"
              value={classSectionId}
              onChange={(event) => setClassSectionId(event.target.value)}
            >
              <option value="">All Sections</option>
              {sectionOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[220px] flex-[1.2]">
            <span className="nx-label !normal-case !tracking-normal">Search Student</span>
            <div className="relative">
              <SearchOutlined
                sx={{ fontSize: 16 }}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                className="nx-input bg-white !pl-9"
                value={search}
                placeholder="Search by name or roll no..."
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilter();
                }}
              />
            </div>
          </label>
          <button type="button" className="nx-btn-primary" onClick={applyFilter}>
            Apply Filter
          </button>
          <button type="button" className="nx-btn-secondary" onClick={resetFilter}>
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative" ref={bulkRef}>
              <button
                type="button"
                className="nx-btn-secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  setBulkOpen((open) => !open);
                }}
              >
                Bulk Action <KeyboardArrowDown sx={{ fontSize: 16 }} />
              </button>
              {bulkOpen ? (
                <div className="absolute top-full left-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    disabled={busy}
                    onClick={() => void publishTargets(draftExamIds())}
                  >
                    Publish Results
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    disabled={busy}
                    onClick={() => void unpublishTargets(publishedExamIds())}
                  >
                    Unpublish Results
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      exportPdf(
                        selectedIds.length
                          ? filtered.filter((row) => selectedIds.includes(row.examStudentId))
                          : filtered,
                      )
                    }
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      exportExcel(
                        selectedIds.length
                          ? filtered.filter((row) => selectedIds.includes(row.examStudentId))
                          : filtered,
                      )
                    }
                  >
                    Export Excel
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="nx-btn-primary"
                disabled={!selectionKey || loading}
                onClick={() => void loadResults(selectionKey)}
              >
                <DescriptionOutlined sx={{ fontSize: 16 }} /> Generate Result
              </button>
              <button
                type="button"
                className="nx-btn-primary"
                disabled={busy || !draftExamIds().length}
                onClick={() => void publishTargets(draftExamIds())}
              >
                <CloudUploadOutlined sx={{ fontSize: 16 }} /> Publish Results
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total Students",
                value: String(filtered.length),
                icon: <GroupsOutlined sx={{ fontSize: 18 }} />,
                tone: "bg-indigo-50 text-indigo-600",
              },
              {
                label: "Passed",
                value: String(passed),
                icon: <CheckCircleOutline sx={{ fontSize: 18 }} />,
                tone: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "Failed",
                value: String(failed),
                icon: <CancelOutlined sx={{ fontSize: 18 }} />,
                tone: "bg-rose-50 text-rose-600",
              },
              {
                label: "Result Published",
                value: published ? "Yes" : "No",
                icon: <DescriptionOutlined sx={{ fontSize: 18 }} />,
                tone: "bg-violet-50 text-violet-600",
              },
            ].map((card) => (
              <div key={card.label} className="nx-card flex items-center gap-3 p-4">
                <span className={`grid size-10 place-items-center rounded-xl ${card.tone}`}>{card.icon}</span>
                <div>
                  <p className="text-[12px] text-slate-500">{card.label}</p>
                  <p className="text-xl font-bold text-slate-900">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="nx-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[980px]">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds((prev) => [
                              ...new Set([...prev, ...pageRows.map((row) => row.examStudentId)]),
                            ]);
                          } else {
                            const drop = new Set(pageRows.map((row) => row.examStudentId));
                            setSelectedIds((prev) => prev.filter((id) => !drop.has(id)));
                          }
                        }}
                      />
                    </th>
                    <th>Student Name</th>
                    <th>Admission No</th>
                    <th>Roll No</th>
                    <th>Total Marks</th>
                    <th>Obtained</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                    <th>Rank</th>
                    <th>Status</th>
                    <th>Show on App/Web</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="!py-10 text-center text-slate-500">
                        Loading results…
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="!py-10 text-center text-slate-500">
                        {selectionKey
                          ? "No students match the current filters."
                          : "Select an exam group and apply filters to view results."}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((result) => (
                      <tr key={result.examStudentId}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(result.examStudentId)}
                            onChange={(event) => {
                              setSelectedIds((prev) =>
                                event.target.checked
                                  ? [...prev, result.examStudentId]
                                  : prev.filter((id) => id !== result.examStudentId),
                              );
                            }}
                          />
                        </td>
                        <td className="font-medium text-slate-900">{studentName(result)}</td>
                        <td>{result.student.admissionNumber}</td>
                        <td>{result.rollNumber ?? "—"}</td>
                        <td>{result.maximumMarks}</td>
                        <td>{result.obtainedMarks}</td>
                        <td>{result.percentage.toFixed(2)}%</td>
                        <td>
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${gradeTone(
                              result.grade,
                              result.passStatus,
                            )}`}
                          >
                            {result.grade ?? "—"}
                          </span>
                        </td>
                        <td>{result.rank}</td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              result.passStatus === "PASS"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {result.passStatus === "PASS" ? "Pass" : "Fail"}
                          </span>
                        </td>
                        <td>
                          <Toggle
                            checked={Boolean(showOnPortal[result.examStudentId])}
                            onChange={(next) => {
                              setShowOnPortal((prev) => ({ ...prev, [result.examStudentId]: next }));
                              void apiRequest(
                                `/exams/students/${result.examStudentId}/portal-visibility`,
                                token,
                                {
                                  method: "PUT",
                                  body: JSON.stringify({ showOnPortal: next }),
                                },
                              ).catch((cause: unknown) => {
                                setShowOnPortal((prev) => ({
                                  ...prev,
                                  [result.examStudentId]: !next,
                                }));
                                onError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Unable to update portal visibility",
                                );
                              });
                              pushActivity(
                                studentName(result),
                                next
                                  ? "result visibility enabled on App/Web"
                                  : "result visibility hidden on App/Web",
                              );
                              if (!published && next) {
                                notifyInfo("Publish the exam so results appear on the portal.");
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="relative flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                              title="View"
                              onClick={() => setViewing(result)}
                            >
                              <VisibilityOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                              title="Edit marks in Marks Entry"
                              onClick={() => {
                                onOpenMarks?.(result.classSection?.id);
                                if (!onOpenMarks) {
                                  notifyInfo("Open Marks Entry to edit subject marks for this student.");
                                }
                              }}
                            >
                              <EditOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                              title="Print"
                              onClick={() => printRow(result)}
                            >
                              <PrintOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-slate-500 hover:bg-slate-100"
                              title="More"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRowMenuId((id) =>
                                  id === result.examStudentId ? null : result.examStudentId,
                                );
                              }}
                            >
                              <MoreVert sx={{ fontSize: 16 }} />
                            </button>
                            {rowMenuId === result.examStudentId ? (
                              <div className="absolute top-7 right-0 z-20 min-w-[160px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                  onClick={() => {
                                    exportExcel([result]);
                                    setRowMenuId(null);
                                  }}
                                >
                                  Export row CSV
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(result.student.admissionNumber);
                                    notifySuccess("Admission number copied");
                                    setRowMenuId(null);
                                  }}
                                >
                                  Copy admission no
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={Math.min(page, pageCount)}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              label="entries"
            />
          </div>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-[14px] font-bold text-slate-900">Recent Activities</h3>
            </div>
            {activities.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                Publish, export, or update visibility to see activity here.
              </p>
            ) : (
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Action</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 place-items-center rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600">
                            {item.initials}
                          </span>
                          <span className="font-medium text-slate-800">{item.student}</span>
                        </div>
                      </td>
                      <td className="text-slate-600">{item.action}</td>
                      <td className="text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <ScheduleOutlined sx={{ fontSize: 14 }} />
                          {relativeTime(item.at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="nx-card p-4">
            <h3 className="text-[14px] font-bold text-slate-900">Student Performance Summary</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { label: "Average Percentage", value: `${avgPercent.toFixed(0)}%`, color: "#6366f1", spark: sparkAvg },
                { label: "Highest Marks", value: String(Math.round(highest)), color: "#10b981", spark: sparkHigh },
                { label: "Lowest Marks", value: String(Math.round(lowest)), color: "#f43f5e", spark: sparkLow },
                { label: "Pass Percentage", value: `${passPct.toFixed(0)}%`, color: "#3b82f6", spark: sparkPass },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                >
                  <div>
                    <p className="text-[11px] text-slate-500">{item.label}</p>
                    <p className="text-lg font-bold text-slate-900">{item.value}</p>
                  </div>
                  <Sparkline values={item.spark} color={item.color} />
                </div>
              ))}
            </div>
          </div>

          <div className="nx-card p-4">
            <h3 className="text-[14px] font-bold text-slate-900">Pass vs Fail</h3>
            <div className="mt-3 flex items-center gap-4">
              <DonutChart
                size={150}
                showLegend={false}
                centerValue={String(filtered.length)}
                centerLabel="Students"
                slices={[
                  { label: "Pass", value: passed, color: "#22c55e" },
                  { label: "Fail", value: failed, color: "#f43f5e" },
                ]}
              />
              <div className="space-y-2 text-[12px]">
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  Pass {passed} ({passPct.toFixed(2)}%)
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="size-2.5 rounded-full bg-rose-500" />
                  Fail {failed} ({filtered.length ? (100 - passPct).toFixed(2) : "0.00"}%)
                </p>
              </div>
            </div>
          </div>

          <div className="nx-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-slate-900">Published Results</h3>
              <span className="text-[13px] font-semibold text-indigo-600">{publishedPct}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--nx-primary,#6366f1)] transition-all"
                style={{ width: `${publishedPct}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-slate-500">
              {publishedGroups} of {groupsWithExams || setup.groups.length} exam groups published
            </p>
          </div>
        </aside>
      </div>

      {viewing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{studentName(viewing)}</h3>
                <p className="text-[13px] text-slate-500">
                  {viewing.student.admissionNumber}
                  {viewing.rollNumber ? ` · Roll ${viewing.rollNumber}` : ""}
                </p>
              </div>
              <button type="button" className="nx-btn-secondary !px-3" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">Marks</dt>
                <dd className="font-semibold text-slate-900">
                  {viewing.obtainedMarks}/{viewing.maximumMarks}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">Percentage</dt>
                <dd className="font-semibold text-slate-900">{viewing.percentage}%</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">Grade</dt>
                <dd className="font-semibold text-slate-900">{viewing.grade ?? "—"}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">Rank / Status</dt>
                <dd className="font-semibold text-slate-900">
                  #{viewing.rank} · {viewing.passStatus}
                </dd>
              </div>
            </dl>
            {viewing.exams?.length ? (
              <div className="mt-4">
                <h4 className="text-[13px] font-semibold text-slate-800">Per exam</h4>
                <ul className="mt-2 space-y-2">
                  {viewing.exams.map((exam) => (
                    <li
                      key={exam.examId}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[12px]"
                    >
                      <span>{exam.examName}</span>
                      <span>
                        {exam.obtainedMarks}/{exam.maximumMarks} · {exam.percentage}% · {exam.passStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {viewing.marks?.length ? (
              <div className="mt-4">
                <h4 className="text-[13px] font-semibold text-slate-800">Subjects</h4>
                <ul className="mt-2 space-y-2">
                  {viewing.marks.map((mark, index) => (
                    <li
                      key={`${viewing.examStudentId}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-[12px]"
                    >
                      <span>{mark.schedule?.classSubject?.subject?.name ?? `Subject ${index + 1}`}</span>
                      <span>
                        {mark.isAbsent ? "Absent" : `${mark.marksObtained}/${mark.schedule?.maximumMarks ?? "—"}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ExamPlaceholderPanel({
  title,
  description,
  templates,
  templateType,
}: {
  title: string;
  description: string;
  templates?: Array<{ id: string; name: string; type: string }>;
  templateType?: string;
}) {
  const matched = (templates ?? []).filter((item) =>
    templateType ? item.type === templateType : true,
  );
  return (
    <section className="mt-5">
      <div className="nx-card p-6">
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-[13px] text-slate-500">{description}</p>
        {matched.length ? (
          <ul className="mt-4 space-y-2">
            {matched.map((template) => (
              <li
                key={template.id}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700"
              >
                {template.name}
                <span className="ml-2 text-[11px] text-slate-400">{template.type}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[13px] text-slate-400">
            UI for this tab will be restyled when its screenshot is provided. Existing template
            records will appear here when configured.
          </p>
        )}
      </div>
    </section>
  );
}
