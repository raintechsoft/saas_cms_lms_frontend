import { useEffect, useMemo, useState } from "react";
import {
  AssessmentOutlined,
  BadgeOutlined,
  DescriptionOutlined,
  DownloadOutlined,
  GroupsOutlined,
  PendingActionsOutlined,
  PlayArrowOutlined,
  ScheduleOutlined,
  TrendingUpOutlined,
  VisibilityOutlined,
  FactCheckOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import type { ExamWithGroup, Result, Setup } from "./types";

type ReportKind = "rank" | "result" | "marksheet" | "admit";

type RecentReport = {
  id: string;
  kind: ReportKind;
  name: string;
  generatedBy: string;
  date: string;
  at: number;
  status: "Completed" | "Processing";
  examId?: string;
  examName?: string;
  rows?: Array<Record<string, string | number>>;
};

type ResultsPayload = {
  results: Result[];
  published?: boolean;
  exam?: { id: string; name: string };
};

const HISTORY_KEY = "exam-reports-history-v1";

const REPORT_CARDS: Array<{
  kind: ReportKind;
  title: string;
  description: string;
  tone: string;
  iconTone: string;
  icon: React.ReactNode;
}> = [
  {
    kind: "rank",
    title: "Rank-wise Report",
    description:
      "Generate class-wise and section-wise ranking reports with total marks, percentage and overall position.",
    tone: "border-violet-100",
    iconTone: "bg-violet-50 text-violet-600",
    icon: <AssessmentOutlined sx={{ fontSize: 22 }} />,
  },
  {
    kind: "result",
    title: "Result Report",
    description:
      "Generate detailed examination results including pass, fail, grades, percentages and summary statistics.",
    tone: "border-emerald-100",
    iconTone: "bg-emerald-50 text-emerald-600",
    icon: <TrendingUpOutlined sx={{ fontSize: 22 }} />,
  },
  {
    kind: "marksheet",
    title: "Marksheet Generate Report",
    description: "Generate printable marksheets using the selected template and examination settings.",
    tone: "border-amber-100",
    iconTone: "bg-amber-50 text-amber-600",
    icon: <DescriptionOutlined sx={{ fontSize: 22 }} />,
  },
  {
    kind: "admit",
    title: "Admit Card Generate Report",
    description: "Generate admit cards in bulk using selected templates for all eligible students.",
    tone: "border-sky-100",
    iconTone: "bg-sky-50 text-sky-600",
    icon: <BadgeOutlined sx={{ fontSize: 22 }} />,
  },
];

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

function printPdf(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const html = `<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
      h1{font-size:18px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e2e8f0;padding:8px;text-align:left}
      th{background:#f8fafc}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></body></html>`;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (!popup) return false;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
  return true;
}

function loadHistory(): RecentReport[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentReport[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: RecentReport[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

function cardMeta(kind: ReportKind) {
  return REPORT_CARDS.find((item) => item.kind === kind)!;
}

export function ExamReportsPanel({
  setup,
  exams,
  token,
  onError,
  onOpenMarksheet,
  onOpenAdmitCard,
  onOpenResults,
}: {
  setup: Setup;
  exams: ExamWithGroup[];
  token: string;
  onError: (message: string) => void;
  onOpenMarksheet?: () => void;
  onOpenAdmitCard?: () => void;
  onOpenResults?: (selection?: string) => void;
}) {
  const { user } = useAuth();
  const actorName = useMemo(() => {
    if (!user) return "Admin";
    const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    return name || "Admin";
  }, [user]);

  const [history, setHistory] = useState<RecentReport[]>([]);
  const [modalKind, setModalKind] = useState<ReportKind | null>(null);
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [groupId, setGroupId] = useState(setup.groups[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!examId && exams[0]) setExamId(exams[0].id);
  }, [examId, exams]);

  const publishedCount = useMemo(
    () => exams.filter((exam) => exam.status === "PUBLISHED").length,
    [exams],
  );
  const draftCount = useMemo(
    () => exams.filter((exam) => exam.status === "DRAFT").length,
    [exams],
  );
  const templateCount = setup.templates?.length ?? 0;
  const pendingReports = history.filter((item) => item.status === "Processing").length || draftCount;

  const summary = [
    {
      label: "Total Exam Groups",
      value: setup.groups.length,
      icon: <GroupsOutlined sx={{ fontSize: 18 }} />,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      label: "Published Results",
      value: publishedCount,
      icon: <FactCheckOutlined sx={{ fontSize: 18 }} />,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Pending Reports",
      value: pendingReports,
      icon: <ScheduleOutlined sx={{ fontSize: 18 }} />,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: "Templates Available",
      value: templateCount,
      icon: <DescriptionOutlined sx={{ fontSize: 18 }} />,
      tone: "bg-sky-50 text-sky-600",
    },
  ];

  function pushHistory(entry: RecentReport) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      saveHistory(next);
      return next;
    });
  }

  function openGenerate(kind: ReportKind) {
    if (kind === "marksheet") {
      onOpenMarksheet?.();
      notifyInfo("Open Print on Marksheet to generate documents.");
      pushHistory({
        id: `${Date.now()}-marksheet`,
        kind: "marksheet",
        name: "Marksheet Generate",
        generatedBy: actorName,
        date: new Date().toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        at: Date.now(),
        status: "Processing",
      });
      return;
    }
    if (kind === "admit") {
      onOpenAdmitCard?.();
      notifyInfo("Open Print on Admit Card to generate documents.");
      pushHistory({
        id: `${Date.now()}-admit`,
        kind: "admit",
        name: "Admit Card",
        generatedBy: actorName,
        date: new Date().toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        at: Date.now(),
        status: "Processing",
      });
      return;
    }
    setModalKind(kind);
  }

  async function runExamReport() {
    if (!modalKind || (modalKind !== "rank" && modalKind !== "result")) return;
    if (!examId && !groupId) {
      onError("Select an exam or exam group");
      return;
    }
    setBusy(true);
    try {
      const selection = examId
        ? `/exams/${examId}/results`
        : groupId
          ? `/exams/groups/${groupId}/results`
          : "";
      if (!selection) {
        onError("Select an exam or exam group");
        return;
      }
      const data = await apiRequest<ResultsPayload>(selection, token);
      const examLabel =
        data.exam?.name ??
        exams.find((item) => item.id === examId)?.name ??
        setup.groups.find((item) => item.id === groupId)?.name ??
        "Exam";
      const title =
        modalKind === "rank" ? `Rank-wise Report · ${examLabel}` : `Result Report · ${examLabel}`;
      const headers =
        modalKind === "rank"
          ? ["Rank", "Student", "Admission No", "Obtained", "Total", "Percentage", "Grade", "Status"]
          : [
              "Student",
              "Admission No",
              "Obtained",
              "Total",
              "Percentage",
              "Grade",
              "Pass Status",
              "Rank",
            ];
      const tableRows = data.results.map((row) => {
        const name = `${row.student.firstName} ${row.student.lastName ?? ""}`.trim();
        if (modalKind === "rank") {
          return [
            row.rank,
            name,
            row.student.admissionNumber,
            row.obtainedMarks,
            row.maximumMarks,
            `${row.percentage}%`,
            row.grade ?? "—",
            row.passStatus,
          ];
        }
        return [
          name,
          row.student.admissionNumber,
          row.obtainedMarks,
          row.maximumMarks,
          `${row.percentage}%`,
          row.grade ?? "—",
          row.passStatus,
          row.rank,
        ];
      });

      downloadCsv(
        `${modalKind}-report.csv`,
        headers,
        tableRows.map((row) => row.map(String)),
      );
      printPdf(title, headers, tableRows);

      const entry: RecentReport = {
        id: `${Date.now()}-${modalKind}`,
        kind: modalKind,
        name: modalKind === "rank" ? "Rank-wise Report" : "Result Report",
        generatedBy: actorName,
        date: new Date().toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        at: Date.now(),
        status: "Completed",
        examId: examId || undefined,
        examName: examLabel,
        rows: data.results.map((row) => ({
          rank: row.rank,
          student: `${row.student.firstName} ${row.student.lastName ?? ""}`.trim(),
          admissionNumber: row.student.admissionNumber,
          obtainedMarks: row.obtainedMarks,
          maximumMarks: row.maximumMarks,
          percentage: row.percentage,
          grade: row.grade ?? "",
          passStatus: row.passStatus,
        })),
      };
      pushHistory(entry);
      notifySuccess(`${title} generated`);
      setModalKind(null);
      onOpenResults?.(examId ? examId : groupId ? `group:${groupId}` : undefined);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate report");
    } finally {
      setBusy(false);
    }
  }

  function redownload(item: RecentReport) {
    if (item.status === "Processing") {
      if (item.kind === "marksheet") onOpenMarksheet?.();
      else if (item.kind === "admit") onOpenAdmitCard?.();
      return;
    }
    if (!item.rows?.length) {
      if (item.examId) {
        setExamId(item.examId);
        setModalKind(item.kind === "result" ? "result" : "rank");
      } else {
        notifyInfo("No cached rows. Generate the report again.");
      }
      return;
    }
    const headers = [
      "Rank",
      "Student",
      "Admission No",
      "Obtained",
      "Total",
      "Percentage",
      "Grade",
      "Status",
    ];
    const tableRows = item.rows.map((row) => [
      row.rank,
      row.student,
      row.admissionNumber,
      row.obtainedMarks,
      row.maximumMarks,
      `${row.percentage}%`,
      row.grade || "—",
      row.passStatus,
    ]);
    downloadCsv(
      `${item.kind}-report.csv`,
      headers,
      tableRows.map((row) => row.map(String)),
    );
    printPdf(item.name, headers, tableRows);
    notifySuccess("Download started");
  }

  return (
    <section className="mt-5 space-y-4">
      <p className="text-[12px] text-slate-400">
        Dashboard <span className="mx-1">/</span> Examination <span className="mx-1">/</span>{" "}
        <span className="text-slate-600">Reports</span>
      </p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {REPORT_CARDS.map((card) => (
              <article
                key={card.kind}
                className={`nx-card flex gap-4 border p-5 ${card.tone}`}
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-full ${card.iconTone}`}>
                  {card.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-slate-900">{card.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                    {card.description}
                  </p>
                  <button
                    type="button"
                    className="nx-btn-primary mt-4"
                    onClick={() => openGenerate(card.kind)}
                  >
                    <PlayArrowOutlined sx={{ fontSize: 16 }} /> Generate
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-bold text-slate-900">Recent Generated Reports</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table">
                <thead>
                  <tr>
                    <th>Report Name</th>
                    <th>Generated By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Download</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="!py-10 text-center text-slate-500">
                        No reports generated yet. Use Generate on a report card above.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => {
                      const meta = cardMeta(item.kind);
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`grid size-8 place-items-center rounded-full ${meta.iconTone}`}
                              >
                                {meta.icon}
                              </span>
                              <span className="font-medium text-slate-900">{item.name}</span>
                            </div>
                          </td>
                          <td>{item.generatedBy}</td>
                          <td>{item.date}</td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                item.status === "Completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600 hover:underline"
                              onClick={() => redownload(item)}
                            >
                              {item.status === "Processing" ? (
                                <>
                                  <VisibilityOutlined sx={{ fontSize: 15 }} /> View Progress
                                </>
                              ) : (
                                <>
                                  <DownloadOutlined sx={{ fontSize: 15 }} /> Download PDF
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="nx-card h-fit p-5">
          <h2 className="text-[15px] font-bold text-slate-900">Report Summary</h2>
          <div className="mt-4 space-y-4">
            {summary.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className={`grid size-10 place-items-center rounded-xl ${item.tone}`}>
                  {item.icon}
                </span>
                <div>
                  <p className="text-[12px] text-slate-500">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <PendingActionsOutlined sx={{ fontSize: 14 }} /> Tip
            </span>
            <p className="mt-1">
              Rank and Result reports export CSV and open a print dialog for PDF. Marksheet and Admit
              Card open their Print tabs.
            </p>
          </div>
        </aside>
      </div>

      {modalKind === "rank" || modalKind === "result" ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {modalKind === "rank" ? "Generate Rank-wise Report" : "Generate Result Report"}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Choose an exam to build the report from live marks and grades.
            </p>
            <label className="mt-4 block">
              <span className="nx-label !normal-case !tracking-normal">Exam</span>
              <select
                className="nx-input bg-white"
                value={examId}
                onChange={(event) => setExamId(event.target.value)}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.group.name} · {exam.name} · {exam.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="nx-label !normal-case !tracking-normal">
                Or exam group (consolidated)
              </span>
              <select
                className="nx-input bg-white"
                value={groupId}
                onChange={(event) => {
                  setGroupId(event.target.value);
                  if (event.target.value) setExamId("");
                }}
              >
                <option value="">Select group</option>
                {setup.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="nx-btn-secondary" onClick={() => setModalKind(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="nx-btn-primary"
                disabled={busy || (!examId && !groupId)}
                onClick={() => void runExamReport()}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
