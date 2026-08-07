import { useMemo, useState } from "react";
import { CloseRounded, ExpandMoreRounded } from "@mui/icons-material";
import { Collapse, Dialog, DialogContent } from "@mui/material";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY } from "./ParentPortalLayout";

interface TestItem {
  id: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  rank: number;
  totalStudents: number;
  percentile: number;
  status: "Completed" | "Mock";
  strengths: string[];
  weaknesses: string[];
  subjectScores: { subject: string; score: number }[];
}

const TESTS: TestItem[] = [
  {
    id: "ts-1",
    title: "Full Syllabus Mock Test 4",
    date: "28 Jul 2026",
    score: 168,
    maxScore: 200,
    rank: 12,
    totalStudents: 180,
    percentile: 93,
    status: "Mock",
    strengths: ["Algebra", "Reading Comprehension"],
    weaknesses: ["Geometry proofs", "Map skills"],
    subjectScores: [
      { subject: "Math", score: 42 },
      { subject: "Science", score: 38 },
      { subject: "English", score: 45 },
      { subject: "Hindi", score: 36 },
      { subject: "SST", score: 34 },
      { subject: "Computer", score: 48 },
    ],
  },
  {
    id: "ts-2",
    title: "Science Chapter Test – Light",
    date: "15 Jul 2026",
    score: 42,
    maxScore: 50,
    rank: 8,
    totalStudents: 42,
    percentile: 88,
    status: "Completed",
    strengths: ["Ray optics", "Numericals"],
    weaknesses: ["Spherical mirrors edge cases"],
    subjectScores: [
      { subject: "Optics", score: 18 },
      { subject: "Waves", score: 12 },
      { subject: "Numericals", score: 12 },
    ],
  },
  {
    id: "ts-3",
    title: "Mathematics Weekly Test",
    date: "5 Jul 2026",
    score: 36,
    maxScore: 40,
    rank: 5,
    totalStudents: 42,
    percentile: 95,
    status: "Completed",
    strengths: ["Quadratic equations", "Word problems"],
    weaknesses: ["Graph sketching"],
    subjectScores: [
      { subject: "Algebra", score: 14 },
      { subject: "Geometry", score: 10 },
      { subject: "Arithmetic", score: 12 },
    ],
  },
  {
    id: "ts-4",
    title: "Full Syllabus Mock Test 3",
    date: "20 Jun 2026",
    score: 152,
    maxScore: 200,
    rank: 24,
    totalStudents: 175,
    percentile: 86,
    status: "Mock",
    strengths: ["Grammar", "Computer basics"],
    weaknesses: ["History dates", "Trigonometry"],
    subjectScores: [
      { subject: "Math", score: 36 },
      { subject: "Science", score: 34 },
      { subject: "English", score: 42 },
      { subject: "Hindi", score: 33 },
      { subject: "SST", score: 30 },
      { subject: "Computer", score: 46 },
    ],
  },
];

const SCORE_TREND = [76, 84, 90, 84];
const STRENGTH_SUBJECTS = ["Math", "Science", "English", "Hindi", "SST", "Computer"];
const STRENGTH_SCORES = [78, 72, 88, 70, 65, 92];

export function ParentTestSeriesPage() {
  const { activeChild } = useParentPortal();
  const firstName = activeChild.name.split(" ")[0];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analysisTest, setAnalysisTest] = useState<TestItem | null>(null);

  const barOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
      colors: [PARENT_PRIMARY],
      plotOptions: { bar: { borderRadius: 6, columnWidth: "45%" } },
      dataLabels: { enabled: false },
      grid: { borderColor: "#EEF0F4", strokeDashArray: 4 },
      xaxis: {
        categories: STRENGTH_SUBJECTS,
        labels: { style: { colors: "#94A3B8", fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        max: 100,
        labels: {
          style: { colors: "#94A3B8", fontSize: "11px" },
          formatter: (v) => `${v}`,
        },
      },
      tooltip: { y: { formatter: (v: number) => `${v}% mastery` } },
    }),
    [],
  );

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: "line", toolbar: { show: false }, fontFamily: "inherit", zoom: { enabled: false } },
      colors: ["#059669"],
      stroke: { curve: "smooth", width: 3 },
      markers: { size: 5, colors: ["#059669"], strokeWidth: 0 },
      dataLabels: { enabled: false },
      grid: { borderColor: "#EEF0F4", strokeDashArray: 4 },
      xaxis: {
        categories: ["Mock 1", "Weekly", "Chapter", "Mock 4"],
        labels: { style: { colors: "#94A3B8", fontSize: "11px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 60,
        max: 100,
        labels: {
          style: { colors: "#94A3B8", fontSize: "11px" },
          formatter: (v) => `${v}%`,
        },
      },
      tooltip: { y: { formatter: (v: number) => `${v}%` } },
    }),
    [],
  );

  return (
    <div>
      <PageHeader
        title="Test Series & Performance"
        subtitle={`Mock tests and analysis for ${firstName}`}
      />
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        Test series API is not available yet. This screen is a preview only.
      </p>

      <div className="mb-5 flex flex-col gap-3">
        {TESTS.map((test) => {
          const open = expandedId === test.id;
          const pct = Math.round((test.score / test.maxScore) * 100);
          return (
            <div
              key={test.id}
              className="rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#1A1A2E]">{test.title}</h3>
                    <StatusChip label={test.status} tone={test.status === "Mock" ? "purple" : "green"} />
                  </div>
                  <p className="text-[12.5px] text-[#6B7280]">{test.date}</p>
                  <p className="mt-2 text-[13.5px] font-semibold text-[#1A1A2E]">
                    Score {test.score}/{test.maxScore}{" "}
                    <span className="font-normal text-[#6B7280]">({pct}%)</span>
                    <span className="mx-2 text-[#D1D5DB]">·</span>
                    Rank {test.rank}/{test.totalStudents}
                    <span className="mx-2 text-[#D1D5DB]">·</span>
                    {test.percentile}th percentile
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAnalysisTest(test)}
                    className="rounded-xl px-3.5 py-2 text-[13px] font-bold text-white"
                    style={{ background: PARENT_PRIMARY }}
                  >
                    View Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : test.id)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[13px] font-bold text-[#4F46E5]"
                    style={{ borderColor: PARENT_BORDER }}
                  >
                    Details
                    <ExpandMoreRounded
                      sx={{
                        fontSize: 18,
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>
                </div>
              </div>
              <Collapse in={open}>
                <div className="border-t px-4 py-4 sm:px-5" style={{ borderColor: PARENT_BORDER }}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#ECFDF5] px-3 py-2.5">
                      <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#059669]">
                        Strengths
                      </p>
                      <p className="mt-1 text-[13px] text-[#065F46]">{test.strengths.join(", ")}</p>
                    </div>
                    <div className="rounded-xl bg-[#FFF7ED] px-3 py-2.5">
                      <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#EA580C]">
                        Focus areas
                      </p>
                      <p className="mt-1 text-[13px] text-[#9A3412]">{test.weaknesses.join(", ")}</p>
                    </div>
                  </div>
                </div>
              </Collapse>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
          style={{ borderColor: PARENT_BORDER }}
        >
          <h2 className="mb-1 text-[15px] font-bold text-[#1A1A2E]">Subject Strength</h2>
          <p className="mb-3 text-[12.5px] text-[#6B7280]">Relative mastery across subjects</p>
          <Chart
            type="bar"
            height={260}
            series={[{ name: "Mastery", data: STRENGTH_SCORES }]}
            options={barOptions}
          />
        </div>
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
          style={{ borderColor: PARENT_BORDER }}
        >
          <h2 className="mb-1 text-[15px] font-bold text-[#1A1A2E]">Score Trend</h2>
          <p className="mb-3 text-[12.5px] text-[#6B7280]">Percentage across recent tests</p>
          <Chart
            type="line"
            height={260}
            series={[{ name: "Score %", data: SCORE_TREND }]}
            options={lineOptions}
          />
        </div>
      </div>

      <Dialog open={Boolean(analysisTest)} onClose={() => setAnalysisTest(null)} maxWidth="sm" fullWidth>
        <DialogContent className="!p-0">
          {analysisTest && (
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#1A1A2E]">{analysisTest.title}</h2>
                  <p className="mt-1 text-[12.5px] text-[#6B7280]">{analysisTest.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalysisTest(null)}
                  className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
                  aria-label="Close"
                >
                  <CloseRounded fontSize="small" />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[#EEF2FF] px-3 py-2.5 text-center">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Score</p>
                  <p className="text-[15px] font-extrabold text-[#4F46E5]">
                    {analysisTest.score}/{analysisTest.maxScore}
                  </p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] px-3 py-2.5 text-center">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Rank</p>
                  <p className="text-[15px] font-extrabold text-[#1A1A2E]">
                    {analysisTest.rank}/{analysisTest.totalStudents}
                  </p>
                </div>
                <div className="rounded-xl bg-[#ECFDF5] px-3 py-2.5 text-center">
                  <p className="text-[11px] font-semibold text-[#6B7280]">Percentile</p>
                  <p className="text-[15px] font-extrabold text-[#059669]">{analysisTest.percentile}</p>
                </div>
              </div>

              <Chart
                type="bar"
                height={220}
                series={[
                  {
                    name: "Score",
                    data: analysisTest.subjectScores.map((s) => s.score),
                  },
                ]}
                options={{
                  ...barOptions,
                  xaxis: {
                    ...barOptions.xaxis,
                    categories: analysisTest.subjectScores.map((s) => s.subject),
                  },
                  yaxis: { labels: { style: { colors: "#94A3B8", fontSize: "11px" } } },
                  tooltip: { y: { formatter: (v: number) => `${v} marks` } },
                }}
              />

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-[#ECFDF5] px-3 py-2.5">
                  <p className="text-[11.5px] font-bold text-[#059669]">Strengths</p>
                  <p className="mt-1 text-[12.5px] text-[#065F46]">{analysisTest.strengths.join(", ")}</p>
                </div>
                <div className="rounded-xl bg-[#FFF7ED] px-3 py-2.5">
                  <p className="text-[11.5px] font-bold text-[#EA580C]">Weaknesses</p>
                  <p className="mt-1 text-[12.5px] text-[#9A3412]">{analysisTest.weaknesses.join(", ")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
