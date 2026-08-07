import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PARENT_BORDER } from "../ParentPortalLayout";

export function SectionCard({
  title,
  linkLabel,
  linkTo,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  linkLabel?: string;
  linkTo?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_2px_12px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: PARENT_BORDER }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="text-[14px] font-bold text-[#111827]">{title}</h2>
        {linkLabel && linkTo && (
          <Link
            to={linkTo}
            className="shrink-0 text-[12px] font-semibold text-[#4F46E5] hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      <div className={`min-h-0 flex-1 px-4 py-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
