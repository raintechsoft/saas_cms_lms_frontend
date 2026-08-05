import { useMemo, useState } from "react";
import { CampaignOutlined, CloseRounded } from "@mui/icons-material";
import { Dialog, DialogContent, Tab, Tabs } from "@mui/material";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";

type NoticeCategory = "Circulars" | "Events" | "Fee Alerts" | "Exam Alerts";
type TabKey = "All" | NoticeCategory;

interface Notice {
  id: string;
  title: string;
  description: string;
  fullBody: string;
  date: string;
  category: NoticeCategory;
}

const MOCK_NOTICES: Notice[] = [
  {
    id: "n1",
    title: "Uniform Guidelines Update",
    description: "Updated dress code and winter uniform schedule for Classes 1–10.",
    fullBody:
      "Dear Parents,\n\nPlease note the updated uniform guidelines effective from 1 June 2025. Winter blazers are mandatory on Mondays and Fridays. Detailed circular is available at the school office.\n\nRegards,\nPrincipal's Office",
    date: "28 May 2025",
    category: "Circulars",
  },
  {
    id: "n2",
    title: "Annual Sports Day 2025",
    description: "Join us for athletic events and team spirit on the main ground.",
    fullBody:
      "Annual Sports Day will be held on 15 June 2025 from 8:00 AM to 1:00 PM on the main ground. Parents are cordially invited. Students should report in sports kit by 7:30 AM.",
    date: "24 May 2025",
    category: "Events",
  },
  {
    id: "n3",
    title: "Term Fee Reminder — Q1",
    description: "Q1 tuition fee is due before 25 May. Online payment is preferred.",
    fullBody:
      "This is a reminder that Q1 tuition fees are due on or before 25 May 2025. Please pay via the Fees & Payments section. Late fee of ₹200/day applies after the due date.",
    date: "20 May 2025",
    category: "Fee Alerts",
  },
  {
    id: "n4",
    title: "Unit Test 2 Schedule Released",
    description: "Class 8 Unit Test 2 timetable is now available for download.",
    fullBody:
      "Unit Test 2 for Class 8 will begin on 28 May 2025. Subjects: Maths, Science, English, Social Studies. Please ensure your child revises thoroughly. Hall tickets will be issued next week.",
    date: "18 May 2025",
    category: "Exam Alerts",
  },
  {
    id: "n5",
    title: "Science Exhibition Invitation",
    description: "Students from Class 6–10 will showcase projects in the auditorium.",
    fullBody:
      "You are invited to the Science Exhibition on 15 May 2025, 9:00 AM – 1:00 PM in the school auditorium. Refreshments will be served for visiting parents.",
    date: "12 May 2025",
    category: "Events",
  },
  {
    id: "n6",
    title: "Library Book Return Notice",
    description: "All borrowed books must be returned before summer vacation.",
    fullBody:
      "Parents are requested to ensure all library books are returned by 5 June 2025. Overdue charges will apply thereafter. Contact the library desk for renewals.",
    date: "10 May 2025",
    category: "Circulars",
  },
  {
    id: "n7",
    title: "Transport Fee Adjustment",
    description: "Updated transport fee slab for Route B effective June.",
    fullBody:
      "Due to revised fuel costs, Route B transport fee will increase by ₹300/month from June 2025. The revised amount will reflect in your next fee invoice.",
    date: "8 May 2025",
    category: "Fee Alerts",
  },
  {
    id: "n8",
    title: "Pre-Board Exam Guidelines",
    description: "Important instructions for Classes 9–10 pre-board examinations.",
    fullBody:
      "Pre-board exams start 2 June 2025. Students must carry hall tickets and school ID. Electronic devices are prohibited in exam halls. Reporting time is 8:15 AM sharp.",
    date: "5 May 2025",
    category: "Exam Alerts",
  },
];

const TABS: TabKey[] = ["All", "Circulars", "Events", "Fee Alerts", "Exam Alerts"];

const CATEGORY_TONE: Record<NoticeCategory, "purple" | "orange" | "red" | "blue"> = {
  Circulars: "purple",
  Events: "orange",
  "Fee Alerts": "red",
  "Exam Alerts": "blue",
};

export function ParentAnnouncementsPage() {
  const { activeChild } = useParentPortal();
  const [tab, setTab] = useState<TabKey>("All");
  const [selected, setSelected] = useState<Notice | null>(null);

  const filtered = useMemo(
    () => (tab === "All" ? MOCK_NOTICES : MOCK_NOTICES.filter((n) => n.category === tab)),
    [tab],
  );

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle={`School notices and alerts for ${activeChild.name.split(" ")[0]}`}
      />

      <div
        className="mb-5 rounded-[20px] border bg-white px-2 pt-1 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:px-4"
        style={{ borderColor: PARENT_BORDER }}
      >
        <Tabs
          value={tab}
          onChange={(_, value: TabKey) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 48,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13.5,
              minHeight: 48,
              color: "#6B7280",
            },
            "& .Mui-selected": { color: `${PARENT_PRIMARY} !important` },
            "& .MuiTabs-indicator": { backgroundColor: PARENT_PRIMARY, height: 3, borderRadius: 2 },
          }}
        >
          {TABS.map((t) => (
            <Tab key={t} label={t} value={t} />
          ))}
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((notice) => (
          <article
            key={notice.id}
            className="flex flex-col rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div
                className="grid size-11 shrink-0 place-items-center rounded-2xl"
                style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
              >
                <CampaignOutlined sx={{ fontSize: 22 }} />
              </div>
              <StatusChip label={notice.category} tone={CATEGORY_TONE[notice.category]} />
            </div>
            <h2 className="text-[15px] font-bold text-[#1A1A2E]">{notice.title}</h2>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6B7280]">{notice.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
              <span className="text-[12px] font-medium text-[#9CA3AF]">{notice.date}</span>
              <button
                type="button"
                onClick={() => setSelected(notice)}
                className="text-[12.5px] font-semibold hover:underline"
                style={{ color: PARENT_PRIMARY }}
              >
                View full notice
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="rounded-[20px] border bg-white p-10 text-center text-[14px] text-[#6B7280] shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          No announcements in this category.
        </div>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogContent className="!p-0">
          {selected && (
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <StatusChip label={selected.category} tone={CATEGORY_TONE[selected.category]} />
                  <h2 className="mt-3 text-[18px] font-extrabold text-[#1A1A2E]">{selected.title}</h2>
                  <p className="mt-1 text-[12.5px] text-[#9CA3AF]">{selected.date}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="grid size-8 place-items-center rounded-full text-[#6B7280] hover:bg-[#F3F4F6]"
                  aria-label="Close"
                >
                  <CloseRounded sx={{ fontSize: 20 }} />
                </button>
              </div>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#374151]">{selected.fullBody}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
