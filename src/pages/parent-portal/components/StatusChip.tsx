const TONES: Record<string, { bg: string; text: string }> = {
  green: { bg: "#DCFCE7", text: "#15803D" },
  red: { bg: "#FEE2E2", text: "#DC2626" },
  orange: { bg: "#FFEDD5", text: "#EA580C" },
  blue: { bg: "#DBEAFE", text: "#2563EB" },
  purple: { bg: "#EEF2FF", text: "#4F46E5" },
  gray: { bg: "#F3F4F6", text: "#4B5563" },
  yellow: { bg: "#FEF9C3", text: "#A16207" },
};

export function StatusChip({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: keyof typeof TONES;
}) {
  const colors = TONES[tone] ?? TONES.gray;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}
