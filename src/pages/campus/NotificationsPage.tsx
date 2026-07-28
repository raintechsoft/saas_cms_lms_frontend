import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { ListPagination, paginateItems } from "../../components/ListPagination";
import { CmsFooter, CmsPage, CmsPageHeader } from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";

const PAGE_SIZE = 8;

type NotificationTypeKey = "ANNOUNCEMENT" | "FEE_OVERDUE" | "FEE_RECEIPT" | "HOMEWORK" | "EXAM";
type NotificationAudience = "ALL" | "STUDENTS" | "PARENTS";

type CampusNotification = {
  id: string;
  title: string;
  body: string;
  type: NotificationTypeKey;
  audience: NotificationAudience;
  emailSent: boolean;
  sentAt: string;
  createdAt: string;
  isRead: boolean;
};

type AcademicSession = { id: string; name: string };

const notificationTypeOptions: NotificationTypeKey[] = [
  "ANNOUNCEMENT",
  "FEE_OVERDUE",
  "FEE_RECEIPT",
  "HOMEWORK",
  "EXAM",
];

const notificationAudienceOptions: NotificationAudience[] = ["ALL", "STUDENTS", "PARENTS"];

function timeAgo(value: string) {
  const then = new Date(value).getTime();
  const deltaMs = Date.now() - then;
  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec < 60) return "Just now";
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDays = Math.floor(deltaHr / 24);
  return `${deltaDays}d ago`;
}

function notificationTypePill(type: NotificationTypeKey) {
  switch (type) {
    case "ANNOUNCEMENT":
      return "nx-pill nx-pill-indigo";
    case "FEE_OVERDUE":
      return "nx-pill nx-pill-warning";
    case "FEE_RECEIPT":
      return "nx-pill nx-pill-success";
    case "HOMEWORK":
      return "nx-pill nx-pill-neutral";
    case "EXAM":
      return "nx-pill nx-pill-indigo";
    default:
      return "nx-pill nx-pill-neutral";
  }
}

function emailStatusPill(emailSent: boolean) {
  return emailSent ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral";
}

function readStatusPill(isRead: boolean) {
  return isRead ? "nx-pill nx-pill-success" : "nx-pill nx-pill-warning";
}

export function NotificationsPage() {
  const { accessToken, user } = useAuth();

  const canManageNotifications = user?.permissions.includes("notifications.manage") ?? false;
  const canManageFees = user?.permissions.includes("fees.manage") ?? false;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remindersBusy, setRemindersBusy] = useState(false);
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [page, setPage] = useState(1);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [sessionId, setSessionId] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationTypeKey>("ANNOUNCEMENT");
  const [audience, setAudience] = useState<NotificationAudience>("ALL");
  const [sendEmail, setSendEmail] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewBody = useMemo(() => {
    if (!body.trim()) return "";
    return body.length > 120 ? `${body.slice(0, 120)}...` : body;
  }, [body]);

  const pageRows = useMemo(
    () => paginateItems(notifications, page, PAGE_SIZE),
    [notifications, page],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [notifications.length, page]);

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [notifs, setup] = await Promise.all([
        apiRequest<CampusNotification[]>("/notifications?scope=all&limit=200", accessToken),
        apiRequest<{ sessions: AcademicSession[] }>("/academics/setup", accessToken),
      ]);
      setNotifications(notifs ?? []);
      setPage(1);
      setSessions(setup?.sessions ?? []);
      setSessionId((current) => {
        if (current) return current;
        return setup?.sessions?.[0]?.id ?? "";
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function refreshNotifications() {
    const notifs = await apiRequest<CampusNotification[]>(
      "/notifications?scope=all&limit=200",
      accessToken,
    );
    setNotifications(notifs ?? []);
    setPage(1);
  }

  async function sendNotification(event: FormEvent) {
    event.preventDefault();
    if (!canManageNotifications) return;
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/notifications", accessToken, {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          type,
          audience,
          sendEmail: Boolean(sendEmail),
        }),
      });

      setTitle("");
      setBody("");
      setType("ANNOUNCEMENT");
      setAudience("ALL");
      setSendEmail(false);
      setMessage("Notification sent");
      await refreshNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send notification");
    } finally {
      setSubmitting(false);
    }
  }

  async function sendFeeOverdueReminders() {
    if (!canManageFees) return;
    if (!sessionId) return;
    setRemindersBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await apiRequest<{
        count: number;
        smsSent?: number;
        smsFailed?: number;
        smsErrors?: string[];
      }>("/notifications/fee-overdue", accessToken, {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      const smsSent = result?.smsSent ?? 0;
      const smsFailed = result?.smsFailed ?? 0;
      const smsNote =
        smsSent || smsFailed
          ? ` · SMS sent ${smsSent}, failed ${smsFailed}${
              result?.smsErrors?.length ? ` (${result.smsErrors[0]})` : ""
            }`
          : " · no SMS numbers found on overdue students";
      setMessage(`Fee overdue reminders sent: ${result?.count ?? 0}${smsNote}`);
      await refreshNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send fee overdue reminders");
    } finally {
      setRemindersBusy(false);
    }
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="Notifications"
        description="Manage communications and send overdue fee reminders."
      />

      {error ? <p className="alert-error mt-6">{error}</p> : null}
      {message ? (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="nx-card p-5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Sent notifications</h2>
              <p className="mt-1 text-[12.5px] text-slate-500">Recent items visible to you.</p>
            </div>
            <button type="button" className="nx-btn-secondary !px-3" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <table className="nx-table min-w-[880px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Audience</th>
                    <th className="px-3 py-3 text-left">Time</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-3 py-3 text-left">Read</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((n) => {
                    const preview = n.body.length > 80 ? `${n.body.slice(0, 80)}...` : n.body;
                    return (
                      <tr key={n.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-4 py-3.5">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{n.title}</p>
                            <p className="mt-1 line-clamp-2 truncate text-[12px] text-slate-500">{preview}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={notificationTypePill(n.type)}>{n.type}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="nx-pill nx-pill-neutral">{n.audience}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12.5px] font-medium text-slate-700">{timeAgo(n.sentAt)}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={emailStatusPill(n.emailSent)}>
                            {n.emailSent ? "Sent" : "Not sent"}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={readStatusPill(n.isRead)}>{n.isRead ? "Read" : "Unread"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {!loading && notifications.length > 0 ? (
            <ListPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={notifications.length}
              onPageChange={setPage}
              label="notifications"
            />
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="nx-card p-5">
            <h2 className="text-[15px] font-bold text-slate-900">Send notification</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">Broadcast messages to staff, students, or parents.</p>

            <form className="mt-4 space-y-4" onSubmit={sendNotification}>
              <label className="block text-sm">
                <span className="label">Title</span>
                <input
                  className="nx-input mt-1 w-full"
                  required
                  minLength={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                <span className="label">Message</span>
                <textarea
                  className="nx-input mt-1 w-full min-h-28"
                  required
                  minLength={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                {previewBody ? <p className="mt-2 text-[12px] text-slate-500">Preview: {previewBody}</p> : null}
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="label">Type</span>
                  <select
                    className="nx-input mt-1 w-full"
                    value={type}
                    onChange={(e) => setType(e.target.value as NotificationTypeKey)}
                  >
                    {notificationTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="label">Audience</span>
                  <select
                    className="nx-input mt-1 w-full"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value as NotificationAudience)}
                  >
                    {notificationAudienceOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">Send email</span>
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              </label>

              <button
                type="submit"
                className="nx-btn-primary w-full"
                disabled={!canManageNotifications || submitting || !title.trim() || !body.trim()}
              >
                {submitting ? "Sending..." : "Send notification"}
              </button>
              {!canManageNotifications ? (
                <p className="text-[12px] font-medium text-rose-600">
                  You do not have permission to send notifications.
                </p>
              ) : null}
            </form>
          </div>

          <div className="nx-card p-5">
            <h2 className="text-[15px] font-bold text-slate-900">Fee overdue reminders</h2>
            <p className="mt-1 text-[12.5px] text-slate-500">Generate reminder notifications for students with balances.</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="label">Academic session</span>
                <select
                  className="nx-input mt-1 w-full"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  disabled={sessions.length === 0}
                >
                  {sessions.length ? (
                    sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Loading sessions...</option>
                  )}
                </select>
              </label>

              <button
                type="button"
                className="nx-btn-secondary w-full"
                disabled={!canManageFees || remindersBusy || !sessionId}
                onClick={() => void sendFeeOverdueReminders()}
              >
                {remindersBusy ? "Sending..." : "Send fee overdue reminders"}
              </button>
              {!canManageFees ? (
                <p className="text-[12px] font-medium text-rose-600">
                  You do not have permission to send fee reminders.
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <CmsFooter />
    </CmsPage>
  );
}

