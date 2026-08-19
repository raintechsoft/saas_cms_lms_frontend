/** Shared data contracts for the Parent Portal UI. Live child data comes from /portal/overview. */

export interface ParentChild {
  id: string;
  name: string;
  className: string;
  section: string;
  photoUrl?: string | null;
  transportOptIn?: boolean;
  transportRoute?: string | null;
  transport?: {
    routeName?: string | null;
    vehicleNumber?: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
  } | null;
}

export interface ParentUser {
  id: string;
  name: string;
  role: string;
  photoUrl?: string | null;
}

export interface DashboardStats {
  attendancePct: number;
  attendanceLabel: string;
  feesDue: number;
  feesDueBy: string;
  upcomingExamsCount: number;
  nextExamLabel: string;
  pendingHomeworkCount: number;
  pendingHomeworkLabel: string;
}

export type AnnouncementTag = "New" | "Holiday" | "Event" | "Notice";

export interface Announcement {
  id: string;
  title: string;
  description: string;
  date: string;
  tag: AnnouncementTag;
}

export type CalendarEventType = "Exam" | "Event" | "PTM" | "Holiday" | "Important";

export interface UpcomingEvent {
  id: string;
  title: string;
  day: number;
  month: string;
  timeLabel: string;
  type: CalendarEventType;
}

export interface CalendarDay {
  date: number;
  inCurrentMonth: boolean;
  type?: CalendarEventType;
  isToday?: boolean;
}

export type ActivityStatus = "Submitted" | "Paid" | "Marks Published" | "Present" | "Scheduled";

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  status: ActivityStatus;
  timeAgo: string;
}

export interface QuickLink {
  id: string;
  label: string;
  icon: "reportCard" | "hallTicket" | "feeReceipt" | "applyLeave";
  to: string;
}
