import { ConstructionOutlined } from "@mui/icons-material";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { ERP_DEFAULT_SLUG, findErpNavItem } from "./erpNav";

type OutletCtx = { activeLabel: string };

/** Known deep-links into existing campus modules for settings that already have a home. */
const EXTERNAL_LINKS: Record<string, { to: string; label: string }> = {
  "class-section": { to: "/academics", label: "Open Academics" },
  "subject-setup": { to: "/academics", label: "Open Academics" },
  "timetable-period": { to: "/timetable", label: "Open Timetable" },
  "fee-heads-groups": { to: "/fees", label: "Open Fees" },
  "fees-settings": { to: "/fees", label: "Open Fees" },
  "staff-roles": { to: "/users", label: "Open Users & roles" },
  "leave-types": { to: "/hr", label: "Open HR & payroll" },
  "payroll-settings": { to: "/hr", label: "Open HR & payroll" },
  "student-docs-folders": { to: "/documents", label: "Open Documents" },
  "transport-settings": { to: "/transport", label: "Open Transport" },
  "library-settings": { to: "/library", label: "Open Library" },
  "homework-settings": { to: "/homework", label: "Open Homework" },
  "online-admission": { to: "/students", label: "Open Students" },
  "attendance-type": { to: "/settings", label: "Open legacy Settings" },
  "id-numbering": { to: "/settings", label: "Open legacy Settings" },
};

export function ErpSettingsPlaceholderPage() {
  const { slug = ERP_DEFAULT_SLUG } = useParams<{ slug: string }>();
  const { activeLabel } = useOutletContext<OutletCtx>();
  const match = findErpNavItem(slug);

  if (!match) {
    return <Navigate to={`/erp/${ERP_DEFAULT_SLUG}`} replace />;
  }

  if (slug === "school-profile") {
    return <Navigate to="/erp/school-profile" replace />;
  }

  const external = EXTERNAL_LINKS[slug];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-nx-2 border-b border-border bg-white px-nx-3 py-nx-2">
        <p className="text-xs text-ink-muted">
          Dashboard <span className="mx-1 text-ink-placeholder">/</span> ERP Settings{" "}
          <span className="mx-1 text-ink-placeholder">/</span>{" "}
          <span className="font-semibold text-ink">{activeLabel}</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background p-nx-3">
        <div className="mb-nx-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{match.item.label}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Configure {match.item.label.toLowerCase()} for your institution.
          </p>
        </div>

        <section className="rounded-[12px] border border-border bg-white p-nx-3">
          <div className="flex flex-col items-start gap-nx-2 sm:flex-row sm:items-center">
            <div className="inline-flex size-12 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <ConstructionOutlined sx={{ fontSize: 24 }} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-ink">Settings panel ready</h2>
              <p className="mt-1 text-sm text-ink-muted">
                This child page is part of the ERP Settings shell. The dedicated configuration UI for{" "}
                <span className="font-semibold text-ink">{match.item.label}</span> will be built next —
                navigation and layout already match the School Profile pattern.
              </p>
            </div>
            {external ? (
              <Link to={external.to} className="nx-btn-primary shrink-0">
                {external.label}
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
