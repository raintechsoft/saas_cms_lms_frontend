import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/campus/DashboardPage";
import { CmsDashboardPage } from "./pages/campus/CmsDashboardPage";
import { LmsDashboardPage } from "./pages/campus/LmsDashboardPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { AcademicsPage } from "./pages/campus/AcademicsPage";
import { SettingsPage } from "./pages/campus/SettingsPage";
import { StudentsPage } from "./pages/campus/StudentsPage";
import { AddStudentPage } from "./pages/campus/students/AddStudentPage";
import { StudentProfilePage } from "./pages/campus/students/StudentProfilePage";
import { UsersPage } from "./pages/campus/UsersPage";
import { FeesPage } from "./pages/campus/FeesPage";
import { AttendancePage } from "./pages/campus/AttendancePage";
import { AppShell } from "./components/AppShell";
import { RequireProductBucket } from "./components/RequireProductBucket";
import { ExamsPage } from "./pages/campus/ExamsPage";
import { HrPage } from "./pages/campus/HrPage";
import { DocumentsPage } from "./pages/campus/DocumentsPage";
import { ReportsPage } from "./pages/campus/ReportsPage";
import { DocumentPrintPage } from "./pages/campus/DocumentPrintPage";
import { FeeReceiptPrintPage } from "./pages/campus/FeeReceiptPrintPage";
import { FeeInvoicePrintPage } from "./pages/campus/FeeInvoicePrintPage";
import { TimetablePage } from "./pages/campus/TimetablePage";
import { HomeworkPage } from "./pages/campus/HomeworkPage";
import { ErpSettingsPage } from "./pages/campus/ErpSettingsPage";
import { NoticesPage } from "./pages/campus/NoticesPage";
import { NotificationsPage } from "./pages/campus/NotificationsPage";
import { OnlineAdmissionPage } from "./pages/public/OnlineAdmissionPage";
import { PlatformShell } from "./pages/super-admin/PlatformShell";
import { SuperAdminLoginPage } from "./pages/super-admin/SuperAdminLoginPage";
import { AdminDashboardPage } from "./pages/super-admin/AdminDashboardPage";
import { AdminTenantsPage } from "./pages/super-admin/AdminTenantsPage";
import { AdminTenantFormPage } from "./pages/super-admin/AdminTenantFormPage";
import { AdminTenantDetailPage } from "./pages/super-admin/AdminTenantDetailPage";
import {
  AdminResellerDetailPage,
  AdminResellerFormPage,
  AdminResellersPage,
} from "./pages/super-admin/AdminResellersPage";
import { AdminUsersPage } from "./pages/super-admin/AdminUsersPage";
import { AdminAuditPage } from "./pages/super-admin/AdminAuditPage";
import { AdminSettingsPage } from "./pages/super-admin/AdminSettingsPage";
import { AdminAccountPage } from "./pages/super-admin/AdminAccountPage";
import { AdminTransactionsPage } from "./pages/super-admin/AdminTransactionsPage";
import { AdminBillingPage } from "./pages/super-admin/AdminBillingPage";
import { AdminAnalyticsPage } from "./pages/super-admin/AdminAnalyticsPage";
import { AdminClusterHealthPage } from "./pages/super-admin/AdminClusterHealthPage";
import { AdminDeploymentLogsPage } from "./pages/super-admin/AdminDeploymentLogsPage";
import { AdminStoragePage } from "./pages/super-admin/AdminStoragePage";
import { AdminEdgeFunctionsPage } from "./pages/super-admin/AdminEdgeFunctionsPage";
import { AdminReportsPage } from "./pages/super-admin/AdminReportsPage";
import { AdminSupportPage } from "./pages/super-admin/AdminSupportPage";
import { AdminAnnouncementsPage } from "./pages/super-admin/AdminAnnouncementsPage";
import { AdminPaymentGatewayPage } from "./pages/super-admin/AdminPaymentGatewayPage";
import { PortalRedirect } from "./pages/student-parent/PortalRedirect";
import { PortalShell } from "./pages/student-parent/PortalShell";
import { PortalHomePage } from "./pages/student-parent/PortalHomePage";
import { PortalNotificationsPage } from "./pages/student-parent/PortalNotificationsPage";
import { PortalNoticesPage } from "./pages/student-parent/PortalNoticesPage";
import { PortalAttendancePage } from "./pages/student-parent/PortalAttendancePage";
import { PortalLeavePage } from "./pages/student-parent/PortalLeavePage";
import { PortalFeesPage } from "./pages/student-parent/PortalFeesPage";
import { PortalDocumentsPage } from "./pages/student-parent/PortalDocumentsPage";
import { PortalTimetablePage } from "./pages/student-parent/PortalTimetablePage";
import { PortalHomeworkPage } from "./pages/student-parent/PortalHomeworkPage";
import { PortalExamsPage } from "./pages/student-parent/PortalExamsPage";
import { PortalProfilePage } from "./pages/student-parent/PortalProfilePage";
import { PortalTeacherRatingsPage } from "./pages/student-parent/PortalTeacherRatingsPage";
import {
  PortalAcademicsPage,
  PortalAiTutorPage,
  PortalCalendarPage,
  PortalHelpPage,
  PortalLessonsPage,
  PortalMessagesPage,
  PortalNcertPage,
  PortalQuestionBankPage,
  PortalSettingsPage,
} from "./pages/student-parent/PortalComingSoonPages";
import { PortalLiveClassesPage } from "./pages/student-parent/PortalLiveClassesPage";
import { PortalTestSeriesPage } from "./pages/student-parent/PortalTestSeriesPage";
import { StaffProfilePage } from "./pages/campus/StaffProfilePage";
import { PayslipPrintPage } from "./pages/campus/PayslipPrintPage";

function portalRoutes() {
  return (
    <>
      <Route index element={<PortalHomePage />} />
      <Route path="profile" element={<PortalProfilePage />} />
      <Route path="notifications" element={<PortalNotificationsPage />} />
      <Route path="notices" element={<PortalNoticesPage />} />
      <Route path="attendance" element={<PortalAttendancePage />} />
      <Route path="leave" element={<PortalLeavePage />} />
      <Route path="exams" element={<PortalExamsPage />} />
      <Route path="timetable" element={<PortalTimetablePage />} />
      <Route path="homework" element={<PortalHomeworkPage />} />
      <Route path="fees" element={<PortalFeesPage />} />
      <Route path="documents" element={<PortalDocumentsPage />} />
      <Route path="rate-teachers" element={<PortalTeacherRatingsPage />} />
      {/* LMS + supporting modules — UI stubs until page designs are shared */}
      <Route path="ai-tutor" element={<PortalAiTutorPage />} />
      <Route path="live-classes" element={<PortalLiveClassesPage />} />
      <Route path="calendar" element={<PortalCalendarPage />} />
      <Route path="question-bank" element={<PortalQuestionBankPage />} />
      <Route path="test-series" element={<PortalTestSeriesPage />} />
      <Route path="ncert" element={<PortalNcertPage />} />
      <Route path="lessons" element={<PortalLessonsPage />} />
      <Route path="messages" element={<PortalMessagesPage />} />
      <Route path="help" element={<PortalHelpPage />} />
      <Route path="settings" element={<PortalSettingsPage />} />
      <Route path="academics" element={<PortalAcademicsPage />} />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin/login" element={<SuperAdminLoginPage />} />
      <Route path="/student/login" element={<Navigate to="/login" replace />} />
      <Route path="/parent/login" element={<Navigate to="/login" replace />} />
      <Route path="/print/documents" element={<DocumentPrintPage />} />
      <Route path="/print/documents/:id" element={<DocumentPrintPage />} />
      <Route path="/print/fees/:id" element={<FeeReceiptPrintPage />} />
      <Route path="/print/payslips/:id" element={<PayslipPrintPage />} />
      <Route path="/print/fee-invoices/:id" element={<FeeInvoicePrintPage />} />
      <Route path="/admit/:tenantSlug" element={<OnlineAdmissionPage />} />
      <Route path="/portal" element={<PortalRedirect />} />
      <Route path="/portal/student" element={<PortalShell />}>
        {portalRoutes()}
      </Route>
      <Route path="/portal/parent" element={<PortalShell />}>
        {portalRoutes()}
      </Route>

      <Route path="/admin" element={<PlatformShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="tenants" element={<AdminTenantsPage />} />
        <Route path="tenants/new" element={<AdminTenantFormPage />} />
        <Route path="tenants/:id" element={<AdminTenantDetailPage />} />
        <Route path="tenants/:id/edit" element={<AdminTenantFormPage />} />
        <Route path="resellers" element={<AdminResellersPage />} />
        <Route path="resellers/new" element={<AdminResellerFormPage />} />
        <Route path="resellers/:id" element={<AdminResellerDetailPage />} />
        <Route path="resellers/:id/edit" element={<AdminResellerFormPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="transactions" element={<AdminTransactionsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="cluster-health" element={<AdminClusterHealthPage />} />
        <Route path="deployment-logs" element={<AdminDeploymentLogsPage />} />
        <Route path="storage" element={<AdminStoragePage />} />
        <Route path="edge-functions" element={<AdminEdgeFunctionsPage />} />
        <Route path="payment-gateway" element={<AdminPaymentGatewayPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="profile" element={<AdminAccountPage />} />
      </Route>

      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/cms" element={<RequireProductBucket bucket="CMS"><CmsDashboardPage /></RequireProductBucket>} />
        <Route path="/lms" element={<RequireProductBucket bucket="LMS"><LmsDashboardPage /></RequireProductBucket>} />
        <Route path="/profile" element={<StaffProfilePage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/new" element={<AddStudentPage />} />
        <Route path="/students/:id" element={<StudentProfilePage />} />
        <Route path="/academics" element={<AcademicsPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route
          path="/notifications"
          element={
            <RequireProductBucket bucket="SHARED">
              <NotificationsPage />
            </RequireProductBucket>
          }
        />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/timetable" element={<RequireProductBucket bucket="LMS"><TimetablePage /></RequireProductBucket>} />
        <Route path="/homework" element={<HomeworkPage />} />
        <Route path="/fees" element={<RequireProductBucket bucket="CMS"><FeesPage /></RequireProductBucket>} />
        <Route path="/hr" element={<RequireProductBucket bucket="CMS"><HrPage /></RequireProductBucket>} />
        <Route path="/documents" element={<RequireProductBucket bucket="CMS"><DocumentsPage /></RequireProductBucket>} />
        <Route path="/erp" element={<RequireProductBucket bucket="CMS"><ErpSettingsPage /></RequireProductBucket>} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
