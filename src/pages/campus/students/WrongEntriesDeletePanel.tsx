import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DeleteOutline, WarningAmberOutlined } from "@mui/icons-material";
import Swal from "sweetalert2";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError } from "../../../lib/notify";
import {
  studentDisplayName,
  type Setup,
  type StudentList,
  type StudentListItem,
  type StudentStatus,
} from "./types";

const PAGE_SIZE = 10;

function classLabel(student: StudentListItem) {
  const enrollment = student.enrollments[0];
  if (!enrollment) return "—";
  return `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`;
}

export function WrongEntriesDeletePanel({
  setup,
  token,
  onDeleted,
}: {
  setup: Setup;
  token: string;
  onDeleted?: () => Promise<void> | void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StudentStatus>("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState<StudentList>({ items: [], total: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((item) => item.academicClass.name))].sort(),
    [setup.classSections],
  );

  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((item) => !classFilter || item.academicClass.name === classFilter)
      .map((item) => item.section.name);
    return [...new Set(sections)].sort();
  }, [setup.classSections, classFilter]);

  const classSectionId = useMemo(() => {
    if (!classFilter || !sectionFilter) return "";
    return (
      setup.classSections.find(
        (item) => item.academicClass.name === classFilter && item.section.name === sectionFilter,
      )?.id ?? ""
    );
  }, [setup.classSections, classFilter, sectionFilter]);

  async function loadStudents(nextPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(nextPage),
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (classSectionId) params.set("classSectionId", classSectionId);

      const data = await apiRequest<StudentList>(`/students?${params}`, token);
      let items = data?.items ?? [];
      let total = data?.total ?? items.length;
      if (!classSectionId && classFilter) {
        items = items.filter(
          (item) => item.enrollments[0]?.classSection.academicClass.name === classFilter,
        );
        total = items.length;
      }
      setStudents({ items, total });
      setSelectedIds([]);
      setConfirmText("");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load students");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, statusFilter, classSectionId, classFilter, sectionFilter]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadStudents(1);
  }

  const allSelected = students.items.length > 0 && selectedIds.length === students.items.length;
  const totalPages = Math.max(1, Math.ceil(students.total / PAGE_SIZE));
  const selectedStudents = students.items.filter((item) => selectedIds.includes(item.id));

  async function deleteSelected() {
    if (!selectedIds.length) return;
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      await Swal.fire({
        title: "Confirmation required",
        text: 'Type DELETE in the confirmation box before permanently removing students.',
        icon: "info",
        confirmButtonText: "OK",
        buttonsStyling: false,
        customClass: {
          popup: "swal-popup",
          title: "swal-title",
          htmlContainer: "swal-text",
          actions: "swal-actions",
          confirmButton: "swal-confirm",
        },
      });
      return;
    }

    const confirmed = await confirmDelete({
      title: "Delete wrong entries?",
      text: `Permanently delete ${selectedIds.length} student(s)? This cannot be rolled back.`,
      confirmText: "Yes, delete permanently",
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      const result = await apiRequest<{ deleted: number }>("/students/delete", token, {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      });
      await Swal.fire({
        title: "Deleted",
        text: `Permanently deleted ${result?.deleted ?? selectedIds.length} student(s).`,
        icon: "success",
        confirmButtonText: "OK",
        buttonsStyling: false,
        customClass: {
          popup: "swal-popup",
          title: "swal-title",
          htmlContainer: "swal-text",
          actions: "swal-actions",
          confirmButton: "swal-confirm",
        },
      });
      setSelectedIds([]);
      setConfirmText("");
      await loadStudents(page);
      await onDeleted?.();
    } catch (cause) {
      await Swal.fire({
        title: "Unable to delete",
        text:
          cause instanceof Error
            ? cause.message
            : "Unable to delete students. They may have fee or other linked records.",
        icon: "error",
        confirmButtonText: "OK",
        buttonsStyling: false,
        customClass: {
          popup: "swal-popup",
          title: "swal-title",
          htmlContainer: "swal-text",
          actions: "swal-actions",
          confirmButton: "swal-confirm",
        },
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900">
        <div className="flex items-start gap-2">
          <WarningAmberOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Wrong Entries Delete</p>
            <p className="mt-1">
              Use this only for mistaken admissions or wrong records. Deleting a student removes them
              from the system permanently and <strong>cannot be rolled back</strong>. Prefer{" "}
              <strong>Disable</strong> for real students who leave school.
            </p>
          </div>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <form
          className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 lg:flex-row lg:items-center"
          onSubmit={submitSearch}
        >
          <input
            className="nx-input min-w-0 flex-1"
            placeholder="Search by name, admission no, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="nx-input w-full lg:w-40"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSectionFilter("");
            }}
          >
            <option value="">Class: All</option>
            {classOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="nx-input w-full lg:w-36"
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="">Section: All</option>
            {sectionOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="nx-input w-full lg:w-40"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | StudentStatus)}
          >
            <option value="">Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Inactive</option>
            <option value="ALUMNI">Alumni</option>
          </select>
          <button type="submit" className="nx-btn-secondary" disabled={loading}>
            Search
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      setSelectedIds(e.target.checked ? students.items.map((item) => item.id) : []);
                      setConfirmText("");
                    }}
                    aria-label="Select all students on this page"
                  />
                </th>
                <th className="px-3 py-3 text-left">Student</th>
                <th className="px-3 py-3 text-left">Admission No.</th>
                <th className="px-3 py-3 text-left">Class / Section</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Mobile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    Loading students…
                  </td>
                </tr>
              ) : students.items.length ? (
                students.items.map((student) => {
                  const name = studentDisplayName(student);
                  return (
                    <tr key={student.id} className="hover:bg-rose-50/30">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(student.id)}
                          onChange={(e) => {
                            setSelectedIds((current) =>
                              e.target.checked
                                ? [...current, student.id]
                                : current.filter((id) => id !== student.id),
                            );
                            setConfirmText("");
                          }}
                          aria-label={`Select ${name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar
                            name={name}
                            photoUrl={student.photoUrl ?? undefined}
                            size={36}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{name}</p>
                            <p className="truncate text-[12px] text-slate-400">
                              {student.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-[12.5px] text-slate-600">
                        #{student.admissionNumber}
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-700">{classLabel(student)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`nx-pill ${
                            student.status === "ACTIVE"
                              ? "nx-pill-success"
                              : student.status === "DISABLED"
                                ? "nx-pill-warning"
                                : "nx-pill-neutral"
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-slate-600">
                        {student.mobile || "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No students found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {students.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              Page {page} of {totalPages} · {students.total} record(s)
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  void loadStudents(next);
                }}
              >
                Prev
              </button>
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  void loadStudents(next);
                }}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="nx-card p-5">
        <h3 className="text-[15px] font-bold text-slate-900">Permanent delete</h3>
        <p className="mt-1 text-[12.5px] text-slate-500">
          {selectedIds.length
            ? `${selectedIds.length} student(s) selected.`
            : "Select one or more students above."}
        </p>

        {selectedStudents.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedStudents.map((student) => (
              <span key={student.id} className="nx-pill nx-pill-danger">
                {studentDisplayName(student)} (#{student.admissionNumber})
              </span>
            ))}
          </div>
        ) : null}

        <label className="mt-4 block text-[12px] font-medium text-slate-600">
          Type <span className="font-mono font-bold text-rose-700">DELETE</span> to confirm
          <input
            className="nx-input mt-1 max-w-xs"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={!selectedIds.length}
          />
        </label>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!selectedIds.length || deleting || confirmText.trim().toUpperCase() !== "DELETE"}
          onClick={() => void deleteSelected()}
        >
          <DeleteOutline sx={{ fontSize: 16 }} />
          {deleting ? "Deleting…" : `Delete selected (${selectedIds.length})`}
        </button>
      </div>
    </section>
  );
}
