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
    case "classes":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "subjects":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "subject-groups":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "class-timetable":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "electives":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "teacher-timetable":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "promote":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "scholars":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
      };
    case "bulk-update":
      return {
        title: "Academics",
        description: "Manage classes, sections, subjects, and academic operations.",
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
