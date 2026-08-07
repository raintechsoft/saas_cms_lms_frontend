import type { ComponentType, ReactNode } from "react";
import { PARENT_BORDER } from "../ParentPortalLayout";

export function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  caption,
  captionColor = "#6B7280",
}: {
  icon: ComponentType<{ sx?: object }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: ReactNode;
  caption: string;
  captionColor?: string;
}) {
  return (
    <div
      className="flex min-h-[108px] items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_2px_12px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ background: iconBg }}
      >
        <Icon sx={{ fontSize: 20, color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-[#6B7280]">{label}</p>
        <p className="mt-1 truncate text-[22px] font-extrabold leading-none tracking-tight text-[#111827]">
          {value}
        </p>
        <p className="mt-1.5 truncate text-[11.5px] font-semibold" style={{ color: captionColor }}>
          {caption}
        </p>
      </div>
    </div>
  );
}
