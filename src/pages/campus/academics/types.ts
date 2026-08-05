export interface Named {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export type SubjectDeliveryType = "THEORY" | "PRACTICAL";
export type SubjectType = "CORE" | "ELECTIVE";

export interface ElectiveCategoryRef {
  id: string;
  name: string;
  maxSelect: number;
}

export interface SubjectItem extends Named {
  code?: string | null;
  type: SubjectType;
  deliveryType: SubjectDeliveryType;
  electiveCategoryId?: string | null;
  electiveCategory?: ElectiveCategoryRef | null;
}

export interface ClassItem extends Named {
  code?: string | null;
  sortOrder?: number;
  inTime?: string | null;
  halfDayTime?: string | null;
  outTime?: string | null;
}

export interface SectionItem extends Named {}

export interface ClassSubjectItem {
  id: string;
  subject: SubjectItem;
  teacher: Person | null;
}

export interface ClassSection {
  id: string;
  academicClass: ClassItem;
  section: SectionItem;
  classTeacher: Person | null;
  subjects: ClassSubjectItem[];
  _count: { enrollments: number };
}

export interface ElectiveCategory {
  id: string;
  name: string;
  description: string | null;
  classId: string | null;
  maxSelect: number;
  academicClass: Named | null;
  _count: { subjects: number };
}

export interface SubjectGroupItem {
  id: string;
  classSubject: ClassSubjectItem;
}

export interface SubjectGroup {
  id: string;
  name: string;
  description: string | null;
  classSectionId: string;
  classSection: {
    id: string;
    academicClass: Named;
    section: Named;
  };
  items: SubjectGroupItem[];
}

export interface Session extends Named {
  isCurrent: boolean;
  startDate?: string;
  endDate?: string;
}

export interface AcademicSetup {
  currentSession: Session | null;
  sessions: Session[];
  classes: ClassItem[];
  sections: SectionItem[];
  subjects: SubjectItem[];
  teachers: Person[];
  classSections: ClassSection[];
  teacherRoleId: string | null;
  electiveCategories: ElectiveCategory[];
  subjectGroups: SubjectGroup[];
}

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface TimetableEntry {
  id: string;
  academicSessionId: string;
  classSectionId: string;
  classSubjectId: string;
  teacherId: string | null;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  classSection: { id: string; academicClass: Named; section: Named };
  classSubject: { id: string; subject: SubjectItem };
  teacher: Person | null;
}

export interface TimetableSetup {
  currentSession: Session | null;
  sessions: Session[];
  classSections: ClassSection[];
  teachers: Person[];
  entries: TimetableEntry[];
}

export interface PromoteBoardStudent {
  enrollmentId: string;
  rollNumber: string | null;
  student: {
    id: string;
    firstName: string;
    lastName: string | null;
    admissionNumber: string;
    status: string;
  };
  alreadyEnrolledInTargetSession: boolean;
  existingTargetLabel: string | null;
}

export interface PromoteBoard {
  fromClassSection: {
    id: string;
    academicClass: ClassItem;
    section: SectionItem;
    academicSession: Named;
  };
  promoteSession: Named;
  multiClassAllowed: boolean;
  students: PromoteBoardStudent[];
}

export type ScholarshipType = "MERIT" | "NEED" | "GOVERNMENT";
export type ScholarStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export interface Scholar {
  id: string;
  scholarshipType: ScholarshipType;
  scholarshipName: string;
  amount: string | number;
  finalPercent?: string | number | null;
  validFrom: string;
  validTo: string;
  status: ScholarStatus;
  note: string | null;
  feeDiscountId: string | null;
  feeDiscount: { id: string; name: string; type: string; value: string | number } | null;
  student: {
    id: string;
    firstName: string;
    lastName: string | null;
    admissionNumber: string;
    status: string;
    enrollments: Array<{
      id: string;
      status: string;
      academicSessionId: string;
      classSection: { id: string; academicClass: Named; section: Named };
    }>;
  };
  academicSession: Named;
}

export interface ScholarListResult {
  items: Scholar[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: {
    active: number;
    expired: number;
    revoked: number;
    totalAwardAmount: number;
    total: number;
    merit: number;
    need: number;
    government: number;
  };
}

export type BulkUpdateType =
  | "SECTION_MOVE"
  | "STATUS"
  | "SESSION_CLASS"
  | "SUBJECT_ASSIGN"
  | "CONCESSION"
  | "STUDENT_DETAILS";

export interface ReportCatalogItem {
  key: string;
  label: string;
  description: string;
}

export interface AcademicReportResult {
  format: "json";
  columns: string[];
  rows: Array<Record<string, unknown>>;
  session: Named | null;
}

export interface StudentEnrollmentRef {
  id: string;
  rollNumber?: string | null;
  classSection: { id: string; academicClass: Named; section: Named };
  academicSession: Named;
}

export interface StudentListItem {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  status: string;
  enrollments: StudentEnrollmentRef[];
}

export type AcademicsTab =
  | "sections"
  | "classes"
  | "incharge"
  | "elective-categories"
  | "subjects"
  | "assign-subjects"
  | "subject-groups"
  | "assign-electives"
  | "class-timetable"
  | "teacher-timetable"
  | "promote"
  | "scholars"
  | "student-details"
  | "section-update"
  | "reports";
