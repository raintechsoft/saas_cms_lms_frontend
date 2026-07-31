import type { Exam, ExamGroup, ExamStatus } from "./types";

export const today = new Date().toISOString().slice(0, 10);

export function toDateInput(value: string) {
  return value.slice(0, 10);
}

export function formatExamDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateRange(start: string, end: string) {
  return `${formatExamDate(start)} - ${formatExamDate(end)}`;
}

export function formatTime12(value: string) {
  const [hoursRaw, minutesRaw = "00"] = value.split(":");
  const hours = Number(hoursRaw);
  if (Number.isNaN(hours)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minutesRaw} ${suffix}`;
}

export function formatTimeRange(start: string, end: string) {
  return `${formatTime12(start)} - ${formatTime12(end)}`;
}

export function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return "—";
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function resultTypeLabel(resultType: string) {
  switch (resultType) {
    case "GENERAL":
      return "General Pass/Fail";
    case "SCHOOL_GRADING":
      return "School-Based Grading";
    case "COLLEGE_GRADING":
      return "College-Based Grading";
    case "GPA":
      return "GPA Grading";
    default:
      return resultType.replaceAll("_", " ");
  }
}

export function resultTypePillClass(resultType: string) {
  switch (resultType) {
    case "GENERAL":
      return "bg-blue-50 text-blue-700";
    case "SCHOOL_GRADING":
      return "bg-emerald-50 text-emerald-700";
    case "COLLEGE_GRADING":
      return "bg-amber-50 text-amber-700";
    case "GPA":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function groupStatus(group: ExamGroup): ExamStatus | "DRAFT" {
  const exams = group.exams;
  if (!exams.length) return "DRAFT";
  if (exams.some((exam) => exam.status === "PUBLISHED")) return "PUBLISHED";
  if (exams.every((exam) => exam.status === "ARCHIVED")) return "ARCHIVED";
  return "DRAFT";
}

export function groupStatusLabel(status: ExamStatus | "DRAFT") {
  if (status === "PUBLISHED") return "Published";
  if (status === "ARCHIVED") return "Archived";
  return "Draft";
}

export function groupStatusPillClass(status: ExamStatus | "DRAFT") {
  if (status === "PUBLISHED") return "nx-pill-success";
  if (status === "ARCHIVED") return "nx-pill-danger";
  return "nx-pill-neutral";
}

export function examStatusClass(status: ExamStatus) {
  if (status === "PUBLISHED") return "badge-success";
  if (status === "ARCHIVED") return "badge-danger";
  return "badge";
}

export type NestedExamRow = {
  key: string;
  exam: Exam;
  classSectionId: string;
  classLabel: string;
  subjectCount: number;
  dateStart: string;
  dateEnd: string;
  firstScheduleId: string | null;
};

export function nestedRowsForGroup(group: ExamGroup): NestedExamRow[] {
  const rows: NestedExamRow[] = [];
  for (const exam of group.exams) {
    const bySection = new Map<
      string,
      {
        classSectionId: string;
        classLabel: string;
        subjectIds: Set<string>;
        dates: string[];
        firstScheduleId: string | null;
      }
    >();
    for (const schedule of exam.schedules) {
      const sectionId = schedule.classSection.id;
      const current = bySection.get(sectionId) ?? {
        classSectionId: sectionId,
        classLabel: `${schedule.classSection.academicClass.name} - ${schedule.classSection.section.name}`,
        subjectIds: new Set<string>(),
        dates: [],
        firstScheduleId: null as string | null,
      };
      current.subjectIds.add(schedule.classSubject.id);
      current.dates.push(schedule.examDate);
      if (!current.firstScheduleId) current.firstScheduleId = schedule.id;
      bySection.set(sectionId, current);
    }
    if (!bySection.size) {
      rows.push({
        key: `${exam.id}:none`,
        exam,
        classSectionId: "",
        classLabel: "No class scheduled",
        subjectCount: 0,
        dateStart: exam.startDate,
        dateEnd: exam.endDate,
        firstScheduleId: null,
      });
      continue;
    }
    for (const section of bySection.values()) {
      const sorted = [...section.dates].sort();
      rows.push({
        key: `${exam.id}:${section.classSectionId}`,
        exam,
        classSectionId: section.classSectionId,
        classLabel: section.classLabel,
        subjectCount: section.subjectIds.size,
        dateStart: sorted[0] ?? exam.startDate,
        dateEnd: sorted[sorted.length - 1] ?? exam.endDate,
        firstScheduleId: section.firstScheduleId,
      });
    }
  }
  return rows;
}
