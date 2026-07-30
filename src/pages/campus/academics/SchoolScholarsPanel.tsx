import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  CloseOutlined,
  DeleteOutline,
  DownloadOutlined,
  EditOutlined,
  AccountBalanceOutlined,
  MilitaryTechOutlined,
  SearchOutlined,
  SchoolOutlined,
  VolunteerActivismOutlined,
} from "@mui/icons-material";
import { ListPagination } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, Scholar, ScholarListResult, ScholarshipType, ScholarStatus, StudentListItem } from "./types";
import { downloadCsv, studentDisplayName } from "./utils";

const PAGE_SIZE = 10;
const SCHOLARSHIP_TYPES: ScholarshipType[] = ["MERIT", "NEED", "GOVERNMENT"];

interface FormState {
  studentId: string;
  studentLabel: string;
  academicSessionId: string;
  scholarshipType: ScholarshipType;
  scholarshipName: string;
  amount: string;
  validFrom: string;
  validTo: string;
  status: ScholarStatus;
  note: string;
}

const today = new Date().toISOString().slice(0, 10);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function emptyForm(sessionId: string): FormState {
  return {
    studentId: "",
    studentLabel: "",
    academicSessionId: sessionId,
    scholarshipType: "MERIT",
    scholarshipName: "",
    amount: "",
    validFrom: today,
    validTo: today,
    status: "ACTIVE",
    note: "",
  };
}

export function SchoolScholarsPanel({
  setup,
  token,
  canManage,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  canManage: boolean;
  onError: (message: string) => void;
}) {
  const [sessionFilter, setSessionFilter] = useState(setup.currentSession?.id ?? "");
  const [classFilter, setClassFilter] = useState("");
  const [classSectionFilter, setClassSectionFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ScholarshipType>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ScholarListResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Scholar | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(setup.currentSession?.id ?? ""));
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  const filterClassSections = useMemo(
    () => setup.classSections.filter((item) => !classFilter || item.academicClass.id === classFilter),
    [setup.classSections, classFilter],
  );

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (sessionFilter) params.set("sessionId", sessionFilter);
      if (classSectionFilter) params.set("classSectionId", classSectionFilter);
      else if (classFilter) params.set("classId", classFilter);
      if (typeFilter) params.set("scholarshipType", typeFilter);
      if (search.trim()) params.set("search", search.trim());
      const data = await apiRequest<ScholarListResult>(`/academics/scholars?${params}`, token);
      setResult(data);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load scholars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sessionFilter, classFilter, classSectionFilter, typeFilter, token]);

  useEffect(() => {
    const q = studentQuery.trim();
    if (q.length < 2) {
      setStudentOptions([]);
      return;
    }
    const handle = setTimeout(() => {
      void apiRequest<{ items: StudentListItem[] }>(
        `/students?status=ACTIVE&search=${encodeURIComponent(q)}&page=1&limit=10`,
        token,
      )
        .then((data) => setStudentOptions(data.items ?? []))
        .catch(() => setStudentOptions([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [studentQuery, token]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load();
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(sessionFilter || setup.currentSession?.id || ""));
    setStudentQuery("");
    setStudentOptions([]);
    setShowForm(true);
  }

  function startEdit(item: Scholar) {
    setEditing(item);
    setForm({
      studentId: item.student.id,
      studentLabel: `${studentDisplayName(item.student)} (${item.student.admissionNumber})`,
      academicSessionId: item.academicSession.id,
      scholarshipType: item.scholarshipType,
      scholarshipName: item.scholarshipName,
      amount: String(Number(item.amount)),
      validFrom: item.validFrom.slice(0, 10),
      validTo: item.validTo.slice(0, 10),
      status: item.status,
      note: item.note ?? "",
    });
    setShowForm(true);
  }

  function reset() {
    setShowForm(false);
    setEditing(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing && !form.studentId) {
      onError("Select a student.");
      return;
    }
    if (!form.academicSessionId) {
      onError("Select an academic session.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        scholarshipType: form.scholarshipType,
        scholarshipName: form.scholarshipName.trim(),
        amount: Number(form.amount) || 0,
        validFrom: form.validFrom,
        validTo: form.validTo,
        status: form.status,
        note: form.note.trim() || null,
      };
      if (editing) {
        await apiRequest(`/academics/scholars/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/academics/scholars", token, {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            studentId: form.studentId,
            academicSessionId: form.academicSessionId,
          }),
        });
      }
      reset();
      notifySuccess(editing ? "Scholar record updated." : "Scholar record created.");
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save scholar record");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Scholar) {
    const ok = await confirmDelete({
      title: "Delete scholar record?",
      text: `"${item.scholarshipName}" for ${studentDisplayName(item.student)} will be removed.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyKey(`delete-${item.id}`);
    try {
      await apiRequest(`/academics/scholars/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Scholar record deleted.");
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete scholar record");
    } finally {
      setBusyKey("");
    }
  }

  async function exportCsv() {
    try {
      const allItems: Scholar[] = [];
      let exportPage = 1;
      for (;;) {
        const params = new URLSearchParams({ page: String(exportPage), limit: "100" });
        if (sessionFilter) params.set("sessionId", sessionFilter);
        if (classSectionFilter) params.set("classSectionId", classSectionFilter);
        else if (classFilter) params.set("classId", classFilter);
        if (typeFilter) params.set("scholarshipType", typeFilter);
        if (search.trim()) params.set("search", search.trim());
        const data = await apiRequest<ScholarListResult>(`/academics/scholars?${params}`, token);
        allItems.push(...(data.items ?? []));
        if (allItems.length >= (data.pagination.total ?? 0) || !(data.items ?? []).length) break;
        exportPage += 1;
      }
      downloadCsv(
        "school-scholars.csv",
        ["student", "admissionNumber", "type", "scholarshipName", "amount", "status", "validFrom", "validTo"],
        allItems.map((item) => [
          studentDisplayName(item.student),
          item.student.admissionNumber,
          item.scholarshipType,
          item.scholarshipName,
          String(Number(item.amount)),
          item.status,
          item.validFrom.slice(0, 10),
          item.validTo.slice(0, 10),
        ]),
      );
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to export scholars");
    }
  }

  const stats = result?.stats;

  const typePill = (type: ScholarshipType) =>
    type === "GOVERNMENT" ? "nx-pill-indigo" : type === "MERIT" ? "nx-pill-success" : "nx-pill-warning";
  const statusPill = (status: ScholarStatus) =>
    status === "ACTIVE" ? "nx-pill-success" : status === "EXPIRED" ? "nx-pill-neutral" : "nx-pill-danger";
  const scholarTypeLabel = (type: ScholarshipType) =>
    type === "GOVERNMENT" ? "Government Scheme" : type === "MERIT" ? "Merit Based" : "Need Based";
  const enrollmentFor = (item: Scholar) =>
    item.student.enrollments.find((enrollment) => enrollment.academicSessionId === item.academicSession.id) ??
    item.student.enrollments[0];

  const kpis = [
    {
      label: "Total Scholars",
      value: stats?.total ?? 0,
      icon: <SchoolOutlined sx={{ fontSize: 25 }} />,
    },
    {
      label: "Merit Based",
      value: stats?.merit ?? 0,
      icon: <MilitaryTechOutlined sx={{ fontSize: 25 }} />,
    },
    {
      label: "Need Based",
      value: stats?.need ?? 0,
      icon: <VolunteerActivismOutlined sx={{ fontSize: 25 }} />,
    },
    {
      label: "Government Schemes",
      value: stats?.government ?? 0,
      icon: <AccountBalanceOutlined sx={{ fontSize: 25 }} />,
    },
  ];

  return (
    <section className="mt-5 space-y-4">
      <form className="nx-card flex flex-wrap items-end gap-4 p-4" onSubmit={submitSearch}>
        <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
          <span className="nx-label !normal-case !tracking-normal">Academic Year</span>
          <select
            className="nx-input bg-white"
            value={sessionFilter}
            onChange={(event) => {
              setSessionFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All years</option>
            {setup.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
          <span className="nx-label !normal-case !tracking-normal">Class</span>
          <select
            className="nx-input bg-white"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setClassSectionFilter("");
              setPage(1);
            }}
          >
            <option value="">All Classes</option>
            {setup.classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
          <span className="nx-label !normal-case !tracking-normal">Section</span>
          <select
            className="nx-input bg-white"
            value={classSectionFilter}
            onChange={(event) => {
              setClassSectionFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All Sections</option>
            {filterClassSections.map((classSection) => (
              <option key={classSection.id} value={classSection.id}>
                {classSection.section.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[150px] flex-1 sm:max-w-[190px]">
          <span className="nx-label !normal-case !tracking-normal">Scholarship Type</span>
          <select
            className="nx-input bg-white"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as "" | ScholarshipType);
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            {SCHOLARSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {scholarTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <div className="relative min-w-[170px] flex-1">
          <SearchOutlined
            sx={{ fontSize: 17 }}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="nx-input bg-white pl-9"
            placeholder="Search student..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="submit" className="nx-btn-primary" disabled={loading}>
          <SearchOutlined sx={{ fontSize: 16 }} />
          {loading ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
          onClick={() => void exportCsv()}
        >
          <DownloadOutlined sx={{ fontSize: 16 }} /> Export
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="nx-card flex items-center gap-4 border-l-2 border-l-indigo-500 px-4 py-4"
          >
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-indigo-500 text-white shadow-sm">
              {kpi.icon}
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600">{kpi.label}</p>
              <p className="mt-0.5 text-[24px] font-bold leading-none text-slate-900">{kpi.value}</p>
              <p className="mt-1 text-[10px] font-semibold text-indigo-600">Students</p>
            </div>
          </div>
        ))}
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 className="text-[15px] font-bold text-slate-900">School Scholars List</h3>
          {canManage ? (
            <button type="button" className="nx-btn-primary !py-1.5" onClick={openCreate}>
              <AddOutlined sx={{ fontSize: 16 }} /> Add Scholar
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="nx-table !min-w-[1080px]">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="w-10"><input type="checkbox" aria-label="Select all scholars" /></th>
                <th className="w-10">#</th>
                <th>Student Name</th>
                <th>Admission No.</th>
                <th>Class - Section</th>
                <th>Scholarship Type</th>
                <th>Scholarship Name</th>
                <th>Amount (₹)</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(result?.items ?? []).map((item, index) => {
                const enrollment = enrollmentFor(item);
                return (
                <tr key={item.id}>
                  <td><input type="checkbox" aria-label={`Select ${studentDisplayName(item.student)}`} /></td>
                  <td className="text-center font-medium text-slate-700">
                    {(page - 1) * PAGE_SIZE + index + 1}
                  </td>
                  <td className="font-semibold text-slate-800">{studentDisplayName(item.student)}</td>
                  <td className="font-medium text-slate-700">{item.student.admissionNumber}</td>
                  <td className="whitespace-nowrap font-medium text-slate-700">
                    {enrollment
                      ? `${enrollment.classSection.academicClass.name} - ${enrollment.classSection.section.name}`
                      : "—"}
                  </td>
                  <td>
                    <span className={`nx-pill ${typePill(item.scholarshipType)}`}>
                      {scholarTypeLabel(item.scholarshipType)}
                    </span>
                  </td>
                  <td>{item.scholarshipName}</td>
                  <td className="font-semibold text-slate-900">
                    {new Intl.NumberFormat("en-IN").format(Number(item.amount))}
                  </td>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(item.validFrom)}</td>
                  <td className="whitespace-nowrap text-slate-600">{formatDate(item.validTo)}</td>
                  <td>
                    <span className={`nx-pill ${statusPill(item.status)}`}>
                      {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  {canManage ? (
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-indigo-300 bg-white p-1.5 text-indigo-600 hover:bg-indigo-50"
                          onClick={() => startEdit(item)}
                          aria-label="Edit"
                        >
                          <EditOutlined sx={{ fontSize: 18 }} />
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-300 bg-white p-1.5 text-rose-500 hover:bg-rose-50"
                          disabled={busyKey === `delete-${item.id}`}
                          onClick={() => void remove(item)}
                          aria-label="Delete"
                        >
                          <DeleteOutline sx={{ fontSize: 18 }} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
              })}
              {!loading && !(result?.items ?? []).length ? (
                <tr>
                  <td colSpan={canManage ? 12 : 11} className="px-5 py-12 text-center text-slate-500">
                    No scholar records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={result?.pagination.total ?? 0}
          onPageChange={setPage}
          label="scholars"
        />
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="flex w-full max-w-xl max-h-[min(92vh,760px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onSubmit={(e) => void submit(e)}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-[17px] font-bold text-slate-900">
                {editing ? "Edit scholar record" : "New scholar record"}
              </h3>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
                onClick={reset}
                aria-label="Close"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-4">
              {!editing ? (
                <div className="relative">
                  <label className="block">
                    <span className="nx-label">Student</span>
                    <input
                      className="nx-input"
                      placeholder="Search by name or admission number..."
                      required={!form.studentId}
                      value={form.studentId ? form.studentLabel : studentQuery}
                      onChange={(e) => {
                        setForm({ ...form, studentId: "", studentLabel: "" });
                        setStudentQuery(e.target.value);
                      }}
                    />
                  </label>
                  {studentOptions.length && !form.studentId ? (
                    <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {studentOptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-[13px] hover:bg-indigo-50"
                          onClick={() => {
                            setForm({
                              ...form,
                              studentId: s.id,
                              studentLabel: `${studentDisplayName(s)} (${s.admissionNumber})`,
                            });
                            setStudentOptions([]);
                          }}
                        >
                          <span className="font-semibold text-slate-900">{studentDisplayName(s)}</span>{" "}
                          <span className="text-slate-400">#{s.admissionNumber}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <span className="nx-label">Student</span>
                  <p className="nx-input flex items-center bg-slate-50 text-slate-600">{form.studentLabel}</p>
                </div>
              )}
              <label className="block">
                <span className="nx-label">Academic session</span>
                <select
                  className="nx-input"
                  required
                  disabled={Boolean(editing)}
                  value={form.academicSessionId}
                  onChange={(e) => setForm({ ...form, academicSessionId: e.target.value })}
                >
                  <option value="">Select session</option>
                  {setup.sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="nx-label">Scholarship type</span>
                  <select
                    className="nx-input"
                    value={form.scholarshipType}
                    onChange={(e) => setForm({ ...form, scholarshipType: e.target.value as ScholarshipType })}
                  >
                    {SCHOLARSHIP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Amount</span>
                  <input
                    className="nx-input"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="nx-label">Scholarship name</span>
                <input
                  className="nx-input"
                  required
                  placeholder="Merit Scholarship 2026"
                  value={form.scholarshipName}
                  onChange={(e) => setForm({ ...form, scholarshipName: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="nx-label">Valid from</span>
                  <input
                    className="nx-input"
                    type="date"
                    required
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  />
                </label>
                <label>
                  <span className="nx-label">Valid to</span>
                  <input
                    className="nx-input"
                    type="date"
                    required
                    value={form.validTo}
                    onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                  />
                </label>
              </div>
              {editing ? (
                <label className="block">
                  <span className="nx-label">Status</span>
                  <select
                    className="nx-input"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ScholarStatus })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </label>
              ) : null}
              <label className="block">
                <span className="nx-label">Note (optional)</span>
                <textarea
                  className="nx-input min-h-16"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>
            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create scholar record"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
