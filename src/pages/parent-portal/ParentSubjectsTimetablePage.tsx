import { useState } from "react";
import {
  BiotechOutlined,
  CalculateOutlined,
  CalendarMonthOutlined,
  KeyboardArrowDownRounded,
  InfoOutlined,
  LanguageOutlined,
  MenuBookOutlined,
  PublicOutlined,
  ScienceOutlined,
} from "@mui/icons-material";
import { LinearProgress, Menu, MenuItem } from "@mui/material";
import { PageHeader } from "./components/PageHeader";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type Category = "core" | "language" | "science" | "other";

const CATEGORY_META: Record<Category, { label: string; bg: string; text: string; bar: string; dot: string }> = {
  core: { label: "Core Subject", bg: "#EEF2FF", text: "#4338CA", bar: "#4F46E5", dot: "#6366F1" },
  language: { label: "Language", bg: "#DBEAFE", text: "#1D4ED8", bar: "#2563EB", dot: "#3B82F6" },
  science: { label: "Science", bg: "#DCFCE7", text: "#15803D", bar: "#16A34A", dot: "#22C55E" },
  other: { label: "Other", bg: "#FFEDD5", text: "#C2410C", bar: "#EA580C", dot: "#F97316" },
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const PERIODS = [
  { id: 1, time: "08:00 - 08:45" },
  { id: 2, time: "08:50 - 09:35" },
  { id: 3, time: "09:40 - 10:25" },
  { id: 4, time: "10:45 - 11:30" },
  { id: 5, time: "11:35 - 12:20" },
  { id: 6, time: "12:25 - 13:10" },
] as const;

type Cell = { subject: string; teacher: string; category: Category } | null;

const TIMETABLE: Record<(typeof DAYS)[number], Cell[]> = {
  Mon: [
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "Science", teacher: "Mr. Mehta", category: "science" },
    { subject: "English", teacher: "Ms. D'Souza", category: "language" },
    { subject: "Hindi", teacher: "Mrs. Verma", category: "language" },
    { subject: "Social Studies", teacher: "Mr. Khan", category: "core" },
    { subject: "Computer", teacher: "Ms. Patel", category: "other" },
  ],
  Tue: [
    { subject: "Science", teacher: "Mr. Mehta", category: "science" },
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "PT", teacher: "Coach Rao", category: "other" },
    { subject: "English", teacher: "Ms. D'Souza", category: "language" },
    { subject: "Art", teacher: "Ms. Iyer", category: "other" },
    { subject: "Hindi", teacher: "Mrs. Verma", category: "language" },
  ],
  Wed: [
    { subject: "English", teacher: "Ms. D'Souza", category: "language" },
    { subject: "Social Studies", teacher: "Mr. Khan", category: "core" },
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "Science", teacher: "Mr. Mehta", category: "science" },
    { subject: "Computer", teacher: "Ms. Patel", category: "other" },
    null,
  ],
  Thu: [
    { subject: "Hindi", teacher: "Mrs. Verma", category: "language" },
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "Science", teacher: "Mr. Mehta", category: "science" },
    { subject: "English", teacher: "Ms. D'Souza", category: "language" },
    { subject: "Library", teacher: "Mrs. Bose", category: "other" },
    { subject: "Social Studies", teacher: "Mr. Khan", category: "core" },
  ],
  Fri: [
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "English", teacher: "Ms. D'Souza", category: "language" },
    { subject: "Science Lab", teacher: "Mr. Mehta", category: "science" },
    { subject: "PT", teacher: "Coach Rao", category: "other" },
    { subject: "Hindi", teacher: "Mrs. Verma", category: "language" },
    { subject: "Music", teacher: "Mr. Nair", category: "other" },
  ],
  Sat: [
    { subject: "Club Activity", teacher: "Various", category: "other" },
    { subject: "Mathematics", teacher: "Mrs. Kapoor", category: "core" },
    { subject: "Science", teacher: "Mr. Mehta", category: "science" },
    { subject: "Assembly", teacher: "Class Teacher", category: "other" },
    null,
    null,
  ],
};

const SUBJECTS = [
  {
    id: "math",
    name: "Mathematics",
    teacher: "Mrs. Kapoor",
    completion: 78,
    category: "core" as Category,
    Icon: CalculateOutlined,
  },
  {
    id: "sci",
    name: "Science",
    teacher: "Mr. Mehta",
    completion: 65,
    category: "science" as Category,
    Icon: ScienceOutlined,
  },
  {
    id: "eng",
    name: "English",
    teacher: "Ms. D'Souza",
    completion: 82,
    category: "language" as Category,
    Icon: LanguageOutlined,
  },
  {
    id: "hin",
    name: "Hindi",
    teacher: "Mrs. Verma",
    completion: 70,
    category: "language" as Category,
    Icon: MenuBookOutlined,
  },
  {
    id: "sst",
    name: "Social Studies",
    teacher: "Mr. Khan",
    completion: 58,
    category: "core" as Category,
    Icon: PublicOutlined,
  },
  {
    id: "cs",
    name: "Computer",
    teacher: "Ms. Patel",
    completion: 90,
    category: "other" as Category,
    Icon: BiotechOutlined,
  },
];

const WEEK_OPTIONS = ["This Week", "Next Week", "Last Week"];

export function ParentSubjectsTimetablePage() {
  const { activeChild } = useParentPortal();
  const firstName = activeChild.name.split(" ")[0];
  const [weekLabel, setWeekLabel] = useState(WEEK_OPTIONS[0]);
  const [weekAnchor, setWeekAnchor] = useState<HTMLElement | null>(null);

  return (
    <div>
      <PageHeader
        title="Subjects & Timetable"
        subtitle={`Weekly schedule and syllabus progress for ${firstName} · ${activeChild.className} - ${activeChild.section}`}
        action={
          <>
            <button
              type="button"
              onClick={(e) => setWeekAnchor(e.currentTarget)}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-[13px] font-semibold text-[#1A1A2E] shadow-[0_2px_8px_rgba(28,27,60,0.04)] transition hover:bg-[#F9FAFB]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <CalendarMonthOutlined sx={{ fontSize: 18, color: PARENT_PRIMARY }} />
              {weekLabel}
              <KeyboardArrowDownRounded sx={{ fontSize: 18, color: "#9CA3AF" }} />
            </button>
            <Menu anchorEl={weekAnchor} open={Boolean(weekAnchor)} onClose={() => setWeekAnchor(null)}>
              {WEEK_OPTIONS.map((option) => (
                <MenuItem
                  key={option}
                  selected={option === weekLabel}
                  onClick={() => {
                    setWeekLabel(option);
                    setWeekAnchor(null);
                  }}
                >
                  {option}
                </MenuItem>
              ))}
            </Menu>
          </>
        }
      />

      {/* Weekly Timetable */}
      <div
        className="mb-4 overflow-hidden rounded-2xl border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-3" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[14px] font-bold text-[#1A1A2E]">Weekly Timetable</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {(Object.keys(CATEGORY_META) as Category[]).map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
                <span className="size-1.5 rounded-full" style={{ background: CATEGORY_META[key].dot }} />
                {CATEGORY_META[key].label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto p-3">
          <div className="min-w-[820px]">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `96px repeat(${DAYS.length}, minmax(0, 1fr))` }}
            >
              <div className="flex items-end px-2 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                Period
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="rounded-lg px-2 py-2 text-center text-[12px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  {day}
                </div>
              ))}

              {PERIODS.map((period, periodIndex) => (
                <div key={period.id} className="contents">
                  <div className="flex flex-col justify-center rounded-lg bg-[#F8FAFC] px-2 py-2">
                    <span className="text-[12px] font-extrabold text-[#1A1A2E]">{period.id}</span>
                    <span className="mt-0.5 text-[9.5px] font-medium leading-tight text-[#9CA3AF]">{period.time}</span>
                  </div>
                  {DAYS.map((day) => {
                    const cell = TIMETABLE[day][periodIndex];
                    if (!cell) {
                      return (
                        <div
                          key={`${day}-${period.id}`}
                          className="flex items-center justify-center rounded-lg border border-dashed bg-[#FAFBFC] px-2 py-2 text-[11px] text-[#D1D5DB]"
                          style={{ borderColor: "#E5E7EB" }}
                        >
                          —
                        </div>
                      );
                    }
                    const meta = CATEGORY_META[cell.category];
                    return (
                      <div
                        key={`${day}-${period.id}`}
                        className="rounded-lg px-2 py-2"
                        style={{ background: meta.bg }}
                      >
                        <p className="text-[11.5px] font-bold leading-snug" style={{ color: meta.text }}>
                          {cell.subject}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-[#6B7280]">{cell.teacher}</p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Subjects Overview */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[#1A1A2E]">Subjects Overview & Syllabus Progress</h2>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECTS.map((subject) => {
          const meta = CATEGORY_META[subject.category];
          const Icon = subject.Icon;
          return (
            <div
              key={subject.id}
              className="flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="mb-3 flex items-start gap-2.5">
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: meta.bg, color: meta.text }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-[#1A1A2E]">{subject.name}</p>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">{subject.teacher}</p>
                </div>
              </div>

              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-[#6B7280]">Syllabus Completed</p>
                <p className="text-[12px] font-bold" style={{ color: meta.bar }}>
                  {subject.completion}%
                </p>
              </div>
              <LinearProgress
                variant="determinate"
                value={subject.completion}
                sx={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: "#F3F4F6",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    backgroundColor: meta.bar,
                  },
                }}
              />

              <button
                type="button"
                className="mt-3 w-full rounded-xl border py-1.5 text-[12px] font-semibold text-[#4B5563] transition hover:bg-[#F9FAFB]"
                style={{ borderColor: PARENT_BORDER }}
              >
                View Details
              </button>
            </div>
          );
        })}
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 sm:items-center"
        style={{ background: PARENT_PRIMARY_SUBTLE }}
      >
        <InfoOutlined sx={{ fontSize: 18, color: PARENT_PRIMARY, marginTop: "1px" }} />
        <p className="text-[12.5px] font-medium leading-snug text-[#4338CA]">
          Timetable is effective from 15 May 2025. Please contact the school for any changes.
        </p>
      </div>
    </div>
  );
}
