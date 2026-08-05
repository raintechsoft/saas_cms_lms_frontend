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
      className="flex flex-col gap-2.5 rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div className="grid size-9 place-items-center rounded-xl" style={{ background: iconBg }}>
        <Icon sx={{ fontSize: 20, color: iconColor }} />
      </div>
      <div>
        <p className="text-[11.5px] font-medium text-[#6B7280]">{label}</p>
        <p className="mt-0.5 text-[22px] font-extrabold leading-tight text-[#1A1A2E]">{value}</p>
        <p className="mt-0.5 text-[11.5px] font-semibold" style={{ color: captionColor }}>
          {caption}
        </p>
      </div>
    </div>
  );
}
