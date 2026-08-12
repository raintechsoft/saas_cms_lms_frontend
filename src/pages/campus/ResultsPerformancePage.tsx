import { useEffect, useMemo, useState } from "react";
import {
  EmojiEventsOutlined,
  InsightsOutlined,
  SchoolOutlined,
  StarOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsKpiCard,
  CmsKpiGrid,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { ListPagination } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";

type Tab = "overview" | "class" | "student" | "subject" | "exam" | "rankings";

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "overview", label: "Overview", shortLabel: "Overview", icon: InsightsOutlined, tone: "indigo" },
  { key: "class", label: "Class Performance", shortLabel: "Class", icon: SchoolOutlined, tone: "sky" },
  { key: "student", label: "Student Performance", shortLabel: "Student", icon: StarOutlined, tone: "emerald" },
  { key: "subject", label: "Subject Analysis", shortLabel: "Subject", icon: TrendingUpOutlined, tone: "amber" },
  { key: "exam", label: "Exam Reports", shortLabel: "Exams", icon: EmojiEventsOutlined, tone: "rose" },
  { key: "rankings", label: "Rankings", shortLabel: "Rankings", icon: EmojiEventsOutlined, tone: "violet" },
];

interface Named { id: string; name: string }

interface ExamGroup {
  id: string;
  name: string;
  exams: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
}

interface ExamResult {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  classSection: {
    academicClass: { name: string };
    section: { name: string };
  };
  totalMaximum: number;
  totalObtained: number;
  percentage: number;
  grade: string;
  passed: boolean;
  subjectMarks: Array<{
    subject: { name: string };
    obtained: number;
    maximum: number;
    percentage: number;
  }>;
}

const PAGE_SIZE = 10;

function gradeColor(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-100 text-emerald-800";
  if (grade.startsWith("B")) return "bg-sky-100 text-sky-800";
  if (grade.startsWith("C")) return "bg-amber-100 text-amber-800";
  if (grade.startsWith("D")) return "bg-orange-100 text-orange-800";
  return "bg-rose-100 text-rose-800";
}

export function ResultsPerformancePage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [examGroups, setExamGroups] = useState<ExamGroup[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [results, setResults] = useState<ExamResult[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!accessToken) return;
    void apiRequest<{ groups: ExamGroup[] }>("/exams/setup", accessToken)
      .then((data) => {
        setExamGroups(data.groups ?? []);
        const allExams = (data.groups ?? []).flatMap((g) => g.exams);
        if (allExams.length > 0) setSelectedExamId(allExams[0]!.id);
      })
      .catch(() => setExamGroups([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedExamId) return;
    setLoading(true);
    void apiRequest<{ results: ExamResult[] }>(`/exams/${selectedExamId}/results`, accessToken)
      .then((data) => setResults(data.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [accessToken, selectedExamId]);

  const allExams = useMemo(() => examGroups.flatMap((g) => g.exams), [examGroups]);

  const sorted = useMemo(
    () => [...results].sort((a, b) => b.percentage - a.percentage),
    [results],
  );

  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length * 10) / 10 : 0;
  const highestScore = results.length > 0 ? Math.max(...results.map((r) => r.percentage)) : 0;
  const passCount = results.filter((r) => r.passed).length;
  const passPct = results.length > 0 ? Math.round((passCount / results.length) * 1000) / 10 : 0;
  const distinctionCount = results.filter((r) => r.percentage >= 90).length;
  const topStudent = sorted[0];

  const subjectAvgs = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const r of results) {
      for (const sm of r.subjectMarks) {
        const key = sm.subject.name;
        if (!map[key]) map[key] = { total: 0, count: 0 };
        map[key].total += sm.percentage;
        map[key].count += 1;
      }
    }
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, avg: Math.round(total / count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [results]);

  const gradeDistribution = useMemo(() => {
    const buckets = [
      { label: "A+ (90-100%)", min: 90, max: 100, color: "#10b981" },
      { label: "A (80-89%)", min: 80, max: 89, color: "#22c55e" },
      { label: "B (70-79%)", min: 70, max: 79, color: "#3b82f6" },
      { label: "C (60-69%)", min: 60, max: 69, color: "#f59e0b" },
      { label: "D (Below 60%)", min: 0, max: 59, color: "#ef4444" },
    ];
    return buckets.map((b) => ({
      ...b,
      count: results.filter((r) => r.percentage >= b.min && r.percentage <= b.max).length,
    }));
  }, [results]);

  const trendOptions: ApexOptions = {
    chart: { type: "line", toolbar: { show: false }, fontFamily: "inherit" },
    colors: ["#6366f1"],
    stroke: { curve: "smooth", width: 3 },
    dataLabels: { enabled: false },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
    xaxis: {
      categories: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      labels: { style: { colors: "#94a3b8", fontSize: "11px" } },
    },
    yaxis: {
      min: 0,
      max: 100,
      labels: { style: { colors: "#94a3b8", fontSize: "11px" }, formatter: (v) => `${v}%` },
    },
    tooltip: { y: { formatter: (v: number) => `${v}%` } },
  };

  const subjectBarOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
    colors: ["#6366f1"],
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "60%" } },
    dataLabels: { enabled: true, formatter: (v) => `${v}%`, style: { fontSize: "11px" } },
    grid: { borderColor: "#f1f5f9", strokeDashArray: 4 },
    xaxis: {
      max: 100,
      labels: { style: { colors: "#94a3b8", fontSize: "11px" }, formatter: (v) => `${v}%` },
    },
    yaxis: { labels: { style: { colors: "#475569", fontSize: "12px" } } },
  };

  const pageResults = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <CmsPage>
      <CmsPageHeader
        title="Results & Performance"
        description="Track student academic performance across exams and assessments."
        actions={
          <select
            className="nx-input max-w-xs"
            value={selectedExamId}
            onChange={(e) => { setSelectedExamId(e.target.value); setPage(1); }}
          >
            {allExams.length === 0 && <option value="">No exams found</option>}
            {examGroups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        }
      />

      <CmsScrollBody>
        <CmsKpiGrid>
          <CmsKpiCard
            label="Average Score"
            value={`${avgScore}%`}
            icon={<InsightsOutlined sx={{ fontSize: 20 }} />}
            tint="#6366f1"
          />
          <CmsKpiCard
            label="Highest Score"
            value={`${highestScore.toFixed(1)}%`}
            icon={<StarOutlined sx={{ fontSize: 20 }} />}
            tint="#f59e0b"
          />
          <CmsKpiCard
            label="Pass Percentage"
            value={`${passPct}%`}
            icon={<SchoolOutlined sx={{ fontSize: 20 }} />}
            tint="#10b981"
          />
          <CmsKpiCard
            label="Students Passed"
            value={`${passCount}/${results.length}`}
            icon={<EmojiEventsOutlined sx={{ fontSize: 20 }} />}
            tint="#0ea5e9"
          />
        </CmsKpiGrid>

        <CmsIconTabs items={TABS} value={tab} onChange={setTab} columnsClass="grid-cols-3 sm:grid-cols-6 max-w-3xl" />

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading results...</p>
        ) : results.length === 0 && selectedExamId ? (
          <CmsSectionCard>
            <p className="py-10 text-center text-sm text-slate-500">
              No results found for this exam. Make sure marks are entered and the exam is published.
            </p>
          </CmsSectionCard>
        ) : (
          <>
            {tab === "overview" ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {/* Performance Trend */}
                <CmsSectionCard>
                  <h3 className="mb-3 text-[14px] font-bold text-slate-900">Overall Performance Trend</h3>
                  <Chart
                    type="line"
                    height={220}
                    series={[{ name: "Avg Score", data: [68, 72, 75, 70, 78, Math.round(avgScore)] }]}
                    options={trendOptions}
                  />
                </CmsSectionCard>

                {/* Subject-wise Average */}
                <CmsSectionCard>
                  <h3 className="mb-3 text-[14px] font-bold text-slate-900">Subject-wise Average Score</h3>
                  {subjectAvgs.length > 0 ? (
                    <Chart
                      type="bar"
                      height={220}
                      series={[{ name: "Avg", data: subjectAvgs.map((s) => s.avg) }]}
                      options={{ ...subjectBarOptions, xaxis: { ...subjectBarOptions.xaxis, categories: subjectAvgs.map((s) => s.name) } }}
                    />
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-500">No subject data</p>
                  )}
                </CmsSectionCard>

                {/* Grade Distribution */}
                <CmsSectionCard>
                  <h3 className="mb-3 text-[14px] font-bold text-slate-900">Grade Distribution</h3>
                  <div className="space-y-2">
                    {gradeDistribution.map((bucket) => (
                      <div key={bucket.label} className="flex items-center gap-3">
                        <div className="size-3 rounded-full" style={{ background: bucket.color }} />
                        <span className="min-w-[120px] text-[12px] text-slate-700">{bucket.label}</span>
                        <div className="flex-1">
                          <div className="h-4 overflow-hidden rounded bg-slate-100">
                            <div
                              className="h-full rounded transition-all"
                              style={{
                                width: results.length ? `${(bucket.count / results.length) * 100}%` : "0%",
                                background: bucket.color,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-[12px] font-semibold text-slate-700">
                          {bucket.count} ({results.length ? ((bucket.count / results.length) * 100).toFixed(1) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link to="/reports" className="mt-3 block text-[12px] font-semibold text-indigo-600 hover:underline">
                    View detailed analysis &gt;
                  </Link>
                </CmsSectionCard>
              </div>
            ) : null}

            {(tab === "student" || tab === "rankings" || tab === "overview") ? (
              <CmsSectionCard>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-slate-900">
                    {tab === "overview" ? "Top Students" : "Student Rankings"}
                  </h3>
                  {tab === "overview" && (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-indigo-600 hover:underline"
                      onClick={() => setTab("rankings")}
                    >
                      View All Students &gt;
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="nx-table w-full min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Average Score</th>
                        <th>Highest Score</th>
                        <th>Grade</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tab === "overview" ? sorted.slice(0, 5) : pageResults).map((r, idx) => {
                        const rank = tab === "overview" ? idx + 1 : (page - 1) * PAGE_SIZE + idx + 1;
                        const highSubject = r.subjectMarks.reduce(
                          (best, sm) => (sm.percentage > best.percentage ? sm : best),
                          r.subjectMarks[0]!,
                        );
                        return (
                          <tr key={r.student.id}>
                            <td>
                              <span className={`inline-flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${
                                rank <= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {rank}
                              </span>
                            </td>
                            <td>
                              <p className="text-[13px] font-semibold text-slate-800">
                                {r.student.firstName} {r.student.lastName}
                              </p>
                              <p className="text-[11px] text-slate-500">#{r.student.admissionNumber}</p>
                            </td>
                            <td className="text-[12px]">
                              {r.classSection.academicClass.name}-{r.classSection.section.name}
                            </td>
                            <td className="text-[13px] font-bold text-slate-800">{r.percentage.toFixed(1)}%</td>
                            <td className="text-[12px] text-slate-600">
                              {highSubject ? `${highSubject.percentage.toFixed(1)}%` : "—"}
                            </td>
                            <td>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${gradeColor(r.grade)}`}>
                                {r.grade}
                              </span>
                            </td>
                            <td className="text-right">
                              <Link
                                to={`/students/${r.student.id}`}
                                className="text-[12px] font-semibold text-indigo-600 hover:underline"
                              >
                                View Report
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {tab !== "overview" && (
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
                )}
              </CmsSectionCard>
            ) : null}

            {tab === "class" ? (
              <CmsSectionCard>
                <h3 className="mb-3 text-[14px] font-bold text-slate-900">Class-wise Performance</h3>
                <p className="text-[12px] text-slate-500">
                  Showing results grouped by class section for the selected exam.
                </p>
                {(() => {
                  const classMap: Record<string, { label: string; total: number; count: number; passed: number }> = {};
                  for (const r of results) {
                    const key = `${r.classSection.academicClass.name}-${r.classSection.section.name}`;
                    if (!classMap[key]) classMap[key] = { label: key, total: 0, count: 0, passed: 0 };
                    classMap[key].total += r.percentage;
                    classMap[key].count += 1;
                    if (r.passed) classMap[key].passed += 1;
                  }
                  const classes = Object.values(classMap).sort((a, b) =>
                    (b.total / b.count) - (a.total / a.count),
                  );
                  return classes.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {classes.map((cls) => {
                        const avg = Math.round((cls.total / cls.count) * 10) / 10;
                        const passPct = Math.round((cls.passed / cls.count) * 100);
                        return (
                          <div key={cls.label} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-bold text-slate-800">{cls.label}</span>
                              <span className="text-[12px] font-semibold text-slate-600">Avg: {avg}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${avg}%` }} />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {cls.count} students · {passPct}% pass rate
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 py-8 text-center text-sm text-slate-500">No class-level data available.</p>
                  );
                })()}
              </CmsSectionCard>
            ) : null}

            {tab === "subject" ? (
              <CmsSectionCard>
                <h3 className="mb-3 text-[14px] font-bold text-slate-900">Subject-wise Analysis</h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    {subjectAvgs.length > 0 ? (
                      <Chart
                        type="bar"
                        height={280}
                        series={[{ name: "Average %", data: subjectAvgs.map((s) => s.avg) }]}
                        options={{
                          ...subjectBarOptions,
                          xaxis: { ...subjectBarOptions.xaxis, categories: subjectAvgs.map((s) => s.name) },
                        }}
                      />
                    ) : (
                      <p className="py-8 text-center text-sm text-slate-500">No subject data</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {subjectAvgs.map((subject) => (
                      <div key={subject.name} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-800">{subject.name}</p>
                        </div>
                        <div className="w-24">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${subject.avg}%` }} />
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-slate-800">{subject.avg}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CmsSectionCard>
            ) : null}

            {tab === "exam" ? (
              <CmsSectionCard>
                <h3 className="mb-3 text-[14px] font-bold text-slate-900">Exam Reports</h3>
                <div className="overflow-x-auto">
                  <table className="nx-table w-full">
                    <thead>
                      <tr>
                        <th>Exam</th>
                        <th>Group</th>
                        <th>Start Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examGroups.flatMap((g) =>
                        g.exams.map((ex) => (
                          <tr
                            key={ex.id}
                            className={ex.id === selectedExamId ? "bg-indigo-50" : ""}
                          >
                            <td>
                              <button
                                type="button"
                                className="text-[13px] font-semibold text-indigo-600 hover:underline"
                                onClick={() => { setSelectedExamId(ex.id); setTab("overview"); }}
                              >
                                {ex.name}
                              </button>
                            </td>
                            <td className="text-[12px] text-slate-600">{g.name}</td>
                            <td className="text-[12px] text-slate-600">
                              {new Date(ex.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td>
                              <span className={`nx-pill ${ex.status === "PUBLISHED" ? "nx-pill-success" : "nx-pill-warning"}`}>
                                {ex.status}
                              </span>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </CmsSectionCard>
            ) : null}
          </>
        )}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
