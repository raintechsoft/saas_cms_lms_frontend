import { useEffect, useMemo, useState } from "react";
import {
  CampaignOutlined,
  CheckCircleOutlineRounded,
  ExpandMoreRounded,
  EventAvailableOutlined,
  MailOutlineRounded,
  MenuBookOutlined,
  PushPinRounded,
  ChevronRightRounded,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { usePortal } from "./PortalContext";
import type { PortalNotice } from "./portalTypes";

const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";
const PAGE_SIZE = 6;
const READ_STORAGE_KEY = "portal.notices.readIds";

type NoticeCategory = "Important" | "Academic" | "Events" | "General";
type FilterTab = "ALL" | NoticeCategory;

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER, ...style }}
    >
      {children}
    </section>
  );
}

function categoryTone(category: NoticeCategory) {
  if (category === "Important") return { bg: "#FEE2E2", fg: "#E11D48", iconBg: "#FEE2E2", iconFg: "#E11D48" };
  if (category === "Academic") return { bg: "#DBEAFE", fg: "#2563EB", iconBg: "#DBEAFE", iconFg: "#2563EB" };
  if (category === "Events") return { bg: "#FFF7ED", fg: "#D97706", iconBg: "#FFF7ED", iconFg: "#D97706" };
  return { bg: "#ECFDF5", fg: "#059669", iconBg: "#ECFDF5", iconFg: "#059669" };
}

function inferCategory(notice: PortalNotice): NoticeCategory {
  const text = `${notice.title} ${notice.body}`.toLowerCase();
  if (/urgent|important|alert|exam result|board|fee due|mandatory|critical/.test(text)) {
    return "Important";
  }
  if (/exam|homework|syllabus|result|class test|assignment|academic|mark/.test(text)) {
    return "Academic";
  }
  if (/event|sports|day|festival|holiday|celebration|trip|meeting|pta|annual/.test(text)) {
    return "Events";
  }
  return "General";
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const target = new Date(value);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function CategoryIcon({ category }: { category: NoticeCategory }) {
  const tone = categoryTone(category);
  const Icon =
    category === "Important"
      ? CampaignOutlined
      : category === "Academic"
        ? MenuBookOutlined
        : category === "Events"
          ? EventAvailableOutlined
          : CampaignOutlined;
  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-2xl"
      style={{ background: tone.iconBg, color: tone.iconFg }}
    >
      <Icon sx={{ fontSize: 22 }} />
    </span>
  );
}

function NoticeDetailModal({
  notice,
  category,
  onClose,
}: {
  notice: PortalNotice;
  category: NoticeCategory;
  onClose: () => void;
}) {
  const tone = categoryTone(category);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {category}
            </span>
            <h2 className="mt-2 text-[18px] font-bold text-[#1A1A1A]">{notice.title}</h2>
            <p className="mt-1 text-[12px] text-[#6B7280]">{formatWhen(notice.publishedAt)}</p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#374151]">{notice.body}</p>
        {notice.attachmentUrl ? (
          <a
            href={notice.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-[13px] font-bold text-[#534AB7] hover:underline"
          >
            View attachment →
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PortalNoticesPage() {
  const { accessToken, child, basePath } = usePortal();
  const [notices, setNotices] = useState<PortalNotice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ studentId: child.student.id });
    apiRequest<PortalNotice[]>(`/portal/notices?${params}`, accessToken)
      .then(setNotices)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load notices");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id]);

  const enriched = useMemo(() => {
    return notices.map((notice, index) => {
      const category = inferCategory(notice);
      const publishedMs = new Date(notice.publishedAt).getTime();
      const isNew = Date.now() - publishedMs < 3 * 24 * 60 * 60 * 1000;
      const unread = !readIds.has(notice.id);
      const pinned = category === "Important" && index < 2;
      return { notice, category, isNew, unread, pinned };
    });
  }, [notices, readIds]);

  const filtered = useMemo(() => {
    return enriched.filter((row) => {
      if (tab !== "ALL" && row.category !== tab) return false;
      if (categoryFilter !== "ALL" && row.category !== categoryFilter) return false;
      return true;
    });
  }, [enriched, tab, categoryFilter]);

  const visible = filtered.slice(0, visibleCount);

  const stats = useMemo(() => {
    const unread = enriched.filter((r) => r.unread).length;
    const important = enriched.filter((r) => r.category === "Important").length;
    const upcoming = enriched.filter((r) => {
      if (r.category !== "Events") return false;
      const days = daysUntil(r.notice.expiresAt ?? r.notice.publishedAt);
      return days != null && days >= 0 && days <= 7;
    }).length;
    return {
      total: enriched.length,
      unread,
      important,
      upcoming: upcoming || enriched.filter((r) => r.category === "Events").length,
    };
  }, [enriched]);

  const categoryCounts = useMemo(() => {
    const counts: Record<NoticeCategory, number> = {
      Academic: 0,
      Events: 0,
      General: 0,
      Important: 0,
    };
    for (const row of enriched) counts[row.category] += 1;
    return counts;
  }, [enriched]);

  const featuredImportant = enriched.find((r) => r.category === "Important") ?? null;

  const upcomingEvents = useMemo(() => {
    return enriched
      .filter((r) => r.category === "Events")
      .slice(0, 4)
      .map((r) => {
        const base = r.notice.expiresAt ?? r.notice.publishedAt;
        const days = daysUntil(base);
        const date = new Date(base);
        return {
          id: r.notice.id,
          title: r.notice.title,
          when: formatWhen(base),
          day: String(date.getDate()).padStart(2, "0"),
          month: date.toLocaleString(undefined, { month: "short" }).toUpperCase(),
          countdown:
            days == null
              ? "Soon"
              : days === 0
                ? "Today"
                : days === 1
                  ? "1 Day"
                  : days > 0
                    ? `${days} Days`
                    : "Past",
          color: days != null && days <= 3 ? "#10B981" : "#3B82F6",
        };
      });
  }, [enriched]);

  const detail = enriched.find((r) => r.notice.id === detailId) ?? null;

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const row of enriched) next.add(row.notice.id);
      saveReadIds(next);
      return next;
    });
  }

  function openNotice(id: string) {
    markRead(id);
    setDetailId(id);
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Notices</h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Stay updated with all the important announcements and information.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: PRIMARY }}
          onClick={markAllRead}
          disabled={stats.unread === 0}
        >
          <CheckCircleOutlineRounded sx={{ fontSize: 18 }} />
          Mark all as read
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-2 text-[13px] font-medium text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Notices",
            value: String(stats.total),
            sub: "All announcements",
            subColor: "#6B7280",
            Icon: CampaignOutlined,
            bg: "#EEF0FD",
            fg: PRIMARY,
          },
          {
            label: "Unread Notices",
            value: String(stats.unread),
            sub: "Requires your attention",
            subColor: "#059669",
            Icon: MailOutlineRounded,
            bg: "#ECFDF5",
            fg: "#059669",
          },
          {
            label: "Important Notices",
            value: String(stats.important),
            sub: "High priority",
            subColor: "#D97706",
            Icon: PushPinRounded,
            bg: "#FFF7ED",
            fg: "#D97706",
          },
          {
            label: "Upcoming Events",
            value: String(stats.upcoming),
            sub: "In next 7 days",
            subColor: "#0284C7",
            Icon: EventAvailableOutlined,
            bg: "#E0F2FE",
            fg: "#0284C7",
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
              <p className="truncate text-[11px] font-semibold" style={{ color: card.subColor }}>
                {card.sub}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">All Notices</h2>
            <select
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold outline-none"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="ALL">All Categories</option>
              {(["Important", "Academic", "Events", "General"] as NoticeCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto px-5 py-3">
            {(["ALL", "Important", "Academic", "Events", "General"] as FilterTab[]).map((item) => {
              const active = tab === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setTab(item);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                    active ? "text-white" : "bg-[#F6F7F9] text-[#6B7280] hover:bg-[#EEF0FD]"
                  }`}
                  style={active ? { background: PRIMARY } : undefined}
                >
                  {item === "ALL" ? "All" : item}
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">Loading notices…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No notices match these filters.</p>
          ) : (
            <div className="divide-y divide-[#F1F2F6]">
              {visible.map((row) => {
                const tone = categoryTone(row.category);
                return (
                  <button
                    key={row.notice.id}
                    type="button"
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#F8F9FC]"
                    onClick={() => openNotice(row.notice.id)}
                  >
                    <CategoryIcon category={row.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-bold text-[#1A1A1A]">{row.notice.title}</p>
                        {row.pinned ? (
                          <PushPinRounded sx={{ fontSize: 14, color: "#E11D48" }} />
                        ) : null}
                        {row.isNew ? (
                          <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                            New
                          </span>
                        ) : null}
                        {row.unread ? <span className="size-2 rounded-full bg-rose-500" /> : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-[#6B7280]">{row.notice.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{ background: tone.bg, color: tone.fg }}
                        >
                          {row.category}
                        </span>
                        <span className="text-[11px] font-medium text-[#9CA3AF]">
                          {formatWhen(row.notice.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > visibleCount ? (
            <div className="flex justify-center border-t border-[#E5E7EB] px-5 py-4">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] px-4 py-2 text-[13px] font-bold text-[#534AB7] hover:bg-[#F6F7F9]"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Load More
                <ExpandMoreRounded sx={{ fontSize: 18 }} />
              </button>
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            className="!border-rose-100"
            style={{ background: "linear-gradient(180deg, #FFF1F2 0%, #FFFFFF 70%)" }}
          >
            <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-rose-100 text-rose-600">
              <PushPinRounded sx={{ fontSize: 22 }} />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-500">Important Notice</p>
            {featuredImportant ? (
              <>
                <h3 className="mt-1 text-[15px] font-bold text-[#1A1A1A]">{featuredImportant.notice.title}</h3>
                <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-[#6B7280]">
                  {featuredImportant.notice.body}
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl px-3.5 py-2 text-[12px] font-bold text-white"
                  style={{ background: PRIMARY }}
                  onClick={() => openNotice(featuredImportant.notice.id)}
                >
                  View Details
                </button>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-[#6B7280]">No important notices right now.</p>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Upcoming Events</h3>
              <button
                type="button"
                className="text-[12px] font-bold text-[#534AB7] hover:underline"
                onClick={() => {
                  setTab("Events");
                  setCategoryFilter("ALL");
                }}
              >
                View All
              </button>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-[#6B7280]">No upcoming events.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#F1F2F6] bg-[#FBFBFC] px-2.5 py-2.5 text-left hover:bg-[#F6F7F9]"
                    onClick={() => openNotice(event.id)}
                  >
                    <span
                      className="grid size-12 shrink-0 place-content-center rounded-xl text-center text-white"
                      style={{ background: event.color }}
                    >
                      <span className="text-[14px] font-bold leading-none">{event.day}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-90">
                        {event.month}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{event.title}</p>
                      <p className="truncate text-[11px] text-[#9CA3AF]">{event.when}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {event.countdown}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Notice Categories</h3>
              <button
                type="button"
                className="text-[12px] font-bold text-[#534AB7] hover:underline"
                onClick={() => {
                  setTab("ALL");
                  setCategoryFilter("ALL");
                }}
              >
                View All
              </button>
            </div>
            <div className="space-y-1">
              {(["Academic", "Events", "General", "Important"] as NoticeCategory[]).map((cat) => {
                const tone = categoryTone(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#F6F7F9]"
                    onClick={() => {
                      setTab(cat);
                      setCategoryFilter("ALL");
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <CategoryIcon category={cat} />
                    <span className="flex-1 text-[13px] font-bold text-[#1A1A1A]">{cat}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {categoryCounts[cat]}
                    </span>
                    <ChevronRightRounded sx={{ fontSize: 18, color: "#9CA3AF" }} />
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

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

      {detail ? (
        <NoticeDetailModal
          notice={detail.notice}
          category={detail.category}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
