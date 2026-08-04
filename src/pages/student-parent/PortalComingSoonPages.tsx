import { Link } from "react-router-dom";
import { usePortal } from "./PortalContext";

/** Placeholder for student-portal modules whose page designs are not shared yet. */
export function PortalComingSoonPage({
  title,
  description,
  bucket = "LMS",
}: {
  title: string;
  description: string;
  bucket?: "CMS" | "LMS" | "Shared";
}) {
  const { basePath } = usePortal();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-[20px] border border-[#E5E7EB] bg-white px-8 py-14 text-center shadow-[0_4px_18px_rgba(28,27,60,0.04)]">
      <span className="rounded-full bg-[#EEF0FD] px-3 py-1 text-[11px] font-bold text-[#534AB7]">{bucket}</span>
      <h1 className="mt-4 text-2xl font-bold text-[#1A1A1A]">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">{description}</p>
      <p className="mt-4 text-[12px] text-[#9CA3AF]">Design for this page will be built next — share the mock when ready.</p>
      <Link
        to={basePath}
        className="mt-6 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
        style={{ background: "#534AB7" }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

export function PortalAiTutorPage() {
  return (
    <PortalComingSoonPage
      title="AI Tutor"
      description="Chat-based doubt solving with personalized help per subject. Join live from the dashboard shortcut once this module is enabled."
      bucket="LMS"
    />
  );
}

export function PortalCalendarPage() {
  return (
    <PortalComingSoonPage
      title="Academic Calendar"
      description="Term dates, holidays, exam dates, and school events in a calendar view."
      bucket="LMS"
    />
  );
}

export function PortalQuestionBankPage() {
  return (
    <PortalComingSoonPage
      title="Question Bank"
      description="Practice questions by subject/chapter and previous-year papers."
      bucket="LMS"
    />
  );
}

export function PortalNcertPage() {
  return (
    <PortalComingSoonPage
      title="NCERT Content"
      description="Textbook content mapped to syllabus — chapter-wise notes, videos, and study material."
      bucket="LMS"
    />
  );
}

export function PortalLessonsPage() {
  return (
    <PortalComingSoonPage
      title="Lesson Plans"
      description="View topics covered and upcoming per subject (read-only for students)."
      bucket="LMS"
    />
  );
}

export function PortalMessagesPage() {
  return (
    <PortalComingSoonPage
      title="Messages"
      description="Student–teacher communication and query raising."
      bucket="Shared"
    />
  );
}

export function PortalHelpPage() {
  return (
    <PortalComingSoonPage
      title="Help & Support"
      description="FAQs, contact school admin, and support tickets."
      bucket="Shared"
    />
  );
}

export function PortalSettingsPage() {
  return (
    <PortalComingSoonPage
      title="Settings"
      description="Profile edit, password change, notification preferences, language and theme."
      bucket="Shared"
    />
  );
}

export function PortalAcademicsPage() {
  return (
    <PortalComingSoonPage
      title="Academics"
      description="Subjects enrolled, syllabus, class timetable, and teachers assigned per subject."
      bucket="CMS"
    />
  );
}
