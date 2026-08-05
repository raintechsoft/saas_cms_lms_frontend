import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-extrabold leading-tight text-[#1A1A2E] sm:text-[22px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[#6B7280]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
