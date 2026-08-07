import { useMemo } from "react";
import {
  AccountBalanceWalletOutlined,
  AssignmentLateOutlined,
  CheckCircleOutlined,
  MenuBookOutlined,
} from "@mui/icons-material";
import { MOCK_QUICK_LINKS } from "./mockData";
import { useParentPortal } from "./ParentPortalContext";
import { AnnouncementsCard } from "./components/AnnouncementsCard";
import { MiniCalendarCard } from "./components/MiniCalendarCard";
import { QuickLinksCard } from "./components/QuickLinksCard";
import { RecentActivityList } from "./components/RecentActivityList";
import { StatCard } from "./components/StatCard";
import { StayConnectedCard } from "./components/StayConnectedCard";
import { UpcomingEventsCard } from "./components/UpcomingEventsCard";
import type { ActivityItem, Announcement, UpcomingEvent } from "./types";
import { PARENT_BORDER, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { InitialsAvatar } from "../../components/InitialsAvatar";

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function timeAgo(iso: string) {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(deltaMs / 60000);
  if (min < 60) return `${Math.max(min, 0)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function attendanceLabel(pct: number) {
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 60) return "Average";
  return "Needs attention";
}

export function ParentDashboardPage() {
  const { parent, activeChild, portalChild, overview } = useParentPortal();

  const stats = useMemo(() => {
    const attendancePct = Math.round(portalChild?.attendance.summary?.percentage ?? 0);
    const feesDue = portalChild?.fees?.totals.balance ?? 0;
    const pendingHomework =
      portalChild?.homework.filter((item) => !item.submission).length ?? 0;
    const upcomingExams =
      portalChild?.exams.filter((exam) => {
        if (!exam.examDate) return false;
        return new Date(exam.examDate).getTime() >= Date.now() - 86400000;
      }) ?? [];
    const nextExam = [...upcomingExams].sort((a, b) =>
      String(a.examDate).localeCompare(String(b.examDate)),
    )[0];

    return {
      attendancePct,
      attendanceLabel: attendanceLabel(attendancePct),
      feesDue,
      feesDueBy: feesDue > 0 ? "Outstanding balance" : "All clear",
      upcomingExamsCount: upcomingExams.length || portalChild?.exams.length || 0,
      nextExamLabel: nextExam
        ? `Next: ${nextExam.examName}`
        : portalChild?.exams[0]
          ? `Latest: ${portalChild.exams[0].examName}`
          : "No exams scheduled",
      pendingHomeworkCount: pendingHomework,
      pendingHomeworkLabel: pendingHomework ? "Awaiting submission" : "All caught up",
    };
  }, [portalChild]);

  const announcements = useMemo<Announcement[]>(
    () =>
      (overview?.notices ?? []).slice(0, 5).map((notice) => ({
        id: notice.id,
        title: notice.title,
        description: notice.audience === "ALL" ? "School-wide notice" : `For ${notice.audience}`,
        date: new Date(notice.publishedAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        tag: "Notice" as const,
      })),
    [overview?.notices],
  );

  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    return (portalChild?.exams ?? [])
      .filter((exam) => exam.examDate)
      .slice(0, 5)
      .map((exam) => {
        const d = new Date(exam.examDate!);
        return {
          id: exam.examId,
          title: exam.examName,
          day: d.getDate(),
          month: d.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
          timeLabel: exam.groupName || "Exam",
          type: "Exam" as const,
        };
      });
  }, [portalChild?.exams]);

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const hw of portalChild?.homework ?? []) {
      if (!hw.submission) continue;
      items.push({
        id: `hw-${hw.id}`,
        title: "Homework submitted",
        description: `${hw.subject} · ${hw.title}`,
        status: "Submitted",
        timeAgo: timeAgo(hw.submissionDate),
      });
    }
    for (const row of portalChild?.attendance.recent ?? []) {
      const status = row.status.toUpperCase();
      if (status !== "PRESENT" && status !== "LATE") continue;
      items.push({
        id: `att-${row.date}-${row.periodKey}`,
        title: status === "LATE" ? "Marked late" : "Marked present",
        description: new Date(row.date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        status: "Present",
        timeAgo: timeAgo(row.date),
      });
    }
    return items.slice(0, 8);
  }, [portalChild]);

  const firstName = activeChild.name.split(" ")[0] || activeChild.name;

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-4 shadow-[0_2px_12px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Parent dashboard
          </p>
          <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight text-[#111827]">
            Welcome, {parent.name}
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Overview for {firstName} · {activeChild.className} - {activeChild.section}
          </p>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl border px-3 py-2"
          style={{ borderColor: PARENT_BORDER, background: PARENT_PRIMARY_SUBTLE }}
        >
          <InitialsAvatar name={activeChild.name} photoUrl={activeChild.photoUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#111827]">{activeChild.name}</p>
            <p className="text-[11.5px] text-[#6B7280]">
              {activeChild.className} - {activeChild.section}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CheckCircleOutlined}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Attendance"
          value={`${stats.attendancePct}%`}
          caption={stats.attendanceLabel}
          captionColor="#16A34A"
        />
        <StatCard
          icon={AccountBalanceWalletOutlined}
          iconBg="#EEF2FF"
          iconColor="#4F46E5"
          label="Fees Due"
          value={formatInr(stats.feesDue)}
          caption={stats.feesDueBy}
        />
        <StatCard
          icon={MenuBookOutlined}
          iconBg="#FFEDD5"
          iconColor="#EA580C"
          label="Exams"
          value={stats.upcomingExamsCount}
          caption={stats.nextExamLabel}
        />
        <StatCard
          icon={AssignmentLateOutlined}
          iconBg="#FEE2E2"
          iconColor="#DC2626"
          label="Pending Homework"
          value={stats.pendingHomeworkCount}
          caption={stats.pendingHomeworkLabel}
        />
      </div>

      {/* Main + sidebar */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
            <AnnouncementsCard announcements={announcements} />
            <UpcomingEventsCard events={upcomingEvents} />
          </div>
          <RecentActivityList activity={activity} />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <MiniCalendarCard events={upcomingEvents} />
          <QuickLinksCard links={MOCK_QUICK_LINKS} />
          <StayConnectedCard childName={activeChild.name} />
        </aside>
      </div>
    </div>
  );
}
