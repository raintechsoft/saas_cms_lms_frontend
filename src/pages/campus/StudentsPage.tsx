import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AddOutlined,
  CheckCircleOutline,
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutline,
  DownloadOutlined,
  FilterListOutlined,
  InsertDriveFileOutlined,
  IosShareOutlined,
  PersonAddAltOutlined,
  ShieldOutlined,
  SupportAgentOutlined,
  UploadOutlined,
  VisibilityOutlined,
  AccountBalanceWalletOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsTab, CmsTabs } from "../../components/cms/CmsLayout";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import type {
  ImportResult,
  MasterResource,
  Named,
  OnlineAdmission,
  Setup,
  StudentList,
  StudentListItem,
  StudentStatus,
} from "./students/types";
import { studentDisplayName } from "./students/types";

const SAMPLE_CSV = [
  "firstName,lastName,admissionDate,classSectionId,rollNumber,mobile,email,gender,dateOfBirth,fatherName,fatherPhone,motherName,photoUrl",
  "Aarav,Sharma,2026-04-01,,1,9876543210,aarav@example.com,MALE,2015-06-12,Raj Sharma,9876543211,Priya Sharma,",
].join("\n");

const PAGE_SIZE = 4;

type PageTab = "directory" | "admissions" | "import" | "masters";

async function apiDelete(path: string, token: string) {
  const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
  const response = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    if (text) {
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        /* ignore */
      }
    }
    throw new Error(message);
  }
}

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "students-import-sample.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportStudentsCsv(items: StudentListItem[]) {
  const header = ["admissionNumber", "firstName", "lastName", "email", "mobile", "status", "class", "admissionDate"];
  const rows = items.map((student) => {
    const enrollment = student.enrollments[0];
    const grade = enrollment
      ? `${enrollment.classSection.academicClass.name} ${enrollment.classSection.section.name}`
      : "";
    return [
      student.admissionNumber,
      student.firstName,
      student.lastName ?? "",
      student.email ?? "",
      student.mobile ?? "",
      student.status,
      grade,
      student.admissionDate?.slice(0, 10) ?? "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(",");
  });
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "students-export.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportAdmissionsCsv(items: OnlineAdmission[]) {
  const header = ["firstName", "lastName", "email", "mobile", "status", "class", "createdAt"];
  const rows = items.map((item) => {
    const grade = item.classSection
      ? `${item.classSection.academicClass.name} ${item.classSection.section.name}`
      : "";
    return [
      item.firstName,
      item.lastName ?? "",
      item.email ?? "",
      item.mobile ?? item.guardianPhone ?? "",
      item.status,
      grade,
      item.createdAt?.slice(0, 10) ?? "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(",");
  });
  const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "admissions-export.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function DirectoryStatusBadge({ status }: { status: StudentStatus }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === "ALUMNI") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
        <span className="size-1.5 rounded-full bg-slate-400" />
        Alumni
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Inactive
    </span>
  );
}

function headerForTab(tab: PageTab) {
  if (tab === "admissions") {
    return {
      title: "Admissions",
      description: "Review and process new student applications for the upcoming semester.",
    };
  }
  if (tab === "import") {
    return {
      title: "Students Directory",
      description: "Import student records with CSV upload or paste.",
    };
  }
  if (tab === "masters") {
    return {
      title: "Students Directory",
      description: "Manage categories, houses, and disable reasons.",
    };
  }
  return {
    title: "Students Directory",
    description: "Manage and view all enrolled student records",
  };
}

export function StudentsPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as { tab?: PageTab } | null)?.tab;
  const [tab, setTab] = useState<PageTab>(
    initialTab === "import" || initialTab === "admissions" || initialTab === "masters"
      ? initialTab
      : "directory",
  );
  const [setup, setSetup] = useState<Setup | null>(null);
  const [students, setStudents] = useState<StudentList>({ items: [], total: 0 });
  const [counts, setCounts] = useState({ active: 0, disabled: 0, alumni: 0, total: 0 });
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StudentStatus>("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [admissions, setAdmissions] = useState<OnlineAdmission[]>([]);

  const classOptions = useMemo(() => {
    if (!setup) return [] as string[];
    return [...new Set(setup.classSections.map((item) => item.academicClass.name))].sort();
  }, [setup]);

  const sectionOptions = useMemo(() => {
    if (!setup) return [] as string[];
    const sections = setup.classSections
      .filter((item) => !classFilter || item.academicClass.name === classFilter)
      .map((item) => item.section.name);
    return [...new Set(sections)].sort();
  }, [setup, classFilter]);

  const classSectionId = useMemo(() => {
    if (!setup || !classFilter || !sectionFilter) return "";
    return (
      setup.classSections.find(
        (item) => item.academicClass.name === classFilter && item.section.name === sectionFilter,
      )?.id ?? ""
    );
  }, [setup, classFilter, sectionFilter]);

  async function loadSetup() {
    setSetup(await apiRequest<Setup>("/students/setup", accessToken));
  }

  async function loadStudents(query = search, pageNum = page) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(pageNum),
    });
    if (query) params.set("search", query);
    if (statusFilter) params.set("status", statusFilter);

    if (classSectionId) {
      params.set("classSectionId", classSectionId);
      setStudents(await apiRequest<StudentList>(`/students?${params}`, accessToken));
      setSelectedIds([]);
      return;
    }

    // Class-only filter: load every section under that class (paged), then client-paginate.
    if (classFilter && setup) {
      const sectionIds = setup.classSections
        .filter((item) => item.academicClass.name === classFilter)
        .map((item) => item.id);
      const allItems: StudentListItem[] = [];
      for (const sectionId of sectionIds) {
        let sectionPage = 1;
        for (;;) {
          const sectionParams = new URLSearchParams({
            limit: "100",
            page: String(sectionPage),
            classSectionId: sectionId,
          });
          if (query) sectionParams.set("search", query);
          if (statusFilter) sectionParams.set("status", statusFilter);
          const chunk = await apiRequest<StudentList>(`/students?${sectionParams}`, accessToken);
          allItems.push(...(chunk.items ?? []));
          if (!chunk.items?.length || chunk.items.length < 100) break;
          sectionPage += 1;
          if (sectionPage > 50) break;
        }
      }
      const unique = [...new Map(allItems.map((item) => [item.id, item])).values()];
      const start = (pageNum - 1) * PAGE_SIZE;
      setStudents({
        items: unique.slice(start, start + PAGE_SIZE),
        total: unique.length,
      });
      setSelectedIds([]);
      return;
    }

    setStudents(await apiRequest<StudentList>(`/students?${params}`, accessToken));
    setSelectedIds([]);
  }

  async function loadCounts() {
    const [all, active, disabled, alumni] = await Promise.all([
      apiRequest<StudentList>("/students?limit=1", accessToken),
      apiRequest<StudentList>("/students?limit=1&status=ACTIVE", accessToken),
      apiRequest<StudentList>("/students?limit=1&status=DISABLED", accessToken),
      apiRequest<StudentList>("/students?limit=1&status=ALUMNI", accessToken),
    ]);
    setCounts({
      total: all.total,
      active: active.total,
      disabled: disabled.total,
      alumni: alumni.total,
    });
  }

  async function loadAdmissions() {
    setAdmissions(await apiRequest<OnlineAdmission[]>("/students/admissions", accessToken));
  }

  async function refreshDirectory() {
    await Promise.all([loadSetup(), loadStudents(), loadCounts(), loadAdmissions()]);
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshDirectory();
      } catch (cause) {
        notifyError(cause instanceof Error ? cause.message : "Unable to load students");
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    void loadStudents(search, page).catch((cause) => {
      notifyError(cause instanceof Error ? cause.message : "Unable to load students");
    });
  }, [page, statusFilter, classSectionId, classFilter]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void loadStudents(search, 1).catch((cause) => {
      notifyError(cause instanceof Error ? cause.message : "Unable to search students");
    });
  }

  async function deleteStudent(id: string) {
    if (!window.confirm("Delete this student?")) return;
    try {
      await apiRequest("/students/delete", accessToken, {
        method: "POST",
        body: JSON.stringify({ ids: [id] }),
      });
      notifySuccess("Student deleted");
      await refreshDirectory();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete student");
    }
  }

  async function deleteSelectedStudents() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected student(s)?`)) return;
    try {
      await apiRequest("/students/delete", accessToken, {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      });
      notifySuccess(`Deleted ${selectedIds.length} student(s)`);
      setSelectedIds([]);
      await refreshDirectory();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete selected students");
    }
  }

  async function exportDirectoryCsv() {
    try {
      const allItems: StudentListItem[] = [];
      let pageNum = 1;
      for (;;) {
        const params = new URLSearchParams({ limit: "100", page: String(pageNum) });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        if (classSectionId) params.set("classSectionId", classSectionId);
        const chunk = await apiRequest<StudentList>(`/students?${params}`, accessToken);
        let items = chunk.items ?? [];
        if (!classSectionId && classFilter) {
          items = items.filter(
            (item) => item.enrollments[0]?.classSection.academicClass.name === classFilter,
          );
        }
        allItems.push(...items);
        if (!chunk.items?.length || chunk.items.length < 100) break;
        pageNum += 1;
        if (pageNum > 50) break;
      }
      const unique = [...new Map(allItems.map((item) => [item.id, item])).values()];
      if (selectedIds.length) {
        exportStudentsCsv(unique.filter((item) => selectedIds.includes(item.id)));
      } else {
        exportStudentsCsv(unique);
      }
      notifySuccess("Students CSV downloaded");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to export students");
    }
  }

  const pendingAdmissions = useMemo(
    () => admissions.filter((item) => item.status === "PENDING").length,
    [admissions],
  );

  const totalPages = Math.max(1, Math.ceil(students.total / PAGE_SIZE));
  const from = students.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, students.total);
  const header = headerForTab(tab);
  const allSelected = students.items.length > 0 && selectedIds.length === students.items.length;

  return (
    <CmsPage>
      <CmsPageHeader
        title={header.title}
        description={header.description}
        actions={
          tab === "admissions" ? (
            <button
              type="button"
              className="nx-btn-primary !bg-slate-900 hover:!bg-slate-800"
              onClick={() => {
                exportAdmissionsCsv(admissions);
                notifySuccess("Admissions CSV downloaded");
              }}
            >
              <IosShareOutlined sx={{ fontSize: 16 }} /> Export List
            </button>
          ) : tab === "directory" ? (
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length ? (
                <>
                  <button type="button" className="nx-btn-secondary" onClick={() => void exportDirectoryCsv()}>
                    <IosShareOutlined sx={{ fontSize: 16 }} /> Export selected ({selectedIds.length})
                  </button>
                  <button
                    type="button"
                    className="nx-btn-secondary !text-rose-600"
                    onClick={() => void deleteSelectedStudents()}
                  >
                    <DeleteOutline sx={{ fontSize: 16 }} /> Delete selected
                  </button>
                </>
              ) : (
                <button type="button" className="nx-btn-secondary" onClick={() => void exportDirectoryCsv()}>
                  <IosShareOutlined sx={{ fontSize: 16 }} /> Export CSV
                </button>
              )}
              <button type="button" className="nx-btn-primary" onClick={() => navigate("/students/new")}>
                + Add New Student
              </button>
            </div>
          ) : (
            <button type="button" className="nx-btn-primary" onClick={() => navigate("/students/new")}>
              + Add New Student
            </button>
          )
        }
      />

      <CmsTabs>
        {(
          [
            ["directory", "Directory"],
            ["admissions", "Admissions"],
            ["import", "Import"],
            ["masters", "Masters"],
          ] as const
        ).map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
            {key === "admissions" && pendingAdmissions > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingAdmissions}
              </span>
            ) : null}
          </CmsTab>
        ))}
      </CmsTabs>

      {tab === "directory" ? (
        <section className="mt-4">
          <div className="nx-card overflow-hidden">
            <form
              className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 lg:flex-row lg:items-center"
              onSubmit={submitSearch}
            >
              <div className="relative min-w-0 flex-1">
                <input
                  className="nx-input w-full pl-3"
                  placeholder="Search by name, ID or parent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="nx-input w-full lg:w-40"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setSectionFilter("");
                  setPage(1);
                }}
              >
                <option value="">Class: All</option>
                {classOptions.map((name) => (
                  <option key={name} value={name}>
                    Class: {name}
                  </option>
                ))}
              </select>
              <select
                className="nx-input w-full lg:w-40"
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Section: All</option>
                {sectionOptions.map((name) => (
                  <option key={name} value={name}>
                    Section: {name}
                  </option>
                ))}
              </select>
              <select
                className="nx-input w-full lg:w-40"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as "" | StudentStatus);
                  setPage(1);
                }}
              >
                <option value="">Status: All</option>
                <option value="ACTIVE">Status: Active</option>
                <option value="DISABLED">Status: Inactive</option>
                <option value="ALUMNI">Status: Alumni</option>
              </select>
            </form>

            <div className="overflow-x-auto">
              <table className="nx-table min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked ? students.items.map((item) => item.id) : []);
                        }}
                        aria-label="Select all students"
                      />
                    </th>
                    <th className="px-3 py-3 text-left">Student Name</th>
                    <th className="px-3 py-3 text-left">Student ID</th>
                    <th className="px-3 py-3 text-left">Class/Section</th>
                    <th className="px-3 py-3 text-left">Parent Name</th>
                    <th className="px-3 py-3 text-left">Phone</th>
                    <th className="px-3 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.items.map((student) => {
                    const name = studentDisplayName(student);
                    const enrollment = student.enrollments[0];
                    const grade = enrollment
                      ? `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`
                      : "—";
                    return (
                      <tr key={student.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(student.id)}
                            onChange={(e) => {
                              setSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, student.id]
                                  : current.filter((id) => id !== student.id),
                              );
                            }}
                            aria-label={`Select ${name}`}
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={name} photoUrl={student.photoUrl ?? undefined} size={40} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{name}</p>
                              <p className="truncate text-[12px] text-slate-400">{student.email || "No email"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-[12.5px] text-slate-600">
                          #{student.admissionNumber}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600">
                            {grade}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600">{student.fatherName || "—"}</td>
                        <td className="px-3 py-3.5 text-slate-600">{student.mobile || "—"}</td>
                        <td className="px-3 py-3.5">
                          <DirectoryStatusBadge status={student.status} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-lg text-indigo-600 transition hover:bg-indigo-50"
                              title="View"
                              onClick={() => navigate(`/students/${student.id}`)}
                            >
                              <VisibilityOutlined sx={{ fontSize: 18 }} />
                            </button>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-lg text-rose-500 transition hover:bg-rose-50"
                              title="Delete"
                              onClick={() => void deleteStudent(student.id)}
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!students.items.length ? (
                <p className="px-5 py-12 text-center text-sm text-slate-500">No students found.</p>
              ) : null}
            </div>

            {students.total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
                <p className="text-[12px] text-slate-500">
                  Showing {from} to {to} of {students.total.toLocaleString()} students
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => {
                    const pageNum = index + 1;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold ${
                          page === pageNum ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 3 ? (
                    <>
                      <span className="px-1 text-slate-400">…</span>
                      <button
                        type="button"
                        onClick={() => setPage(totalPages)}
                        className={`grid min-w-8 place-items-center rounded-lg px-2 text-[12px] font-semibold ${
                          page === totalPages ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {totalPages}
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="nx-card flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <PersonAddAltOutlined sx={{ fontSize: 22 }} />
              </span>
              <div>
                <p className="text-[12px] font-medium text-slate-500">New Enrollments</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="text-[22px] font-bold text-slate-900">{counts.active.toLocaleString()}</p>
                  <span className="text-[12px] font-semibold text-emerald-600">↑ 12%</span>
                </div>
              </div>
            </div>
            <div className="nx-card flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <VerifiedUserOutlined sx={{ fontSize: 22 }} />
              </span>
              <div>
                <p className="text-[12px] font-medium text-slate-500">Attendance Rate</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="text-[22px] font-bold text-slate-900">94.2%</p>
                  <span className="text-[12px] font-semibold text-emerald-600">↑ 0.5%</span>
                </div>
              </div>
            </div>
            <div className="nx-card flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <AccountBalanceWalletOutlined sx={{ fontSize: 22 }} />
              </span>
              <div>
                <p className="text-[12px] font-medium text-slate-500">Fee Pendency</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="text-[22px] font-bold text-slate-900">$4,250</p>
                  <span className="text-[12px] font-semibold text-rose-600">↓ 8%</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "admissions" && setup ? (
        <AdmissionsPanel
          admissions={admissions}
          setup={setup}
          token={accessToken}
          onRefresh={async () => {
            await loadAdmissions();
            await refreshDirectory();
          }}
          onError={notifyError}
          onMessage={notifySuccess}
        />
      ) : null}

      {tab === "import" ? (
        <ImportPanel
          token={accessToken}
          onImported={async () => {
            setTab("directory");
            await refreshDirectory();
          }}
          onError={notifyError}
          onMessage={notifySuccess}
        />
      ) : null}

      {tab === "masters" && setup ? (
        <MastersPanel
          setup={setup}
          token={accessToken}
          onRefresh={async () => {
            await loadSetup();
          }}
          onError={notifyError}
          onMessage={notifySuccess}
        />
      ) : null}

      <CmsFooter />
    </CmsPage>
  );
}

function AdmissionsPanel({
  admissions,
  setup,
  token,
  onRefresh,
  onError,
  onMessage,
}: {
  admissions: OnlineAdmission[];
  setup: Setup;
  token: string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pageSize = 5;

  const pending = admissions.filter((item) => item.status === "PENDING");
  const accepted = admissions.filter((item) => item.status === "ACCEPTED");
  const rejected = admissions.filter((item) => item.status === "REJECTED");
  const rejectRate = admissions.length > 0 ? Math.round((rejected.length / admissions.length) * 100) : 0;

  const gradeBuckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of admissions) {
      const label = item.classSection ? item.classSection.academicClass.name : "Unassigned";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    const total = Math.max(1, admissions.length);
    return [...map.entries()]
      .map(([label, count]) => ({ label, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [admissions]);

  const paged = pending.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(pending.length / pageSize));
  const from = pending.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, pending.length);
  const monthLabel = new Date().toLocaleString(undefined, { month: "short" });

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="nx-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-[15px] font-bold text-slate-900">Pending Admissions</h2>
            {pending.length > 0 ? (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                {pending.length} New Items
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Student Name</th>
                  <th className="px-3 py-3">Applied Date</th>
                  <th className="px-3 py-3">Grade Level</th>
                  <th className="px-3 py-3">Previous School</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((application, index) => {
                  const name = studentDisplayName(application);
                  const grade = application.classSection
                    ? `${application.classSection.academicClass.name} ${application.classSection.section.name}`
                    : "—";
                  const previousSchool =
                    (typeof application.payload?.previousSchool === "string" && application.payload.previousSchool) ||
                    (typeof application.payload?.previous_school === "string" && application.payload.previous_school) ||
                    "—";
                  const admId = `#ADM-${new Date(application.createdAt).getFullYear()}-${String(index + from).padStart(3, "0")}`;
                  const isReviewing = reviewId === application.id;
                  const statusLabel = application.reviewNote ? "In Review" : "Pending";

                  return (
                    <Fragment key={application.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar name={name} size={38} />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{name}</p>
                              <p className="truncate text-[11px] text-slate-400">ID: {admId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-500">
                          {new Date(application.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-3 py-3.5 font-medium text-slate-700">{grade}</td>
                        <td className="px-3 py-3.5 text-slate-500">{previousSchool}</td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`nx-pill ${statusLabel === "In Review" ? "nx-pill-indigo" : "nx-pill-warning"}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            className="nx-btn-primary !px-3.5 !py-1.5 text-[12px]"
                            onClick={() => setReviewId(isReviewing ? null : application.id)}
                          >
                            {isReviewing ? "Close" : "Review"}
                          </button>
                        </td>
                      </tr>
                      {isReviewing ? (
                        <tr className="bg-indigo-50/40">
                          <td colSpan={6} className="px-5 py-4">
                            <AdmissionReviewForm
                              application={application}
                              setup={setup}
                              token={token}
                              onDone={async (success) => {
                                onMessage(success);
                                setReviewId(null);
                                await onRefresh();
                              }}
                              onError={onError}
                              onCancel={() => setReviewId(null)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {!pending.length ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">No pending admissions.</p>
            ) : null}
          </div>

          {pending.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="text-[12px] text-slate-500">
                Showing {from}-{to} of {pending.length} applications
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => {
                  const pageNum = index + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold ${
                        page === pageNum ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#0f172a] px-5 py-4 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Automated Screening Active</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">
              AI-assisted document verification has flagged {Math.min(3, pending.length)} potential duplicates.
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-900"
            >
              Run Validation Now
            </button>
          </div>
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-700/80 text-slate-200">
            <ShieldOutlined sx={{ fontSize: 28 }} />
          </span>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="nx-card p-5">
          <h3 className="text-[14px] font-bold text-slate-800">Admissions Stats</h3>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Pending</p>
                <span className="text-[11px] font-semibold text-rose-500">+12% vs LW</span>
              </div>
              <p className="mt-1 text-[22px] font-bold text-slate-900">{pending.length}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Accepted ({monthLabel})
                </p>
                <span className="text-[11px] font-semibold text-emerald-600">Target 100</span>
              </div>
              <p className="mt-1 text-[22px] font-bold text-slate-900">{accepted.length}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Rejected</p>
                <span className="text-[11px] font-semibold text-slate-400">{rejectRate}% Rate</span>
              </div>
              <p className="mt-1 text-[22px] font-bold text-slate-900">{rejected.length}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-bold text-slate-700">Top Applied Grades</p>
            <div className="mt-3 space-y-3">
              {gradeBuckets.length > 0 ? (
                gradeBuckets.map((bucket) => (
                  <div key={bucket.label}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-slate-600">{bucket.label}</span>
                      <span className="font-bold text-slate-800">{bucket.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.max(bucket.pct, 4)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-slate-400">No applications yet.</p>
              )}
            </div>
          </div>

          <Link to="/reports" className="nx-btn-secondary mt-5 w-full justify-center">
            View Detailed Report
          </Link>
        </div>

        <div className="rounded-2xl bg-[#0f172a] p-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-indigo-300">
              <SupportAgentOutlined sx={{ fontSize: 18 }} />
            </span>
            <div>
              <p className="text-[13px] font-bold">Need Guidance?</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
                Contact the IT team if the document scanner is failing to read transcripts.
              </p>
              <a
                href="mailto:support@nexus.local"
                className="mt-2.5 inline-block text-[12px] font-semibold text-white underline underline-offset-2"
              >
                Contact Tech Support
              </a>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}

function AdmissionReviewForm({
  application,
  setup,
  token,
  onDone,
  onError,
  onCancel,
}: {
  application: OnlineAdmission;
  setup: Setup;
  token: string;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const [classSectionId, setClassSectionId] = useState(application.classSection?.id ?? "");
  const [note, setNote] = useState(application.reviewNote ?? "");
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!classSectionId) {
      onError("Select a class section before accepting");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/students/admissions/${application.id}/accept`, token, {
        method: "POST",
        body: JSON.stringify({ classSectionId, note: note || undefined }),
      });
      await onDone("Admission accepted and student created");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to accept admission");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await apiRequest(`/students/admissions/${application.id}/reject`, token, {
        method: "POST",
        body: JSON.stringify({ note: note || undefined }),
      });
      await onDone("Admission rejected");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to reject admission");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-indigo-100 bg-white p-4 lg:grid-cols-[1fr_1fr_auto]">
      <div>
        <p className="nx-label">Class & section</p>
        <select className="nx-input" value={classSectionId} onChange={(e) => setClassSectionId(e.target.value)}>
          <option value="">Select class and section</option>
          {setup.classSections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.academicClass.name} · {item.section.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="nx-label">Review note</p>
        <input
          className="nx-input"
          placeholder="Optional note for this review"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex items-end gap-2">
        <button className="nx-btn-secondary" disabled={busy} type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="nx-btn-secondary text-rose-600" disabled={busy} type="button" onClick={() => void reject()}>
          Reject
        </button>
        <button className="nx-btn-primary" disabled={busy} type="button" onClick={() => void accept()}>
          Accept
        </button>
      </div>
    </div>
  );
}

function ImportPanel({
  token,
  onImported,
  onError,
  onMessage,
}: {
  token: string;
  onImported: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const rowEstimate = useMemo(() => {
    const lines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return Math.max(0, lines.length - (lines.length ? 1 : 0));
  }, [csv]);

  async function runImport() {
    if (csv.trim().length < 10) {
      onError("Paste or upload CSV content first");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const next = await apiRequest<ImportResult>("/students/import", token, {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setResult(next);
      onMessage(`${next.created} student(s) imported`);
      if (next.created > 0) await onImported();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to import students");
    } finally {
      setBusy(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv" && file.type !== "application/vnd.ms-excel") {
      onError("Please upload a .CSV file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError("CSV must be 10MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsText(file);
  }

  return (
    <section className="mt-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="nx-card flex flex-col p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <InsertDriveFileOutlined sx={{ fontSize: 18 }} />
            </span>
            <h2 className="text-[16px] font-bold text-slate-900">CSV Import</h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Follow our standard format to ensure data integrity. Required columns include:{" "}
            <span className="font-semibold text-slate-700">firstName, admissionDate, classSectionId</span>. Use the
            sample file for the full header set.
          </p>

          <button
            className="mt-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
            type="button"
            onClick={downloadSampleCsv}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-indigo-600 shadow-sm">
              <DownloadOutlined sx={{ fontSize: 20 }} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-slate-800">Download Template</span>
              <span className="block text-[12px] text-slate-500">Get the latest CSV structure (24KB)</span>
            </span>
          </button>

          <label
            className={`mt-4 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-12 text-center transition ${
              dragOver
                ? "border-indigo-400 bg-indigo-50/70"
                : "border-slate-300 bg-slate-50/70 hover:border-indigo-300 hover:bg-indigo-50/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              <CloudUploadOutlined sx={{ fontSize: 24 }} />
            </div>
            <p className="mt-3 text-[13px] font-semibold text-slate-700">Click to upload or drag and drop</p>
            <p className="mt-1 text-[11.5px] text-slate-500">Supported formats: .CSV (Max 10MB)</p>
          </label>

          {fileName ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <InsertDriveFileOutlined sx={{ fontSize: 18 }} className="shrink-0 text-indigo-500" />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-slate-700">{fileName}</p>
                  <p className="text-[11px] text-slate-400">
                    {rowEstimate.toLocaleString()} data row{rowEstimate === 1 ? "" : "s"} detected
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-[12px] font-semibold text-rose-600 hover:underline"
                onClick={() => {
                  setCsv("");
                  setFileName("");
                  setResult(null);
                }}
              >
                Remove
              </button>
            </div>
          ) : null}

          <button
            className="nx-btn-primary mt-5 w-full justify-center py-3"
            type="button"
            disabled={busy || csv.trim().length < 10}
            onClick={() => void runImport()}
          >
            {busy ? "Processing…" : "Initialize Import Processing"}
          </button>
        </div>

        <form
          className="nx-card flex flex-col p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void runImport();
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
              <FilterListOutlined sx={{ fontSize: 18 }} />
            </span>
            <h2 className="text-[16px] font-bold text-slate-900">Paste CSV Content</h2>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
            Prefer to copy-paste? Insert your raw CSV data below. Ensure your headers match the required column set
            exactly for successful validation.
          </p>

          <textarea
            className="nx-input mt-5 min-h-[300px] flex-1 font-mono text-xs leading-relaxed"
            placeholder={"firstName,admissionDate,classSectionId\nJohn,2024-09-01,CS101-A\nJane,2024-09-01,CS101-B"}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              if (fileName) setFileName("");
              setResult(null);
            }}
          />

          <div className="mt-4 flex justify-end">
            <button className="nx-btn-secondary uppercase tracking-wide" disabled={busy} type="submit">
              <UploadOutlined sx={{ fontSize: 16 }} />
              {busy ? "Importing…" : "Import Students"}
            </button>
          </div>

          {result ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
                <CheckCircleOutline sx={{ fontSize: 18 }} />
                {result.created} row(s) created successfully
              </p>
              {result.errors.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[13px] font-semibold text-rose-700">{result.errors.length} row error(s)</p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto">
                    {result.errors.map((item) => (
                      <p className="text-[12.5px] text-slate-600" key={`${item.row}-${item.message}`}>
                        Row {item.row}: {item.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function MastersPanel({
  setup,
  token,
  onRefresh,
  onError,
  onMessage,
}: {
  setup: Setup;
  token: string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-3">
      <MasterCard
        title="Categories"
        placeholder="Enter category"
        resource="categories"
        items={setup.categories}
        token={token}
        onRefresh={onRefresh}
        onError={onError}
        onMessage={onMessage}
      />
      <MasterCard
        title="Houses"
        placeholder="Enter house name"
        resource="houses"
        items={setup.houses}
        token={token}
        onRefresh={onRefresh}
        onError={onError}
        onMessage={onMessage}
      />
      <MasterCard
        title="Disable Reason"
        placeholder="Enter reason"
        resource="disable-reasons"
        items={setup.disableReasons}
        token={token}
        onRefresh={onRefresh}
        onError={onError}
        onMessage={onMessage}
      />
    </section>
  );
}

function MasterCard({
  title,
  placeholder,
  resource,
  items,
  token,
  onRefresh,
  onError,
  onMessage,
}: {
  title: string;
  placeholder: string;
  resource: MasterResource;
  items: Named[];
  token: string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiRequest(`/student-masters/${resource}`, token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      onMessage(`${title} entry added`);
      await onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add master");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/student-masters/${resource}/${id}`, token);
      onMessage("Master removed");
      await onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete master");
    }
  }

  return (
    <form className="nx-card p-5" onSubmit={add}>
      <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
      <div className="mt-3.5 flex gap-2">
        <input
          className="nx-input min-w-0 flex-1"
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="nx-btn-primary !px-3"
          disabled={busy || !name.trim()}
          type="submit"
          aria-label={`Add ${title}`}
        >
          <AddOutlined sx={{ fontSize: 18 }} />
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span className="nx-pill nx-pill-neutral inline-flex items-center gap-1.5" key={item.id}>
            {item.name}
            <button
              className="grid size-4 place-items-center rounded text-slate-400 transition hover:text-rose-600"
              type="button"
              aria-label={`Remove ${item.name}`}
              onClick={() => void remove(item.id)}
            >
              <CloseOutlined sx={{ fontSize: 12 }} />
            </button>
          </span>
        ))}
        {!items.length ? <p className="text-[13px] italic text-slate-400">No entries yet.</p> : null}
      </div>
    </form>
  );
}
