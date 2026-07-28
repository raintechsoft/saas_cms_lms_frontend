import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DeleteOutline,
  EditOutlined,
  GroupsOutlined,
  MenuBookOutlined,
  PersonAddOutlined,
  SchoolOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";

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
type MainTab = "masters" | "sections" | "subjects";

const defaultSession = {
  name: "2026-2027",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
};

const MASTER_HELP: Record<MasterType, { title: string; hint: string; example: string; code?: string }> = {
  classes: {
    title: "Class",
    hint: "Grade or year level",
    example: "Class 6",
    code: "6",
  },
  sections: {
    title: "Section",
    hint: "Division within a class",
    example: "A",
  },
  subjects: {
    title: "Subject",
    hint: "Subject taught in class sections",
    example: "Mathematics",
    code: "MATH",
  },
};

function tabClass(active: boolean) {
  return active
    ? "border-b-2 border-[#6366f1] pb-3 text-[14px] font-semibold text-[#6366f1]"
    : "pb-3 text-[14px] font-medium text-slate-500 hover:text-slate-700";
}

export function AcademicsPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("masters");
  const [masterType, setMasterType] = useState<MasterType>("classes");
  const [master, setMaster] = useState({ name: "", code: "" });
  const [group, setGroup] = useState({ classId: "", sectionId: "", classTeacherId: "" });
  const [assignment, setAssignment] = useState({ classSectionId: "", subjectId: "", teacherId: "" });
  const [sessionForm, setSessionForm] = useState(defaultSession);
  const [activateSessionId, setActivateSessionId] = useState("");
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherDrafts, setTeacherDrafts] = useState<Record<string, string>>({});
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
  const masterHelp = MASTER_HELP[masterType];
  const masterItems = useMemo(() => {
    if (!setup) return [];
    if (masterType === "classes") return setup.classes;
    if (masterType === "sections") return setup.sections;
    return setup.subjects;
  }, [setup, masterType]);

  const selectedClass = setup?.classes.find((item) => item.id === group.classId);
  const selectedSection = setup?.sections.find((item) => item.id === group.sectionId);

  const stats = [
    { label: "Classes", value: setup?.classes.length ?? 0, icon: SchoolOutlined, tint: "#6366f1" },
    { label: "Sections", value: setup?.sections.length ?? 0, icon: GroupsOutlined, tint: "#0ea5e9" },
    { label: "Subjects", value: setup?.subjects.length ?? 0, icon: MenuBookOutlined, tint: "#8b5cf6" },
    { label: "Class sections", value: setup?.classSections.length ?? 0, icon: SchoolOutlined, tint: "#10b981" },
  ];

  function clearFeedback() {
    setError("");
    setMessage("");
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
      setMessage("Academic session created.");
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
      setMessage(`${MASTER_HELP[masterType].title} "${master.name.trim()}" added.`);
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
      setError("Create or activate an academic session first.");
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
      setMessage("Class section saved.");
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
      setMessage("Subject assigned.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign subject");
    } finally {
      setSaving("");
    }
  }

  async function updateMaster(type: MasterType, id: string, data: { name: string; code?: string | null }) {
    clearFeedback();
    setSaving("master-update");
    try {
      await apiRequest(`/academics/${type}/${id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify(
          type === "sections"
            ? { name: data.name }
            : { name: data.name, code: data.code ?? null },
        ),
      });
      setMessage(`${MASTER_HELP[type].title} updated.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update record");
    } finally {
      setSaving("");
    }
  }

  async function deleteMaster(type: MasterType, id: string) {
    const label = MASTER_HELP[type].title.toLowerCase();
    const item = (type === "classes" ? setup?.classes : type === "sections" ? setup?.sections : setup?.subjects)
      ?.find((entry) => entry.id === id);
    const ok = await confirmDelete({
      title: `Delete ${label}?`,
      text: item
        ? `"${item.name}" will be deleted if it is not in use.`
        : `This ${label} will be deleted if it is not in use.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    clearFeedback();
    setSaving("master-delete");
    try {
      await apiRequest(`/academics/${type}/${id}`, accessToken, { method: "DELETE" });
      setMessage(`${MASTER_HELP[type].title} deleted.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete record");
    } finally {
      setSaving("");
    }
  }

  function promptEditMaster(type: MasterType, item: Item) {
    const name = window.prompt(`New ${MASTER_HELP[type].title.toLowerCase()} name`, item.name);
    if (name == null || !name.trim()) return;
    if (type === "sections") {
      void updateMaster(type, item.id, { name: name.trim() });
      return;
    }
    const code = window.prompt("Short code (optional)", item.code ?? "");
    if (code == null) return;
    void updateMaster(type, item.id, { name: name.trim(), code: code.trim() || null });
  }

  async function updateClassTeacher(classSectionId: string, classTeacherId: string) {
    clearFeedback();
    setSaving(`teacher-${classSectionId}`);
    try {
      await apiRequest(`/academics/class-sections/${classSectionId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ classTeacherId: classTeacherId || null }),
      });
      setMessage("Class teacher updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update class teacher");
    } finally {
      setSaving("");
    }
  }

  async function deleteClassSection(id: string) {
    const section = setup?.classSections.find((item) => item.id === id);
    const label = section
      ? `${section.academicClass.name} · ${section.section.name}`
      : "this class section";
    const ok = await confirmDelete({
      title: "Delete class section?",
      text: `${label} will be deleted if it has no enrollments or related records.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    clearFeedback();
    setSaving(`section-delete-${id}`);
    try {
      await apiRequest(`/academics/class-sections/${id}`, accessToken, { method: "DELETE" });
      setTeacherDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (assignment.classSectionId === id) {
        setAssignment((prev) => ({ ...prev, classSectionId: "" }));
      }
      setMessage("Class section deleted.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete class section");
    } finally {
      setSaving("");
    }
  }

  async function removeSubjectAssignment(id: string) {
    const ok = await confirmDelete({
      title: "Remove subject?",
      text: "This subject will be unassigned from the class section.",
      confirmText: "Remove",
    });
    if (!ok) return;
    clearFeedback();
    setSaving(`subject-${id}`);
    try {
      await apiRequest(`/academics/subject-assignments/${id}`, accessToken, { method: "DELETE" });
      setMessage("Subject assignment removed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove subject assignment");
    } finally {
      setSaving("");
    }
  }

  if (loading && !setup) {
    return (
      <main className="page-main">
        <PageHeader eyebrow="Academics" title="Academic structure" description="Loading…" />
        <p className="mt-8 text-sm text-slate-500">Please wait…</p>
      </main>
    );
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Academics"
        title="Academic structure"
        description="Manage sessions, classes, sections, and subject assignments."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {setup?.currentSession ? (
              <span className="nx-pill nx-pill-success">{setup.currentSession.name}</span>
            ) : null}
            <button type="button" className="nx-btn-secondary" onClick={() => setTeacherModalOpen(true)}>
              <PersonAddOutlined sx={{ fontSize: 16 }} />
              Teachers ({teachers.length})
            </button>
          </div>
        }
      />

      {error ? <p className="alert-error mt-5">{error}</p> : null}
      {message ? (
        <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="nx-card flex items-center gap-3 px-4 py-3.5">
              <span
                className="grid size-10 place-items-center rounded-xl"
                style={{ background: `${stat.tint}18`, color: stat.tint }}
              >
                <Icon sx={{ fontSize: 20 }} />
              </span>
              <div>
                <p className="text-[22px] font-bold leading-none text-slate-900">{stat.value}</p>
                <p className="mt-1 text-[12px] font-medium text-slate-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <section className="nx-card mt-5 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold text-slate-900">Academic session</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {hasSession
                  ? "Active school year for class sections and enrollments."
                  : "Create or activate a session before linking class sections."}
              </p>
            </div>
            {hasSession ? (
              <form className="flex flex-wrap items-end gap-2" onSubmit={activateSession}>
                <label className="min-w-[200px]">
                  <span className="nx-label">Switch session</span>
                  <select
                    className="nx-input"
                    value={activateSessionId || setup?.currentSession?.id || ""}
                    onChange={(e) => setActivateSessionId(e.target.value)}
                  >
                    {(setup?.sessions ?? []).map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}{session.isCurrent ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="nx-btn-secondary" type="submit" disabled={saving === "session"}>
                  {saving === "session" ? "Saving…" : "Set current"}
                </button>
              </form>
            ) : null}
          </div>

          {!hasSession ? (
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_auto]">
              {setup?.sessions.length ? (
                <form className="flex flex-wrap items-end gap-2" onSubmit={activateSession}>
                  <label className="min-w-[220px] flex-1">
                    <span className="nx-label">Existing session</span>
                    <select
                      className="nx-input"
                      value={activateSessionId}
                      onChange={(e) => setActivateSessionId(e.target.value)}
                    >
                      {setup.sessions.map((session) => (
                        <option key={session.id} value={session.id}>{session.name}</option>
                      ))}
                    </select>
                  </label>
                  <button className="nx-btn-primary" type="submit" disabled={saving === "session"}>
                    Activate
                  </button>
                </form>
              ) : null}
              <form className="grid gap-3 sm:grid-cols-4 sm:items-end" onSubmit={addSession}>
                <label>
                  <span className="nx-label">Session name</span>
                  <input
                    className="nx-input"
                    required
                    value={sessionForm.name}
                    onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  />
                </label>
                <label>
                  <span className="nx-label">Start</span>
                  <input
                    className="nx-input"
                    required
                    type="date"
                    value={sessionForm.startDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, startDate: e.target.value })}
                  />
                </label>
                <label>
                  <span className="nx-label">End</span>
                  <input
                    className="nx-input"
                    required
                    type="date"
                    value={sessionForm.endDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, endDate: e.target.value })}
                  />
                </label>
                <button className="nx-btn-primary" type="submit" disabled={saving === "session"}>
                  {saving === "session" ? "Creating…" : "Create session"}
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="flex gap-6 overflow-x-auto border-b border-slate-100 px-5 pt-3">
          <button type="button" className={tabClass(mainTab === "masters")} onClick={() => setMainTab("masters")}>
            Master data
          </button>
          <button type="button" className={tabClass(mainTab === "sections")} onClick={() => setMainTab("sections")}>
            Class sections
          </button>
          <button type="button" className={tabClass(mainTab === "subjects")} onClick={() => setMainTab("subjects")}>
            Subject assignment
          </button>
        </div>

        {mainTab === "masters" ? (
          <div className="grid gap-0 lg:grid-cols-[340px_1fr]">
            <form className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r" onSubmit={addMaster}>
              <h3 className="text-[15px] font-bold text-slate-900">Add {masterHelp.title.toLowerCase()}</h3>
              <p className="mt-1 text-[13px] text-slate-500">{masterHelp.hint}. e.g. {masterHelp.example}</p>

              <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
                {(["classes", "sections", "subjects"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`flex-1 rounded-md px-2 py-2 text-[12px] font-semibold transition ${
                      masterType === type
                        ? "bg-white text-[#6366f1] shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    onClick={() => {
                      setMasterType(type);
                      setMaster({ name: "", code: "" });
                    }}
                  >
                    {MASTER_HELP[type].title}
                  </button>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="nx-label">{masterHelp.title} name</span>
                <input
                  className="nx-input"
                  placeholder={masterHelp.example}
                  required
                  value={master.name}
                  onChange={(e) => setMaster({ ...master, name: e.target.value })}
                />
              </label>
              {masterType !== "sections" ? (
                <label className="mt-3 block">
                  <span className="nx-label">Short code (optional)</span>
                  <input
                    className="nx-input"
                    placeholder={masterHelp.code ?? ""}
                    value={master.code}
                    onChange={(e) => setMaster({ ...master, code: e.target.value })}
                  />
                </label>
              ) : null}
              <button className="nx-btn-primary mt-4 w-full" type="submit" disabled={saving === "master"}>
                {saving === "master" ? "Adding…" : `Add ${masterHelp.title.toLowerCase()}`}
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="nx-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>{masterHelp.title}</th>
                    {masterType !== "sections" ? <th>Code</th> : null}
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masterItems.map((item) => (
                    <tr key={item.id}>
                      <td className="font-semibold text-slate-900">{item.name}</td>
                      {masterType !== "sections" ? (
                        <td className="text-slate-500">{item.code || "—"}</td>
                      ) : null}
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            disabled={saving.startsWith("master-")}
                            onClick={() => promptEditMaster(masterType, item)}
                            aria-label="Edit"
                          >
                            <EditOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            disabled={saving.startsWith("master-")}
                            onClick={() => void deleteMaster(masterType, item.id)}
                            aria-label="Delete"
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!masterItems.length ? (
                    <tr>
                      <td colSpan={masterType === "sections" ? 2 : 3} className="px-5 py-10 text-center text-slate-500">
                        No {masterHelp.title.toLowerCase()}s yet. Add one on the left.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {mainTab === "sections" ? (
          <div className="p-5">
            <form className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" onSubmit={addGroup}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Create class section</h3>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    Link a class and section for the current session.
                  </p>
                </div>
                {selectedClass && selectedSection ? (
                  <span className="nx-pill nx-pill-indigo">
                    Preview: {selectedClass.name} · {selectedSection.name}
                  </span>
                ) : null}
              </div>

              {!hasSession ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Activate an academic session above before creating class sections.
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-4 md:items-end">
                <label>
                  <span className="nx-label">Class</span>
                  <select
                    className="nx-input"
                    required
                    value={group.classId}
                    onChange={(e) => setGroup({ ...group, classId: e.target.value })}
                  >
                    <option value="">Select class</option>
                    {(setup?.classes ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Section</span>
                  <select
                    className="nx-input"
                    required
                    value={group.sectionId}
                    onChange={(e) => setGroup({ ...group, sectionId: e.target.value })}
                  >
                    <option value="">Select section</option>
                    {(setup?.sections ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Class teacher</span>
                  <select
                    className="nx-input"
                    value={group.classTeacherId}
                    onChange={(e) => setGroup({ ...group, classTeacherId: e.target.value })}
                  >
                    <option value="">Optional</option>
                    {teachers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="nx-btn-primary" type="submit" disabled={saving === "section" || !hasSession}>
                  {saving === "section" ? "Saving…" : "Save class section"}
                </button>
              </div>
            </form>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="nx-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Class section</th>
                    <th>Class teacher</th>
                    <th>Subjects</th>
                    <th>Students</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(setup?.classSections ?? []).map((item) => {
                    const teacherValue = teacherDrafts[item.id] ?? item.classTeacher?.id ?? "";
                    const teacherBusy = saving === `teacher-${item.id}`;
                    const deleteBusy = saving === `section-delete-${item.id}`;
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-900">
                          {item.academicClass.name} · {item.section.name}
                        </td>
                        <td>
                          <div className="flex min-w-[220px] items-center gap-2">
                            <select
                              className="nx-input !py-1.5"
                              value={teacherValue}
                              onChange={(e) =>
                                setTeacherDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                            >
                              <option value="">Unassigned</option>
                              {teachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.firstName} {teacher.lastName}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="nx-btn-secondary !px-2.5 !py-1.5 text-[12px]"
                              disabled={teacherBusy}
                              onClick={() => void updateClassTeacher(item.id, teacherValue)}
                            >
                              {teacherBusy ? "…" : "Save"}
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {item.subjects.length ? (
                              item.subjects.map(({ id, subject }) => (
                                <span key={id} className="nx-pill nx-pill-neutral">{subject.name}</span>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400">None</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="nx-pill nx-pill-indigo">{item._count.enrollments}</span>
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              disabled={deleteBusy}
                              onClick={() => void deleteClassSection(item.id)}
                              aria-label="Delete"
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!setup?.classSections.length ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                        No class sections yet. Create one above.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {mainTab === "subjects" ? (
          <div className="p-5">
            <form className="rounded-xl border border-slate-200 bg-slate-50/70 p-4" onSubmit={addSubject}>
              <h3 className="text-[15px] font-bold text-slate-900">Assign subject</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Attach a subject (and optional teacher) to a class section.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-4 md:items-end">
                <label>
                  <span className="nx-label">Class section</span>
                  <select
                    className="nx-input"
                    required
                    value={assignment.classSectionId}
                    onChange={(e) => setAssignment({ ...assignment, classSectionId: e.target.value })}
                  >
                    <option value="">Select class section</option>
                    {(setup?.classSections ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.academicClass.name} · {item.section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Subject</span>
                  <select
                    className="nx-input"
                    required
                    value={assignment.subjectId}
                    onChange={(e) => setAssignment({ ...assignment, subjectId: e.target.value })}
                  >
                    <option value="">Select subject</option>
                    {(setup?.subjects ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Subject teacher</span>
                  <select
                    className="nx-input"
                    value={assignment.teacherId}
                    onChange={(e) => setAssignment({ ...assignment, teacherId: e.target.value })}
                  >
                    <option value="">Optional</option>
                    {teachers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.firstName} {item.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="nx-btn-primary"
                  type="submit"
                  disabled={
                    saving === "subject" ||
                    !setup?.classSections.length ||
                    !setup?.subjects.length
                  }
                >
                  {saving === "subject" ? "Assigning…" : "Assign subject"}
                </button>
              </div>
            </form>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {(setup?.classSections ?? []).map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {item.academicClass.name} · {item.section.name}
                      </h4>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        {item.classTeacher
                          ? `Teacher: ${item.classTeacher.firstName} ${item.classTeacher.lastName}`
                          : "No class teacher"}
                      </p>
                    </div>
                    <span className="nx-pill nx-pill-neutral">{item.subjects.length} subjects</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.subjects.length ? (
                      item.subjects.map(({ id, subject, teacher }) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-700"
                        >
                          <span className="font-medium">{subject.name}</span>
                          {teacher ? (
                            <span className="text-slate-400">· {teacher.firstName}</span>
                          ) : null}
                          <button
                            type="button"
                            className="text-slate-400 hover:text-rose-600"
                            disabled={saving === `subject-${id}`}
                            onClick={() => void removeSubjectAssignment(id)}
                            aria-label="Remove subject"
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">No subjects assigned yet.</p>
                    )}
                  </div>
                </article>
              ))}
              {!setup?.classSections.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-5 py-10 text-center text-slate-500 lg:col-span-2">
                  Create a class section first, then assign subjects here.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {teacherModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">Add teacher</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Creates a staff login for class and subject assignment.
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600"
                type="button"
                onClick={() => setTeacherModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {teachers.length > 0 ? (
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="nx-label">Current teachers ({teachers.length})</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {teachers.map((teacher) => (
                    <span key={teacher.id} className="nx-pill nx-pill-neutral">
                      {teacher.firstName} {teacher.lastName}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <form className="grid gap-3 p-5" onSubmit={addTeacher}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="nx-label">First name</span>
                  <input
                    className="nx-input"
                    required
                    value={teacherForm.firstName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, firstName: e.target.value })}
                  />
                </label>
                <label>
                  <span className="nx-label">Last name</span>
                  <input
                    className="nx-input"
                    required
                    value={teacherForm.lastName}
                    onChange={(e) => setTeacherForm({ ...teacherForm, lastName: e.target.value })}
                  />
                </label>
              </div>
              <label>
                <span className="nx-label">Email</span>
                <input
                  className="nx-input"
                  type="email"
                  required
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Temporary password</span>
                <input
                  className="nx-input"
                  type="password"
                  minLength={8}
                  required
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                />
              </label>
              <div className="mt-1 flex justify-end gap-2">
                <button className="nx-btn-secondary" type="button" onClick={() => setTeacherModalOpen(false)}>
                  Cancel
                </button>
                <button className="nx-btn-primary" type="submit" disabled={saving === "teacher"}>
                  {saving === "teacher" ? "Saving…" : "Create teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
