import { Navigate, useLocation, useParams } from "react-router-dom";
import { AcademicRulesPage } from "./AcademicRulesPage";
import { AcademicSessionPage } from "./AcademicSessionPage";
import { AttendanceTypePage } from "./AttendanceTypePage";
import { ClassSectionSetupPage } from "./ClassSectionSetupPage";
import { ERP_DEFAULT_SLUG, findErpNavItem } from "./erpNav";
import { ErpSettingsPlaceholderPage } from "./ErpSettingsPlaceholderPage";
import { ExamSettingsPage } from "./ExamSettingsPage";
import { FeeHeadsGroupsPage } from "./FeeHeadsGroupsPage";
import { FeesSettingsPage } from "./FeesSettingsPage";
import { GradingScalePage } from "./GradingScalePage";
import { HomeworkSettingsPage } from "./HomeworkSettingsPage";
import { LeaveTypesSettingsPage } from "./LeaveTypesSettingsPage";
import { MultiFeeBookPage } from "./MultiFeeBookPage";
import { PayrollSettingsPage } from "./PayrollSettingsPage";
import { IdNumberingPage } from "./IdNumberingPage";
import { OnlineAdmissionPage } from "./OnlineAdmissionPage";
import { OnlineClassLivePage } from "./OnlineClassLivePage";
import { QuestionBankSettingsPage } from "./QuestionBankSettingsPage";
import { RegionalLanguagePage } from "./RegionalLanguagePage";
import { SchoolProfilePage } from "./SchoolProfilePage";
import { StaffAttendanceSettingsPage } from "./StaffAttendanceSettingsPage";
import { StaffRolesPermissionsPage } from "./StaffRolesPermissionsPage";
import { StudentAccessPermissionsPage } from "./StudentAccessPermissionsPage";
import { SubjectSetupPage } from "./SubjectSetupPage";
import { AdmitCardTemplatePage } from "./AdmitCardTemplatePage";
import { CertificateTemplateDesignerPage } from "./CertificateTemplateDesignerPage";
import { IdCardDesignerPage } from "./IdCardDesignerPage";
import { ReportCardTemplatePage } from "./ReportCardTemplatePage";
import { ShortcutKeysPage } from "./ShortcutKeysPage";
import { StudentDocsFoldersPage } from "./StudentDocsFoldersPage";
import { SystemFieldsPage } from "./SystemFieldsPage";
import { ThemeBrandingPage } from "./ThemeBrandingPage";
import { TimetablePeriodSetupPage } from "./TimetablePeriodSetupPage";
import { EmailGatewayPage } from "./EmailGatewayPage";
import { SmsGatewayPage } from "./SmsGatewayPage";
import { WebsiteCmsPage } from "./WebsiteCmsPage";
import { WhatsAppGatewayPage } from "./WhatsAppGatewayPage";
import { PushGatewayPage } from "./PushGatewayPage";
import { NotificationTriggersPage } from "./NotificationTriggersPage";
import { MessageNoticeTemplatesPage } from "./MessageNoticeTemplatesPage";
import { PaymentMethodsPage } from "./PaymentMethodsPage";
import { BackupRestorePage } from "./BackupRestorePage";
import { ModulesSettingsPage } from "./ModulesSettingsPage";
import { DataImportExportPage } from "./DataImportExportPage";
import { TwoFactorAuthPage } from "./TwoFactorAuthPage";
import { HolidaysCalendarPage } from "./HolidaysCalendarPage";
import { SessionLoginPolicyPage } from "./SessionLoginPolicyPage";
import { TransportSettingsPage } from "./TransportSettingsPage";
import { LibrarySettingsPage } from "./LibrarySettingsPage";

/** Resolves /erp/:slug to a concrete settings child page. */
export function ErpSettingsPageRouter() {
  const params = useParams<{ slug?: string }>();
  const location = useLocation();
  const slugFromPath =
    location.pathname.replace(/^\/erp\/?/, "").split("/").filter(Boolean)[0] || ERP_DEFAULT_SLUG;
  const slug = params.slug || slugFromPath;

  if (!findErpNavItem(slug)) {
    return <Navigate to={`/erp/${ERP_DEFAULT_SLUG}`} replace />;
  }

  if (slug === "school-profile") {
    return <SchoolProfilePage />;
  }

  if (slug === "academic-session") {
    return <AcademicSessionPage />;
  }

  if (slug === "attendance-type") {
    return <AttendanceTypePage />;
  }

  if (slug === "regional-language") {
    return <RegionalLanguagePage />;
  }

  if (slug === "id-numbering") {
    return <IdNumberingPage />;
  }

  if (slug === "fees-settings") {
    return <FeesSettingsPage />;
  }

  if (slug === "academic-rules") {
    return <AcademicRulesPage />;
  }

  if (slug === "exam-settings") {
    return <ExamSettingsPage />;
  }

  if (slug === "online-admission") {
    return <OnlineAdmissionPage />;
  }

  if (slug === "online-class-live") {
    return <OnlineClassLivePage />;
  }

  if (slug === "class-section") {
    return <ClassSectionSetupPage />;
  }

  if (slug === "subject-setup") {
    return <SubjectSetupPage />;
  }

  if (slug === "timetable-period") {
    return <TimetablePeriodSetupPage />;
  }

  if (slug === "grading-scale") {
    return <GradingScalePage />;
  }

  if (slug === "question-bank-settings") {
    return <QuestionBankSettingsPage />;
  }

  if (slug === "fee-heads-groups") {
    return <FeeHeadsGroupsPage />;
  }

  if (slug === "multi-fees-book") {
    return <MultiFeeBookPage />;
  }

  if (slug === "homework-settings") {
    return <HomeworkSettingsPage />;
  }

  if (slug === "staff-roles") {
    return <StaffRolesPermissionsPage />;
  }

  if (slug === "staff-attendance") {
    return <StaffAttendanceSettingsPage />;
  }

  if (slug === "leave-types") {
    return <LeaveTypesSettingsPage />;
  }

  if (slug === "payroll-settings") {
    return <PayrollSettingsPage />;
  }

  if (slug === "student-access") {
    return <StudentAccessPermissionsPage />;
  }

  if (slug === "system-fields") {
    return <SystemFieldsPage />;
  }

  if (slug === "shortcut-keys") {
    return <ShortcutKeysPage />;
  }

  if (slug === "id-card-designer") {
    return <IdCardDesignerPage />;
  }

  if (slug === "certificate-template") {
    return <CertificateTemplateDesignerPage />;
  }

  if (slug === "report-card-template") {
    return <ReportCardTemplatePage />;
  }

  if (slug === "admit-card-template") {
    return <AdmitCardTemplatePage />;
  }

  if (slug === "student-docs-folders") {
    return <StudentDocsFoldersPage />;
  }

  if (slug === "theme-branding") {
    return <ThemeBrandingPage />;
  }

  if (slug === "website-cms") {
    return <WebsiteCmsPage />;
  }

  if (slug === "sms-gateway") {
    return <SmsGatewayPage />;
  }

  if (slug === "email-gateway") {
    return <EmailGatewayPage />;
  }

  if (slug === "whatsapp-gateway") {
    return <WhatsAppGatewayPage />;
  }

  if (slug === "push-gateway") {
    return <PushGatewayPage />;
  }

  if (slug === "notification-triggers") {
    return <NotificationTriggersPage />;
  }

  if (slug === "message-notice-templates") {
    return <MessageNoticeTemplatesPage />;
  }

  if (slug === "payment-methods") {
    return <PaymentMethodsPage />;
  }

  if (slug === "backup-restore") {
    return <BackupRestorePage />;
  }

  if (slug === "modules") {
    return <ModulesSettingsPage />;
  }

  if (slug === "data-import-export") {
    return <DataImportExportPage />;
  }

  if (slug === "two-factor") {
    return <TwoFactorAuthPage />;
  }

  if (slug === "holidays-calendar") {
    return <HolidaysCalendarPage />;
  }

  if (slug === "session-login-policy") {
    return <SessionLoginPolicyPage />;
  }

  if (slug === "transport-settings") {
    return <TransportSettingsPage />;
  }

  if (slug === "library-settings") {
    return <LibrarySettingsPage />;
  }

  return <ErpSettingsPlaceholderPage />;
}
