import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArrowBackOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  CheckBoxOutlined,
  DeleteOutline,
  DescriptionOutlined,
  FilterAltOutlined,
  QuizOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, SubjectItem } from "./academics/types";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type SeriesStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type BuilderView = "browse" | "create" | "detail" | "paper";

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface DifficultyLevelConfig {
  id: string;
  name: string;
  colorTag: string;
  isActive: boolean;
}

interface QuestionTypeConfig {
  id: string;
  name: string;
  defaultMarks: string | number;
  isActive: boolean;
}

interface QuestionCategory {
  id: string;
  name: string;
  subjectId: string;
}

interface SeriesPaperSummary {
  id: string;
  title: string;
  durationMinutes: number;
  status: SeriesStatus;
  sortOrder: number;
  _count: { questions: number };
}

interface TestSeriesRow {
  id: string;
  name: string;
  description: string | null;
  status: SeriesStatus;
  createdAt: string;
  subject: NamedRef | null;
  academicClass: NamedRef | null;
  papers: SeriesPaperSummary[];
  _count: { papers: number };
  createdBy?: { id: string; firstName: string; lastName: string };
}

interface PaperQuestionLink {
  id: string;
  sortOrder: number;
  marks: string | number;
  question: {
    id: string;
    questionText: string;
    status: string;
    subject: NamedRef;
    category: NamedRef | null;
    questionType: QuestionTypeConfig;
    difficultyLevel: DifficultyLevelConfig;
  };
}

interface PaperDetail {
  id: string;
  seriesId: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  passMarks: string | number | null;
  status: SeriesStatus;
  totalMarks: number;
  questions: PaperQuestionLink[];
}

interface ListResult {
  items: TestSeriesRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface BankListResult {
  items: Array<{
    id: string;
    questionText: string;
    marks: string | number;
    subject: NamedRef;
    category: NamedRef | null;
    questionType: QuestionTypeConfig;
    difficultyLevel: DifficultyLevelConfig;
  }>;
  total: number;
}

interface TestSeriesSettings {
  allowTeachersToCreateTestSeries: boolean;
}

const statusTone: Record<SeriesStatus, string> = {
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

function StatCard({
  label,
  value,
  hint,
  icon,
  bg,
  fg,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  bg: string;
  fg: string;
}) {
  return (
    <div className="h-full rounded-xl border border-[#E5E7EB] bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="inline-grid size-11 shrink-0 place-items-center rounded-xl"
          style={{ background: bg, color: fg }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold text-slate-600">{label}</p>
          <p className="mt-0.5 text-[20px] font-black leading-none tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 truncate text-[10.5px] text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export function TestSeriesPage() {
  const { accessToken, user } = useAuth();
  const isAdmin = (user?.roles ?? []).some((r) => ["INSTITUTION_ADMIN", "STAFF"].includes(r));
  const isTeacher = (user?.roles ?? []).includes("TEACHER");
  const hasManagePerm = (user?.permissions ?? []).some((p) =>
    ["test_series.manage", "online_exam.manage"].includes(p),
  );
  const canPublish = isAdmin;
  const canManageRole = isAdmin || isTeacher;

  const [view, setView] = useState<BuilderView>("browse");
  const [loading, setLoading] = useState(true);
  const [seriesList, setSeriesList] = useState<TestSeriesRow[]>([]);
  const [selected, setSelected] = useState<TestSeriesRow | null>(null);
  const [activePaper, setActivePaper] = useState<PaperDetail | null>(null);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [types, setTypes] = useState<QuestionTypeConfig[]>([]);
  const [difficulties, setDifficulties] = useState<DifficultyLevelConfig[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);

  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState<SeriesStatus | "">("");

  const [settings, setSettings] = useState<TestSeriesSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [seriesForm, setSeriesForm] = useState({
    name: "",
    description: "",
    subjectId: "",
    classId: "",
  });
  const [paperForm, setPaperForm] = useState({
    title: "",
    durationMinutes: "60",
    passMarks: "",
    instructions: "",
  });
  const [pullForm, setPullForm] = useState({
    count: "10",
    subjectId: "",
    categoryId: "",
    difficultyLevelId: "",
    questionTypeId: "",
  });

  /** Manual pick from Question Bank */
  const [bankSearch, setBankSearch] = useState("");
  const [bankSubjectId, setBankSubjectId] = useState("");
  const [bankTypeId, setBankTypeId] = useState("");
  const [bankDifficultyId, setBankDifficultyId] = useState("");
  const [bankItems, setBankItems] = useState<BankListResult["items"]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());

  const teachersAllowed = settings?.allowTeachersToCreateTestSeries ?? false;
  const canManage = hasManagePerm && (isAdmin || (isTeacher && teachersAllowed));
  const ownsSelected =
    !!selected && (!!isAdmin || selected.createdBy?.id === user?.id);
  const canEditSelected =
    canManage && ownsSelected && selected?.status === "DRAFT";
  const canEditPaper =
    canEditSelected && activePaper?.status === "DRAFT";

  const loadSetup = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [academics, typeRows, diffRows, tsSettings] = await Promise.all([
        apiRequest<AcademicSetup>("/academics/setup", accessToken),
        apiRequest<QuestionTypeConfig[]>("/question-bank/question-types", accessToken).catch(() => []),
        apiRequest<DifficultyLevelConfig[]>("/question-bank/difficulty-levels", accessToken).catch(
          () => [],
        ),
        apiRequest<TestSeriesSettings>("/test-series/settings", accessToken).catch(() => null),
      ]);
      setSubjects(academics.subjects ?? []);
      setClasses(academics.classes ?? []);
      setTypes((typeRows ?? []).filter((row) => row.isActive));
      setDifficulties((diffRows ?? []).filter((row) => row.isActive));
      if (tsSettings) setSettings(tsSettings);
    } catch {
      // optional masters
    }
  }, [accessToken]);

  const loadSeries = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (filterSubjectId) params.set("subjectId", filterSubjectId);
      const data = await apiRequest<ListResult>(`/test-series?${params}`, accessToken);
      let items = data.items ?? [];
      if (filterClassId) {
        items = items.filter((row) => row.academicClass?.id === filterClassId);
      }
      setSeriesList(items);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load test series");
      setSeriesList([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, statusFilter, filterSubjectId, filterClassId]);

  const loadSeriesDetail = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<TestSeriesRow>(`/test-series/${id}`, accessToken);
        setSelected(data);
        setActivePaper(null);
        setView("detail");
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to open series");
      }
    },
    [accessToken],
  );

  const loadPaper = useCallback(
    async (seriesId: string, paperId: string) => {
      if (!accessToken) return;
      try {
        const data = await apiRequest<PaperDetail>(
          `/test-series/${seriesId}/papers/${paperId}`,
          accessToken,
        );
        setActivePaper(data);
        setView("paper");
        setSelectedBankIds(new Set());
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "Failed to load paper");
      }
    },
    [accessToken],
  );

  const loadCategories = useCallback(
    async (subjectId: string) => {
      if (!accessToken || !subjectId) {
        setCategories([]);
        return;
      }
      try {
        const rows = await apiRequest<QuestionCategory[]>(
          `/question-bank/categories?subjectId=${encodeURIComponent(subjectId)}`,
          accessToken,
        );
        setCategories(rows ?? []);
      } catch {
        setCategories([]);
      }
    },
    [accessToken],
  );

  const loadBankCandidates = useCallback(async () => {
    if (!accessToken) return;
    setBankLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "40",
        status: "PUBLISHED",
      });
      if (bankSearch.trim()) params.set("search", bankSearch.trim());
      if (bankSubjectId) params.set("subjectId", bankSubjectId);
      if (bankTypeId) params.set("questionTypeId", bankTypeId);
      if (bankDifficultyId) params.set("difficultyLevelId", bankDifficultyId);
      const data = await apiRequest<BankListResult>(
        `/question-bank/questions?${params}`,
        accessToken,
      );
      const linked = new Set(activePaper?.questions.map((q) => q.question.id) ?? []);
      setBankItems((data.items ?? []).filter((row) => !linked.has(row.id)));
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load Question Bank");
      setBankItems([]);
    } finally {
      setBankLoading(false);
    }
  }, [accessToken, bankSearch, bankSubjectId, bankTypeId, bankDifficultyId, activePaper]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    if (pullForm.subjectId) void loadCategories(pullForm.subjectId);
    else setCategories([]);
  }, [pullForm.subjectId, loadCategories]);

  useEffect(() => {
    if (view === "paper" && activePaper?.status === "DRAFT") {
      void loadBankCandidates();
    }
  }, [view, activePaper?.id, activePaper?.status, loadBankCandidates]);

  const kpis = useMemo(() => {
    const published = seriesList.filter((row) => row.status === "PUBLISHED").length;
    const drafts = seriesList.filter((row) => row.status === "DRAFT").length;
    const papers = seriesList.reduce((sum, row) => sum + (row._count?.papers ?? 0), 0);
    const draftPapers = seriesList.reduce(
      (sum, row) => sum + row.papers.filter((p) => p.status === "DRAFT").length,
      0,
    );
    return {
      series: seriesList.length,
      papers,
      drafts,
      published,
      draftPapers,
    };
  }, [seriesList]);

  async function onSaveSettings(next: boolean) {
    if (!accessToken || !isAdmin) return;
    setSavingSettings(true);
    try {
      const data = await apiRequest<TestSeriesSettings>("/test-series/settings", accessToken, {
        method: "PATCH",
        body: JSON.stringify({ allowTeachersToCreateTestSeries: next }),
      });
      setSettings(data);
      notifySuccess(next ? "Teachers may create test series" : "Teacher create disabled");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function onCreateSeries(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    try {
      const created = await apiRequest<TestSeriesRow>("/test-series", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: seriesForm.name,
          description: seriesForm.description || null,
          subjectId: seriesForm.subjectId || null,
          classId: seriesForm.classId || null,
        }),
      });
      notifySuccess("Test series created");
      setSeriesForm({ name: "", description: "", subjectId: "", classId: "" });
      await loadSeries();
      await loadSeriesDetail(created.id);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Create failed");
    }
  }

  async function onPublishSeries() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      await apiRequest(`/test-series/${selected.id}/publish`, accessToken, { method: "POST" });
      notifySuccess("Series published");
      await loadSeries();
      await loadSeriesDetail(selected.id);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  async function onArchiveSeries() {
    if (!accessToken || !selected || !canPublish) return;
    try {
      await apiRequest(`/test-series/${selected.id}/archive`, accessToken, { method: "POST" });
      notifySuccess("Series archived");
      await loadSeries();
      await loadSeriesDetail(selected.id);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive failed");
    }
  }

  async function onPublishPaper() {
    if (!accessToken || !selected || !activePaper || !canPublish) return;
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/publish`,
        accessToken,
        { method: "POST" },
      );
      setActivePaper(paper);
      notifySuccess("Paper published");
      await loadSeriesDetail(selected.id);
      setView("paper");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Publish paper failed");
    }
  }

  async function onArchivePaper() {
    if (!accessToken || !selected || !activePaper || !canPublish) return;
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/archive`,
        accessToken,
        { method: "POST" },
      );
      setActivePaper(paper);
      notifySuccess("Paper archived");
      await loadSeriesDetail(selected.id);
      setView("paper");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Archive paper failed");
    }
  }

  async function onUpdateLinkMarks(linkId: string, marksRaw: string) {
    if (!accessToken || !selected || !activePaper || !canEditPaper) return;
    const marks = Number(marksRaw);
    if (!Number.isFinite(marks) || marks < 0) {
      notifyError("Enter a valid marks value");
      return;
    }
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/questions/${linkId}`,
        accessToken,
        { method: "PATCH", body: JSON.stringify({ marks }) },
      );
      setActivePaper(paper);
      notifySuccess("Marks updated");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not update marks");
    }
  }

  async function onDeleteSeries(id: string) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: "Delete this test series and all its papers?" });
    if (!ok) return;
    try {
      await apiRequest(`/test-series/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Series deleted");
      setSelected(null);
      setActivePaper(null);
      setView("browse");
      await loadSeries();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function onDeletePaper() {
    if (!accessToken || !selected || !activePaper || !canEditPaper) return;
    const ok = await confirmDelete({ text: "Delete this draft paper?" });
    if (!ok) return;
    try {
      await apiRequest(`/test-series/${selected.id}/papers/${activePaper.id}`, accessToken, {
        method: "DELETE",
      });
      notifySuccess("Paper deleted");
      setActivePaper(null);
      await loadSeriesDetail(selected.id);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete paper failed");
    }
  }

  async function onCreatePaper(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !selected || !canEditSelected) return;
    try {
      const paper = await apiRequest<PaperDetail>(`/test-series/${selected.id}/papers`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          title: paperForm.title,
          durationMinutes: Number(paperForm.durationMinutes) || 60,
          passMarks: paperForm.passMarks ? Number(paperForm.passMarks) : null,
          instructions: paperForm.instructions || null,
        }),
      });
      notifySuccess("Paper added");
      setPaperForm({ title: "", durationMinutes: "60", passMarks: "", instructions: "" });
      await loadSeriesDetail(selected.id);
      await loadPaper(selected.id, paper.id);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not add paper");
    }
  }

  async function onPullFromBank(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !selected || !activePaper || !canEditPaper) return;
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/questions/from-bank`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            count: Number(pullForm.count) || 10,
            subjectId: pullForm.subjectId || undefined,
            categoryId: pullForm.categoryId || undefined,
            difficultyLevelId: pullForm.difficultyLevelId || undefined,
            questionTypeId: pullForm.questionTypeId || undefined,
          }),
        },
      );
      setActivePaper(paper);
      notifySuccess(`Quick-filled ${paper.questions.length} question(s) on paper`);
      await loadSeriesDetail(selected.id);
      setView("paper");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Pull from Question Bank failed");
    }
  }

  async function onAttachSelected() {
    if (!accessToken || !selected || !activePaper || !canEditPaper) return;
    const ids = [...selectedBankIds];
    if (!ids.length) {
      notifyError("Select at least one question");
      return;
    }
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/questions`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ questionIds: ids }),
        },
      );
      setActivePaper(paper);
      setSelectedBankIds(new Set());
      notifySuccess(`Attached ${ids.length} question(s)`);
      await loadSeriesDetail(selected.id);
      setView("paper");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Could not attach questions");
    }
  }

  async function onRemoveLink(linkId: string) {
    if (!accessToken || !selected || !activePaper || !canEditPaper) return;
    try {
      const paper = await apiRequest<PaperDetail>(
        `/test-series/${selected.id}/papers/${activePaper.id}/questions/${linkId}`,
        accessToken,
        { method: "DELETE" },
      );
      setActivePaper(paper);
      notifySuccess("Question removed from paper");
      await loadSeriesDetail(selected.id);
      setView("paper");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Remove failed");
    }
  }

  function applyFilters() {
    setSearch(draftSearch);
  }

  const browseMain = (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Series"
          value={kpis.series}
          hint="In this workspace"
          icon={<QuizOutlined sx={{ fontSize: 20 }} />}
          bg="#efeaff"
          fg="#4b2cf7"
        />
        <StatCard
          label="Total Papers"
          value={kpis.papers}
          hint="Across all series"
          icon={<DescriptionOutlined sx={{ fontSize: 20 }} />}
          bg="#e9f1ff"
          fg="#1769ff"
        />
        <StatCard
          label="Draft Series"
          value={kpis.drafts}
          hint="Not published yet"
          icon={<EditDraftIcon />}
          bg="#fff2e7"
          fg="#ff7a00"
        />
        <StatCard
          label="Published"
          value={kpis.published}
          hint="Live for campus use"
          icon={<CheckBoxOutlined sx={{ fontSize: 20 }} />}
          bg="#eaf8ef"
          fg="#11a34a"
        />
        <StatCard
          label="Draft Papers"
          value={kpis.draftPapers}
          hint="Still being built"
          icon={<AutoAwesomeOutlined sx={{ fontSize: 20 }} />}
          bg="#ffeaf4"
          fg="#f72585"
        />
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Class</span>
            <select
              className="nx-input !py-2 !font-semibold"
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
          </label>
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Subject</span>
            <select
              className="nx-input !py-2 !font-semibold"
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px] grow sm:grow-0">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Status</span>
            <select
              className="nx-input !py-2 !font-semibold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SeriesStatus | "")}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="block min-w-[200px] flex-[1.4]">
            <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">Search</span>
            <input
              className="nx-input !py-2"
              placeholder="Search series..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </label>
          <button
            type="button"
            className="nx-btn-secondary h-[38px] shrink-0 !px-3 !text-[12px]"
            onClick={applyFilters}
          >
            <FilterAltOutlined sx={{ fontSize: 16 }} /> Filter
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">Test Series</h2>
          <span className="text-[12px] text-slate-500">{seriesList.length} shown</span>
        </div>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading…</p>
        ) : seriesList.length === 0 ? (
          <EmptyState
            title="No test series yet"
            hint={
              canManage
                ? "Create a series, add papers, then pull or pick questions from the Question Bank."
                : "Series will appear here once created."
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {seriesList.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void loadSeriesDetail(row.id)}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-sm transition hover:border-[#c7d2fe]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-grid size-11 place-items-center rounded-xl bg-[#efeaff] text-[#4b2cf7]"
                  >
                    <QuizOutlined sx={{ fontSize: 22 }} />
                  </span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[row.status]}`}>
                    {row.status}
                  </span>
                </div>
                <p className="mt-3 truncate text-[14px] font-bold text-slate-900">{row.name}</p>
                <p className="mt-1 line-clamp-2 text-[11.5px] text-slate-500">
                  {row.description || "No description"}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-slate-600">
                  {row._count.papers} Papers
                  {row.subject ? ` · ${row.subject.name}` : ""}
                  {row.academicClass ? ` · ${row.academicClass.name}` : ""}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#4b2cf7]">
                  Open series <ArrowForwardOutlined sx={{ fontSize: 14 }} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const rightRail = (
    <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[14px] font-bold text-slate-900">Quick Actions</h3>
        <div>
          {canManage ? (
            <button
              type="button"
              onClick={() => setView("create")}
              className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
            >
              <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
                <AddOutlined sx={{ fontSize: 18 }} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-slate-800">Create Test Series</span>
                <span className="text-[10.5px] text-slate-500">Start a new paper pack</span>
              </span>
            </button>
          ) : null}
          <Link
            to="/question-bank"
            className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
          >
            <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
              <QuizOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-slate-800">Open Question Bank</span>
              <span className="text-[10.5px] text-slate-500">Publish questions to pull later</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void loadSeries()}
            className="flex w-full gap-3 py-2.5 text-left hover:bg-[#fafbfe]"
          >
            <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
              <FilterAltOutlined sx={{ fontSize: 18 }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-bold text-slate-800">Refresh list</span>
              <span className="text-[10.5px] text-slate-500">Reload series from server</span>
            </span>
          </button>
        </div>
      </CmsSectionCard>

      <CmsSectionCard className="!p-4 hover:!transform-none">
        <h3 className="mb-2 text-[14px] font-bold text-slate-900">Distribution</h3>
        <div className="space-y-2.5 text-[11px]">
          {[
            ["Published series", kpis.published, "#11a34a"],
            ["Draft series", kpis.drafts, "#ff7a00"],
            ["Total papers", kpis.papers, "#1769ff"],
            ["Draft papers", kpis.draftPapers, "#f72585"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-slate-700">
                <span className="size-2 rounded-full" style={{ background: String(color) }} />
                {label}
              </span>
              <span className="font-semibold text-slate-800">{value as number}</span>
            </div>
          ))}
        </div>
      </CmsSectionCard>

      {isAdmin ? (
        <CmsSectionCard className="!p-4 hover:!transform-none">
          <div className="mb-2 flex items-center gap-2">
            <SettingsOutlined sx={{ fontSize: 18 }} className="text-[#4b2cf7]" />
            <h3 className="text-[14px] font-bold text-slate-900">Teacher access</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Separate from Question Bank. Teachers need this toggle on to create series and edit their
            own drafts.
          </p>
          <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="text-[12px] font-semibold text-slate-800">
              Allow teachers to create test series
            </span>
            <input
              type="checkbox"
              className="size-4"
              disabled={savingSettings || settings == null}
              checked={teachersAllowed}
              onChange={(e) => void onSaveSettings(e.target.checked)}
            />
          </label>
        </CmsSectionCard>
      ) : null}

      {isTeacher && !teachersAllowed && canManageRole ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900">
          Teacher create is disabled. Ask an administrator to enable{" "}
          <strong>Allow teachers to create test series</strong>.
        </div>
      ) : null}
    </aside>
  );

  return (
    <CmsPage>
      <CmsPageHeader
        title="Test Series"
        description={
          <span>
            <span className="text-[#4b2cf7]">Home</span>
            <span className="text-[#676b8f]">{" / Test Series"}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {view !== "browse" ? (
              <button
                type="button"
                className="nx-btn-secondary !text-[12px]"
                onClick={() => {
                  setView("browse");
                  setActivePaper(null);
                  if (view === "create") setSelected(null);
                }}
              >
                <ArrowBackOutlined sx={{ fontSize: 16 }} /> Back
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="nx-btn-primary !text-[12px]"
                onClick={() => setView("create")}
              >
                <AddOutlined sx={{ fontSize: 16 }} /> Create Test
              </button>
            ) : null}
          </div>
        }
      />

      <CmsScrollBody>
        {view === "browse" ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            {browseMain}
            {rightRail}
          </div>
        ) : null}

        {view === "create" ? (
          <CmsSectionCard className="!p-4 max-w-2xl">
            <h2 className="text-[15px] font-bold text-slate-900">Create Test Series</h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Teacher paper-builder — add papers next, then attach published Question Bank items.
            </p>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateSeries}>
              <input
                className="nx-input sm:col-span-2"
                required
                placeholder="Series name"
                value={seriesForm.name}
                onChange={(e) => setSeriesForm((p) => ({ ...p, name: e.target.value }))}
              />
              <textarea
                className="nx-input sm:col-span-2 min-h-[72px]"
                placeholder="Description (optional)"
                value={seriesForm.description}
                onChange={(e) => setSeriesForm((p) => ({ ...p, description: e.target.value }))}
              />
              <select
                className="nx-input"
                value={seriesForm.subjectId}
                onChange={(e) => setSeriesForm((p) => ({ ...p, subjectId: e.target.value }))}
              >
                <option value="">Any subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="nx-input"
                value={seriesForm.classId}
                onChange={(e) => setSeriesForm((p) => ({ ...p, classId: e.target.value }))}
              >
                <option value="">Any class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="nx-btn-primary sm:col-span-2 !text-[12px]" disabled={!canManage}>
                Create series
              </button>
            </form>
          </CmsSectionCard>
        ) : null}

        {view === "detail" && selected ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-4">
              <CmsSectionCard className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[16px] font-bold text-slate-900">{selected.name}</h2>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[selected.status]}`}>
                        {selected.status}
                      </span>
                    </div>
                    {selected.description ? (
                      <p className="mt-1 text-[12px] text-slate-500">{selected.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {selected.subject?.name ?? "Any subject"}
                      {selected.academicClass ? ` · ${selected.academicClass.name}` : ""}
                      {selected.createdBy
                        ? ` · by ${selected.createdBy.firstName} ${selected.createdBy.lastName}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canPublish && selected.status === "DRAFT" ? (
                      <button type="button" className="nx-btn-primary !text-[12px]" onClick={() => void onPublishSeries()}>
                        Publish series
                      </button>
                    ) : null}
                    {canPublish && selected.status !== "ARCHIVED" ? (
                      <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => void onArchiveSeries()}>
                        Archive
                      </button>
                    ) : null}
                    {canEditSelected ? (
                      <button
                        type="button"
                        className="nx-btn-secondary !text-[12px] !text-rose-600"
                        onClick={() => void onDeleteSeries(selected.id)}
                      >
                        <DeleteOutline sx={{ fontSize: 16 }} /> Delete
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="mb-2 text-[13px] font-bold text-slate-900">Papers</h3>
                  {selected.papers.length === 0 ? (
                    <p className="text-[12px] text-slate-500">No papers yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selected.papers.map((paper) => (
                        <button
                          key={paper.id}
                          type="button"
                          onClick={() => void loadPaper(selected.id, paper.id)}
                          className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left hover:border-[#c7d2fe]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13px] font-bold text-slate-900">{paper.title}</p>
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[paper.status]}`}>
                              {paper.status}
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">
                            {paper._count.questions} questions · {paper.durationMinutes} min
                          </p>
                          <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#4b2cf7]">
                            Open paper <ArrowForwardOutlined sx={{ fontSize: 14 }} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {canEditSelected ? (
                  <form
                    className="mt-4 grid gap-2 border-t border-[#E5E7EB] pt-4 sm:grid-cols-2"
                    onSubmit={onCreatePaper}
                  >
                    <p className="sm:col-span-2 text-[12px] font-semibold text-slate-700">Add paper</p>
                    <input
                      className="nx-input sm:col-span-2"
                      required
                      placeholder="Paper title"
                      value={paperForm.title}
                      onChange={(e) => setPaperForm((p) => ({ ...p, title: e.target.value }))}
                    />
                    <input
                      className="nx-input"
                      type="number"
                      min={1}
                      placeholder="Duration (min)"
                      value={paperForm.durationMinutes}
                      onChange={(e) => setPaperForm((p) => ({ ...p, durationMinutes: e.target.value }))}
                    />
                    <input
                      className="nx-input"
                      type="number"
                      min={0}
                      placeholder="Pass marks (optional)"
                      value={paperForm.passMarks}
                      onChange={(e) => setPaperForm((p) => ({ ...p, passMarks: e.target.value }))}
                    />
                    <button type="submit" className="nx-btn-secondary sm:col-span-2 !text-[12px]">
                      <AddOutlined sx={{ fontSize: 16 }} /> Add paper
                    </button>
                  </form>
                ) : null}
              </CmsSectionCard>
            </div>
            {rightRail}
          </div>
        ) : null}

        {view === "paper" && selected && activePaper ? (
          <div className="space-y-4">
            <CmsSectionCard className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <button
                    type="button"
                    className="mb-1 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setActivePaper(null);
                      setView("detail");
                    }}
                  >
                    <ArrowBackOutlined sx={{ fontSize: 14 }} /> Back to {selected.name}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-bold text-slate-900">{activePaper.title}</h2>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[activePaper.status]}`}>
                      {activePaper.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {activePaper.questions.length} questions · {activePaper.totalMarks} marks ·{" "}
                    {activePaper.durationMinutes} min
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canPublish && activePaper.status === "DRAFT" ? (
                    <button type="button" className="nx-btn-primary !text-[12px]" onClick={() => void onPublishPaper()}>
                      Publish paper
                    </button>
                  ) : null}
                  {canPublish && activePaper.status !== "ARCHIVED" ? (
                    <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => void onArchivePaper()}>
                      Archive paper
                    </button>
                  ) : null}
                  {canEditPaper ? (
                    <button
                      type="button"
                      className="nx-btn-secondary !text-[12px] !text-rose-600"
                      onClick={() => void onDeletePaper()}
                    >
                      <DeleteOutline sx={{ fontSize: 16 }} /> Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </CmsSectionCard>

            {canEditPaper ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <CmsSectionCard className="!p-4">
                  <h3 className="text-[14px] font-bold text-slate-900">Manual pick from Question Bank</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Filter published bank questions, select, then attach. Content is linked — not copied.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className="nx-input sm:col-span-2"
                      placeholder="Search questions..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadBankCandidates();
                      }}
                    />
                    <select
                      className="nx-input"
                      value={bankSubjectId}
                      onChange={(e) => setBankSubjectId(e.target.value)}
                    >
                      <option value="">All subjects</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="nx-input"
                      value={bankTypeId}
                      onChange={(e) => setBankTypeId(e.target.value)}
                    >
                      <option value="">All types</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="nx-input"
                      value={bankDifficultyId}
                      onChange={(e) => setBankDifficultyId(e.target.value)}
                    >
                      <option value="">All difficulty</option>
                      {difficulties.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="nx-btn-secondary !text-[12px]"
                      onClick={() => void loadBankCandidates()}
                    >
                      <FilterAltOutlined sx={{ fontSize: 16 }} /> Search bank
                    </button>
                  </div>

                  <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
                    {bankLoading ? (
                      <p className="py-6 text-center text-[12px] text-slate-500">Loading bank…</p>
                    ) : bankItems.length === 0 ? (
                      <p className="py-6 text-center text-[12px] text-slate-500">
                        No published questions match (or all already on this paper).
                      </p>
                    ) : (
                      bankItems.map((q) => {
                        const checked = selectedBankIds.has(q.id);
                        return (
                          <label
                            key={q.id}
                            className="flex cursor-pointer gap-2 rounded-lg border border-slate-100 px-2 py-2 hover:bg-[#fafbfe]"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => {
                                setSelectedBankIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(q.id)) next.delete(q.id);
                                  else next.add(q.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-[12px] font-medium text-slate-800">
                                {q.questionText}
                              </span>
                              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                                {q.subject.name} · {q.questionType.name} · {q.difficultyLevel.name} ·{" "}
                                {q.marks} marks
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    className="nx-btn-primary mt-3 w-full justify-center !text-[12px]"
                    disabled={!selectedBankIds.size}
                    onClick={() => void onAttachSelected()}
                  >
                    Attach selected ({selectedBankIds.size})
                  </button>
                </CmsSectionCard>

                <CmsSectionCard className="!p-4">
                  <h3 className="text-[14px] font-bold text-slate-900">Quick fill (filter + count)</h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Randomly pull N published questions matching filters. Use alongside manual pick.
                  </p>
                  <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={onPullFromBank}>
                    <input
                      className="nx-input"
                      type="number"
                      min={1}
                      max={100}
                      value={pullForm.count}
                      onChange={(e) => setPullForm((p) => ({ ...p, count: e.target.value }))}
                      placeholder="Count"
                    />
                    <select
                      className="nx-input"
                      value={pullForm.subjectId}
                      onChange={(e) =>
                        setPullForm((p) => ({ ...p, subjectId: e.target.value, categoryId: "" }))
                      }
                    >
                      <option value="">Any subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="nx-input"
                      value={pullForm.categoryId}
                      onChange={(e) => setPullForm((p) => ({ ...p, categoryId: e.target.value }))}
                      disabled={!pullForm.subjectId}
                    >
                      <option value="">Any chapter</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="nx-input"
                      value={pullForm.difficultyLevelId}
                      onChange={(e) =>
                        setPullForm((p) => ({ ...p, difficultyLevelId: e.target.value }))
                      }
                    >
                      <option value="">Any difficulty</option>
                      {difficulties.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="nx-input sm:col-span-2"
                      value={pullForm.questionTypeId}
                      onChange={(e) => setPullForm((p) => ({ ...p, questionTypeId: e.target.value }))}
                    >
                      <option value="">Any type</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="nx-btn-secondary sm:col-span-2 !text-[12px]">
                      <AutoAwesomeOutlined sx={{ fontSize: 16 }} /> Pull from bank
                    </button>
                  </form>
                </CmsSectionCard>
              </div>
            ) : null}

            <CmsSectionCard className="!p-4">
              <h3 className="mb-3 text-[14px] font-bold text-slate-900">Questions on this paper</h3>
              {activePaper.questions.length === 0 ? (
                <EmptyState
                  title="No questions on this paper"
                  hint="Use manual pick or quick fill. Only published Question Bank items can be linked."
                />
              ) : (
                <div className="space-y-2">
                  {activePaper.questions.map((link, index) => (
                    <div
                      key={link.id}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-slate-400">
                            Q{index + 1} · {link.question.questionType.name} ·{" "}
                            {link.question.difficultyLevel.name}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-800">
                            {link.question.questionText}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canEditPaper ? (
                            <label className="flex items-center gap-1 text-[11px] text-slate-500">
                              Marks
                              <input
                                className="nx-input !h-8 !w-16 !px-2 !text-[12px]"
                                type="number"
                                min={0}
                                step="0.25"
                                defaultValue={Number(link.marks)}
                                onBlur={(e) => {
                                  if (String(Number(link.marks)) === e.target.value.trim()) return;
                                  void onUpdateLinkMarks(link.id, e.target.value);
                                }}
                              />
                            </label>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500">
                              {link.marks} marks
                            </span>
                          )}
                          {canEditPaper ? (
                            <button
                              type="button"
                              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => void onRemoveLink(link.id)}
                              aria-label="Remove question"
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}

function EditDraftIcon() {
  return <DescriptionOutlined sx={{ fontSize: 20 }} />;
}
