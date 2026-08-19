import type { CalendarEventType } from "../types";

/** Aligned with campus Academic Calendar legend colors. */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, { bg: string; text: string; dot: string }> = {
  Exam: { bg: "#FFEDD5", text: "#EA580C", dot: "#F97316" },
  Event: { bg: "#EEF2FF", text: "#534AB7", dot: "#534AB7" },
  PTM: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  Holiday: { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E" },
  Important: { bg: "#FCE7F3", text: "#BE185D", dot: "#EC4899" },
};
