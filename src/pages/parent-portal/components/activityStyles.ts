import {
  AccountBalanceWalletOutlined,
  AssignmentTurnedInOutlined,
  CheckCircleOutlined,
  EventAvailableOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import type { ActivityStatus } from "../types";

export const ACTIVITY_STATUS_COLORS: Record<ActivityStatus, { bg: string; text: string }> = {
  Submitted: { bg: "#DCFCE7", text: "#16A34A" },
  Paid: { bg: "#DCFCE7", text: "#16A34A" },
  "Marks Published": { bg: "#EEF2FF", text: "#4F46E5" },
  Present: { bg: "#DCFCE7", text: "#16A34A" },
  Scheduled: { bg: "#DBEAFE", text: "#2563EB" },
};

export const ACTIVITY_STATUS_ICON: Record<ActivityStatus, typeof CheckCircleOutlined> = {
  Submitted: AssignmentTurnedInOutlined,
  Paid: AccountBalanceWalletOutlined,
  "Marks Published": TrendingUpOutlined,
  Present: CheckCircleOutlined,
  Scheduled: EventAvailableOutlined,
};
