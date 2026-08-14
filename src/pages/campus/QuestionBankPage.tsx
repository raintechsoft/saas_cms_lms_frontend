import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArchiveOutlined,
  ArrowForwardOutlined,
  CheckCircleOutline,
  ComputerOutlined,
  CreateOutlined,
  DeleteOutline,
  DescriptionOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterAltOutlined,
  InsertDriveFileOutlined,
  LanguageOutlined,
  MoreVert,
  QuizOutlined,
  ScienceOutlined,
  ShareOutlined,
  VisibilityOutlined,
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
import { ListPagination } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type View = "browse" | "create" | "categories" | "import";
type QuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface ImportFailure {
  row: number;
  message: string;
  questionText?: string;
}

interface ImportResult {
  created: number;
  failed: number;
  failures: ImportFailure[];
}

interface NamedRef {
  id: string;
  name: string;
  code?: string | null;
}

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

interface DashboardStats {
  total: number;
  myQuestions: number;
  byType: Array<{ id: string; name: string; count: number }>;
  byDifficulty: Array<{ id: string; name: string; colorTag: string; count: number }>;
  bySubject: Array<{ id: string; name: string; questionCount: number; chapterCount: number }>;
  topTopics: Array<{ id: string; name: string; subjectName: string; count: number }>;
}

interface OptionDraft {
  optionText: string;
  isCorrect: boolean;
}

const PAGE_SIZE = 8;
const ADMIN_ROLES = new Set(["INSTITUTION_ADMIN", "STAFF"]);
const SUBJECT_STYLES = [
  { bg: "#efeaff", fg: "#4b2cf7" },
  { bg: "#eaf8ef", fg: "#11a34a" },
  { bg: "#fff2e7", fg: "#ff7a00" },
  { bg: "#ffeaf4", fg: "#f72585" },
  { bg: "#e9f1ff", fg: "#1769ff" },
  { bg: "#efeaff", fg: "#5a37f4" },
];

function subjectGlyph(name: string): ReactNode {
  const n = name.toLowerCase();
  if (/math|mathematics|algebra/.test(n)) return <span className="text-[22px] font-black leading-none">×÷</span>;
  if (/science|physics|chem|bio/.test(n)) return <ScienceOutlined sx={{ fontSize: 22 }} />;
  if (/social|history|civics|geography/.test(n)) return <LanguageOutlined sx={{ fontSize: 22 }} />;
  if (/english/.test(n)) return <span className="text-[18px] font-black leading-none">Aa</span>;
  if (/hindi|sanskrit/.test(n)) return <span className="text-[18px] font-black leading-none">अ</span>;
  if (/computer|it|coding/.test(n)) return <ComputerOutlined sx={{ fontSize: 22 }} />;
  return <QuizOutlined sx={{ fontSize: 22 }} />;
}

function typeNeedsOptions(name: string) {
  return /mcq|true\s*\/?\s*false|multiple\s*choice|matching/i.test(name);
}

function typePillStyle(name: string): { bgcolor: string; color: string } {
  if (/mcq|multiple/i.test(name)) return { bgcolor: "#e5f8f0", color: "#173b5f" };
  if (/long/i.test(name)) return { bgcolor: "#e9f1ff", color: "#173b5f" };
  if (/short/i.test(name)) return { bgcolor: "#fff0df", color: "#173b5f" };
  return { bgcolor: "#efeaff", color: "#173b5f" };
}

function difficultyPillStyle(name: string): { bgcolor: string; color: string } {
  if (/easy/i.test(name)) return { bgcolor: "#e4f7ef", color: "#3b455f" };
  if (/hard/i.test(name)) return { bgcolor: "#ffe7ea", color: "#d72a37" };
  return { bgcolor: "#fff0df", color: "#3b455f" };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function personName(person?: { firstName: string; lastName: string } | null) {
  if (!person) return "Unknown";
  return `${person.firstName} ${person.lastName}`.trim();
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function defaultOptions(): OptionDraft[] {
  return [
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
    { optionText: "", isCorrect: false },
  ];
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
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

function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[10.5px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function QuestionImportPanel({
  accessToken,
  onDone,
  onBack,
}: {
  accessToken: string;
  onDone: () => Promise<void>;
  onBack: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const rowEstimate = useMemo(() => {
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return Math.max(0, lines.length - (lines.length ? 1 : 0));
  }, [csv]);

  async function downloadTemplate() {
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
      const response = await fetch(`${API_URL}/question-bank/questions/import-template`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error("Unable to download template");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "question_bank_import_template.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to download template");
    }
  }

  async function runImport() {
    if (csv.trim().length < 10) {
      notifyError("Paste or upload CSV content first");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const next = await apiRequest<ImportResult>("/question-bank/questions/import", accessToken, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setResult(next);
      if (next.created > 0) {
        notifySuccess(
          `${next.created} question${next.created === 1 ? "" : "s"} imported as draft` +
            (next.failed ? ` · ${next.failed} row${next.failed === 1 ? "" : "s"} failed` : ""),
        );
        await onDone();
      } else if (next.failed) {
        notifyError(`No questions imported · ${next.failed} row${next.failed === 1 ? "" : "s"} failed`);
      } else {
        notifyError("No rows were imported");
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to import questions");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      notifyError("Please upload a .CSV file (save Excel as CSV)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError("CSV must be 2MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Bulk Import Questions</h2>
          <p className="text-[12px] text-slate-500">
            Upload a CSV matching the template. Rows become Draft questions via the same create rules as manual entry.
            Max 500 rows. Subject, type, and difficulty must already exist (matched by name).
          </p>
        </div>
        <button type="button" className="nx-btn-secondary !text-[12px]" onClick={onBack}>
          Back to bank
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CmsSectionCard className="!p-4">
          <h3 className="text-[14px] font-bold text-slate-900">Upload CSV</h3>
          <p className="mt-1 text-[12px] text-slate-500">
            Required columns:{" "}
            <span className="font-semibold text-slate-700">
              subject, question_type, difficulty, question_text
            </span>
            . Optional: class, chapter, marks, options, correct_option (1–4 or A–D).
          </p>

          <button
            type="button"
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left hover:border-indigo-300"
            onClick={() => void downloadTemplate()}
          >
            <span className="inline-grid size-10 place-items-center rounded-lg bg-white text-[#4b2cf7] shadow-sm">
              <DownloadOutlined sx={{ fontSize: 20 }} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-slate-800">Download Template</span>
              <span className="block text-[11px] text-slate-500">Official CSV header + sample rows</span>
            </span>
          </button>

          <label
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center ${
              dragOver ? "border-indigo-400 bg-indigo-50/70" : "border-slate-300 bg-slate-50/70"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <InsertDriveFileOutlined sx={{ fontSize: 28 }} className="text-[#4b2cf7]" />
            <p className="mt-2 text-[13px] font-semibold text-slate-700">Click or drop CSV here</p>
            <p className="mt-1 text-[11px] text-slate-500">.CSV only · max 2MB · 500 rows</p>
          </label>

          {fileName ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-700">{fileName}</p>
                <p className="text-[11px] text-slate-400">
                  {rowEstimate.toLocaleString()} data row{rowEstimate === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                className="text-[12px] font-semibold text-rose-600"
                onClick={() => {
                  setCsv("");
                  setFileName("");
                  setResult(null);
                }}
              >
                Remove
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="nx-btn-primary mt-4 w-full justify-center"
            disabled={busy || csv.trim().length < 10}
            onClick={() => void runImport()}
          >
            {busy ? "Importing…" : "Import Questions"}
          </button>
        </CmsSectionCard>

        <CmsSectionCard className="!p-4">
          <h3 className="text-[14px] font-bold text-slate-900">Paste CSV</h3>
          <p className="mt-1 text-[12px] text-slate-500">Or paste raw CSV content below.</p>
          <textarea
            className="nx-input mt-3 min-h-[260px] font-mono text-[11px] leading-relaxed"
            placeholder={
              "subject,question_type,difficulty,question_text,option_1,option_2,option_3,option_4,correct_option\nMathematics,MCQ,Medium,What is 2+2?,3,4,5,6,2"
            }
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              if (fileName) setFileName("");
              setResult(null);
            }}
          />
        </CmsSectionCard>
      </div>

      {result ? (
        <CmsSectionCard className="!p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-slate-900">Import results</h3>
            <p className="text-[12px] text-slate-600">
              <span className="font-semibold text-emerald-700">{result.created} created</span>
              {" · "}
              <span className="font-semibold text-rose-600">{result.failed} failed</span>
            </p>
          </div>
          {result.failures.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead className="bg-[#fbfcff] text-[10.5px] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-bold">Row</th>
                    <th className="px-3 py-2 font-bold">Question</th>
                    <th className="px-3 py-2 font-bold">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failures.map((failure) => (
                    <tr key={`${failure.row}-${failure.message}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-700">{failure.row}</td>
                      <td className="max-w-[280px] px-3 py-2 text-slate-600">
                        <span className="line-clamp-2">{failure.questionText || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-rose-600">{failure.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-slate-500">All rows imported successfully as drafts.</p>
          )}
        </CmsSectionCard>
      ) : null}
    </div>
  );
}

export function QuestionBankPage() {
  const { accessToken, user } = useAuth();
  const [view, setView] = useState<View>("browse");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<BankQuestion | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionTypeConfig[]>([]);
  const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevelConfig[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [filterClassId, setFilterClassId] = useState("");
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDifficultyId, setFilterDifficultyId] = useState("");
  const [filterStatus, setFilterStatus] = useState<QuestionStatus | "">("");
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");

  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [categorySubjectId, setCategorySubjectId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [allowTeachersToAddQuestions, setAllowTeachersToAddQuestions] = useState(false);

  const [list, setList] = useState<ListResult>({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
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

  const typeHighlight = useMemo(() => {
    const rows = stats?.byType ?? [];
    const find = (re: RegExp) => rows.find((row) => re.test(row.name));
    return {
      mcq: find(/mcq|multiple/i),
      short: find(/short/i),
      long: find(/long/i),
    };
  }, [stats]);

  const distribution = useMemo(() => {
    const palette = ["#0aa06e", "#ff8a00", "#1769ff", "#5a37f4", "#f72585", "#11a34a"];
    const rows = (stats?.byType ?? [])
      .filter((row) => row.count > 0)
      .map((row, index) => ({
        ...row,
        color: palette[index % palette.length]!,
        share: pct(row.count, stats?.total ?? 0),
      }));
    const totalCount = stats?.total ?? 0;
    let cursor = 0;
    const stops = rows.map((row) => {
      const start = cursor;
      const end = totalCount ? cursor + (row.count / totalCount) * 100 : cursor;
      cursor = end;
      return `${row.color} ${start}% ${end}%`;
    });
    return {
      rows,
      gradient: stops.length
        ? `conic-gradient(${stops.join(", ")})`
        : "conic-gradient(#edf0f8 0 100%)",
    };
  }, [stats]);

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
    },
    [accessToken],
  );

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    const data = await apiRequest<DashboardStats>("/question-bank/stats", accessToken);
    setStats(data);
  }, [accessToken]);

  const loadQuestions = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (filterClassId) params.set("classId", filterClassId);
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
    filterClassId,
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
      await Promise.all([loadQuestions(), loadStats(), loadCategories()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load question bank");
    } finally {
      setLoading(false);
    }
  }, [accessToken, loadMasters, loadQuestions, loadStats, loadCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!categorySubjectId && subjects.length) setCategorySubjectId(subjects[0]!.id);
  }, [categorySubjectId, subjects]);

  useEffect(() => {
    if (categorySubjectId) void loadCategories(categorySubjectId);
  }, [categorySubjectId, loadCategories]);

  useEffect(() => {
    if (subjectId) void loadCategories(subjectId);
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

  function applyFilters() {
    setSearch(draftSearch);
    setPage(1);
  }

  function startCreate() {
    resetForm();
    setViewing(null);
    setView("create");
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
      setViewing(null);
      setView("create");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load question");
    }
  }

  async function openView(id: string) {
    if (!accessToken) return;
    try {
      const q = await apiRequest<BankQuestion>(`/question-bank/questions/${id}`, accessToken);
      setViewing(q);
      setMenuOpenId(null);
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
      setView("browse");
      await Promise.all([loadQuestions(), loadStats()]);
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
      setMenuOpenId(null);
      await Promise.all([loadQuestions(), loadStats()]);
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
      setMenuOpenId(null);
      await Promise.all([loadQuestions(), loadStats()]);
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
        setView("browse");
      }
      setMenuOpenId(null);
      await Promise.all([loadQuestions(), loadStats()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete");
    }
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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
      setEditingCategoryId(null);
      setCategoryName("");
      setCategoryParentId("");
      await Promise.all([loadCategories(categorySubjectId), loadStats()]);
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
      if (editingCategoryId === id) {
        setEditingCategoryId(null);
        setCategoryName("");
      }
      await Promise.all([loadCategories(categorySubjectId), loadStats()]);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete category");
    }
  }

  const total = stats?.total ?? 0;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Question Bank"
        description={
          <span>
            <span className="text-[#4b2cf7]">Home</span>
            <span className="text-[#676b8f]">{" / Question Bank"}</span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="nx-btn-secondary !text-[12px]"
              onClick={() => {
                if (!canManage) {
                  notifyError("You do not have permission to import questions");
                  return;
                }
                setView("import");
              }}
            >
              <DownloadOutlined sx={{ fontSize: 16 }} /> Import Questions
            </button>
            {canManage ? (
              <button type="button" className="nx-btn-primary !text-[12px]" onClick={startCreate}>
                <AddOutlined sx={{ fontSize: 16 }} /> Add Question
              </button>
            ) : null}
          </div>
        }
      />

      <CmsScrollBody>
        {isTeacherOnly && !allowTeachersToAddQuestions ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Question entry is disabled for teachers. Ask an administrator to enable{" "}
            <strong>Allow Teachers to Add Questions</strong> in ERP Settings.
          </div>
        ) : null}

        {view === "browse" ? (
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
                <StatCard
                  label="Total Questions"
                  value={total.toLocaleString("en-IN")}
                  hint="Across all subjects"
                  icon={<QuizOutlined sx={{ fontSize: 20 }} />}
                  bg="#efeaff"
                  fg="#4b2cf7"
                />
                <StatCard
                  label="MCQ"
                  value={(typeHighlight.mcq?.count ?? 0).toLocaleString("en-IN")}
                  hint={`${pct(typeHighlight.mcq?.count ?? 0, total)}%`}
                  icon={<DescriptionOutlined sx={{ fontSize: 20 }} />}
                  bg="#eaf8ef"
                  fg="#11a34a"
                />
                <StatCard
                  label="Short Answer"
                  value={(typeHighlight.short?.count ?? 0).toLocaleString("en-IN")}
                  hint={`${pct(typeHighlight.short?.count ?? 0, total)}%`}
                  icon={<CreateOutlined sx={{ fontSize: 20 }} />}
                  bg="#fff2e7"
                  fg="#ff7a00"
                />
                <StatCard
                  label="Long Answer"
                  value={(typeHighlight.long?.count ?? 0).toLocaleString("en-IN")}
                  hint={`${pct(typeHighlight.long?.count ?? 0, total)}%`}
                  icon={<InsertDriveFileOutlined sx={{ fontSize: 20 }} />}
                  bg="#e9f1ff"
                  fg="#1769ff"
                />
                <StatCard
                  label="My Questions"
                  value={(stats?.myQuestions ?? 0).toLocaleString("en-IN")}
                  hint="Created by you"
                  icon={<CheckCircleOutline sx={{ fontSize: 20 }} />}
                  bg="#ffeaf4"
                  fg="#f72585"
                />
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                  <FilterField label="Class" className="w-[140px] grow sm:grow-0">
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
                  </FilterField>
                  <FilterField label="Subject" className="w-[140px] grow sm:grow-0">
                    <select
                      className="nx-input !py-2 !font-semibold"
                      value={filterSubjectId}
                      onChange={(e) => {
                        setFilterSubjectId(e.target.value);
                        setFilterCategoryId("");
                      }}
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Chapter" className="w-[150px] grow sm:grow-0">
                    <select
                      className="nx-input !py-2 !font-semibold"
                      value={filterCategoryId}
                      onChange={(e) => setFilterCategoryId(e.target.value)}
                    >
                      <option value="">All Chapters</option>
                      {filterCategories.map((parent) => (
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
                  </FilterField>
                  <FilterField label="Question Type" className="w-[140px] grow sm:grow-0">
                    <select
                      className="nx-input !py-2 !font-semibold"
                      value={filterTypeId}
                      onChange={(e) => setFilterTypeId(e.target.value)}
                    >
                      <option value="">All Types</option>
                      {questionTypes.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </FilterField>
                  <FilterField label="Search" className="min-w-[200px] flex-[1.4]">
                    <input
                      className="nx-input !py-2"
                      placeholder="Search questions..."
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyFilters();
                      }}
                    />
                  </FilterField>
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
                  <h2 className="text-[15px] font-bold text-slate-900">Browse by Subject</h2>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#4b2cf7] hover:underline"
                    onClick={() => {
                      setFilterSubjectId("");
                      setPage(1);
                    }}
                  >
                    View All Subjects <ArrowForwardOutlined sx={{ fontSize: 14 }} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
                  {(stats?.bySubject ?? []).slice(0, 6).map((subject, index) => {
                    const tone = SUBJECT_STYLES[index % SUBJECT_STYLES.length]!;
                    return (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => {
                          setFilterSubjectId(subject.id);
                          setDraftSearch("");
                          setSearch("");
                          setPage(1);
                        }}
                        className={`flex min-h-[132px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left shadow-sm transition hover:border-[#c7d2fe] ${
                          filterSubjectId === subject.id ? "ring-2 ring-[#4b2cf7]/30" : ""
                        }`}
                      >
                        <span
                          className="mb-2.5 inline-grid size-11 place-items-center rounded-xl"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          {subjectGlyph(subject.name)}
                        </span>
                        <p className="truncate text-[13px] font-bold text-slate-900">{subject.name}</p>
                        <p className="mt-auto pt-2 text-[11px] text-slate-600">
                          {subject.questionCount.toLocaleString("en-IN")} Questions
                        </p>
                        <p className="text-[11px] text-slate-500">{subject.chapterCount} Chapters</p>
                      </button>
                    );
                  })}
                  {!stats?.bySubject?.length ? (
                    <div className="col-span-full rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-8 text-center text-[12px] text-slate-500">
                      Subjects appear here once questions exist in the bank.
                    </div>
                  ) : null}
                </div>
              </div>

              <CmsSectionCard className="!p-0 overflow-hidden !shadow-sm hover:!transform-none">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <h2 className="text-[14px] font-bold text-slate-900">Recently Added Questions</h2>
                  <div className="flex items-center gap-2">
                    <select
                      className="nx-input !h-8 !w-auto !py-1 !text-[12px]"
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
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[#4b2cf7] hover:underline"
                      onClick={() => {
                        setFilterSubjectId("");
                        setFilterCategoryId("");
                        setFilterTypeId("");
                        setFilterClassId("");
                        setDraftSearch("");
                        setSearch("");
                        setPage(1);
                      }}
                    >
                      View All
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p className="py-12 text-center text-sm text-slate-500">Loading questions…</p>
                ) : list.items.length === 0 ? (
                  <EmptyState
                    title="No questions found"
                    hint={canManage ? "Add your first question or widen the filters." : "Questions will appear once published."}
                  />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-left">
                        <thead className="bg-[#fbfcff] text-[10.5px]">
                          <tr>
                            {["Question", "Subject", "Type", "Difficulty", "Added On", "Actions"].map(
                              (heading) => (
                                <th
                                  key={heading}
                                  className={`px-3 py-2.5 font-bold text-slate-600 ${
                                    heading === "Actions" ? "text-right" : ""
                                  }`}
                                >
                                  {heading}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {list.items.map((q) => {
                            const typeStyle = typePillStyle(q.questionType.name);
                            const diffStyle = difficultyPillStyle(q.difficultyLevel.name);
                            return (
                              <tr key={q.id} className="border-t border-slate-100 text-[11.5px] hover:bg-[#fbfcff]">
                                <td className="max-w-[280px] px-3 py-2.5 font-semibold text-slate-800">
                                  <p className="line-clamp-2">{q.questionText}</p>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <div className="font-semibold text-slate-800">{q.subject.name}</div>
                                  <div className="mt-0.5 text-[10.5px] text-[#575b87]">
                                    {q.category?.name ?? "Uncategorized"}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className="inline-flex h-[22px] items-center rounded-full px-2 text-[10.5px] font-semibold"
                                    style={typeStyle}
                                  >
                                    {q.questionType.name}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className="inline-flex h-[22px] items-center rounded-full px-2 text-[10.5px] font-semibold"
                                    style={diffStyle}
                                  >
                                    {q.difficultyLevel.name}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <div className="font-semibold text-slate-800">{formatDate(q.createdAt)}</div>
                                  <div className="text-[10px] text-[#666b8f]">by {personName(q.createdBy)}</div>
                                </td>
                                <td className="relative px-3 py-2.5">
                                  <div className="flex justify-end gap-0.5">
                                    <button
                                      type="button"
                                      className="nx-icon-btn"
                                      title="View"
                                      onClick={() => void openView(q.id)}
                                    >
                                      <VisibilityOutlined sx={{ fontSize: 17 }} />
                                    </button>
                                    {canManage ? (
                                      <button
                                        type="button"
                                        className="nx-icon-btn"
                                        title="Edit"
                                        onClick={() => void startEdit(q.id)}
                                      >
                                        <EditOutlined sx={{ fontSize: 17 }} />
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="nx-icon-btn"
                                      title="More"
                                      onClick={() =>
                                        setMenuOpenId((current) => (current === q.id ? null : q.id))
                                      }
                                    >
                                      <MoreVert sx={{ fontSize: 17 }} />
                                    </button>
                                  </div>
                                  {menuOpenId === q.id ? (
                                    <div className="absolute right-3 top-10 z-10 w-40 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                      {isAdmin && q.status === "DRAFT" ? (
                                        <button
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                          onClick={() => void publishQuestion(q.id)}
                                        >
                                          Publish
                                        </button>
                                      ) : null}
                                      {isAdmin && q.status === "PUBLISHED" ? (
                                        <button
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                          onClick={() => void archiveQuestion(q.id)}
                                        >
                                          Archive
                                        </button>
                                      ) : null}
                                      {canManage && q.status === "DRAFT" ? (
                                        <button
                                          type="button"
                                          className="block w-full px-3 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-50"
                                          onClick={() => void deleteQuestion(q.id)}
                                        >
                                          Delete
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        className="block w-full px-3 py-2 text-left text-[12px] hover:bg-slate-50"
                                        onClick={() => setMenuOpenId(null)}
                                      >
                                        Close
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <ListPagination
                        page={list.page}
                        pageSize={list.pageSize}
                        total={list.total}
                        onPageChange={setPage}
                      />
                    </div>
                  </>
                )}
              </CmsSectionCard>
            </div>

            <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
              <CmsSectionCard className="!p-4 hover:!transform-none">
                <h3 className="mb-2 text-[14px] font-bold text-slate-900">Quick Actions</h3>
                <div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={startCreate}
                      className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
                    >
                      <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
                        <AddOutlined sx={{ fontSize: 18 }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-bold text-slate-800">Add New Question</span>
                        <span className="text-[10.5px] text-slate-500">Create a new question</span>
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (!canManage) {
                        notifyError("You do not have permission to import questions");
                        return;
                      }
                      setView("import");
                    }}
                    className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
                  >
                    <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
                      <DownloadOutlined sx={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-slate-800">Import from File</span>
                      <span className="text-[10.5px] text-slate-500">Upload questions in bulk</span>
                    </span>
                  </button>
                  <Link
                    to="/test-series"
                    className="flex w-full gap-3 border-b border-slate-100 py-2.5 text-left hover:bg-[#fafbfe]"
                  >
                    <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
                      <DescriptionOutlined sx={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-slate-800">Create Question Paper</span>
                      <span className="text-[10.5px] text-slate-500">Use questions to build paper</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView("categories")}
                    className="flex w-full gap-3 py-2.5 text-left hover:bg-[#fafbfe]"
                  >
                    <span className="inline-grid size-9 shrink-0 place-items-center rounded-lg bg-[#efeaff] text-[#4b2cf7]">
                      <ShareOutlined sx={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-slate-800">Manage Chapters</span>
                      <span className="text-[10.5px] text-slate-500">Organize subject chapters</span>
                    </span>
                  </button>
                </div>
              </CmsSectionCard>

              <CmsSectionCard className="!p-4 hover:!transform-none">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-slate-900">Question Distribution</h3>
                  <button type="button" className="shrink-0 text-[10px] font-semibold text-[#4b2cf7] hover:underline">
                    View Report
                  </button>
                </div>
                {distribution.rows.length ? (
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
                    <div
                      className="flex size-28 shrink-0 items-center justify-center rounded-full"
                      style={{ background: distribution.gradient }}
                    >
                      <div className="flex size-20 flex-col items-center justify-center rounded-full bg-white text-center">
                        <b className="text-[13px]">{total.toLocaleString("en-IN")}</b>
                        <span className="text-[10px] text-slate-500">Total</span>
                      </div>
                    </div>
                    <div className="w-full min-w-0 flex-1 space-y-2.5">
                      {distribution.rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                          <span className="flex min-w-0 items-center gap-2 text-slate-700">
                            <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                            <span className="truncate">{row.name}</span>
                          </span>
                          <span className="shrink-0 text-slate-600">
                            {row.share}% ({row.count.toLocaleString("en-IN")})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="py-6 text-center text-[12px] text-slate-500">No distribution yet.</p>
                )}
              </CmsSectionCard>

              <CmsSectionCard className="!p-4 hover:!transform-none">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-slate-900">Difficulty Level</h3>
                  <button type="button" className="shrink-0 text-[10px] font-semibold text-[#4b2cf7] hover:underline">
                    View Report
                  </button>
                </div>
                <div className="space-y-3">
                  {(stats?.byDifficulty ?? []).map((row) => {
                    const share = pct(row.count, total);
                    const bar =
                      /easy/i.test(row.name)
                        ? "#11a34a"
                        : /hard/i.test(row.name)
                          ? "#f33"
                          : row.colorTag || "#ff9800";
                    return (
                      <div key={row.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 text-[10.5px]">
                        <span className="truncate text-slate-700">{row.name}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-[#edf0f8]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(share, 100)}%`, backgroundColor: bar }}
                          />
                        </div>
                        <span className="whitespace-nowrap text-right text-slate-600">
                          {row.count.toLocaleString("en-IN")} ({share}%)
                        </span>
                      </div>
                    );
                  })}
                  {!stats?.byDifficulty?.length ? (
                    <p className="text-[12px] text-slate-500">No difficulty data yet.</p>
                  ) : null}
                </div>
              </CmsSectionCard>

              <CmsSectionCard className="!p-4 hover:!transform-none">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-slate-900">My Top Topics</h3>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] font-semibold text-[#4b2cf7] hover:underline"
                    onClick={() => setView("categories")}
                  >
                    View All
                  </button>
                </div>
                <div>
                  {(stats?.topTopics ?? []).map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => {
                        setFilterCategoryId(topic.id);
                        setPage(1);
                      }}
                      className="flex w-full items-center justify-between gap-2 py-2 text-left text-[11px] hover:bg-[#fafbfe]"
                    >
                      <span className="min-w-0 truncate text-slate-800">{topic.name}</span>
                      <span className="shrink-0 text-[#4f5681]">{topic.count} ›</span>
                    </button>
                  ))}
                  {!stats?.topTopics?.length ? (
                    <p className="py-4 text-center text-[12px] text-slate-500">
                      Topics appear after chapters have questions.
                    </p>
                  ) : null}
                </div>
              </CmsSectionCard>
            </aside>
          </div>
        ) : null}

        {view === "import" && accessToken ? (
          <QuestionImportPanel
            accessToken={accessToken}
            onBack={() => setView("browse")}
            onDone={async () => {
              await Promise.all([loadQuestions(), loadStats()]);
            }}
          />
        ) : null}

        {view === "create" ? (
          <CmsSectionCard className="!p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">
                  {editingId ? "Edit Question" : "Add Question"}
                </h2>
                <p className="text-[12px] text-slate-500">
                  {editingId ? `Status: ${editStatus}` : "New questions save as Draft until published."}
                </p>
              </div>
              <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => setView("browse")}>
                Back to bank
              </button>
            </div>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveQuestion}>
              <label className="block text-[12px] font-medium text-slate-600">
                Subject
                <select className="nx-input mt-1" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Class
                <select className="nx-input mt-1" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Optional</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Chapter / Category
                <select className="nx-input mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Optional</option>
                  {formCategories.map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name}</option>
                      {parent.subCategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>{parent.name} → {sub.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Question type
                <select
                  className="nx-input mt-1"
                  required
                  value={questionTypeId}
                  onChange={(e) => {
                    setQuestionTypeId(e.target.value);
                    const type = questionTypes.find((row) => row.id === e.target.value);
                    if (type) setMarks(String(type.defaultMarks));
                  }}
                >
                  {questionTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Difficulty
                <select className="nx-input mt-1" required value={difficultyLevelId} onChange={(e) => setDifficultyLevelId(e.target.value)}>
                  {difficultyLevels.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-slate-600">
                Marks
                <input className="nx-input mt-1" type="number" min={0} step="0.25" value={marks} onChange={(e) => setMarks(e.target.value)} />
              </label>
              <label className="block text-[12px] font-medium text-slate-600 md:col-span-2">
                Question text
                <textarea className="nx-input mt-1 min-h-[110px]" required value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
              </label>
              <label className="block text-[12px] font-medium text-slate-600 md:col-span-2">
                Explanation
                <textarea className="nx-input mt-1 min-h-[80px]" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              </label>
              {showOptions ? (
                <div className="md:col-span-2 space-y-2 rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-[12px] font-semibold text-slate-700">Options</p>
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(index, { isCorrect: e.target.checked })}
                        title="Correct answer"
                      />
                      <input
                        className="nx-input flex-1"
                        placeholder={`Option ${index + 1}`}
                        value={option.optionText}
                        onChange={(e) => updateOption(index, { optionText: e.target.value })}
                      />
                      <button type="button" className="nx-icon-btn text-rose-600" onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}>
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => setOptions((prev) => [...prev, { optionText: "", isCorrect: false }])}>
                    Add option
                  </button>
                </div>
              ) : null}
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button type="submit" className="nx-btn-primary !text-[12px]" disabled={submitting || !canManage}>
                  {editingId ? "Save changes" : "Save as draft"}
                </button>
                {editingId && isAdmin && editStatus === "DRAFT" ? (
                  <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => void publishQuestion(editingId)}>
                    <CheckCircleOutline sx={{ fontSize: 16 }} /> Publish
                  </button>
                ) : null}
                {editingId && isAdmin && editStatus === "PUBLISHED" ? (
                  <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => void archiveQuestion(editingId)}>
                    <ArchiveOutlined sx={{ fontSize: 16 }} /> Archive
                  </button>
                ) : null}
              </div>
            </form>
          </CmsSectionCard>
        ) : null}

        {view === "categories" ? (
          <CmsSectionCard className="!p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-slate-900">Manage Chapters</h2>
              <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => setView("browse")}>
                Back to bank
              </button>
            </div>
            <form className="mb-4 grid gap-2 md:grid-cols-4" onSubmit={saveCategory}>
              <select className="nx-input" value={categorySubjectId} onChange={(e) => setCategorySubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input className="nx-input" placeholder="Chapter name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
              <select className="nx-input" value={categoryParentId} onChange={(e) => setCategoryParentId(e.target.value)}>
                <option value="">No parent</option>
                {categories
                  .filter((row) => row.subjectId === categorySubjectId)
                  .map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
              </select>
              <button type="submit" className="nx-btn-primary !text-[12px]" disabled={!canManage || submitting}>
                {editingCategoryId ? "Update" : "Add chapter"}
              </button>
            </form>
            <div className="space-y-2">
              {categories
                .filter((row) => !categorySubjectId || row.subjectId === categorySubjectId)
                .map((row) => (
                  <div key={row.id} className="rounded-xl border border-[#E5E7EB] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-800">{row.name}</p>
                        <p className="text-[11px] text-slate-400">{row.subject.name}</p>
                      </div>
                      {canManage ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="nx-icon-btn"
                            onClick={() => {
                              setEditingCategoryId(row.id);
                              setCategorySubjectId(row.subjectId);
                              setCategoryName(row.name);
                              setCategoryParentId(row.parentCategoryId ?? "");
                            }}
                          >
                            <EditOutlined sx={{ fontSize: 16 }} />
                          </button>
                          <button type="button" className="nx-icon-btn text-rose-600" onClick={() => void deleteCategory(row.id, row.name)}>
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {row.subCategories.length ? (
                      <div className="mt-2 space-y-1 border-t border-[#F1F5F9] pt-2">
                        {row.subCategories.map((sub) => (
                          <p key={sub.id} className="text-[12px] text-slate-600">↳ {sub.name}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </CmsSectionCard>
        ) : null}

        {viewing ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {viewing.subject.name}
                    {viewing.category ? ` · ${viewing.category.name}` : ""}
                  </p>
                  <h3 className="mt-1 text-[16px] font-bold text-slate-900">Question detail</h3>
                </div>
                <button type="button" className="nx-btn-secondary !text-[12px]" onClick={() => setViewing(null)}>
                  Close
                </button>
              </div>
              <p className="whitespace-pre-wrap text-[14px] text-slate-800">{viewing.questionText}</p>
              {viewing.options.length ? (
                <ul className="mt-4 space-y-2">
                  {viewing.options.map((option) => (
                    <li
                      key={option.id ?? option.optionText}
                      className={`rounded-lg border px-3 py-2 text-[13px] ${
                        option.isCorrect
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border-[#E5E7EB] text-slate-700"
                      }`}
                    >
                      {option.optionText}
                    </li>
                  ))}
                </ul>
              ) : null}
              {viewing.explanation ? (
                <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                  <span className="font-semibold text-slate-800">Explanation: </span>
                  {viewing.explanation}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
