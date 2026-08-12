import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  DeleteOutline,
  DownloadOutlined,
  EditOutlined,
  InfoOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };
type Scope = "GLOBAL" | "BY_CLASS";
type NegativeApplyTo = "ALL" | "MCQ_ONLY";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

type QuestionTypeKey =
  | "MCQ_SINGLE"
  | "MCQ_MULTI"
  | "TRUE_FALSE"
  | "SHORT_ANSWER"
  | "LONG_ANSWER"
  | "FILL_BLANKS"
  | "MATCHING";

interface DifficultyRule {
  id: string;
  level: Difficulty;
  fromPercent: number;
  toPercent: number;
  description: string | null;
  sortOrder: number;
}

interface SettingsPayload {
  scope: Scope;
  enabledQuestionTypes: string[];
  showQuestionMarks: boolean;
  enabledDifficulties: Difficulty[];
  autoQuestionCode: boolean;
  defaultMarks: Record<QuestionTypeKey, number>;
  negativeMarkingEnabled: boolean;
  negativeMarks: number;
  negativeApplyTo: NegativeApplyTo;
  preventDuplicates: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowImport: boolean;
  allowExport: boolean;
  requireApproval: boolean;
  allowTeachersToAddQuestions: boolean;
  difficultyRules: DifficultyRule[];
}

const QUESTION_TYPES: Array<{ key: QuestionTypeKey; label: string }> = [
  { key: "MCQ_SINGLE", label: "MCQ (Single Correct)" },
  { key: "MCQ_MULTI", label: "MCQ (Multiple Correct)" },
  { key: "TRUE_FALSE", label: "True / False" },
  { key: "SHORT_ANSWER", label: "Short Answer" },
  { key: "LONG_ANSWER", label: "Long Answer" },
  { key: "FILL_BLANKS", label: "Fill in the Blanks" },
  { key: "MATCHING", label: "Matching Type" },
];

const DIFFICULTIES: Array<{ key: Difficulty; label: string }> = [
  { key: "EASY", label: "Easy" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HARD", label: "Hard" },
];

const DEFAULT_MARKS: Record<QuestionTypeKey, number> = {
  MCQ_SINGLE: 1,
  MCQ_MULTI: 1,
  TRUE_FALSE: 1,
  SHORT_ANSWER: 2,
  LONG_ANSWER: 5,
  FILL_BLANKS: 1,
  MATCHING: 1,
};

function Card({
  title,
  children,
  actions,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-emerald-500" : "bg-[#D1D5DB]",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block size-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function DifficultyBadge({ level }: { level: Difficulty }) {
  const styles: Record<Difficulty, string> = {
    EASY: "bg-emerald-50 text-emerald-700",
    MEDIUM: "bg-orange-50 text-orange-700",
    HARD: "bg-rose-50 text-rose-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[level]}`}>
      {level.charAt(0) + level.slice(1).toLowerCase()}
    </span>
  );
}

function downloadSampleCsv() {
  const header = [
    "question_code",
    "question_type",
    "difficulty",
    "marks",
    "prompt",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "correct_option",
  ];
  const rows = [
    ["Q001", "MCQ_SINGLE", "EASY", "1", "What is 2+2?", "3", "4", "5", "6", "B"],
    ["Q002", "TRUE_FALSE", "MEDIUM", "1", "The sun rises in the east.", "True", "False", "", "", "A"],
  ];
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "question-bank-sample.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function QuestionBankSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Question Bank Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "online_exam.manage", "exams.manage"].includes(p),
    ),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [scope, setScope] = useState<Scope>("GLOBAL");
  const [enabledTypes, setEnabledTypes] = useState<string[]>(
    QUESTION_TYPES.filter((t) => t.key !== "MATCHING").map((t) => t.key),
  );
  const [showMarks, setShowMarks] = useState(true);
  const [enabledDifficulties, setEnabledDifficulties] = useState<Difficulty[]>([
    "EASY",
    "MEDIUM",
    "HARD",
  ]);
  const [autoCode, setAutoCode] = useState(true);
  const [defaultMarks, setDefaultMarks] = useState(DEFAULT_MARKS);
  const [negativeEnabled, setNegativeEnabled] = useState(true);
  const [negativeMarks, setNegativeMarks] = useState("0.25");
  const [negativeApplyTo, setNegativeApplyTo] = useState<NegativeApplyTo>("ALL");
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [allowImport, setAllowImport] = useState(true);
  const [allowExport, setAllowExport] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [allowTeachersToAddQuestions, setAllowTeachersToAddQuestions] = useState(false);
  const [difficultyRules, setDifficultyRules] = useState<DifficultyRule[]>([]);

  const [diffFormOpen, setDiffFormOpen] = useState(false);
  const [editingDiffId, setEditingDiffId] = useState<string | null>(null);
  const [diffLevel, setDiffLevel] = useState<Difficulty>("EASY");
  const [diffFrom, setDiffFrom] = useState("71");
  const [diffTo, setDiffTo] = useState("100");
  const [diffDescription, setDiffDescription] = useState("");

  function applyPayload(data: SettingsPayload) {
    setScope(data.scope);
    setEnabledTypes(data.enabledQuestionTypes);
    setShowMarks(data.showQuestionMarks);
    setEnabledDifficulties(data.enabledDifficulties);
    setAutoCode(data.autoQuestionCode);
    setDefaultMarks({ ...DEFAULT_MARKS, ...data.defaultMarks });
    setNegativeEnabled(data.negativeMarkingEnabled);
    setNegativeMarks(String(data.negativeMarks));
    setNegativeApplyTo(data.negativeApplyTo);
    setPreventDuplicates(data.preventDuplicates);
    setShuffleQuestions(data.shuffleQuestions);
    setShuffleOptions(data.shuffleOptions);
    setAllowImport(data.allowImport);
    setAllowExport(data.allowExport);
    setRequireApproval(data.requireApproval);
    setAllowTeachersToAddQuestions(data.allowTeachersToAddQuestions);
    setDifficultyRules(data.difficultyRules);
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<SettingsPayload>(
        "/erp/question-bank-settings",
        accessToken,
      );
      applyPayload(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function toggleType(key: string) {
    setEnabledTypes((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  function toggleDifficulty(key: Difficulty) {
    setEnabledDifficulties((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }

  async function saveConfiguration(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    if (!enabledTypes.length) {
      notifyError("Select at least one question type.");
      return;
    }
    if (!enabledDifficulties.length) {
      notifyError("Select at least one difficulty level.");
      return;
    }
    const neg = Number(negativeMarks);
    if (!Number.isFinite(neg) || neg < 0) {
      notifyError("Negative marks must be a valid number.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<SettingsPayload>("/erp/question-bank-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          scope,
          enabledQuestionTypes: enabledTypes,
          showQuestionMarks: showMarks,
          enabledDifficulties,
          autoQuestionCode: autoCode,
          defaultMarks,
          negativeMarkingEnabled: negativeEnabled,
          negativeMarks: neg,
          negativeApplyTo,
          preventDuplicates,
          shuffleQuestions,
          shuffleOptions,
          allowImport,
          allowExport,
          requireApproval,
          allowTeachersToAddQuestions,
        }),
      });
      applyPayload(data);
      notifySuccess("Question bank settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  function resetDiffForm() {
    setDiffFormOpen(false);
    setEditingDiffId(null);
    setDiffLevel("EASY");
    setDiffFrom("71");
    setDiffTo("100");
    setDiffDescription("");
  }

  function startEditDiff(rule: DifficultyRule) {
    setDiffFormOpen(true);
    setEditingDiffId(rule.id);
    setDiffLevel(rule.level);
    setDiffFrom(String(rule.fromPercent));
    setDiffTo(String(rule.toPercent));
    setDiffDescription(rule.description ?? "");
  }

  async function saveDifficulty(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const from = Number(diffFrom);
    const to = Number(diffTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      notifyError("Percent range is invalid.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<SettingsPayload>(
        "/erp/question-bank-settings/difficulty",
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify({
            id: editingDiffId ?? undefined,
            level: diffLevel,
            fromPercent: from,
            toPercent: to,
            description: diffDescription.trim() || null,
          }),
        },
      );
      applyPayload(data);
      resetDiffForm();
      notifySuccess(editingDiffId ? "Difficulty updated" : "Difficulty added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save difficulty");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDifficulty(rule: DifficultyRule) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({
      text: `Delete ${rule.level.toLowerCase()} difficulty rule?`,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const data = await apiRequest<SettingsPayload>(
        `/erp/question-bank-settings/difficulty/${rule.id}`,
        accessToken,
        { method: "DELETE" },
      );
      applyPayload(data);
      notifySuccess("Difficulty rule deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete difficulty");
    } finally {
      setSaving(false);
    }
  }

  const preferenceRows: Array<{
    key: string;
    label: string;
    checked: boolean;
    onChange: (next: boolean) => void;
  }> = [
    { key: "dup", label: "Prevent Duplicate Questions", checked: preventDuplicates, onChange: setPreventDuplicates },
    { key: "sq", label: "Shuffle Questions in Exams", checked: shuffleQuestions, onChange: setShuffleQuestions },
    { key: "so", label: "Shuffle Options in MCQ", checked: shuffleOptions, onChange: setShuffleOptions },
    { key: "imp", label: "Allow Question Import", checked: allowImport, onChange: setAllowImport },
    { key: "exp", label: "Allow Question Export", checked: allowExport, onChange: setAllowExport },
    { key: "apr", label: "Approved Before Use", checked: requireApproval, onChange: setRequireApproval },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
          onClick={() => void saveConfiguration()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Question Bank Settings
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure defaults for question types, marks, and difficulty levels.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Card title="1. General Settings">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel>Question Bank Scope</FieldLabel>
                  <div className="space-y-2">
                    {(
                      [
                        { value: "GLOBAL", label: "Global (All Classes)" },
                        { value: "BY_CLASS", label: "By Classes" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm text-[#374151]"
                      >
                        <input
                          type="radio"
                          name="qb-scope"
                          className="size-4 accent-primary"
                          checked={scope === option.value}
                          disabled={!canManage || saving}
                          onChange={() => setScope(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Show Question Marks</FieldLabel>
                  <div className="flex gap-4">
                    {(
                      [
                        { value: true, label: "Yes" },
                        { value: false, label: "No" },
                      ] as const
                    ).map((option) => (
                      <label
                        key={String(option.value)}
                        className="flex items-center gap-2 text-sm text-[#374151]"
                      >
                        <input
                          type="radio"
                          name="qb-show-marks"
                          className="size-4 accent-primary"
                          checked={showMarks === option.value}
                          disabled={!canManage || saving}
                          onChange={() => setShowMarks(option.value)}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Default Question Type</FieldLabel>
                  <div className="space-y-2">
                    {QUESTION_TYPES.map((type) => (
                      <label
                        key={type.key}
                        className="flex items-center gap-2 text-sm text-[#374151]"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={enabledTypes.includes(type.key)}
                          disabled={!canManage || saving}
                          onChange={() => toggleType(type.key)}
                        />
                        {type.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <FieldLabel>Default Difficulty Level</FieldLabel>
                    <div className="space-y-2">
                      {DIFFICULTIES.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 text-sm text-[#374151]"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={enabledDifficulties.includes(item.key)}
                            disabled={!canManage || saving}
                            onChange={() => toggleDifficulty(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5">
                    <span className="text-sm text-[#374151]">Auto Question Code</span>
                    <Toggle
                      checked={autoCode}
                      disabled={!canManage || saving}
                      onChange={setAutoCode}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                    <div>
                      <span className="block text-sm font-semibold text-[#374151]">
                        Allow Teachers to Add Questions
                      </span>
                      <span className="mt-0.5 block text-xs text-[#6B7280]">
                        When off, teachers can view the bank but cannot create, edit, or delete
                        drafts.
                      </span>
                    </div>
                    <Toggle
                      checked={allowTeachersToAddQuestions}
                      disabled={!canManage || saving}
                      onChange={setAllowTeachersToAddQuestions}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="2. Default Marks & Negative Marking">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <FieldLabel>Default Marks for Questions</FieldLabel>
                  <div className="space-y-2">
                    {QUESTION_TYPES.map((type) => (
                      <label
                        key={type.key}
                        className="grid grid-cols-[1fr_80px] items-center gap-3 text-sm text-[#374151]"
                      >
                        <span>{type.label}</span>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          className="nx-input w-full"
                          value={defaultMarks[type.key]}
                          disabled={!canManage || saving}
                          onChange={(e) =>
                            setDefaultMarks((prev) => ({
                              ...prev,
                              [type.key]: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <FieldLabel>Negative Marking</FieldLabel>
                    <div className="space-y-2">
                      {(
                        [
                          { value: true, label: "Enable Negative Marking" },
                          { value: false, label: "Disable" },
                        ] as const
                      ).map((option) => (
                        <label
                          key={String(option.value)}
                          className="flex items-center gap-2 text-sm text-[#374151]"
                        >
                          <input
                            type="radio"
                            name="qb-negative"
                            className="size-4 accent-primary"
                            checked={negativeEnabled === option.value}
                            disabled={!canManage || saving}
                            onChange={() => setNegativeEnabled(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <FieldLabel>Negative Marks for Wrong Answer</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      className="nx-input w-full max-w-[160px]"
                      value={negativeMarks}
                      disabled={!canManage || saving || !negativeEnabled}
                      onChange={(e) => setNegativeMarks(e.target.value)}
                    />
                  </label>
                  <div>
                    <FieldLabel>Apply To</FieldLabel>
                    <div className="space-y-2">
                      {(
                        [
                          { value: "ALL", label: "All Question Types" },
                          { value: "MCQ_ONLY", label: "Only MCQ Types" },
                        ] as const
                      ).map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 text-sm text-[#374151]"
                        >
                          <input
                            type="radio"
                            name="qb-neg-apply"
                            className="size-4 accent-primary"
                            checked={negativeApplyTo === option.value}
                            disabled={!canManage || saving || !negativeEnabled}
                            onChange={() => setNegativeApplyTo(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900/80">
                    Negative marking is applied based on exam settings when enabled here.
                  </div>
                </div>
              </div>
            </Card>

            <Card title="3. Other Preferences">
              <div className="space-y-3">
                {preferenceRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3 last:border-b-0 last:pb-0"
                  >
                    <span className="text-sm text-[#374151]">{row.label}</span>
                    <Toggle
                      checked={row.checked}
                      disabled={!canManage || saving}
                      onChange={row.onChange}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title="4. Difficulty Level Configuration"
              actions={
                <button
                  type="button"
                  className="rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={() => {
                    setDiffFormOpen(true);
                    setEditingDiffId(null);
                    setDiffLevel("EASY");
                    setDiffFrom("71");
                    setDiffTo("100");
                    setDiffDescription("");
                  }}
                >
                  + Add Level
                </button>
              }
            >
              {diffFormOpen ? (
                <form
                  className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2"
                  onSubmit={(e) => void saveDifficulty(e)}
                >
                  <label className="block">
                    <FieldLabel>Difficulty Level</FieldLabel>
                    <select
                      className="nx-input w-full"
                      value={diffLevel}
                      disabled={saving}
                      onChange={(e) => setDiffLevel(e.target.value as Difficulty)}
                    >
                      {DIFFICULTIES.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={diffDescription}
                      disabled={saving}
                      onChange={(e) => setDiffDescription(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>From (%)</FieldLabel>
                    <input
                      type="number"
                      className="nx-input w-full"
                      value={diffFrom}
                      disabled={saving}
                      onChange={(e) => setDiffFrom(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>To (%)</FieldLabel>
                    <input
                      type="number"
                      className="nx-input w-full"
                      value={diffTo}
                      disabled={saving}
                      onChange={(e) => setDiffTo(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={saving}
                    >
                      {editingDiffId ? "Update" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetDiffForm}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Difficulty Level</th>
                      <th className="px-2 py-2.5">Correct Answer Percentage (%)</th>
                      <th className="px-2 py-2.5">Description</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {difficultyRules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading ? "Loading…" : "No difficulty rules configured."}
                        </td>
                      </tr>
                    ) : (
                      difficultyRules.map((rule) => (
                        <tr
                          key={rule.id}
                          className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                        >
                          <td className="px-2 py-3">
                            <DifficultyBadge level={rule.level} />
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {rule.fromPercent} - {rule.toPercent}%
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {rule.description || "—"}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => startEditDiff(rule)}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => void deleteDifficulty(rule)}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs leading-relaxed text-[#1E40AF]">
                Difficulty is calculated based on overall exam performance (correct answer %).
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <InfoOutlined sx={{ fontSize: 18 }} className="text-primary" />
                <h2 className="text-sm font-bold text-[#1A1A1A]">Quick Guide</h2>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-[#6B7280]">
                <li>• Enable &quot;Allow Teachers to Add Questions&quot; to let teachers draft items.</li>
                <li>• Set default marks for each question type to speed up bank entry.</li>
                <li>• Use difficulty levels to balance papers automatically.</li>
                <li>• Enable shuffle options to reduce cheating in online exams.</li>
                <li>• Import/export formats keep question banks portable across sessions.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <DownloadOutlined sx={{ fontSize: 18 }} className="text-primary" />
                <h2 className="text-sm font-bold text-[#1A1A1A]">Supported Import Format</h2>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[#6B7280]">
                Download a sample Excel/CSV template to import questions in bulk.
              </p>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                onClick={downloadSampleCsv}
              >
                <DownloadOutlined sx={{ fontSize: 16 }} />
                Download Sample
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
