export type ProductMode = "CMS" | "LMS" | "BOTH";

/** Campus feature product bucket. SHARED is available in CMS, LMS, and BOTH. */
export type ProductBucket = "SHARED" | "CMS" | "LMS";

export function isProductBucketAllowed(
  productMode: ProductMode | string | null | undefined,
  bucket: ProductBucket,
): boolean {
  if (!productMode) return false;
  if (bucket === "SHARED") return true;
  if (productMode === "BOTH") return true;
  return productMode === bucket;
}

/** Visual grouping for the sidebar. "top" renders as a flat top-level link. */
export type NavSection = "top" | "cms" | "lms" | "management";

export const CAMPUS_NAV: Array<{
  to: string;
  label: string;
  permission: string | null;
  moduleKey: string | null;
  bucket: ProductBucket;
  section: NavSection;
}> = [
  { to: "/dashboard", label: "Overview", permission: null, moduleKey: "dashboard", bucket: "SHARED", section: "top" },
  { to: "/profile", label: "Update Profile", permission: null, moduleKey: null, bucket: "SHARED", section: "top" },
  { to: "/notifications", label: "Notifications", permission: null, moduleKey: null, bucket: "SHARED", section: "top" },
  { to: "/students", label: "Student Management", permission: "students.view", moduleKey: "students", bucket: "SHARED", section: "cms" },
  { to: "/academics", label: "Academics", permission: "academics.view", moduleKey: "academics", bucket: "SHARED", section: "cms" },
  { to: "/attendance", label: "Attendance", permission: "attendance.view", moduleKey: "attendance", bucket: "SHARED", section: "cms" },
  { to: "/notices", label: "Notices", permission: "settings.view", moduleKey: null, bucket: "SHARED", section: "cms" },
  { to: "/exams", label: "Examination", permission: "exams.view", moduleKey: "examinations", bucket: "SHARED", section: "cms" },
  { to: "/homework", label: "Homework Management", permission: "homework.view", moduleKey: "homework", bucket: "SHARED", section: "cms" },
  { to: "/fees", label: "Fees", permission: "fees.view", moduleKey: "fees", bucket: "CMS", section: "cms" },
  { to: "/hr", label: "HR & payroll", permission: "hr.view", moduleKey: "hr", bucket: "CMS", section: "cms" },
  { to: "/documents", label: "Certificates & ID", permission: "documents.view", moduleKey: "documents", bucket: "CMS", section: "cms" },
  { to: "/erp", label: "ERP control center", permission: "erp.view", moduleKey: null, bucket: "CMS", section: "cms" },
  { to: "/timetable", label: "Timetable", permission: "timetable.view", moduleKey: "timetable", bucket: "LMS", section: "lms" },
  { to: "/reports", label: "Reports", permission: "reports.view", moduleKey: "reports", bucket: "SHARED", section: "management" },
  { to: "/users", label: "Users & roles", permission: "users.view", moduleKey: null, bucket: "SHARED", section: "management" },
  { to: "/settings", label: "Settings", permission: "settings.view", moduleKey: null, bucket: "SHARED", section: "management" },
];

export function getCampusNavForMode(productMode: ProductMode | string | null | undefined) {
  return CAMPUS_NAV.filter((item) => isProductBucketAllowed(productMode, item.bucket));
}
