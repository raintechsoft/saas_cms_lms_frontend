import { Link } from "react-router-dom";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody, CmsSectionCard } from "../../components/cms/CmsLayout";

/** Lightweight campus stub for LMS modules whose full UI is not ready yet. */
export function CampusComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <CmsPage>
      <CmsPageHeader title={title} description={description} />
      <CmsScrollBody>
        <CmsSectionCard>
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">Coming soon</p>
            <p className="max-w-md text-xs text-slate-500">
              This LMS module is listed in navigation and will be built next. Share the page design when
              you are ready.
            </p>
            <Link to="/lms" className="mt-2 text-[13px] font-semibold text-[#534AB7] hover:underline">
              Back to LMS Dashboard
            </Link>
          </div>
        </CmsSectionCard>
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}

export function AiTutorPage() {
  return (
    <CampusComingSoonPage
      title="AI Tutor"
      description="AI-assisted doubt solving and personalized study help."
    />
  );
}

export function LmsSettingsPage() {
  return (
    <CampusComingSoonPage
      title="LMS Settings"
      description="Configure LMS modules, defaults, and school-level learning preferences."
    />
  );
}

export function ClassroomManagementPage() {
  return (
    <CampusComingSoonPage
      title="Classroom Management"
      description="Live classroom controls, attendance in session, and screen sharing tools."
    />
  );
}

export function VideoGalleryPage() {
  return (
    <CampusComingSoonPage
      title="Video Gallery"
      description="Recorded lessons and video resources for classes and subjects."
    />
  );
}

export function VoiceAiAgentPage() {
  return (
    <CampusComingSoonPage
      title="Voice AI Agent"
      description="Voice-based AI assistant for campus queries and student support."
    />
  );
}

export function PreparationPracticePage() {
  return (
    <CampusComingSoonPage
      title="Preparation & Practice"
      description="Practice sets, drills, and exam preparation workflows."
    />
  );
}
