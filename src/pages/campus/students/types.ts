export type StudentStatus = "ACTIVE" | "DISABLED" | "ALUMNI";
export type MasterResource = "categories" | "houses" | "disable-reasons";

export interface Named {
  id: string;
  name: string;
}

export interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
}

export interface Setup {
  categories: Named[];
  houses: Named[];
  disableReasons: Named[];
  currentSession: Named | null;
  classSections: ClassSection[];
}

export interface StudentListItem {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  mobile: string | null;
  email: string | null;
  photoUrl: string | null;
  fatherName: string | null;
  admissionDate: string;
  status: StudentStatus;
  category: Named | null;
  house: Named | null;
  enrollments: Array<{
    id: string;
    rollNumber: string | null;
    classSection: ClassSection;
    academicSession: Named;
  }>;
}

export interface StudentList {
  items: StudentListItem[];
  total: number;
}

export interface StudentDocument {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  folder: Named;
}

export interface StudentFees {
  assignments: Array<{
    id: string;
    feeMaster: { feeType: Named; dueDate: string };
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
    enrollment: { classSection: ClassSection };
  }>;
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
}

export type AdmissionType = "REGULAR" | "TRANSFER";

export interface StudentDetail extends StudentListItem {
  gender: string | null;
  dateOfBirth: string | null;
  religion: string | null;
  caste: string | null;
  email: string | null;
  admissionDate: string;
  photoUrl: string | null;
  bloodGroup: string | null;
  height: number | null;
  weight: number | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  fatherEmail: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherEmail: string | null;
  motherOccupation: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  guardianOccupation: string | null;
  nationality: string | null;
  admissionType: AdmissionType;
  rteEnabled: boolean;
  rteSchemeName: string | null;
  rteCertificateNo: string | null;
  transportOptIn: boolean;
  transportRoute: string | null;
  hostelOptIn: boolean;
  hostelRoom: string | null;
  additionalNotes: string | null;
  disabledReason: string | null;
  siblingGroupId: string | null;
  documents: StudentDocument[];
  siblings: Array<{
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
    status: StudentStatus;
  }>;
  fees: StudentFees | null;
}

export interface DetectedSibling {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  guardianPhone: string | null;
  mobile: string | null;
  siblingGroupId: string | null;
}

export interface OnlineAdmission {
  id: string;
  status: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
  email: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianPhone: string | null;
  currentAddress: string | null;
  reviewNote: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  classSection: ClassSection | null;
  student: { id: string; admissionNumber: string } | null;
}

export interface ImportResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

export interface AttendanceRecordItem {
  id: string;
  attendanceDate: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "HOLIDAY";
  periodKey: string | null;
  studentEnrollment: {
    classSection: ClassSection;
  };
}

export interface AttendanceSummaryItem {
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  holiday: number;
  total: number;
  percentage: number;
}

export interface AttendanceReport {
  records: AttendanceRecordItem[];
  summaries: AttendanceSummaryItem[];
}

export const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function studentDisplayName(student: { firstName: string; lastName?: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}
