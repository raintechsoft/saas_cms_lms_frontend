import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PARENT_BORDER } from "../ParentPortalLayout";

export function SectionCard({
  title,
  linkLabel,
  linkTo,
  children,
  className = "",
}: {
  title: string;
  linkLabel?: string;
  linkTo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-4 ${className}`}
      style={{ borderColor: PARENT_BORDER }}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[#1A1A2E]">{title}</h2>
        {linkLabel && linkTo && (
          <Link to={linkTo} className="shrink-0 text-[12px] font-semibold text-[#4F46E5] hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
