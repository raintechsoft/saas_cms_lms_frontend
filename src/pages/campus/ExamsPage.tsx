import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Named { id: string; name: string }
interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named }>;
}
interface Schedule {
  id: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maximumMarks: string;
  minimumMarks: string;
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
}
type ExamStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  schedules: Schedule[];
  aspects: Array<{ id: string; name: string; maximumValue: string }>;
  _count: { students: number };
}
interface ExamGroup extends Named {
  resultType: string;
  academicSession: Named;
  exams: Exam[];
}
interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  grades: Array<{ id: string; resultType: string; name: string; minPercent: string; maxPercent: string; passStatus: string }>;
  groups: ExamGroup[];
  classSections: ClassSection[];
}
interface Roster {
  id: string;
  rollNumber: string | null;
  studentEnrollment: {
    student: { firstName: string; lastName: string | null; admissionNumber: string };
  };
  marks: Array<{ marksObtained: string; isAbsent: boolean; remarks: string | null }>;
}
interface Result {
  examStudentId: string;
  rank: number;
  student: { firstName: string; lastName: string | null; admissionNumber: string };
  obtainedMarks: number;
  maximumMarks: number;
  percentage: number;
  grade: string | null;
  passStatus: "PASS" | "FAIL";
}

const today = new Date().toISOString().slice(0, 10);

function toDateInput(value: string) {
  return value.slice(0, 10);
}

function examStatusClass(status: ExamStatus) {
  if (status === "PUBLISHED") return "badge-success";
  if (status === "ARCHIVED") return "badge-danger";
  return "badge";
}

export function ExamsPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [tab, setTab] = useState<"setup" | "schedule" | "fields" | "marks" | "results">("setup");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  const [selectedExam, setSelectedExam] = useState("");
  const [roster, setRoster] = useState<Roster[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [absences, setAbsences] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Result[]>([]);

  const exams = useMemo(
    () => setup?.groups.flatMap((group) => group.exams.map((exam) => ({ ...exam, group }))) ?? [],
    [setup],
  );
  const schedules = exams.flatMap((exam) =>
    exam.schedules.map((schedule) => ({ ...schedule, exam })),
  );

  async function load() {
    try {
      setSetup(await apiRequest<Setup>("/exams/setup", accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load examinations");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function loadRoster(scheduleId: string) {
    setSelectedSchedule(scheduleId);
    if (!scheduleId) return setRoster([]);
    try {
      const data = await apiRequest<Roster[]>(`/exams/schedules/${scheduleId}/roster`, accessToken);
      setRoster(data);
      setScores(Object.fromEntries(data.map((item) => [
        item.id,
        item.marks[0]?.marksObtained ?? "0",
      ])));
      setAbsences(Object.fromEntries(data.map((item) => [
        item.id,
        item.marks[0]?.isAbsent ?? false,
      ])));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load mark roster");
    }
  }

  async function saveMarks() {
    try {
      await apiRequest(`/exams/schedules/${selectedSchedule}/marks`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          entries: roster.map((student) => ({
            examStudentId: student.id,
            marksObtained: Number(scores[student.id] ?? 0),
            isAbsent: absences[student.id] ?? false,
          })),
        }),
      });
      notifySuccess("Marks saved");
      await loadRoster(selectedSchedule);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save marks");
    }
  }

  async function importMarksCsv(file: File | undefined) {
    if (!file) return;
    try {
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
      const dataLines = lines[0]?.toLowerCase().includes("admission") ? lines.slice(1) : lines;
      const nextScores = { ...scores };
      const nextAbsences = { ...absences };
      for (const line of dataLines) {
        const [admissionNumber, marks, absent] = line.split(",").map((value) => value.trim());
        const student = roster.find(
          (item) => item.studentEnrollment.student.admissionNumber === admissionNumber,
        );
        if (!student) continue;
        nextScores[student.id] = marks || "0";
        nextAbsences[student.id] = ["true", "yes", "absent", "1"].includes(
          (absent ?? "").toLowerCase(),
        );
      }
      setScores(nextScores);
      setAbsences(nextAbsences);
      notifySuccess("CSV imported. Review and save the marks.");
    } catch {
      notifyError("Unable to read CSV. Use admissionNumber,marks,absent columns.");
    }
  }

  async function loadResults(examId: string) {
    setSelectedExam(examId);
    if (!examId) return setResults([]);
    try {
      const path = examId.startsWith("group:")
        ? `/exams/groups/${examId.slice(6)}/results`
        : `/exams/${examId}/results`;
      const data = await apiRequest<{ results: Result[] }>(path, accessToken);
      setResults(data.results);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load results");
    }
  }

  async function publish() {
    try {
      await apiRequest(`/exams/${selectedExam}/publish`, accessToken, { method: "PUT" });
      notifySuccess("Result published");
      await Promise.all([load(), loadResults(selectedExam)]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to publish result");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Examination management"
        title="Exams and results"
        description="Configure grading, schedule subjects, enter marks, rank students, and publish results."
        action={<span className="badge">{setup?.currentSession?.name ?? "No current session"}</span>}
      />
      <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200">
        {(["setup", "schedule", "fields", "marks", "results"] as const).map((item) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>
            {item === "setup" ? "Groups & exams" : item === "schedule" ? "Schedule & assign" : item === "fields" ? "Grades & fields" : item === "marks" ? "Marks entry" : "Results & rank"}
          </button>
        ))}
      </div>

      <div className="page-scroll">
      {tab === "setup" && setup && (
        <ExamSetupPanel setup={setup} token={accessToken} onSaved={load} onError={notifyError} />
      )}
      {tab === "schedule" && setup && (
        <SchedulePanel setup={setup} exams={exams} token={accessToken} onSaved={load} onError={notifyError} />
      )}
      {tab === "fields" && setup && (
        <ExamFieldsPanel setup={setup} exams={exams} schedules={schedules} token={accessToken} onSaved={load} onError={notifyError} />
      )}
      {tab === "marks" && (
        <section className="mt-6">
          <select className="input max-w-xl" value={selectedSchedule} onChange={(event) => void loadRoster(event.target.value)}>
            <option value="">Select exam subject schedule</option>
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.exam.name} · {schedule.classSection.academicClass.name} {schedule.classSection.section.name} · {schedule.classSubject.subject.name}
              </option>
            ))}
          </select>
          {selectedSchedule && <label className="button-secondary mt-3 cursor-pointer">
            Import CSV
            <input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => void importMarksCsv(event.target.files?.[0])} />
          </label>}
          {selectedSchedule && (
            <div className="card mt-5 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {roster.map((student) => (
                  <div className="grid items-center gap-3 p-5 sm:grid-cols-[1fr_140px_100px]" key={student.id}>
                    <div>
                      <p className="font-medium">{student.studentEnrollment.student.firstName} {student.studentEnrollment.student.lastName}</p>
                      <p className="text-sm text-slate-500">Roll {student.rollNumber ?? "—"} · {student.studentEnrollment.student.admissionNumber}</p>
                    </div>
                    <input className="input" type="number" min="0" disabled={absences[student.id]} value={scores[student.id] ?? "0"}
                      onChange={(event) => setScores({ ...scores, [student.id]: event.target.value })} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={absences[student.id] ?? false} onChange={(event) => setAbsences({ ...absences, [student.id]: event.target.checked })} />Absent</label>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <button className="button-primary" disabled={!roster.length} onClick={() => void saveMarks()}>Save marks</button>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "results" && (
        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className="input max-w-xl" value={selectedExam} onChange={(event) => void loadResults(event.target.value)}>
              <option value="">Select exam</option>
              {setup?.groups.map((group) => <option key={`group:${group.id}`} value={`group:${group.id}`}>{group.name} · Consolidated result</option>)}
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.group.name} · {exam.name} · {exam.status}</option>)}
            </select>
            {selectedExam && !selectedExam.startsWith("group:") && exams.find((exam) => exam.id === selectedExam)?.status === "DRAFT" && (
              <button className="button-primary" onClick={() => void publish()}>Publish result</button>
            )}
          </div>
          {results.length > 0 && (
            <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
              {results.map((result) => (
                <div className="grid items-center gap-3 p-5 sm:grid-cols-[70px_1fr_repeat(3,110px)]" key={result.examStudentId}>
                  <strong>#{result.rank}</strong>
                  <div><p className="font-medium">{result.student.firstName} {result.student.lastName}</p><p className="text-sm text-slate-500">{result.student.admissionNumber}</p></div>
                  <span>{result.obtainedMarks}/{result.maximumMarks}</span>
                  <span>{result.percentage}% · {result.grade ?? "—"}</span>
                  <span className={result.passStatus === "PASS" ? "badge-success" : "badge-danger"}>{result.passStatus}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>
    </main>
  );
}

function ExamSetupPanel({ setup, token, onSaved, onError }: {
  setup: Setup; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [group, setGroup] = useState({ academicSessionId: setup.currentSession?.id ?? "", name: "", resultType: "SCHOOL_GRADING" });
  const [exam, setExam] = useState({ examGroupId: "", name: "", startDate: today, endDate: today });
  async function submitGroup(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/exams/groups", token, { method: "POST", body: JSON.stringify(group) });
      setGroup({ ...group, name: "" });
      notifySuccess("Exam group created");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create exam group"); }
  }
  async function submitExam(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/exams", token, { method: "POST", body: JSON.stringify(exam) });
      setExam({ ...exam, name: "" });
      notifySuccess("Exam created");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create exam"); }
  }
  async function renameGroup(item: ExamGroup) {
    const name = window.prompt("Exam group name", item.name)?.trim();
    if (!name || name === item.name) return;
    try {
      await apiRequest(`/exams/groups/${item.id}`, token, { method: "PUT", body: JSON.stringify({ name }) });
      notifySuccess("Exam group renamed");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to rename group"); }
  }
  async function removeGroup(item: ExamGroup) {
    if (item.exams.length > 0) return;
    const ok = await confirmDelete({
      title: "Delete exam group?",
      text: `"${item.name}" will be permanently deleted.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/groups/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Exam group deleted");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to delete group"); }
  }
  async function editExam(item: Exam) {
    if (item.status === "ARCHIVED") return;
    const name = window.prompt("Exam name", item.name)?.trim();
    if (!name) return;
    const startDate = window.prompt("Start date (YYYY-MM-DD)", toDateInput(item.startDate))?.trim();
    if (!startDate) return;
    const endDate = window.prompt("End date (YYYY-MM-DD)", toDateInput(item.endDate))?.trim();
    if (!endDate) return;
    try {
      await apiRequest(`/exams/${item.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ name, startDate, endDate }),
      });
      notifySuccess("Exam updated");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to update exam"); }
  }
  async function archiveExamItem(item: Exam) {
    if (item.status === "ARCHIVED") return;
    try {
      await apiRequest(`/exams/${item.id}/archive`, token, { method: "PUT" });
      notifySuccess("Exam archived");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to archive exam"); }
  }
  async function removeExam(item: Exam) {
    if (item.status === "PUBLISHED") return;
    const ok = await confirmDelete({
      title: "Delete exam?",
      text: `"${item.name}" (${item.status}) will be permanently deleted.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Exam deleted");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to delete exam"); }
  }
  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <form className="card p-5" onSubmit={submitGroup}>
          <h2 className="font-semibold">Create exam class group</h2>
          <select className="input mt-4" required value={group.academicSessionId} onChange={(e) => setGroup({ ...group, academicSessionId: e.target.value })}>
            <option value="">Academic session</option>{setup.sessions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <input className="input mt-3" required placeholder="Group, e.g. Term 2" value={group.name} onChange={(e) => setGroup({ ...group, name: e.target.value })} />
          <select className="input mt-3" value={group.resultType} onChange={(e) => setGroup({ ...group, resultType: e.target.value })}>
            <option value="GENERAL">General pass/fail</option><option value="SCHOOL_GRADING">School grading</option>
            <option value="COLLEGE_GRADING">College grading</option><option value="GPA">GPA grading</option>
          </select>
          <button className="button-primary mt-4">Create group</button>
        </form>
        <form className="card p-5" onSubmit={submitExam}>
          <h2 className="font-semibold">Create exam</h2>
          <select className="input mt-4" required value={exam.examGroupId} onChange={(e) => setExam({ ...exam, examGroupId: e.target.value })}>
            <option value="">Exam group</option>{setup.groups.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
          <input className="input mt-3" required placeholder="Exam name" value={exam.name} onChange={(e) => setExam({ ...exam, name: e.target.value })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input className="input" type="date" value={exam.startDate} onChange={(e) => setExam({ ...exam, startDate: e.target.value })} />
            <input className="input" type="date" value={exam.endDate} onChange={(e) => setExam({ ...exam, endDate: e.target.value })} />
          </div>
          <button className="button-primary mt-4">Create exam</button>
        </form>
      </div>
      <div className="space-y-4">
        {setup.groups.map((item) => (
          <div className="card overflow-hidden" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-slate-500">{item.academicSession.name} · {item.resultType.replaceAll("_", " ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="button-secondary" type="button" onClick={() => void renameGroup(item)}>Edit name</button>
                {item.exams.length === 0 && (
                  <button className="button-secondary" type="button" onClick={() => void removeGroup(item)}>Delete</button>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {item.exams.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No exams in this group yet.</p>
              ) : item.exams.map((examItem) => (
                <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={examItem.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{examItem.name}</p>
                      <span className={examStatusClass(examItem.status)}>{examItem.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(examItem.startDate).toLocaleDateString()} – {new Date(examItem.endDate).toLocaleDateString()}
                      {" · "}{examItem.schedules.length} schedules · {examItem._count.students} students
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {examItem.status !== "ARCHIVED" && (
                      <button className="button-secondary" type="button" onClick={() => void editExam(examItem)}>Edit</button>
                    )}
                    {examItem.status !== "ARCHIVED" && (
                      <button className="button-secondary" type="button" onClick={() => void archiveExamItem(examItem)}>Archive</button>
                    )}
                    {(examItem.status === "DRAFT" || examItem.status === "ARCHIVED") && (
                      <button className="button-secondary" type="button" onClick={() => void removeExam(examItem)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!setup.groups.length && (
          <div className="card p-6"><p className="text-sm text-slate-500">No exam groups yet.</p></div>
        )}
      </div>
    </section>
  );
}

function SchedulePanel({ setup, exams, token, onSaved, onError }: {
  setup: Setup; exams: Array<Exam & { group: ExamGroup }>; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ examId: "", classSectionId: "", classSubjectId: "", examDate: today, startTime: "09:00", endTime: "12:00", maximumMarks: "100", minimumMarks: "40", room: "" });
  const section = setup.classSections.find((item) => item.id === form.classSectionId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const { examId, ...payload } = form;
      await apiRequest(`/exams/${examId}/schedules`, token, { method: "POST", body: JSON.stringify(payload) });
      await apiRequest(`/exams/${examId}/students`, token, {
        method: "POST", body: JSON.stringify({ classSectionId: form.classSectionId }),
      });
      notifySuccess("Schedule created and students assigned");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create schedule"); }
  }
  async function editSchedule(schedule: Schedule) {
    const examDate = window.prompt("Exam date (YYYY-MM-DD)", toDateInput(schedule.examDate))?.trim();
    if (!examDate) return;
    const startTime = window.prompt("Start time (HH:MM)", schedule.startTime)?.trim();
    if (!startTime) return;
    const endTime = window.prompt("End time (HH:MM)", schedule.endTime)?.trim();
    if (!endTime) return;
    try {
      await apiRequest(`/exams/schedules/${schedule.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ examDate, startTime, endTime }),
      });
      notifySuccess("Schedule updated");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to update schedule"); }
  }
  async function removeSchedule(schedule: Schedule, examName: string) {
    const ok = await confirmDelete({
      title: "Delete schedule?",
      text: `Remove ${examName} · ${schedule.classSubject.subject.name} schedule?`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/schedules/${schedule.id}`, token, { method: "DELETE" });
      notifySuccess("Schedule deleted");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to delete schedule"); }
  }
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[420px_1fr]">
      <form className="card p-5" onSubmit={submit}>
        <h2 className="font-semibold">Schedule subject and assign class</h2>
        <select className="input mt-4" required value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
          <option value="">Draft exam</option>{exams.filter((item) => item.status === "DRAFT").map((item) => <option value={item.id} key={item.id}>{item.group.name} · {item.name}</option>)}
        </select>
        <select className="input mt-3" required value={form.classSectionId} onChange={(e) => setForm({ ...form, classSectionId: e.target.value, classSubjectId: "" })}>
          <option value="">Class section</option>{setup.classSections.map((item) => <option value={item.id} key={item.id}>{item.academicClass.name} · {item.section.name}</option>)}
        </select>
        <select className="input mt-3" required value={form.classSubjectId} onChange={(e) => setForm({ ...form, classSubjectId: e.target.value })}>
          <option value="">Linked subject</option>{section?.subjects.map((item) => <option value={item.id} key={item.id}>{item.subject.name}</option>)}
        </select>
        <input className="input mt-3" type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <input className="input" type="number" value={form.maximumMarks} onChange={(e) => setForm({ ...form, maximumMarks: e.target.value })} />
          <input className="input" type="number" value={form.minimumMarks} onChange={(e) => setForm({ ...form, minimumMarks: e.target.value })} />
        </div>
        <button className="button-primary mt-4">Schedule and assign students</button>
      </form>
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Current schedules</div>
        <div className="divide-y divide-slate-100">
          {exams.flatMap((exam) => exam.schedules.map((schedule) => (
            <div className="p-5" key={schedule.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{exam.name} · {schedule.classSubject.subject.name}</p>
                    <span className={examStatusClass(exam.status)}>{exam.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{schedule.classSection.academicClass.name} {schedule.classSection.section.name} · {new Date(schedule.examDate).toLocaleDateString()} · {schedule.startTime}–{schedule.endTime}</p>
                </div>
                {exam.status === "DRAFT" && (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary" type="button" onClick={() => void editSchedule(schedule)}>Edit</button>
                    <button className="button-secondary" type="button" onClick={() => void removeSchedule(schedule, exam.name)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          )))}
          {!exams.some((exam) => exam.schedules.length > 0) && (
            <p className="p-8 text-center text-sm text-slate-500">No schedules yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ExamFieldsPanel({ setup, exams, schedules, token, onSaved, onError }: {
  setup: Setup;
  exams: Array<Exam & { group: ExamGroup }>;
  schedules: Array<Schedule & { exam: Exam & { group: ExamGroup } }>;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [grade, setGrade] = useState({ resultType: "SCHOOL_GRADING", name: "", minPercent: "", maxPercent: "", gradePoint: "", passStatus: "PASS" });
  const [component, setComponent] = useState({ scheduleId: "", name: "", maximumMarks: "" });
  const [aspect, setAspect] = useState({ examId: "", name: "", maximumValue: "5" });
  const [aspectEntry, setAspectEntry] = useState({ scheduleId: "", aspectFieldId: "" });
  const [roster, setRoster] = useState<Roster[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const entrySchedule = schedules.find((item) => item.id === aspectEntry.scheduleId);
  const aspectOptions = exams.find((item) => item.id === entrySchedule?.exam.id)?.aspects ?? [];
  async function createGrade(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/exams/grades", token, {
        method: "POST",
        body: JSON.stringify({
          ...grade,
          minPercent: Number(grade.minPercent),
          maxPercent: Number(grade.maxPercent),
          gradePoint: grade.gradePoint ? Number(grade.gradePoint) : null,
        }),
      });
      setGrade({ ...grade, name: "", minPercent: "", maxPercent: "", gradePoint: "" });
      notifySuccess("Marks grade added");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create marks grade"); }
  }
  async function editGrade(item: Setup["grades"][number]) {
    const name = window.prompt("Grade name", item.name)?.trim();
    if (!name) return;
    const minPercent = window.prompt("Min percent", String(item.minPercent))?.trim();
    if (minPercent == null || minPercent === "") return;
    const maxPercent = window.prompt("Max percent", String(item.maxPercent))?.trim();
    if (maxPercent == null || maxPercent === "") return;
    try {
      await apiRequest(`/exams/grades/${item.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          name,
          minPercent: Number(minPercent),
          maxPercent: Number(maxPercent),
        }),
      });
      notifySuccess("Grade updated");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to update grade"); }
  }
  async function removeGrade(item: Setup["grades"][number]) {
    const ok = await confirmDelete({
      title: "Delete grade?",
      text: `"${item.name}" (${item.minPercent}–${item.maxPercent}%) will be removed.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/exams/grades/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Grade deleted");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to delete grade"); }
  }
  async function createComponent(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/exams/schedules/${component.scheduleId}/components`, token, {
        method: "POST",
        body: JSON.stringify({ name: component.name, maximumMarks: Number(component.maximumMarks) }),
      });
      setComponent({ ...component, name: "", maximumMarks: "" });
      notifySuccess("Subject mark field added");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to add subject mark field"); }
  }
  async function createAspect(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/exams/${aspect.examId}/aspects`, token, {
        method: "POST",
        body: JSON.stringify({ name: aspect.name, maximumValue: Number(aspect.maximumValue) }),
      });
      setAspect({ ...aspect, name: "" });
      notifySuccess("Aspect field created");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create aspect field"); }
  }
  async function selectAspectSchedule(scheduleId: string) {
    setAspectEntry({ scheduleId, aspectFieldId: "" });
    if (!scheduleId) return setRoster([]);
    try {
      const next = await apiRequest<Roster[]>(`/exams/schedules/${scheduleId}/roster`, token);
      setRoster(next);
      setValues(Object.fromEntries(next.map((item) => [item.id, "0"])));
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to load aspect roster"); }
  }
  async function saveAspectValues() {
    try {
      await apiRequest(`/exams/aspects/${aspectEntry.aspectFieldId}/values`, token, {
        method: "PUT",
        body: JSON.stringify({
          entries: roster.map((item) => ({
            examStudentId: item.id,
            value: Number(values[item.id] ?? 0),
          })),
        }),
      });
      notifySuccess("Aspect values saved");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to save aspect values"); }
  }
  return (
    <section className="mt-6 space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <form className="card p-5" onSubmit={createGrade}>
          <h2 className="font-semibold">Marks grade</h2>
          <select className="input mt-4" value={grade.resultType} onChange={(e) => setGrade({ ...grade, resultType: e.target.value })}><option value="GENERAL">General</option><option value="SCHOOL_GRADING">School grading</option><option value="COLLEGE_GRADING">College grading</option><option value="GPA">GPA</option></select>
          <input className="input mt-3" required placeholder="Grade, e.g. B+" value={grade.name} onChange={(e) => setGrade({ ...grade, name: e.target.value })} />
          <div className="mt-3 grid grid-cols-2 gap-3"><input className="input" type="number" min="0" max="100" required placeholder="Min %" value={grade.minPercent} onChange={(e) => setGrade({ ...grade, minPercent: e.target.value })} /><input className="input" type="number" min="0" max="100" required placeholder="Max %" value={grade.maxPercent} onChange={(e) => setGrade({ ...grade, maxPercent: e.target.value })} /></div>
          <input className="input mt-3" type="number" min="0" placeholder="Grade point" value={grade.gradePoint} onChange={(e) => setGrade({ ...grade, gradePoint: e.target.value })} />
          <select className="input mt-3" value={grade.passStatus} onChange={(e) => setGrade({ ...grade, passStatus: e.target.value })}><option value="PASS">Pass</option><option value="FAIL">Fail</option></select>
          <button className="button-primary mt-4">Add grade</button>
          <div className="mt-4 flex flex-wrap gap-2">
            {setup.grades.map((item) => (
              <span className={`inline-flex items-center gap-2 ${item.passStatus === "PASS" ? "badge-success" : "badge-danger"}`} key={item.id}>
                {item.name} · {item.minPercent}–{item.maxPercent}%
                <button className="text-xs underline" type="button" onClick={() => void editGrade(item)}>Edit</button>
                <button className="text-xs underline" type="button" onClick={() => void removeGrade(item)}>Delete</button>
              </span>
            ))}
          </div>
        </form>
        <form className="card p-5" onSubmit={createComponent}>
          <h2 className="font-semibold">Subject mark field</h2>
          <select className="input mt-4" required value={component.scheduleId} onChange={(e) => setComponent({ ...component, scheduleId: e.target.value })}><option value="">Subject schedule</option>{schedules.filter((item) => item.exam.status === "DRAFT").map((item) => <option value={item.id} key={item.id}>{item.exam.name} · {item.classSubject.subject.name}</option>)}</select>
          <input className="input mt-3" required placeholder="Field, e.g. Theory" value={component.name} onChange={(e) => setComponent({ ...component, name: e.target.value })} />
          <input className="input mt-3" type="number" min="1" required placeholder="Maximum marks" value={component.maximumMarks} onChange={(e) => setComponent({ ...component, maximumMarks: e.target.value })} />
          <button className="button-primary mt-4">Link mark field</button>
        </form>
        <form className="card p-5" onSubmit={createAspect}>
          <h2 className="font-semibold">Co-scholastic aspect</h2>
          <select className="input mt-4" required value={aspect.examId} onChange={(e) => setAspect({ ...aspect, examId: e.target.value })}><option value="">Draft exam</option>{exams.filter((item) => item.status === "DRAFT").map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <input className="input mt-3" required placeholder="Aspect, e.g. Discipline" value={aspect.name} onChange={(e) => setAspect({ ...aspect, name: e.target.value })} />
          <input className="input mt-3" type="number" min="1" required placeholder="Maximum value" value={aspect.maximumValue} onChange={(e) => setAspect({ ...aspect, maximumValue: e.target.value })} />
          <button className="button-primary mt-4">Create aspect</button>
        </form>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold">Input aspect values</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select className="input" value={aspectEntry.scheduleId} onChange={(e) => void selectAspectSchedule(e.target.value)}><option value="">Exam class roster</option>{schedules.filter((item) => item.exam.status === "DRAFT" && item.exam.aspects.length).map((item) => <option value={item.id} key={item.id}>{item.exam.name} · {item.classSection.academicClass.name} {item.classSection.section.name}</option>)}</select>
          <select className="input" value={aspectEntry.aspectFieldId} onChange={(e) => setAspectEntry({ ...aspectEntry, aspectFieldId: e.target.value })}><option value="">Aspect field</option>{aspectOptions.map((item) => <option value={item.id} key={item.id}>{item.name} / {item.maximumValue}</option>)}</select>
        </div>
        {roster.length > 0 && <div className="mt-4 divide-y divide-slate-100 rounded-xl border">{roster.map((item) => <div className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_140px]" key={item.id}><span>{item.studentEnrollment.student.firstName} {item.studentEnrollment.student.lastName}</span><input className="input" type="number" min="0" value={values[item.id] ?? "0"} onChange={(e) => setValues({ ...values, [item.id]: e.target.value })} /></div>)}</div>}
        <button className="button-primary mt-4" disabled={!roster.length || !aspectEntry.aspectFieldId} onClick={() => void saveAspectValues()}>Save aspect values</button>
      </div>
    </section>
  );
}
