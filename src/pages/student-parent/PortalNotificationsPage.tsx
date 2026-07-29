import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { usePortal } from "./PortalContext";

type PortalNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  audience: string;
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

export function PortalNotificationsPage() {
  const { accessToken } = usePortal();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

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

  async function markOneRead(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiRequest(`/portal/notifications/${id}/read`, accessToken, { method: "PUT" });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark as read");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkAllBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{ updated: number }>(
        "/portal/notifications/read-all",
        accessToken,
        { method: "PUT" },
      );
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setMessage(`Marked ${result?.updated ?? 0} notification(s) as read.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to mark all as read");
    } finally {
      setMarkAllBusy(false);
    }
  }

  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fee reminders, announcements, and school updates for your account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
            onClick={() => void markAllRead()}
            disabled={markAllBusy || unread === 0}
          >
            {markAllBusy ? "Marking…" : `Mark all read${unread ? ` (${unread})` : ""}`}
          </button>
        </div>
      </div>

      {error ? <p className="alert-error">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading notifications…</p>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No notifications yet.
        </section>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
                item.isRead ? "border-slate-200" : "border-teal-200 ring-1 ring-teal-100"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.isRead ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        New
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {item.type}
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">{timeAgo(item.sentAt || item.createdAt)}</p>
                </div>
                {!item.isRead ? (
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    disabled={busyId === item.id}
                    onClick={() => void markOneRead(item.id)}
                  >
                    {busyId === item.id ? "Saving…" : "Mark read"}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Read</span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
