import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

type NoticeAudience = "ALL" | "STUDENTS" | "PARENTS";

interface CampusNotice {
  id: string;
  title: string;
  body: string;
  attachmentUrl: string | null;
  audience: NoticeAudience;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: { firstName: string; lastName: string };
  classSection: {
    academicClass: { name: string };
    section: { name: string };
  } | null;
}

const audienceOptions: NoticeAudience[] = ["ALL", "STUDENTS", "PARENTS"];

export function NoticesPage() {
  const { accessToken, user } = useAuth();
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("ALL");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.permissions.includes("settings.manage") ?? false;

  async function load() {
    try {
      setError("");
      setNotices(await apiRequest<CampusNotice[]>("/notices", accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load notices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function createNotice(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/notices", accessToken, {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          audience,
          attachmentUrl: attachmentUrl || null,
        }),
      });
      setTitle("");
      setBody("");
      setAttachmentUrl("");
      setAudience("ALL");
      setMessage("Notice published");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create notice");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!canManage || !window.confirm("Delete this notice?")) return;
    try {
      await apiRequest(`/notices/${id}`, accessToken, { method: "DELETE" });
      setMessage("Notice deleted");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete notice");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        eyebrow="Communications"
        title="Notices"
        description="Publish announcements for students, parents, or everyone."
      />

      {error && <p className="alert-error mt-6">{error}</p>}
      {message && (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>
      )}

      {canManage && (
        <section className="card mt-8 p-6">
          <h2 className="font-semibold">Create notice</h2>
          <form className="mt-4 space-y-4" onSubmit={createNotice}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Title</span>
              <input className="input" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Message</span>
              <textarea className="input" required minLength={2} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Audience</span>
                <select className="input" value={audience} onChange={(e) => setAudience(e.target.value as NoticeAudience)}>
                  {audienceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Attachment URL (optional)</span>
                <input className="input" type="url" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
              </label>
            </div>
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? "Publishing…" : "Publish notice"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-8 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading notices…</p>
        ) : notices.length === 0 ? (
          <div className="card p-6">
            <p className="text-sm text-slate-500">No notices yet.</p>
          </div>
        ) : (
          notices.map((notice) => (
            <article className="card p-6" key={notice.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{notice.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(notice.publishedAt).toLocaleString()}
                    {notice.classSection
                      ? ` · ${notice.classSection.academicClass.name} ${notice.classSection.section.name}`
                      : ""}
                    {` · ${notice.audience}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge">
                    {notice.createdBy.firstName} {notice.createdBy.lastName}
                  </span>
                  {canManage && (
                    <button className="button-secondary" type="button" onClick={() => void remove(notice.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notice.body}</p>
              {notice.attachmentUrl && (
                <a
                  className="mt-4 inline-block text-sm font-semibold text-indigo-700"
                  href={notice.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View attachment
                </a>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
