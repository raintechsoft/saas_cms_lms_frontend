import { useEffect, useState, type FormEvent } from "react";
import {
  AssessmentOutlined,
  AutoStoriesOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  CategoryOutlined,
  CloseOutlined,
  EventOutlined,
  GroupsOutlined,
  MenuBookOutlined,
  PersonSearchOutlined,
  SchoolOutlined,
  SwapHorizOutlined,
  UpgradeOutlined,
  ViewWeekOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody } from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { AcademicReportsPanel } from "./academics/AcademicReportsPanel";
import { BulkUpdatePanel } from "./academics/BulkUpdatePanel";
import { ClassesSectionsPanel } from "./academics/ClassesSectionsPanel";
import { ClassTimetablePanel } from "./academics/ClassTimetablePanel";
import { ElectiveSubjectsPanel } from "./academics/ElectiveSubjectsPanel";
import { PromoteStudentsPanel } from "./academics/PromoteStudentsPanel";
import { SchoolScholarsPanel } from "./academics/SchoolScholarsPanel";
import { SubjectGroupsPanel } from "./academics/SubjectGroupsPanel";
import { SubjectsPanel } from "./academics/SubjectsPanel";
import { TeacherTimetablePanel } from "./academics/TeacherTimetablePanel";
import type { AcademicSetup, AcademicsTab } from "./academics/types";
import { headerForTab } from "./academics/utils";

const TABS: Array<CmsIconTabItem<AcademicsTab>> = [
  { key: "sections", label: "Sections", shortLabel: "Sections", icon: ViewWeekOutlined, tone: "sky" },
  { key: "classes", label: "Class", shortLabel: "Class", icon: SchoolOutlined, tone: "indigo" },
  {
    key: "incharge",
    label: "Assign Class Incharge",
    shortLabel: "Class Incharge",
    icon: BadgeOutlined,
    tone: "violet",
  },
  {
    key: "elective-categories",
    label: "Elective Subject Category",
    shortLabel: "Elective Category",
    icon: CategoryOutlined,
    tone: "fuchsia",
  },
  { key: "subjects", label: "Subjects", shortLabel: "Subjects", icon: MenuBookOutlined, tone: "blue" },
  {
    key: "subject-groups",
    label: "Subject Group",
    shortLabel: "Subject Group",
    icon: AutoStoriesOutlined,
    tone: "cyan",
  },
  {
    key: "assign-electives",
    label: "Assign Elective Subjects",
    shortLabel: "Assign Electives",
    icon: GroupsOutlined,
    tone: "teal",
  },
  {
    key: "class-timetable",
    label: "Class Timetable",
    shortLabel: "Class Timetable",
    icon: CalendarMonthOutlined,
    tone: "amber",
  },
  {
    key: "teacher-timetable",
    label: "Teachers Timetable",
    shortLabel: "Teacher Timetable",
    icon: EventOutlined,
    tone: "orange",
  },
  { key: "promote", label: "Promote Students", shortLabel: "Promote", icon: UpgradeOutlined, tone: "emerald" },
  {
    key: "scholars",
    label: "School Scholars",
    shortLabel: "Scholars",
    icon: WorkspacePremiumOutlined,
    tone: "rose",
  },
  {
    key: "student-details",
    label: "Update Student Details",
    shortLabel: "Student Details",
    icon: PersonSearchOutlined,
    tone: "slate",
  },
  {
    key: "section-update",
    label: "Std Section Update",
    shortLabel: "Section Update",
    icon: SwapHorizOutlined,
    tone: "lime",
  },
  { key: "reports", label: "Reports", shortLabel: "Reports", icon: AssessmentOutlined, tone: "purple" },
];

const defaultSessionForm = {
  name: "",
  startDate: "",
  endDate: "",
};

export function AcademicsPage() {
  const { accessToken, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("academics.manage"));
  const canManageSessions = Boolean(user?.permissions.includes("sessions.manage"));
  const [setup, setSetup] = useState<AcademicSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AcademicsTab>("sections");

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState(defaultSessionForm);
  const [activateSessionId, setActivateSessionId] = useState("");
  const [savingSession, setSavingSession] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<AcademicSetup>("/academics/setup", accessToken);
      setSetup(data);
      setActivateSessionId((prev) => prev || data.currentSession?.id || data.sessions[0]?.id || "");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load academics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function createSession(event: FormEvent) {
    event.preventDefault();
    const name = sessionForm.name.trim();
    if (name.length < 3) {
      notifyError("Session name must be at least 3 characters.");
      return;
    }
    if (!sessionForm.startDate || !sessionForm.endDate) return;
    if (sessionForm.endDate < sessionForm.startDate) {
      notifyError("End date must be after the start date.");
      return;
    }
    setSavingSession(true);
    try {
      await apiRequest("/academic-sessions", accessToken, {
        method: "POST",
        body: JSON.stringify({ ...sessionForm, name, isCurrent: true }),
      });
      setSessionForm(defaultSessionForm);
      notifySuccess("Academic session created.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create session");
    } finally {
      setSavingSession(false);
    }
  }

  async function activateSession() {
    if (!activateSessionId) return;
    setSavingSession(true);
    try {
      await apiRequest(`/academic-sessions/${activateSessionId}/current`, accessToken, { method: "PUT" });
      notifySuccess("Current session updated.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to set current session");
    } finally {
      setSavingSession(false);
    }
  }

  const header = headerForTab(tab);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {setup?.currentSession ? (
        <span className="nx-pill nx-pill-indigo">{setup.currentSession.name}</span>
      ) : (
        <span className="nx-pill nx-pill-warning">No active session</span>
      )}
      <button type="button" className="nx-btn-secondary" onClick={() => setSessionModalOpen(true)}>
        <EventOutlined sx={{ fontSize: 16 }} />
        Sessions
      </button>
    </div>
  );

  return (
    <CmsPage>
      <CmsPageHeader title={header.title} description={header.description} actions={headerActions} />

      <CmsIconTabs
        ariaLabel="Academics sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7"
        items={TABS}
      />

      <CmsScrollBody>
        {!setup ? (
          <p className="mt-8 text-center text-sm text-slate-500">{loading ? "Loading academics…" : "Unable to load academics."}</p>
        ) : (
          <>
            {tab === "sections" || tab === "classes" || tab === "incharge" ? (
              <ClassesSectionsPanel
                setup={setup}
                token={accessToken}
                canManage={canManage}
                focus={tab}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "subjects" ? (
              <SubjectsPanel setup={setup} token={accessToken} canManage={canManage} onSaved={load} onError={notifyError} />
            ) : null}
            {tab === "subject-groups" ? (
              <SubjectGroupsPanel setup={setup} token={accessToken} canManage={canManage} onSaved={load} onError={notifyError} />
            ) : null}
            {tab === "class-timetable" ? (
              <ClassTimetablePanel setup={setup} token={accessToken} canManage={canManage} onError={notifyError} />
            ) : null}
            {tab === "elective-categories" || tab === "assign-electives" ? (
              <ElectiveSubjectsPanel
                setup={setup}
                token={accessToken}
                canManage={canManage}
                focus={tab === "elective-categories" ? "categories" : "assign"}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "teacher-timetable" ? (
              <TeacherTimetablePanel setup={setup} token={accessToken} onError={notifyError} />
            ) : null}
            {tab === "promote" ? (
              <PromoteStudentsPanel setup={setup} token={accessToken} canManage={canManage} onSaved={load} onError={notifyError} />
            ) : null}
            {tab === "scholars" ? (
              <SchoolScholarsPanel setup={setup} token={accessToken} canManage={canManage} onError={notifyError} />
            ) : null}
            {tab === "student-details" || tab === "section-update" ? (
              <BulkUpdatePanel
                setup={setup}
                token={accessToken}
                canManage={canManage}
                focus={tab === "student-details" ? "details" : "section"}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "reports" ? (
              <AcademicReportsPanel setup={setup} token={accessToken} onError={notifyError} />
            ) : null}
          </>
        )}
      </CmsScrollBody>

      <CmsFooter />

      {sessionModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">Academic sessions</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Create a new session or switch the active one.</p>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600"
                type="button"
                onClick={() => setSessionModalOpen(false)}
                aria-label="Close"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>

            {setup?.sessions.length ? (
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Existing sessions</p>
                <ul className="mt-2 space-y-1 text-[13px] text-slate-700">
                  {setup.sessions.map((session) => (
                    <li key={session.id}>
                      {session.name}
                      {session.isCurrent ? " · current" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {setup?.sessions.length && canManageSessions ? (
              <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-4">
                <label className="min-w-[220px] flex-1">
                  <span className="nx-label">Switch active session</span>
                  <select
                    className="nx-input"
                    value={activateSessionId}
                    onChange={(e) => setActivateSessionId(e.target.value)}
                  >
                    {setup.sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                        {session.isCurrent ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="nx-btn-secondary"
                  disabled={savingSession}
                  onClick={() => void activateSession()}
                >
                  {savingSession ? "Saving…" : "Set current"}
                </button>
              </div>
            ) : null}

            {canManageSessions ? (
              <form className="grid gap-3 p-5" onSubmit={createSession}>
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-500">New session</h3>
                <label>
                  <span className="nx-label">Session name</span>
                  <input
                    className="nx-input"
                    required
                    minLength={3}
                    placeholder="2026-2027"
                    value={sessionForm.name}
                    onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="nx-label">Start date</span>
                    <input
                      className="nx-input"
                      required
                      type="date"
                      value={sessionForm.startDate}
                      onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="nx-label">End date</span>
                    <input
                      className="nx-input"
                      required
                      type="date"
                      value={sessionForm.endDate}
                      onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
                    />
                  </label>
                </div>
                <button className="nx-btn-primary" type="submit" disabled={savingSession}>
                  {savingSession ? "Creating…" : "Create & activate session"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </CmsPage>
  );
}
