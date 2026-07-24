import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
const today = new Date().toISOString().slice(0, 10);

const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

const SAMPLE_CSV = [
  "firstName,lastName,admissionDate,classSectionId,rollNumber,mobile,email,gender,dateOfBirth,fatherName,fatherPhone,motherName,photoUrl",
  "Aarav,Sharma,2026-04-01,,1,9876543210,aarav@example.com,MALE,2015-06-12,Raj Sharma,9876543211,Priya Sharma,",
].join("\n");

type PageTab = "directory" | "admissions" | "import" | "masters";
type DetailTab = "profile" | "parents" | "fees" | "documents" | "siblings";
type MasterResource = "categories" | "houses" | "disable-reasons";
type StudentStatus = "ACTIVE" | "DISABLED";

interface Named { id: string; name: string }
interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
}
interface Setup {
  categories: Named[];
  houses: Named[];
  disableReasons: Named[];
  currentSession: Named | null;
  classSections: ClassSection[];
}
interface StudentListItem {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  mobile: string | null;
  status: StudentStatus;
  category: Named | null;
  house: Named | null;
  enrollments: Array<{
    id: string;
    rollNumber: string | null;
    classSection: ClassSection;
    academicSession: Named;
  }>;
}
interface StudentList {
  items: StudentListItem[];
  total: number;
}
interface StudentDocument {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  folder: Named;
}
interface StudentFees {
  assignments: Array<{
    id: string;
    feeMaster: { feeType: Named; dueDate: string };
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
    enrollment: { classSection: ClassSection };
  }>;
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
}
interface StudentDetail extends StudentListItem {
  gender: string | null;
  dateOfBirth: string | null;
  religion: string | null;
  caste: string | null;
  email: string | null;
  admissionDate: string;
  photoUrl: string | null;
  bloodGroup: string | null;
  height: number | null;
  weight: number | null;
  currentAddress: string | null;
  permanentAddress: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  guardianName: string | null;
  guardianRelation: string | null;
  guardianPhone: string | null;
  disabledReason: string | null;
  siblingGroupId: string | null;
  documents: StudentDocument[];
  siblings: Array<{
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
    status: StudentStatus;
  }>;
  fees: StudentFees | null;
}
interface DetectedSibling {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  guardianPhone: string | null;
  mobile: string | null;
  siblingGroupId: string | null;
}
interface OnlineAdmission {
  id: string;
  status: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  mobile: string | null;
  email: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianPhone: string | null;
  currentAddress: string | null;
  createdAt: string;
  classSection: ClassSection | null;
  student: { id: string; admissionNumber: string } | null;
}
interface ImportResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

async function apiDelete(path: string, token: string) {
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
      } catch { /* ignore */ }
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

export function StudentsPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<PageTab>("directory");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [students, setStudents] = useState<StudentList>({ items: [], total: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StudentStatus>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [admissions, setAdmissions] = useState<OnlineAdmission[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSetup() {
    setSetup(await apiRequest<Setup>("/students/setup", accessToken));
  }

  async function loadStudents(query = search, status = statusFilter) {
    const params = new URLSearchParams({ limit: "100" });
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    setStudents(await apiRequest<StudentList>(`/students?${params}`, accessToken));
  }

  async function loadAdmissions() {
    setAdmissions(await apiRequest<OnlineAdmission[]>("/students/admissions", accessToken));
  }

  async function loadDetail(id: string) {
    setActiveId(id);
    setDetail(await apiRequest<StudentDetail>(`/students/${id}`, accessToken));
  }

  async function refreshDirectory() {
    await Promise.all([loadSetup(), loadStudents()]);
    if (activeId) {
      try {
        setDetail(await apiRequest<StudentDetail>(`/students/${activeId}`, accessToken));
      } catch {
        setActiveId(null);
        setDetail(null);
      }
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshDirectory();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to load students");
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (tab !== "admissions") return;
    void loadAdmissions().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to load admissions");
    });
  }, [tab, accessToken]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void loadStudents().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Unable to search students");
    });
  }

  async function deleteSelected() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected student(s)?`)) return;
    try {
      await apiRequest("/students/delete", accessToken, {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      });
      setMessage(`${selectedIds.length} student(s) deleted`);
      setSelectedIds([]);
      if (activeId && selectedIds.includes(activeId)) {
        setActiveId(null);
        setDetail(null);
      }
      await refreshDirectory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete students");
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const allSelected = useMemo(
    () => students.items.length > 0 && students.items.every((item) => selectedIds.includes(item.id)),
    [students.items, selectedIds],
  );

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Student management"
        title="Students and enrolment"
        description="Directory, admissions, bulk import, and student master data for the current session."
        action={setup?.currentSession && <span className="badge-success">{setup.currentSession.name}</span>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      {message && (
        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200">
        {([
          ["directory", "Directory"],
          ["admissions", "Admissions"],
          ["import", "Import"],
          ["masters", "Masters"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? "tab-active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "directory" && setup && (
        <DirectoryPanel
          setup={setup}
          students={students}
          search={search}
          statusFilter={statusFilter}
          selectedIds={selectedIds}
          allSelected={allSelected}
          activeId={activeId}
          detail={detail}
          showAddForm={showAddForm}
          token={accessToken}
          onSearchChange={setSearch}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            void loadStudents(search, value).catch((cause) => {
              setError(cause instanceof Error ? cause.message : "Unable to filter students");
            });
          }}
          onSubmitSearch={submitSearch}
          onToggleSelected={toggleSelected}
          onToggleAll={() => {
            setSelectedIds(allSelected ? [] : students.items.map((item) => item.id));
          }}
          onSelectStudent={(id) => {
            void loadDetail(id).catch((cause) => {
              setError(cause instanceof Error ? cause.message : "Unable to load student detail");
            });
          }}
          onCloseDetail={() => {
            setActiveId(null);
            setDetail(null);
          }}
          onRefresh={async () => {
            setError("");
            setMessage("");
            await refreshDirectory();
          }}
          onDeleteSelected={() => void deleteSelected()}
          onToggleAddForm={() => setShowAddForm((current) => !current)}
          onError={setError}
          onMessage={setMessage}
        />
      )}

      {tab === "admissions" && setup && (
        <AdmissionsPanel
          admissions={admissions}
          setup={setup}
          token={accessToken}
          onRefresh={async () => {
            await loadAdmissions();
            await refreshDirectory();
          }}
          onError={setError}
          onMessage={setMessage}
        />
      )}

      {tab === "import" && (
        <ImportPanel
          token={accessToken}
          onImported={async () => {
            setTab("directory");
            await refreshDirectory();
          }}
          onError={setError}
          onMessage={setMessage}
        />
      )}

      {tab === "masters" && setup && (
        <MastersPanel
          setup={setup}
          token={accessToken}
          onRefresh={async () => {
            await loadSetup();
          }}
          onError={setError}
          onMessage={setMessage}
        />
      )}
    </main>
  );
}

function DirectoryPanel({
  setup,
  students,
  search,
  statusFilter,
  selectedIds,
  allSelected,
  activeId,
  detail,
  showAddForm,
  token,
  onSearchChange,
  onStatusFilterChange,
  onSubmitSearch,
  onToggleSelected,
  onToggleAll,
  onSelectStudent,
  onCloseDetail,
  onRefresh,
  onDeleteSelected,
  onToggleAddForm,
  onError,
  onMessage,
}: {
  setup: Setup;
  students: StudentList;
  search: string;
  statusFilter: "" | StudentStatus;
  selectedIds: string[];
  allSelected: boolean;
  activeId: string | null;
  detail: StudentDetail | null;
  showAddForm: boolean;
  token: string;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: "" | StudentStatus) => void;
  onSubmitSearch: (event: FormEvent) => void;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onSelectStudent: (id: string) => void;
  onCloseDetail: () => void;
  onRefresh: () => Promise<void>;
  onDeleteSelected: () => void;
  onToggleAddForm: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="button-primary" onClick={onToggleAddForm}>
          {showAddForm ? "Close form" : "Add student"}
        </button>
        {selectedIds.length > 0 && (
          <button className="button-secondary text-rose-700" onClick={onDeleteSelected}>
            Delete selected ({selectedIds.length})
          </button>
        )}
      </div>

      {showAddForm && (
        <StudentForm
          setup={setup}
          token={token}
          onSaved={async () => {
            onToggleAddForm();
            onMessage("Student added");
            await onRefresh();
          }}
          onError={onError}
        />
      )}

      <div className={`mt-6 grid gap-5 ${detail ? "lg:grid-cols-[1fr_420px]" : ""}`}>
        <div>
          <form className="flex flex-wrap gap-3" onSubmit={onSubmitSearch}>
            <input
              className="input min-w-[220px] flex-1"
              placeholder="Search name, admission number, mobile…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <select
              className="input w-44"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as "" | StudentStatus)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
            <button className="button-secondary" type="submit">Search</button>
          </form>

          <div className="card mt-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 text-sm text-slate-500">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
                {students.total} students
              </label>
            </div>
            <div className="divide-y divide-slate-100">
              {students.items.map((student) => {
                const enrollment = student.enrollments[0];
                const isActive = activeId === student.id;
                return (
                  <div
                    className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${isActive ? "bg-indigo-50" : "cursor-pointer hover:bg-slate-50"}`}
                    key={student.id}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.id)}
                        onChange={() => onToggleSelected(student.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="text-left"
                        type="button"
                        onClick={() => onSelectStudent(student.id)}
                      >
                        <p className="font-medium">{student.firstName} {student.lastName}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {student.admissionNumber}
                          {enrollment && ` · ${enrollment.classSection.academicClass.name} ${enrollment.classSection.section.name}`}
                          {enrollment?.rollNumber && ` · Roll ${enrollment.rollNumber}`}
                        </p>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pl-8 sm:pl-0">
                      {student.house && <span className="badge">{student.house.name}</span>}
                      <span className={student.status === "ACTIVE" ? "badge-success" : "badge-danger"}>
                        {student.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!students.items.length && (
                <p className="px-5 py-10 text-center text-sm text-slate-500">No students found.</p>
              )}
            </div>
          </div>
        </div>

        {detail && setup && (
          <StudentDetailPanel
            detail={detail}
            setup={setup}
            token={token}
            onClose={onCloseDetail}
            onUpdated={onRefresh}
            onError={onError}
            onMessage={onMessage}
          />
        )}
      </div>
    </section>
  );
}

function StudentDetailPanel({
  detail,
  setup,
  token,
  onClose,
  onUpdated,
  onError,
  onMessage,
}: {
  detail: StudentDetail;
  setup: Setup;
  token: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [detailTab, setDetailTab] = useState<DetailTab>("profile");
  const [profile, setProfile] = useState(() => buildProfileForm(detail));
  const [disableMode, setDisableMode] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [customDisableReason, setCustomDisableReason] = useState("");
  const [detected, setDetected] = useState<DetectedSibling[]>([]);
  const [linkIds, setLinkIds] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setProfile(buildProfileForm(detail));
    setDetailTab("profile");
    setDisableMode(false);
    setDetected([]);
    setLinkIds([]);
  }, [detail.id]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(
        Object.entries(profile).map(([key, value]) => [key, value === "" ? null : value]),
      );
      await apiRequest(`/students/${detail.id}`, token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onMessage("Profile updated");
      await onUpdated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update profile");
    }
  }

  async function toggleStatus() {
    if (detail.status === "ACTIVE") {
      setDisableMode(true);
      return;
    }
    try {
      await apiRequest(`/students/${detail.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      onMessage("Student enabled");
      setDisableMode(false);
      await onUpdated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to enable student");
    }
  }

  async function confirmDisable() {
    const reason = disableReason === "__custom__" ? customDisableReason.trim() : disableReason.trim();
    if (!reason) {
      onError("Disable reason is required");
      return;
    }
    try {
      await apiRequest(`/students/${detail.id}`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "DISABLED", disabledReason: reason }),
      });
      onMessage("Student disabled");
      setDisableMode(false);
      await onUpdated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to disable student");
    }
  }

  async function detectSiblings() {
    setDetecting(true);
    try {
      const next = await apiRequest<DetectedSibling[]>(
        `/students/${detail.id}/siblings/detect`,
        token,
      );
      setDetected(next);
      setLinkIds(next.map((item) => item.id));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to detect siblings");
    } finally {
      setDetecting(false);
    }
  }

  async function linkSiblings() {
    const studentIds = [detail.id, ...linkIds.filter((id) => id !== detail.id)];
    if (studentIds.length < 2) {
      onError("Select at least one sibling to link");
      return;
    }
    try {
      await apiRequest("/students/siblings", token, {
        method: "POST",
        body: JSON.stringify({ studentIds }),
      });
      onMessage("Siblings linked");
      setDetected([]);
      setLinkIds([]);
      await onUpdated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to link siblings");
    }
  }

  const enrollment = detail.enrollments[0];

  return (
    <aside className="card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Student 360</p>
            <h2 className="mt-1 text-lg font-semibold">{detail.firstName} {detail.lastName}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {detail.admissionNumber}
              {enrollment && ` · ${enrollment.classSection.academicClass.name} ${enrollment.classSection.section.name}`}
            </p>
          </div>
          <button className="text-sm font-semibold text-slate-500" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={detail.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{detail.status}</span>
          {detail.disabledReason && <span className="badge">{detail.disabledReason}</span>}
          <button className="button-secondary" type="button" onClick={() => void toggleStatus()}>
            {detail.status === "ACTIVE" ? "Disable" : "Enable"}
          </button>
        </div>
        {disableMode && (
          <div className="mt-4 rounded-xl bg-rose-50 p-4">
            <p className="text-sm font-medium text-rose-800">Reason for disabling</p>
            <select
              className="input mt-2"
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
            >
              <option value="">Select reason</option>
              {setup.disableReasons.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
              <option value="__custom__">Other (enter below)</option>
            </select>
            {disableReason === "__custom__" && (
              <input
                className="input mt-2"
                placeholder="Enter disable reason"
                value={customDisableReason}
                onChange={(e) => setCustomDisableReason(e.target.value)}
              />
            )}
            <div className="mt-3 flex gap-2">
              <button className="button-primary" type="button" onClick={() => void confirmDisable()}>
                Confirm disable
              </button>
              <button className="button-secondary" type="button" onClick={() => setDisableMode(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3">
        {([
          ["profile", "Profile"],
          ["parents", "Parents"],
          ["fees", "Fees"],
          ["documents", "Documents"],
          ["siblings", "Siblings"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${detailTab === key ? "tab-active" : ""}`}
            type="button"
            onClick={() => setDetailTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-[640px] overflow-y-auto p-5">
        {detailTab === "profile" && (
          <form className="grid gap-3" onSubmit={saveProfile}>
            <input
              className="input"
              placeholder="Photo URL"
              value={profile.photoUrl}
              onChange={(e) => setProfile({ ...profile, photoUrl: e.target.value })}
            />
            {profile.photoUrl && (
              <img
                className="h-24 w-24 rounded-xl object-cover"
                src={profile.photoUrl}
                alt={`${detail.firstName} photo`}
              />
            )}
            <input className="input" required placeholder="First name" value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
            <input className="input" placeholder="Last name" value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
            <select className="input" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
              <option value="">Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            <label><span className="label">Date of birth</span>
              <input className="input" type="date" value={profile.dateOfBirth}
                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} /></label>
            <label><span className="label">Admission date</span>
              <input className="input" type="date" required value={profile.admissionDate}
                onChange={(e) => setProfile({ ...profile, admissionDate: e.target.value })} /></label>
            <input className="input" placeholder="Mobile" value={profile.mobile}
              onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            <select className="input" value={profile.categoryId} onChange={(e) => setProfile({ ...profile, categoryId: e.target.value })}>
              <option value="">Category</option>
              {setup.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="input" value={profile.houseId} onChange={(e) => setProfile({ ...profile, houseId: e.target.value })}>
              <option value="">House</option>
              {setup.houses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className="input" placeholder="Blood group" value={profile.bloodGroup}
              onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })} />
            <textarea className="input" placeholder="Current address" value={profile.currentAddress}
              onChange={(e) => setProfile({ ...profile, currentAddress: e.target.value })} />
            <textarea className="input" placeholder="Permanent address" value={profile.permanentAddress}
              onChange={(e) => setProfile({ ...profile, permanentAddress: e.target.value })} />
            <button className="button-primary" type="submit">Save profile</button>
          </form>
        )}

        {detailTab === "parents" && (
          <div className="space-y-4 text-sm">
            <ParentBlock title="Father" name={detail.fatherName} phone={detail.fatherPhone} />
            <ParentBlock title="Mother" name={detail.motherName} phone={detail.motherPhone} />
            <ParentBlock
              title="Guardian"
              name={detail.guardianName}
              phone={detail.guardianPhone}
              relation={detail.guardianRelation}
            />
          </div>
        )}

        {detailTab === "fees" && (
          detail.fees ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FeeMetric label="Assigned" value={detail.fees.totals.base} />
                <FeeMetric label="Paid" value={detail.fees.totals.paid} />
                <FeeMetric label="Discount" value={detail.fees.totals.discount} />
                <FeeMetric label="Balance" value={detail.fees.totals.balance} accent />
              </div>
              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.fees.assignments.map((assignment) => (
                  <div className="p-4" key={assignment.id}>
                    <p className="font-medium">{assignment.feeMaster.feeType.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Due {new Date(assignment.feeMaster.dueDate).toLocaleDateString()} ·
                      {" "}Balance {formatMoney(assignment.totals.balance)}
                    </p>
                  </div>
                ))}
                {!detail.fees.assignments.length && (
                  <p className="p-6 text-center text-sm text-slate-500">No fee assignments.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Fee summary is not available for this student.</p>
          )
        )}

        {detailTab === "documents" && (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {detail.documents.map((doc) => (
              <div className="p-4" key={doc.id}>
                <a className="font-medium text-indigo-700" href={doc.fileUrl} target="_blank" rel="noreferrer">
                  {doc.name}
                </a>
                <p className="mt-1 text-sm text-slate-500">
                  {doc.folder.name} · {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
            {!detail.documents.length && (
              <p className="p-6 text-center text-sm text-slate-500">No documents uploaded.</p>
            )}
          </div>
        )}

        {detailTab === "siblings" && (
          <div>
            {detail.siblings.length > 0 && (
              <div className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {detail.siblings.map((sibling) => (
                  <div className="flex items-center justify-between p-4" key={sibling.id}>
                    <div>
                      <p className="font-medium">{sibling.firstName} {sibling.lastName}</p>
                      <p className="text-sm text-slate-500">{sibling.admissionNumber}</p>
                    </div>
                    <span className={sibling.status === "ACTIVE" ? "badge-success" : "badge-danger"}>
                      {sibling.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              className="button-secondary"
              disabled={detecting}
              type="button"
              onClick={() => void detectSiblings()}
            >
              {detecting ? "Detecting…" : "Detect possible siblings"}
            </button>
            {detected.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700">Possible matches</p>
                <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {detected.map((item) => (
                    <label className="flex items-center gap-3 p-4" key={item.id}>
                      <input
                        type="checkbox"
                        checked={linkIds.includes(item.id)}
                        onChange={() => {
                          setLinkIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id],
                          );
                        }}
                      />
                      <div>
                        <p className="font-medium">{item.firstName} {item.lastName}</p>
                        <p className="text-sm text-slate-500">
                          {item.admissionNumber}
                          {item.siblingGroupId && " · Already in a sibling group"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <button className="button-primary mt-3" type="button" onClick={() => void linkSiblings()}>
                  Link selected siblings
                </button>
              </div>
            )}
            {!detail.siblings.length && !detected.length && (
              <p className="mt-4 text-sm text-slate-500">No linked siblings yet.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function ParentBlock({
  title,
  name,
  phone,
  relation,
}: {
  title: string;
  name: string | null;
  phone: string | null;
  relation?: string | null;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{name || "—"}</p>
      <p className="mt-1 text-slate-500">{phone || "No phone"}</p>
      {relation && <p className="mt-1 text-slate-500">Relation: {relation}</p>}
    </div>
  );
}

function FeeMetric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? "bg-indigo-50" : "bg-slate-50"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{formatMoney(value)}</p>
    </div>
  );
}

function buildProfileForm(detail: StudentDetail) {
  return {
    firstName: detail.firstName,
    lastName: detail.lastName ?? "",
    gender: detail.gender ?? "",
    dateOfBirth: detail.dateOfBirth?.slice(0, 10) ?? "",
    admissionDate: detail.admissionDate.slice(0, 10),
    mobile: detail.mobile ?? "",
    email: detail.email ?? "",
    categoryId: detail.category?.id ?? "",
    houseId: detail.house?.id ?? "",
    photoUrl: detail.photoUrl ?? "",
    bloodGroup: detail.bloodGroup ?? "",
    currentAddress: detail.currentAddress ?? "",
    permanentAddress: detail.permanentAddress ?? "",
  };
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
  const pending = admissions.filter((item) => item.status === "PENDING");
  const reviewed = admissions.filter((item) => item.status !== "PENDING");

  return (
    <section className="mt-6 space-y-6">
      <div className="card divide-y divide-slate-100 overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">
          Pending applications ({pending.length})
        </div>
        {pending.map((application) => (
          <AdmissionRow
            key={application.id}
            application={application}
            setup={setup}
            token={token}
            onDone={async (success) => {
              onMessage(success);
              await onRefresh();
            }}
            onError={onError}
          />
        ))}
        {!pending.length && (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No pending admissions.</p>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 font-semibold">Reviewed</div>
          {reviewed.map((application) => (
            <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center" key={application.id}>
              <div>
                <p className="font-medium">{application.firstName} {application.lastName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {application.mobile || "No mobile"}
                  {application.student && ` · Admitted as ${application.student.admissionNumber}`}
                </p>
              </div>
              <span className={application.status === "ACCEPTED" ? "badge-success" : "badge-danger"}>
                {application.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AdmissionRow({
  application,
  setup,
  token,
  onDone,
  onError,
}: {
  application: OnlineAdmission;
  setup: Setup;
  token: string;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [classSectionId, setClassSectionId] = useState(application.classSection?.id ?? "");
  const [note, setNote] = useState("");
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
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="font-medium">{application.firstName} {application.lastName}</p>
        <p className="mt-1 text-sm text-slate-500">
          {application.mobile || "No mobile"}
          {application.email && ` · ${application.email}`}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {application.fatherName && `Father: ${application.fatherName}`}
          {application.motherName && ` · Mother: ${application.motherName}`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Applied {new Date(application.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="space-y-3">
        <select
          className="input"
          value={classSectionId}
          onChange={(e) => setClassSectionId(e.target.value)}
        >
          <option value="">Class and section</option>
          {setup.classSections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.academicClass.name} · {item.section.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Review note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="button-secondary flex-1" disabled={busy} type="button" onClick={() => void reject()}>
            Reject
          </button>
          <button className="button-primary flex-1" disabled={busy} type="button" onClick={() => void accept()}>
            Accept
          </button>
        </div>
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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
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
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="card p-5">
        <h2 className="font-semibold">CSV import</h2>
        <p className="mt-2 text-sm text-slate-500">
          Required columns: firstName, admissionDate, classSectionId. Use the sample file for the full header set.
        </p>
        <button className="button-secondary mt-4" type="button" onClick={downloadSampleCsv}>
          Download sample CSV
        </button>
        <label className="button-secondary mt-3 inline-block cursor-pointer">
          Upload CSV file
          <input
            className="hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <form className="card p-5" onSubmit={submit}>
        <h2 className="font-semibold">Paste CSV content</h2>
        <textarea
          className="input mt-4 min-h-[280px] font-mono text-xs"
          placeholder="Paste CSV rows here…"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <button className="button-primary mt-4" disabled={busy} type="submit">
          {busy ? "Importing…" : "Import students"}
        </button>

        {result && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="font-medium text-emerald-700">{result.created} row(s) created</p>
            {result.errors.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-rose-700">{result.errors.length} row error(s)</p>
                {result.errors.map((item) => (
                  <p className="text-sm text-slate-600" key={`${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
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
    <section className="mt-6 grid gap-5 lg:grid-cols-3">
      <MasterCard
        title="Categories"
        resource="categories"
        items={setup.categories}
        token={token}
        onRefresh={onRefresh}
        onError={onError}
        onMessage={onMessage}
      />
      <MasterCard
        title="Houses"
        resource="houses"
        items={setup.houses}
        token={token}
        onRefresh={onRefresh}
        onError={onError}
        onMessage={onMessage}
      />
      <MasterCard
        title="Disable reasons"
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
  resource,
  items,
  token,
  onRefresh,
  onError,
  onMessage,
}: {
  title: string;
  resource: MasterResource;
  items: Named[];
  token: string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState("");

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await apiRequest(`/student-masters/${resource}`, token, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      onMessage(`${title.slice(0, -1)} added`);
      await onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add master");
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
    <form className="card p-5" onSubmit={add}>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 flex gap-2">
        <input
          className="input min-w-0 flex-1"
          placeholder={`New ${title.toLowerCase().slice(0, -1)}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="button-secondary" disabled={!name.trim()} type="submit">Add</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span className="badge inline-flex items-center gap-2" key={item.id}>
            {item.name}
            <button
              className="text-rose-600"
              type="button"
              onClick={() => void remove(item.id)}
            >
              ×
            </button>
          </span>
        ))}
        {!items.length && <p className="text-sm text-slate-500">No entries yet.</p>}
      </div>
    </form>
  );
}

function StudentForm({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: Setup;
  token: string;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    admissionNumber: "",
    firstName: "",
    lastName: "",
    gender: "",
    admissionDate: today,
    dateOfBirth: "",
    mobile: "",
    email: "",
    categoryId: "",
    houseId: "",
    classSectionId: "",
    rollNumber: "",
    guardianName: "",
    guardianRelation: "",
    guardianPhone: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value || undefined]),
    );
    try {
      await apiRequest("/students", token, { method: "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add student");
    }
  }

  return (
    <form className="card mt-6 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={submit}>
      <input className="input" placeholder="Admission no. (auto if blank)" value={form.admissionNumber}
        onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} />
      <input className="input" placeholder="First name" required value={form.firstName}
        onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      <input className="input" placeholder="Last name" value={form.lastName}
        onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
        <option value="">Gender</option>
        <option value="MALE">Male</option>
        <option value="FEMALE">Female</option>
        <option value="OTHER">Other</option>
      </select>
      <label><span className="label">Admission date</span>
        <input className="input" type="date" required value={form.admissionDate}
          onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></label>
      <label><span className="label">Date of birth</span>
        <input className="input" type="date" value={form.dateOfBirth}
          onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></label>
      <input className="input self-end" placeholder="Mobile" value={form.mobile}
        onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
      <input className="input self-end" type="email" placeholder="Email" value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
        <option value="">Category</option>
        {setup.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className="input" value={form.houseId} onChange={(e) => setForm({ ...form, houseId: e.target.value })}>
        <option value="">House</option>
        {setup.houses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className="input" required value={form.classSectionId}
        onChange={(e) => setForm({ ...form, classSectionId: e.target.value })}>
        <option value="">Class and section</option>
        {setup.classSections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.academicClass.name} · {item.section.name}
          </option>
        ))}
      </select>
      <input className="input" placeholder="Roll number" value={form.rollNumber}
        onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
      <input className="input" placeholder="Guardian name" value={form.guardianName}
        onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
      <input className="input" placeholder="Relation" value={form.guardianRelation}
        onChange={(e) => setForm({ ...form, guardianRelation: e.target.value })} />
      <input className="input" placeholder="Guardian phone" value={form.guardianPhone}
        onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
      <button className="button-primary" type="submit">Save student</button>
    </form>
  );
}
