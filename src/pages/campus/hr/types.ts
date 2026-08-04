export interface Named {
  id: string;
  name: string;
}

export interface HrUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: string;
  roles?: Array<{ role: { name: string; code: string } }>;
}

export interface AttendanceRecord {
  attendanceDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
}

export interface StaffDocument {
  label: string;
  name: string;
  dataUrl: string;
}

export interface Staff {
  id: string;
  employeeNumber: string;
  basicSalary: string;
  phone?: string | null;
  address?: string | null;
  joiningDate?: string;
  dateOfBirth?: string | null;
  status: "ACTIVE" | "DISABLED";
  disabledReason?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  emergencyContact?: string | null;
  epfNumber?: string | null;
  contractType?: string | null;
  workShift?: string | null;
  workLocation?: string | null;
  leaveAllowance?: number | null;
  absenceDeduction?: string | null;
  leavingDate?: string | null;
  resignationLetter?: string | null;
  bankAccountTitle?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  bankIfsc?: string | null;
  bankBranch?: string | null;
  permanentAddress?: string | null;
  photoUrl?: string | null;
  documents?: StaffDocument[] | null;
  user: HrUser;
  department: Named | null;
  designation: Named | null;
  attendance: AttendanceRecord[];
  _count?: { leaves: number; ratings: number };
}

export interface Leave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  attachment?: { name: string; dataUrl: string } | null;
  staff: Staff;
  leaveType: Named;
}

export interface Payroll {
  id: string;
  grossAmount: string;
  netAmount: string;
  basicSalary?: string;
  attendanceDeduction: string;
  payrollMonth?: string;
  status: "GENERATED" | "PAID";
  staff: Staff;
  items?: Array<{ id: string; name: string; type: string; amount: string }>;
  academicSession?: Named | null;
}

export interface StaffAdjustment {
  id: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  amount: string;
  isRecurring?: boolean;
  isActive?: boolean;
  createdAt?: string;
}

export interface TeacherRating {
  id: string;
  rating: number;
  comment?: string | null;
  ratingDate: string;
}

export interface StaffDetail extends Staff {
  adjustments: StaffAdjustment[];
  leaves: Leave[];
  payrolls: Payroll[];
  ratings?: TeacherRating[];
}

export interface PayParameter {
  id: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  defaultAmount: string;
}

export interface HrSetup {
  month: string;
  currentSession: Named | null;
  departments: Named[];
  designations: Named[];
  leaveTypes: Array<Named & { annualLimit: number | null }>;
  payParameters: PayParameter[];
  staff: Staff[];
  pendingLeaves: Leave[];
  leaves: Leave[];
  payrolls: Payroll[];
  staffNumbering?: { auto: boolean; prefix: string; next: number };
}

export type HrTab =
  | "staff"
  | "disabled"
  | "setup"
  | "attendance"
  | "leave"
  | "payroll"
  | "ratings"
  | "reports";

export function staffName(member: Staff) {
  return `${member.user.firstName} ${member.user.lastName}`.trim();
}
