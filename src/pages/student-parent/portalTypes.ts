export interface PortalSubmission {
  id: string;
  status: "SUBMITTED" | "EVALUATED" | "RESUBMIT_REQUESTED" | "COMPLETED";
  review: string | null;
  attempt: number;
}

export interface PortalHomeworkItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  homeworkDate: string;
  submissionDate: string;
  attachmentUrl: string | null;
  studentEnrollmentId: string;
  submission: PortalSubmission | null;
}

export interface PortalTimetableItem {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  room: string | null;
  subject: string;
  teacher: string | null;
}

export interface PortalExamItem {
  examId: string;
  examName: string;
  groupName: string;
  examDate?: string | null;
  publishedAt?: string | null;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  passStatus: "PASS" | "FAIL";
  subjects: Array<{
    subject: string;
    marksObtained: number;
    maximumMarks: number;
    isAbsent: boolean;
    examDate?: string | null;
  }>;
}

export interface PortalChild {
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    status: string;
    mobile?: string | null;
    email?: string | null;
    currentAddress?: string | null;
    permanentAddress?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    admissionDate?: string | null;
    bloodGroup?: string | null;
    nationality?: string | null;
    religion?: string | null;
    caste?: string | null;
    category?: string | null;
    house?: string | null;
    fatherName?: string | null;
    fatherPhone?: string | null;
    fatherEmail?: string | null;
    fatherOccupation?: string | null;
    motherName?: string | null;
    motherPhone?: string | null;
    motherEmail?: string | null;
    motherOccupation?: string | null;
    guardianName?: string | null;
    guardianRelation?: string | null;
    guardianPhone?: string | null;
    guardianEmail?: string | null;
    guardianOccupation?: string | null;
    admissionType?: string | null;
    transportOptIn?: boolean;
    transportRoute?: string | null;
    hostelOptIn?: boolean;
    hostelRoom?: string | null;
    additionalNotes?: string | null;
  };
  relation: string | null;
  isPrimary: boolean;
  enrollment: {
    id: string;
    rollNumber: string | null;
    session: string;
    className: string;
    section: string;
    classTeacher: string | null;
  } | null;
  timetable: PortalTimetableItem[];
  homework: PortalHomeworkItem[];
  attendance: {
    summary: {
      total: number;
      present: number;
      late: number;
      absent: number;
      halfDay: number;
      holiday: number;
      percentage: number;
    } | null;
    recent: Array<{ date: string; status: string; periodKey: string }>;
  };
  exams: PortalExamItem[];
  fees: {
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
    items: Array<{ name: string; balance: number; paid: number; base: number }>;
  } | null;
}

export interface PortalNoticeTeaser {
  id: string;
  title: string;
  publishedAt: string;
  audience: string;
}

export interface PortalOverview {
  role: "STUDENT" | "PARENT";
  canSubmitHomework: boolean;
  productMode: "CMS" | "LMS" | "BOTH" | null;
  notices: PortalNoticeTeaser[];
  children: PortalChild[];
}

export interface PortalNotice {
  id: string;
  title: string;
  body: string;
  attachmentUrl: string | null;
  audience: string;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: { firstName: string; lastName: string };
  classSection: {
    academicClass: { name: string };
    section: { name: string };
  } | null;
}

export interface PortalLeave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

export interface PortalAttendanceRecord {
  id: string;
  date: string;
  status: string;
  periodKey: string;
  note: string | null;
  inTime?: string | null;
  outTime?: string | null;
}

export const PORTAL_CHILD_STORAGE_KEY = "saas-cms-lms.portal.child";
export const PORTAL_WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
