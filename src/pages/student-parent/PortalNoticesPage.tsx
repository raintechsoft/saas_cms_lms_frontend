import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { usePortal } from "./PortalContext";
import type { PortalNotice } from "./portalTypes";

export function PortalNoticesPage() {
  const { accessToken, child } = usePortal();
  const [notices, setNotices] = useState<PortalNotice[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notices</h1>
        <p className="mt-1 text-sm text-slate-500">Announcements for your class and audience.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading notices…</p>
      ) : notices.length === 0 ? (
        <section className="card p-6">
          <p className="text-sm text-slate-500">No notices right now.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <article className="card p-6" key={notice.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
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
                <span className="badge">{notice.createdBy.firstName} {notice.createdBy.lastName}</span>
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
        </div>
      )}
    </div>
  );
}
