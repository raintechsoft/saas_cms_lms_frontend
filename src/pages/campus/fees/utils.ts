import type { FeeDue, FeeSetup, FeesTab, PaymentMode, Student, StudentClassInfo } from "./types";

export const PAYMENT_MODES: PaymentMode[] = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
  "CHEQUE",
  "ONLINE",
  "OTHER",
];

export const today = new Date().toISOString().slice(0, 10);

export const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function studentDisplayName(student: Student) {
  return [student.firstName, student.lastName].filter(Boolean).join(" ");
}

export function buildStudentClassMap(setup: FeeSetup): Map<string, StudentClassInfo> {
  const map = new Map<string, StudentClassInfo>();
  setup.classSections.forEach((cs) => {
    cs.enrollments.forEach(({ student }) => {
      map.set(student.id, {
        className: cs.academicClass.name,
        sectionName: cs.section.name,
        classSectionId: cs.id,
      });
    });
  });
  return map;
}

export function overdueDays(dueDate: string) {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function overduePill(dueDate: string) {
  const days = overdueDays(dueDate);
  if (days > 30) {
    return { label: `${days}d overdue`, className: "nx-pill nx-pill-danger" };
  }
  if (days > 0) {
    return { label: `${days}d overdue`, className: "nx-pill nx-pill-warning" };
  }
  if (days === 0) {
    return { label: "Due today", className: "nx-pill nx-pill-indigo" };
  }
  return { label: `Due in ${Math.abs(days)}d`, className: "nx-pill nx-pill-neutral" };
}

export function headerForTab(tab: FeesTab) {
  switch (tab) {
    case "search":
      return {
        title: "Payment Search",
        description:
          "Retrieve student payment records and digital receipts using unique Transaction IDs.",
      };
    case "carry":
      return {
        title: "Session Carry Forward",
        description:
          "Manage student balances moving from previous academic session to the current session.",
      };
    case "reminders":
      return {
        title: "Auto Reminders",
        description: "Configure automated schedule for payment due notices and overdue reminders.",
      };
    case "receipts":
      return {
        title: "Receipts Management",
        description: "View and manage fee collection receipts generated for students.",
      };
    case "custom":
      return {
        title: "Custom Fees",
        description: "Configure and manage individual or group-based custom fee structures.",
      };
    case "invoices":
      return {
        title: "Fees Management",
        description:
          "Manage student billing, arrears, receipt generation, and automated financial reminders.",
      };
    case "discounts":
      return {
        title: "DISCOUNT",
        description: "Manage scholarship, sibling, and custom fee discounts.",
      };
    case "structure":
      return {
        title: "Fees Management",
        description: "Configure fee type, fee group, and fee master structures.",
      };
    default:
      return {
        title: "Due Fees List",
        description: "Monitor and manage outstanding student fee records across all departments.",
      };
  }
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

export function exportDuesCsv(
  dues: FeeDue[],
  classMap: Map<string, StudentClassInfo>,
) {
  downloadCsv(
    "due-fees.csv",
    ["student", "admissionNumber", "class", "section", "feeType", "dueDate", "balance", "paid", "base"],
    dues.map((due) => {
      const info = classMap.get(due.student.id);
      return [
        studentDisplayName(due.student),
        due.student.admissionNumber,
        info?.className ?? "",
        info?.sectionName ?? "",
        due.feeMaster.feeType.name,
        due.feeMaster.dueDate.slice(0, 10),
        String(due.totals.balance),
        String(due.totals.paid),
        String(due.totals.base),
      ];
    }),
  );
}
