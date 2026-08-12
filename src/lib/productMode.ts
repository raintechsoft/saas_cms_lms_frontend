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

/** Sidebar groups: Dashboard list, then CMS / LMS accordions. */
export type NavSection = "top" | "cms" | "lms";

export const NAV_SECTION_ORDER: NavSection[] = ["top", "cms", "lms"];

export const NAV_SECTION_LABEL: Record<NavSection, string> = {
  top: "Dashboard",
  cms: "CMS Modules",
  lms: "LMS Modules",
};

export interface CampusNavItem {
  to: string;
  label: string;
  permission: string | null;
  moduleKey: string | null;
  bucket: ProductBucket;
  section: NavSection;
  /**
   * Not licensed on any subscription plan by default.
   * Only render when Super Admin has explicitly enabled the module for this tenant.
   */
  requiresManualEnable?: boolean;
}

export const CAMPUS_NAV: CampusNavItem[] = [
  // DASHBOARD
  { to: "/dashboard", label: "Dashboard", permission: null, moduleKey: null, bucket: "SHARED", section: "top" },
  { to: "/notifications", label: "Notifications", permission: null, moduleKey: null, bucket: "SHARED", section: "top" },

  // CMS MODULES
  { to: "/students", label: "Student Management", permission: "students.view", moduleKey: "students", bucket: "CMS", section: "cms" },
  { to: "/academics", label: "Academics", permission: "academics.view", moduleKey: "academics", bucket: "CMS", section: "cms" },
  { to: "/timetable", label: "Timetable", permission: "timetable.view", moduleKey: "timetable", bucket: "CMS", section: "cms" },
  { to: "/attendance", label: "Attendance", permission: "attendance.view", moduleKey: "attendance", bucket: "CMS", section: "cms" },
  { to: "/notices", label: "Notices", permission: "settings.view", moduleKey: "notices", bucket: "CMS", section: "cms" },
  { to: "/exams", label: "Examination", permission: "exams.view", moduleKey: "examinations", bucket: "CMS", section: "cms" },
  { to: "/homework", label: "Homework Management", permission: "homework.view", moduleKey: "homework", bucket: "CMS", section: "cms" },
  { to: "/fees", label: "Fees", permission: "fees.view", moduleKey: "fees", bucket: "CMS", section: "cms" },
  { to: "/hr", label: "HR & Payroll", permission: "hr.view", moduleKey: "hr", bucket: "CMS", section: "cms" },
  { to: "/documents", label: "Certificates & ID", permission: "documents.view", moduleKey: "documents", bucket: "CMS", section: "cms" },
  { to: "/transport", label: "Transport", permission: "transport.view", moduleKey: "transport", bucket: "CMS", section: "cms" },
  { to: "/hostel", label: "Hostel", permission: "hostel.view", moduleKey: "hostel", bucket: "CMS", section: "cms" },
  { to: "/library", label: "Library", permission: "library.view", moduleKey: "library", bucket: "CMS", section: "cms" },
  { to: "/inventory", label: "Inventory", permission: "inventory.view", moduleKey: "inventory", bucket: "CMS", section: "cms" },
  { to: "/online-exams", label: "Online Exam", permission: "online_exam.view", moduleKey: "onlineExam", bucket: "CMS", section: "cms" },
  { to: "/users", label: "Users & Roles", permission: "users.view", moduleKey: null, bucket: "CMS", section: "cms" },
  { to: "/erp/message-notice-templates", label: "Notification Templates", permission: "erp.view", moduleKey: "erp", bucket: "CMS", section: "cms" },
  { to: "/erp", label: "ERP Settings", permission: "erp.view", moduleKey: "erp", bucket: "CMS", section: "cms" },

  // LMS MODULES
  { to: "/academic-calendar", label: "Academic Calendar", permission: "timetable.view", moduleKey: "academicCalendar", bucket: "LMS", section: "lms" },
  { to: "/lesson-planning", label: "Lesson Planning", permission: "academics.view", moduleKey: "lessonPlanning", bucket: "LMS", section: "lms" },
  { to: "/live-classes", label: "Live Classes", permission: "timetable.view", moduleKey: "liveClasses", bucket: "LMS", section: "lms" },
  {
    to: "/classroom-management",
    label: "Classroom Management",
    permission: null,
    moduleKey: "classroomManagement",
    bucket: "LMS",
    section: "lms",
    requiresManualEnable: true,
  },
  {
    to: "/video-gallery",
    label: "Video Gallery",
    permission: null,
    moduleKey: "videoGallery",
    bucket: "LMS",
    section: "lms",
    requiresManualEnable: true,
  },
  { to: "/ai-tutor", label: "AI Tutor", permission: null, moduleKey: "aiTutor", bucket: "LMS", section: "lms" },
  {
    to: "/voice-ai-agent",
    label: "Voice AI Agent",
    permission: null,
    moduleKey: "voiceAiAgent",
    bucket: "LMS",
    section: "lms",
    requiresManualEnable: true,
  },
  { to: "/ncert-content", label: "NCERT Content", permission: null, moduleKey: "ncertLibrary", bucket: "LMS", section: "lms" },
  { to: "/question-bank", label: "Question Bank", permission: "question_bank.view", moduleKey: "questionBank", bucket: "LMS", section: "lms" },
  { to: "/test-series", label: "Test Series", permission: "online_exam.view", moduleKey: "testSeries", bucket: "LMS", section: "lms" },
  {
    to: "/results-performance",
    label: "Results & Performance",
    permission: "exams.view",
    moduleKey: "resultsPerformance",
    bucket: "LMS",
    section: "lms",
    requiresManualEnable: true,
  },
  {
    to: "/preparation-practice",
    label: "Preparation & Practice",
    permission: null,
    moduleKey: "preparationPractice",
    bucket: "LMS",
    section: "lms",
    requiresManualEnable: true,
  },
  { to: "/lms-settings", label: "LMS Settings", permission: null, moduleKey: null, bucket: "LMS", section: "lms" },
];

/** Keys Super Admin must explicitly turn on — never implied by a missing module row. */
export const MANUAL_ENABLE_MODULE_KEYS = [
  "classroomManagement",
  "videoGallery",
  "voiceAiAgent",
  "resultsPerformance",
  "preparationPractice",
] as const;

export function getCampusNavForMode(productMode: ProductMode | string | null | undefined) {
  return CAMPUS_NAV.filter((item) => isProductBucketAllowed(productMode, item.bucket));
}

export function isCampusNavItemVisible(
  item: CampusNavItem,
  opts: {
    productMode: ProductMode | string | null | undefined;
    permissions: string[];
    moduleSettings: Array<{
      moduleKey: string;
      adminEnabled: boolean;
      studentEnabled: boolean;
      parentEnabled: boolean;
    }>;
    panelField: "adminEnabled" | "studentEnabled" | "parentEnabled";
  },
): boolean {
  if (!isProductBucketAllowed(opts.productMode, item.bucket)) return false;
  if (item.permission && !opts.permissions.includes(item.permission)) return false;

  if (!item.moduleKey) return true;

  const setting = opts.moduleSettings.find((row) => row.moduleKey === item.moduleKey);
  if (item.requiresManualEnable) {
    return setting?.[opts.panelField] === true;
  }
  return setting?.[opts.panelField] !== false;
}
