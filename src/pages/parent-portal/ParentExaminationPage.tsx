import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowForwardRounded,
  CalendarMonthOutlined,
  DescriptionOutlined,
  DownloadRounded,
  EmojiEventsOutlined,
  InfoOutlined,
  KeyboardArrowDownRounded,
  MilitaryTechOutlined,
  ShowChartOutlined,
  TrackChangesOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import { Menu, MenuItem } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type TabKey = "upcoming" | "results";
type TermKey = "term1-2324" | "term2-2324" | "term1-2425" | "term2-2425";

const TERMS: { key: TermKey; label: string }[] = [
  { key: "term2-2425", label: "Term 2 (2024-25)" },
  { key: "term1-2425", label: "Term 1 (2024-25)" },
  { key: "term2-2324", label: "Term 2 (2023-24)" },
  { key: "term1-2324", label: "Term 1 (2023-24)" },
];

const UPCOMING_EXAMS = [
  { id: "ex-1", exam: "Periodic Test - 1", subject: "Mathematics", date: "28 May 2025", time: "09:00 – 11:00 AM" },
  { id: "ex-2", exam: "Unit Test - 1", subject: "Science", date: "30 May 2025", time: "10:00 – 12:00 PM" },
  { id: "ex-3", exam: "Half Yearly Exam", subject: "English", date: "05 Jun 2025", time: "09:00 – 12:00 PM" },
  { id: "ex-4", exam: "Half Yearly Exam", subject: "Social Science", date: "07 Jun 2025", time: "09:00 – 12:00 PM" },
];

/** Chart scale: C=1 … A+=5 (maps GPA-style progression to letter grades) */
const GRADE_SCALE = ["", "C", "B", "B+", "A", "A+"] as const;
const TREND_GRADES = [2.8, 3.3, 3.7, 4.3, 4.8];
const TREND_GPA_LABELS = ["7.8", "8.2", "8.5", "8.9", "9.1"];
const TREND_LABELS = ["T1 23-24", "T2 23-24", "T1 24-25", "Mid 24-25", "T2 24-25"];

interface SubjectMark {
  subject: string;
  max: number;
  obtained: number;
  percentage: number;
  grade: string;
}

const RESULTS: Record<
  TermKey,
  {
    overallPct: number;
    overallGrade: string;
    totalObtained: number;
    totalMax: number;
    rank: number;
    classSize: number;
    topPct: number;
    gpa: number;
    gpaLabel: string;
    attendance: number;
    subjects: SubjectMark[];
    generatedOn: string;
  }
> = {
  "term2-2425": {
    overallPct: 87.4,
    overallGrade: "A",
    totalObtained: 437,
    totalMax: 500,
    rank: 3,
    classSize: 42,
    topPct: 7,
    gpa: 9.1,
    gpaLabel: "Excellent",
    attendance: 94,
    generatedOn: "15 May 2025",
    subjects: [
      { subject: "Mathematics", max: 100, obtained: 92, percentage: 92, grade: "A+" },
      { subject: "Science", max: 100, obtained: 88, percentage: 88, grade: "A" },
      { subject: "English", max: 100, obtained: 85, percentage: 85, grade: "A" },
      { subject: "Social Science", max: 100, obtained: 80, percentage: 80, grade: "A" },
      { subject: "Hindi", max: 100, obtained: 70, percentage: 70, grade: "B+" },
    ],
  },
  "term1-2425": {
    overallPct: 84.2,
    overallGrade: "A",
    totalObtained: 421,
    totalMax: 500,
    rank: 5,
    classSize: 42,
    topPct: 12,
    gpa: 8.6,
    gpaLabel: "Very Good",
    attendance: 92,
    generatedOn: "10 Dec 2024",
    subjects: [
      { subject: "Mathematics", max: 100, obtained: 86, percentage: 86, grade: "A" },
      { subject: "Science", max: 100, obtained: 82, percentage: 82, grade: "A" },
      { subject: "English", max: 100, obtained: 88, percentage: 88, grade: "A" },
      { subject: "Social Science", max: 100, obtained: 80, percentage: 80, grade: "A" },
      { subject: "Hindi", max: 100, obtained: 85, percentage: 85, grade: "A" },
    ],
  },
  "term2-2324": {
    overallPct: 81.0,
    overallGrade: "B+",
    totalObtained: 405,
    totalMax: 500,
    rank: 8,
    classSize: 40,
    topPct: 20,
    gpa: 8.2,
    gpaLabel: "Good",
    attendance: 90,
    generatedOn: "18 May 2024",
    subjects: [
      { subject: "Mathematics", max: 100, obtained: 80, percentage: 80, grade: "A" },
      { subject: "Science", max: 100, obtained: 78, percentage: 78, grade: "B+" },
      { subject: "English", max: 100, obtained: 85, percentage: 85, grade: "A" },
      { subject: "Social Science", max: 100, obtained: 79, percentage: 79, grade: "B+" },
      { subject: "Hindi", max: 100, obtained: 83, percentage: 83, grade: "A" },
    ],
  },
  "term1-2324": {
    overallPct: 78.0,
    overallGrade: "B+",
    totalObtained: 390,
    totalMax: 500,
    rank: 10,
    classSize: 40,
    topPct: 25,
    gpa: 7.8,
    gpaLabel: "Good",
    attendance: 89,
    generatedOn: "12 Dec 2023",
    subjects: [
      { subject: "Mathematics", max: 100, obtained: 76, percentage: 76, grade: "B+" },
      { subject: "Science", max: 100, obtained: 74, percentage: 74, grade: "B+" },
      { subject: "English", max: 100, obtained: 82, percentage: 82, grade: "A" },
      { subject: "Social Science", max: 100, obtained: 77, percentage: 77, grade: "B+" },
      { subject: "Hindi", max: 100, obtained: 81, percentage: 81, grade: "A" },
    ],
  },
};

function gradeTone(grade: string): "green" | "blue" | "orange" | "yellow" | "purple" {
  if (grade === "A+" || grade === "A") return "green";
  if (grade === "B+") return "blue";
  if (grade.startsWith("B")) return "yellow";
  return "orange";
}

function CardShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: PARENT_BORDER }}
    >
      {children}
    </div>
  );
}

function UpcomingExamsTable({ compactAction = false }: { compactAction?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead>
          <tr className="border-b bg-[#F9FAFB]" style={{ borderColor: PARENT_BORDER }}>
            {["Exam Name", "Subject", "Date", "Time", "Action"].map((col) => (
              <th key={col} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UPCOMING_EXAMS.map((exam) => (
            <tr key={exam.id} className="border-b last:border-0" style={{ borderColor: PARENT_BORDER }}>
              <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">{exam.exam}</td>
              <td className="px-3 py-2.5 text-[#374151]">{exam.subject}</td>
              <td className="px-3 py-2.5 text-[#374151]">{exam.date}</td>
              <td className="px-3 py-2.5 text-[#6B7280]">{exam.time}</td>
              <td className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => notifySuccess(`Hall ticket for ${exam.subject} downloaded (demo)`)}
                  className={
                    compactAction
                      ? "grid size-8 place-items-center rounded-lg border text-[#4F46E5] transition hover:bg-[#EEF2FF]"
                      : "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-bold text-[#4F46E5] hover:bg-[#EEF2FF]"
                  }
                  style={{ borderColor: "#C7D2FE" }}
                  aria-label={`Download hall ticket for ${exam.subject}`}
                >
                  <DownloadRounded sx={{ fontSize: 16 }} />
                  {!compactAction && "Hall Ticket"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ParentExaminationPage() {
  const { activeChild } = useParentPortal();
  const [tab, setTab] = useState<TabKey>("results");
  const [term, setTerm] = useState<TermKey>("term2-2425");
  const [termAnchor, setTermAnchor] = useState<HTMLElement | null>(null);
  const [trendAnchor, setTrendAnchor] = useState<HTMLElement | null>(null);
  const [trendFilter, setTrendFilter] = useState("All Terms");
  const result = RESULTS[term];
  const termLabel = TERMS.find((t) => t.key === term)?.label ?? "";

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "area", toolbar: { show: false }, fontFamily: "inherit", zoom: { enabled: false } },
      colors: [PARENT_PRIMARY],
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100],
          colorStops: [
            { offset: 0, color: PARENT_PRIMARY, opacity: 0.35 },
            { offset: 100, color: PARENT_PRIMARY, opacity: 0.04 },
          ],
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (_val, opts) => TREND_GPA_LABELS[opts.dataPointIndex] ?? "",
        offsetY: -8,
        style: { fontSize: "11px", fontWeight: 700, colors: [PARENT_PRIMARY] },
        background: { enabled: false },
      },
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 5, colors: ["#FFFFFF"], strokeColors: PARENT_PRIMARY, strokeWidth: 3 },
      grid: { borderColor: "#EEF0F4", strokeDashArray: 4 },
      xaxis: {
        categories: TREND_LABELS,
        labels: { style: { colors: "#94A3B8", fontSize: "10px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 1,
        max: 5,
        tickAmount: 4,
        labels: {
          style: { colors: "#94A3B8", fontSize: "11px", fontWeight: 600 },
          formatter: (v) => GRADE_SCALE[Math.round(v)] ?? "",
        },
      },
      tooltip: {
        y: {
          formatter: (v: number, opts) => {
            const gpa = TREND_GPA_LABELS[opts?.dataPointIndex ?? 0];
            const grade = GRADE_SCALE[Math.round(v)] ?? "";
            return gpa ? `GPA ${gpa} (${grade})` : grade;
          },
        },
      },
    }),
    [],
  );

  const stats = [
    {
      label: "Overall Percentage",
      value: `${result.overallPct.toFixed(2)}%`,
      caption: `Grade: ${result.overallGrade}`,
      icon: EmojiEventsOutlined,
      cardBg: "#F5F3FF",
      iconBg: "#EDE9FE",
      iconColor: PARENT_PRIMARY,
    },
    {
      label: "Total Marks Obtained",
      value: `${result.totalObtained} / ${result.totalMax}`,
      caption: termLabel,
      icon: WorkspacePremiumOutlined,
      cardBg: "#EFF6FF",
      iconBg: "#DBEAFE",
      iconColor: "#2563EB",
    },
    {
      label: "Class Rank",
      value: `${result.rank} / ${result.classSize}`,
      caption: `Top ${result.topPct}%`,
      icon: MilitaryTechOutlined,
      cardBg: "#F0FDF4",
      iconBg: "#DCFCE7",
      iconColor: "#16A34A",
    },
    {
      label: "GPA",
      value: `${result.gpa.toFixed(1)} / 10`,
      caption: result.gpaLabel,
      icon: ShowChartOutlined,
      cardBg: "#FFF7ED",
      iconBg: "#FFEDD5",
      iconColor: "#EA580C",
    },
    {
      label: "Attendance",
      value: `${result.attendance}%`,
      caption: "This Term",
      icon: TrackChangesOutlined,
      cardBg: "#FEF2F2",
      iconBg: "#FEE2E2",
      iconColor: "#DC2626",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Examination & Results"
        subtitle="View upcoming exams, marks and performance of your child."
        action={
          <>
            <button
              type="button"
              onClick={(e) => setTermAnchor(e.currentTarget)}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-[13px] font-semibold text-[#1A1A2E] shadow-[0_2px_8px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <CalendarMonthOutlined sx={{ fontSize: 18, color: PARENT_PRIMARY }} />
              {termLabel}
              <KeyboardArrowDownRounded sx={{ fontSize: 18, color: "#9CA3AF" }} />
            </button>
            <Menu anchorEl={termAnchor} open={Boolean(termAnchor)} onClose={() => setTermAnchor(null)}>
              {TERMS.map((t) => (
                <MenuItem
                  key={t.key}
                  selected={t.key === term}
                  onClick={() => {
                    setTerm(t.key);
                    setTermAnchor(null);
                  }}
                >
                  {t.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        }
      />

      <div className="mb-3.5 flex gap-5 border-b" style={{ borderColor: PARENT_BORDER }}>
        {(
          [
            { key: "upcoming" as TabKey, label: "Upcoming Exams" },
            { key: "results" as TabKey, label: "Results" },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className="relative pb-2.5 text-[13px] font-bold transition-colors"
              style={{ color: active ? PARENT_PRIMARY : "#6B7280" }}
            >
              {item.label}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: PARENT_PRIMARY }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "results" && (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border p-3 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
                  style={{ borderColor: PARENT_BORDER, background: stat.cardBg }}
                >
                  <div
                    className="mb-2 grid size-8 place-items-center rounded-lg"
                    style={{ background: stat.iconBg, color: stat.iconColor }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </div>
                  <p className="text-[11px] font-semibold text-[#6B7280]">{stat.label}</p>
                  <p className="mt-0.5 text-[17px] font-extrabold leading-tight text-[#1A1A2E]">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#6B7280]">{stat.caption}</p>
                </div>
              );
            })}
          </div>

          {/* 2×2 grid matching mock rows */}
          <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_300px]">
            {/* Subject-wise Marks */}
            <CardShell className="overflow-hidden">
              <div className="border-b px-3.5 py-3" style={{ borderColor: PARENT_BORDER }}>
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">Subject-wise Marks</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b bg-[#F9FAFB]" style={{ borderColor: PARENT_BORDER }}>
                      {["Subject", "Max Marks", "Obtained Marks", "Percentage", "Grade"].map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.subjects.map((row) => (
                      <tr key={row.subject} className="border-b" style={{ borderColor: PARENT_BORDER }}>
                        <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">{row.subject}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{row.max}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">{row.obtained}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{row.percentage}%</td>
                        <td className="px-3 py-2.5">
                          <StatusChip label={row.grade} tone={gradeTone(row.grade)} />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#F9FAFB]">
                      <td className="px-3 py-2.5 font-extrabold text-[#1A1A2E]">Total</td>
                      <td className="px-3 py-2.5 font-bold text-[#1A1A2E]">{result.totalMax}</td>
                      <td className="px-3 py-2.5 font-bold text-[#1A1A2E]">{result.totalObtained}</td>
                      <td className="px-3 py-2.5 font-bold text-[#1A1A2E]">{result.overallPct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5">
                        <StatusChip label={result.overallGrade} tone={gradeTone(result.overallGrade)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardShell>

            {/* Grade Trend */}
            <CardShell className="flex flex-col p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">Grade Trend</h2>
                <button
                  type="button"
                  onClick={(e) => setTrendAnchor(e.currentTarget)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold text-[#4B5563]"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  {trendFilter}
                  <KeyboardArrowDownRounded sx={{ fontSize: 16, color: "#9CA3AF" }} />
                </button>
                <Menu anchorEl={trendAnchor} open={Boolean(trendAnchor)} onClose={() => setTrendAnchor(null)}>
                  {["All Terms", "2024-25", "2023-24"].map((option) => (
                    <MenuItem
                      key={option}
                      selected={option === trendFilter}
                      onClick={() => {
                        setTrendFilter(option);
                        setTrendAnchor(null);
                      }}
                    >
                      {option}
                    </MenuItem>
                  ))}
                </Menu>
              </div>
              <div className="min-h-0 flex-1">
                <Chart
                  type="area"
                  height={190}
                  series={[{ name: "Grade", data: TREND_GRADES }]}
                  options={lineOptions}
                />
              </div>
            </CardShell>

            {/* Upcoming Exams */}
            <CardShell className="overflow-hidden">
              <div className="border-b px-3.5 py-3" style={{ borderColor: PARENT_BORDER }}>
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">Upcoming Exams</h2>
              </div>
              <UpcomingExamsTable compactAction />
              <div className="border-t px-3.5 py-2.5" style={{ borderColor: PARENT_BORDER }}>
                <Link
                  to="/parent/attendance-calendar/academic-calendar"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#4F46E5] hover:underline"
                >
                  View Full Exam Schedule
                  <ArrowForwardRounded sx={{ fontSize: 14 }} />
                </Link>
              </div>
            </CardShell>

            {/* Report Card */}
            <CardShell className="flex flex-col p-3.5">
              <h2 className="text-[14px] font-bold text-[#1A1A2E]">Report Card</h2>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                Download detailed report card of your child.
              </p>
              <div
                className="mt-3 flex flex-1 flex-col rounded-xl border p-3"
                style={{ borderColor: "#C7D2FE", background: "#EEF2FF" }}
              >
                <div
                  className="mb-2.5 grid size-10 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE }}
                >
                  <DescriptionOutlined sx={{ fontSize: 20, color: PARENT_PRIMARY }} />
                </div>
                <p className="text-[13px] font-bold text-[#1A1A2E]">{termLabel}</p>
                <p className="mt-0.5 text-[11.5px] text-[#6B7280]">Generated on: {result.generatedOn}</p>
                <button
                  type="button"
                  onClick={() => notifySuccess("Report card download started")}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  <DownloadRounded sx={{ fontSize: 17 }} />
                  Download Report Card
                </button>
              </div>
              <button
                type="button"
                onClick={() => notifySuccess(`Opening previous report cards for ${activeChild.name.split(" ")[0]} (demo)`)}
                className="mt-2.5 inline-flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-[#4F46E5] hover:underline"
              >
                View Previous Report Cards
                <ArrowForwardRounded sx={{ fontSize: 14 }} />
              </button>
            </CardShell>
          </div>
        </>
      )}

      {tab === "upcoming" && (
        <CardShell className="mb-3.5 overflow-hidden">
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-3"
            style={{ borderColor: PARENT_BORDER }}
          >
            <h2 className="text-[14px] font-bold text-[#1A1A2E]">Upcoming Exams</h2>
            <button
              type="button"
              onClick={() => notifySuccess("Hall ticket download started")}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold text-white"
              style={{ background: PARENT_PRIMARY }}
            >
              <DownloadRounded sx={{ fontSize: 18 }} />
              Download Hall Ticket
            </button>
          </div>
          <UpcomingExamsTable />
          <div className="border-t px-4 py-3 sm:px-5" style={{ borderColor: PARENT_BORDER }}>
            <Link
              to="/parent/attendance-calendar/academic-calendar"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#4F46E5] hover:underline"
            >
              View Full Exam Schedule
              <ArrowForwardRounded sx={{ fontSize: 14 }} />
            </Link>
          </div>
        </CardShell>
      )}

      <div
        className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
        style={{ background: PARENT_PRIMARY_SUBTLE }}
      >
        <InfoOutlined sx={{ fontSize: 18, color: PARENT_PRIMARY, marginTop: "1px" }} />
        <p className="text-[12.5px] font-medium leading-snug text-[#4338CA]">
          For any discrepancies in marks, please contact the class teacher or exam cell.
        </p>
      </div>
    </div>
  );
}
