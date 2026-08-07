import { useEffect, useMemo, useState } from "react";
import { CampaignOutlined, CloseRounded } from "@mui/icons-material";
import { Dialog, DialogContent, Tab, Tabs } from "@mui/material";
import { apiRequest } from "../../lib/api";
import type { PortalNotice } from "../student-parent/portalTypes";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type NoticeCategory = "Circulars" | "Events" | "Fee Alerts" | "Exam Alerts";
type TabKey = "All" | NoticeCategory;

function inferCategory(notice: PortalNotice): NoticeCategory {
  const text = `${notice.title} ${notice.body}`.toLowerCase();
  if (/fee|tuition|payment|due/.test(text)) return "Fee Alerts";
  if (/exam|test|result|mark/.test(text)) return "Exam Alerts";
  if (/event|sports|day|festival|holiday|celebration|trip|meeting|pta|annual/.test(text)) {
    return "Events";
  }
  return "Circulars";
}

function formatWhen(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CATEGORY_TONE: Record<NoticeCategory, "blue" | "orange" | "red" | "green"> = {
  Circulars: "blue",
  Events: "orange",
  "Fee Alerts": "red",
  "Exam Alerts": "green",
};

export function ParentAnnouncementsPage() {
  const { activeChild, accessToken } = useParentPortal();
  const [notices, setNotices] = useState<PortalNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("All");
  const [selected, setSelected] = useState<PortalNotice | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiRequest<PortalNotice[]>("/portal/notices?limit=50", accessToken)
      .then((data) => setNotices(data ?? []))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load announcements");
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const filtered = useMemo(() => {
    if (tab === "All") return notices;
    return notices.filter((notice) => inferCategory(notice) === tab);
  }, [notices, tab]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Announcements"
        subtitle={`School notices for parents of ${activeChild.name}.`}
      />

      <Tabs
        value={tab}
        onChange={(_, value: TabKey) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 36,
          "& .MuiTab-root": { textTransform: "none", fontWeight: 700, minHeight: 36, fontSize: 13 },
          "& .Mui-selected": { color: `${PARENT_PRIMARY} !important` },
          "& .MuiTabs-indicator": { backgroundColor: PARENT_PRIMARY },
        }}
      >
        {(["All", "Circulars", "Events", "Fee Alerts", "Exam Alerts"] as TabKey[]).map((key) => (
          <Tab key={key} value={key} label={key} />
        ))}
      </Tabs>

      {loading ? (
        <p className="text-[13px] text-[#6B7280]">Loading announcements…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      ) : filtered.length === 0 ? (
        <p
          className="rounded-[20px] border bg-white px-5 py-12 text-center text-[13px] text-[#6B7280]"
          style={{ borderColor: PARENT_BORDER }}
        >
          No announcements in this category.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((notice) => {
            const category = inferCategory(notice);
            return (
              <li key={notice.id}>
                <button
                  type="button"
                  onClick={() => setSelected(notice)}
                  className="flex w-full items-start gap-3 rounded-[20px] border bg-white p-4 text-left shadow-[0_4px_18px_rgba(28,27,60,0.04)] transition hover:bg-[#F9FAFB]"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                  >
                    <CampaignOutlined sx={{ fontSize: 20 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-bold text-[#1A1A2E]">{notice.title}</p>
                      <StatusChip label={category} tone={CATEGORY_TONE[category]} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-[#6B7280]">{notice.body}</p>
                    <p className="mt-2 text-[11px] font-semibold text-[#9CA3AF]">
                      {formatWhen(notice.publishedAt)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogContent className="relative !p-6">
          <button
            type="button"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
            onClick={() => setSelected(null)}
          >
            <CloseRounded sx={{ fontSize: 18 }} />
          </button>
          {selected && (
            <>
              <p className="pr-8 text-[18px] font-extrabold text-[#1A1A2E]">{selected.title}</p>
              <p className="mt-1 text-[12px] text-[#6B7280]">{formatWhen(selected.publishedAt)}</p>
              <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[#374151]">
                {selected.body}
              </p>
              {selected.attachmentUrl && (
                <a
                  href={selected.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-[13px] font-bold text-[#4F46E5] hover:underline"
                >
                  Open attachment
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
