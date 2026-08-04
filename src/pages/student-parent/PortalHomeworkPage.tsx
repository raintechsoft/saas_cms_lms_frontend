import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AssignmentOutlined,
  AttachFileOutlined,
  CheckCircleOutlineRounded,
  CloseOutlined,
  FilterListRounded,
  HeadphonesOutlined,
  ScheduleRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { usePortal } from "./PortalContext";
import type { PortalHomeworkItem } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const PAGE_SIZE = 6;

type StatusFilter = "ALL" | "PENDING" | "SUBMITTED" | "OVERDUE";
type SortKey = "due-asc" | "due-desc" | "title";

type DerivedStatus = "PENDING" | "SUBMITTED" | "OVERDUE" | "RESUBMIT";

function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </section>
  );
}

function subjectColor(subject: string) {
  const colors = ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function deriveStatus(item: PortalHomeworkItem, now = new Date()): DerivedStatus {
  if (item.submission?.status === "RESUBMIT_REQUESTED") return "RESUBMIT";
  if (item.submission) return "SUBMITTED";
  const due = new Date(item.submissionDate);
  if (due.getTime() < now.getTime()) return "OVERDUE";
  return "PENDING";
}

function statusMeta(status: DerivedStatus) {
  switch (status) {
    case "SUBMITTED":
      return { label: "Submitted", bg: "#ECFDF5", fg: "#059669" };
    case "OVERDUE":
      return { label: "Overdue", bg: "#FEF2F2", fg: "#E11D48" };
    case "RESUBMIT":
      return { label: "Resubmit", bg: "#FFF7ED", fg: "#D97706" };
    default:
      return { label: "Pending", bg: "#FFF7ED", fg: "#D97706" };
  }
}

function daysLeftLabel(dueIso: string) {
  const due = new Date(dueIso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)} Day${Math.abs(diff) === 1 ? "" : "s"} Overdue`, tone: "#E11D48" };
  if (diff === 0) return { text: "Due Today", tone: "#D97706" };
  if (diff === 1) return { text: "1 Day Left", tone: "#D97706" };
  return { text: `${diff} Days Left`, tone: "#059669" };
}

function formatDue(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Donut({
  submitted,
  pending,
  overdue,
}: {
  submitted: number;
  pending: number;
  overdue: number;
}) {
  const total = Math.max(submitted + pending + overdue, 1);
  const size = 140;
  const r = 48;
  const c = 2 * Math.PI * r;
  const segs = [
    { value: submitted, color: "#10B981" },
    { value: pending, color: "#F59E0B" },
    { value: overdue, color: "#EF4444" },
  ];
  let offset = 0;
  return (
    <div className="relative mx-auto size-[140px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F2F6" strokeWidth="14" />
        {segs.map((seg) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={seg.color}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[18px] font-bold text-[#1A1A1A]">{submitted + pending + overdue}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Total</p>
        </div>
      </div>
    </div>
  );
}

export function PortalHomeworkPage() {
  const { accessToken, child, canSubmitHomework, reload, basePath } = usePortal();
  const [items, setItems] = useState<PortalHomeworkItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("due-asc");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);

  async function loadHomework() {
    if (!child) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      setItems(
        await apiRequest<PortalHomeworkItem[]>(
          `/portal/children/${child.student.id}/homework`,
          accessToken,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load homework");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHomework();
  }, [accessToken, child?.student.id]);

  const monthItems = useMemo(() => {
    const from = startOfMonth();
    const to = endOfMonth();
    return items.filter((item) => {
      const due = new Date(item.submissionDate);
      return due >= from && due <= to;
    });
  }, [items]);

  const stats = useMemo(() => {
    const source = monthItems.length ? monthItems : items;
    let completed = 0;
    let pending = 0;
    let overdue = 0;
    for (const item of source) {
      const status = deriveStatus(item);
      if (status === "SUBMITTED") completed += 1;
      else if (status === "OVERDUE") overdue += 1;
      else pending += 1; // includes RESUBMIT as pending work
    }
    return { total: source.length, completed, pending, overdue };
  }, [monthItems, items]);

  const subjects = useMemo(
    () => [...new Set(items.map((item) => item.subject))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filtered = useMemo(() => {
    let list = [...items];
    if (subjectFilter !== "ALL") list = list.filter((item) => item.subject === subjectFilter);
    if (statusFilter !== "ALL") {
      list = list.filter((item) => {
        const status = deriveStatus(item);
        if (statusFilter === "SUBMITTED") return status === "SUBMITTED";
        if (statusFilter === "OVERDUE") return status === "OVERDUE";
        return status === "PENDING" || status === "RESUBMIT";
      });
    }
    list.sort((a, b) => {
      if (sortKey === "title") return a.title.localeCompare(b.title);
      const da = new Date(a.submissionDate).getTime();
      const db = new Date(b.submissionDate).getTime();
      return sortKey === "due-desc" ? db - da : da - db;
    });
    return list;
  }, [items, subjectFilter, statusFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, subjectFilter, sortKey]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...items]
      .filter((item) => !item.submission || item.submission.status === "RESUBMIT_REQUESTED")
      .filter((item) => new Date(item.submissionDate).getTime() >= now - 86400000)
      .sort((a, b) => new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime())
      .slice(0, 5);
  }, [items]);

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[12px] text-[#9CA3AF]">
          <Link to={basePath} className="hover:text-[#6B7280]">
            Dashboard
          </Link>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-[#6B7280]">Homework</span>
        </p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-[#1A1A1A]">My Assignments</h1>
        {!canSubmitHomework ? (
          <p className="mt-1 text-[12px] text-[#6B7280]">View-only guardian access.</p>
        ) : null}
      </div>

      {error && <p className="alert-error">{error}</p>}
      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading homework…</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Assignments",
                  value: stats.total,
                  sub: "This Month",
                  Icon: AssignmentOutlined,
                  bg: PRIMARY_SOFT,
                  fg: PRIMARY,
                },
                {
                  label: "Completed",
                  value: stats.completed,
                  sub: "This Month",
                  Icon: CheckCircleOutlineRounded,
                  bg: "#ECFDF5",
                  fg: "#059669",
                },
                {
                  label: "Pending",
                  value: stats.pending,
                  sub: "This Month",
                  Icon: ScheduleRounded,
                  bg: "#FFF7ED",
                  fg: "#D97706",
                },
                {
                  label: "Overdue",
                  value: stats.overdue,
                  sub: "This Month",
                  Icon: WarningAmberRounded,
                  bg: "#FEF2F2",
                  fg: "#E11D48",
                },
              ].map((card) => (
                <Card key={card.label} className="flex items-center gap-3 !p-4">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl"
                    style={{ background: card.bg, color: card.fg }}
                  >
                    <card.Icon sx={{ fontSize: 22 }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#9CA3AF]">{card.label}</p>
                    <p className="text-[22px] font-bold leading-tight text-[#1A1A1A]">{card.value}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{card.sub}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Table card */}
            <Card className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["ALL", "All"],
                      ["PENDING", "Pending"],
                      ["SUBMITTED", "Submitted"],
                      ["OVERDUE", "Overdue"],
                    ] as const
                  ).map(([key, label]) => {
                    const active = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                          active ? "text-white" : "bg-[#F6F7F9] text-[#6B7280] hover:bg-[#EEF0FD]"
                        }`}
                        style={active ? { background: PRIMARY } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A1A1A] outline-none"
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                  >
                    <option value="ALL">All Subjects</option>
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold text-[#1A1A1A] outline-none"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                  >
                    <option value="due-asc">Due Date ↑</option>
                    <option value="due-desc">Due Date ↓</option>
                    <option value="title">Title</option>
                  </select>
                  <span className="grid size-9 place-items-center rounded-xl bg-[#F6F7F9] text-[#6B7280]">
                    <FilterListRounded sx={{ fontSize: 18 }} />
                  </span>
                </div>
              </div>

              {pageItems.length === 0 ? (
                <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">No assignments match these filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-5 py-3 font-semibold">Assignment</th>
                        <th className="px-5 py-3 font-semibold">Subject</th>
                        <th className="px-5 py-3 font-semibold">Due Date</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item) => {
                        const status = deriveStatus(item);
                        const meta = statusMeta(status);
                        return (
                          <tr key={item.id} className="border-b border-[#F1F2F6] last:border-0">
                            <td className="px-5 py-3.5">
                              <div className="flex items-start gap-3">
                                <span
                                  className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl"
                                  style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                                >
                                  <AssignmentOutlined sx={{ fontSize: 18 }} />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-[#1A1A1A]">{item.title}</p>
                                  <p className="line-clamp-1 text-[11px] text-[#9CA3AF]">
                                    {item.description || "Complete and submit this assignment."}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-2 font-semibold text-[#1A1A1A]">
                                <span className="size-2 rounded-full" style={{ background: subjectColor(item.subject) }} />
                                {item.subject}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#6B7280]">{formatDue(item.submissionDate)}</td>
                            <td className="px-5 py-3.5">
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={{ background: meta.bg, color: meta.fg }}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button
                                type="button"
                                className="rounded-xl border px-3 py-1.5 text-[12px] font-bold transition hover:bg-[#F6F7F9]"
                                style={{ borderColor: BORDER, color: PRIMARY }}
                                onClick={() => setActiveId(item.id)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {pageCount > 1 ? (
                <div className="flex items-center justify-center gap-1 border-t border-[#E5E7EB] px-5 py-3">
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`grid size-8 place-items-center rounded-lg text-[12px] font-bold ${
                        page === n ? "text-white" : "text-[#6B7280] hover:bg-[#F6F7F9]"
                      }`}
                      style={page === n ? { background: PRIMARY } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : null}
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <Card>
              <h2 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Upcoming Deadlines</h2>
              {upcoming.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[#6B7280]">No upcoming deadlines.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcoming.map((item) => {
                    const left = daysLeftLabel(item.submissionDate);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex gap-3 rounded-xl px-1 py-1 text-left hover:bg-[#F8F9FC]"
                        onClick={() => setActiveId(item.id)}
                      >
                        <span className="mt-1 w-1 shrink-0 rounded-full" style={{ background: subjectColor(item.subject) }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-[#9CA3AF]">
                            {new Date(item.submissionDate).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{item.title}</p>
                          <p className="truncate text-[11px] text-[#6B7280]">{item.subject}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold" style={{ color: left.tone }}>
                          {left.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Submission Status</h2>
                <span className="rounded-full bg-[#F6F7F9] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">
                  This Month
                </span>
              </div>
              <Donut submitted={stats.completed} pending={stats.pending} overdue={stats.overdue} />
              <div className="mt-4 space-y-2 text-[12px]">
                {[
                  { label: "Submitted", value: stats.completed, color: "#10B981" },
                  { label: "Pending", value: stats.pending, color: "#F59E0B" },
                  { label: "Overdue", value: stats.overdue, color: "#EF4444" },
                ].map((row) => {
                  const pct = stats.total ? ((row.value / stats.total) * 100).toFixed(1) : "0.0";
                  return (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                        <span className="size-2 rounded-full" style={{ background: row.color }} />
                        {row.label}
                      </span>
                      <span className="font-bold text-[#1A1A1A]">
                        {row.value} · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card
              className="relative overflow-hidden text-white"
              style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #3F3A9A 100%)` }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
              <div className="relative">
                <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-white/15">
                  <HeadphonesOutlined sx={{ fontSize: 22 }} />
                </span>
                <p className="text-[15px] font-bold">Need Help?</p>
                <p className="mt-1 text-[12px] text-white/80">Stuck on your homework?</p>
                <Link
                  to={`${basePath}/ai-tutor`}
                  className="mt-4 inline-flex items-center gap-1 rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold"
                  style={{ color: PRIMARY }}
                >
                  Ask AI Tutor →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Your School Name. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 font-medium">
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Privacy Policy
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Terms of Use
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Help & Support
          </Link>
        </div>
      </footer>

      {activeItem ? (
        <HomeworkDetailModal
          item={activeItem}
          canSubmit={canSubmitHomework}
          token={accessToken}
          onClose={() => setActiveId(null)}
          onSaved={async () => {
            setMessage("Homework submitted");
            setActiveId(null);
            await loadHomework();
            await reload();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function HomeworkDetailModal({
  item,
  canSubmit,
  token,
  onClose,
  onSaved,
  onError,
}: {
  item: PortalHomeworkItem;
  canSubmit: boolean;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [fileAttachment, setFileAttachment] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canAct = canSubmit && (!item.submission || item.submission.status === "RESUBMIT_REQUESTED");
  const status = deriveStatus(item);
  const meta = statusMeta(status);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      notifyError("Attachment must be 20MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileAttachment({ name: file.name, url: String(reader.result) });
      setAttachmentUrl("");
    };
    reader.onerror = () => notifyError("Unable to read the selected file");
    reader.readAsDataURL(file);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const attachment = fileAttachment?.url ?? (attachmentUrl.trim() || null);
    if (!answerText.trim() && !attachment) {
      onError("Enter an answer or attach a file");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/portal/homework/${item.id}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({
          answerText: answerText.trim() || null,
          attachmentUrl: attachment,
        }),
      });
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{item.subject}</p>
            <h2 className="mt-1 text-[18px] font-bold text-[#1A1A1A]">{item.title}</h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">Due {formatDue(item.submissionDate)}</p>
          </div>
          <button type="button" className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9]" onClick={onClose}>
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>

        <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>

        <p className="mt-4 text-[13px] leading-relaxed text-[#1A1A1A]">{item.description || "No additional instructions."}</p>

        {item.attachmentUrl ? (
          item.attachmentUrl.startsWith("data:") ? (
            <a className="mt-3 inline-block text-[13px] font-bold" style={{ color: PRIMARY }} href={item.attachmentUrl} download>
              Download attachment
            </a>
          ) : (
            <a
              className="mt-3 inline-block text-[13px] font-bold"
              style={{ color: PRIMARY }}
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open attachment
            </a>
          )
        ) : null}

        {item.submission?.review ? (
          <p className="mt-3 rounded-xl bg-[#EEF0FD] px-3 py-2 text-[12px] text-[#534AB7]">
            Teacher note: {item.submission.review}
          </p>
        ) : null}

        {canAct ? (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <textarea
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none focus:border-[#534AB7]"
              rows={4}
              placeholder="Your answer (optional if you attach a file)"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPick} />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-[12px] font-bold text-[#1A1A1A] hover:bg-[#F6F7F9]"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachFileOutlined sx={{ fontSize: 16 }} /> Choose file
              </button>
              {fileAttachment ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-[#EEF0FD] px-3 py-2 text-[12px] text-[#534AB7]">
                  <span className="truncate">{fileAttachment.name}</span>
                  <button type="button" onClick={() => setFileAttachment(null)}>
                    <CloseOutlined sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ) : (
                <input
                  className="mt-2 w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none"
                  type="url"
                  placeholder="…or attachment URL (optional)"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: PRIMARY }}
              >
                {busy ? "Submitting…" : item.submission?.status === "RESUBMIT_REQUESTED" ? "Resubmit" : "Submit homework"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-bold text-[#6B7280]"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="mt-5 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-bold text-[#6B7280]"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
