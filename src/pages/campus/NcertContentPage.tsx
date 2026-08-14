import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  BiotechOutlined,
  BookmarkBorderOutlined,
  CalculateOutlined,
  ChevronRightOutlined,
  ComputerOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterAltOutlined,
  HistoryOutlined,
  LanguageOutlined,
  LinkOutlined,
  ListAltOutlined,
  MenuBookOutlined,
  MoreVertOutlined,
  OpenInNewOutlined,
  PictureAsPdfOutlined,
  PublicOutlined,
  ScienceOutlined,
  SearchOutlined,
  SettingsOutlined,
  UploadFileOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, SubjectItem } from "./academics/types";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { API_ORIGIN, apiRequest, assetUrl } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type ResourceStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type ResourceType = "LINK" | "FILE";
type LibraryCategory = "BOOKS" | "EXEMPLAR" | "SOLUTIONS" | "LAB_MANUAL" | "RESOURCE_MAP";
type View = "browse" | "create" | "detail" | "edit" | "downloads";

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

interface NcertResource {
  id: string;
  title: string;
  description: string | null;
  chapter: string | null;
  category: LibraryCategory | string;
  resourceType: ResourceType;
  resourceUrl: string | null;
  fileName: string | null;
  subjectId: string | null;
  classId: string | null;
  status: ResourceStatus;
  createdAt: string;
  subject: NamedRef | null;
  academicClass: NamedRef | null;
  createdBy: PersonRef;
}

interface ListResult {
  items: NcertResource[];
  total: number;
}

interface Stats {
  total: number;
  published: number;
  drafts: number;
  archived: number;
  mine: number;
}

interface NcertSettings {
  allowTeachersToCreateNcertResources: boolean;
}

const CATEGORY_TABS: { id: LibraryCategory; label: string }[] = [
  { id: "BOOKS", label: "Books" },
  { id: "EXEMPLAR", label: "Exemplar Problems" },
  { id: "SOLUTIONS", label: "Solutions" },
  { id: "LAB_MANUAL", label: "Lab Manuals" },
  { id: "RESOURCE_MAP", label: "Resource Maps" },
];

const QUICK_LINKS = [
  { label: "NCERT Official Website", href: "https://ncert.nic.in/" },
  { label: "Syllabus by NCERT", href: "https://ncert.nic.in/syllabus.php" },
  { label: "Curriculum Framework", href: "https://ncert.nic.in/pdf/nc-framework/nf2005-english.pdf" },
  { label: "NCERT News & Updates", href: "https://ncert.nic.in/announcement.php" },
];

const SUBJECT_STYLES = [
  { bg: "#e0e7ff", fg: "#4338ca" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#e0f2fe", fg: "#0369a1" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#ffedd5", fg: "#c2410c" },
];

const emptyForm = {
  title: "",
  description: "",
  chapter: "",
  category: "BOOKS" as LibraryCategory,
  resourceType: "LINK" as ResourceType,
  resourceUrl: "",
  fileName: "",
  subjectId: "",
  classId: "",
};

const statusTone: Record<ResourceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-amber-50 text-amber-800",
};

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="max-w-md text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function openResourceUrl(url: string | null) {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return assetUrl(url) || `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

function subjectGlyph(name: string) {
  const n = name.toLowerCase();
  const sx = { fontSize: 22 } as const;
  if (n.includes("math")) return <CalculateOutlined sx={sx} />;
  if (n.includes("science") || n.includes("physics") || n.includes("chem") || n.includes("bio"))
    return <ScienceOutlined sx={sx} />;
  if (n.includes("social") || n.includes("history") || n.includes("geo") || n.includes("civics"))
    return <PublicOutlined sx={sx} />;
  if (n.includes("english") || n.includes("hindi") || n.includes("sanskrit") || n.includes("urdu") || n.includes("tamil"))
    return <LanguageOutlined sx={sx} />;
  if (n.includes("computer") || n.includes("information") || n.includes("it"))
    return <ComputerOutlined sx={sx} />;
  if (n.includes("home") || n.includes("lab")) return <BiotechOutlined sx={sx} />;
  return <MenuBookOutlined sx={sx} />;
}

function fileKindLabel(row: NcertResource) {
  if (row.resourceType === "LINK") return "Link";
  const name = (row.fileName || row.resourceUrl || "").toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOC";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "PPT";
  return "File";
}

export function NcertContentPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).includes("ncert.manage");
  const canPublish = isAdmin;

  const [view, setView] = useState<View>("browse");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NcertResource[]>([]);
  const [allRows, setAllRows] = useState<NcertResource[]>([]);
  const [selected, setSelected] = useState<NcertResource | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    published: 0,
    drafts: 0,
    archived: 0,
    mine: 0,
  });
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [settings, setSettings] = useState<NcertSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(4);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [category, setCategory] = useState<LibraryCategory>("BOOKS");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterType, setFilterType] = useState<ResourceType | "">("");
  const [filterYear, setFilterYear] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | "">("");
  const [railSubjectId, setRailSubjectId] = useState("");
  const [railYear, setRailYear] = useState("");
  const [form, setForm] = useState(emptyForm);

  const isBooksHome = category === "BOOKS";
  const isLabManuals = category === "LAB_MANUAL";
  const isExemplarStyle = !isBooksHome && !isLabManuals;
  const categoryLabel = CATEGORY_TABS.find((t) => t.id === category)?.label ?? "Books";

  const teachersAllowed = settings?.allowTeachersToCreateNcertResources ?? false;
  const canManage = hasManagePerm && (isAdmin || (isTeacher && teachersAllowed));
  const ownsSelected = !!selected && (!!isAdmin || selected.createdBy?.id === user?.id);
  const canEditSelected = canManage && ownsSelected && selected?.status === "DRAFT";

  const loadSetup = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [academics, ncertSettings] = await Promise.all([
        apiRequest<AcademicSetup>("/academics/setup", accessToken),
        apiRequest<NcertSettings>("/ncert-content/settings", accessToken).catch(() => null),
      ]);
      setSubjects(academics.subjects ?? []);
      setClasses(academics.classes ?? []);
      if (ncertSettings) setSettings(ncertSettings);
    } catch {
      // optional
    }
  }, [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    try {
      setStats(await apiRequest<Stats>("/ncert-content/stats", accessToken));
    } catch {
      setStats({ total: 0, published: 0, drafts: 0, archived: 0, mine: 0 });
    }
  }, [accessToken]);

  const loadAggregate = useCallback(async () => {
    if (!accessToken) return;
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100", category });
      const data = await apiRequest<ListResult>(`/ncert-content?${params}`, accessToken);
      setAllRows(data.items ?? []);
    } catch {
      setAllRows([]);
    }
  }, [accessToken, category]);

  const loadRows = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50", category });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (filterSubjectId) params.set("subjectId", filterSubjectId);
      if (filterClassId) params.set("classId", filterClassId);
      const data = await apiRequest<ListResult>(`/ncert-content?${params}`, accessToken);
      let items = data.items ?? [];
      if (filterType) items = items.filter((r) => r.resourceType === filterType);
      if (filterYear) {
        items = items.filter((r) => new Date(r.createdAt).getFullYear().toString() === filterYear);
      }
      setRows(items);
      setListPage(1);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load NCERT resources");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, statusFilter, filterSubjectId, filterClassId, filterType, filterYear, category]);

  const openRow = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<NcertResource>(`/ncert-content/${id}`, accessToken);
        setSelected(data);
        setView("detail");
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to open resource");
      }
    },
    [accessToken],
  );

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadRows();
    void loadStats();
    void loadAggregate();
  }, [loadRows, loadStats, loadAggregate]);

  const subjectCards = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) {
      if (!row.subjectId) continue;
      counts.set(row.subjectId, (counts.get(row.subjectId) ?? 0) + 1);
    }
    const cards = subjects.map((s, index) => ({
      id: s.id,
      name: s.name,
      count: counts.get(s.id) ?? 0,
      tone: SUBJECT_STYLES[index % SUBJECT_STYLES.length]!,
    }));
    cards.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return cards;
  }, [subjects, allRows]);

  const visibleSubjects = showAllSubjects ? subjectCards : subjectCards.slice(0, 12);

  const classBrowse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) {
      if (!row.classId) continue;
      counts.set(row.classId, (counts.get(row.classId) ?? 0) + 1);
    }
    return [...classes]
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [classes, allRows]);

  const chapterCount = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) {
      const key = (row.chapter || "").trim().toLowerCase();
      if (key) set.add(key);
    }
    return set.size;
  }, [allRows]);

  const subjectWithResources = useMemo(
    () => subjectCards.filter((s) => s.count > 0).length,
    [subjectCards],
  );

  const recentRows = useMemo(() => rows.slice(0, 6), [rows]);

  const listTotalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const listPageRows = useMemo(() => {
    const start = (listPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, listPage, pageSize]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const row of allRows) {
      years.add(new Date(row.createdAt).getFullYear().toString());
    }
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [allRows]);

  const selectedClassName = classes.find((c) => c.id === filterClassId)?.name;
  const selectedSubjectName = subjects.find((s) => s.id === filterSubjectId)?.name;

  const popularSubjects = useMemo(
    () => subjectCards.filter((s) => s.count > 0).slice(0, 6),
    [subjectCards],
  );

  const myDownloads = useMemo(
    () =>
      allRows.filter(
        (r) => r.createdBy?.id === user?.id && r.resourceType === "FILE" && !!r.resourceUrl,
      ),
    [allRows, user?.id],
  );

  const myManuals = useMemo(
    () => allRows.filter((r) => r.createdBy?.id === user?.id),
    [allRows, user?.id],
  );

  useEffect(() => {
    if (isBooksHome || filterClassId || classes.length === 0) return;
    const preferred =
      classes.find((c) => /class\s*10\b/i.test(c.name)) ??
      classes.find((c) => /\b10\b/.test(c.name)) ??
      classes[0];
    if (preferred) setFilterClassId(preferred.id);
  }, [isBooksHome, classes, filterClassId]);

  function formatUpdatedOn(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }

  function classNumberLabel(name: string | null | undefined) {
    if (!name) return "—";
    const match = name.match(/(\d{1,2})/);
    return match?.[1] ?? name;
  }

  async function toggleTeacherCreate(next: boolean) {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<NcertSettings>("/ncert-content/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ allowTeachersToCreateNcertResources: next }),
      });
      setSettings(data);
      notifySuccess(next ? "Teachers can add NCERT resources" : "Teacher creation disabled");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function startCreate() {
    setForm({ ...emptyForm, category });
    setSelected(null);
    setView("create");
  }

  function startEdit() {
    if (!selected) return;
    setForm({
      title: selected.title,
      description: selected.description ?? "",
      chapter: selected.chapter ?? "",
      category: (selected.category as LibraryCategory) || "BOOKS",
      resourceType: selected.resourceType,
      resourceUrl: selected.resourceUrl ?? "",
      fileName: selected.fileName ?? "",
      subjectId: selected.subjectId ?? selected.subject?.id ?? "",
      classId: selected.classId ?? selected.academicClass?.id ?? "",
    });
    setView("edit");
  }

  async function uploadFile(file: File) {
    if (!accessToken) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1"}/ncert-content/upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body,
        },
      );
      const json = (await response.json()) as {
        data?: { resourceUrl: string; fileName: string; resourceType: ResourceType };
        error?: { message?: string };
      };
      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Upload failed");
      }
      setForm((f) => ({
        ...f,
        resourceType: "FILE",
        resourceUrl: json.data!.resourceUrl,
        fileName: json.data!.fileName,
      }));
      notifySuccess("File uploaded");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function bodyFromForm() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      chapter: form.chapter.trim() || null,
      category: form.category,
      resourceType: form.resourceType,
      resourceUrl: form.resourceUrl.trim() || null,
      fileName: form.resourceType === "FILE" ? form.fileName.trim() || null : null,
      subjectId: form.subjectId || null,
      classId: form.classId || null,
    };
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.title.trim()) {
      notifyError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const body = bodyFromForm();
      if (view === "edit" && selected) {
        const updated = await apiRequest<NcertResource>(`/ncert-content/${selected.id}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setSelected(updated);
        notifySuccess("Resource updated");
        setView("detail");
      } else {
        const created = await apiRequest<NcertResource>("/ncert-content", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelected(created);
        notifySuccess("Resource created as draft");
        setView("detail");
      }
      await Promise.all([loadRows(), loadStats(), loadAggregate()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save resource");
    } finally {
      setSaving(false);
    }
  }

  async function publishSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<NcertResource>(`/ncert-content/${selected.id}/publish`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Published — students can open this resource");
      await Promise.all([loadRows(), loadStats(), loadAggregate()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  async function archiveSelected() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      const data = await apiRequest<NcertResource>(`/ncert-content/${selected.id}/archive`, accessToken, {
        method: "POST",
      });
      setSelected(data);
      notifySuccess("Resource archived");
      await Promise.all([loadRows(), loadStats(), loadAggregate()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive failed");
    }
  }

  async function deleteSelected() {
    if (!accessToken || !selected || !canEditSelected) return;
    const ok = await confirmDelete({
      title: "Delete resource?",
      text: `Delete draft “${selected.title}”? This cannot be undone.`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/ncert-content/${selected.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Resource deleted");
      setSelected(null);
      setView("browse");
      await Promise.all([loadRows(), loadStats(), loadAggregate()]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  function applyFilters() {
    setSearch(draftSearch);
  }

  function applyRailFilters() {
    setFilterSubjectId(railSubjectId);
    setFilterYear(railYear);
    setSearch(draftSearch);
  }

  function subjectTone(name: string | null | undefined, fallbackIndex = 0) {
    const idx = subjects.findIndex((s) => s.name === name);
    return SUBJECT_STYLES[(idx >= 0 ? idx : fallbackIndex) % SUBJECT_STYLES.length]!;
  }

  const heroBanner = (
    <div className="relative overflow-hidden rounded-2xl border border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] via-[#f5f8ff] to-white">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]" />
      <div className="relative grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="hidden h-20 w-[72px] shrink-0 items-end justify-center sm:flex"
            aria-hidden
          >
            <div className="relative h-[68px] w-[64px]">
              <span className="absolute bottom-0 left-0 h-[52px] w-[22px] -rotate-[8deg] rounded-md bg-[#f87171] shadow-sm ring-1 ring-black/5" />
              <span className="absolute bottom-0 left-[18px] h-[60px] w-[24px] rounded-md bg-[#60a5fa] shadow-md ring-1 ring-black/5" />
              <span className="absolute bottom-0 left-[38px] h-[48px] w-[22px] rotate-[8deg] rounded-md bg-[#34d399] shadow-sm ring-1 ring-black/5" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight text-slate-900 sm:text-[19px]">
              {isBooksHome ? "Official NCERT Learning Resources" : `NCERT ${categoryLabel}`}
            </h2>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-slate-600">
              {isBooksHome
                ? "Access textbooks, solutions, exemplar problems and more. Download or open links anytime from your campus library."
                : `Browse ${categoryLabel.toLowerCase()} by class and subject. Open or download resources from your campus library.`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          {[
            { label: "Subjects", value: subjectWithResources || subjects.length },
            { label: "Books", value: allRows.length },
            { label: "Chapters", value: chapterCount },
            { label: "Resources", value: stats.total },
          ].map((item) => (
            <div key={item.label} className="min-w-0 px-3 py-3 text-center sm:px-4">
              <p className="text-[16px] font-black leading-none text-[#534AB7] sm:text-[18px]">
                {item.value.toLocaleString("en-IN")}
              </p>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const filterToolbar = (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <div
        className={`grid gap-3 ${
          isBooksHome
            ? "sm:grid-cols-2 lg:grid-cols-[minmax(120px,140px)_minmax(120px,160px)_minmax(110px,130px)_minmax(180px,1fr)_auto]"
            : "sm:grid-cols-2 lg:grid-cols-[minmax(140px,180px)_minmax(150px,200px)_minmax(180px,1fr)_auto]"
        } items-end`}
      >
        {isBooksHome ? (
          <Field label="Class">
            <select
              className="nx-input !h-[38px] !py-0 !font-semibold"
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Subject">
          <select
            className="nx-input !h-[38px] !py-0 !font-semibold"
            value={filterSubjectId}
            onChange={(e) => {
              setFilterSubjectId(e.target.value);
              setRailSubjectId(e.target.value);
            }}
          >
            <option value="">All Subjects</option>
            {subjects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        {isBooksHome ? (
          <Field label="Book Type">
            <select
              className="nx-input !h-[38px] !py-0 !font-semibold"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ResourceType | "")}
            >
              <option value="">All Types</option>
              <option value="FILE">File</option>
              <option value="LINK">Link</option>
            </select>
          </Field>
        ) : (
          <Field label="Book Type">
            <select
              className="nx-input !h-[38px] !py-0 !font-semibold"
              value={category}
              onChange={(e) => {
                const next = e.target.value as LibraryCategory;
                setCategory(next);
                setListPage(1);
                if (next === "BOOKS") setFilterClassId("");
              }}
            >
              {CATEGORY_TABS.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Search">
          <div className="relative">
            <SearchOutlined
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input !h-[38px] !py-0 !pl-8"
              placeholder="Search books / chapters..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </div>
        </Field>
        <button
          type="button"
          className="nx-btn-secondary !h-[38px] !px-3.5 !text-[12px]"
          onClick={applyFilters}
        >
          <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
        </button>
      </div>
    </div>
  );

  const booksBrowseMain = (
    <div className="min-w-0 space-y-4">
      {heroBanner}
      {filterToolbar}

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">Books by Subjects</h2>
          {filterSubjectId ? (
            <button
              type="button"
              className="text-[12px] font-semibold text-[#534AB7] hover:underline"
              onClick={() => {
                setFilterSubjectId("");
                setRailSubjectId("");
              }}
            >
              Clear subject
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {visibleSubjects.map((subject) => (
            <div
              key={subject.id}
              className={`flex h-full min-h-[148px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-sm transition hover:border-[#c7d2fe] ${
                filterSubjectId === subject.id ? "border-[#534AB7] ring-2 ring-[#534AB7]/20" : ""
              }`}
            >
              <span
                className="mb-3 inline-grid size-11 place-items-center rounded-xl"
                style={{ background: subject.tone.bg, color: subject.tone.fg }}
              >
                {subjectGlyph(subject.name)}
              </span>
              <p className="truncate text-[13px] font-bold text-slate-900">{subject.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">NCERT Textbook</p>
              <p className="mt-auto pt-3 text-[11px] font-semibold text-slate-600">
                {subject.count} {subject.count === 1 ? "Book" : "Books"}
              </p>
              <button
                type="button"
                className="mt-1 self-start text-[11.5px] font-semibold text-[#534AB7] hover:underline"
                onClick={() => {
                  setFilterSubjectId(subject.id);
                  setRailSubjectId(subject.id);
                  setDraftSearch("");
                  setSearch("");
                }}
              >
                View Books
              </button>
            </div>
          ))}
          {!visibleSubjects.length ? (
            <div className="col-span-full rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-8 text-center text-[12px] text-slate-500">
              Subjects from Academics appear here once configured.
            </div>
          ) : null}
        </div>
        {subjectCards.length > 12 ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-[12.5px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setShowAllSubjects((v) => !v)}
          >
            {showAllSubjects ? "Show fewer subjects" : "View All Subjects"}
            <ChevronRightOutlined sx={{ fontSize: 16 }} />
          </button>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">
            {filterSubjectId || filterClassId || search || filterType
              ? "Matching Resources"
              : "Recently Added Resources"}
          </h2>
          {(filterSubjectId || filterClassId || search || filterType) && (
            <button
              type="button"
              className="text-[12px] font-semibold text-[#534AB7] hover:underline"
              onClick={() => {
                setFilterSubjectId("");
                setRailSubjectId("");
                setFilterClassId("");
                setFilterType("");
                setDraftSearch("");
                setSearch("");
                setStatusFilter("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : recentRows.length === 0 ? (
          <EmptyState
            title="No books yet"
            hint={
              canManage
                ? "Upload a resource or add a link, then ask an admin to publish."
                : "Published study materials will appear here."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recentRows.map((row) => (
              <div
                key={row.id}
                className="flex items-stretch gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm transition hover:border-[#c7d2fe]"
              >
                <button
                  type="button"
                  onClick={() => void openRow(row.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span className="inline-grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#ede9fe] to-[#dbeafe] text-[#534AB7]">
                    {row.resourceType === "FILE" ? (
                      <PictureAsPdfOutlined sx={{ fontSize: 26 }} />
                    ) : (
                      <LinkOutlined sx={{ fontSize: 26 }} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-900">{row.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {[row.subject?.name, row.academicClass?.name].filter(Boolean).join(" · ") ||
                        "Unassigned"}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-600">
                      <PictureAsPdfOutlined sx={{ fontSize: 13 }} />
                      {fileKindLabel(row)}
                      {row.status !== "PUBLISHED" ? (
                        <span className={`ml-1 rounded px-1 py-0.5 ${statusTone[row.status]}`}>
                          {row.status}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
                {row.resourceUrl ? (
                  <a
                    href={openResourceUrl(row.resourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-grid size-9 shrink-0 place-items-center self-center rounded-lg text-[#534AB7] hover:bg-[#ede9fe]"
                    title={row.resourceType === "FILE" ? "Download / open" : "Open link"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DownloadOutlined sx={{ fontSize: 18 }} />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const categoryListMain = (
    <div className="min-w-0 space-y-4">
      {heroBanner}
      {filterToolbar}

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-slate-900">
            Books in {selectedSubjectName || "All Subjects"}
            {selectedClassName ? ` (${selectedClassName})` : ""}
          </h2>
          <span className="text-[11.5px] text-slate-500">
            {rows.length} {rows.length === 1 ? "book" : "books"}
          </span>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : listPageRows.length === 0 ? (
          <EmptyState
            title={`No ${categoryLabel.toLowerCase()} yet`}
            hint={
              canManage
                ? `Upload a ${categoryLabel.toLowerCase()} resource for this class, then ask an admin to publish.`
                : "Published resources for this class will appear here."
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {listPageRows.map((row, index) => {
              const tone = subjectTone(row.subject?.name, index);
              const year = new Date(row.createdAt).getFullYear();
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-1 items-center gap-3 px-4 py-3.5 md:grid-cols-[48px_minmax(0,1.4fr)_minmax(120px,auto)_minmax(180px,auto)]"
                >
                  <span
                    className="inline-grid size-12 shrink-0 place-items-center rounded-lg"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {subjectGlyph(row.subject?.name || row.title)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-bold text-slate-900">{row.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600">NCERT</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        Updated {year}
                      </span>
                      {row.chapter ? (
                        <span className="truncate text-slate-500">{row.chapter}</span>
                      ) : null}
                      {row.status !== "PUBLISHED" ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[row.status]}`}>
                          {row.status}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center md:justify-self-center">
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{row.chapter ? "1" : "—"}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Chapter
                      </p>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-900">{fileKindLabel(row)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Type
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 md:justify-self-end">
                    <button
                      type="button"
                      className="nx-btn-secondary !px-3 !text-[12px]"
                      onClick={() => void openRow(row.id)}
                    >
                      <VisibilityOutlined sx={{ fontSize: 15 }} /> View
                    </button>
                    {row.resourceUrl ? (
                      <a
                        href={openResourceUrl(row.resourceUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="nx-btn-primary !px-3 !text-[12px]"
                      >
                        <DownloadOutlined sx={{ fontSize: 15 }} /> Download
                      </a>
                    ) : (
                      <button type="button" className="nx-btn-primary !px-3 !text-[12px]" disabled>
                        <DownloadOutlined sx={{ fontSize: 15 }} /> Download
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
            <p className="text-[11.5px] text-slate-500">
              {(listPage - 1) * pageSize + 1} to{" "}
              {Math.min(listPage * pageSize, rows.length)} of {rows.length} books
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: listTotalPages }, (_, i) => i + 1)
                .slice(0, 7)
                .map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setListPage(page)}
                    className={`min-w-8 rounded-md px-2 py-1 text-[12px] font-semibold ${
                      page === listPage
                        ? "bg-[#534AB7] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const labManualsMain = (
    <div className="min-w-0 space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] via-[#f5f8ff] to-white">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%)]" />
        <div className="relative grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="hidden size-[72px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#dbeafe] to-[#ede9fe] text-[#534AB7] sm:grid"
              aria-hidden
            >
              <ScienceOutlined sx={{ fontSize: 34 }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold tracking-tight text-slate-900 sm:text-[19px]">
                NCERT Lab Manuals
              </h2>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-slate-600">
                Practical handbooks and experiment guides by class and subject. Open or download manuals
                from your campus library.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            {[
              { label: "Subjects", value: subjectWithResources || subjects.length },
              { label: "Manuals", value: allRows.length },
              { label: "Chapters", value: chapterCount },
              { label: "Mine", value: myManuals.length },
            ].map((item) => (
              <div key={item.label} className="min-w-0 px-3 py-3 text-center sm:px-4">
                <p className="text-[16px] font-black leading-none text-[#534AB7] sm:text-[18px]">
                  {item.value.toLocaleString("en-IN")}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(120px,150px)_minmax(140px,180px)_minmax(180px,1fr)_auto]">
          <Field label="Class">
            <select
              className="nx-input !h-[38px] !py-0 !font-semibold"
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setListPage(1);
              }}
            >
              <option value="">All Classes</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <select
              className="nx-input !h-[38px] !py-0 !font-semibold"
              value={filterSubjectId}
              onChange={(e) => {
                setFilterSubjectId(e.target.value);
                setRailSubjectId(e.target.value);
                setListPage(1);
              }}
            >
              <option value="">All Subjects</option>
              {subjects.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <div className="relative">
              <SearchOutlined
                sx={{ fontSize: 16 }}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="nx-input !h-[38px] !py-0 !pl-8"
                placeholder="Search lab manuals..."
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </div>
          </Field>
          <button
            type="button"
            className="nx-btn-secondary !h-[38px] !px-3.5 !text-[12px]"
            onClick={applyFilters}
          >
            <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12.5px]">
            <thead className="border-b border-slate-100 bg-[#fafbfd] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Manual Title</th>
                <th className="px-3 py-3 font-semibold">Subject</th>
                <th className="px-3 py-3 font-semibold">Class</th>
                <th className="px-3 py-3 font-semibold">Chapter</th>
                <th className="px-3 py-3 font-semibold">Updated On</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : listPageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <EmptyState
                      title="No lab manuals yet"
                      hint={
                        canManage
                          ? "Upload a lab manual for this class, then ask an admin to publish."
                          : "Published lab manuals for this class will appear here."
                      }
                    />
                  </td>
                </tr>
              ) : (
                listPageRows.map((row, index) => {
                  const tone = subjectTone(row.subject?.name, index);
                  return (
                    <tr key={row.id} className="hover:bg-[#fafbfe]">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="inline-grid size-10 shrink-0 place-items-center rounded-lg"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {subjectGlyph(row.subject?.name || row.title)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{row.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">
                              {row.chapter || "Practical handbook"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                          <span
                            className="inline-grid size-6 place-items-center rounded-md"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {subjectGlyph(row.subject?.name || "Science")}
                          </span>
                          {row.subject?.name || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {classNumberLabel(row.academicClass?.name)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.chapter ? "1" : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <p className="font-semibold text-slate-700">{formatUpdatedOn(row.createdAt)}</p>
                        <p className="text-[11px] text-slate-500">
                          by {row.createdBy.firstName} {row.createdBy.lastName}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className="nx-btn-secondary !px-3 !text-[12px]"
                            onClick={() => void openRow(row.id)}
                          >
                            View Manual
                          </button>
                          <button
                            type="button"
                            className="inline-grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((id) => (id === row.id ? null : row.id));
                            }}
                            aria-label="More actions"
                          >
                            <MoreVertOutlined sx={{ fontSize: 18 }} />
                          </button>
                          {openMenuId === row.id ? (
                            <div
                              className="absolute right-0 top-9 z-20 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.resourceUrl ? (
                                <a
                                  href={openResourceUrl(row.resourceUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                  onClick={() => setOpenMenuId(null)}
                                >
                                  Download / Open
                                </a>
                              ) : null}
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void openRow(row.id);
                                }}
                              >
                                View details
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
              <span>
                Showing {(listPage - 1) * pageSize + 1} to{" "}
                {Math.min(listPage * pageSize, rows.length)} of {rows.length} results
              </span>
              <label className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
                <select
                  className="nx-input !h-8 !w-auto !py-0 !text-[12px]"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setListPage(1);
                  }}
                >
                  {[8, 10, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="min-w-8 rounded-md px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                disabled={listPage <= 1}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              {Array.from({ length: listTotalPages }, (_, i) => i + 1)
                .slice(0, 7)
                .map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setListPage(page)}
                    className={`min-w-8 rounded-md px-2 py-1 text-[12px] font-semibold ${
                      page === listPage
                        ? "bg-[#534AB7] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
              <button
                type="button"
                className="min-w-8 rounded-md px-2 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                disabled={listPage >= listTotalPages}
                onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const browseByClassCard = (
    <CmsSectionCard className="!p-4 hover:!transform-none">
      <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Browse by Class</h3>
      <div className="max-h-[240px] space-y-0.5 overflow-y-auto">
        {classBrowse.length === 0 ? (
          <p className="text-[11.5px] text-slate-500">No classes configured yet.</p>
        ) : (
          classBrowse.map((row) => {
            const active = filterClassId === row.id;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setFilterClassId(active ? "" : row.id);
                  setListPage(1);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                  active ? "bg-[#ede9fe] text-[#534AB7]" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="min-w-0 truncate text-[12px] font-semibold">{row.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <span className={`text-[10.5px] ${active ? "text-[#534AB7]" : "text-slate-400"}`}>
                    {row.count}
                  </span>
                  <ChevronRightOutlined sx={{ fontSize: 14, color: active ? "#534AB7" : "#94a3b8" }} />
                </span>
              </button>
            );
          })
        )}
      </div>
      {classBrowse.length > 0 ? (
        <button
          type="button"
          className="mt-2 text-[11.5px] font-semibold text-[#534AB7] hover:underline"
          onClick={() => {
            setFilterClassId("");
            setListPage(1);
          }}
        >
          View All Classes
        </button>
      ) : null}
    </CmsSectionCard>
  );

  const labManualsRail = (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
      {browseByClassCard}

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Popular Subjects</h3>
        {popularSubjects.length === 0 ? (
          <p className="text-[11.5px] text-slate-500">Subjects appear once manuals are added.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {popularSubjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => {
                  setFilterSubjectId(subject.id);
                  setRailSubjectId(subject.id);
                  setListPage(1);
                }}
                className={`rounded-xl border p-2.5 text-left transition ${
                  filterSubjectId === subject.id
                    ? "border-[#534AB7] bg-[#f5f3ff]"
                    : "border-[#E5E7EB] bg-white hover:border-[#c7d2fe]"
                }`}
              >
                <span
                  className="mb-2 inline-grid size-8 place-items-center rounded-lg"
                  style={{ background: subject.tone.bg, color: subject.tone.fg }}
                >
                  {subjectGlyph(subject.name)}
                </span>
                <p className="truncate text-[11.5px] font-bold text-slate-900">{subject.name}</p>
                <p className="mt-0.5 text-[10.5px] text-slate-500">
                  {subject.count} {subject.count === 1 ? "manual" : "manuals"}
                </p>
              </button>
            ))}
          </div>
        )}
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Quick Links</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: "Upload Manual",
              icon: <UploadFileOutlined sx={{ fontSize: 18 }} />,
              bg: "#ede9fe",
              fg: "#534AB7",
              onClick: () => {
                if (canManage) startCreate();
                else notifyError("You do not have permission to upload manuals");
              },
            },
            {
              label: "Manage Manuals",
              icon: <EditOutlined sx={{ fontSize: 18 }} />,
              bg: "#e0f2fe",
              fg: "#0369a1",
              onClick: () => {
                setFilterSubjectId("");
                setRailSubjectId("");
                setDraftSearch("");
                setSearch("");
                setListPage(1);
              },
            },
            {
              label: "Practical List",
              icon: <ListAltOutlined sx={{ fontSize: 18 }} />,
              bg: "#dcfce7",
              fg: "#15803d",
              onClick: () => applyFilters(),
            },
            {
              label: "Download History",
              icon: <HistoryOutlined sx={{ fontSize: 18 }} />,
              bg: "#ffedd5",
              fg: "#c2410c",
              onClick: () => setView("downloads"),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="rounded-xl border border-[#E5E7EB] bg-white p-2.5 text-left transition hover:border-[#c7d2fe]"
            >
              <span
                className="mb-2 inline-grid size-8 place-items-center rounded-lg"
                style={{ background: item.bg, color: item.fg }}
              >
                {item.icon}
              </span>
              <p className="text-[11px] font-bold leading-snug text-slate-800">{item.label}</p>
            </button>
          ))}
        </div>
      </CmsSectionCard>

      {isAdmin ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <div className="mb-2 flex items-center gap-2">
            <SettingsOutlined sx={{ fontSize: 16, color: "#64748b" }} />
            <h3 className="text-[14px] font-bold text-slate-900">Settings</h3>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={teachersAllowed}
              disabled={savingSettings || settings == null}
              onChange={(e) => void toggleTeacherCreate(e.target.checked)}
            />
            <span>
              <span className="block text-[12px] font-semibold text-slate-800">
                Allow teachers to create NCERT resources
              </span>
              <span className="text-[10.5px] text-slate-500">
                Teachers still need an admin to publish or archive.
              </span>
            </span>
          </label>
        </CmsSectionCard>
      ) : null}
    </aside>
  );

  const browseMain = isBooksHome
    ? booksBrowseMain
    : isLabManuals
      ? labManualsMain
      : categoryListMain;

  const rightRail = isLabManuals ? (
    labManualsRail
  ) : (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
      {isExemplarStyle ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Filter by</h3>
          <div className="space-y-2.5">
            <Field label="Subject">
              <select
                className="nx-input !py-2 !font-semibold"
                value={railSubjectId}
                onChange={(e) => setRailSubjectId(e.target.value)}
              >
                <option value="">All Subjects</option>
                {subjects.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Book Type">
              <select
                className="nx-input !py-2 !font-semibold"
                value={category}
                onChange={(e) => setCategory(e.target.value as LibraryCategory)}
              >
                {CATEGORY_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Language">
              <select className="nx-input !py-2 !font-semibold" defaultValue="en" disabled>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Year">
              <select
                className="nx-input !py-2 !font-semibold"
                value={railYear}
                onChange={(e) => setRailYear(e.target.value)}
              >
                <option value="">All Years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              className="nx-btn-primary mt-1 w-full !px-3 !text-[12px]"
              onClick={applyRailFilters}
            >
              Apply Filters
            </button>
          </div>
        </CmsSectionCard>
      ) : (
        browseByClassCard
      )}

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">Quick Links</h3>
        <ul className="space-y-1">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="truncate">{link.label}</span>
                <OpenInNewOutlined sx={{ fontSize: 14, color: "#94a3b8" }} />
              </a>
            </li>
          ))}
        </ul>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2.5 text-[14px] font-bold text-slate-900">My Library</h3>
        <ul className="space-y-1">
          {[
            { label: "Drafts", value: stats.drafts, icon: <EditOutlined sx={{ fontSize: 16 }} /> },
            {
              label: "Recently added",
              value: allRows.length,
              icon: <MenuBookOutlined sx={{ fontSize: 16 }} />,
            },
            {
              label: "My downloads",
              value: myDownloads.length,
              icon: <DownloadOutlined sx={{ fontSize: 16 }} />,
              onClick: () => setView("downloads"),
            },
            {
              label: "Created by me",
              value: stats.mine,
              icon: <BookmarkBorderOutlined sx={{ fontSize: 16 }} />,
            },
          ].map((item) => (
            <li key={item.label}>
              <button
                type="button"
                onClick={item.onClick}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <span className="text-slate-400">{item.icon}</span>
                  {item.label}
                </span>
                <span className="text-[12px] font-bold text-slate-900">{item.value}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400">
          Saved / bookmarks sync is not available in v1 — counts above use your real library data.
        </p>
      </CmsSectionCard>

      {isAdmin ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <div className="mb-2 flex items-center gap-2">
            <SettingsOutlined sx={{ fontSize: 16, color: "#64748b" }} />
            <h3 className="text-[14px] font-bold text-slate-900">Settings</h3>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={teachersAllowed}
              disabled={savingSettings || settings == null}
              onChange={(e) => void toggleTeacherCreate(e.target.checked)}
            />
            <span>
              <span className="block text-[12px] font-semibold text-slate-800">
                Allow teachers to create NCERT resources
              </span>
              <span className="text-[10.5px] text-slate-500">
                Teachers still need an admin to publish or archive.
              </span>
            </span>
          </label>
        </CmsSectionCard>
      ) : null}
    </aside>
  );

  const resourceForm = (
    <form onSubmit={(e) => void submitForm(e)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title *">
          <input
            className="nx-input !py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={300}
          />
        </Field>
        <Field label="Category">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as LibraryCategory }))}
          >
            {CATEGORY_TABS.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chapter">
          <input
            className="nx-input !py-2"
            placeholder="e.g. Chapter 3 — Polynomials"
            value={form.chapter}
            onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))}
            maxLength={300}
          />
        </Field>
        <Field label="Class (required to publish)">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.classId}
            onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
          >
            <option value="">Select class</option>
            {classes.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.subjectId}
            onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
          >
            <option value="">No subject</option>
            {subjects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            className="nx-input !py-2 !font-semibold"
            value={form.resourceType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                resourceType: e.target.value as ResourceType,
                ...(e.target.value === "LINK" ? { fileName: "" } : {}),
              }))
            }
          >
            <option value="LINK">External link</option>
            <option value="FILE">Uploaded file</option>
          </select>
        </Field>
        {form.resourceType === "LINK" ? (
          <Field label="Resource URL (required to publish)">
            <input
              className="nx-input !py-2"
              placeholder="https://…"
              value={form.resourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, resourceUrl: e.target.value }))}
            />
          </Field>
        ) : (
          <Field label="Upload file (PDF / Office / image)">
            <input
              type="file"
              className="block w-full text-[12px]"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
            {form.resourceUrl ? (
              <p className="mt-1 truncate text-[11px] text-slate-500">
                {form.fileName || form.resourceUrl}
              </p>
            ) : null}
          </Field>
        )}
      </div>
      <Field label="Description">
        <textarea
          className="nx-input min-h-[80px] !py-2"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" className="nx-btn-primary !px-4 !text-[12px]" disabled={saving || uploading}>
          {saving ? "Saving…" : view === "edit" ? "Save changes" : "Create draft"}
        </button>
        <button
          type="button"
          className="nx-btn-secondary !px-4 !text-[12px]"
          onClick={() => {
            if (selected) setView("detail");
            else setView("browse");
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const downloadsMain = (
    <div className="min-w-0 space-y-3">
      <p className="text-[12.5px] text-slate-600">
        Files you uploaded in this library. Open or download from here.
      </p>
      {myDownloads.length === 0 ? (
        <EmptyState title="No downloads yet" hint="Uploaded PDF/Office files you create will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {myDownloads.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-sm"
            >
              <button type="button" className="min-w-0 text-left" onClick={() => void openRow(row.id)}>
                <p className="truncate text-[13px] font-bold text-slate-900">{row.title}</p>
                <p className="truncate text-[11px] text-slate-500">{row.fileName || "File"}</p>
              </button>
              <a
                href={openResourceUrl(row.resourceUrl)}
                target="_blank"
                rel="noreferrer"
                className="nx-btn-secondary !px-3 !text-[12px]"
              >
                <DownloadOutlined sx={{ fontSize: 16 }} /> Open
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const detailMain = selected ? (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[selected.status]}`}>
              {selected.status}
            </span>
            <h2 className="mt-2 text-[18px] font-bold text-slate-900">{selected.title}</h2>
            <p className="mt-1 text-[12.5px] text-slate-600">{selected.chapter || "No chapter"}</p>
            <p className="mt-2 text-[11.5px] text-slate-500">
              {[
                selected.academicClass?.name,
                selected.subject?.name,
                CATEGORY_TABS.find((t) => t.id === selected.category)?.label ?? selected.category,
                selected.resourceType,
              ]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              by {selected.createdBy.firstName} {selected.createdBy.lastName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEditSelected ? (
              <>
                <button type="button" className="nx-btn-secondary !px-3 !text-[12px]" onClick={startEdit}>
                  <EditOutlined sx={{ fontSize: 16 }} /> Edit
                </button>
                <button
                  type="button"
                  className="nx-btn-secondary !px-3 !text-[12px]"
                  onClick={() => void deleteSelected()}
                >
                  Delete
                </button>
              </>
            ) : null}
            {canPublish && selected.status === "DRAFT" ? (
              <button
                type="button"
                className="nx-btn-primary !px-3 !text-[12px]"
                onClick={() => void publishSelected()}
              >
                Publish
              </button>
            ) : null}
            {canPublish && selected.status !== "ARCHIVED" ? (
              <button
                type="button"
                className="nx-btn-secondary !px-3 !text-[12px]"
                onClick={() => void archiveSelected()}
              >
                Archive
              </button>
            ) : null}
            {selected.resourceUrl ? (
              <a
                href={openResourceUrl(selected.resourceUrl)}
                target="_blank"
                rel="noreferrer"
                className="nx-btn-primary !px-3 !text-[12px]"
              >
                Open
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">Resource</h3>
        <p className="text-[12.5px] text-slate-700">
          {selected.resourceType}
          {selected.fileName ? ` · ${selected.fileName}` : ""}
        </p>
        <p className="mt-1 break-all text-[12px] text-slate-600">
          {selected.resourceUrl || "No URL yet"}
        </p>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[13px] font-bold text-slate-900">Description</h3>
        <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-700">
          {selected.description?.trim() || "—"}
        </p>
      </CmsSectionCard>
    </div>
  ) : null;

  const headerActions =
    view !== "browse" ? (
      <button
        type="button"
        className="nx-btn-secondary !px-3 !text-[12px]"
        onClick={() => {
          setView("browse");
          setSelected(null);
        }}
      >
        <ArrowBackOutlined sx={{ fontSize: 16 }} /> Back
      </button>
    ) : isLabManuals ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="nx-btn-secondary !text-[12px]"
          onClick={() => setView("downloads")}
        >
          <MenuBookOutlined sx={{ fontSize: 16 }} /> My Manuals
          {myManuals.length > 0 ? (
            <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">
              {myManuals.length}
            </span>
          ) : null}
        </button>
        {canManage ? (
          <button type="button" className="nx-btn-primary !text-[12px]" onClick={startCreate}>
            <AddOutlined sx={{ fontSize: 16 }} /> Upload Manual
          </button>
        ) : null}
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="nx-btn-secondary !text-[12px]"
          onClick={() => setView("downloads")}
        >
          <DownloadOutlined sx={{ fontSize: 16 }} /> My Downloads
        </button>
        {canManage ? (
          <button type="button" className="nx-btn-primary !text-[12px]" onClick={startCreate}>
            <UploadFileOutlined sx={{ fontSize: 16 }} /> Upload Resource
          </button>
        ) : null}
      </div>
    );

  function selectCategory(next: LibraryCategory) {
    setCategory(next);
    setFilterSubjectId("");
    setRailSubjectId("");
    setShowAllSubjects(false);
    setOpenMenuId(null);
    setListPage(1);
    setPageSize(next === "LAB_MANUAL" ? 8 : 4);
    if (next === "BOOKS") {
      setFilterClassId("");
    }
  }

  return (
    <CmsPage>
      <div className="shrink-0">
        <CmsPageHeader
          title={isLabManuals && view === "browse" ? "Lab Manuals" : "NCERT Library"}
          description={
            <span>
              <button
                type="button"
                className="text-[#534AB7] hover:underline"
                onClick={() => {
                  selectCategory("BOOKS");
                  setView("browse");
                  setSelected(null);
                }}
              >
                Home
              </button>
              <span className="text-[#676b8f]">{" / "}</span>
              <button
                type="button"
                className={isBooksHome ? "font-semibold text-slate-700" : "text-[#534AB7] hover:underline"}
                onClick={() => {
                  selectCategory("BOOKS");
                  setView("browse");
                  setSelected(null);
                }}
              >
                NCERT Library
              </button>
              {!isBooksHome ? (
                <>
                  <span className="text-[#676b8f]">{" / "}</span>
                  <span className="font-semibold text-slate-700">{categoryLabel}</span>
                </>
              ) : null}
            </span>
          }
          actions={headerActions}
        />

        {view === "browse" ? (
          <>
            <CmsTabs>
              {CATEGORY_TABS.map((tab) => (
                <CmsTab
                  key={tab.id}
                  active={category === tab.id}
                  onClick={() => selectCategory(tab.id)}
                >
                  {tab.label}
                </CmsTab>
              ))}
            </CmsTabs>

            {isExemplarStyle && classes.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1 border-b border-slate-200 pb-0">
                <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Class
                </span>
                {classes.map((row) => {
                  const active = filterClassId === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        setFilterClassId(row.id);
                        setListPage(1);
                      }}
                      className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-semibold transition ${
                        active
                          ? "border-[#534AB7] text-[#534AB7]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {row.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <CmsScrollBody>
        <div
          className="contents"
          onClick={() => {
            if (openMenuId) setOpenMenuId(null);
          }}
        >
        {view === "browse" ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            {browseMain}
            {rightRail}
          </div>
        ) : null}
        {view === "downloads" ? downloadsMain : null}
        {view === "create" || view === "edit" ? (
          <CmsSectionCard className="!p-4 hover:!transform-none">
            <h2 className="mb-3 text-[15px] font-bold text-slate-900">
              {view === "edit"
                ? "Edit resource"
                : isLabManuals
                  ? "Upload lab manual"
                  : "New resource"}
            </h2>
            {resourceForm}
          </CmsSectionCard>
        ) : null}
        {view === "detail" ? detailMain : null}
        </div>
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
