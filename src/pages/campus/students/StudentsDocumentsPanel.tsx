import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CloudUploadOutlined,
  DeleteOutline,
  FolderOutlined,
  OpenInNewOutlined,
  RefreshOutlined,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import { assetUrl, apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { Setup, StudentList, StudentListItem } from "./types";
import { studentDisplayName } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  _count: { documents: number; children: number };
};

type DocRow = {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  folder: { id: string; name: string };
  uploadedBy: { id: string; name: string };
  student: {
    id: string;
    admissionNumber: string;
    name: string;
    status: string;
    classLabel: string | null;
  };
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentsDocumentsPanel({
  setup,
  token,
}: {
  setup: Setup;
  token: string;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<DocRow[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [uploadStudentId, setUploadStudentId] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const classOptions = useMemo(
    () =>
      [...setup.classSections].sort((a, b) =>
        `${a.academicClass.name}-${a.section.name}`.localeCompare(
          `${b.academicClass.name}-${b.section.name}`,
        ),
      ),
    [setup.classSections],
  );

  const loadFolders = useCallback(async () => {
    try {
      const data = await apiRequest<Folder[]>("/students/document-folders", token);
      setFolders(data ?? []);
      setFolderId((current) => current || data?.[0]?.id || "");
      setUploadFolderId((current) => current || data?.[0]?.id || "");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load folders");
    }
  }, [token]);

  const loadStudents = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: "100",
        page: "1",
        status: "ACTIVE",
      });
      if (classSectionId) params.set("classSectionId", classSectionId);
      const data = await apiRequest<StudentList>(`/students?${params}`, token);
      setStudents(data?.items ?? []);
      setUploadStudentId((current) =>
        current && (data?.items ?? []).some((s) => s.id === current) ? current : "",
      );
    } catch (error) {
      setStudents([]);
      notifyError(error instanceof Error ? error.message : "Failed to load students");
    }
  }, [token, classSectionId]);

  const loadDocuments = useCallback(async () => {
    if (!folderId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ folderId });
      if (classSectionId) params.set("classSectionId", classSectionId);
      if (search.trim()) params.set("search", search.trim());
      const data = await apiRequest<{ items: DocRow[] }>(`/students/documents?${params}`, token);
      setItems(data?.items ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [token, folderId, classSectionId, search]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!uploadStudentId || !uploadFolderId || !uploadFile) {
      notifyError("Select student, folder, and file");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("studentId", uploadStudentId);
      form.append("folderId", uploadFolderId);
      if (uploadName.trim()) form.append("name", uploadName.trim());

      const response = await fetch(`${API_URL}/students/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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
      setUploadFile(null);
      setUploadName("");
      await loadDocuments();
      await loadFolders();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(doc: DocRow) {
    const result = await Swal.fire({
      title: "Delete document?",
      text: `Delete "${doc.name}" for ${doc.student.name}?`,
      input: "text",
      inputLabel: "Delete reason",
      inputPlaceholder: "Wrong file / incorrect student / etc.",
      inputValidator: (value) =>
        !value || value.trim().length < 3 ? "Reason must be at least 3 characters" : undefined,
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed || !result.value) return;

    setBusy(true);
    try {
      await apiRequest(`/students/documents/${doc.id}/delete`, token, {
        method: "POST",
        body: JSON.stringify({ reason: String(result.value).trim() }),
      });
      notifySuccess("Document deleted");
      await loadDocuments();
      await loadFolders();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="nx-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FolderOutlined className="!text-[18px] text-sky-600" />
              Students Documents
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a folder from ERP Settings → Documents, filter by class/section, upload or
              delete (with reason). Students can also upload from the portal.
            </p>
          </div>
          <a href="/erp-settings" className="nx-btn-secondary text-xs">
            Manage folders
          </a>
        </div>

        {!folders.length ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No document folders yet. Create folders under ERP Settings → Documents (e.g.
            &quot;Previous year mark sheet&quot;).
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                  folderId === folder.id
                    ? "border-sky-400 bg-sky-50 text-sky-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setFolderId(folder.id)}
              >
                <span className="font-semibold">{folder.name}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {folder._count.documents} file(s)
                  {folder.parent ? ` · under ${folder.parent.name}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="nx-card flex flex-col gap-3 p-4 lg:flex-row lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <label className="min-w-0 flex-1 text-sm">
          Search
          <input
            className="nx-input mt-1 w-full"
            placeholder="Student name, admission no, document name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>
        <label className="text-sm lg:w-56">
          Class / Section
          <select
            className="nx-input mt-1 w-full"
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
        <div className="flex gap-2">
          <button type="submit" className="nx-btn-secondary" disabled={!folderId}>
            Filter
          </button>
          <button
            type="button"
            className="nx-btn-secondary"
            disabled={loading || !folderId}
            onClick={() => void loadDocuments()}
          >
            <RefreshOutlined className="!text-[16px]" /> Refresh
          </button>
        </div>
      </form>

      <form className="nx-card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={upload}>
        <div className="xl:col-span-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CloudUploadOutlined className="!text-[18px] text-indigo-600" />
            Upload document
          </h3>
        </div>
        <label className="text-sm">
          Student
          <select
            className="nx-input mt-1 w-full"
            required
            value={uploadStudentId}
            onChange={(e) => setUploadStudentId(e.target.value)}
          >
            <option value="">
              {students.length ? "Select student" : "No active students found"}
            </option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.admissionNumber} · {studentDisplayName(s)}
              </option>
            ))}
          </select>
          {!students.length ? (
            <p className="mt-1 text-[11px] text-amber-700">
              No students in this filter. Clear class filter or add active students first.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">{students.length} student(s) available</p>
          )}
        </label>
        <label className="text-sm">
          Folder
          <select
            className="nx-input mt-1 w-full"
            required
            value={uploadFolderId}
            onChange={(e) => setUploadFolderId(e.target.value)}
          >
            <option value="">Select folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Document name
          <input
            className="nx-input mt-1 w-full"
            placeholder="Optional (defaults to file name)"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
          />
        </label>
        <label className="text-sm">
          File
          <input
            className="nx-input mt-1 w-full"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx"
            required
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="nx-btn-primary w-full" disabled={busy}>
            Upload
          </button>
        </div>
      </form>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[960px]">
            <thead>
              <tr>
                <th>Document</th>
                <th>Student</th>
                <th>Class</th>
                <th>Uploaded by</th>
                <th>Size</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!folderId ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Select a folder to view documents.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    Loading documents...
                  </td>
                </tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                    No documents in this folder for the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((doc) => (
                  <tr key={doc.id}>
                    <td className="font-medium text-slate-800">{doc.name}</td>
                    <td>
                      <div>{doc.student.name}</div>
                      <div className="text-xs text-slate-500">{doc.student.admissionNumber}</div>
                    </td>
                    <td>{doc.student.classLabel ?? "—"}</td>
                    <td className="text-xs">{doc.uploadedBy.name}</td>
                    <td className="text-xs">{formatBytes(doc.sizeBytes)}</td>
                    <td className="text-xs">{new Date(doc.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <a
                          className="nx-btn-secondary !px-2 !py-1 text-xs"
                          href={assetUrl(doc.fileUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <OpenInNewOutlined className="!text-[14px]" /> Open
                        </a>
                        <button
                          type="button"
                          className="nx-btn-secondary !px-2 !py-1 text-xs text-rose-700"
                          disabled={busy}
                          onClick={() => void removeDoc(doc)}
                        >
                          <DeleteOutline className="!text-[14px]" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
