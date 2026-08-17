import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ContentCopyOutlined,
  DeleteOutline,
  EditOutlined,
  FilterListOutlined,
  InfoOutlined,
  MenuBookOutlined,
  MoreVertOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type BookType = "GENERAL" | "PROFESSIONAL" | "HOSTEL" | "TRANSPORT" | "ACTIVITY";
type BookTarget = "CLASSES" | "COURSES" | "STREAMS" | "PROGRAMS";
type HeadFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";

type FeeBookHead = {
  id: string;
  feeTypeId: string;
  headName: string;
  headType: string;
  amount: number;
  frequency: HeadFrequency;
  sortOrder: number;
};

type FeeBook = {
  id: string;
  name: string;
  description: string | null;
  type: BookType;
  target: BookTarget;
  isActive: boolean;
  createdAt: string;
  academicSession: { id: string; name: string; isCurrent: boolean };
  createdByName: string;
  classesLabel: string;
  classes: Array<{ id: string; name: string; sortOrder: number }>;
  studentCount: number;
  headCount: number;
  heads: FeeBookHead[];
};

type Setup = {
  currentSession: { id: string; name: string; isCurrent: boolean } | null;
  sessions: Array<{ id: string; name: string; isCurrent: boolean }>;
  classes: Array<{ id: string; name: string; sortOrder: number }>;
  feeTypes: Array<{ id: string; name: string; kind: string; defaultAmount: number }>;
  books: FeeBook[];
  stats: {
    totalFeeBooks: number;
    activeFeeBooks: number;
    assignedStudents: number;
    totalCollection: number;
    outstanding: number;
    sessionName?: string | null;
  };
};

type TabKey = "books" | "assign" | "settings";

type HeadDraft = {
  feeTypeId: string;
  amount: string;
  frequency: HeadFrequency;
};

const PAGE_SIZE = 8;

const TYPE_OPTIONS: Array<{ value: BookType; label: string }> = [
  { value: "GENERAL", label: "General" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "ACTIVITY", label: "Activity" },
];

const TARGET_OPTIONS: Array<{ value: BookTarget; label: string }> = [
  { value: "CLASSES", label: "Classes" },
  { value: "COURSES", label: "Courses" },
  { value: "STREAMS", label: "Streams" },
  { value: "PROGRAMS", label: "Programs" },
];

const FREQUENCY_OPTIONS: Array<{ value: HeadFrequency; label: string }> = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONE_TIME", label: "One Time" },
];

const TYPE_BADGE: Record<BookType, string> = {
  GENERAL: "bg-sky-50 text-sky-700",
  PROFESSIONAL: "bg-violet-50 text-violet-700",
  HOSTEL: "bg-orange-50 text-orange-700",
  TRANSPORT: "bg-teal-50 text-teal-700",
  ACTIVITY: "bg-pink-50 text-pink-700",
};

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

function frequencyLabel(value: HeadFrequency) {
  return FREQUENCY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function Card({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2> : null}
            {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function ClassMultiSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ id: string; name: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectedLabels = options.filter((item) => value.includes(item.id)).map((item) => item.name);

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id));
    else onChange([...value, id]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-left text-sm text-[#1A1A1A] disabled:opacity-60"
      >
        <span className="truncate">
          {selectedLabels.length ? selectedLabels.join(", ") : "Select classes…"}
        </span>
        <span className="text-[#9CA3AF]">▾</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[#E5E7EB] bg-white p-2 shadow-lg">
          {options.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#F9FAFB]"
            >
              <input
                type="checkbox"
                checked={value.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MultiFeeBookPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Multi Fees Book";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["fees.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("books");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"ALL" | BookType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [bookType, setBookType] = useState<BookType>("GENERAL");
  const [target, setTarget] = useState<BookTarget>("CLASSES");
  const [isActive, setIsActive] = useState(true);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [heads, setHeads] = useState<HeadDraft[]>([]);

  const [assignBookId, setAssignBookId] = useState("");
  const [assignClassIds, setAssignClassIds] = useState<string[]>([]);
  const [defaultType, setDefaultType] = useState<BookType>("GENERAL");
  const [requireHeads, setRequireHeads] = useState(true);
  const [autoAssignStudents, setAutoAssignStudents] = useState(true);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/fees/multi-fee-books/setup", accessToken);
      setSetup(data);
      setSelectedId((prev) => prev || data.books[0]?.id || null);
      setAssignBookId((prev) => prev || data.books[0]?.id || "");
      setSessionId((prev) => prev || data.currentSession?.id || data.sessions[0]?.id || "");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load multi fee books");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const books = setup?.books ?? [];
  const classes = setup?.classes ?? [];
  const feeTypes = setup?.feeTypes ?? [];
  const sessions = setup?.sessions ?? [];
  const stats = setup?.stats;

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((book) => {
      if (typeFilter !== "ALL" && book.type !== typeFilter) return false;
      if (statusFilter === "ACTIVE" && !book.isActive) return false;
      if (statusFilter === "INACTIVE" && book.isActive) return false;
      if (!q) return true;
      const haystack = [
        book.name,
        book.classesLabel,
        book.type,
        book.target,
        book.academicSession.name,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [books, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedBooks = filteredBooks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const selectedBook = books.find((book) => book.id === selectedId) ?? books[0] ?? null;

  useEffect(() => {
    if (!assignBookId) return;
    const book = books.find((item) => item.id === assignBookId);
    if (book) setAssignClassIds(book.classes.map((c) => c.id));
  }, [assignBookId, books]);

  function resetForm() {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setSessionId(setup?.currentSession?.id || sessions[0]?.id || "");
    setBookType(defaultType);
    setTarget("CLASSES");
    setIsActive(true);
    setClassIds([]);
    setHeads([]);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
    setBookType(defaultType);
    setSessionId(setup?.currentSession?.id || sessions[0]?.id || "");
  }

  function startEdit(book: FeeBook) {
    setFormOpen(true);
    setEditingId(book.id);
    setName(book.name);
    setDescription(book.description ?? "");
    setSessionId(book.academicSession.id);
    setBookType(book.type);
    setTarget(book.target);
    setIsActive(book.isActive);
    setClassIds(book.classes.map((c) => c.id));
    setHeads(
      book.heads.map((head) => ({
        feeTypeId: head.feeTypeId,
        amount: String(head.amount),
        frequency: head.frequency,
      })),
    );
    setSelectedId(book.id);
    setTab("books");
  }

  function addHeadRow() {
    const unused = feeTypes.find((ft) => !heads.some((h) => h.feeTypeId === ft.id));
    if (!unused) {
      notifyError("All fee heads are already added.");
      return;
    }
    setHeads((prev) => [
      ...prev,
      {
        feeTypeId: unused.id,
        amount: String(unused.defaultAmount ?? 0),
        frequency: unused.kind === "ONE_TIME" ? "ONE_TIME" : "YEARLY",
      },
    ]);
  }

  async function saveBook(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const trimmed = name.trim();
    if (!trimmed) {
      notifyError("Fee book name is required.");
      return;
    }
    if (!sessionId) {
      notifyError("Select an academic session.");
      return;
    }
    if (requireHeads && !heads.length) {
      notifyError("Add at least one fee head.");
      return;
    }
    const parsedHeads = heads.map((head) => ({
      feeTypeId: head.feeTypeId,
      amount: Number(head.amount),
      frequency: head.frequency,
    }));
    if (parsedHeads.some((h) => !h.feeTypeId || !Number.isFinite(h.amount) || h.amount < 0)) {
      notifyError("Each head needs a valid fee type and amount.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: trimmed,
        description: description.trim() || null,
        academicSessionId: sessionId,
        type: bookType,
        target,
        isActive,
        classIds,
        heads: parsedHeads,
      };
      if (editingId) {
        await apiRequest(`/fees/multi-fee-books/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Fee book updated");
      } else {
        const created = await apiRequest<FeeBook>("/fees/multi-fee-books", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelectedId(created.id);
        notifySuccess("Fee book created");
      }
      resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save fee book");
    } finally {
      setSaving(false);
    }
  }

  async function copyBook(book: FeeBook) {
    if (!accessToken || !canManage) return;
    setSaving(true);
    setMenuOpenId(null);
    try {
      const copied = await apiRequest<FeeBook>(
        `/fees/multi-fee-books/${book.id}/copy`,
        accessToken,
        { method: "POST" },
      );
      setSelectedId(copied.id);
      notifySuccess("Fee book copied");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to copy fee book");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBook(book: FeeBook) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete fee book "${book.name}"?` });
    if (!ok) return;
    setSaving(true);
    setMenuOpenId(null);
    try {
      await apiRequest(`/fees/multi-fee-books/${book.id}`, accessToken, { method: "DELETE" });
      if (selectedId === book.id) setSelectedId(null);
      notifySuccess("Fee book deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete fee book");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(book: FeeBook) {
    if (!accessToken || !canManage) return;
    setSaving(true);
    setMenuOpenId(null);
    try {
      await apiRequest(`/fees/multi-fee-books/${book.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ isActive: !book.isActive }),
      });
      notifySuccess(book.isActive ? "Fee book deactivated" : "Fee book activated");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update status");
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignments() {
    if (!accessToken || !canManage || !assignBookId) return;
    setSaving(true);
    try {
      await apiRequest(`/fees/multi-fee-books/${assignBookId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ classIds: assignClassIds }),
      });
      notifySuccess(
        autoAssignStudents
          ? "Classes assigned. Active students in those classes are counted against this book."
          : "Classes assigned to fee book",
      );
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign classes");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "books", label: "Fee Books" },
    { key: "assign", label: "Assign Fee Books" },
    { key: "settings", label: "Fee Book Settings" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span> Fees{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={!canManage || loading}
          onClick={openCreate}
        >
          <AddOutlined sx={{ fontSize: 16 }} />
          Add Fee Book
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[#1A1A1A]">Multi Fee Book</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage multiple fee books for different classes, courses, streams or programs.
          </p>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Total Fee Books", value: stats?.totalFeeBooks ?? 0 },
            { label: "Active Fee Books", value: stats?.activeFeeBooks ?? 0 },
            {
              label: "Assigned Students",
              value: (stats?.assignedStudents ?? 0).toLocaleString("en-IN"),
            },
            {
              label: "Total Collection (This Session)",
              value: `₹${money(stats?.totalCollection)}`,
            },
            {
              label: "Outstanding (This Session)",
              value: `₹${money(stats?.outstanding)}`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-bold text-[#1A1A1A]">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-[#E5E7EB]">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={[
                "border-b-2 px-3 py-2 text-sm font-semibold transition",
                tab === item.key
                  ? "border-primary text-primary"
                  : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]",
              ].join(" ")}
            >
              {item.label}
              {item.key === "books" ? (
                <span className="ml-1 text-xs font-normal text-[#9CA3AF]">
                  ({stats?.activeFeeBooks ?? 0})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <Card>
            <p className="text-sm text-[#6B7280]">Loading fee books…</p>
          </Card>
        ) : null}

        {!loading && tab === "books" ? (
          <div className="space-y-4">
            {formOpen ? (
              <Card
                title={editingId ? "Edit Fee Book" : "Add Fee Book"}
                hint="Define the book, assign classes, and attach fee heads."
                actions={
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#6B7280]"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                }
              >
                <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void saveBook(e)}>
                  <label className="block">
                    <FieldLabel required>Fee Book Name</FieldLabel>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      placeholder="e.g. School Fee Book"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>Academic Session</FieldLabel>
                    <select
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      disabled={!canManage}
                    >
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                          {session.isCurrent ? " (Current)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Type</FieldLabel>
                    <select
                      value={bookType}
                      onChange={(e) => setBookType(e.target.value as BookType)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      disabled={!canManage}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>For</FieldLabel>
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value as BookTarget)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      disabled={!canManage}
                    >
                      {TARGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <FieldLabel>Classes / Courses</FieldLabel>
                    <ClassMultiSelect
                      options={classes}
                      value={classIds}
                      onChange={setClassIds}
                      disabled={!canManage}
                    />
                  </div>
                  <label className="block md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#374151]">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={!canManage}
                    />
                    Active
                  </label>

                  <div className="md:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                      <FieldLabel>Fee Book Heads</FieldLabel>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary disabled:opacity-50"
                        disabled={!canManage || !feeTypes.length}
                        onClick={addHeadRow}
                      >
                        + Add head
                      </button>
                    </div>
                    <div className="space-y-2">
                      {heads.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-[#E5E7EB] px-3 py-4 text-sm text-[#9CA3AF]">
                          No heads yet. Add tuition, admission, or other fee heads.
                        </p>
                      ) : (
                        heads.map((head, index) => (
                          <div
                            key={`${head.feeTypeId}-${index}`}
                            className="grid gap-2 rounded-lg border border-[#F3F4F6] p-2 md:grid-cols-[1.4fr_1fr_1fr_auto]"
                          >
                            <select
                              value={head.feeTypeId}
                              onChange={(e) => {
                                const feeTypeId = e.target.value;
                                const ft = feeTypes.find((item) => item.id === feeTypeId);
                                setHeads((prev) =>
                                  prev.map((row, i) =>
                                    i === index
                                      ? {
                                          feeTypeId,
                                          amount: String(ft?.defaultAmount ?? row.amount),
                                          frequency:
                                            ft?.kind === "ONE_TIME" ? "ONE_TIME" : row.frequency,
                                        }
                                      : row,
                                  ),
                                );
                              }}
                              className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm"
                              disabled={!canManage}
                            >
                              {feeTypes.map((ft) => (
                                <option key={ft.id} value={ft.id}>
                                  {ft.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={head.amount}
                              onChange={(e) =>
                                setHeads((prev) =>
                                  prev.map((row, i) =>
                                    i === index ? { ...row, amount: e.target.value } : row,
                                  ),
                                )
                              }
                              className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm"
                              disabled={!canManage}
                            />
                            <select
                              value={head.frequency}
                              onChange={(e) =>
                                setHeads((prev) =>
                                  prev.map((row, i) =>
                                    i === index
                                      ? { ...row, frequency: e.target.value as HeadFrequency }
                                      : row,
                                  ),
                                )
                              }
                              className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm"
                              disabled={!canManage}
                            >
                              {FREQUENCY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-lg border border-[#FEE2E2] px-2 text-rose-600"
                              disabled={!canManage}
                              onClick={() =>
                                setHeads((prev) => prev.filter((_, i) => i !== index))
                              }
                            >
                              <DeleteOutline sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={!canManage || saving}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "Saving…" : editingId ? "Update Fee Book" : "Create Fee Book"}
                    </button>
                  </div>
                </form>
              </Card>
            ) : null}

            <Card>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <SearchOutlined
                    sx={{ fontSize: 18 }}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search fee books..."
                    className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
                >
                  <FilterListOutlined sx={{ fontSize: 16 }} />
                  Filters
                </button>
              </div>

              {showFilters ? (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Type</FieldLabel>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as "ALL" | BookType)}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    >
                      <option value="ALL">All types</option>
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Status</FieldLabel>
                    <select
                      value={statusFilter}
                      onChange={(e) =>
                        setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")
                      }
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Fee Book Name</th>
                      <th className="px-2 py-2 font-semibold">For</th>
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Classes / Courses</th>
                      <th className="px-2 py-2 font-semibold">Students</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Academic Session</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBooks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-2 py-8 text-center text-[#9CA3AF]">
                          No fee books found. Create one to get started.
                        </td>
                      </tr>
                    ) : (
                      pagedBooks.map((book, index) => {
                        const rowNo = (currentPage - 1) * PAGE_SIZE + index + 1;
                        const selected = selectedBook?.id === book.id;
                        return (
                          <tr
                            key={book.id}
                            className={[
                              "cursor-pointer border-b border-[#F3F4F6] transition hover:bg-[#F9FAFB]",
                              selected ? "bg-primary/5" : "",
                            ].join(" ")}
                            onClick={() => setSelectedId(book.id)}
                          >
                            <td className="px-2 py-3 text-[#6B7280]">{rowNo}</td>
                            <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{book.name}</td>
                            <td className="px-2 py-3 text-[#374151]">
                              {TARGET_OPTIONS.find((t) => t.value === book.target)?.label ??
                                book.target}
                            </td>
                            <td className="px-2 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_BADGE[book.type]}`}
                              >
                                {TYPE_OPTIONS.find((t) => t.value === book.type)?.label ?? book.type}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-[#374151]">{book.classesLabel}</td>
                            <td className="px-2 py-3 text-[#374151]">
                              {book.studentCount.toLocaleString("en-IN")}
                            </td>
                            <td className="px-2 py-3">
                              {book.isActive ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-3 text-[#374151]">
                              {book.academicSession.name}
                            </td>
                            <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="relative flex items-center gap-1">
                                <button
                                  type="button"
                                  className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-primary"
                                  disabled={!canManage}
                                  onClick={() => startEdit(book)}
                                  title="Edit"
                                >
                                  <EditOutlined sx={{ fontSize: 16 }} />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-primary"
                                  disabled={!canManage || saving}
                                  onClick={() => void copyBook(book)}
                                  title="Copy"
                                >
                                  <ContentCopyOutlined sx={{ fontSize: 16 }} />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                                  onClick={() =>
                                    setMenuOpenId((prev) => (prev === book.id ? null : book.id))
                                  }
                                  title="More"
                                >
                                  <MoreVertOutlined sx={{ fontSize: 16 }} />
                                </button>
                                {menuOpenId === book.id ? (
                                  <div className="absolute right-0 top-8 z-10 min-w-[150px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[#F9FAFB]"
                                      disabled={!canManage}
                                      onClick={() => void toggleActive(book)}
                                    >
                                      {book.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                                      disabled={!canManage}
                                      onClick={() => void deleteBook(book)}
                                    >
                                      Delete
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

              {filteredBooks.length > PAGE_SIZE ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-[#6B7280]">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 disabled:opacity-50"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 disabled:opacity-50"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>

            {selectedBook ? (
              <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                <Card title="Fee Book Details">
                  <div className="mb-4 flex items-start gap-3">
                    <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MenuBookOutlined />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-[#1A1A1A]">{selectedBook.name}</h3>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        {selectedBook.description || "No description provided."}
                      </p>
                    </div>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[#9CA3AF]">Academic Session</dt>
                      <dd className="font-semibold text-[#1A1A1A]">
                        {selectedBook.academicSession.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#9CA3AF]">Total Heads</dt>
                      <dd className="font-semibold text-[#1A1A1A]">{selectedBook.headCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[#9CA3AF]">Created By</dt>
                      <dd className="font-semibold text-[#1A1A1A]">
                        {selectedBook.createdByName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#9CA3AF]">Students</dt>
                      <dd className="font-semibold text-[#1A1A1A]">
                        {selectedBook.studentCount.toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="mt-4 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
                    onClick={() => startEdit(selectedBook)}
                    disabled={!canManage}
                  >
                    View Fee Book
                  </button>
                </Card>

                <Card title="Fee Book Heads Sample" hint="Heads configured for the selected book.">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                          <th className="px-2 py-2 font-semibold">Head Name</th>
                          <th className="px-2 py-2 font-semibold">Type</th>
                          <th className="px-2 py-2 font-semibold">Amount</th>
                          <th className="px-2 py-2 font-semibold">Frequency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBook.heads.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-6 text-center text-[#9CA3AF]">
                              No heads in this fee book.
                            </td>
                          </tr>
                        ) : (
                          selectedBook.heads.slice(0, 8).map((head) => (
                            <tr key={head.id} className="border-b border-[#F3F4F6]">
                              <td className="px-2 py-2.5 font-medium text-[#1A1A1A]">
                                {head.headName}
                              </td>
                              <td className="px-2 py-2.5 text-[#374151]">{head.headType}</td>
                              <td className="px-2 py-2.5 text-[#374151]">₹{money(head.amount)}</td>
                              <td className="px-2 py-2.5 text-[#374151]">
                                {frequencyLabel(head.frequency)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "assign" ? (
          <Card
            title="Assign Fee Books"
            hint="Map classes to a fee book so enrolled students are covered by that structure."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel required>Fee Book</FieldLabel>
                <select
                  value={assignBookId}
                  onChange={(e) => setAssignBookId(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  disabled={!canManage}
                >
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name} ({book.academicSession.name})
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <FieldLabel>Classes</FieldLabel>
                <ClassMultiSelect
                  options={classes}
                  value={assignClassIds}
                  onChange={setAssignClassIds}
                  disabled={!canManage || !assignBookId}
                />
              </div>
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!canManage || saving || !assignBookId}
              onClick={() => void saveAssignments()}
            >
              {saving ? "Saving…" : "Save assignment"}
            </button>
          </Card>
        ) : null}

        {!loading && tab === "settings" ? (
          <Card
            title="Fee Book Settings"
            hint="Defaults applied when creating new fee books in this workspace."
          >
            <div className="space-y-4">
              <label className="block max-w-sm">
                <FieldLabel>Default book type</FieldLabel>
                <select
                  value={defaultType}
                  onChange={(e) => setDefaultType(e.target.value as BookType)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  disabled={!canManage}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={requireHeads}
                  onChange={(e) => setRequireHeads(e.target.checked)}
                  disabled={!canManage}
                />
                <span>
                  <span className="block font-semibold text-[#1A1A1A]">
                    Require at least one fee head
                  </span>
                  <span className="text-[#6B7280]">
                    Prevent creating empty fee books without heads.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={autoAssignStudents}
                  onChange={(e) => setAutoAssignStudents(e.target.checked)}
                  disabled={!canManage}
                />
                <span>
                  <span className="block font-semibold text-[#1A1A1A]">
                    Count active enrollments as assigned students
                  </span>
                  <span className="text-[#6B7280]">
                    Student totals are derived from active enrollments in assigned classes.
                  </span>
                </span>
              </label>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!canManage}
                onClick={() => notifySuccess("Fee book settings saved for this session")}
              >
                Save settings
              </button>
            </div>
          </Card>
        ) : null}

        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-violet-900">
            <InfoOutlined sx={{ fontSize: 18 }} />
            About Multi Fee Book
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-violet-900/80">
            <li>
              Create separate fee books for school fees, hostel, transport, activities, or
              professional programs.
            </li>
            <li>Assign each book to classes, courses, streams, or programs for the session.</li>
            <li>Attach fee heads with amounts and billing frequency for each book.</li>
            <li>Copy an existing fee book to reuse heads and class mappings quickly.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
