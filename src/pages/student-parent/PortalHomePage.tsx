import { Link } from "react-router-dom";
import { BarChart, DonutChart, MetricCard, PanelCard } from "../../components/charts/PremiumCharts";
import { assetUrl } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";

function buildSubjectAttendance(
  subjects: string[],
  recent: Array<{ status: string; periodKey: string }>,
  present: number,
  absent: number,
  late: number,
) {
  const periodKeys = [...new Set(recent.map((row) => row.periodKey).filter((key) => key && key !== "DAY"))];
  if (periodKeys.length > 0) {
    const categories = periodKeys.slice(0, 6);
    return {
      categories,
      presentValues: categories.map(
        (key) =>
          recent.filter(
            (row) =>
              row.periodKey === key &&
              (row.status === "PRESENT" || row.status === "LATE" || row.status === "HALF_DAY"),
          ).length,
      ),
      absentValues: categories.map(
        (key) => recent.filter((row) => row.periodKey === key && row.status === "ABSENT").length,
      ),
    };
  }

  const presentLike = present + late;
  if (subjects.length === 0) {
    return {
      categories: ["Overall"],
      presentValues: [presentLike],
      absentValues: [absent],
    };
  }
  const categories = subjects.slice(0, 6);
  if (presentLike + absent === 0) {
    return {
      categories,
      presentValues: categories.map(() => 0),
      absentValues: categories.map(() => 0),
    };
  }
  const presentValues = categories.map((_, index) => {
    const base = Math.floor(presentLike / categories.length);
    return index < presentLike % categories.length ? base + 1 : base;
  });
  const absentValues = categories.map((_, index) => {
    const base = Math.floor(absent / categories.length);
    return index < absent % categories.length ? base + 1 : base;
  });
  return { categories, presentValues, absentValues };
}

export function PortalHomePage() {
  const { child, overview, role, productMode, basePath } = usePortal();
  const showCms = isProductBucketAllowed(productMode, "CMS");
  const showLms = isProductBucketAllowed(productMode, "LMS");

  if (!child || !overview) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No student profile linked to this account.
      </div>
    );
  }

  const { student, enrollment, attendance, fees, homework, exams, timetable } = child;
  const summary = attendance.summary;
  const totalDays = summary?.total ?? 0;
  const presentDays = (summary?.present ?? 0) + (summary?.late ?? 0) + (summary?.halfDay ?? 0) * 0.5;
  const absentDays = summary?.absent ?? 0;
  const presentPct = summary?.percentage ?? 0;
  const absentPct = totalDays > 0 ? Math.max(0, Math.round(100 - presentPct)) : 0;

  const subjects = [...new Set(timetable.map((item) => item.subject).filter(Boolean))];
  if (subjects.length === 0) {
    for (const exam of exams) {
      for (const row of exam.subjects) {
        if (row.subject && !subjects.includes(row.subject)) subjects.push(row.subject);
      }
    }
  }

  const subjectChart = buildSubjectAttendance(
    subjects,
    attendance.recent,
    summary?.present ?? 0,
    summary?.absent ?? 0,
    summary?.late ?? 0,
  );

  const upcomingHomework = [...homework]
    .filter((item) => !item.submission || item.submission.status === "RESUBMIT_REQUESTED")
    .sort((a, b) => new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42/0.06)]">
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-slate-50 to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          {student.photoUrl ? (
            <img
              src={assetUrl(student.photoUrl)}
              alt=""
              className="size-16 rounded-2xl object-cover shadow-lg ring-2 ring-white"
            />
          ) : (
            <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-2xl font-bold text-white shadow-lg">
              {student.firstName[0]}
              {student.lastName?.[0] ?? ""}
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
              {role === "PARENT" ? "Guardian dashboard" : "Student dashboard"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {student.firstName} {student.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {student.admissionNumber}
              {enrollment ? ` · ${enrollment.className} ${enrollment.section}` : " · Not enrolled"}
              {enrollment?.rollNumber ? ` · Roll ${enrollment.rollNumber}` : ""}
            </p>
            {enrollment?.classTeacher && (
              <p className="mt-1 text-sm text-slate-500">Class teacher: {enrollment.classTeacher}</p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
            {role === "PARENT" ? "Guardian view" : enrollment?.session ?? "—"}
          </span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Attendance" value={totalDays} tone="teal" icon="AT" />
        <MetricCard label="Percentage Present" value={`${presentPct}%`} tone="green" icon="PR" />
        <MetricCard label="Percentage Absent" value={`${absentPct}%`} tone="rose" icon="AB" />
        <MetricCard label="Total Subjects" value={subjects.length || "—"} tone="blue" icon="SU" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PanelCard title="Attendance overview">
          {!summary || totalDays === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No attendance records yet.</p>
          ) : (
            <DonutChart
              size={300}
              slices={[
                { label: "Present", value: Math.max(Math.round(presentDays), 0), color: "#14b8a6" },
                { label: "Absent", value: Math.max(absentDays, 0), color: "#f43f5e" },
              ]}
              centerValue={`${presentPct}%`}
              centerLabel="Present"
            />
          )}
          <div className="mt-4 text-right">
            <Link className="text-sm font-semibold text-teal-700 hover:text-teal-800" to={`${basePath}/attendance`}>
              View attendance details →
            </Link>
          </div>
        </PanelCard>

        <PanelCard title="Subject-wise attendance">
          {!summary || totalDays === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Charts appear once attendance is marked.</p>
          ) : (
            <BarChart
              categories={subjectChart.categories}
              series={[
                { label: "Present In Class", color: "#3b82f6", values: subjectChart.presentValues },
                { label: "Absent In Class", color: "#cbd5e1", values: subjectChart.absentValues },
              ]}
            />
          )}
        </PanelCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelCard
          title="Latest notices"
          action={
            <Link className="text-xs font-semibold text-teal-300 hover:text-white" to={`${basePath}/notices`}>
              View all
            </Link>
          }
        >
          {overview.notices.length === 0 ? (
            <p className="text-sm text-slate-500">No notices right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overview.notices.map((notice) => (
                <li className="py-3" key={notice.id}>
                  <p className="font-medium text-slate-900">{notice.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(notice.publishedAt).toLocaleDateString()} · {notice.audience}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        {showCms ? (
          <PanelCard
            title="Fee balance"
            action={
              <Link className="text-xs font-semibold text-teal-300 hover:text-white" to={`${basePath}/fees`}>
                Statement
              </Link>
            }
          >
            {!fees ? (
              <p className="text-sm text-slate-500">No fee assignments.</p>
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-slate-900">₹{fees.totals.balance.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Paid ₹{fees.totals.paid.toLocaleString()} · Base ₹{fees.totals.base.toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    fees.totals.balance > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {fees.totals.balance > 0 ? "Due" : "Clear"}
                </span>
              </div>
            )}
          </PanelCard>
        ) : showLms ? (
          <PanelCard
            title="Upcoming homework"
            action={
              <Link className="text-xs font-semibold text-teal-300 hover:text-white" to={`${basePath}/homework`}>
                View all
              </Link>
            }
          >
            {upcomingHomework.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing due soon.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingHomework.map((item) => (
                  <li className="py-3" key={item.id}>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">
                      {item.subject} · Due {new Date(item.submissionDate).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        ) : (
          <PanelCard title="Portal">
            <p className="text-sm text-slate-500">Your school workspace is ready.</p>
          </PanelCard>
        )}
      </div>

      <PanelCard
        title="Exam results"
        action={
          <Link className="text-xs font-semibold text-teal-300 hover:text-white" to={`${basePath}/exams`}>
            View all
          </Link>
        }
      >
        {exams.length === 0 ? (
          <p className="text-sm text-slate-500">No published results yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {exams.slice(0, 4).map((exam) => (
              <div
                className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                key={exam.examId}
              >
                <p className="font-semibold text-slate-900">
                  {exam.groupName} · {exam.examName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {exam.obtainedMarks} / {exam.maximumMarks} · {exam.percentage}%
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    exam.passStatus === "PASS" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {exam.passStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelCard>
    </div>
  );
}
