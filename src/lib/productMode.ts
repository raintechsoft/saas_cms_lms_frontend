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

export const CAMPUS_NAV: Array<{
  to: string;
  label: string;
  permission: string | null;
  moduleKey: string | null;
  bucket: ProductBucket;
}> = [
  { to: "/dashboard", label: "Overview", permission: null, moduleKey: "dashboard", bucket: "SHARED" },
  { to: "/profile", label: "Update Profile", permission: null, moduleKey: null, bucket: "SHARED" },
  { to: "/students", label: "Students", permission: "students.view", moduleKey: "students", bucket: "SHARED" },
  { to: "/academics", label: "Academics", permission: "academics.view", moduleKey: "academics", bucket: "SHARED" },
  { to: "/attendance", label: "Attendance", permission: "attendance.view", moduleKey: "attendance", bucket: "SHARED" },
  { to: "/notices", label: "Notices", permission: "settings.view", moduleKey: null, bucket: "SHARED" },
  { to: "/exams", label: "Examinations", permission: "exams.view", moduleKey: "examinations", bucket: "SHARED" },
  { to: "/timetable", label: "Timetable", permission: "timetable.view", moduleKey: "timetable", bucket: "LMS" },
  { to: "/homework", label: "Homework", permission: "homework.view", moduleKey: "homework", bucket: "LMS" },
  { to: "/fees", label: "Fees", permission: "fees.view", moduleKey: "fees", bucket: "CMS" },
  { to: "/hr", label: "HR & payroll", permission: "hr.view", moduleKey: "hr", bucket: "CMS" },
  { to: "/documents", label: "Certificates & ID", permission: "documents.view", moduleKey: "documents", bucket: "CMS" },
  { to: "/erp", label: "ERP control center", permission: "erp.view", moduleKey: null, bucket: "CMS" },
  { to: "/reports", label: "Reports", permission: "reports.view", moduleKey: "reports", bucket: "SHARED" },
  { to: "/users", label: "Users & roles", permission: "users.view", moduleKey: null, bucket: "SHARED" },
  { to: "/settings", label: "Settings", permission: "settings.view", moduleKey: null, bucket: "SHARED" },
];

export function getCampusNavForMode(productMode: ProductMode | string | null | undefined) {
  return CAMPUS_NAV.filter((item) => isProductBucketAllowed(productMode, item.bucket));
}
