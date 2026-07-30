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
import { notifyError, notifySuccess } from "../../lib/notify";
import type { StudentListItem } from "./students/types";

interface Item {
  id: string;
  name: string;
  code?: string | null;
  type?: "CORE" | "ELECTIVE";
  electiveCategoryId?: string | null;
  electiveCategory?: { id: string; name: string; maxSelect: number } | null;
}
interface Person { id: string; firstName: string; lastName: string }
interface ClassSection {
  id: string;
  academicClass: Item;
  section: Item;
  classTeacher: Person | null;
  subjects: Array<{ id: string; subject: Item; teacher: Person | null }>;
  _count: { enrollments: number };
}
interface ElectiveCategory {
  id: string;
  name: string;
  description: string | null;
  classId: string | null;
  maxSelect: number;
  academicClass: { id: string; name: string } | null;
  _count: { subjects: number };
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
  electiveCategories: ElectiveCategory[];
}

type MasterType = "classes" | "sections" | "subjects";
type MainTab = "masters" | "sections" | "subjects" | "electives" | "bulk-section" | "promote";

type ElectiveBoard = {
  classSection: { id: string; academicClass: Item; section: Item };
  electiveSubjects: Item[];
  students: Array<{
    enrollmentId: string;
    student: { id: string; firstName: string; lastName: string | null; admissionNumber: string };
    selectedSubjectIds: string[];
  }>;
};

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

type PromoteResult = "PASS" | "FAIL";
type PromoteAction = "CONTINUE" | "LEAVE";

type PromoteRow = {
  studentEnrollmentId: string;
  studentName: string;
  result: PromoteResult;
  action: PromoteAction;
};

type BulkSectionRow = {
  studentEnrollmentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  selected: boolean;
};

export function AcademicsPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("masters");
  const [masterType, setMasterType] = useState<MasterType>("classes");
  const [master, setMaster] = useState({ name: "", code: "", type: "CORE" as "CORE" | "ELECTIVE", electiveCategoryId: "" });
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

  // Promote students workflow (pass/fail + continue/leave).
  const [promoteFromClassSectionId, setPromoteFromClassSectionId] = useState("");
  const [promoteSessionId, setPromoteSessionId] = useState("");
  const [promotePassClassId, setPromotePassClassId] = useState("");
  const [promotePassSectionId, setPromotePassSectionId] = useState("");
  const [promoteRows, setPromoteRows] = useState<PromoteRow[]>([]);
  const [promoteLoading, setPromoteLoading] = useState(false);

  // Bulk section update (same session, same class, different section).
  const [bulkFromClassSectionId, setBulkFromClassSectionId] = useState("");
  const [bulkToClassSectionId, setBulkToClassSectionId] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkSectionRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Electives workflow
  const [electiveCategoryForm, setElectiveCategoryForm] = useState({
    name: "",
    description: "",
    classId: "",
    maxSelect: 1,
  });
  const [electiveSubjectForm, setElectiveSubjectForm] = useState({
    name: "",
    code: "",
    electiveCategoryId: "",
  });
  const [electiveClassSectionId, setElectiveClassSectionId] = useState("");
  const [electiveBoard, setElectiveBoard] = useState<ElectiveBoard | null>(null);
  const [electiveSelections, setElectiveSelections] = useState<Record<string, string[]>>({});
  const [electiveLoading, setElectiveLoading] = useState(false);

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
      notifyError(cause instanceof Error ? cause.message : "Unable to load academics");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function loadPromoteStudents() {
    if (!setup) return;
    if (!promoteFromClassSectionId) {
      notifyError("Select the source class section first.");
      return;
    }
    setPromoteLoading(true);
    try {
      const limit = 100;
      const allItems: StudentListItem[] = [];
      let page = 1;
      for (;;) {
        const data = await apiRequest<{ items: StudentListItem[]; total: number; page: number; limit: number }>(
          `/students?status=ACTIVE&classSectionId=${encodeURIComponent(promoteFromClassSectionId)}&page=${page}&limit=${limit}`,
          accessToken,
        );
        allItems.push(...(data.items ?? []));
        if (!data.items?.length || data.items.length < limit || allItems.length >= (data.total ?? 0)) {
          break;
        }
        page += 1;
      }

      const sessionId = setup.currentSession?.id ?? "";
      const rows: PromoteRow[] = allItems
        .map((student) => {
          const enrollment = student.enrollments.find(
            (e) => e.classSection.id === promoteFromClassSectionId && (!sessionId || e.academicSession.id === sessionId),
          );
          if (!enrollment) return null;
          return {
            studentEnrollmentId: enrollment.id,
            studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
            result: "PASS",
            action: "CONTINUE",
          } satisfies PromoteRow;
        })
        .filter(Boolean) as PromoteRow[];

      setPromoteRows(rows);
      notifySuccess(`Found ${rows.length} students to promote.`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load students for promotion");
    } finally {
      setPromoteLoading(false);
    }
  }

  async function submitPromote() {
    if (!setup) return;
    if (!promoteFromClassSectionId) {
      notifyError("Select source class section.");
      return;
    }
    if (!promoteSessionId) {
      notifyError("Select promote in session.");
      return;
    }
    if (!promotePassClassId || !promotePassSectionId) {
      notifyError("Select target class and section for pass/continue students.");
      return;
    }
    if (!promoteRows.length) {
      notifyError("Nothing to promote. Load students first.");
      return;
    }

    const source = setup.classSections.find((cs) => cs.id === promoteFromClassSectionId);
    try {
      const promoteSetup = await apiRequest<Setup>(
        `/academics/setup?sessionId=${encodeURIComponent(promoteSessionId)}`,
        accessToken,
      );
      const passExists = promoteSetup.classSections.some(
        (cs) => cs.academicClass.id === promotePassClassId && cs.section.id === promotePassSectionId,
      );
      if (!passExists) {
        notifyError(
          "Pass target class/section does not exist in the promote session. Create that class section first.",
        );
        return;
      }
      if (source) {
        const failExists = promoteSetup.classSections.some(
          (cs) =>
            cs.academicClass.id === source.academicClass.id && cs.section.id === source.section.id,
        );
        const needsFailTarget = promoteRows.some((row) => row.result === "FAIL" && row.action === "CONTINUE");
        if (needsFailTarget && !failExists) {
          notifyError(
            `Fail + Continue needs ${source.academicClass.name} · ${source.section.name} in the promote session. Create it first, or mark Fail students as Leave.`,
          );
          return;
        }
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to validate promote session");
      return;
    }

    setSaving("promote");
    try {
      await apiRequest("/academics/promote", accessToken, {
        method: "POST",
        body: JSON.stringify({
          fromClassSectionId: promoteFromClassSectionId,
          promoteSessionId,
          passContinueClassId: promotePassClassId,
          passContinueSectionId: promotePassSectionId,
          items: promoteRows.map((row) => ({
            studentEnrollmentId: row.studentEnrollmentId,
            result: row.result,
            action: row.action,
          })),
        }),
      });
      notifySuccess("Students promoted successfully.");
      // Refresh academic setup + reset workflow.
      await load();
      setPromoteRows([]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to promote students");
    } finally {
      setSaving("");
    }
  }

  const bulkTargetOptions = useMemo(() => {
    if (!setup || !bulkFromClassSectionId) return [];
    const source = setup.classSections.find((cs) => cs.id === bulkFromClassSectionId);
    if (!source) return [];
    return setup.classSections.filter(
      (cs) => cs.id !== source.id && cs.academicClass.id === source.academicClass.id,
    );
  }, [setup, bulkFromClassSectionId]);

  async function loadBulkSectionStudents() {
    if (!setup) return;
    if (!bulkFromClassSectionId) {
      notifyError("Select the source class section first.");
      return;
    }
    setBulkLoading(true);
    try {
      const limit = 100;
      const allItems: StudentListItem[] = [];
      let page = 1;
      for (;;) {
        const data = await apiRequest<{ items: StudentListItem[]; total: number; page: number; limit: number }>(
          `/students?status=ACTIVE&classSectionId=${encodeURIComponent(bulkFromClassSectionId)}&page=${page}&limit=${limit}`,
          accessToken,
        );
        allItems.push(...(data.items ?? []));
        if (!data.items?.length || data.items.length < limit || allItems.length >= (data.total ?? 0)) {
          break;
        }
        page += 1;
      }

      const sessionId = setup.currentSession?.id ?? "";
      const rows: BulkSectionRow[] = allItems
        .map((student) => {
          const enrollment = student.enrollments.find(
            (e) => e.classSection.id === bulkFromClassSectionId && (!sessionId || e.academicSession.id === sessionId),
          );
          if (!enrollment) return null;
          return {
            studentEnrollmentId: enrollment.id,
            studentName: `${student.firstName} ${student.lastName ?? ""}`.trim(),
            admissionNumber: student.admissionNumber,
            rollNumber: enrollment.rollNumber ?? "",
            selected: true,
          } satisfies BulkSectionRow;
        })
        .filter(Boolean) as BulkSectionRow[];

      setBulkRows(rows);
      notifySuccess(`Found ${rows.length} students.`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load students");
    } finally {
      setBulkLoading(false);
    }
  }

  async function submitBulkSection() {
    if (!bulkFromClassSectionId) {
      notifyError("Select source class section.");
      return;
    }
    if (!bulkToClassSectionId) {
      notifyError("Select target class section.");
      return;
    }
    if (bulkFromClassSectionId === bulkToClassSectionId) {
      notifyError("Source and target sections must be different.");
      return;
    }
    const selected = bulkRows.filter((row) => row.selected);
    if (!selected.length) {
      notifyError("Select at least one student to move.");
      return;
    }
    setSaving("bulk-section");
    try {
      const result = await apiRequest<{ moved: number; toLabel: string }>("/academics/bulk-section", accessToken, {
        method: "POST",
        body: JSON.stringify({
          fromClassSectionId: bulkFromClassSectionId,
          toClassSectionId: bulkToClassSectionId,
          items: selected.map((row) => ({
            studentEnrollmentId: row.studentEnrollmentId,
            rollNumber: row.rollNumber.trim() || null,
          })),
        }),
      });
      notifySuccess(`Moved ${result.moved} student(s) to ${result.toLabel}.`);
      await load();
      setBulkRows([]);
      setBulkToClassSectionId("");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update sections");
    } finally {
      setSaving("");
    }
  }

  async function addElectiveCategory(event: FormEvent) {
    event.preventDefault();
    setSaving("elective-category");
    try {
      await apiRequest("/academics/elective-categories", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: electiveCategoryForm.name.trim(),
          description: electiveCategoryForm.description.trim() || null,
          classId: electiveCategoryForm.classId || null,
          maxSelect: Number(electiveCategoryForm.maxSelect) || 1,
        }),
      });
      setElectiveCategoryForm({ name: "", description: "", classId: "", maxSelect: 1 });
      notifySuccess("Elective category created.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create elective category");
    } finally {
      setSaving("");
    }
  }

  async function deleteElectiveCategory(id: string) {
    const ok = await confirmDelete({
      title: "Delete elective category?",
      text: "Subjects linked to this category will keep their type but lose the category link.",
      confirmText: "Delete",
    });
    if (!ok) return;
    setSaving(`elective-category-delete-${id}`);
    try {
      await apiRequest(`/academics/elective-categories/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Elective category deleted.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete elective category");
    } finally {
      setSaving("");
    }
  }

  async function addElectiveSubject(event: FormEvent) {
    event.preventDefault();
    setSaving("elective-subject");
    try {
      await apiRequest("/academics/subjects", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: electiveSubjectForm.name.trim(),
          code: electiveSubjectForm.code.trim() || null,
          type: "ELECTIVE",
          electiveCategoryId: electiveSubjectForm.electiveCategoryId || null,
        }),
      });
      setElectiveSubjectForm({ name: "", code: "", electiveCategoryId: "" });
      notifySuccess("Elective subject created.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create elective subject");
    } finally {
      setSaving("");
    }
  }

  async function loadElectiveBoard() {
    if (!electiveClassSectionId) {
      notifyError("Select a class section first.");
      return;
    }
    setElectiveLoading(true);
    try {
      const data = await apiRequest<ElectiveBoard>(
        `/academics/electives/board?classSectionId=${encodeURIComponent(electiveClassSectionId)}`,
        accessToken,
      );
      setElectiveBoard(data);
      const next: Record<string, string[]> = {};
      for (const row of data.students) next[row.enrollmentId] = [...row.selectedSubjectIds];
      setElectiveSelections(next);
      notifySuccess(`Loaded ${data.students.length} students for elective assignment.`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load elective board");
    } finally {
      setElectiveLoading(false);
    }
  }

  function toggleElectiveSelection(enrollmentId: string, subjectId: string) {
    setElectiveSelections((prev) => {
      const current = prev[enrollmentId] ?? [];
      const exists = current.includes(subjectId);
      return {
        ...prev,
        [enrollmentId]: exists ? current.filter((id) => id !== subjectId) : [...current, subjectId],
      };
    });
  }

  async function saveElectiveAssignments() {
    if (!electiveClassSectionId || !electiveBoard) {
      notifyError("Load elective board first.");
      return;
    }
    setSaving("elective-assign");
    try {
      await apiRequest("/academics/electives/assignments", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          classSectionId: electiveClassSectionId,
          items: electiveBoard.students.map((row) => ({
            studentEnrollmentId: row.enrollmentId,
            subjectIds: electiveSelections[row.enrollmentId] ?? [],
          })),
        }),
      });
      notifySuccess("Elective subjects saved for students.");
      await loadElectiveBoard();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save elective assignments");
    } finally {
      setSaving("");
    }
  }

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

  async function addSession(event: FormEvent) {
    event.preventDefault();
    setSaving("session");
    try {
      await apiRequest("/academic-sessions", accessToken, {
        method: "POST",
        body: JSON.stringify({ ...sessionForm, isCurrent: true }),
      });
      notifySuccess("Academic session created.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create session");
    } finally {
      setSaving("");
    }
  }

  async function activateSession(event: FormEvent) {
    event.preventDefault();
    if (!activateSessionId) return;
    setSaving("session");
    try {
      await apiRequest(`/academic-sessions/${activateSessionId}/current`, accessToken, {
        method: "PUT",
      });
      notifySuccess("Current session updated.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to set current session");
    } finally {
      setSaving("");
    }
  }

  async function addMaster(event: FormEvent) {
    event.preventDefault();
    setSaving("master");
    try {
      await apiRequest(`/academics/${masterType}`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: master.name,
          ...(masterType !== "sections" ? { code: master.code || null } : {}),
          ...(masterType === "subjects"
            ? {
                type: master.type,
                electiveCategoryId:
                  master.type === "ELECTIVE" ? master.electiveCategoryId || null : null,
              }
            : {}),
        }),
      });
      setMaster({ name: "", code: "", type: "CORE", electiveCategoryId: "" });
      notifySuccess(`${MASTER_HELP[masterType].title} "${master.name.trim()}" added.`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add record");
    } finally {
      setSaving("");
    }
  }

  async function addTeacher(event: FormEvent) {
    event.preventDefault();
    if (!setup?.teacherRoleId) {
      notifyError("Teacher role is not available. Refresh the page and try again.");
      return;
    }
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
      notifySuccess(`Teacher ${created.firstName} ${created.lastName} added.`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add teacher");
    } finally {
      setSaving("");
    }
  }

  async function addGroup(event: FormEvent) {
    event.preventDefault();
    if (!setup?.currentSession) {
      notifyError("Create or activate an academic session first.");
      return;
    }
    if (!group.classId || !group.sectionId) {
      notifyError("Select both a class and a section.");
      return;
    }
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
      notifySuccess("Class section saved.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create class section");
    } finally {
      setSaving("");
    }
  }

  async function addSubject(event: FormEvent) {
    event.preventDefault();
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
      notifySuccess("Subject assigned.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign subject");
    } finally {
      setSaving("");
    }
  }

  async function updateMaster(type: MasterType, id: string, data: { name: string; code?: string | null }) {
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
      notifySuccess(`${MASTER_HELP[type].title} updated.`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update record");
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
    setSaving("master-delete");
    try {
      await apiRequest(`/academics/${type}/${id}`, accessToken, { method: "DELETE" });
      notifySuccess(`${MASTER_HELP[type].title} deleted.`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete record");
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
    setSaving(`teacher-${classSectionId}`);
    try {
      await apiRequest(`/academics/class-sections/${classSectionId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ classTeacherId: classTeacherId || null }),
      });
      notifySuccess("Class teacher updated.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update class teacher");
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
      notifySuccess("Class section deleted.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete class section");
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
    setSaving(`subject-${id}`);
    try {
      await apiRequest(`/academics/subject-assignments/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Subject assignment removed.");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to remove subject assignment");
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
          <button
            type="button"
            className={tabClass(mainTab === "electives")}
            onClick={() => setMainTab("electives")}
          >
            Electives
          </button>
          <button
            type="button"
            className={tabClass(mainTab === "bulk-section")}
            onClick={() => setMainTab("bulk-section")}
          >
            Bulk section
          </button>
          <button
            type="button"
            className={tabClass(mainTab === "promote")}
            onClick={() => setMainTab("promote")}
          >
            Promote students
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
                      setMaster({ name: "", code: "", type: "CORE", electiveCategoryId: "" });
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
              {masterType === "subjects" ? (
                <>
                  <label className="mt-3 block">
                    <span className="nx-label">Subject type</span>
                    <select
                      className="nx-input"
                      value={master.type}
                      onChange={(e) =>
                        setMaster({
                          ...master,
                          type: e.target.value as "CORE" | "ELECTIVE",
                          electiveCategoryId: e.target.value === "CORE" ? "" : master.electiveCategoryId,
                        })
                      }
                    >
                      <option value="CORE">Core</option>
                      <option value="ELECTIVE">Elective</option>
                    </select>
                  </label>
                  {master.type === "ELECTIVE" ? (
                    <label className="mt-3 block">
                      <span className="nx-label">Elective category (optional)</span>
                      <select
                        className="nx-input"
                        value={master.electiveCategoryId}
                        onChange={(e) => setMaster({ ...master, electiveCategoryId: e.target.value })}
                      >
                        <option value="">No category</option>
                        {(setup?.electiveCategories ?? []).map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
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
                    {masterType === "subjects" ? <th>Type</th> : null}
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
                      {masterType === "subjects" ? (
                        <td>
                          <span className={`nx-pill ${item.type === "ELECTIVE" ? "nx-pill-indigo" : "nx-pill-neutral"}`}>
                            {item.type === "ELECTIVE" ? "Elective" : "Core"}
                          </span>
                        </td>
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
                      <td
                        colSpan={masterType === "sections" ? 2 : masterType === "subjects" ? 4 : 3}
                        className="px-5 py-10 text-center text-slate-500"
                      >
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

        {mainTab === "electives" ? (
          <div className="p-5 space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <form className="rounded-xl border border-slate-200 bg-white p-4" onSubmit={addElectiveCategory}>
                <h3 className="text-[15px] font-bold text-slate-900">Elective category</h3>
                <p className="mt-1 text-[13px] text-slate-500">
                  Example: Optional Group 1 / Optional Group 2 for Class 11 Science.
                </p>
                <label className="mt-4 block">
                  <span className="nx-label">Category name</span>
                  <input
                    className="nx-input"
                    required
                    value={electiveCategoryForm.name}
                    onChange={(e) => setElectiveCategoryForm({ ...electiveCategoryForm, name: e.target.value })}
                    placeholder="Optional Group 1"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="nx-label">Class (optional)</span>
                  <select
                    className="nx-input"
                    value={electiveCategoryForm.classId}
                    onChange={(e) => setElectiveCategoryForm({ ...electiveCategoryForm, classId: e.target.value })}
                  >
                    <option value="">All classes</option>
                    {(setup?.classes ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block">
                  <span className="nx-label">Max subjects a student can pick</span>
                  <input
                    className="nx-input"
                    type="number"
                    min={1}
                    max={10}
                    value={electiveCategoryForm.maxSelect}
                    onChange={(e) =>
                      setElectiveCategoryForm({
                        ...electiveCategoryForm,
                        maxSelect: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <label className="mt-3 block">
                  <span className="nx-label">Description</span>
                  <textarea
                    className="nx-input min-h-20"
                    value={electiveCategoryForm.description}
                    onChange={(e) =>
                      setElectiveCategoryForm({ ...electiveCategoryForm, description: e.target.value })
                    }
                  />
                </label>
                <button className="nx-btn-primary mt-4" type="submit" disabled={saving === "elective-category"}>
                  {saving === "elective-category" ? "Saving…" : "Add category"}
                </button>
              </form>

              <form className="rounded-xl border border-slate-200 bg-white p-4" onSubmit={addElectiveSubject}>
                <h3 className="text-[15px] font-bold text-slate-900">Add elective subject</h3>
                <p className="mt-1 text-[13px] text-slate-500">
                  Creates a subject with type Elective. Assign it to a class section from Subject assignment tab.
                </p>
                <label className="mt-4 block">
                  <span className="nx-label">Subject name</span>
                  <input
                    className="nx-input"
                    required
                    value={electiveSubjectForm.name}
                    onChange={(e) => setElectiveSubjectForm({ ...electiveSubjectForm, name: e.target.value })}
                    placeholder="Computer Science"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="nx-label">Code (optional)</span>
                  <input
                    className="nx-input"
                    value={electiveSubjectForm.code}
                    onChange={(e) => setElectiveSubjectForm({ ...electiveSubjectForm, code: e.target.value })}
                    placeholder="CS"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="nx-label">Category</span>
                  <select
                    className="nx-input"
                    value={electiveSubjectForm.electiveCategoryId}
                    onChange={(e) =>
                      setElectiveSubjectForm({ ...electiveSubjectForm, electiveCategoryId: e.target.value })
                    }
                  >
                    <option value="">No category</option>
                    {(setup?.electiveCategories ?? []).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <button className="nx-btn-primary mt-4" type="submit" disabled={saving === "elective-subject"}>
                  {saving === "elective-subject" ? "Saving…" : "Add elective subject"}
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[15px] font-bold text-slate-900">Categories</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {(setup?.electiveCategories ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[13px] text-slate-500">
                        Max {item.maxSelect} · {item.academicClass?.name ?? "All classes"} · {item._count.subjects} subjects
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      disabled={saving.startsWith("elective-category-delete")}
                      onClick={() => void deleteElectiveCategory(item.id)}
                    >
                      <DeleteOutline sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                ))}
                {!setup?.electiveCategories?.length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">No elective categories yet.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-[15px] font-bold text-slate-900">Assign electives to students</h3>
              <p className="mt-1 text-[13px] text-slate-500">
                First assign elective subjects to the class section (Subject assignment tab), then select which
                electives each student opted for.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-[240px] flex-1">
                  <span className="nx-label">Class section</span>
                  <select
                    className="nx-input"
                    value={electiveClassSectionId}
                    onChange={(e) => {
                      setElectiveClassSectionId(e.target.value);
                      setElectiveBoard(null);
                    }}
                  >
                    <option value="">Select class section</option>
                    {(setup?.classSections ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.academicClass.name} · {item.section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="nx-btn-secondary"
                  disabled={electiveLoading || !electiveClassSectionId}
                  onClick={() => void loadElectiveBoard()}
                >
                  {electiveLoading ? "Loading…" : "Load students"}
                </button>
              </div>

              {electiveBoard ? (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  {!electiveBoard.electiveSubjects.length ? (
                    <p className="px-4 py-8 text-center text-sm text-amber-700 bg-amber-50">
                      No elective subjects are assigned to this class section yet. Create elective subjects, then
                      assign them under Subject assignment.
                    </p>
                  ) : (
                    <>
                      <table className="nx-table min-w-[760px]">
                        <thead>
                          <tr>
                            <th>Student</th>
                            {electiveBoard.electiveSubjects.map((subject) => (
                              <th key={subject.id} className="text-center">
                                <div>{subject.name}</div>
                                <div className="text-[11px] font-medium normal-case text-slate-400">
                                  {subject.electiveCategory?.name ?? "Uncategorized"}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {electiveBoard.students.map((row) => (
                            <tr key={row.enrollmentId}>
                              <td className="font-semibold text-slate-900">
                                {row.student.firstName} {row.student.lastName ?? ""}
                                <div className="text-[12px] font-normal text-slate-400">
                                  {row.student.admissionNumber}
                                </div>
                              </td>
                              {electiveBoard.electiveSubjects.map((subject) => {
                                const checked = (electiveSelections[row.enrollmentId] ?? []).includes(subject.id);
                                return (
                                  <td key={subject.id} className="text-center">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleElectiveSelection(row.enrollmentId, subject.id)}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {!electiveBoard.students.length ? (
                            <tr>
                              <td
                                colSpan={Math.max(1, electiveBoard.electiveSubjects.length + 1)}
                                className="px-5 py-10 text-center text-slate-500"
                              >
                                No active students in this class section.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                      <div className="flex justify-end border-t border-slate-100 p-4">
                        <button
                          type="button"
                          className="nx-btn-primary"
                          disabled={saving === "elective-assign" || !electiveBoard.students.length}
                          onClick={() => void saveElectiveAssignments()}
                        >
                          {saving === "elective-assign" ? "Saving…" : "Save elective choices"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {mainTab === "bulk-section" ? (
          <div className="p-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-[16px] font-bold text-slate-900">Bulk section update</h3>
              <p className="mt-1 text-sm text-slate-500">
                Move selected students from one section to another within the same class and current session.
                For next-session class changes, use Promote students.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
                <label>
                  <span className="nx-label">From class section</span>
                  <select
                    className="nx-input"
                    value={bulkFromClassSectionId}
                    onChange={(e) => {
                      setBulkFromClassSectionId(e.target.value);
                      setBulkToClassSectionId("");
                      setBulkRows([]);
                    }}
                  >
                    <option value="">Select source</option>
                    {(setup?.classSections ?? []).map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.academicClass.name} · {cs.section.name} ({cs._count.enrollments})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="nx-label">To class section</span>
                  <select
                    className="nx-input"
                    value={bulkToClassSectionId}
                    onChange={(e) => setBulkToClassSectionId(e.target.value)}
                    disabled={!bulkFromClassSectionId}
                  >
                    <option value="">Select target</option>
                    {bulkTargetOptions.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.academicClass.name} · {cs.section.name} ({cs._count.enrollments})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="nx-btn-secondary"
                    disabled={bulkLoading || saving === "bulk-section"}
                    onClick={() => void loadBulkSectionStudents()}
                  >
                    {bulkLoading ? "Loading…" : "Load students"}
                  </button>
                  <span className="nx-pill nx-pill-neutral">
                    {bulkRows.length
                      ? `${bulkRows.filter((r) => r.selected).length}/${bulkRows.length} selected`
                      : "Same class only"}
                  </span>
                </div>
              </div>

              {!bulkFromClassSectionId || bulkTargetOptions.length ? null : (
                <p className="mt-3 text-sm text-amber-700">
                  No other section exists for this class. Create another class section first (Sections tab).
                </p>
              )}

              {!bulkRows.length ? null : (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={bulkRows.length > 0 && bulkRows.every((r) => r.selected)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setBulkRows((prev) => prev.map((row) => ({ ...row, selected: checked })));
                        }}
                      />
                      Select all
                    </label>
                  </div>
                  <table className="nx-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th className="w-[48px]" />
                        <th>Student</th>
                        <th>Admission no.</th>
                        <th className="w-[140px]">Roll no.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr key={row.studentEnrollmentId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setBulkRows((prev) =>
                                  prev.map((p) =>
                                    p.studentEnrollmentId === row.studentEnrollmentId
                                      ? { ...p, selected: checked }
                                      : p,
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="font-semibold text-slate-900">{row.studentName}</td>
                          <td className="text-slate-600">{row.admissionNumber}</td>
                          <td>
                            <input
                              className="nx-input !py-1.5"
                              value={row.rollNumber}
                              onChange={(e) => {
                                const value = e.target.value;
                                setBulkRows((prev) =>
                                  prev.map((p) =>
                                    p.studentEnrollmentId === row.studentEnrollmentId
                                      ? { ...p, rollNumber: value }
                                      : p,
                                  ),
                                );
                              }}
                              placeholder="Optional"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex justify-end">
                    <button
                      className="nx-btn-primary"
                      type="button"
                      disabled={saving === "bulk-section" || !bulkToClassSectionId}
                      onClick={() => void submitBulkSection()}
                    >
                      {saving === "bulk-section" ? "Moving…" : "Move selected students"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {mainTab === "promote" ? (
          <div className="p-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-[16px] font-bold text-slate-900">Promote students</h3>
              <p className="mt-1 text-sm text-slate-500">
                Select the current class section, mark Pass/Fail and Continue/Leave, then promote to the next session.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-4 md:items-end">
                <label>
                  <span className="nx-label">Source class section</span>
                  <select
                    className="nx-input"
                    value={promoteFromClassSectionId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPromoteFromClassSectionId(v);
                      setPromoteRows([]);
                    }}
                  >
                    <option value="">Select source</option>
                    {(setup?.classSections ?? []).map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.academicClass.name} · {cs.section.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="nx-label">Promote in session</span>
                  <select
                    className="nx-input"
                    value={promoteSessionId}
                    onChange={(e) => {
                      setPromoteSessionId(e.target.value);
                      setPromoteRows([]);
                    }}
                  >
                    <option value="">Select session</option>
                    {(setup?.sessions ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="nx-label">Target class (Pass + Continue)</span>
                  <select className="nx-input" value={promotePassClassId} onChange={(e) => setPromotePassClassId(e.target.value)}>
                    <option value="">Select class</option>
                    {(setup?.classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="nx-label">Target section (Pass + Continue)</span>
                  <select className="nx-input" value={promotePassSectionId} onChange={(e) => setPromotePassSectionId(e.target.value)}>
                    <option value="">Select section</option>
                    {(setup?.sections ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="nx-btn-secondary"
                  disabled={promoteLoading || saving === "promote"}
                  onClick={() => void loadPromoteStudents()}
                >
                  {promoteLoading ? "Loading…" : "Search students"}
                </button>
                <span className="nx-pill nx-pill-neutral">
                  {promoteRows.length ? `${promoteRows.length} students loaded` : "Mark results per student"}
                </span>
              </div>

              {!promoteRows.length ? null : (
                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <table className="nx-table min-w-[820px]">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th className="w-[160px]">Result</th>
                        <th className="w-[180px]">Next session status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoteRows.map((row) => (
                        <tr key={row.studentEnrollmentId}>
                          <td className="font-semibold text-slate-900">{row.studentName}</td>
                          <td>
                            <select
                              className="nx-input !py-1.5"
                              value={row.result}
                              onChange={(e) => {
                                const v = e.target.value as PromoteResult;
                                setPromoteRows((prev) =>
                                  prev.map((p) => (p.studentEnrollmentId === row.studentEnrollmentId ? { ...p, result: v } : p)),
                                );
                              }}
                            >
                              <option value="PASS">Pass</option>
                              <option value="FAIL">Fail</option>
                            </select>
                          </td>
                          <td>
                            <select
                              className="nx-input !py-1.5"
                              value={row.action}
                              onChange={(e) => {
                                const v = e.target.value as PromoteAction;
                                setPromoteRows((prev) =>
                                  prev.map((p) => (p.studentEnrollmentId === row.studentEnrollmentId ? { ...p, action: v } : p)),
                                );
                              }}
                            >
                              <option value="CONTINUE">Continue</option>
                              <option value="LEAVE">Leave (Alumni)</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex justify-end">
                    <button
                      className="nx-btn-primary"
                      type="button"
                      disabled={saving === "promote"}
                      onClick={() => void submitPromote()}
                    >
                      {saving === "promote" ? "Promoting…" : "Save promotion"}
                    </button>
                  </div>
                </div>
              )}
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
