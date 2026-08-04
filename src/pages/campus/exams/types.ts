export interface Named {
  id: string;
  name: string;
}

export interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named }>;
}

export interface Schedule {
  id: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  maximumMarks: string;
  minimumMarks: string;
  creditHours?: string | number | null;
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
  components?: Array<{ id: string; name: string; maximumMarks: string; sortOrder?: number }>;
}

export type ExamStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ExamResultType = "GENERAL" | "SCHOOL_GRADING" | "COLLEGE_GRADING" | "GPA";

export interface Exam {
  id: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  schedules: Schedule[];
  aspects: Array<{ id: string; name: string; maximumValue: string; fieldType?: string }>;
  _count: { students: number };
}

export interface ExamGroup extends Named {
  description?: string | null;
  resultType: ExamResultType | string;
  academicSession: Named;
  exams: Exam[];
}

export interface ExamTemplate {
  id: string;
  name: string;
  type: string;
}

export interface ExamLink {
  id: string;
  name: string;
  resultType: ExamResultType | string;
  finalExamId: string;
  examIds: string[];
}

export interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  grades: Array<{
    id: string;
    resultType: string;
    name: string;
    minPercent: string;
    maxPercent: string;
    gradePoint?: string | null;
    passStatus: string;
    description?: string | null;
  }>;
  groups: ExamGroup[];
  classSections: ClassSection[];
  templates?: ExamTemplate[];
  subjectLinks?: Array<{
    id: string;
    subjectIds: string[];
    mergeType: "MERGE" | "AVERAGE" | string;
    bifurcationColumns: number;
  }>;
  links?: ExamLink[];
}

export interface Roster {
  id: string;
  rollNumber: string | null;
  studentEnrollment: {
    student: { firstName: string; lastName: string | null; admissionNumber: string };
  };
  marks: Array<{
    marksObtained: string;
    isAbsent: boolean;
    remarks: string | null;
    componentScores?: Array<{
      componentId: string;
      marks: string;
      component?: { id: string; name: string; maximumMarks: string };
    }>;
  }>;
  aspectValues?: Array<{
    aspectFieldId: string;
    value: string | number;
    remarks?: string | null;
  }>;
}

export interface Result {
  examStudentId: string;
  rank: number;
  rollNumber?: string | null;
  showOnPortal?: boolean;
  student: { id?: string; firstName: string; lastName: string | null; admissionNumber: string };
  classSection?: {
    id: string;
    academicClass: Named;
    section: Named;
  };
  obtainedMarks: number;
  maximumMarks: number;
  percentage: number;
  grade: string | null;
  gradePoint?: number | null;
  gpa?: number | null;
  passStatus: "PASS" | "FAIL";
  subjects?: Array<{
    name: string;
    subjectIds?: string[];
    obtainedMarks: number;
    maximumMarks: number;
    percentage?: number;
    isAbsent?: boolean;
    creditHours?: number | null;
    gradePoint?: number | null;
    linked?: boolean;
    mergeType?: string;
    bifurcationColumns?: number;
    parts?: Array<{
      name: string;
      subjectId?: string;
      obtainedMarks: number;
      maximumMarks: number;
      isAbsent?: boolean;
    }>;
  }>;
  marks?: Array<{
    marksObtained: string | number;
    isAbsent?: boolean;
    schedule?: {
      maximumMarks?: string | number;
      creditHours?: string | number | null;
      classSubject?: { subject?: Named };
    };
  }>;
  exams?: Array<{
    examId: string;
    examName: string;
    maximumMarks: number;
    obtainedMarks: number;
    percentage: number;
    gpa?: number | null;
    passStatus: "PASS" | "FAIL";
  }>;
}

export type ExamWithGroup = Exam & { group: ExamGroup };

export type ScheduleWithExam = Schedule & { exam: ExamWithGroup };

export type ExamsTab =
  | "groups"
  | "schedule"
  | "marks"
  | "grades"
  | "results"
  | "admit-card"
  | "marksheet"
  | "aspects"
  | "reports";
