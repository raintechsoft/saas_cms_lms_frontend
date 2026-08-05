import type { CalendarEventType } from "../types";

export const EVENT_TYPE_COLORS: Record<CalendarEventType, { bg: string; text: string; dot: string }> = {
  Exam: { bg: "#DCFCE7", text: "#16A34A", dot: "#22C55E" },
  Event: { bg: "#EEF2FF", text: "#4F46E5", dot: "#6366F1" },
  PTM: { bg: "#FFEDD5", text: "#EA580C", dot: "#F97316" },
  Holiday: { bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
};
