import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import type { PortalHomeworkItem } from "./portalTypes";

export function PortalHomeworkPage() {
  const { accessToken, child, productMode, basePath, canSubmitHomework, reload } = usePortal();
  const [items, setItems] = useState<PortalHomeworkItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const showLms = isProductBucketAllowed(productMode, "LMS");

  async function loadHomework() {
    if (!child) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      setItems(await apiRequest<PortalHomeworkItem[]>(`/portal/children/${child.student.id}/homework`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load homework");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!showLms) {
      setLoading(false);
      return;
    }
    void loadHomework();
  }, [accessToken, child?.student.id, showLms]);

  if (!showLms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Homework</h1>
        <p className="mt-1 text-sm text-slate-500">
          {canSubmitHomework ? "View assignments and submit your work." : "View-only guardian access."}
        </p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading homework…</p>
      ) : items.length === 0 ? (
        <section className="card p-6">
          <p className="text-sm text-slate-500">No homework assigned.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <HomeworkRow
              key={item.id}
              item={item}
              canSubmit={canSubmitHomework}
              token={accessToken}
              onSaved={async () => {
                setMessage("Homework submitted");
                await loadHomework();
                await reload();
              }}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HomeworkRow({
  item,
  canSubmit,
  token,
  onSaved,
  onError,
}: {
  item: PortalHomeworkItem;
  canSubmit: boolean;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const canAct = canSubmit && (!item.submission || item.submission.status === "RESUBMIT_REQUESTED");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/portal/homework/${item.id}/submissions`, token, {
        method: "POST",
        body: JSON.stringify({
          answerText,
          attachmentUrl: attachmentUrl || null,
        }),
      });
      setOpen(false);
      setAnswerText("");
      setAttachmentUrl("");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to submit homework");
    }
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-medium">{item.title}</p>
          <p className="text-sm text-slate-500">
            {item.subject} · Due {new Date(item.submissionDate).toLocaleDateString()}
          </p>
        </div>
        {item.submission ? (
          <span className={`badge ${item.submission.status === "RESUBMIT_REQUESTED" ? "badge-danger" : "badge-success"}`}>
            {item.submission.status}
          </span>
        ) : (
          <span className="badge">Not submitted</span>
        )}
      </div>
      <p className="mt-2 text-sm">{item.description}</p>
      {item.attachmentUrl && (
        <a className="mt-2 inline-block text-sm font-semibold text-indigo-700" href={item.attachmentUrl} target="_blank" rel="noreferrer">
          Attachment
        </a>
      )}
      {item.submission?.review && (
        <p className="mt-2 text-sm text-indigo-700">Teacher note: {item.submission.review}</p>
      )}
      {canAct &&
        (open ? (
          <form className="mt-3 rounded-lg bg-slate-50 p-3" onSubmit={submit}>
            <textarea
              className="input"
              required
              placeholder="Your answer"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <input
              className="input mt-2"
              type="url"
              placeholder="Attachment URL (optional)"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button className="button-primary" type="submit">
                Submit
              </button>
              <button className="button-secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="button-secondary mt-3" type="button" onClick={() => setOpen(true)}>
            {item.submission?.status === "RESUBMIT_REQUESTED" ? "Resubmit" : "Submit homework"}
          </button>
        ))}
    </article>
  );
}
