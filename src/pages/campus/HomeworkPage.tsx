import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  AddOutlined,
  AssessmentOutlined,
  AssignmentTurnedInOutlined,
  AttachFileOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DescriptionOutlined,
  EditOutlined,
  EventBusyOutlined,
  FactCheckOutlined,
  FileDownloadOutlined,
  InfoOutlined,
  MenuBookOutlined,
  MoreVertOutlined,
  SearchOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Named {
  id: string;
  name: string;
}
interface Student {
  firstName: string;
  lastName: string | null;
  admissionNumber: string;
  photoUrl?: string | null;
}
interface ClassSection {
  id: string;
  academicSessionId: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named }>;
  _count?: { enrollments: number };
}
interface Homework {
  id: string;
  title: string;
  description: string;
  /** Present on single-record fetches; the setup list only sends hasAttachment. */
  attachmentUrl?: string | null;
  hasAttachment?: boolean;
  homeworkDate: string;
  submissionDate: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
  teacher: { firstName: string; lastName: string };
  _count: { submissions: number };
  submissions?: Array<{
    id: string;
    status: Submission["status"];
    review: string | null;
    attempt: number;
  }>;
}
interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  classSections: ClassSection[];
  homework: Homework[];
  studentEnrollments: Array<{ id: string; classSectionId: string }>;
}
interface Submission {
  id: string;
  status: "SUBMITTED" | "EVALUATED" | "RESUBMIT_REQUESTED" | "COMPLETED";
  attempt: number;
  answerText: string | null;
  attachmentUrl: string | null;
  review: string | null;
  submittedAt?: string;
}
interface RosterItem {
  id: string;
  rollNumber: string | null;
  student: Student;
  homeworkSubmissions: Submission[];
}
interface HomeworkRoster {
  homework: Homework;
  roster: RosterItem[];
}
interface ReportRow {
  homework: Homework;
  assigned: number;
  submitted: number;
  completed: number;
  resubmitRequested: number;
  due: number;
  progressPercent: number;
}

const today = new Date().toISOString().slice(0, 10);
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const DESCRIPTION_LIMIT = 1000;

const SUBMISSION_LABEL: Record<Submission["status"], string> = {
  SUBMITTED: "Submitted",
  EVALUATED: "Evaluated",
  RESUBMIT_REQUESTED: "Resubmit Requested",
  COMPLETED: "Completed",
};

function sectionLabel(section: ClassSection) {
  return `${section.academicClass.name} / ${section.section.name}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Open / Due Today / Overdue derived from the submission date; Draft/Closed win. */
function statusPill(item: Homework): { label: string; cls: string } {
  if (item.status === "DRAFT") return { label: "Draft", cls: "nx-pill-neutral" };
  if (item.status === "CLOSED") return { label: "Closed", cls: "nx-pill-neutral" };
  const due = item.submissionDate.slice(0, 10);
  if (due < today) return { label: "Overdue", cls: "nx-pill-danger" };
  if (due === today) return { label: "Due Today", cls: "nx-pill-warning" };
  return { label: "Open", cls: "nx-pill-indigo" };
}

function hasAttachment(item: Homework) {
  return item.hasAttachment ?? Boolean(item.attachmentUrl);
}

function openAttachment(item: { attachmentUrl: string | null; title: string }) {
  if (!item.attachmentUrl) return;
  if (item.attachmentUrl.startsWith("data:")) {
    const anchor = document.createElement("a");
    anchor.href = item.attachmentUrl;
    anchor.download = item.title || "homework-attachment";
    anchor.click();
  } else {
    window.open(item.attachmentUrl, "_blank", "noopener");
  }
}

export function HomeworkPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<"list" | "evaluate" | "reports">("list");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluateTarget, setEvaluateTarget] = useState("");
  const [editing, setEditing] = useState<Homework | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const canManage = Boolean(user?.permissions.includes("homework.manage"));
  const canEvaluate = Boolean(user?.permissions.includes("homework.evaluate"));
  const canSubmit = Boolean(user?.permissions.includes("homework.submit"));

  async function load() {
    setLoading(true);
    try {
      setSetup(await apiRequest<Setup>("/homework/setup", accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load homework");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function openAddForm() {
    setEditing(null);
    setFormOpen(true);
    setTab("list");
  }

  async function startEdit(item: Homework) {
    let full = item;
    // The list omits attachment payloads; fetch the complete record for editing.
    if (hasAttachment(item) && !item.attachmentUrl) {
      try {
        full = await apiRequest<Homework>(`/homework/${item.id}`, accessToken);
    } catch (cause) {
        notifyError(cause instanceof Error ? cause.message : "Unable to load homework");
        return;
      }
    }
    setEditing(full);
    setFormOpen(true);
    setTab("list");
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function startEvaluate(id: string) {
    setEvaluateTarget(id);
    setTab("evaluate");
  }

  const TABS: Array<CmsIconTabItem<"list" | "evaluate" | "reports">> = [
    { key: "list", label: "All Homework", icon: MenuBookOutlined, tone: "indigo" },
    ...(canEvaluate
      ? ([
          { key: "evaluate", label: "Evaluate", icon: FactCheckOutlined, tone: "emerald" },
          { key: "reports", label: "Reports", icon: AssessmentOutlined, tone: "purple" },
        ] as const)
      : []),
  ];

  return (
    <CmsPage>
      <CmsPageHeader
        title="Homework"
        description="Assign, track, and evaluate homework by class and subject."
        actions={
          canManage ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={openAddForm}
            >
              <AddOutlined sx={{ fontSize: 16 }} /> Add homework
            </button>
          ) : undefined
        }
      />

      <CmsIconTabs
        ariaLabel="Homework sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3"
        items={TABS}
      />

      <CmsScrollBody>
        {!setup ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            {loading ? "Loading homework…" : "Unable to load homework."}
          </p>
        ) : (
          <>
            {tab === "list" ? (
              <ListPanel
                setup={setup}
                token={accessToken}
                canManage={canManage}
                canEvaluate={canEvaluate}
                canSubmit={canSubmit}
                onEdit={startEdit}
                onEvaluate={startEvaluate}
                onSaved={load}
              />
            ) : null}
            {formOpen && canManage ? (
              <HomeworkFormModal
                setup={setup}
                token={accessToken}
                editing={editing}
                onClose={closeForm}
                onSaved={async () => {
                  closeForm();
                  await load();
                }}
              />
            ) : null}
            {tab === "evaluate" ? (
              <EvaluatePanel setup={setup} token={accessToken} initialId={evaluateTarget} />
            ) : null}
            {tab === "reports" ? <ReportsPanel setup={setup} token={accessToken} /> : null}
          </>
        )}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}

function ListPanel({
  setup,
  token,
  canManage,
  canEvaluate,
  canSubmit,
  onEdit,
  onEvaluate,
  onSaved,
}: {
  setup: Setup;
  token: string;
  canManage: boolean;
  canEvaluate: boolean;
  canSubmit: boolean;
  onEdit: (item: Homework) => void;
  onEvaluate: (id: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [submitRowFor, setSubmitRowFor] = useState<string | null>(null);

  const classes = useMemo(() => {
    const seen = new Map<string, Named>();
    for (const cs of setup.classSections) {
      if (!seen.has(cs.academicClass.id)) seen.set(cs.academicClass.id, cs.academicClass);
    }
    return [...seen.values()];
  }, [setup.classSections]);

  const sections = useMemo(() => {
    const seen = new Map<string, Named>();
    for (const cs of setup.classSections) {
      if (classFilter && cs.academicClass.id !== classFilter) continue;
      if (!seen.has(cs.section.id)) seen.set(cs.section.id, cs.section);
    }
    return [...seen.values()];
  }, [setup.classSections, classFilter]);

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    for (const cs of setup.classSections) {
      if (classFilter && cs.academicClass.id !== classFilter) continue;
      for (const s of cs.subjects) seen.add(s.subject.name);
    }
    return [...seen].sort();
  }, [setup.classSections, classFilter]);

  const enrollmentBySection = useMemo(
    () =>
      new Map(setup.classSections.map((cs) => [cs.id, cs._count?.enrollments ?? null])),
    [setup.classSections],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return setup.homework
      .filter((item) => !classFilter || item.classSection.academicClass.id === classFilter)
      .filter((item) => !sectionFilter || item.classSection.section.id === sectionFilter)
      .filter((item) => !subjectFilter || item.classSubject.subject.name === subjectFilter)
      .filter((item) => {
        const hwDate = item.homeworkDate.slice(0, 10);
        if (dateFrom && hwDate < dateFrom) return false;
        if (dateTo && hwDate > dateTo) return false;
        return true;
      })
      .filter(
        (item) =>
          !query ||
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.classSubject.subject.name.toLowerCase().includes(query),
      );
  }, [setup.homework, classFilter, sectionFilter, subjectFilter, dateFrom, dateTo, search]);

  async function openRowAttachment(item: Homework) {
    try {
      const full = item.attachmentUrl
        ? item
        : await apiRequest<Homework>(`/homework/${item.id}`, token);
      openAttachment({ attachmentUrl: full.attachmentUrl ?? null, title: item.title });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load attachment");
    }
  }

  async function changeStatus(item: Homework, status: Homework["status"]) {
    try {
      await apiRequest(`/homework/${item.id}`, token, {
        method: "PUT",
        // attachmentUrl is intentionally omitted so the stored file is preserved.
        body: JSON.stringify({
          academicSessionId: item.classSection.academicSessionId,
          classSectionId: item.classSection.id,
          classSubjectId: item.classSubject.id,
          title: item.title,
          description: item.description,
          homeworkDate: item.homeworkDate.slice(0, 10),
          submissionDate: item.submissionDate.slice(0, 10),
          status,
        }),
      });
      notifySuccess(
        status === "PUBLISHED"
          ? "Homework published"
          : status === "CLOSED"
            ? "Homework closed"
            : "Homework moved to draft",
      );
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update homework");
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="nx-card flex flex-wrap items-end gap-3 px-4 py-3">
        <label className="block">
          <span className="nx-label">Class</span>
          <select
            className="nx-input mt-1 w-40"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSectionFilter("");
              setSubjectFilter("");
            }}
          >
            <option value="">All Classes</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nx-label">Section</span>
          <select
            className="nx-input mt-1 w-40"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="">All Sections</option>
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nx-label">Subject</span>
          <select
            className="nx-input mt-1 w-44"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nx-label">Homework date from</span>
          <input
            className="nx-input mt-1 w-40"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="nx-label">Homework date to</span>
          <input
            className="nx-input mt-1 w-40"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>
        <div className="relative ml-auto">
          <input
            className="nx-input w-64 pr-9"
            placeholder="Search title, description, subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SearchOutlined
            sx={{ fontSize: 18 }}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
      </div>
            </div>

      <div className="nx-card overflow-visible">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[920px] w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Homework Title</th>
                <th className="px-3 py-3 text-left">Class / Section</th>
                <th className="px-3 py-3 text-left">Subject</th>
                <th className="px-3 py-3 text-left">Homework Date</th>
                <th className="px-3 py-3 text-left">Submission Date</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Submissions</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item, rowIndex) => {
                const pill = statusPill(item);
                const menuOpensUp = rows.length > 3 && rowIndex >= rows.length - 2;
                const total = enrollmentBySection.get(item.classSection.id);
                const enrollment = setup.studentEnrollments.find(
                  ({ classSectionId }) => classSectionId === item.classSection.id,
                );
                const mySubmission = item.submissions?.[0];
                const maySubmit =
                  !mySubmission || mySubmission.status === "RESUBMIT_REQUESTED";
                const showSubmitRow = submitRowFor === item.id;
                return (
                  <FragmentRow key={item.id}>
                    <tr className="transition hover:bg-indigo-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{item.title}</span>
                          {hasAttachment(item) ? (
                            <button
                              type="button"
                              className="text-indigo-500 hover:text-indigo-700"
                              title="Open attachment"
                              onClick={() => void openRowAttachment(item)}
                            >
                              <AttachFileOutlined sx={{ fontSize: 15 }} />
                            </button>
                          ) : null}
                        </div>
                        {mySubmission ? (
                          <p className="mt-0.5 text-[11.5px] text-indigo-700">
                            My status: {SUBMISSION_LABEL[mySubmission.status]}
                            {mySubmission.review ? ` · ${mySubmission.review}` : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">
                        {sectionLabel(item.classSection)}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">
                        {item.classSubject.subject.name}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">
                        {formatDate(item.homeworkDate)}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">
                        {formatDate(item.submissionDate)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`nx-pill ${pill.cls}`}>{pill.label}</span>
                      </td>
                      <td className="px-3 py-3 text-[13px] font-semibold text-slate-700">
                        {item._count.submissions}
                        {typeof total === "number" ? `/${total}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end gap-1.5">
                          {canEvaluate ? (
                            <button
                              type="button"
                              className="nx-btn-secondary !px-3 !py-1 text-[12px]"
                              onClick={() => onEvaluate(item.id)}
                            >
                              Evaluate
                            </button>
                          ) : null}
                          {canSubmit && enrollment && maySubmit ? (
                            <button
                              type="button"
                              className="nx-btn-primary !px-3 !py-1 text-[12px]"
                              onClick={() =>
                                setSubmitRowFor(showSubmitRow ? null : item.id)
                              }
                            >
                              {showSubmitRow ? "Hide" : "Submit"}
                            </button>
                          ) : null}
                          {canManage ? (
                            <>
                              <button
                                type="button"
                                className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                                title="Edit homework"
                                onClick={() => onEdit(item)}
                              >
                                <EditOutlined sx={{ fontSize: 16 }} />
                              </button>
                              <button
                                type="button"
                                className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                                onClick={() =>
                                  setMenuFor(menuFor === item.id ? null : item.id)
                                }
                              >
                                <MoreVertOutlined sx={{ fontSize: 17 }} />
                              </button>
                              {menuFor === item.id ? (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setMenuFor(null)}
                                  />
                                  <div
                                    className={`absolute right-0 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg ${
                                      menuOpensUp ? "bottom-8" : "top-8"
                                    }`}
                                  >
                                    {item.status !== "PUBLISHED" ? (
                                      <MenuItem
                                        label="Publish"
                                        onClick={() => {
                                          setMenuFor(null);
                                          void changeStatus(item, "PUBLISHED");
                                        }}
                                      />
                                    ) : null}
                                    {item.status === "PUBLISHED" ? (
                                      <MenuItem
                                        label="Close submissions"
                                        onClick={() => {
                                          setMenuFor(null);
                                          void changeStatus(item, "CLOSED");
                                        }}
                                      />
                                    ) : null}
                                    {item.status !== "DRAFT" ? (
                                      <MenuItem
                                        label="Move to draft"
                                        onClick={() => {
                                          setMenuFor(null);
                                          void changeStatus(item, "DRAFT");
                                        }}
                                      />
                                    ) : null}
                                    {hasAttachment(item) ? (
                                      <MenuItem
                                        label="Open attachment"
                                        onClick={() => {
                                          setMenuFor(null);
                                          void openRowAttachment(item);
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {showSubmitRow && enrollment ? (
                      <tr>
                        <td colSpan={8} className="bg-slate-50/60 px-4 pb-4">
                          <SelfSubmissionForm
                            homeworkId={item.id}
                            enrollmentId={enrollment.id}
                            token={token}
                            onSaved={async () => {
                              setSubmitRowFor(null);
                              await onSaved();
                            }}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              No homework matches the current filters.
            </p>
          ) : null}
        </div>
      </div>
        </section>
  );
}

/** Keys the pair of rows without an extra DOM element. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function HomeworkFormModal({
  setup,
  token,
  editing,
  onClose,
  onSaved,
}: {
  setup: Setup;
  token: string;
  editing: Homework | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <HomeworkForm
          key={editing?.id ?? "new"}
          setup={setup}
          token={token}
          editing={editing}
          onClose={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

function HomeworkForm({
  setup,
  token,
  editing,
  onClose,
  onSaved,
}: {
  setup: Setup;
  token: string;
  editing: Homework | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(() => ({
    classId: editing?.classSection.academicClass.id ?? "",
    sectionId: editing?.classSection.section.id ?? "",
    classSubjectId: editing?.classSubject.id ?? "",
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    homeworkDate: editing?.homeworkDate.slice(0, 10) ?? today,
    submissionDate: editing?.submissionDate.slice(0, 10) ?? today,
    status: editing?.status ?? "PUBLISHED",
  }));
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(
    editing?.attachmentUrl
      ? {
          name: editing.attachmentUrl.startsWith("data:") ? "Uploaded document" : "Linked document",
          url: editing.attachmentUrl,
        }
      : null,
  );
  const [linkUrl, setLinkUrl] = useState(
    editing?.attachmentUrl && !editing.attachmentUrl.startsWith("data:")
      ? editing.attachmentUrl
      : "",
  );
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const classes = useMemo(() => {
    const seen = new Map<string, Named>();
    for (const cs of setup.classSections) {
      if (!seen.has(cs.academicClass.id)) seen.set(cs.academicClass.id, cs.academicClass);
    }
    return [...seen.values()];
  }, [setup.classSections]);

  const sectionOptions = useMemo(
    () => setup.classSections.filter((cs) => cs.academicClass.id === form.classId),
    [setup.classSections, form.classId],
  );

  const classSection = sectionOptions.find((cs) => cs.section.id === form.sectionId);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      notifyError("Attachment must be 20MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, url: String(reader.result) });
      setLinkUrl("");
    };
    reader.onerror = () => notifyError("Unable to read the selected file");
    reader.readAsDataURL(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? undefined);
    event.target.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession) {
      notifyError("Homework requires an active academic session");
      return;
    }
    if (!classSection) {
      notifyError("Select a class and section");
      return;
    }
    const attachmentUrl = attachment?.url ?? (linkUrl.trim() || null);
    setBusy(true);
    try {
      const body = JSON.stringify({
        academicSessionId: classSection.academicSessionId,
        classSectionId: classSection.id,
        classSubjectId: form.classSubjectId,
        title: form.title,
        description: form.description,
        attachmentUrl,
        homeworkDate: form.homeworkDate,
        submissionDate: form.submissionDate,
        status: form.status,
      });
      if (editing) {
        await apiRequest(`/homework/${editing.id}`, token, { method: "PUT", body });
        notifySuccess("Homework updated");
      } else {
        await apiRequest("/homework", token, { method: "POST", body });
        notifySuccess("Homework saved");
      }
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col overflow-hidden" onSubmit={submit}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <h2 className="text-[16px] font-bold text-slate-900">
          {editing ? "Edit Homework" : "Add New Homework"}
        </h2>
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-100"
          onClick={onClose}
        >
          <CloseOutlined sx={{ fontSize: 18 }} />
        </button>
      </div>

      <div className="overflow-y-auto p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="block">
            <span className="nx-label">Class *</span>
            <select
              className="nx-input mt-1 w-full"
              required
              value={form.classId}
              onChange={(e) =>
                setForm({ ...form, classId: e.target.value, sectionId: "", classSubjectId: "" })
              }
            >
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Section *</span>
            <select
              className="nx-input mt-1 w-full"
              required
              value={form.sectionId}
              onChange={(e) => setForm({ ...form, sectionId: e.target.value, classSubjectId: "" })}
            >
              <option value="">Select section</option>
              {sectionOptions.map((cs) => (
                <option key={cs.id} value={cs.section.id}>
                  {cs.section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Subject *</span>
            <select
              className="nx-input mt-1 w-full"
              required
              value={form.classSubjectId}
              onChange={(e) => setForm({ ...form, classSubjectId: e.target.value })}
            >
              <option value="">Select subject</option>
              {classSection?.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Homework Date *</span>
            <input
              className="nx-input mt-1 w-full"
              type="date"
              required
              value={form.homeworkDate}
              onChange={(e) => setForm({ ...form, homeworkDate: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="nx-label">Submission Date *</span>
            <input
              className="nx-input mt-1 w-full"
              type="date"
              required
              value={form.submissionDate}
              onChange={(e) => setForm({ ...form, submissionDate: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px]">
        <label className="block">
          <span className="nx-label">Homework Title *</span>
          <input
            className="nx-input mt-1 w-full"
            required
            maxLength={200}
            placeholder="e.g. Math Chapter 3 - Exercise 3.2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="nx-label">Status</span>
          <select
            className="nx-input mt-1 w-full"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Homework["status"] })}
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[280px_1fr]">
        <div>
          <span className="nx-label">Attach Document (optional)</span>
          <div
            className={`mt-1 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center transition ${
              dragOver ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 bg-slate-50/60"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <CloudUploadOutlined sx={{ fontSize: 22 }} className="text-slate-400" />
            <p className="text-[12.5px] font-semibold text-slate-600">
              Drag &amp; drop file here
              <br />
              or click to browse
            </p>
            <p className="text-[11px] text-slate-400">
              Supports: PDF, DOC, DOCX, PPT, PPTX (Max 20MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
              onChange={onPick}
            />
          </div>
          {attachment ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-indigo-700">
                <AttachFileOutlined sx={{ fontSize: 14 }} />
                <span className="truncate">{attachment.name}</span>
              </span>
              <button
                type="button"
                className="text-slate-400 hover:text-rose-600"
                title="Remove attachment"
                onClick={() => {
                  setAttachment(null);
                  setLinkUrl("");
                }}
              >
                <CloseOutlined sx={{ fontSize: 15 }} />
              </button>
            </div>
          ) : (
            <input
              className="nx-input mt-2 w-full"
              type="url"
              placeholder="…or paste a link (https://)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          )}
        </div>

        <label className="block">
          <span className="nx-label">Description *</span>
          <textarea
            className="nx-input mt-1 min-h-[120px] w-full"
            required
            maxLength={DESCRIPTION_LIMIT}
            placeholder="Enter homework description, instructions, and expectations…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <p className="mt-1 text-right text-[11px] text-slate-400">
            {form.description.length}/{DESCRIPTION_LIMIT} characters
          </p>
        </label>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button type="button" className="nx-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="nx-btn-primary min-w-28" disabled={busy}>
          {busy ? "Saving…" : editing ? "Update" : "Save"}
        </button>
      </div>
    </form>
  );
}

function attachmentName(url: string) {
  if (url.startsWith("data:")) return "Submission file";
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    return name || "Attachment";
  } catch {
    return "Attachment";
  }
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SegmentButton({
  label,
  active,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "green" | "amber" | "gray";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const activeCls =
    tone === "green"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-slate-300 bg-slate-200 text-slate-700";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition ${
        active ? activeCls : "border-slate-200 bg-white text-slate-400"
      } ${disabled ? "cursor-default" : "hover:border-slate-300"}`}
    >
      {label}
    </button>
  );
}

function EvaluatePanel({
  setup,
  token,
  initialId,
}: {
  setup: Setup;
  token: string;
  initialId?: string;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [roster, setRoster] = useState<HomeworkRoster | null>(null);
  const [pending, setPending] = useState<Record<string, "COMPLETED" | "RESUBMIT_REQUESTED">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function loadRoster(id: string) {
    setSelectedId(id);
    setPending({});
    if (!id) {
      setRoster(null);
      return;
    }
    try {
      const next = await apiRequest<HomeworkRoster>(`/homework/${id}/submissions`, token);
      setRoster(next);
      setNotes(
        Object.fromEntries(
          next.roster.flatMap((item) => {
            const submission = item.homeworkSubmissions[0];
            return submission ? [[submission.id, submission.review ?? ""] as const] : [];
          }),
        ),
      );
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load submissions");
    }
  }

  useEffect(() => {
    if (initialId) void loadRoster(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  const pendingCount = Object.keys(pending).length;

  async function saveEvaluations() {
    if (!roster || !pendingCount) return;
    setSaving(true);
    let saved = 0;
    let firstError: string | null = null;
    for (const [submissionId, status] of Object.entries(pending)) {
      try {
        await apiRequest(`/homework/submissions/${submissionId}/evaluate`, token, {
          method: "PUT",
          body: JSON.stringify({
            status,
            review: notes[submissionId]?.trim() || "Reviewed",
          }),
        });
        saved += 1;
      } catch (cause) {
        firstError ??= cause instanceof Error ? cause.message : "Unable to save an evaluation";
      }
    }
    setSaving(false);
    if (saved) notifySuccess(`${saved} evaluation${saved === 1 ? "" : "s"} saved`);
    if (firstError) notifyError(firstError);
    await loadRoster(selectedId);
  }

  const homework = roster?.homework ?? null;

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <label className="block w-full max-w-sm">
          <span className="nx-label">Select Homework Assignment to Evaluate *</span>
          <select
            className="nx-input mt-1 w-full"
            value={selectedId}
            onChange={(e) => void loadRoster(e.target.value)}
          >
            <option value="">Select homework</option>
            {setup.homework.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {homework ? (
          <div className="space-y-1 pb-1 text-[12.5px] text-slate-600">
            <p>
              <span className="text-slate-400">Class / Section:</span>{" "}
              <strong className="text-slate-800">{sectionLabel(homework.classSection)}</strong>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-400">Subject:</span>{" "}
              <strong className="text-slate-800">{homework.classSubject.subject.name}</strong>
            </p>
            <p>
              <span className="text-slate-400">Homework Date:</span>{" "}
              <strong className="text-slate-800">{formatDate(homework.homeworkDate)}</strong>
              <span className="mx-2 text-slate-300">|</span>
              <span className="text-slate-400">Submission Date:</span>{" "}
              <strong className="text-slate-800">{formatDate(homework.submissionDate)}</strong>
            </p>
          </div>
        ) : null}
      </div>

      {roster ? (
        <>
          <div className="nx-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="nx-table w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 text-left">Student Name</th>
                    <th className="px-3 py-3 text-left">Submitted File</th>
                    <th className="px-3 py-3 text-left">Submitted On</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-3 py-3 text-left">Review Note</th>
                    <th className="px-4 py-3 text-right">Attempt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.roster.map((item) => {
                    const submission = item.homeworkSubmissions[0];
                    const name = `${item.student.firstName} ${item.student.lastName ?? ""}`.trim();
                    const canMarkPerfect = submission?.status === "SUBMITTED";
                    const canResubmit =
                      submission &&
                      (submission.status === "SUBMITTED" ||
                        submission.status === "COMPLETED" ||
                        submission.status === "EVALUATED");
                    const canEditNotes = Boolean(canMarkPerfect || canResubmit);
                    const activeState: "COMPLETED" | "RESUBMIT_REQUESTED" | "NOT_SUBMITTED" | null =
                      !submission
                        ? "NOT_SUBMITTED"
                        : submission.status === "COMPLETED" || submission.status === "EVALUATED"
                          ? "COMPLETED"
                          : submission.status === "RESUBMIT_REQUESTED"
                            ? "RESUBMIT_REQUESTED"
                            : (pending[submission.id] ?? null);
                    return (
                      <tr key={item.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar
                              name={name}
                              photoUrl={item.student.photoUrl ?? undefined}
                              size={34}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{name}</p>
                              <p className="text-[11.5px] text-slate-400">
                                {item.student.admissionNumber}
                                {item.rollNumber ? ` · Roll ${item.rollNumber}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-56 px-3 py-3 text-[12.5px]">
                          {submission?.attachmentUrl ? (
                            <button
                              type="button"
                              className="flex max-w-full items-center gap-1.5 font-medium text-slate-700 hover:text-indigo-700 hover:underline"
                              onClick={() =>
                                openAttachment({
                                  attachmentUrl: submission.attachmentUrl,
                                  title: `${name}-submission`,
                                })
                              }
                            >
                              <FileDownloadOutlined
                                sx={{ fontSize: 16 }}
                                className="shrink-0 text-slate-400"
                              />
                              <span className="truncate">
                                {attachmentName(submission.attachmentUrl)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {submission?.answerText ? (
                            <p
                              className="mt-0.5 line-clamp-1 text-[11.5px] text-slate-500"
                              title={submission.answerText}
                            >
                              {submission.answerText}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-[12.5px] text-slate-600">
                          {formatDateTime(submission?.submittedAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <SegmentButton
                              label="Mark perfect"
                              tone="green"
                              active={activeState === "COMPLETED"}
                              disabled={!canMarkPerfect}
                              onClick={
                                canMarkPerfect
                                  ? () =>
                                      setPending((p) => {
                                        const next = { ...p };
                                        if (next[submission.id] === "COMPLETED") {
                                          delete next[submission.id];
                                        } else {
                                          next[submission.id] = "COMPLETED";
                                        }
                                        return next;
                                      })
                                  : undefined
                              }
                            />
                            <SegmentButton
                              label="Re-submit"
                              tone="amber"
                              active={activeState === "RESUBMIT_REQUESTED"}
                              disabled={!canResubmit}
                              onClick={
                                canResubmit
                                  ? () =>
                                      setPending((p) => {
                                        const next = { ...p };
                                        if (next[submission.id] === "RESUBMIT_REQUESTED") {
                                          delete next[submission.id];
                                        } else {
                                          next[submission.id] = "RESUBMIT_REQUESTED";
                                        }
                                        return next;
                                      })
                                  : undefined
                              }
                            />
                            <SegmentButton
                              label="Not submitted"
                              tone="gray"
                              active={activeState === "NOT_SUBMITTED"}
                              disabled
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="nx-input w-full min-w-40 !py-1.5 text-[12.5px]"
                            placeholder="Add a note (optional)"
                            disabled={!canEditNotes}
                            value={submission ? (notes[submission.id] ?? "") : ""}
                            onChange={(e) =>
                              submission &&
                              setNotes((p) => ({ ...p, [submission.id]: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-[12px] text-slate-400">
                          {submission ? submission.attempt : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!roster.roster.length ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No students enrolled in this class section.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-2.5 text-[12.5px] font-medium text-indigo-700">
              <InfoOutlined sx={{ fontSize: 16 }} />
              Students can only resubmit once you request a re-submit.
            </p>
            <button
              type="button"
              className="nx-btn-primary min-w-36"
              disabled={saving || !pendingCount}
              onClick={() => void saveEvaluations()}
            >
              {saving
                ? "Saving…"
                : pendingCount
                  ? `Save evaluations (${pendingCount})`
                  : "Save evaluations"}
            </button>
          </div>

          <div className="max-w-md">
            <StudentSubmissionForm
              homeworkId={roster.homework.id}
              roster={roster.roster}
              token={token}
              onSaved={() => loadRoster(roster.homework.id)}
            />
          </div>
        </>
      ) : (
        <p className="mt-6 text-center text-sm text-slate-500">
          Select a homework assignment to review student submissions.
        </p>
      )}
    </section>
  );
}

type HomeworkReportKind = "complete" | "progress" | "due";

const REPORT_CARDS: Array<{
  kind: HomeworkReportKind;
  title: string;
  description: string;
  icon: React.ReactNode;
  tint: string;
}> = [
  {
    kind: "complete",
    title: "Homework Complete Report",
    description:
      "View a summary of homework completed by students within a selected time period.",
    icon: <AssignmentTurnedInOutlined sx={{ fontSize: 30 }} />,
    tint: "bg-indigo-100 text-indigo-600",
  },
  {
    kind: "progress",
    title: "Homework Progress Report",
    description:
      "Track student progress and submission rates for homework assignments over a selected time period.",
    icon: <TrendingUpOutlined sx={{ fontSize: 30 }} />,
    tint: "bg-emerald-100 text-emerald-600",
  },
  {
    kind: "due",
    title: "Homework Due Report",
    description:
      "View upcoming and overdue homework assignments within a selected time period.",
    icon: <EventBusyOutlined sx={{ fontSize: 30 }} />,
    tint: "bg-orange-100 text-orange-500",
  },
];

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dueLabel(item: ReportRow): string {
  const due = item.homework.submissionDate.slice(0, 10);
  if (item.homework.status === "CLOSED") return "Closed";
  if (due < today) return "Overdue";
  if (due === today) return "Due Today";
  return "Upcoming";
}

function ReportsPanel({ setup, token }: { setup: Setup; token: string }) {
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [active, setActive] = useState<HomeworkReportKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!setup.currentSession) return;
      try {
        const rows = await apiRequest<ReportRow[]>(
          `/homework-reports?sessionId=${setup.currentSession.id}`,
          token,
        );
        if (!cancelled) setReport(rows);
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load homework report");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [setup.currentSession, token]);

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.filter((item) => {
      const due = item.homework.submissionDate.slice(0, 10);
      if (from && due < from) return false;
      if (to && due > to) return false;
      return true;
    });
  }, [report, from, to]);

  const activeRows = useMemo(() => {
    if (!active) return [];
    if (active === "complete") return filtered.filter((item) => item.completed > 0);
    if (active === "due")
      return filtered.filter(
        (item) => item.due > 0 || item.homework.submissionDate.slice(0, 10) >= today,
      );
    return filtered;
  }, [active, filtered]);

  function exportCsv() {
    if (!active) return;
    const title = REPORT_CARDS.find((card) => card.kind === active)?.title ?? "Homework report";
    downloadCsv(
      `${title.toLowerCase().replaceAll(" ", "-")}.csv`,
      [
        "Title",
        "Class / Section",
        "Subject",
        "Submission Date",
        "Status",
        "Assigned",
        "Submitted",
        "Completed",
        "Resubmit Requested",
        "Pending",
        "Progress %",
      ],
      activeRows.map((item) => [
        item.homework.title,
        sectionLabel(item.homework.classSection),
        item.homework.classSubject.subject.name,
        item.homework.submissionDate.slice(0, 10),
        dueLabel(item),
        item.assigned,
        item.submitted,
        item.completed,
        item.resubmitRequested,
        item.due,
        item.progressPercent,
      ]),
    );
  }

  if (!setup.currentSession) {
    return (
      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">
        Homework reports require an active academic session.
      </p>
    );
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="nx-label">From (optional)</span>
          <input
            className="nx-input mt-1 w-40"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="nx-label">To (optional)</span>
          <input
            className="nx-input mt-1 w-40"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <p className="pb-2 text-[12px] text-slate-400">
          Time period filters by each homework&apos;s submission date.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_CARDS.map((card) => (
          <div
            key={card.kind}
            className={`nx-card flex flex-col items-center p-6 text-center ${
              active === card.kind ? "ring-2 ring-indigo-200" : ""
            }`}
          >
            <span
              className={`grid size-[72px] place-items-center rounded-full ${card.tint}`}
            >
              {card.icon}
            </span>
            <h3 className="mt-4 text-[14.5px] font-bold text-slate-900">{card.title}</h3>
            <p className="mt-2 max-w-64 text-[12.5px] leading-relaxed text-slate-500">
              {card.description}
            </p>
            <div className="mt-4 w-full border-t border-slate-100 pt-4">
              <button
                type="button"
                className="nx-btn-primary mx-auto"
                disabled={!report}
                onClick={() => setActive(card.kind)}
              >
                <DescriptionOutlined sx={{ fontSize: 15 }} /> Generate
              </button>
            </div>
          </div>
        ))}
      </div>

      {active ? (
        <div className="nx-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <h3 className="text-[13.5px] font-bold text-slate-900">
              {REPORT_CARDS.find((card) => card.kind === active)?.title}
              <span className="ml-2 text-[12px] font-medium text-slate-400">
                {activeRows.length} record{activeRows.length === 1 ? "" : "s"}
              </span>
            </h3>
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={!activeRows.length}
              onClick={exportCsv}
            >
              <FileDownloadOutlined sx={{ fontSize: 15 }} /> Download CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">Homework</th>
                  <th className="px-3 py-3 text-left">Class / Section</th>
                  <th className="px-3 py-3 text-left">Subject</th>
                  <th className="px-3 py-3 text-left">Submission Date</th>
                  {active === "due" ? <th className="px-3 py-3 text-left">Status</th> : null}
                  <th className="px-3 py-3 text-right">Assigned</th>
                  <th className="px-3 py-3 text-right">Submitted</th>
                  {active !== "due" ? (
                    <th className="px-3 py-3 text-right">Completed</th>
                  ) : null}
                  <th className="px-3 py-3 text-right">Pending</th>
                  {active === "progress" ? (
                    <th className="px-4 py-3 text-left">Progress</th>
                  ) : (
                    <th className="px-4 py-3 text-right">Completion %</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRows.map((item) => (
                  <tr key={item.homework.id} className="transition hover:bg-indigo-50/30">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {item.homework.title}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-slate-600">
                      {sectionLabel(item.homework.classSection)}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-slate-600">
                      {item.homework.classSubject.subject.name}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-slate-600">
                      {formatDate(item.homework.submissionDate)}
                    </td>
                    {active === "due" ? (
                      <td className="px-3 py-3">
                        <span
                          className={`nx-pill ${
                            dueLabel(item) === "Overdue"
                              ? "nx-pill-danger"
                              : dueLabel(item) === "Due Today"
                                ? "nx-pill-warning"
                                : "nx-pill-indigo"
                          }`}
                        >
                          {dueLabel(item)}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-right text-[13px] text-slate-700">
                      {item.assigned}
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] text-slate-700">
                      {item.submitted}
                    </td>
                    {active !== "due" ? (
                      <td className="px-3 py-3 text-right text-[13px] font-semibold text-emerald-700">
                        {item.completed}
                      </td>
                    ) : null}
                    <td
                      className={`px-3 py-3 text-right text-[13px] font-semibold ${
                        item.due ? "text-rose-600" : "text-slate-700"
                      }`}
                    >
                      {item.due}
                    </td>
                    {active === "progress" ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-bold text-slate-700">
                            {item.progressPercent}%
                          </span>
                        </div>
                      </td>
                    ) : (
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-slate-900">
                        {item.progressPercent}%
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!activeRows.length ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No records match this report for the selected time period.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SelfSubmissionForm({
  homeworkId,
  enrollmentId,
  token,
  onSaved,
}: {
  homeworkId: string;
  enrollmentId: string;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [answerText, setAnswerText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({
          studentEnrollmentId: enrollmentId,
          answerText,
          attachmentUrl: attachmentUrl || null,
        }),
      });
      setAnswerText("");
      setAttachmentUrl("");
      notifySuccess("Homework submitted");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5" onSubmit={submit}>
      <p className="text-[13px] font-bold text-slate-900">My submission</p>
      <textarea
        className="nx-input mt-2 w-full"
        rows={2}
        required
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        placeholder="Answer or submission note"
      />
      <input
        className="nx-input mt-2 w-full"
        type="url"
        value={attachmentUrl}
        onChange={(e) => setAttachmentUrl(e.target.value)}
        placeholder="Attachment URL (optional)"
      />
      <button className="nx-btn-primary mt-2.5" disabled={busy}>
        {busy ? "Submitting…" : "Submit homework"}
      </button>
    </form>
  );
}

function StudentSubmissionForm({
  homeworkId,
  roster,
  token,
  onSaved,
}: {
  homeworkId: string;
  roster: RosterItem[];
  token: string;
  onSaved: () => Promise<void>;
}) {
  const eligible = useMemo(
    () =>
      roster.filter(
        (item) =>
          !item.homeworkSubmissions.length ||
          item.homeworkSubmissions[0].status === "RESUBMIT_REQUESTED",
      ),
    [roster],
  );
  const [form, setForm] = useState({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" });
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest(`/homework/${homeworkId}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({ ...form, attachmentUrl: form.attachmentUrl || null }),
      });
      setForm({ studentEnrollmentId: "", answerText: "", attachmentUrl: "" });
      notifySuccess("Homework submitted");
      await onSaved();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="nx-card h-fit p-4" onSubmit={submit}>
      <h3 className="text-[14px] font-bold text-slate-900">Record student submission</h3>
      <p className="mt-0.5 text-[12px] text-slate-500">
        A submitted student appears again only after resubmission is requested.
      </p>
      <label className="mt-3 block">
        <span className="nx-label">Eligible student</span>
        <select
          className="nx-input mt-1 w-full"
          required
          value={form.studentEnrollmentId}
          onChange={(e) => setForm({ ...form, studentEnrollmentId: e.target.value })}
        >
          <option value="">Select student</option>
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {item.student.firstName} {item.student.lastName} · {item.student.admissionNumber}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="nx-label">Answer / note</span>
        <textarea
          className="nx-input mt-1 w-full"
          rows={3}
          required
          placeholder="Answer or submission note"
          value={form.answerText}
          onChange={(e) => setForm({ ...form, answerText: e.target.value })}
        />
      </label>
      <label className="mt-3 block">
        <span className="nx-label">Attachment URL</span>
        <input
          className="nx-input mt-1 w-full"
          type="url"
          placeholder="https://… (optional)"
          value={form.attachmentUrl}
          onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
        />
      </label>
      <button className="nx-btn-primary mt-4 w-full" disabled={busy || !eligible.length}>
        {busy ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
