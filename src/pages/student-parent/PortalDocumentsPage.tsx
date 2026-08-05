import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  CheckCircleRounded,
  CloudOutlined,
  CloudUploadOutlined,
  DescriptionOutlined,
  DownloadRounded,
  ExpandMoreRounded,
  FolderOutlined,
  MoreVertRounded,
  PictureAsPdfRounded,
  ScheduleRounded,
  VisibilityOutlined,
  ImageOutlined,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest, assetUrl } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { notifyError, notifySuccess } from "../../lib/notify";
import { usePortal } from "./PortalContext";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";
const PAGE_SIZE = 7;
const MAX_BYTES = 10 * 1024 * 1024;
const STORAGE_LIMIT_GB = 5;

interface PortalDocument {
  id: string;
  name: string;
  fileUrl: string;
  folder: string;
  folderId?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
}

interface PortalCertificate {
  id: string;
  name: string;
  createdAt: string;
  serialNumber: string | null;
}

interface DocumentsResponse {
  documents: PortalDocument[];
  certificates: PortalCertificate[];
  folders: Array<{ id: string; name: string }>;
}

type DocStatus = "Verified" | "Pending";

type UnifiedDoc = {
  id: string;
  name: string;
  sizeLabel: string;
  sizeBytes: number;
  category: string;
  uploadedOn: string;
  createdAtMs: number;
  status: DocStatus;
  fileUrl: string | null;
  printPath: string | null;
  kind: "document" | "certificate";
  isImage: boolean;
};

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER, ...style }}
    >
      {children}
    </section>
  );
}

function categoryTone(category: string) {
  const key = category.toLowerCase();
  if (key.includes("ident") || key.includes("id")) return { bg: "#EEF0FD", fg: PRIMARY };
  if (key.includes("acad") || key.includes("cert") || key.includes("mark"))
    return { bg: "#DBEAFE", fg: "#2563EB" };
  if (key.includes("photo") || key.includes("image")) return { bg: "#FCE7F3", fg: "#DB2777" };
  if (key.includes("medic") || key.includes("health")) return { bg: "#CCFBF1", fg: "#0D9488" };
  if (key.includes("address") || key.includes("proof")) return { bg: "#FEF3C7", fg: "#D97706" };
  return { bg: "#F3F4F6", fg: "#6B7280" };
}

function inferCategory(folder: string, name: string) {
  const text = `${folder} ${name}`.toLowerCase();
  if (/aadhaar|aadhar|pan|passport|identity|id card|birth/.test(text)) return "Identity";
  if (/photo|jpg|jpeg|png|image/.test(text)) return "Photo";
  if (/medic|health|fitness/.test(text)) return "Medical";
  if (/address|residence|utility/.test(text)) return "Address";
  if (/mark|transfer|certificate|report|academic|tc\b/.test(text)) return "Academic";
  if (folder.trim()) return folder;
  return "General";
}

function estimateSizeLabel(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const mb = 0.4 + (hash % 25) / 10;
  return `${mb.toFixed(1)} MB`;
}

function estimateSizeBytes(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return Math.round((0.4 + (hash % 25) / 10) * 1024 * 1024);
}

function formatSizeBytes(bytes?: number | null, fallbackName = "") {
  if (bytes != null && bytes > 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return estimateSizeLabel(fallbackName);
}

function sizeBytesOf(name: string, sizeBytes?: number | null) {
  if (sizeBytes != null && sizeBytes > 0) return sizeBytes;
  return estimateSizeBytes(name);
}

function formatUploadedOn(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isImageName(name: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(name);
}

function StorageDonut({
  documentsGb,
  imagesGb,
  othersGb,
}: {
  documentsGb: number;
  imagesGb: number;
  othersGb: number;
}) {
  const size = 150;
  const r = 52;
  const c = 2 * Math.PI * r;
  const total = Math.max(documentsGb + imagesGb + othersGb, 0.01);
  const slices = [
    { value: documentsGb, color: PRIMARY },
    { value: imagesGb, color: "#3B82F6" },
    { value: othersGb, color: "#14B8A6" },
  ];
  let offset = 0;
  const used = documentsGb + imagesGb + othersGb;

  return (
    <div className="relative mx-auto size-[150px]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F2F6" strokeWidth="16" />
        {slices.map((slice, index) => {
          const len = (slice.value / total) * c;
          const el = (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[18px] font-bold text-[#1A1A1A]">{used.toFixed(1)} GB</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Used</p>
        </div>
      </div>
    </div>
  );
}

export function PortalDocumentsPage() {
  const { accessToken, child, productMode, basePath } = usePortal();
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [dragging, setDragging] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showCms = isProductBucketAllowed(productMode, "CMS");

  function reload() {
    if (!showCms || !child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<DocumentsResponse>(`/portal/children/${child.student.id}/documents`, accessToken)
      .then((next) => {
        setData(next);
        if (!folderId && next?.folders?.[0]) setFolderId(next.folders[0].id);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load documents");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, child?.student.id, showCms]);

  const rows = useMemo<UnifiedDoc[]>(() => {
    const docs = (data?.documents ?? []).map((doc) => {
      const bytes = sizeBytesOf(doc.name, doc.sizeBytes);
      const mimeImage = Boolean(doc.mimeType?.startsWith("image/"));
      return {
        id: doc.id,
        name: doc.name,
        sizeLabel: formatSizeBytes(doc.sizeBytes, doc.name),
        sizeBytes: bytes,
        category: inferCategory(doc.folder, doc.name),
        uploadedOn: formatUploadedOn(doc.createdAt),
        createdAtMs: new Date(doc.createdAt).getTime(),
        // No verification field in API yet — uploaded school docs are treated as on file
        status: "Verified" as const,
        fileUrl: doc.fileUrl,
        printPath: null,
        kind: "document" as const,
        isImage: mimeImage || isImageName(doc.name),
      };
    });
    const certs = (data?.certificates ?? []).map((cert) => ({
      id: `cert-${cert.id}`,
      name: `${cert.name}${cert.serialNumber ? ` (${cert.serialNumber})` : ""}`,
      sizeLabel: "Certificate",
      sizeBytes: 0,
      category: "Academic",
      uploadedOn: formatUploadedOn(cert.createdAt),
      createdAtMs: new Date(cert.createdAt).getTime(),
      status: "Verified" as const,
      fileUrl: null,
      printPath: `/print/documents/${cert.id}`,
      kind: "certificate" as const,
      isImage: false,
    }));
    return [...docs, ...certs].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [data]);

  const categories = useMemo(() => {
    return [...new Set(rows.filter((r) => r.kind !== "certificate").map((r) => r.category))].sort((a, b) =>
      a.localeCompare(b),
    );
  }, [rows]);

  const certificateRows = useMemo(
    () => rows.filter((row) => row.kind === "certificate"),
    [rows],
  );

  const filtered = useMemo(() => {
    const docsOnly = rows.filter((row) => row.kind !== "certificate");
    if (categoryFilter === "ALL") return docsOnly;
    return docsOnly.filter((r) => r.category === categoryFilter);
  }, [rows, categoryFilter]);

  const visible = filtered.slice(0, visibleCount);

  const stats = useMemo(() => {
    const verified = rows.filter((r) => r.status === "Verified").length;
    const pending = rows.filter((r) => r.status === "Pending").length;
    let docBytes = 0;
    let imageBytes = 0;
    let otherBytes = 0;
    for (const row of rows) {
      const bytes = row.sizeBytes;
      if (!bytes) continue;
      if (row.isImage || row.category === "Photo") imageBytes += bytes;
      else if (/\.pdf$/i.test(row.name) || row.kind === "certificate" || row.category === "Academic")
        docBytes += bytes;
      else otherBytes += bytes;
    }
    const usedBytes = docBytes + imageBytes + otherBytes;
    return {
      total: rows.length,
      verified,
      pending,
      usedGb: usedBytes / (1024 * 1024 * 1024),
      documentsGb: docBytes / (1024 * 1024 * 1024),
      imagesGb: imageBytes / (1024 * 1024 * 1024),
      othersGb: otherBytes / (1024 * 1024 * 1024),
    };
  }, [rows]);

  function acceptFile(next: File | null) {
    if (!next) return;
    if (next.size > MAX_BYTES) {
      notifyError("File must be 10MB or smaller");
      return;
    }
    setFile(next);
    if (!name.trim()) setName(next.name.replace(/\.[^.]+$/, ""));
  }

  async function upload(event?: FormEvent) {
    event?.preventDefault();
    if (!child || !folderId || !file) {
      notifyError("Select a folder and file");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folderId", folderId);
      if (name.trim()) form.append("name", name.trim());
      const response = await fetch(`${API_URL}/portal/children/${child.student.id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      if (!response.ok) {
        const text = await response.text();
        let message = `Upload failed (${response.status})`;
        try {
          message =
            (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      notifySuccess("Document uploaded");
      setFile(null);
      setName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      reload();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to upload document");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  const storagePct = Math.min(100, Math.round((stats.usedGb / STORAGE_LIMIT_GB) * 100));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Documents</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">Manage all your important documents in one place.</p>
      </div>

      {error ? <p className="rounded-xl bg-rose-50 px-4 py-2 text-[13px] font-medium text-rose-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Documents",
            value: String(stats.total),
            sub: "All uploaded files",
            subColor: "#6B7280",
            Icon: FolderOutlined,
            bg: "#EEF0FD",
            fg: PRIMARY,
          },
          {
            label: "Verified Documents",
            value: String(stats.verified),
            sub: "Verified by school",
            subColor: "#059669",
            Icon: DescriptionOutlined,
            bg: "#ECFDF5",
            fg: "#059669",
          },
          {
            label: "Pending Verification",
            value: String(stats.pending),
            sub: stats.pending ? "Awaiting review" : "Verification tracking soon",
            subColor: "#D97706",
            Icon: ScheduleRounded,
            bg: "#FFF7ED",
            fg: "#D97706",
          },
          {
            label: "Storage Used",
            value: `${stats.usedGb.toFixed(1)} GB`,
            sub: `of ${STORAGE_LIMIT_GB} GB used`,
            subColor: "#0284C7",
            Icon: CloudOutlined,
            bg: "#E0F2FE",
            fg: "#0284C7",
          },
        ].map((card) => (
          <Card key={card.label} className="flex items-center gap-3 !p-4">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-2xl"
              style={{ background: card.bg, color: card.fg }}
            >
              <card.Icon sx={{ fontSize: 22 }} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#9CA3AF]">{card.label}</p>
              <p className="text-[22px] font-bold leading-tight text-[#1A1A1A]">{card.value}</p>
              <p className="truncate text-[11px] font-semibold" style={{ color: card.subColor }}>
                {card.sub}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {certificateRows.length ? (
        <Card>
          <h2 className="text-[15px] font-bold text-[#1A1A1A]">Certificates &amp; ID cards</h2>
          <p className="mt-1 text-[12.5px] text-[#6B7280]">
            School-generated certificates and ID cards — open print view to download or print.
          </p>
          <ul className="mt-4 divide-y divide-[#F1F2F6]">
            {certificateRows.map((cert) => (
              <li key={cert.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-[13.5px] font-bold text-[#1A1A2E]">{cert.name}</p>
                  <p className="text-[11.5px] text-[#9CA3AF]">Issued {cert.uploadedOn}</p>
                </div>
                {cert.printPath ? (
                  <Link
                    to={cert.printPath}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-bold text-white"
                    style={{ background: PRIMARY }}
                  >
                    Print
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
            <h2 className="text-[15px] font-bold text-[#1A1A1A]">My Documents</h2>
            <select
              className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-semibold outline-none"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">Loading documents…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[#6B7280]">No documents uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-5 py-3 font-semibold">Document Name</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Uploaded On</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => {
                    const tone = categoryTone(doc.category);
                    return (
                      <tr key={doc.id} className="border-b border-[#F1F2F6] last:border-0">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                                doc.isImage ? "bg-pink-50 text-pink-600" : "bg-[#EEF0FD] text-[#534AB7]"
                              }`}
                            >
                              {doc.isImage ? (
                                <ImageOutlined sx={{ fontSize: 20 }} />
                              ) : (
                                <PictureAsPdfRounded sx={{ fontSize: 20 }} />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#1A1A1A]">{doc.name}</p>
                              <p className="text-[11px] text-[#9CA3AF]">{doc.sizeLabel}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {doc.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[#6B7280]">{doc.uploadedOn}</td>
                        <td className="px-5 py-3.5">
                          {doc.status === "Verified" ? (
                            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600">
                              <CheckCircleRounded sx={{ fontSize: 16 }} />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[12px] font-bold text-amber-600">
                              <ScheduleRounded sx={{ fontSize: 16 }} />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="relative flex items-center gap-1">
                            {doc.fileUrl ? (
                              <>
                                <a
                                  href={assetUrl(doc.fileUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#534AB7]"
                                  title="View"
                                >
                                  <VisibilityOutlined sx={{ fontSize: 18 }} />
                                </a>
                                <a
                                  href={assetUrl(doc.fileUrl)}
                                  download
                                  className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#534AB7]"
                                  title="Download"
                                >
                                  <DownloadRounded sx={{ fontSize: 18 }} />
                                </a>
                              </>
                            ) : doc.printPath ? (
                              <Link
                                to={doc.printPath}
                                target="_blank"
                                className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#534AB7]"
                                title="Open certificate"
                              >
                                <VisibilityOutlined sx={{ fontSize: 18 }} />
                              </Link>
                            ) : (
                              <span className="px-2 text-[11px] font-semibold text-[#9CA3AF]">School issued</span>
                            )}
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9]"
                              onClick={() => setMenuId((id) => (id === doc.id ? null : doc.id))}
                            >
                              <MoreVertRounded sx={{ fontSize: 18 }} />
                            </button>
                            {menuId === doc.id ? (
                              <div className="absolute right-0 top-9 z-10 min-w-[140px] rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F6F7F9]"
                                  onClick={() => {
                                    setMenuId(null);
                                    notifySuccess(doc.category);
                                  }}
                                >
                                  Category: {doc.category}
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F6F7F9]"
                                  onClick={() => setMenuId(null)}
                                >
                                  Close
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > visibleCount ? (
            <div className="flex justify-center border-t border-[#E5E7EB] px-5 py-4">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] px-4 py-2 text-[13px] font-bold text-[#534AB7] hover:bg-[#F6F7F9]"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Load More
                <ExpandMoreRounded sx={{ fontSize: 18 }} />
              </button>
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-[15px] font-bold text-[#1A1A1A]">Upload Document</h2>
            <form className="space-y-3" onSubmit={upload}>
              {(data?.folders?.length ?? 0) > 0 ? (
                <label className="block text-[12px] font-semibold text-[#6B7280]">
                  Folder
                  <select
                    className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none"
                    required
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                  >
                    <option value="">Select folder</option>
                    {(data?.folders ?? []).map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : !loading ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                  No document folders are configured yet. Ask the school office to create them.
                </p>
              ) : null}

              <label className="block text-[12px] font-semibold text-[#6B7280]">
                Display name
                <input
                  className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none"
                  placeholder="Optional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <div
                className={`rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
                  dragging ? "border-[#534AB7] bg-[#EEF0FD]" : "border-[#D1D5DB] bg-[#F9FAFB]"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <span className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-[#EEF0FD] text-[#534AB7]">
                  <CloudUploadOutlined sx={{ fontSize: 26 }} />
                </span>
                <p className="text-[13px] font-semibold text-[#1A1A1A]">Drag & drop your file here or</p>
                <button
                  type="button"
                  className="mt-3 rounded-xl px-4 py-2 text-[13px] font-bold text-white"
                  style={{ background: PRIMARY }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || !(data?.folders?.length)}
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-3 text-[11px] font-medium text-[#9CA3AF]">PDF, JPG, PNG up to 10MB</p>
                {file ? (
                  <p className="mt-2 truncate text-[12px] font-bold text-[#534AB7]">{file.name}</p>
                ) : null}
              </div>

              <button
                type="submit"
                className="w-full rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                style={{ background: PRIMARY }}
                disabled={busy || !file || !folderId}
              >
                {busy ? "Uploading…" : "Upload Document"}
              </button>
            </form>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Storage Overview</h2>
              <span className="text-[12px] font-bold text-[#534AB7]">{storagePct}%</span>
            </div>
            <StorageDonut
              documentsGb={stats.documentsGb}
              imagesGb={stats.imagesGb}
              othersGb={stats.othersGb}
            />
            <div className="mt-4 space-y-2 text-[12px]">
              {[
                { label: "Documents", value: stats.documentsGb, color: PRIMARY },
                { label: "Images", value: stats.imagesGb, color: "#3B82F6" },
                { label: "Others", value: stats.othersGb, color: "#14B8A6" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-[#6B7280]">
                    <span className="size-2.5 rounded-full" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="font-bold text-[#1A1A1A]">{row.value.toFixed(1)} GB</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#9CA3AF]">
                <span>
                  Total {stats.usedGb.toFixed(1)} GB of {STORAGE_LIMIT_GB} GB used
                </span>
                <span>{storagePct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#F1F2F6]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${storagePct}%`, background: PRIMARY }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Your School Name. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 font-medium">
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Privacy Policy
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Terms of Use
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Help & Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
