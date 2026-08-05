import type {
  ActivityItem,
  Announcement,
  CalendarDay,
  DashboardStats,
  ParentChild,
  ParentUser,
  QuickLink,
  UpcomingEvent,
} from "./types";

export const MOCK_PARENT_USER: ParentUser = {
  id: "parent-1",
  name: "Rahul Sharma",
  role: "Parent",
  photoUrl: null,
};

export const MOCK_CHILDREN: ParentChild[] = [
  { id: "child-1", name: "Aarav Sharma", className: "Class 8", section: "A", photoUrl: null },
  { id: "child-2", name: "Isha Sharma", className: "Class 4", section: "C", photoUrl: null },
];

export const MOCK_STATS: Record<string, DashboardStats> = {
  "child-1": {
    attendancePct: 92,
    attendanceLabel: "Excellent",
    feesDue: 8500,
    feesDueBy: "Pay before 25 May",
    upcomingExamsCount: 2,
    nextExamLabel: "Next: Maths on 28 May",
    pendingHomeworkCount: 3,
    pendingHomeworkLabel: "Due this week",
  },
  "child-2": {
    attendancePct: 96,
    attendanceLabel: "Excellent",
    feesDue: 6200,
    feesDueBy: "Pay before 20 May",
    upcomingExamsCount: 1,
    nextExamLabel: "Next: EVS on 30 May",
    pendingHomeworkCount: 1,
    pendingHomeworkLabel: "Due tomorrow",
  },
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    title: "Annual Sports Day 2025",
    description: "Join us for a day of athletic events and team spirit on the main ground.",
    date: "24 May 2025",
    tag: "New",
  },
  {
    id: "ann-2",
    title: "School will remain closed on 1 Jun 2025",
    description: "On account of a regional public holiday, the school campus will be closed.",
    date: "1 Jun 2025",
    tag: "Holiday",
  },
  {
    id: "ann-3",
    title: "Science Exhibition",
    description: "Students from Class 6-10 will showcase their science projects in the auditorium.",
    date: "15 May 2025",
    tag: "Event",
  },
];

export const MOCK_UPCOMING_EVENTS: UpcomingEvent[] = [
  { id: "evt-1", title: "Maths Exam", day: 25, month: "MAY", timeLabel: "08:30 AM - 10:30 AM", type: "Exam" },
  { id: "evt-2", title: "PTM Meeting", day: 31, month: "MAY", timeLabel: "10:00 AM - 01:00 PM", type: "PTM" },
  { id: "evt-3", title: "Environment Day", day: 5, month: "JUN", timeLabel: "Whole Day", type: "Event" },
  { id: "evt-4", title: "Science Exhibition", day: 15, month: "MAY", timeLabel: "09:00 AM - 01:00 PM", type: "Event" },
  { id: "evt-5", title: "School Holiday", day: 1, month: "JUN", timeLabel: "Whole Day", type: "Holiday" },
];

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: "act-1", title: "Homework submitted", description: "Science - Light", status: "Submitted", timeAgo: "2 hours ago" },
  { id: "act-2", title: "Fee payment successful", description: "Term Fee - ₹12,000", status: "Paid", timeAgo: "Yesterday" },
  { id: "act-3", title: "New marks published", description: "Maths Unit Test", status: "Marks Published", timeAgo: "2 days ago" },
  { id: "act-4", title: "Attendance marked", description: "Present - 06 May", status: "Present", timeAgo: "3 days ago" },
  { id: "act-5", title: "PTM Meeting Scheduled", description: "31 May 2025, 10:00 AM", status: "Scheduled", timeAgo: "4 days ago" },
];

export const MOCK_QUICK_LINKS: QuickLink[] = [
  { id: "ql-1", label: "Download Report Card", icon: "reportCard" },
  { id: "ql-2", label: "Download Hall Ticket", icon: "hallTicket" },
  { id: "ql-3", label: "Fee Receipt", icon: "feeReceipt" },
  { id: "ql-4", label: "Apply Leave", icon: "applyLeave" },
];

/** May 2025 calendar grid (Mon-first), matching the reference design. */
export const MOCK_CALENDAR_MONTH_LABEL = "May 2025";
export const MOCK_CALENDAR_DAYS: CalendarDay[] = [
  { date: 28, inCurrentMonth: false },
  { date: 29, inCurrentMonth: false },
  { date: 30, inCurrentMonth: false },
  { date: 1, inCurrentMonth: true },
  { date: 2, inCurrentMonth: true },
  { date: 3, inCurrentMonth: true },
  { date: 4, inCurrentMonth: true },
  { date: 5, inCurrentMonth: true },
  { date: 6, inCurrentMonth: true },
  { date: 7, inCurrentMonth: true, isToday: true },
  { date: 8, inCurrentMonth: true },
  { date: 9, inCurrentMonth: true },
  { date: 10, inCurrentMonth: true },
  { date: 11, inCurrentMonth: true },
  { date: 12, inCurrentMonth: true },
  { date: 13, inCurrentMonth: true },
  { date: 14, inCurrentMonth: true },
  { date: 15, inCurrentMonth: true, type: "Event" },
  { date: 16, inCurrentMonth: true },
  { date: 17, inCurrentMonth: true },
  { date: 18, inCurrentMonth: true },
  { date: 19, inCurrentMonth: true },
  { date: 20, inCurrentMonth: true },
  { date: 21, inCurrentMonth: true },
  { date: 22, inCurrentMonth: true },
  { date: 23, inCurrentMonth: true },
  { date: 24, inCurrentMonth: true },
  { date: 25, inCurrentMonth: true, type: "Exam" },
  { date: 26, inCurrentMonth: true },
  { date: 27, inCurrentMonth: true },
  { date: 28, inCurrentMonth: true },
  { date: 29, inCurrentMonth: true },
  { date: 30, inCurrentMonth: true },
  { date: 31, inCurrentMonth: true, type: "PTM" },
  { date: 1, inCurrentMonth: false },
];
