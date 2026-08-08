export type ErpNavItem = {
  slug: string;
  label: string;
};

export type ErpNavGroup = {
  key: string;
  label: string;
  items: ErpNavItem[];
};

/** Full ERP Settings secondary-nav tree (matches product IA). */
export const ERP_SETTINGS_NAV: ErpNavGroup[] = [
  {
    key: "general",
    label: "General",
    items: [
      { slug: "school-profile", label: "School Profile" },
      { slug: "academic-session", label: "Academic Session" },
      { slug: "attendance-type", label: "Attendance Type" },
      { slug: "regional-language", label: "Regional & Language" },
      { slug: "id-numbering", label: "ID Numbering" },
    ],
  },
  {
    key: "academic",
    label: "Academic Structure",
    items: [
      { slug: "class-section", label: "Class & Section Setup" },
      { slug: "subject-setup", label: "Subject Setup" },
      { slug: "timetable-period", label: "Timetable & Period Setup" },
      { slug: "grading-scale", label: "Grading Scale" },
      { slug: "academic-rules", label: "Academic Rules" },
      { slug: "exam-settings", label: "Exam Settings" },
      { slug: "question-bank-settings", label: "Question Bank Settings" },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    items: [
      { slug: "fee-heads-groups", label: "Fee Heads & Fee Groups" },
      { slug: "fees-settings", label: "Fees Settings" },
      { slug: "multi-fees-book", label: "Multi Fees Book" },
    ],
  },
  {
    key: "admissions",
    label: "Admissions & Classes",
    items: [
      { slug: "online-admission", label: "Online Admission" },
      { slug: "online-class-live", label: "Online Class & Live Sessions" },
      { slug: "homework-settings", label: "Homework Settings" },
    ],
  },
  {
    key: "hr",
    label: "Staff & HR",
    items: [
      { slug: "staff-roles", label: "Staff Roles & Permissions" },
      { slug: "staff-attendance", label: "Staff Attendance Settings" },
      { slug: "leave-types", label: "Leave Types" },
      { slug: "payroll-settings", label: "Payroll Settings" },
    ],
  },
  {
    key: "access",
    label: "Access & Fields",
    items: [
      { slug: "student-access", label: "Student Access & Permissions" },
      { slug: "custom-fields", label: "Custom Fields" },
      { slug: "system-fields", label: "System Fields" },
      { slug: "shortcut-keys", label: "Shortcut Keys" },
    ],
  },
  {
    key: "templates",
    label: "Templates & Documents",
    items: [
      { slug: "id-card-designer", label: "ID Card Designer" },
      { slug: "certificate-template", label: "Certificate Template Designer" },
      { slug: "report-card-template", label: "Report Card Template" },
      { slug: "admit-card-template", label: "Admit Card Template" },
      { slug: "student-docs-folders", label: "Student Docs Folders" },
    ],
  },
  {
    key: "branding",
    label: "Branding",
    items: [
      { slug: "theme-branding", label: "Theme & Branding" },
      { slug: "website-cms", label: "Website CMS" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    items: [
      { slug: "sms-gateway", label: "SMS Gateway" },
      { slug: "email-gateway", label: "Email Gateway" },
      { slug: "whatsapp-gateway", label: "WhatsApp Gateway" },
      { slug: "push-gateway", label: "Push Notification Gateway" },
      { slug: "notification-triggers", label: "Notification Triggers" },
      { slug: "message-notice-templates", label: "Message & Notice Templates" },
    ],
  },
  {
    key: "integrations",
    label: "Integrations",
    items: [{ slug: "payment-methods", label: "Payment Methods" }],
  },
  {
    key: "security",
    label: "Data & Security",
    items: [
      { slug: "backup-restore", label: "Backup & Restore" },
      { slug: "modules", label: "Modules" },
      { slug: "data-import-export", label: "Data Import/Export" },
      { slug: "two-factor", label: "Two-Factor Authentication" },
      { slug: "session-login-policy", label: "Session & Login Policy" },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { slug: "holidays-calendar", label: "Holidays Calendar" },
      { slug: "transport-settings", label: "Transport Settings" },
      { slug: "library-settings", label: "Library Settings" },
    ],
  },
];

export function findErpNavItem(slug: string): { group: ErpNavGroup; item: ErpNavItem } | null {
  for (const group of ERP_SETTINGS_NAV) {
    const item = group.items.find((row) => row.slug === slug);
    if (item) return { group, item };
  }
  return null;
}

export const ERP_DEFAULT_SLUG = "school-profile";
