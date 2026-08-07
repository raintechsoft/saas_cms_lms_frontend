import { useMemo, useState } from "react";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import type { PortalExamItem } from "../student-parent/portalTypes";

type TabKey = "upcoming" | "results";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function gradeFromPercentage(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "E";
}

export function ParentExaminationPage() {
  const { activeChild, portalChild } = useParentPortal();
  const [tab, setTab] = useState<TabKey>("results");
  const exams = portalChild?.exams ?? [];

  const { upcoming, results } = useMemo(() => {
    const now = Date.now() - 86400000;
    const up: PortalExamItem[] = [];
    const done: PortalExamItem[] = [];
    for (const exam of exams) {
      if (exam.examDate && new Date(exam.examDate).getTime() >= now && !exam.publishedAt) {
        up.push(exam);
      } else {
        done.push(exam);
      }
    }
    up.sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
    done.sort((a, b) => String(b.publishedAt ?? b.examDate).localeCompare(String(a.publishedAt ?? a.examDate)));
    return { upcoming: up, results: done };
  }, [exams]);

  const selected = results[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Examination & Results"
        subtitle={`Exam schedule and published results for ${activeChild.name}.`}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["upcoming", "Upcoming"],
            ["results", "Results"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-bold transition"
            style={{
              background: tab === key ? PARENT_PRIMARY : PARENT_PRIMARY_SUBTLE,
              color: tab === key ? "#fff" : PARENT_PRIMARY,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "upcoming" ? (
        <section
          className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          {upcoming.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">
              No upcoming exams found. Published results appear under Results.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: PARENT_BORDER }}>
              {upcoming.map((exam) => (
                <li key={exam.examId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-[14px] font-bold text-[#1A1A2E]">{exam.examName}</p>
                    <p className="text-[12px] text-[#6B7280]">
                      {exam.groupName} · {formatDate(exam.examDate)}
                    </p>
                  </div>
                  <StatusChip label="Scheduled" tone="blue" />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {results.length === 0 ? (
            <p
              className="rounded-[20px] border bg-white px-5 py-12 text-center text-[13px] text-[#6B7280]"
              style={{ borderColor: PARENT_BORDER }}
            >
              No published exam results yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
              <aside
                className="rounded-[20px] border bg-white p-3 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
                style={{ borderColor: PARENT_BORDER }}
              >
                <p className="px-2 pb-2 text-[12px] font-bold uppercase tracking-wide text-[#6B7280]">
                  Exams
                </p>
                <ul className="space-y-1">
                  {results.map((exam) => (
                    <li
                      key={exam.examId}
                      className="rounded-xl px-3 py-2.5"
                      style={{ background: selected?.examId === exam.examId ? PARENT_PRIMARY_SUBTLE : undefined }}
                    >
                      <p className="text-[13px] font-bold text-[#1A1A2E]">{exam.examName}</p>
                      <p className="text-[11px] text-[#6B7280]">
                        {exam.groupName} · {exam.percentage.toFixed(1)}%
                      </p>
                    </li>
                  ))}
                </ul>
              </aside>

              {selected && (
                <section
                  className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-extrabold text-[#1A1A2E]">{selected.examName}</h2>
                      <p className="mt-0.5 text-[12px] text-[#6B7280]">
                        {selected.groupName} · {formatDate(selected.publishedAt ?? selected.examDate)}
                      </p>
                    </div>
                    <StatusChip
                      label={selected.passStatus === "PASS" ? "Pass" : "Fail"}
                      tone={selected.passStatus === "PASS" ? "green" : "red"}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-[#F9FAFB] px-3 py-3">
                      <p className="text-[11px] font-semibold text-[#6B7280]">Overall</p>
                      <p className="mt-1 text-[20px] font-extrabold text-[#4F46E5]">
                        {selected.percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] px-3 py-3">
                      <p className="text-[11px] font-semibold text-[#6B7280]">Grade</p>
                      <p className="mt-1 text-[20px] font-extrabold text-[#1A1A2E]">
                        {gradeFromPercentage(selected.percentage)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] px-3 py-3">
                      <p className="text-[11px] font-semibold text-[#6B7280]">Obtained</p>
                      <p className="mt-1 text-[20px] font-extrabold text-[#1A1A2E]">
                        {selected.obtainedMarks}/{selected.maximumMarks}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F9FAFB] px-3 py-3">
                      <p className="text-[11px] font-semibold text-[#6B7280]">Subjects</p>
                      <p className="mt-1 text-[20px] font-extrabold text-[#1A1A2E]">
                        {selected.subjects.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b text-[12px] text-[#6B7280]" style={{ borderColor: PARENT_BORDER }}>
                          <th className="py-2 font-bold">Subject</th>
                          <th className="py-2 font-bold">Marks</th>
                          <th className="py-2 font-bold">Max</th>
                          <th className="py-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.subjects.map((subject) => (
                          <tr key={subject.subject} className="border-b" style={{ borderColor: PARENT_BORDER }}>
                            <td className="py-2.5 font-semibold text-[#1A1A2E]">{subject.subject}</td>
                            <td className="py-2.5">{subject.isAbsent ? "—" : subject.marksObtained}</td>
                            <td className="py-2.5">{subject.maximumMarks}</td>
                            <td className="py-2.5">
                              {subject.isAbsent ? (
                                <StatusChip label="Absent" tone="red" />
                              ) : (
                                <StatusChip label="Marked" tone="green" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
