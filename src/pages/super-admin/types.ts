export type TenantType = "SCHOOL" | "COLLEGE_UNIVERSITY" | "COACHING_CENTER" | "INDIVIDUAL";
export type ProductMode = "CMS" | "LMS" | "BOTH";
export type DistributionModel = "UNIVERSE_AI" | "RESELLER" | "WHITE_LABEL";
export type TenantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface PlatformStats {
  totals: {
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    archivedTenants: number;
    users: number;
    resellers: number;
    students: number;
  };
  tenantsByStatus: Record<string, number>;
  tenantsByType: Record<string, number>;
  tenantsByProductMode: Record<string, number>;
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    productMode: string;
    status: string;
    reseller: string | null;
    users: number;
    students: number;
    createdAt: string;
  }>;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  type: TenantType;
  productMode: ProductMode;
  distributionModel: DistributionModel;
  status: TenantStatus;
  branding: Record<string, unknown> | null;
  reseller: { id: string; name: string } | null;
  users: number;
  students: number;
  createdAt: string;
  updatedAt?: string;
}

/** Keys must match the campus sidebar moduleKey values and backend requireModule keys. */
export const CMS_MODULE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "students", label: "Student Management" },
  { key: "academics", label: "Academics" },
  { key: "attendance", label: "Attendance" },
  { key: "notices", label: "Notices" },
  { key: "examinations", label: "Examination" },
  { key: "homework", label: "Homework Management" },
  { key: "fees", label: "Fees" },
  { key: "hr", label: "HR & Payroll" },
  { key: "documents", label: "Certificates & ID" },
  { key: "erp", label: "ERP Control Center" },
  { key: "transport", label: "Transport" },
  { key: "hostel", label: "Hostel" },
  { key: "library", label: "Library" },
  { key: "inventory", label: "Inventory" },
  { key: "onlineExam", label: "Online Exam" },
  { key: "reports", label: "Reports" },
];

export const LMS_MODULE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "timetable", label: "Timetable" },
];

export interface TenantDetail extends TenantRow {
  /** Module keys currently enabled for the tenant (missing = legacy all-enabled). */
  enabledModules?: string[];
  settingsSummary: {
    autoAdmissionNumber: boolean;
    attendanceType: string;
    currency: string;
    examResultType: string;
    onlineAdmission: boolean;
  } | null;
  recentUsers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: UserStatus;
    roles: string[];
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType: string;
    actor: string | null;
    createdAt: string;
  }>;
}

export interface ResellerRow {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown> | null;
  tenants: number;
  users: number;
  createdAt: string;
}

export interface ResellerDetail {
  id: string;
  name: string;
  slug: string;
  branding: Record<string, unknown> | null;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    productMode: string;
    status: string;
  }>;
  tenantCount: number;
  userCount: number;
  createdAt: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: UserStatus;
  tenant: { id: string; name: string; slug: string } | null;
  reseller: { id: string; name: string } | null;
  roles: string[];
  createdAt: string;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  tenant: string | null;
  tenantSlug?: string | null;
  actor: string | null;
  actorEmail?: string | null;
  createdAt: string;
}

export interface PlatformSettings {
  brandingDefaults: { primaryColor: string; logoText: string };
  security: { jwtExpiresIn: string; notes: string[] };
  environment: { nodeEnv: string; apiPort: number; webOrigin: string; version: string };
}

export const TENANT_TYPES: TenantType[] = ["SCHOOL", "COLLEGE_UNIVERSITY", "COACHING_CENTER", "INDIVIDUAL"];
export const PRODUCT_MODES: ProductMode[] = ["CMS", "LMS", "BOTH"];
export const DISTRIBUTION_MODELS: DistributionModel[] = ["UNIVERSE_AI", "RESELLER", "WHITE_LABEL"];
export const TENANT_STATUSES: TenantStatus[] = ["ACTIVE", "SUSPENDED", "ARCHIVED"];
