import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { ListPagination, paginateItems } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type NoticeAudience = "ALL" | "STUDENTS" | "PARENTS";

interface ClassSectionOption {
  id: string;
  academicClass: { name: string };
  section: { name: string };
}

interface CampusNotice {
  id: string;
  title: string;
  body: string;
  attachmentUrl: string | null;
  audience: NoticeAudience;
  publishedAt: string;
  expiresAt: string | null;
  classSectionId: string | null;
  createdBy: { firstName: string; lastName: string };
  classSection: {
    academicClass: { name: string };
    section: { name: string };
  } | null;
}

const audienceOptions: NoticeAudience[] = ["ALL", "STUDENTS", "PARENTS"];
const PAGE_SIZE = 5;

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function NoticesPage() {
  const { accessToken, user } = useAuth();
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoticeAudience>("ALL");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.permissions.includes("settings.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(notices, page, PAGE_SIZE), [notices, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [notices.length, page]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setAttachmentUrl("");
    setAudience("ALL");
    setClassSectionId("");
    setExpiresAt("");
  }

  async function load() {
    try {
      const [nextNotices, academics] = await Promise.all([
        apiRequest<CampusNotice[]>("/notices", accessToken),
        apiRequest<{ classSections: ClassSectionOption[] }>("/academics/setup", accessToken),
      ]);
      setNotices(nextNotices);
      setClassSections(academics.classSections);
      setPage(1);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load notices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  function startEdit(notice: CampusNotice) {
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
    setAudience(notice.audience);
    setAttachmentUrl(notice.attachmentUrl ?? "");
    setClassSectionId(notice.classSectionId ?? "");
    setExpiresAt(toDateInput(notice.expiresAt));
  }

  async function saveNotice(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const payload = {
      title,
      body,
      audience,
      attachmentUrl: attachmentUrl || null,
      classSectionId: classSectionId || null,
      expiresAt: expiresAt || null,
    };
    try {
      if (editingId) {
        await apiRequest(`/notices/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Notice updated");
      } else {
        await apiRequest("/notices", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Notice published");
      }
      resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : editingId ? "Unable to update notice" : "Unable to create notice");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete notice?",
      text: "This notice will be permanently removed.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/notices/${id}`, accessToken, { method: "DELETE" });
      if (editingId === id) resetForm();
      notifySuccess("Notice deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete notice");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Communications"
        title="Notices"
        description="Publish announcements for students, parents, or everyone."
      />

      <div className="page-scroll">
      {canManage && (
        <section className="card mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{editingId ? "Edit notice" : "Create notice"}</h2>
            {editingId && (
              <button className="button-secondary" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
          <form className="mt-4 space-y-4" onSubmit={saveNotice}>
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
                <span className="mb-1 block font-medium text-slate-700">Class section</span>
                <select className="input" value={classSectionId} onChange={(e) => setClassSectionId(e.target.value)}>
                  <option value="">All classes</option>
                  {classSections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.academicClass.name} · {item.section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Expires on (optional)</span>
                <input className="input" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Attachment URL (optional)</span>
                <input className="input" type="url" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
              </label>
            </div>
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update notice" : "Publish notice"}
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
          <>
            {pageRows.map((notice) => (
              <article className="card p-6" key={notice.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{notice.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(notice.publishedAt).toLocaleString()}
                      {notice.classSection
                        ? ` · ${notice.classSection.academicClass.name} ${notice.classSection.section.name}`
                        : " · All classes"}
                      {` · ${notice.audience}`}
                      {notice.expiresAt
                        ? ` · Expires ${new Date(notice.expiresAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="badge">
                      {notice.createdBy.firstName} {notice.createdBy.lastName}
                    </span>
                    {canManage && (
                      <>
                        <button className="button-secondary" type="button" onClick={() => startEdit(notice)}>
                          Edit
                        </button>
                        <button className="button-secondary" type="button" onClick={() => void remove(notice.id)}>
                          Delete
                        </button>
                      </>
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
            ))}
            <div className="card overflow-hidden">
              <ListPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={notices.length}
                onPageChange={setPage}
                label="notices"
              />
            </div>
          </>
        )}
      </section>
      </div>
    </main>
  );
}
