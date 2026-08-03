import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  CloudUploadOutlined,
  ImageOutlined,
  InfoOutlined,
} from "@mui/icons-material";
import { assetUrl } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { Setup } from "./types";

const MAX_FILES = 20;
const MAX_BYTES = 500 * 1024;
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

type UploadResultRow = {
  fileName: string;
  admissionNumber: string | null;
  status: "UPDATED" | "NOT_FOUND" | "INVALID_NAME" | "TOO_LARGE" | "FAILED";
  studentId?: string;
  studentName?: string;
  photoUrl?: string;
  message?: string;
};

type BulkUploadResponse = {
  total: number;
  updated: number;
  failed: number;
  results: UploadResultRow[];
};

function statusPill(status: UploadResultRow["status"]) {
  switch (status) {
    case "UPDATED":
      return "nx-pill nx-pill-success";
    case "NOT_FOUND":
    case "INVALID_NAME":
    case "TOO_LARGE":
    case "FAILED":
      return "nx-pill nx-pill-danger";
    default:
      return "nx-pill nx-pill-neutral";
  }
}

export function StudentImageUploadPanel({
  setup,
  token,
}: {
  setup: Setup;
  token: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [classSectionId, setClassSectionId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BulkUploadResponse | null>(null);

  const classOptions = useMemo(
    () =>
      [...setup.classSections].sort((a, b) =>
        `${a.academicClass.name}-${a.section.name}`.localeCompare(
          `${b.academicClass.name}-${b.section.name}`,
        ),
      ),
    [setup.classSections],
  );

  function addFiles(next: FileList | File[]) {
    const incoming = [...next].filter((file) => file.type.startsWith("image/"));
    if (!incoming.length) {
      notifyError("Please select JPG or PNG image files");
      return;
    }
    setFiles((current) => {
      const merged = [...current];
      for (const file of incoming) {
        if (merged.length >= MAX_FILES) break;
        if (merged.some((item) => item.name === file.name && item.size === file.size)) continue;
        merged.push(file);
      }
      if (incoming.length + current.length > MAX_FILES) {
        notifyError(`Only ${MAX_FILES} images can be uploaded in one batch`);
      }
      return merged.slice(0, MAX_FILES);
    });
    setResult(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!files.length) {
      notifyError("Select at least one image named as the admission number");
      return;
    }

    const oversize = files.filter((file) => file.size > MAX_BYTES);
    if (oversize.length) {
      notifyError(
        `${oversize.length} file(s) exceed 500KB. Resize them before upload (recommended 200×200).`,
      );
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("photos", file);
      if (classSectionId) form.append("classSectionId", classSectionId);

      const response = await fetch(`${API_URL}/students/photos/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = (await response.json()) as {
        data?: BulkUploadResponse;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(body.error?.message ?? `Upload failed (${response.status})`);
      }
      const data = body.data!;
      setResult(data);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      notifySuccess(`Updated ${data.updated} of ${data.total} photo(s)`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to upload student images");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[13px] text-indigo-900">
        <div className="flex items-start gap-2">
          <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Student Image Upload</p>
            <p className="mt-1">
              Upload multiple photos class-wise. File name must be the student{" "}
              <strong>admission number</strong> (example: <code>SCL-1.jpg</code> or{" "}
              <code>133.png</code>). Hold Ctrl to select multiple files. Max{" "}
              <strong>{MAX_FILES}</strong> images per batch, up to <strong>500KB</strong> each.
              Recommended size: <strong>200×200</strong>. Desktop browsers work best; mobile upload
              is not recommended.
            </p>
          </div>
        </div>
      </div>

      <form className="nx-card space-y-4 p-5" onSubmit={upload}>
        <label className="block text-[12px] font-medium text-slate-600">
          Class / Section (optional filter)
          <select
            className="nx-input mt-1 max-w-md"
            value={classSectionId}
            onChange={(e) => setClassSectionId(e.target.value)}
          >
            <option value="">All classes</option>
            {classOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.academicClass.name} - {item.section.name}
              </option>
            ))}
          </select>
        </label>

        <div
          className={`rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${
            dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-slate-50/70"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">
            <CloudUploadOutlined sx={{ fontSize: 24 }} />
          </div>
          <p className="mt-3 text-[14px] font-semibold text-slate-800">
            Drop student photos here, or browse files
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            JPG / PNG · named as admission number · Ctrl multi-select · max {MAX_FILES}
          </p>
          <button
            type="button"
            className="nx-btn-secondary mt-4"
            onClick={() => inputRef.current?.click()}
          >
            <ImageOutlined sx={{ fontSize: 16 }} /> Choose images
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
            }}
          />
        </div>

        {files.length ? (
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-slate-800">
                Selected ({files.length}/{MAX_FILES})
              </p>
              <button
                type="button"
                className="text-[12px] font-semibold text-rose-600 hover:underline"
                onClick={() => {
                  setFiles([]);
                  setResult(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Clear all
              </button>
            </div>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}`}
                  className="flex items-center justify-between gap-3 text-[12.5px]"
                >
                  <span className="truncate font-medium text-slate-700">{file.name}</span>
                  <span
                    className={
                      file.size > MAX_BYTES ? "font-semibold text-rose-600" : "text-slate-400"
                    }
                  >
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || !files.length}
        >
          <CloudUploadOutlined sx={{ fontSize: 16 }} />
          {busy ? "Uploading…" : "Upload photos"}
        </button>
      </form>

      {result ? (
        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Upload result</h3>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Updated {result.updated} · Failed {result.failed} · Total {result.total}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">File</th>
                  <th className="px-3 py-3 text-left">Admission No.</th>
                  <th className="px-3 py-3 text-left">Student</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-left">Photo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.results.map((row) => (
                  <tr key={`${row.fileName}-${row.status}-${row.admissionNumber ?? ""}`}>
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-800">
                      {row.fileName}
                    </td>
                    <td className="px-3 py-3 font-mono text-[12.5px] text-slate-600">
                      {row.admissionNumber ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-slate-700">
                      {row.studentName ?? row.message ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={statusPill(row.status)}>{row.status}</span>
                    </td>
                    <td className="px-3 py-3">
                      {row.photoUrl ? (
                        <img
                          src={assetUrl(row.photoUrl)}
                          alt=""
                          className="size-10 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
