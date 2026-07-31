import { useEffect, useMemo, useState } from "react";
import { AddOutlined, UploadOutlined } from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { AspectsMarkFieldsPanel } from "./exams/AspectsMarkFieldsPanel";
import { AdmitCardPanel } from "./exams/AdmitCardPanel";
import { ExamGroupsPanel } from "./exams/ExamGroupsPanel";
import { ExamResultsPanel } from "./exams/ExamResultsPanel";
import { ExamReportsPanel } from "./exams/ExamReportsPanel";
import { MarksEntryPanel } from "./exams/MarksEntryPanel";
import { MarksGradePanel } from "./exams/MarksGradePanel";
import { MarksheetPanel } from "./exams/MarksheetPanel";
import { SchedulePanel } from "./exams/SchedulePanel";
import type { ExamsTab, Setup } from "./exams/types";

const TABS: Array<[ExamsTab, string]> = [
  ["groups", "Exam Groups"],
  ["schedule", "Exam Schedule"],
  ["marks", "Marks Entry"],
  ["grades", "Marks Grade"],
  ["results", "Exam Result"],
  ["admit-card", "Admit Card"],
  ["marksheet", "Marksheet"],
  ["aspects", "Aspects & Mark Fields"],
  ["reports", "Reports"],
];

export function ExamsPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ExamsTab>("groups");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [scheduleExamId, setScheduleExamId] = useState("");
  const [scheduleClassSectionId, setScheduleClassSectionId] = useState("");
  const [scheduleAddOpen, setScheduleAddOpen] = useState(false);
  const [marksScheduleId, setMarksScheduleId] = useState("");
  const [marksImportKey, setMarksImportKey] = useState(0);
  const [gradesAddOpen, setGradesAddOpen] = useState(false);
  const [resultsSelection, setResultsSelection] = useState("");

  const exams = useMemo(
    () => setup?.groups.flatMap((group) => group.exams.map((exam) => ({ ...exam, group }))) ?? [],
    [setup],
  );
  const schedules = useMemo(
    () => exams.flatMap((exam) => exam.schedules.map((schedule) => ({ ...schedule, exam }))),
    [exams],
  );

  async function load() {
    setLoading(true);
    try {
      setSetup(await apiRequest<Setup>("/exams/setup", accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load examinations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {setup?.currentSession ? (
        <span className="nx-pill nx-pill-indigo">{setup.currentSession.name}</span>
      ) : (
        <span className="nx-pill nx-pill-warning">No active session</span>
      )}
      {tab === "groups" ? (
        <button type="button" className="nx-btn-primary" onClick={() => setCreateGroupOpen(true)}>
          <AddOutlined sx={{ fontSize: 16 }} /> New exam group
        </button>
      ) : null}
      {tab === "schedule" ? (
        <button
          type="button"
          className="nx-btn-primary"
          onClick={() => {
            setScheduleAddOpen(true);
          }}
        >
          <AddOutlined sx={{ fontSize: 16 }} /> Add subject to schedule
        </button>
      ) : null}
      {tab === "marks" ? (
        <div className="text-right">
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setMarksImportKey((value) => value + 1)}
          >
            <UploadOutlined sx={{ fontSize: 16 }} /> Import CSV
          </button>
          <p className="mt-1 text-[10px] text-slate-500">
            Use 0 for present, 1 for absent when importing.
          </p>
        </div>
      ) : null}
      {tab === "grades" ? (
        <button type="button" className="nx-btn-primary" onClick={() => setGradesAddOpen(true)}>
          <AddOutlined sx={{ fontSize: 16 }} /> Add grade
        </button>
      ) : null}
    </div>
  );

  return (
    <CmsPage>
      <CmsPageHeader
        title="Examination"
        description="Manage exams, marks, results, and certificates."
        actions={headerActions}
      />

      <CmsTabs>
        {TABS.map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </CmsTab>
        ))}
      </CmsTabs>

      <CmsScrollBody>
        {!setup ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            {loading ? "Loading examinations…" : "Unable to load examinations."}
          </p>
        ) : (
          <>
            {tab === "groups" ? (
              <ExamGroupsPanel
                setup={setup}
                token={accessToken}
                createGroupOpen={createGroupOpen}
                onCloseCreateGroup={() => setCreateGroupOpen(false)}
                onSaved={load}
                onError={notifyError}
                onOpenSchedule={(examId, classSectionId) => {
                  setScheduleExamId(examId);
                  setScheduleClassSectionId(classSectionId ?? "");
                  setTab("schedule");
                }}
                onOpenMarks={(scheduleId) => {
                  setMarksScheduleId(scheduleId);
                  setTab("marks");
                }}
                onOpenGroupResults={(groupId) => {
                  setResultsSelection(`group:${groupId}`);
                  setTab("results");
                }}
              />
            ) : null}
            {tab === "schedule" ? (
              <SchedulePanel
                setup={setup}
                exams={exams}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
                initialExamId={scheduleExamId}
                initialClassSectionId={scheduleClassSectionId}
                showAddForm={scheduleAddOpen}
                onAddFormHandled={() => setScheduleAddOpen(false)}
              />
            ) : null}
            {tab === "marks" ? (
              <MarksEntryPanel
                setup={setup}
                exams={exams}
                schedules={schedules}
                token={accessToken}
                onError={notifyError}
                initialScheduleId={marksScheduleId}
                importRequestKey={marksImportKey}
              />
            ) : null}
            {tab === "grades" ? (
              <MarksGradePanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
                showAddRow={gradesAddOpen}
                onAddRowHandled={() => setGradesAddOpen(false)}
              />
            ) : null}
            {tab === "results" ? (
              <ExamResultsPanel
                setup={setup}
                exams={exams}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
                initialSelection={resultsSelection}
                onOpenMarks={(classSectionId) => {
                  if (classSectionId) {
                    const match = schedules.find((item) => item.classSection.id === classSectionId);
                    if (match) setMarksScheduleId(match.id);
                  }
                  setTab("marks");
                }}
              />
            ) : null}
            {tab === "admit-card" ? (
              <AdmitCardPanel
                setup={setup}
                exams={exams}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "marksheet" ? (
              <MarksheetPanel
                setup={setup}
                exams={exams}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "aspects" ? (
              <AspectsMarkFieldsPanel
                setup={setup}
                exams={exams}
                schedules={schedules}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "reports" ? (
              <ExamReportsPanel
                setup={setup}
                exams={exams}
                token={accessToken}
                onError={notifyError}
                onOpenMarksheet={() => setTab("marksheet")}
                onOpenAdmitCard={() => setTab("admit-card")}
                onOpenResults={(selection) => {
                  if (selection) setResultsSelection(selection);
                  setTab("results");
                }}
              />
            ) : null}
          </>
        )}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}
