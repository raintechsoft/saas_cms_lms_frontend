import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

interface Item { id: string; name: string; code?: string | null }
interface Person { id: string; firstName: string; lastName: string }
interface ClassSection {
  id: string;
  academicClass: Item;
  section: Item;
  classTeacher: Person | null;
  subjects: Array<{ id: string; subject: Item; teacher: Person | null }>;
  _count: { enrollments: number };
}
interface Setup {
  currentSession: Item | null;
  sessions: Array<Item & { isCurrent: boolean }>;
  classes: Item[];
  sections: Item[];
  subjects: Item[];
  teachers: Person[];
  classSections: ClassSection[];
  teacherRoleId: string | null;
}

type MasterType = "classes" | "sections" | "subjects";

const defaultSession = {
  name: "2026-2027",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
};

const MASTER_HELP: Record<MasterType, { title: string; hint: string; example: string; code?: string }> = {
  classes: {
    title: "Class",
    hint: "The grade or year level students belong to.",
    example: "Class 6",
    code: "6",
  },
  sections: {
    title: "Section",
    hint: "The division within a class (batch/group).",
    example: "A",
  },
  subjects: {
    title: "Subject",
    hint: "Subjects you will assign to class sections in Step 4.",
    example: "Mathematics",
    code: "MATH",
  },
};

const STEPS = [
  { key: 1, title: "Session", desc: "Set the school year" },
  { key: 2, title: "Master data", desc: "Classes, sections, subjects" },
  { key: 3, title: "Class section", desc: "Link class + section" },
  { key: 4, title: "Subjects", desc: "Assign to class section" },
] as const;

export function AcademicsPage() {
  const { accessToken } = useAuth();
  const sessionRef = useRef<HTMLDivElement>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");
  const [guideOpen, setGuideOpen] = useState(true);
  const [masterType, setMasterType] = useState<MasterType>("classes");
  const [master, setMaster] = useState({ name: "", code: "" });
  const [group, setGroup] = useState({ classId: "", sectionId: "", classTeacherId: "" });
  const [assignment, setAssignment] = useState({ classSectionId: "", subjectId: "", teacherId: "" });
  const [sessionForm, setSessionForm] = useState(defaultSession);
  const [activateSessionId, setActivateSessionId] = useState("");
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "ChangeMe123!",
  });

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/academics/setup", accessToken);
      setSetup(data);
      if (!data.currentSession && data.sessions.length) {
        setActivateSessionId(data.sessions[0]?.id ?? "");
      }
      if (data.classSections.length === 1 && !assignment.classSectionId) {
        setAssignment((prev) => ({ ...prev, classSectionId: data.classSections[0]!.id }));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load academics");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  const teachers = setup?.teachers ?? [];
  const hasSession = Boolean(setup?.currentSession);
  const hasSubjectsAssigned = Boolean(setup?.classSections.some((item) => item.subjects.length > 0));

  const stepStatus = useMemo(() => ({
    1: hasSession,
    2: Boolean(setup?.classes.length && setup?.sections.length && setup?.subjects.length),
    3: Boolean(setup?.classSections.length),
    4: hasSubjectsAssigned,
  }), [hasSession, setup, hasSubjectsAssigned]);

  const activeStep = useMemo(() => {
    if (!stepStatus[1]) return 1;
    if (!stepStatus[2]) return 2;
    if (!stepStatus[3]) return 3;
    if (!stepStatus[4]) return 4;
    return 4;
  }, [stepStatus]);

  const selectedClass = setup?.classes.find((item) => item.id === group.classId);
  const selectedSection = setup?.sections.find((item) => item.id === group.sectionId);
  const masterHelp = MASTER_HELP[masterType];

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function focusSessionStep() {
    sessionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function nextStepHint(step: number) {
    const hints: Record<number, string> = {
      1: "Next: add classes, sections, and subjects in Step 2.",
      2: "Next: link a class and section in Step 3.",
      3: "Next: assign subjects in Step 4.",
      4: "Setup complete. Enrol students from the Students page.",
    };
    return hints[step] ?? "";
  }

  async function addSession(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    setSaving("session");
    try {
      await apiRequest("/academic-sessions", accessToken, {
        method: "POST",
        body: JSON.stringify({ ...sessionForm, isCurrent: true }),
      });
      setMessage(`Session created. ${nextStepHint(1)}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create session");
    } finally {
      setSaving("");
    }
  }

  async function activateSession(event: FormEvent) {
    event.preventDefault();
    if (!activateSessionId) return;
    clearFeedback();
    setSaving("session");
    try {
      await apiRequest(`/academic-sessions/${activateSessionId}/current`, accessToken, {
        method: "PUT",
      });
      setMessage("Current session updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to set current session");
    } finally {
      setSaving("");
    }
  }

  async function addMaster(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    setSaving("master");
    try {
      await apiRequest(`/academics/${masterType}`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: master.name,
          ...(masterType !== "sections" ? { code: master.code || null } : {}),
        }),
      });
      setMaster({ name: "", code: "" });
      const label = MASTER_HELP[masterType].title;
      setMessage(`${label} "${master.name.trim()}" added. ${!stepStatus[2] ? nextStepHint(2) : ""}`.trim());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add record");
    } finally {
      setSaving("");
    }
  }

  async function addTeacher(event: FormEvent) {
    event.preventDefault();
    if (!setup?.teacherRoleId) {
      setError("Teacher role is not available. Refresh the page and try again.");
      return;
    }
    clearFeedback();
    setSaving("teacher");
    try {
      const created = await apiRequest<Person>("/users", accessToken, {
        method: "POST",
        body: JSON.stringify({
          firstName: teacherForm.firstName.trim(),
          lastName: teacherForm.lastName.trim(),
          email: teacherForm.email.trim().toLowerCase(),
          password: teacherForm.password,
          roleIds: [setup.teacherRoleId],
        }),
      });
      setTeacherForm({ firstName: "", lastName: "", email: "", password: "ChangeMe123!" });
      setTeacherModalOpen(false);
      setGroup((prev) => ({ ...prev, classTeacherId: created.id }));
      setAssignment((prev) => ({ ...prev, teacherId: created.id }));
      setMessage(`Teacher ${created.firstName} ${created.lastName} added.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add teacher");
    } finally {
      setSaving("");
    }
  }

  async function addGroup(event: FormEvent) {
    event.preventDefault();
    if (!setup?.currentSession) {
      setError("Create or activate an academic session first (Step 1).");
      focusSessionStep();
      return;
    }
    if (!group.classId || !group.sectionId) {
      setError("Select both a class and a section.");
      return;
    }
    clearFeedback();
    setSaving("section");
    try {
      const created = await apiRequest<ClassSection>("/academics/class-sections", accessToken, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: setup.currentSession.id,
          classId: group.classId,
          sectionId: group.sectionId,
          classTeacherId: group.classTeacherId || null,
        }),
      });
      setGroup({ classId: "", sectionId: "", classTeacherId: "" });
      setAssignment({ classSectionId: created.id, subjectId: "", teacherId: "" });
      setMessage(`Class section saved. ${nextStepHint(3)}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create class section");
    } finally {
      setSaving("");
    }
  }

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    clearFeedback();
    setSaving("subject");
    try {
      await apiRequest("/academics/subject-assignments", accessToken, {
        method: "POST",
        body: JSON.stringify({
          classSectionId: assignment.classSectionId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId || null,
        }),
      });
      setAssignment((prev) => ({ ...prev, subjectId: "", teacherId: "" }));
      setMessage(`Subject assigned. ${nextStepHint(4)}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign subject");
    } finally {
      setSaving("");
    }
  }

  if (loading && !setup) {
    return (
      <main className="page-main">
        <PageHeader eyebrow="Shared core" title="Academic structure" description="Loading your academic setup…" />
        <p className="mt-8 text-sm text-slate-500">Please wait…</p>
      </main>
    );
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Shared core"
        title="Academic structure"
        description="Set up your school year, classes, and subject assignments in four simple steps."
        action={setup?.currentSession && <span className="badge-success">{setup.currentSession.name}</span>}
      />

      {error && <p className="alert-error mt-6">{error}</p>}
      {message && (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <section className="mt-6 card p-5">
        <button
          className="flex w-full items-center justify-between gap-3 text-left"
          type="button"
          onClick={() => setGuideOpen((open) => !open)}
        >
          <div>
            <p className="font-semibold">How this page works</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Think of it as: Session → Names (class/section/subject) → Combine class+section → Assign subjects.
            </p>
          </div>
          <span className="text-sm text-violet-600">{guideOpen ? "Hide" : "Show"} guide</span>
        </button>
        {guideOpen && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
            <GuideItem step={1} title="Academic session" example="2026-2027 (Apr 2026 – Mar 2027)">
              The active school year. Required before saving class sections.
            </GuideItem>
            <GuideItem step={2} title="Master data" example="Class 6, Section A, Mathematics">
              Create names first. Dropdowns in later steps only show what you add here.
            </GuideItem>
            <GuideItem step={3} title="Class section" example="Class 6 + Section A = 6 · A">
              Links a class and section for the current session. Optional class teacher.
            </GuideItem>
            <GuideItem step={4} title="Assign subject" example="6 · A → Mathematics → Teacher">
              Pick a class section, subject, and teacher. Repeat for each subject.
            </GuideItem>
          </div>
        )}
      </section>

      <SetupOverview setup={setup} />

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        {STEPS.map((step) => (
          <StepBadge
            key={step.key}
            done={stepStatus[step.key]}
            active={activeStep === step.key}
            label={`${step.key}. ${step.title}`}
            desc={step.desc}
          />
        ))}
      </section>

      <div ref={sessionRef} className="mt-8">
        {!hasSession ? (
          <div className="card border-amber-200 bg-amber-50/60 p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-200 text-sm font-bold text-amber-900">1</span>
              <div className="flex-1">
                <h2 className="font-semibold text-amber-950">Start here — create academic session</h2>
                <p className="mt-1 text-sm text-amber-900">
                  Example: <strong>2026-2027</strong> from 1 April 2026 to 31 March 2027.
                </p>
              </div>
            </div>

            {setup?.sessions.length ? (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={activateSession}>
                <label className="flex-1 text-sm">
                  <span className="label">Or activate an existing session</span>
                  <select className="input mt-1" value={activateSessionId}
                    onChange={(e) => setActivateSessionId(e.target.value)}>
                    {setup.sessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.name}</option>
                    ))}
                  </select>
                </label>
                <button className="button-primary" type="submit" disabled={saving === "session"}>
                  {saving === "session" ? "Saving…" : "Set as current"}
                </button>
              </form>
            ) : null}

            <form className="mt-4 grid gap-3 border-t border-amber-200 pt-4 md:grid-cols-4 md:items-end" onSubmit={addSession}>
              <label className="text-sm md:col-span-1">
                <span className="label">Session name</span>
                <input className="input mt-1" required value={sessionForm.name}
                  onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="label">Start date</span>
                <input className="input mt-1" required type="date" value={sessionForm.startDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="label">End date</span>
                <input className="input mt-1" required type="date" value={sessionForm.endDate}
                  onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })} />
              </label>
              <button className="button-primary" type="submit" disabled={saving === "session"}>
                {saving === "session" ? "Creating…" : "Create session"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="badge-success">Step 1 done</span>
              <div>
                <p className="text-sm text-slate-500">Current session</p>
                <p className="text-lg font-semibold">{setup?.currentSession?.name}</p>
              </div>
            </div>
            {setup && setup.sessions.length > 1 && (
              <form className="flex items-end gap-2" onSubmit={activateSession}>
                <label className="text-sm">
                  <span className="label">Switch session</span>
                  <select className="input mt-1" value={activateSessionId || setup.currentSession?.id}
                    onChange={(e) => setActivateSessionId(e.target.value)}>
                    {setup.sessions.map((session) => (
                      <option key={session.id} value={session.id}>{session.name}</option>
                    ))}
                  </select>
                </label>
                <button className="button-secondary" type="submit" disabled={saving === "session"}>Switch</button>
              </form>
            )}
          </div>
        )}
      </div>

      <section className="mt-8 grid gap-5 xl:grid-cols-3">
        <form className={`card p-5 ${activeStep === 2 ? "ring-2 ring-violet-200" : ""}`} onSubmit={addMaster}>
          <StepHeader number={2} title="Add master data" done={stepStatus[2]} />
          <p className="mt-2 text-sm text-slate-500">
            Add at least one <strong>class</strong>, one <strong>section</strong>, and one <strong>subject</strong>.
          </p>

          <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["classes", "sections", "subjects"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition ${masterType === type
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => { setMasterType(type); setMaster({ name: "", code: "" }); }}
              >
                {MASTER_HELP[type].title}
                <CountDot count={
                  type === "classes" ? setup?.classes.length
                    : type === "sections" ? setup?.sections.length
                      : setup?.subjects.length
                } />
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {masterHelp.hint} Example: <strong>{masterHelp.example}</strong>
          </p>

          <label className="mt-4 block text-sm">
            <span className="label">{masterHelp.title} name</span>
            <input className="input mt-1" placeholder={masterHelp.example} required
              value={master.name} onChange={(e) => setMaster({ ...master, name: e.target.value })} />
          </label>
          {masterType !== "sections" && (
            <label className="mt-3 block text-sm">
              <span className="label">Short code (optional)</span>
              <input className="input mt-1" placeholder={masterHelp.code ?? ""}
                value={master.code} onChange={(e) => setMaster({ ...master, code: e.target.value })} />
            </label>
          )}

          <MasterChecklist setup={setup} />

          <button className="button-primary mt-4 w-full" type="submit" disabled={saving === "master"}>
            {saving === "master" ? "Adding…" : `Add ${masterHelp.title.toLowerCase()}`}
          </button>
        </form>

        <form className={`card p-5 ${activeStep === 3 ? "ring-2 ring-violet-200" : ""}`} onSubmit={addGroup}>
          <StepHeader number={3} title="Create class section" done={stepStatus[3]} />
          <p className="mt-2 text-sm text-slate-500">
            Pick a class and section from Step 2. Result looks like <strong>Class 6 · A</strong>.
          </p>
          {!hasSession && (
            <HintBox>
              Complete <button type="button" className="font-medium underline" onClick={focusSessionStep}>Step 1</button> first.
            </HintBox>
          )}
          {!setup?.classes.length || !setup?.sections.length ? (
            <HintBox>Add classes and sections in Step 2 before continuing.</HintBox>
          ) : null}

          <label className="mt-4 block text-sm">
            <span className="label">Class</span>
            <select className="input mt-1" required value={group.classId}
              onChange={(e) => setGroup({ ...group, classId: e.target.value })}>
              <option value="">{setup?.classes.length ? "Choose class" : "No classes — add in Step 2"}</option>
              {(setup?.classes ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            <span className="label">Section</span>
            <select className="input mt-1" required value={group.sectionId}
              onChange={(e) => setGroup({ ...group, sectionId: e.target.value })}>
              <option value="">{setup?.sections.length ? "Choose section" : "No sections — add in Step 2"}</option>
              {(setup?.sections ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          {selectedClass && selectedSection && (
            <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              Preview: <strong>{selectedClass.name} · {selectedSection.name}</strong>
            </p>
          )}

          <div className="mt-3 flex items-end justify-between gap-3">
            <label className="block flex-1 text-sm">
              <span className="label">Class teacher (optional)</span>
              <select className="input mt-1" value={group.classTeacherId}
                onChange={(e) => setGroup({ ...group, classTeacherId: e.target.value })}>
                <option value="">No teacher assigned</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>
                ))}
              </select>
            </label>
            <button className="button-secondary shrink-0" type="button" onClick={() => setTeacherModalOpen(true)}>
              + Add teacher
            </button>
          </div>

          <button className="button-primary mt-4 w-full" type="submit" disabled={saving === "section"}>
            {saving === "section" ? "Saving…" : "Save class section"}
          </button>
        </form>

        <form className={`card p-5 ${activeStep === 4 ? "ring-2 ring-violet-200" : ""}`} onSubmit={addSubject}>
          <StepHeader number={4} title="Assign subject" done={stepStatus[4]} />
          <p className="mt-2 text-sm text-slate-500">
            Connect a subject to a class section. Add subjects in Step 2 first.
          </p>

          <label className="mt-4 block text-sm">
            <span className="label">Class section</span>
            <select className="input mt-1" required value={assignment.classSectionId}
              onChange={(e) => setAssignment({ ...assignment, classSectionId: e.target.value })}>
              <option value="">
                {setup?.classSections.length ? "Choose class section" : "No class sections — complete Step 3"}
              </option>
              {setup?.classSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.academicClass.name} · {item.section.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-sm">
            <span className="label">Subject</span>
            <select className="input mt-1" required value={assignment.subjectId}
              onChange={(e) => setAssignment({ ...assignment, subjectId: e.target.value })}
              disabled={!setup?.subjects.length}>
              <option value="">
                {setup?.subjects.length ? "Choose subject" : "No subjects — add in Step 2"}
              </option>
              {(setup?.subjects ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {!setup?.subjects.length && (
            <HintBox>Go to Step 2 → tap <strong>Subject</strong> tab → add Mathematics, English, etc.</HintBox>
          )}

          <label className="mt-3 block text-sm">
            <span className="label">Subject teacher (optional)</span>
            <select className="input mt-1" value={assignment.teacherId}
              onChange={(e) => setAssignment({ ...assignment, teacherId: e.target.value })}>
              <option value="">No teacher assigned</option>
              {teachers.map((item) => (
                <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>
              ))}
            </select>
          </label>

          <button className="button-primary mt-4 w-full" type="submit"
            disabled={saving === "subject" || !setup?.classSections.length || !setup?.subjects.length}>
            {saving === "subject" ? "Assigning…" : "Assign subject"}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Your class sections</h2>
            <p className="text-sm text-slate-500">Live view of what you have set up for this session.</p>
          </div>
          <button className="button-secondary text-sm" type="button" onClick={() => setTeacherModalOpen(true)}>
            Teachers ({teachers.length})
          </button>
        </div>
        {!setup?.classSections.length ? (
          <div className="card mt-4 p-8 text-center">
            <p className="font-medium text-slate-700">No class sections yet</p>
            <p className="mt-1 text-sm text-slate-500">Complete Steps 1–3 to see them listed here.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {setup.classSections.map((item) => (
              <article className="card p-5" key={item.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{item.academicClass.name} · {item.section.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Class teacher: {item.classTeacher
                        ? `${item.classTeacher.firstName} ${item.classTeacher.lastName}`
                        : "Not assigned"}
                    </p>
                  </div>
                  <span className="badge">{item._count.enrollments} students</span>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subjects</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.subjects.length ? item.subjects.map(({ id, subject, teacher }) => (
                      <span className="badge" key={id}>
                        {subject.name}{teacher ? ` · ${teacher.firstName}` : ""}
                      </span>
                    )) : (
                      <span className="text-sm text-amber-700">No subjects yet — assign in Step 4</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {teacherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Add teacher</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Creates a staff login. Teachers can then be picked in class and subject dropdowns.
                </p>
              </div>
              <button className="text-slate-400 hover:text-slate-600" type="button"
                onClick={() => setTeacherModalOpen(false)} aria-label="Close">✕</button>
            </div>

            {teachers.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current teachers ({teachers.length})
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {teachers.map((teacher) => (
                    <li className="badge" key={teacher.id}>{teacher.firstName} {teacher.lastName}</li>
                  ))}
                </ul>
              </div>
            )}

            <form className="mt-5 grid gap-4" onSubmit={addTeacher}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="label">First name</span>
                  <input className="input mt-1" required placeholder="Anita"
                    value={teacherForm.firstName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })} />
                </label>
                <label className="text-sm">
                  <span className="label">Last name</span>
                  <input className="input mt-1" required placeholder="Sharma"
                    value={teacherForm.lastName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })} />
                </label>
              </div>
              <label className="text-sm">
                <span className="label">Email (used to log in)</span>
                <input className="input mt-1" type="email" required placeholder="teacher@school.local"
                  value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} />
              </label>
              <label className="text-sm">
                <span className="label">Temporary password</span>
                <input className="input mt-1" type="password" minLength={8} required
                  value={teacherForm.password} onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })} />
              </label>
              <div className="flex justify-end gap-2">
                <button className="button-secondary" type="button" onClick={() => setTeacherModalOpen(false)}>Cancel</button>
                <button className="button-primary" type="submit" disabled={saving === "teacher"}>
                  {saving === "teacher" ? "Saving…" : "Create teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function StepHeader({ number, title, done }: { number: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${done
        ? "bg-emerald-100 text-emerald-800"
        : "bg-violet-100 text-violet-800"}`}>
        {done ? "✓" : number}
      </span>
      <h2 className="font-semibold">{title}</h2>
      {done && <span className="badge-success text-xs">Done</span>}
    </div>
  );
}

function StepBadge({ done, active, label, desc }: { done: boolean; active: boolean; label: string; desc: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${done
      ? "border-emerald-200 bg-emerald-50"
      : active
        ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
        : "border-slate-200 bg-white"}`}>
      <p className={`text-sm font-medium ${done ? "text-emerald-800" : active ? "text-violet-900" : "text-slate-700"}`}>
        {done ? "✓ " : active ? "→ " : ""}{label}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
    </div>
  );
}

function GuideItem({ step, title, example, children }: {
  step: number; title: string; example: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-800">{step}. {title}</p>
      <p className="mt-1 text-slate-600">{children}</p>
      <p className="mt-1 text-xs text-violet-700">Example: {example}</p>
    </div>
  );
}

function HintBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {children}
    </p>
  );
}

function CountDot({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="ml-1 text-xs text-emerald-600">({count})</span>;
}

function SetupOverview({ setup }: { setup: Setup | null }) {
  if (!setup) return null;
  const items = [
    { label: "Classes", count: setup.classes.length, ok: setup.classes.length > 0 },
    { label: "Sections", count: setup.sections.length, ok: setup.sections.length > 0 },
    { label: "Subjects", count: setup.subjects.length, ok: setup.subjects.length > 0 },
    { label: "Teachers", count: setup.teachers.length, ok: setup.teachers.length > 0 },
    { label: "Class sections", count: setup.classSections.length, ok: setup.classSections.length > 0 },
  ];
  const ready = items.filter((item) => item.ok).length;

  return (
    <section className="mt-6 card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Setup progress</p>
          <p className="text-xs text-slate-500">{ready} of {items.length} areas configured</p>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100 sm:w-48">
          <div className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${(ready / items.length) * 100}%` }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.label} className={item.ok ? "badge-success" : "badge"}>
            {item.label}: {item.count}
          </span>
        ))}
      </div>
    </section>
  );
}

function MasterChecklist({ setup }: { setup: Setup | null }) {
  if (!setup) return null;
  const rows = [
    { label: "Classes", items: setup.classes, example: "Class 6, Class 7" },
    { label: "Sections", items: setup.sections, example: "A, B" },
    { label: "Subjects", items: setup.subjects, example: "Math, English" },
  ];
  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">What you have added</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-2 text-sm">
          <span className={row.items.length ? "text-emerald-700" : "text-slate-500"}>
            {row.items.length ? "✓" : "○"} {row.label}
          </span>
          <span className="text-right text-slate-600">
            {row.items.length
              ? row.items.map((item) => item.name).join(", ")
              : `e.g. ${row.example}`}
          </span>
        </div>
      ))}
    </div>
  );
}
