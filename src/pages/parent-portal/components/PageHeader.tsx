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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[#E8EAF0] pb-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#111827]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13px] leading-snug text-[#6B7280]">{subtitle}</p>}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
