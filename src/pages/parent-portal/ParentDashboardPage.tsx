import {
  AccountBalanceWalletOutlined,
  AssignmentLateOutlined,
  CheckCircleOutlined,
  MenuBookOutlined,
} from "@mui/icons-material";
import {
  MOCK_ACTIVITY,
  MOCK_ANNOUNCEMENTS,
  MOCK_QUICK_LINKS,
  MOCK_STATS,
  MOCK_UPCOMING_EVENTS,
} from "./mockData";
import { useParentPortal } from "./ParentPortalContext";
import { AnnouncementsCard } from "./components/AnnouncementsCard";
import { MiniCalendarCard } from "./components/MiniCalendarCard";
import { QuickLinksCard } from "./components/QuickLinksCard";
import { RecentActivityCard } from "./components/RecentActivityCard";
import { RecentActivityList } from "./components/RecentActivityList";
import { StatCard } from "./components/StatCard";
import { StayConnectedCard } from "./components/StayConnectedCard";
import { UpcomingEventsCard } from "./components/UpcomingEventsCard";

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export function ParentDashboardPage() {
  const { parent, activeChild } = useParentPortal();
  const stats = MOCK_STATS[activeChild.id] ?? Object.values(MOCK_STATS)[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold leading-tight text-[#1A1A2E]">
            Hi, {parent.name}! 👋
          </h1>
          <p className="mt-0.5 text-[13px] text-[#6B7280]">
            Here&apos;s what&apos;s happening with {activeChild.name.split(" ")[0]} today.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            value={formatInr(stats.feesDue).replace("₹", "₹ ")}
            caption={stats.feesDueBy}
          />
          <StatCard
            icon={MenuBookOutlined}
            iconBg="#FFEDD5"
            iconColor="#EA580C"
            label="Upcoming Exams"
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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <AnnouncementsCard announcements={MOCK_ANNOUNCEMENTS} />
          <UpcomingEventsCard events={MOCK_UPCOMING_EVENTS} />
          <RecentActivityCard activity={MOCK_ACTIVITY} />
        </div>

        <RecentActivityList activity={MOCK_ACTIVITY} />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <MiniCalendarCard />
        <QuickLinksCard links={MOCK_QUICK_LINKS} />
        <StayConnectedCard childName={activeChild.name} />
      </div>
    </div>
  );
}
