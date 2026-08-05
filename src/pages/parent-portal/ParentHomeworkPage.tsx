import { useMemo, useState } from "react";
import {
  AssignmentOutlined,
  BiotechOutlined,
  CalendarMonthOutlined,
  CalculateOutlined,
  CloudUploadOutlined,
  DownloadRounded,
  KeyboardArrowDownRounded,
  LanguageOutlined,
  MenuBookOutlined,
  PictureAsPdfOutlined,
  PublicOutlined,
  ScienceOutlined,
} from "@mui/icons-material";
import { Menu, MenuItem } from "@mui/material";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type HomeworkStatus = "Pending" | "Submitted" | "Late" | "Not Started";

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  teacher: string;
  assignedOn: string;
  dueDate: string;
  dueDay: string;
  status: HomeworkStatus;
  statusNote: string;
  teacherNote: string;
  attachment?: { name: string; size: string };
  submittedOn?: string;
}

const SUBJECT_STYLES: Record<string, { bg: string; text: string; Icon: typeof CalculateOutlined }> = {
  Mathematics: { bg: "#EEF2FF", text: "#4F46E5", Icon: CalculateOutlined },
  English: { bg: "#DCFCE7", text: "#15803D", Icon: LanguageOutlined },
  Science: { bg: "#FFEDD5", text: "#EA580C", Icon: ScienceOutlined },
  Hindi: { bg: "#FEF9C3", text: "#A16207", Icon: MenuBookOutlined },
  "Social Studies": { bg: "#FCE7F3", text: "#DB2777", Icon: PublicOutlined },
  Computer: { bg: "#DBEAFE", text: "#2563EB", Icon: BiotechOutlined },
};

const HOMEWORK: HomeworkItem[] = [
  {
    id: "hw-1",
    title: "Algebra Worksheet",
    description: "Complete exercises 1–15 on linear equations. Show all working steps.",
    subject: "Mathematics",
    teacher: "Mrs. Kapoor",
    assignedOn: "12 May 2025",
    dueDate: "18 May 2025",
    dueDay: "Sunday",
    status: "Pending",
    statusNote: "Due tomorrow",
    teacherNote: "Please show all steps clearly. Submit a neat PDF of your work before the due date.",
    attachment: { name: "Linear_Equations_Notes.pdf", size: "1.2 MB" },
  },
  {
    id: "hw-2",
    title: "Essay on My School",
    description: "Write a 300-word essay describing your school and favourite activities.",
    subject: "English",
    teacher: "Ms. D'Souza",
    assignedOn: "10 May 2025",
    dueDate: "16 May 2025",
    dueDay: "Friday",
    status: "Submitted",
    statusNote: "Submitted on 15 May",
    teacherNote: "Focus on structure: introduction, body, and conclusion.",
    attachment: { name: "Essay_Guidelines.pdf", size: "420 KB" },
    submittedOn: "15 May 2025",
  },
  {
    id: "hw-3",
    title: "Light – Ray Diagrams",
    description: "Draw ray diagrams for concave and convex mirrors for given object positions.",
    subject: "Science",
    teacher: "Mr. Mehta",
    assignedOn: "08 May 2025",
    dueDate: "14 May 2025",
    dueDay: "Wednesday",
    status: "Late",
    statusNote: "2 days late",
    teacherNote: "Label all diagrams carefully. Use a pencil and ruler.",
    attachment: { name: "Ray_Diagrams_Sheet.pdf", size: "860 KB" },
  },
  {
    id: "hw-4",
    title: "पत्र लेखन – औपचारिक पत्र",
    description: "Write a formal letter to the principal requesting leave for two days.",
    subject: "Hindi",
    teacher: "Mrs. Verma",
    assignedOn: "11 May 2025",
    dueDate: "19 May 2025",
    dueDay: "Monday",
    status: "Not Started",
    statusNote: "Not started",
    teacherNote: "Use the correct formal letter format taught in class.",
  },
  {
    id: "hw-5",
    title: "Map Work – Indian Rivers",
    description: "Mark major rivers of India on the outline map and label them neatly.",
    subject: "Social Studies",
    teacher: "Mr. Khan",
    assignedOn: "09 May 2025",
    dueDate: "17 May 2025",
    dueDay: "Saturday",
    status: "Pending",
    statusNote: "Due in 2 days",
    teacherNote: "Use blue for rivers and black for labels.",
    attachment: { name: "India_Outline_Map.pdf", size: "640 KB" },
  },
  {
    id: "hw-6",
    title: "Python Basics – Loops",
    description: "Write programs using for and while loops as listed in the worksheet.",
    subject: "Computer",
    teacher: "Ms. Patel",
    assignedOn: "07 May 2025",
    dueDate: "13 May 2025",
    dueDay: "Tuesday",
    status: "Submitted",
    statusNote: "Submitted on 12 May",
    teacherNote: "Include comments in your code explaining each loop.",
    attachment: { name: "Loops_Worksheet.pdf", size: "310 KB" },
    submittedOn: "12 May 2025",
  },
];

const SUBJECT_FILTERS = ["All Subjects", ...Object.keys(SUBJECT_STYLES)];
const DATE_RANGE = "12 May – 18 May 2025";

type FilterTab = "All" | "Pending" | "Submitted" | "Late";

function statusTone(status: HomeworkStatus): "orange" | "green" | "red" | "gray" {
  if (status === "Pending") return "orange";
  if (status === "Submitted") return "green";
  if (status === "Late") return "red";
  return "gray";
}

export function ParentHomeworkPage() {
  const { activeChild } = useParentPortal();
  const [tab, setTab] = useState<FilterTab>("All");
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");
  const [selectedId, setSelectedId] = useState<string>(HOMEWORK[0].id);
  const [subjectAnchor, setSubjectAnchor] = useState<HTMLElement | null>(null);

  const counts = useMemo(
    () => ({
      All: HOMEWORK.length,
      Pending: HOMEWORK.filter((h) => h.status === "Pending" || h.status === "Not Started").length,
      Submitted: HOMEWORK.filter((h) => h.status === "Submitted").length,
      Late: HOMEWORK.filter((h) => h.status === "Late").length,
    }),
    [],
  );

  const filtered = useMemo(() => {
    return HOMEWORK.filter((item) => {
      const matchSubject = subjectFilter === "All Subjects" || item.subject === subjectFilter;
      if (!matchSubject) return false;
      if (tab === "All") return true;
      if (tab === "Pending") return item.status === "Pending" || item.status === "Not Started";
      return item.status === tab;
    });
  }, [tab, subjectFilter]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "All", label: `All (${counts.All})` },
    { key: "Pending", label: `Pending (${counts.Pending})` },
    { key: "Submitted", label: `Submitted (${counts.Submitted})` },
    { key: "Late", label: `Late (${counts.Late})` },
  ];

  return (
    <div>
      <PageHeader
        title="Homework"
        subtitle="View and track homework assigned to your child."
        action={
          <button
            type="button"
            onClick={() => notifySuccess("All homework downloaded (demo)")}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:opacity-95"
            style={{ background: PARENT_PRIMARY }}
          >
            <DownloadRounded sx={{ fontSize: 17 }} />
            Download All Homework
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className="rounded-full px-3 py-1.5 text-[12px] font-bold transition"
                style={{
                  background: active ? PARENT_PRIMARY : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#4B5563",
                  border: active ? "1px solid transparent" : `1px solid ${PARENT_BORDER}`,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(e) => setSubjectAnchor(e.currentTarget)}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-[12.5px] font-semibold text-[#374151]"
            style={{ borderColor: PARENT_BORDER }}
          >
            {subjectFilter}
            <KeyboardArrowDownRounded sx={{ fontSize: 18, color: "#9CA3AF" }} />
          </button>
          <Menu anchorEl={subjectAnchor} open={Boolean(subjectAnchor)} onClose={() => setSubjectAnchor(null)}>
            {SUBJECT_FILTERS.map((option) => (
              <MenuItem
                key={option}
                selected={option === subjectFilter}
                onClick={() => {
                  setSubjectFilter(option);
                  setSubjectAnchor(null);
                }}
              >
                {option}
              </MenuItem>
            ))}
          </Menu>

          <div
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-[12.5px] font-semibold text-[#374151]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <CalendarMonthOutlined sx={{ fontSize: 16, color: PARENT_PRIMARY }} />
            {DATE_RANGE}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="mb-3 overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full border-collapse">
            <thead>
              <tr className="border-b bg-[#F9FAFB] text-left" style={{ borderColor: PARENT_BORDER }}>
                {["Homework", "Subject", "Assigned By", "Due Date", "Status", "Action"].map((col) => (
                  <th key={col} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const subjectStyle = SUBJECT_STYLES[item.subject] ?? SUBJECT_STYLES.Mathematics;
                const Icon = subjectStyle.Icon;
                const isSelected = selected?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    className="border-b transition-colors"
                    style={{
                      borderColor: PARENT_BORDER,
                      background: isSelected ? PARENT_PRIMARY_SUBTLE : "transparent",
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg"
                          style={{ background: subjectStyle.bg, color: subjectStyle.text }}
                        >
                          <Icon sx={{ fontSize: 17 }} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-[#1A1A2E]">{item.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-[#6B7280]">{item.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{ background: subjectStyle.bg, color: subjectStyle.text }}
                      >
                        {item.subject}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <InitialsAvatar name={item.teacher} size={26} />
                        <div>
                          <p className="text-[12px] font-semibold text-[#1A1A2E]">{item.teacher}</p>
                          <p className="text-[10.5px] text-[#9CA3AF]">{item.assignedOn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-[#1A1A2E]">{item.dueDate}</p>
                      <p className="text-[10.5px] text-[#9CA3AF]">{item.dueDay}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip label={item.status} tone={statusTone(item.status)} />
                      <p className="mt-0.5 text-[10.5px] font-medium text-[#6B7280]">{item.statusNote}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="rounded-lg border px-2.5 py-1 text-[11.5px] font-bold text-[#4F46E5] transition hover:bg-[#EEF2FF]"
                        style={{ borderColor: "#C7D2FE" }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                    No homework matches these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail card */}
      {selected && (
        <div
          className="rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AssignmentOutlined sx={{ fontSize: 20, color: PARENT_PRIMARY }} />
              <h2 className="text-[14.5px] font-bold text-[#1A1A2E]">{selected.title}</h2>
            </div>
            <StatusChip label={selected.status} tone={statusTone(selected.status)} />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Subject", value: selected.subject },
              { label: "Assigned By", value: selected.teacher },
              { label: "Assigned On", value: selected.assignedOn },
              { label: "Due Date", value: selected.dueDate, accent: true },
              { label: "Status", value: selected.status },
            ].map((field) => (
              <div key={field.label} className="rounded-xl bg-[#F9FAFB] px-2.5 py-2">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{field.label}</p>
                <p
                  className="mt-0.5 text-[12.5px] font-bold"
                  style={{ color: field.accent ? "#DC2626" : "#1A1A2E" }}
                >
                  {field.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {selected.attachment && (
                <div className="rounded-xl border p-3" style={{ borderColor: PARENT_BORDER }}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Attachments / References
                  </p>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-lg bg-[#FEE2E2] text-[#DC2626]">
                      <PictureAsPdfOutlined sx={{ fontSize: 18 }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-[#1A1A2E]">
                        {selected.attachment.name}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">{selected.attachment.size}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => notifySuccess("Attachment downloaded (demo)")}
                      className="grid size-8 place-items-center rounded-lg text-[#4F46E5] hover:bg-[#EEF2FF]"
                      aria-label="Download attachment"
                    >
                      <DownloadRounded sx={{ fontSize: 17 }} />
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-dashed p-3" style={{ borderColor: "#C7D2FE" }}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                  Submit Homework
                </p>
                <button
                  type="button"
                  onClick={() => notifySuccess(`Homework submitted for ${activeChild.name.split(" ")[0]} (demo)`)}
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  <CloudUploadOutlined sx={{ fontSize: 17 }} />
                  Upload File
                </button>
                <p className="mt-1.5 text-[11px] text-[#6B7280]">PDF, DOC, DOCX up to 10 MB</p>
              </div>
            </div>

            <div className="rounded-xl border p-3" style={{ borderColor: PARENT_BORDER, background: "#F8FAFC" }}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                Teacher&apos;s Note
              </p>
              <p className="text-[13px] leading-relaxed text-[#374151]">{selected.teacherNote}</p>
              {selected.submittedOn && (
                <p className="mt-2 text-[11.5px] font-semibold text-[#16A34A]">
                  Submitted on {selected.submittedOn}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
