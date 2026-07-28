export interface Named {
  id: string;
  name: string;
}

export interface FeeType extends Named {
  code: string | null;
  isActive?: boolean;
}

export interface FeeGroup extends Named {
  items: Array<{ feeType: FeeType }>;
}

export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
}

export interface Enrollment {
  id: string;
  student: Student;
}

export interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
  enrollments: Enrollment[];
}

export interface FeeMaster {
  id: string;
  amount: string;
  dueDate: string;
  fineType?: "NONE" | "FIXED" | "PERCENTAGE";
  fineValue?: string;
  graceDays?: number;
  feeType: FeeType;
  feeGroup: FeeGroup;
  classSection: ClassSection | null;
  _count: { assignments: number };
}

export interface FeeDiscount extends Named {
  code?: string | null;
  category?: string | null;
  description?: string | null;
  type: "FIXED" | "PERCENTAGE";
  value: string;
  isActive?: boolean;
}

export interface ReceiptBook extends Named {
  prefix: string;
  isDefault: boolean;
}

export interface FeeReminderStep {
  id?: string;
  days: number;
  when: "before" | "after";
  notice: string;
  email: boolean;
  sms: boolean;
}

export interface FeeSetting {
  autoReminder: boolean;
  reminderDaysBefore: number;
  reminderDaysAfter: number;
  reminderEmailEnabled?: boolean;
  reminderSmsEnabled?: boolean;
  reminderExecutionTime?: string;
  reminderSkipWeekends?: boolean;
  reminderMinBalance?: boolean;
  reminderSteps?: FeeReminderStep[] | null;
  lastReminderRunAt?: string | null;
}

export interface FeeSetup {
  currentSession: Named | null;
  types: FeeType[];
  groups: FeeGroup[];
  discounts: FeeDiscount[];
  receiptBooks: ReceiptBook[];
  classSections: ClassSection[];
  masters: FeeMaster[];
  setting?: FeeSetting | null;
}

export interface StudentFees {
  student: Student;
  assignments: Array<{
    id: string;
    feeMaster: { feeType: FeeType; dueDate: string };
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
  }>;
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
}

export interface PaymentItem {
  id: string;
  paidAmount: string;
  assignment: { feeMaster: { feeType: FeeType } };
}

export interface Payment {
  id: string;
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentMode: string;
  amount: string;
  status: string;
  note: string | null;
  student: Student;
  items: PaymentItem[];
}

export interface FeeDue {
  id: string;
  feeMaster: { feeType: FeeType; dueDate: string };
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
  student: Student;
}

export interface FeeSummary {
  totals: { assigned: number; discounts: number; fines: number; collected: number; due: number };
  dues: FeeDue[];
}

export interface Session extends Named {
  isCurrent: boolean;
}

export interface StudentDetail {
  enrollments: Array<{ id: string; academicSession: Named }>;
}

export type FeesTab =
  | "dues"
  | "search"
  | "carry"
  | "reminders"
  | "receipts"
  | "invoices"
  | "discounts"
  | "structure";

export type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "CHEQUE" | "ONLINE" | "OTHER";

export interface StudentClassInfo {
  className: string;
  sectionName: string;
  classSectionId: string;
}
