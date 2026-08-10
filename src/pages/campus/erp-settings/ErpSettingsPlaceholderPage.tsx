import { ConstructionOutlined } from "@mui/icons-material";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { ERP_DEFAULT_SLUG, findErpNavItem } from "./erpNav";

type OutletCtx = { activeLabel: string };

/** Known deep-links into existing campus modules for settings that already have a home. */
const EXTERNAL_LINKS: Record<string, { to: string; label: string }> = {};

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

  if (slug === "academic-session") {
    return <Navigate to="/erp/academic-session" replace />;
  }

  if (slug === "attendance-type") {
    return <Navigate to="/erp/attendance-type" replace />;
  }

  if (slug === "regional-language") {
    return <Navigate to="/erp/regional-language" replace />;
  }

  if (slug === "id-numbering") {
    return <Navigate to="/erp/id-numbering" replace />;
  }

  if (slug === "fees-settings") {
    return <Navigate to="/erp/fees-settings" replace />;
  }

  if (slug === "academic-rules") {
    return <Navigate to="/erp/academic-rules" replace />;
  }

  if (slug === "exam-settings") {
    return <Navigate to="/erp/exam-settings" replace />;
  }

  if (slug === "online-admission") {
    return <Navigate to="/erp/online-admission" replace />;
  }

  if (slug === "online-class-live") {
    return <Navigate to="/erp/online-class-live" replace />;
  }

  if (slug === "class-section") {
    return <Navigate to="/erp/class-section" replace />;
  }

  if (slug === "subject-setup") {
    return <Navigate to="/erp/subject-setup" replace />;
  }

  if (slug === "timetable-period") {
    return <Navigate to="/erp/timetable-period" replace />;
  }

  if (slug === "grading-scale") {
    return <Navigate to="/erp/grading-scale" replace />;
  }

  if (slug === "question-bank-settings") {
    return <Navigate to="/erp/question-bank-settings" replace />;
  }

  if (slug === "fee-heads-groups") {
    return <Navigate to="/erp/fee-heads-groups" replace />;
  }

  if (slug === "multi-fees-book") {
    return <Navigate to="/erp/multi-fees-book" replace />;
  }

  if (slug === "homework-settings") {
    return <Navigate to="/erp/homework-settings" replace />;
  }

  if (slug === "staff-roles") {
    return <Navigate to="/erp/staff-roles" replace />;
  }

  if (slug === "staff-attendance") {
    return <Navigate to="/erp/staff-attendance" replace />;
  }

  if (slug === "leave-types") {
    return <Navigate to="/erp/leave-types" replace />;
  }

  if (slug === "payroll-settings") {
    return <Navigate to="/erp/payroll-settings" replace />;
  }

  if (slug === "student-access") {
    return <Navigate to="/erp/student-access" replace />;
  }

  if (slug === "system-fields") {
    return <Navigate to="/erp/system-fields" replace />;
  }

  if (slug === "shortcut-keys") {
    return <Navigate to="/erp/shortcut-keys" replace />;
  }

  if (slug === "id-card-designer") {
    return <Navigate to="/erp/id-card-designer" replace />;
  }

  if (slug === "certificate-template") {
    return <Navigate to="/erp/certificate-template" replace />;
  }

  if (slug === "report-card-template") {
    return <Navigate to="/erp/report-card-template" replace />;
  }

  if (slug === "admit-card-template") {
    return <Navigate to="/erp/admit-card-template" replace />;
  }

  if (slug === "student-docs-folders") {
    return <Navigate to="/erp/student-docs-folders" replace />;
  }

  if (slug === "theme-branding") {
    return <Navigate to="/erp/theme-branding" replace />;
  }

  if (slug === "website-cms") {
    return <Navigate to="/erp/website-cms" replace />;
  }

  if (slug === "sms-gateway") {
    return <Navigate to="/erp/sms-gateway" replace />;
  }

  if (slug === "email-gateway") {
    return <Navigate to="/erp/email-gateway" replace />;
  }

  if (slug === "whatsapp-gateway") {
    return <Navigate to="/erp/whatsapp-gateway" replace />;
  }

  if (slug === "push-gateway") {
    return <Navigate to="/erp/push-gateway" replace />;
  }

  if (slug === "notification-triggers") {
    return <Navigate to="/erp/notification-triggers" replace />;
  }

  if (slug === "message-notice-templates") {
    return <Navigate to="/erp/message-notice-templates" replace />;
  }

  if (slug === "payment-methods") {
    return <Navigate to="/erp/payment-methods" replace />;
  }

  if (slug === "backup-restore") {
    return <Navigate to="/erp/backup-restore" replace />;
  }

  if (slug === "modules") {
    return <Navigate to="/erp/modules" replace />;
  }

  if (slug === "data-import-export") {
    return <Navigate to="/erp/data-import-export" replace />;
  }

  if (slug === "two-factor") {
    return <Navigate to="/erp/two-factor" replace />;
  }

  if (slug === "holidays-calendar") {
    return <Navigate to="/erp/holidays-calendar" replace />;
  }

  if (slug === "session-login-policy") {
    return <Navigate to="/erp/session-login-policy" replace />;
  }

  if (slug === "transport-settings") {
    return <Navigate to="/erp/transport-settings" replace />;
  }

  if (slug === "library-settings") {
    return <Navigate to="/erp/library-settings" replace />;
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
