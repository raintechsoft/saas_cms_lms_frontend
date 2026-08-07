import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { PageHeader } from "./components/PageHeader";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY } from "./ParentPortalLayout";

type PortalNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
  sentAt: string;
  isRead: boolean;
};

function timeAgo(value: string) {
  const then = new Date(value).getTime();
  const deltaSec = Math.floor((Date.now() - then) / 1000);
  if (deltaSec < 60) return "Just now";
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  return `${Math.floor(deltaHr / 24)}d ago`;
}

export function ParentNotificationsPage() {
  const { accessToken } = useParentPortal();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<PortalNotification[]>(
        "/portal/notifications?limit=100",
        accessToken,
      );
      setItems(data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function markAllRead() {
    setBusy(true);
    try {
      await apiRequest("/portal/notifications/read-all", accessToken, { method: "PUT" });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark all as read");
    } finally {
      setBusy(false);
    }
  }

  async function markOne(id: string) {
    try {
      await apiRequest(`/portal/notifications/${id}/read`, accessToken, { method: "PUT" });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark as read");
    }
  }

  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        subtitle="Fee reminders, announcements, and school updates."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-[12px] font-bold text-[#374151]"
              style={{ borderColor: PARENT_BORDER }}
              onClick={() => void load()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: PARENT_PRIMARY }}
              disabled={busy || unread === 0}
              onClick={() => void markAllRead()}
            >
              Mark all read{unread ? ` (${unread})` : ""}
            </button>
          </div>
        }
      />

      {loading ? (
        <p className="text-[13px] text-[#6B7280]">Loading notifications…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p
          className="rounded-[20px] border bg-white px-5 py-12 text-center text-[13px] text-[#6B7280]"
          style={{ borderColor: PARENT_BORDER }}
        >
          No notifications yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  if (!item.isRead) void markOne(item.id);
                }}
                className="flex w-full items-start gap-3 rounded-[16px] border bg-white px-4 py-3.5 text-left"
                style={{
                  borderColor: PARENT_BORDER,
                  background: item.isRead ? "#fff" : "#EEF2FF",
                }}
              >
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ background: item.isRead ? "#D1D5DB" : PARENT_PRIMARY }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-bold text-[#1A1A2E]">{item.title}</p>
                    <span className="text-[11px] font-semibold text-[#9CA3AF]">
                      {timeAgo(item.sentAt || item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#4B5563]">{item.body}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
