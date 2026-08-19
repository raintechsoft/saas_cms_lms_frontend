import type { ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";

/**
 * Desktop CMS page canvas (EXE-friendly).
 * Fills the window under the top bar; put long content in CmsScrollBody.
 */
export function CmsPage({
  children,
  fill = true,
}: {
  children: ReactNode;
  /** Lock to viewport height (desktop software mode). Default true. */
  fill?: boolean;
}) {
  return (
    <main className={`nx-page ${fill ? "nx-page-fill" : ""}`}>
      <div className={`nx-page-inner ${fill ? "nx-page-inner-fill" : ""}`}>{children}</div>
    </main>
  );
}

/** Scrollable work area inside a fill page — only this region scrolls. */
export function CmsScrollBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`nx-scroll-body ${className}`}>{children}</div>;
}

/** Title row used across Student Directory, Add Student, Profile, etc. */
export function CmsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="nx-page-header shrink-0">
      <div className="min-w-0">
        <h1 className="nx-page-title">{title}</h1>
        {description ? <p className="nx-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="nx-page-actions">{actions}</div> : null}
    </div>
  );
}

export function CmsKpiGrid({ children }: { children: ReactNode }) {
  return <div className="nx-kpi-grid shrink-0">{children}</div>;
}

export function CmsKpiCard({
  icon,
  label,
  value,
  tint = "#6366f1",
  trend,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tint?: string;
  trend?: string;
}) {
  return (
    <div className="nx-kpi-card">
      <div className="flex items-start justify-between gap-2">
        <div
          className="nx-kpi-icon"
          style={{
            background: `${tint}1f`,
            color: tint,
            boxShadow: `inset 0 0 0 1px ${tint}33`,
          }}
        >
          {icon}
        </div>
        {trend ? <span className="nx-pill nx-pill-success">{trend}</span> : null}
      </div>
      <p className="nx-kpi-value">{value}</p>
      <p className="nx-kpi-label">{label}</p>
    </div>
  );
}

export function CmsTabs({ children }: { children: ReactNode }) {
  return (
    <div className="nx-tabs shrink-0" role="tablist">
      {children}
    </div>
  );
}

export function CmsTab({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`nx-tab ${active ? "nx-tab-active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CmsSectionCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`nx-card ${className}`}>{children}</section>;
}

export function CmsFooter() {
  const { user } = useAuth();
  const name = (user?.tenant?.name ?? "NEXUS TENANT ADMIN").toUpperCase();
  return (
    <footer className="nx-footer shrink-0">
      <span>
        © {new Date().getFullYear()} {name} · INSTITUTIONAL CMS V2.4.0
      </span>
      <div className="flex gap-4">
        <button type="button" className="hover:text-slate-600">
          Privacy Policy
        </button>
        <button type="button" className="hover:text-slate-600">
          Support Desk
        </button>
        <button type="button" className="hover:text-slate-600">
          Documentation
        </button>
      </div>
    </footer>
  );
}
