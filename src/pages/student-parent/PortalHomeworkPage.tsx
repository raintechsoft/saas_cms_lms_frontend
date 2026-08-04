import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AttachFileOutlined, CloseOutlined } from "@mui/icons-material";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { usePortal } from "./PortalContext";
import type { PortalHomeworkItem } from "./portalTypes";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function PortalHomeworkPage() {
  const { accessToken, child, canSubmitHomework, reload } = usePortal();
  const [items, setItems] = useState<PortalHomeworkItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

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
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </p>
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
  const [fileAttachment, setFileAttachment] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canAct = canSubmit && (!item.submission || item.submission.status === "RESUBMIT_REQUESTED");

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
      setOpen(false);
      setAnswerText("");
      setAttachmentUrl("");
      setFileAttachment(null);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to submit homework");
    } finally {
      setBusy(false);
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
          <span
            className={`badge ${item.submission.status === "RESUBMIT_REQUESTED" ? "badge-danger" : "badge-success"}`}
          >
            {item.submission.status}
          </span>
        ) : (
          <span className="badge">Not submitted</span>
        )}
      </div>
      <p className="mt-2 text-sm">{item.description}</p>
      {item.attachmentUrl &&
        (item.attachmentUrl.startsWith("data:") ? (
          <a
            className="mt-2 inline-block text-sm font-semibold text-indigo-700"
            href={item.attachmentUrl}
            download={`${item.title || "homework"}-attachment`}
          >
            Download attachment
          </a>
        ) : (
          <a
            className="mt-2 inline-block text-sm font-semibold text-indigo-700"
            href={item.attachmentUrl}
            target="_blank"
            rel="noreferrer"
          >
            Attachment
          </a>
        ))}
      {item.submission?.review && (
        <p className="mt-2 text-sm text-indigo-700">Teacher note: {item.submission.review}</p>
      )}
      {canAct &&
        (open ? (
          <form className="mt-3 rounded-lg bg-slate-50 p-3" onSubmit={submit}>
            <textarea
              className="input"
              placeholder="Your answer (optional if you attach a file)"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
            <div className="mt-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={onPick} />
              <button
                type="button"
                className="button-secondary text-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachFileOutlined sx={{ fontSize: 16 }} /> Choose file
              </button>
              {fileAttachment ? (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                  <span className="truncate">{fileAttachment.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-600"
                    onClick={() => setFileAttachment(null)}
                  >
                    <CloseOutlined sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ) : (
                <input
                  className="input mt-2"
                  type="url"
                  placeholder="…or attachment URL (optional)"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                />
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button className="button-primary" type="submit" disabled={busy}>
                {busy ? "Submitting…" : "Submit"}
              </button>
              <button
                className="button-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setAnswerText("");
                  setAttachmentUrl("");
                  setFileAttachment(null);
                }}
              >
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
