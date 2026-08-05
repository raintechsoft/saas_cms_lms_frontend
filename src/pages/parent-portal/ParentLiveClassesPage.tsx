import { useMemo, useState } from "react";
import { PlayCircleOutlineRounded, VideocamOutlined } from "@mui/icons-material";
import { FormControl, MenuItem, Select } from "@mui/material";
import { notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY } from "./ParentPortalLayout";

type ClassStatus = "Live" | "Upcoming" | "Ended";

interface LiveClass {
  id: string;
  subject: string;
  teacher: string;
  time: string;
  status: ClassStatus;
  topic: string;
}

interface Recording {
  id: string;
  subject: string;
  teacher: string;
  title: string;
  date: string;
  duration: string;
  thumbnailTone: string;
}

const TODAY: LiveClass[] = [
  {
    id: "lc-1",
    subject: "Mathematics",
    teacher: "Mrs. Kapoor",
    time: "08:00 – 08:45 AM",
    status: "Ended",
    topic: "Quadratic Equations – Completing the square",
  },
  {
    id: "lc-2",
    subject: "Science",
    teacher: "Mr. Mehta",
    time: "10:45 – 11:30 AM",
    status: "Live",
    topic: "Light – Refraction through a glass slab",
  },
  {
    id: "lc-3",
    subject: "English",
    teacher: "Ms. D'Souza",
    time: "12:25 – 01:10 PM",
    status: "Upcoming",
    topic: "Poetry appreciation – The Road Not Taken",
  },
  {
    id: "lc-4",
    subject: "Computer",
    teacher: "Ms. Patel",
    time: "02:00 – 02:45 PM",
    status: "Upcoming",
    topic: "Python – Nested loops practice",
  },
];

const RECORDINGS: Recording[] = [
  {
    id: "rec-1",
    subject: "Mathematics",
    teacher: "Mrs. Kapoor",
    title: "Quadratic Equations – Factorisation",
    date: "4 Aug 2026",
    duration: "42 min",
    thumbnailTone: "#EEF2FF",
  },
  {
    id: "rec-2",
    subject: "Science",
    teacher: "Mr. Mehta",
    title: "Human Eye – Structure & Defects",
    date: "3 Aug 2026",
    duration: "38 min",
    thumbnailTone: "#ECFDF5",
  },
  {
    id: "rec-3",
    subject: "English",
    teacher: "Ms. D'Souza",
    title: "Grammar – Active & Passive Voice",
    date: "2 Aug 2026",
    duration: "35 min",
    thumbnailTone: "#FFF7ED",
  },
  {
    id: "rec-4",
    subject: "Hindi",
    teacher: "Mrs. Verma",
    title: "व्याकरण – समास",
    date: "1 Aug 2026",
    duration: "40 min",
    thumbnailTone: "#FEF3C7",
  },
  {
    id: "rec-5",
    subject: "Social Studies",
    teacher: "Mr. Khan",
    title: "Indian Freedom Struggle – 1857",
    date: "31 Jul 2026",
    duration: "45 min",
    thumbnailTone: "#FCE7F3",
  },
  {
    id: "rec-6",
    subject: "Computer",
    teacher: "Ms. Patel",
    title: "Intro to Functions in Python",
    date: "30 Jul 2026",
    duration: "36 min",
    thumbnailTone: "#E0E7FF",
  },
];

function statusTone(status: ClassStatus): "red" | "orange" | "gray" {
  if (status === "Live") return "red";
  if (status === "Upcoming") return "orange";
  return "gray";
}

export function ParentLiveClassesPage() {
  const { activeChild } = useParentPortal();
  const firstName = activeChild.name.split(" ")[0];
  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(RECORDINGS.map((r) => r.subject)))],
    [],
  );
  const [subjectFilter, setSubjectFilter] = useState("All");

  const filteredRecordings = useMemo(() => {
    if (subjectFilter === "All") return RECORDINGS;
    return RECORDINGS.filter((r) => r.subject === subjectFilter);
  }, [subjectFilter]);

  return (
    <div>
      <PageHeader
        title="Live Classes"
        subtitle={`Today's schedule and past recordings for ${firstName}`}
      />

      <div
        className="mb-5 rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="mb-3 text-[15px] font-bold text-[#1A1A2E]">Today&apos;s Schedule</h2>
        <div className="flex flex-col gap-3">
          {TODAY.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-bold text-[#1A1A2E]">{item.subject}</p>
                  <StatusChip label={item.status} tone={statusTone(item.status)} />
                </div>
                <p className="text-[12.5px] text-[#6B7280]">
                  {item.time} · {item.teacher}
                </p>
                <p className="mt-1 text-[13px] text-[#374151]">{item.topic}</p>
              </div>
              {item.status === "Live" || item.status === "Upcoming" ? (
                <button
                  type="button"
                  onClick={() =>
                    notifySuccess(
                      item.status === "Live"
                        ? `Joining ${item.subject} class…`
                        : `${item.subject} class opens at start time`,
                    )
                  }
                  disabled={item.status === "Upcoming"}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: PARENT_PRIMARY }}
                >
                  <VideocamOutlined sx={{ fontSize: 18 }} />
                  Join
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => notifySuccess(`Opening recording for ${item.subject}`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13px] font-bold text-[#4F46E5]"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  <PlayCircleOutlineRounded sx={{ fontSize: 18 }} />
                  View Recording
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[#1A1A2E]">Past Recordings</h2>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            displayEmpty
            sx={{
              borderRadius: "12px",
              fontSize: 13,
              fontWeight: 600,
              ".MuiOutlinedInput-notchedOutline": { borderColor: PARENT_BORDER },
            }}
          >
            {subjects.map((subject) => (
              <MenuItem key={subject} value={subject}>
                {subject === "All" ? "All subjects" : subject}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredRecordings.map((rec) => (
          <div
            key={rec.id}
            className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div
              className="relative flex h-32 items-center justify-center"
              style={{ background: rec.thumbnailTone }}
            >
              <PlayCircleOutlineRounded sx={{ fontSize: 48, color: PARENT_PRIMARY, opacity: 0.85 }} />
              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                {rec.duration}
              </span>
            </div>
            <div className="p-4">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#4F46E5]">
                {rec.subject}
              </p>
              <h3 className="mt-1 text-[14px] font-bold text-[#1A1A2E]">{rec.title}</h3>
              <p className="mt-1 text-[12.5px] text-[#6B7280]">
                {rec.teacher} · {rec.date}
              </p>
              <button
                type="button"
                onClick={() => notifySuccess(`Playing “${rec.title}”`)}
                className="mt-3 text-[13px] font-bold text-[#4F46E5] hover:underline"
              >
                Watch Recording
              </button>
            </div>
          </div>
        ))}
        {filteredRecordings.length === 0 && (
          <div
            className="col-span-full rounded-[20px] border bg-white px-6 py-12 text-center text-sm text-[#6B7280] shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            No recordings for this subject.
          </div>
        )}
      </div>
    </div>
  );
}
