import type { AcademicsTab, Named, Weekday } from "./types";

export const WEEKDAYS: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function studentDisplayName(student: { firstName: string; lastName?: string | null }) {
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

export function classSectionLabel(cs: { academicClass: Named; section: Named }) {
  return `${cs.academicClass.name} · ${cs.section.name}`;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
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

export function headerForTab(tab: AcademicsTab) {
  switch (tab) {
    case "sections":
      return {
        title: "Sections",
        description: "Create and manage academic sections used across classes.",
      };
    case "classes":
      return {
        title: "Class",
        description: "Add classes, link sections, and set RFID attendance times.",
      };
    case "incharge":
      return {
        title: "Assign Class Incharge",
        description: "Assign a class teacher to each class-section.",
      };
    case "elective-categories":
      return {
        title: "Elective Subject Category",
        description: "Define elective categories and how many subjects students may select.",
      };
    case "subjects":
      return {
        title: "Subjects",
        description: "Manage core and elective subjects for the academic structure.",
      };
    case "assign-subjects":
      return {
        title: "Assign Subjects",
        description:
          "Link subjects and teachers to each class-section for timetable, homework, and exams.",
      };
    case "subject-groups":
      return {
        title: "Subject Group",
        description: "Group class subjects for timetable and elective assignment.",
      };
    case "assign-electives":
      return {
        title: "Assign Elective Subjects",
        description: "Assign elective subject choices to students by class section.",
      };
    case "class-timetable":
      return {
        title: "Class Timetable",
        description: "Build and manage the weekly timetable for each class section.",
      };
    case "teacher-timetable":
      return {
        title: "Teachers Timetable",
        description: "View teacher schedules across weekdays and periods.",
      };
    case "promote":
      return {
        title: "Promote Students",
        description: "Promote or leave students for the next academic session.",
      };
    case "scholars":
      return {
        title: "School Scholars",
        description: "Track scholarship awards, amounts, and final percentages.",
      };
    case "student-details":
      return {
        title: "Update Student Details",
        description: "Bulk-update student profile fields for a class section.",
      };
    case "section-update":
      return {
        title: "Std Section Update",
        description: "Move students between sections within the same class.",
      };
    case "reports":
      return {
        title: "Academic Reports",
        description: "Generate and export academic reports across sessions and classes.",
      };
    default:
      return { title: "Academics", description: "Manage academic structure." };
  }
}
