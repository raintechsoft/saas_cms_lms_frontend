import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArchiveOutlined,
  CategoryOutlined,
  CheckCircleOutline,
  DeleteOutline,
  EditOutlined,
  LibraryBooksOutlined,
  QuizOutlined,
  RefreshOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { AcademicSetup, ClassItem, SubjectItem } from "./academics/types";
import {
  CmsFooter,
  CmsKpiCard,
  CmsKpiGrid,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { ListPagination } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type Tab = "questions" | "create" | "categories";
type QuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface QuestionCategory {
  id: string;
  name: string;
  subjectId: string;
  parentCategoryId: string | null;
  subject: NamedRef;
  subCategories: Array<{ id: string; name: string }>;
}

interface QuestionBankSettings {
  allowTeachersToAddQuestions: boolean;
}

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

interface QuestionTypeConfig {
  id: string;
  name: string;
  defaultMarks: string | number;
  isActive: boolean;
}

interface DifficultyLevelConfig {
  id: string;
  name: string;
  colorTag: string;
  isActive: boolean;
}

interface QuestionOption {
  id?: string;
  optionText: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface BankQuestion {
  id: string;
  status: QuestionStatus;
  questionText: string;
  explanation: string | null;
  marks: string | number;
  negativeMarks: string | number | null;
  tags: string[];
  createdAt: string;
  subject: NamedRef;
  academicClass: NamedRef | null;
  category: NamedRef | null;
  questionType: QuestionTypeConfig;
  difficultyLevel: DifficultyLevelConfig;
  options: QuestionOption[];
  createdBy?: { id: string; firstName: string; lastName: string };
}

interface ListResult {
  items: BankQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

interface OptionDraft {
  optionText: string;
  isCorrect: boolean;
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "questions", label: "All Questions", shortLabel: "List", icon: LibraryBooksOutlined, tone: "indigo" },
  { key: "create", label: "Create / Edit", shortLabel: "Form", icon: AddOutlined, tone: "violet" },
  { key: "categories", label: "Categories", shortLabel: "Cats", icon: CategoryOutlined, tone: "sky" },
];

const PAGE_SIZE = 10;
const ADMIN_ROLES = new Set(["INSTITUTION_ADMIN", "STAFF"]);

function typeNeedsOptions(name: string) {
  return /mcq|true\s*\/?\s*false|multiple\s*choice|matching/i.test(name);
}

function statusBadge(status: QuestionStatus) {
  if (status === "PUBLISHED") {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (status === "ARCHIVED") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function defaultOptions(): OptionDraft[] {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

export function QuestionBankPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("questions");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeConfig[]>([]);
  const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevelConfig[]>([]);

  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterDifficultyId, setFilterDifficultyId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | "">("");
  const [search, setSearch] = useState("");

  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [categorySubjectId, setCategorySubjectId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [allowTeachersToAddQuestions, setAllowTeachersToAddQuestions] = useState(false);

  const [list, setList] = useState<ListResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    draft: 0,
    published: 0,
    archived: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [questionTypeId, setQuestionTypeId] = useState("");
  const [difficultyLevelId, setDifficultyLevelId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [explanation, setExplanation] = useState("");
  const [marks, setMarks] = useState("");
  const [negativeMarks, setNegativeMarks] = useState("");
  const [tags, setTags] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(defaultOptions());
  const [editStatus, setEditStatus] = useState<QuestionStatus>("DRAFT");

  const hasManagePermission = user?.permissions.includes("question_bank.manage") ?? false;
  const isAdmin = user?.roles.some((role) => ADMIN_ROLES.has(role)) ?? false;
  const isTeacher = user?.roles.includes("TEACHER") ?? false;
  const isTeacherOnly = isTeacher && !isAdmin;
  const canManage =
    hasManagePermission && (isAdmin || !isTeacherOnly || allowTeachersToAddQuestions);

  const selectedType = useMemo(
    () => questionTypes.find((row) => row.id === questionTypeId) ?? null,
    [questionTypes, questionTypeId],
  );
  const showOptions = selectedType ? typeNeedsOptions(selectedType.name) : false;

  const formCategories = useMemo(
    () => categories.filter((row) => row.subjectId === subjectId),
    [categories, subjectId],
  );

  const filterCategories = useMemo(() => {
    if (!filterSubjectId) return categories;
    return categories.filter((row) => row.subjectId === filterSubjectId);
  }, [categories, filterSubjectId]);

  const counts = statusCounts;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setEditStatus("DRAFT");
    setSubjectId(subjects[0]?.id ?? "");
    setClassId("");
    setCategoryId("");
    setQuestionTypeId(questionTypes[0]?.id ?? "");
    setDifficultyLevelId(difficultyLevels[0]?.id ?? "");
    setQuestionText("");
    setExplanation("");
    setMarks(questionTypes[0] ? String(questionTypes[0].defaultMarks) : "1");
    setNegativeMarks("");
    setTags("");
    setOptions(defaultOptions());
  }, [subjects, questionTypes, difficultyLevels]);

  const loadMasters = useCallback(async () => {
    if (!accessToken) return;
    const [setup, types, levels, settings] = await Promise.all([
      apiRequest<AcademicSetup>("/academics/setup", accessToken),
      apiRequest<QuestionTypeConfig[]>("/question-bank/question-types", accessToken),
      apiRequest<DifficultyLevelConfig[]>("/question-bank/difficulty-levels", accessToken),
      apiRequest<QuestionBankSettings>("/question-bank/settings", accessToken),
    ]);
    setSubjects(setup.subjects.filter((s) => s.isActive !== false));
    setClasses(setup.classes);
    setQuestionTypes(types);
    setDifficultyLevels(levels);
    setAllowTeachersToAddQuestions(settings.allowTeachersToAddQuestions);
    return { setup, types, levels, settings };
  }, [accessToken]);

  const loadCategories = useCallback(
    async (subjectIdFilter?: string) => {
      if (!accessToken) return;
      const params = subjectIdFilter ? `?subjectId=${encodeURIComponent(subjectIdFilter)}` : "";
      const data = await apiRequest<QuestionCategory[]>(
        `/question-bank/categories${params}`,
        accessToken,
      );
      setCategories(data);
      return data;
    },
    [accessToken],
  );

  const loadStatusCounts = useCallback(async () => {
    if (!accessToken) return;
    const base = "/question-bank/questions?page=1&pageSize=1";
    const [all, draft, published, archived] = await Promise.all([
      apiRequest<ListResult>(base, accessToken),
      apiRequest<ListResult>(`${base}&status=DRAFT`, accessToken),
      apiRequest<ListResult>(`${base}&status=PUBLISHED`, accessToken),
      apiRequest<ListResult>(`${base}&status=ARCHIVED`, accessToken),
    ]);
    setStatusCounts({
      total: all.total,
      draft: draft.total,
      published: published.total,
      archived: archived.total,
    });
  }, [accessToken]);

  const loadQuestions = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (filterSubjectId) params.set("subjectId", filterSubjectId);
    if (filterTypeId) params.set("questionTypeId", filterTypeId);
    if (filterDifficultyId) params.set("difficultyLevelId", filterDifficultyId);
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterStatus) params.set("status", filterStatus);
    if (search.trim()) params.set("search", search.trim());
    const data = await apiRequest<ListResult>(
      `/question-bank/questions?${params.toString()}`,
      accessToken,
    );
    setList(data);
  }, [
    accessToken,
    page,
    filterSubjectId,
    filterTypeId,
    filterDifficultyId,
    filterCategoryId,
    filterStatus,
    search,
  ]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await loadMasters();
      await Promise.all([loadQuestions(), loadStatusCounts(), loadCategories()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load question bank");
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadMasters, loadQuestions, loadStatusCounts, loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!categorySubjectId && subjects.length) {
      setCategorySubjectId(subjects[0]!.id);
    }
  }, [categorySubjectId, subjects]);

  useEffect(() => {
    if (categorySubjectId) {
      void loadCategories(categorySubjectId);
    }
  }, [categorySubjectId, loadCategories]);

  useEffect(() => {
    if (subjectId) {
      void loadCategories(subjectId);
    }
  }, [subjectId, loadCategories]);

  useEffect(() => {
    if (!editingId && subjects.length && questionTypes.length && difficultyLevels.length) {
      if (!subjectId) setSubjectId(subjects[0]!.id);
      if (!questionTypeId) {
        setQuestionTypeId(questionTypes[0]!.id);
        setMarks(String(questionTypes[0]!.defaultMarks));
      }
      if (!difficultyLevelId) setDifficultyLevelId(difficultyLevels[0]!.id);
    }
  }, [editingId, subjects, questionTypes, difficultyLevels, subjectId, questionTypeId, difficultyLevelId]);

  useEffect(() => {
    if (selectedType && !marks) {
      setMarks(String(selectedType.defaultMarks));
    }
  }, [selectedType, marks]);

  function startCreate() {
    resetForm();
    setTab("create");
  }

  async function startEdit(id: string) {
    if (!accessToken) return;
    try {
      const q = await apiRequest<BankQuestion>(`/question-bank/questions/${id}`, accessToken);
      setEditingId(q.id);
      setEditStatus(q.status);
      setSubjectId(q.subject.id);
      setClassId(q.academicClass?.id ?? "");
      setCategoryId(q.category?.id ?? "");
      setQuestionTypeId(q.questionType.id);
      setDifficultyLevelId(q.difficultyLevel.id);
      setQuestionText(q.questionText);
      setExplanation(q.explanation ?? "");
      setMarks(String(q.marks));
      setNegativeMarks(q.negativeMarks != null ? String(q.negativeMarks) : "");
      setTags(q.tags.join(", "));
      setOptions(
        q.options.length
          ? q.options.map((o) => ({ optionText: o.optionText, isCorrect: o.isCorrect }))
          : defaultOptions(),
      );
      setTab("create");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load question");
    }
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !accessToken) return;
    if (!subjectId || !questionTypeId || !difficultyLevelId || !questionText.trim()) {
      notifyError("Subject, type, difficulty, and question text are required");
      return;
    }

    const payload: Record<string, unknown> = {
      subjectId,
      classId: classId || null,
      categoryId: categoryId || null,
      questionTypeId,
      difficultyLevelId,
      questionText: questionText.trim(),
      explanation: explanation.trim() || null,
      marks: Number(marks) || 0,
      negativeMarks: negativeMarks ? Number(negativeMarks) : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (showOptions) {
      const cleaned = options
        .map((o, idx) => ({
          optionText: o.optionText.trim(),
          isCorrect: o.isCorrect,
          sortOrder: idx,
        }))
        .filter((o) => o.optionText);
      if (cleaned.length < 2) {
        notifyError("Choice questions need at least two options");
        return;
      }
      payload.options = cleaned;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/question-bank/questions/${editingId}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        notifySuccess("Question updated");
      } else {
        await apiRequest("/question-bank/questions", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Question saved as draft");
      }
      resetForm();
      setTab("questions");
      await Promise.all([loadQuestions(), loadStatusCounts()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save question");
    } finally {
      setSubmitting(false);
    }
  }

  async function publishQuestion(id: string) {
    if (!isAdmin || !accessToken) return;
    setSubmitting(true);
    try {
      await apiRequest(`/question-bank/questions/${id}/publish`, accessToken, { method: "POST" });
      notifySuccess("Question published");
      if (editingId === id) setEditStatus("PUBLISHED");
      await Promise.all([loadQuestions(), loadStatusCounts()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to publish");
    } finally {
      setSubmitting(false);
    }
  }

  async function archiveQuestion(id: string) {
    if (!isAdmin || !accessToken) return;
    setSubmitting(true);
    try {
      await apiRequest(`/question-bank/questions/${id}/archive`, accessToken, { method: "POST" });
      notifySuccess("Question archived");
      if (editingId === id) setEditStatus("ARCHIVED");
      await Promise.all([loadQuestions(), loadStatusCounts()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to archive");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!canManage || !accessToken) return;
    const ok = await confirmDelete({
      title: "Delete draft question?",
      text: "This soft-deletes the question. It cannot be undone from the UI.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/question-bank/questions/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Question deleted");
      if (editingId === id) {
        resetForm();
        setTab("questions");
      }
      await Promise.all([loadQuestions(), loadStatusCounts()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete");
    }
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { optionText: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function resetCategoryForm() {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryParentId("");
  }

  function startEditCategory(
    id: string,
    name: string,
    subjectIdValue: string,
    parentCategoryId: string | null,
  ) {
    setEditingCategoryId(id);
    setCategorySubjectId(subjectIdValue);
    setCategoryName(name);
    setCategoryParentId(parentCategoryId ?? "");
    setTab("categories");
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !accessToken || !categorySubjectId || !categoryName.trim()) return;
    setSubmitting(true);
    try {
      if (editingCategoryId) {
        await apiRequest(`/question-bank/categories/${editingCategoryId}`, accessToken, {
          method: "PATCH",
          body: JSON.stringify({
            name: categoryName.trim(),
            parentCategoryId: categoryParentId || null,
          }),
        });
        notifySuccess("Category updated");
      } else {
        await apiRequest("/question-bank/categories", accessToken, {
          method: "POST",
          body: JSON.stringify({
            subjectId: categorySubjectId,
            name: categoryName.trim(),
            parentCategoryId: categoryParentId || null,
          }),
        });
        notifySuccess("Category created");
      }
      resetCategoryForm();
      await loadCategories(categorySubjectId);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save category");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCategory(id: string, name: string) {
    if (!canManage || !accessToken) return;
    const ok = await confirmDelete({
      title: "Delete category?",
      text: `Remove "${name}" from the question bank?`,
    });
    if (!ok) return;
    try {
      await apiRequest(`/question-bank/categories/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Category deleted");
      if (editingCategoryId === id) resetCategoryForm();
      await loadCategories(categorySubjectId);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete category");
    }
  }

  const categoryParentsForForm = useMemo(
    () => categories.filter((row) => row.subjectId === categorySubjectId),
    [categories, categorySubjectId],
  );

  return (
    <CmsPage>
      <CmsPageHeader
        title="Question Bank"
        description="Create and manage questions for Examination and Test Series."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/erp/question-bank-settings" className="nx-btn-secondary !text-[12px]">
              ERP Settings
            </Link>
            {canManage ? (
              <button type="button" className="nx-btn-primary" onClick={startCreate}>
                <AddOutlined sx={{ fontSize: 16 }} /> New Question
              </button>
            ) : null}
            <button type="button" className="nx-btn-secondary" onClick={() => void load()} disabled={loading}>
              <RefreshOutlined sx={{ fontSize: 16 }} />
            </button>
          </div>
        }
      />

      <CmsScrollBody>
        <CmsKpiGrid>
          <CmsKpiCard label="Total" value={String(counts.total)} icon={<QuizOutlined sx={{ fontSize: 20 }} />} tint="#6366f1" />
          <CmsKpiCard label="Draft" value={String(counts.draft)} icon={<EditOutlined sx={{ fontSize: 20 }} />} tint="#f59e0b" />
          <CmsKpiCard
            label="Published"
            value={String(counts.published)}
            icon={<CheckCircleOutline sx={{ fontSize: 20 }} />}
            tint="#10b981"
          />
          <CmsKpiCard label="Archived" value={String(counts.archived)} icon={<ArchiveOutlined sx={{ fontSize: 20 }} />} tint="#64748b" />
        </CmsKpiGrid>

        <CmsIconTabs items={TABS} value={tab} onChange={setTab} columnsClass="grid-cols-3 max-w-2xl" />

        {isTeacherOnly && !allowTeachersToAddQuestions ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Question entry is disabled for teachers. You can browse questions, but creating or
            editing requires your administrator to enable{" "}
            <strong>Allow Teachers to Add Questions</strong> in ERP Settings.
          </div>
        ) : null}

        {tab === "questions" ? (
          <CmsSectionCard>
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <span className="nx-label">Search</span>
                <input
                  className="nx-input w-full"
                  placeholder="Question text…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <span className="nx-label">Subject</span>
                <select
                  className="nx-input w-full"
                  value={filterSubjectId}
                  onChange={(e) => {
                    setFilterSubjectId(e.target.value);
                    setFilterCategoryId("");
                    setPage(1);
                  }}
                >
                  <option value="">All subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="nx-label">Type</span>
                <select
                  className="nx-input w-full"
                  value={filterTypeId}
                  onChange={(e) => {
                    setFilterTypeId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All types</option>
                  {questionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="nx-label">Difficulty</span>
                <select
                  className="nx-input w-full"
                  value={filterDifficultyId}
                  onChange={(e) => {
                    setFilterDifficultyId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All levels</option>
                  {difficultyLevels.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="nx-label">Category</span>
                <select
                  className="nx-input w-full"
                  value={filterCategoryId}
                  onChange={(e) => {
                    setFilterCategoryId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All categories</option>
                  {filterCategories.map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name} (all)</option>
                      {parent.subCategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {parent.name} → {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <span className="nx-label">Status</span>
                <select
                  className="nx-input w-full"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as QuestionStatus | "");
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="py-10 text-center text-sm text-slate-500">Loading questions…</p>
            ) : list.items.length === 0 ? (
              <EmptyState
                icon={<LibraryBooksOutlined />}
                title="No questions yet"
                hint={canManage ? "Create your first question to get started." : "Questions will appear here once added."}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="nx-table w-full min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Question</th>
                        <th>Subject</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th>Difficulty</th>
                        <th>Marks</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.items.map((q) => (
                        <tr key={q.id}>
                          <td className="max-w-xs">
                            <p className="line-clamp-2 text-[13px] font-medium text-slate-800">
                              {q.questionText}
                            </p>
                            {q.academicClass ? (
                              <p className="text-[11px] text-slate-500">{q.academicClass.name}</p>
                            ) : null}
                          </td>
                          <td className="text-[12px]">{q.subject.name}</td>
                          <td className="text-[12px] text-slate-600">{q.category?.name ?? "—"}</td>
                          <td className="text-[12px]">{q.questionType.name}</td>
                          <td>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: `${q.difficultyLevel.colorTag}22`,
                                color: q.difficultyLevel.colorTag,
                              }}
                            >
                              {q.difficultyLevel.name}
                            </span>
                          </td>
                          <td className="text-[12px]">{q.marks}</td>
                          <td>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusBadge(q.status)}`}
                            >
                              {q.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex justify-end gap-1">
                              {canManage ? (
                                <button
                                  type="button"
                                  className="nx-icon-btn"
                                  title="Edit"
                                  onClick={() => void startEdit(q.id)}
                                >
                                  <EditOutlined sx={{ fontSize: 16 }} />
                                </button>
                              ) : null}
                              {isAdmin && q.status === "DRAFT" ? (
                                <button
                                  type="button"
                                  className="nx-icon-btn text-emerald-700"
                                  title="Publish"
                                  onClick={() => void publishQuestion(q.id)}
                                >
                                  <CheckCircleOutline sx={{ fontSize: 16 }} />
                                </button>
                              ) : null}
                              {isAdmin && q.status === "PUBLISHED" ? (
                                <button
                                  type="button"
                                  className="nx-icon-btn"
                                  title="Archive"
                                  onClick={() => void archiveQuestion(q.id)}
                                >
                                  <ArchiveOutlined sx={{ fontSize: 16 }} />
                                </button>
                              ) : null}
                              {canManage && q.status === "DRAFT" ? (
                                <button
                                  type="button"
                                  className="nx-icon-btn text-rose-600"
                                  title="Delete"
                                  onClick={() => void deleteQuestion(q.id)}
                                >
                                  <DeleteOutline sx={{ fontSize: 16 }} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ListPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={list.total}
                  onPageChange={setPage}
                />
              </>
            )}
          </CmsSectionCard>
        ) : tab === "create" ? (
          <CmsSectionCard>
            {!canManage ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {isTeacherOnly && !allowTeachersToAddQuestions
                  ? "Question entry is disabled for teachers. Contact your administrator."
                  : "You do not have permission to create or edit questions."}
              </p>
            ) : (
              <form onSubmit={saveQuestion} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-slate-900">
                    {editingId ? "Edit question" : "New question"}
                  </h2>
                  {editingId ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${statusBadge(editStatus)}`}
                    >
                      {editStatus}
                    </span>
                  ) : (
                    <span className="text-[12px] text-slate-500">Saves as DRAFT</span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span className="nx-label">Subject *</span>
                    <select
                      className="nx-input w-full"
                      value={subjectId}
                      onChange={(e) => {
                        setSubjectId(e.target.value);
                        setCategoryId("");
                      }}
                      required
                    >
                      <option value="">Select subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="nx-label">Class (optional)</span>
                    <select
                      className="nx-input w-full"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      <option value="">All classes</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="nx-label">Category (optional)</span>
                    <select
                      className="nx-input w-full"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">No category</option>
                      {formCategories.map((parent) => (
                        <optgroup key={parent.id} label={parent.name}>
                          <option value={parent.id}>{parent.name}</option>
                          {parent.subCategories.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {parent.name} → {sub.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="nx-label">Question type *</span>
                    <select
                      className="nx-input w-full"
                      value={questionTypeId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setQuestionTypeId(id);
                        const t = questionTypes.find((row) => row.id === id);
                        if (t) setMarks(String(t.defaultMarks));
                      }}
                      required
                    >
                      {questionTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (default {t.defaultMarks} marks)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="nx-label">Difficulty *</span>
                    <select
                      className="nx-input w-full"
                      value={difficultyLevelId}
                      onChange={(e) => setDifficultyLevelId(e.target.value)}
                      required
                    >
                      {difficultyLevels.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="nx-label">Marks *</span>
                    <input
                      className="nx-input w-full"
                      type="number"
                      min="0"
                      step="0.5"
                      value={marks}
                      onChange={(e) => setMarks(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <span className="nx-label">Negative marks</span>
                    <input
                      className="nx-input w-full"
                      type="number"
                      min="0"
                      step="0.25"
                      value={negativeMarks}
                      onChange={(e) => setNegativeMarks(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span className="nx-label">Question text *</span>
                  <textarea
                    className="nx-input min-h-[120px] w-full"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <span className="nx-label">Explanation (optional)</span>
                  <textarea
                    className="nx-input min-h-[80px] w-full"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                  />
                </div>

                <div>
                  <span className="nx-label">Tags (comma-separated)</span>
                  <input
                    className="nx-input w-full"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="algebra, chapter-5"
                  />
                </div>

                {showOptions ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-slate-800">Answer options</span>
                      <button type="button" className="nx-btn-secondary !py-1 !text-[12px]" onClick={addOption}>
                        Add option
                      </button>
                    </div>
                    <div className="space-y-2">
                      {options.map((opt, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-2.5"
                            checked={opt.isCorrect}
                            onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
                            title="Correct answer"
                          />
                          <input
                            className="nx-input flex-1"
                            placeholder={`Option ${idx + 1}`}
                            value={opt.optionText}
                            onChange={(e) => updateOption(idx, { optionText: e.target.value })}
                          />
                          {options.length > 2 ? (
                            <button
                              type="button"
                              className="nx-icon-btn text-rose-600"
                              onClick={() => removeOption(idx)}
                            >
                              <DeleteOutline sx={{ fontSize: 16 }} />
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="submit" className="nx-btn-primary" disabled={submitting}>
                    {submitting ? "Saving…" : editingId ? "Update question" : "Save as draft"}
                  </button>
                  <button
                    type="button"
                    className="nx-btn-secondary"
                    onClick={() => {
                      resetForm();
                      setTab("questions");
                    }}
                  >
                    Cancel
                  </button>
                  {editingId && isAdmin && editStatus === "DRAFT" ? (
                    <button
                      type="button"
                      className="nx-btn-secondary !border-emerald-300 !text-emerald-800"
                      disabled={submitting}
                      onClick={() => void publishQuestion(editingId)}
                    >
                      Publish
                    </button>
                  ) : null}
                  {editingId && isAdmin && editStatus === "PUBLISHED" ? (
                    <button
                      type="button"
                      className="nx-btn-secondary"
                      disabled={submitting}
                      onClick={() => void archiveQuestion(editingId)}
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </CmsSectionCard>
        ) : (
          <CmsSectionCard>
            {!canManage ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {isTeacherOnly && !allowTeachersToAddQuestions
                  ? "Category management is disabled for teachers. Contact your administrator."
                  : "You do not have permission to manage categories."}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-[200px] flex-1">
                    <span className="nx-label">Subject</span>
                    <select
                      className="nx-input w-full max-w-xs"
                      value={categorySubjectId}
                      onChange={(e) => {
                        setCategorySubjectId(e.target.value);
                        resetCategoryForm();
                      }}
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <form
                  onSubmit={saveCategory}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4"
                >
                  <div>
                    <span className="nx-label">Category name *</span>
                    <input
                      className="nx-input w-full"
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="e.g. Algebra"
                      required
                    />
                  </div>
                  <div>
                    <span className="nx-label">Parent category</span>
                    <select
                      className="nx-input w-full"
                      value={categoryParentId}
                      onChange={(e) => setCategoryParentId(e.target.value)}
                      disabled={Boolean(editingCategoryId && categoryParentId)}
                    >
                      <option value="">Top-level category</option>
                      {categoryParentsForForm
                        .filter((row) => row.id !== editingCategoryId)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {submitting
                        ? "Saving…"
                        : editingCategoryId
                          ? "Update category"
                          : "Add category"}
                    </button>
                    {editingCategoryId ? (
                      <button
                        type="button"
                        className="nx-btn-secondary"
                        onClick={resetCategoryForm}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>

                {loading ? (
                  <p className="py-8 text-center text-sm text-slate-500">Loading categories…</p>
                ) : categoryParentsForForm.length === 0 ? (
                  <EmptyState
                    icon={<CategoryOutlined />}
                    title="No categories yet"
                    hint="Add a top-level category for this subject to organize questions."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="nx-table w-full min-w-[560px]">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Subcategories</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryParentsForForm.map((parent) => (
                          <tr key={parent.id}>
                            <td className="text-[13px] font-semibold text-slate-800">{parent.name}</td>
                            <td className="text-[12px] text-slate-600">
                              {parent.subCategories.length
                                ? parent.subCategories.map((sub) => sub.name).join(", ")
                                : "—"}
                            </td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="nx-icon-btn"
                                  title="Edit"
                                  onClick={() =>
                                    startEditCategory(parent.id, parent.name, parent.subjectId, null)
                                  }
                                >
                                  <EditOutlined sx={{ fontSize: 16 }} />
                                </button>
                                <button
                                  type="button"
                                  className="nx-icon-btn text-rose-600"
                                  title="Delete"
                                  onClick={() => void deleteCategory(parent.id, parent.name)}
                                >
                                  <DeleteOutline sx={{ fontSize: 16 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {categoryParentsForForm.flatMap((parent) =>
                          parent.subCategories.map((sub) => (
                            <tr key={sub.id} className="bg-slate-50/60">
                              <td className="pl-8 text-[12px] text-slate-700">
                                ↳ {sub.name}
                              </td>
                              <td className="text-[12px] text-slate-500">under {parent.name}</td>
                              <td>
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    className="nx-icon-btn"
                                    title="Edit"
                                    onClick={() =>
                                      startEditCategory(
                                        sub.id,
                                        sub.name,
                                        parent.subjectId,
                                        parent.id,
                                      )
                                    }
                                  >
                                    <EditOutlined sx={{ fontSize: 16 }} />
                                  </button>
                                  <button
                                    type="button"
                                    className="nx-icon-btn text-rose-600"
                                    title="Delete"
                                    onClick={() => void deleteCategory(sub.id, sub.name)}
                                  >
                                    <DeleteOutline sx={{ fontSize: 16 }} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CmsSectionCard>
        )}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
