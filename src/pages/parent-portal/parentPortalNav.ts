import type { ComponentType } from "react";
import {
  AccountBalanceWalletOutlined,
  CalendarMonthOutlined,
  DirectionsBusFilledOutlined,
  ForumOutlined,
  HelpOutlineOutlined,
  MenuBookOutlined,
  SettingsOutlined,
  SpaceDashboardOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";

export interface ParentNavLeaf {
  label: string;
  to: string;
}

export interface ParentNavItem {
  key: string;
  label: string;
  icon: ComponentType<{ sx?: object; className?: string }>;
  to?: string;
  children?: ParentNavLeaf[];
}

export const PARENT_NAV: ParentNavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: SpaceDashboardOutlined, to: "/parent/dashboard" },
  {
    key: "academics",
    label: "Academics",
    icon: MenuBookOutlined,
    children: [
      { label: "Subjects & Timetable", to: "/parent/academics/timetable" },
      { label: "Homework", to: "/parent/academics/homework" },
      { label: "Examination & Results", to: "/parent/academics/examination" },
      { label: "Test Series & Performance", to: "/parent/academics/test-series" },
      { label: "Live Classes", to: "/parent/academics/live-classes" },
    ],
  },
  {
    key: "attendance-calendar",
    label: "Attendance & Calendar",
    icon: CalendarMonthOutlined,
    children: [
      { label: "Attendance", to: "/parent/attendance-calendar/attendance" },
      { label: "Academic Calendar", to: "/parent/attendance-calendar/academic-calendar" },
    ],
  },
  { key: "fees-payments", label: "Fees & Payments", icon: AccountBalanceWalletOutlined, to: "/parent/fees" },
  {
    key: "communication",
    label: "Communication",
    icon: ForumOutlined,
    children: [
      { label: "Announcements", to: "/parent/communication/announcements" },
      { label: "Messaging (Teachers)", to: "/parent/communication/messaging" },
      { label: "PTM Scheduling", to: "/parent/communication/ptm" },
    ],
  },
  { key: "certificates", label: "Certificates", icon: WorkspacePremiumOutlined, to: "/parent/certificates" },
  { key: "transport-tracking", label: "Transport Tracking", icon: DirectionsBusFilledOutlined, to: "/parent/transport" },
  { key: "settings", label: "Settings", icon: SettingsOutlined, to: "/parent/settings" },
  { key: "help-support", label: "Help / Support", icon: HelpOutlineOutlined, to: "/parent/help" },
];
