import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowBackOutlined,
  CalendarMonthOutlined,
  CloudUploadOutlined,
  EditOutlined,
  FolderOutlined,
  InsertDriveFileOutlined,
  PaymentsOutlined,
  SearchOutlined,
  ThumbDownAltOutlined,
  ThumbUpAltOutlined,
  ViewListOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsScrollBody, CmsTabs, CmsTab } from "../../../components/cms/CmsLayout";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import {
  formatMoney,
  studentDisplayName,
  type AdmissionType,
  type AttendanceReport,
  type DetectedSibling,
  type Setup,
  type StudentDetail,
  type StudentDocument,
} from "./types";
import {
  ExamsTab,
  LoginDetailsTab,
  SubjectsTab,
  TimelineTab,
} from "./Student360Panels";

type DetailTab =
  | "profile"
  | "parents"
  | "fees"
  | "documents"
  | "attendance"
  | "exams"
  | "subjects"
  | "timeline"
  | "login";

const TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "profile", label: "Profile Details" },
  { key: "parents", label: "Parents & Guardians" },
  { key: "fees", label: "Fees & Payments" },
  { key: "exams", label: "Exam Details" },
  { key: "subjects", label: "Subjects" },
  { key: "documents", label: "Documents" },
  { key: "attendance", label: "Attendance History" },
  { key: "timeline", label: "Timeline" },
  { key: "login", label: "Login Details" },
];

function buildProfileForm(detail: StudentDetail) {
  return {
    firstName: detail.firstName,
    lastName: detail.lastName ?? "",
    gender: detail.gender ?? "",
    dateOfBirth: detail.dateOfBirth?.slice(0, 10) ?? "",
    admissionDate: detail.admissionDate.slice(0, 10),
    admissionType: detail.admissionType ?? "REGULAR",
    mobile: detail.mobile ?? "",
    email: detail.email ?? "",
    categoryId: detail.category?.id ?? "",
    houseId: detail.house?.id ?? "",
    photoUrl: detail.photoUrl ?? "",
    bloodGroup: detail.bloodGroup ?? "",
    religion: detail.religion ?? "",
    caste: detail.caste ?? "",
    nationality: detail.nationality ?? "",
    currentAddress: detail.currentAddress ?? "",
    permanentAddress: detail.permanentAddress ?? "",
  };
}

function formatLongDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ageLabel(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "";
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return "";
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  return years >= 0 ? ` (${years} Years)` : "";
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

type PortalCredential = {
  email: string;
  password: string;
  role: "STUDENT" | "PARENT";
  relation?: string | null;
  created: boolean;
};

type CreateLocationState = {
  justCreated?: boolean;
  credentials?: PortalCredential[];
};

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const createState = (location.state as CreateLocationState | null) ?? null;
  const [setup, setSetup] = useState<Setup | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>("profile");
  const [editing, setEditing] = useState(false);
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [credentials] = useState<PortalCredential[]>(createState?.credentials ?? []);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    const [setupData, detailData] = await Promise.all([
      apiRequest<Setup>("/students/setup", accessToken),
      apiRequest<StudentDetail>(`/students/${id}`, accessToken),
    ]);
    setSetup(setupData);
    setDetail(detailData);
  }

  useEffect(() => {
    if (createState?.justCreated) {
      notifySuccess("Student added successfully");
    }
  }, [createState?.justCreated]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const validTabs = new Set(TABS.map((item) => item.key));
    if (requestedTab && validTabs.has(requestedTab as DetailTab)) {
      setTab(requestedTab as DetailTab);
    }
    if (searchParams.get("edit") === "1") {
      setTab("profile");
      setEditing(true);
    }
    if (searchParams.has("tab") || searchParams.has("edit")) {
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load student"))
      .finally(() => setLoading(false));
  }, [id, accessToken]);

  useEffect(() => {
    if (!detail?.id) return;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 180);
    const params = new URLSearchParams({
      studentId: detail.id,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    });
    void apiRequest<AttendanceReport>(`/attendance/reports?${params}`, accessToken)
      .then((report) => setAttendancePct(report.summaries[0]?.percentage ?? null))
      .catch(() => setAttendancePct(null));
  }, [detail?.id, accessToken]);

  const enrollment = detail?.enrollments[0];
  const name = detail ? studentDisplayName(detail) : "";
  const classLabel = enrollment
    ? `${enrollment.classSection.academicClass.name} ${enrollment.classSection.section.name}`
    : "No active enrolment";

  return (
    <CmsPage>
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <button className="nx-btn-secondary" type="button" onClick={() => navigate("/students")}>
          <ArrowBackOutlined sx={{ fontSize: 16 }} /> Back to directory
        </button>
        {detail && (
          <span className="font-mono text-[12px] font-semibold text-indigo-600">#{detail.admissionNumber}</span>
        )}
      </div>

      <CmsScrollBody>
      {credentials.length > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-[13px] font-bold text-indigo-900">Portal login credentials</p>
          <p className="mt-1 text-[12px] text-indigo-700">
            Share these once with the student/parent. Passwords are shown only here after create.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {credentials.map((item) => (
              <div
                key={`${item.role}-${item.email}`}
                className="rounded-lg border border-indigo-100 bg-white px-3 py-2.5"
              >
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">
                  {item.role === "STUDENT" ? "Student login" : `Parent login${item.relation ? ` (${item.relation})` : ""}`}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-slate-900">{item.email}</p>
                <p className="mt-0.5 font-mono text-[13px] text-slate-700">Password: {item.password}</p>
                {!item.created && (
                  <p className="mt-1 text-[11px] text-amber-700">Existing parent account was linked.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail && setup && (
        <>
          <ProfileHeaderCard
            detail={detail}
            setup={setup}
            token={accessToken}
            attendancePct={attendancePct}
            editing={editing}
            onEdit={() => {
              setTab("profile");
              setEditing(true);
            }}
            onUpdated={load}
            onError={notifyError}
            onMessage={notifySuccess}
          />

          <CmsTabs>
            {TABS.map((item) => (
              <CmsTab
                key={item.key}
                active={tab === item.key}
                onClick={() => {
                  setTab(item.key);
                  if (item.key !== "profile") setEditing(false);
                }}
              >
                {item.label}
              </CmsTab>
            ))}
          </CmsTabs>

          {tab === "profile" && (
            <ProfileDetailsTab
              detail={detail}
              setup={setup}
              token={accessToken}
              editing={editing}
              onEditingChange={setEditing}
              classLabel={classLabel}
              onUpdated={load}
              onError={notifyError}
              onMessage={notifySuccess}
            />
          )}
          {tab === "parents" && (
            <ParentsTab
              detail={detail}
              token={accessToken}
              onUpdated={load}
              onError={notifyError}
              onMessage={notifySuccess}
            />
          )}
          {tab === "fees" && <FeesTab detail={detail} />}
          {tab === "exams" && <ExamsTab studentId={detail.id} token={accessToken} />}
          {tab === "subjects" && <SubjectsTab studentId={detail.id} token={accessToken} />}
          {tab === "documents" && <DocumentsTab detail={detail} />}
          {tab === "attendance" && <AttendanceTab studentId={detail.id} token={accessToken} />}
          {tab === "timeline" && <TimelineTab studentId={detail.id} token={accessToken} />}
          {tab === "login" && <LoginDetailsTab studentId={detail.id} token={accessToken} />}
        </>
      )}

      {loading && !detail && <p className="mt-10 text-center text-sm text-slate-500">Loading…</p>}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}

function ProfileHeaderCard({
  detail,
  setup,
  token,
  attendancePct,
  editing,
  onEdit,
  onUpdated,
  onError,
  onMessage,
}: {
  detail: StudentDetail;
  setup: Setup;
  token: string;
  attendancePct: number | null;
  editing: boolean;
  onEdit: () => void;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [disableMode, setDisableMode] = useState(false);
  const [disableReason, setDisableReason] = useState("");
  const [customDisableReason, setCustomDisableReason] = useState("");
  const enrollment = detail.enrollments[0];
  const name = studentDisplayName(detail);
  const classLabel = enrollment
    ? `${enrollment.classSection.academicClass.name} · ${enrollment.classSection.section.name}`
    : "No active enrolment";
  const sessionLabel = enrollment?.academicSession?.name ?? setup.currentSession?.name ?? "—";

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

  return (
    <div className="nx-card overflow-hidden">
      <div className="border-b border-slate-100 bg-[#F6F7F9] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <InitialsAvatar name={name} photoUrl={detail.photoUrl} size={72} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{name}</h1>
                <span className={`nx-pill ${detail.status === "ACTIVE" ? "nx-pill-success" : "nx-pill-danger"}`}>
                  {detail.status}
                </span>
              </div>
              <p className="mt-1 text-[14px] text-slate-500">
                {classLabel}
                {enrollment?.rollNumber ? ` · Roll ${enrollment.rollNumber}` : ""}
              </p>
              <p className="mt-0.5 text-[12.5px] text-slate-400">{sessionLabel}</p>
              <div className="mt-3 flex flex-wrap gap-5">
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Category</p>
                  <p className="text-[15px] font-semibold text-slate-800">{detail.category?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Attendance</p>
                  <p className="text-[15px] font-semibold text-emerald-600">
                    {attendancePct != null ? `${attendancePct}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">House</p>
                  <p className="text-[15px] font-semibold text-slate-800">{detail.house?.name ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              to={`/fees?studentId=${detail.id}&action=collect`}
            >
              <PaymentsOutlined sx={{ fontSize: 16 }} /> Add Fee
            </Link>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-900"
              type="button"
              onClick={onEdit}
            >
              <EditOutlined sx={{ fontSize: 16 }} /> {editing ? "Editing…" : "Edit Profile"}
            </button>
            <button
              className={
                detail.status === "ACTIVE"
                  ? "inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-rose-700"
                  : "inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              }
              type="button"
              onClick={() => void toggleStatus()}
            >
              {detail.status === "ACTIVE" ? (
                <>
                  <ThumbDownAltOutlined sx={{ fontSize: 16 }} /> Disable
                </>
              ) : (
                <>
                  <ThumbUpAltOutlined sx={{ fontSize: 16 }} /> Enable
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {disableMode && (
        <div className="border-t border-rose-100 bg-rose-50 px-5 py-4">
          <p className="text-sm font-medium text-rose-800">Reason for disabling</p>
          <select className="nx-input mt-2 max-w-md" value={disableReason} onChange={(e) => setDisableReason(e.target.value)}>
            <option value="">Select reason</option>
            {setup.disableReasons.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
            <option value="__custom__">Other (enter below)</option>
          </select>
          {disableReason === "__custom__" && (
            <input
              className="nx-input mt-2 max-w-md"
              placeholder="Enter disable reason"
              value={customDisableReason}
              onChange={(e) => setCustomDisableReason(e.target.value)}
            />
          )}
          <div className="mt-3 flex gap-2">
            <button className="nx-btn-primary" type="button" onClick={() => void confirmDisable()}>
              Confirm disable
            </button>
            <button className="nx-btn-secondary" type="button" onClick={() => setDisableMode(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDetailsTab({
  detail,
  setup,
  token,
  editing,
  onEditingChange,
  classLabel,
  onUpdated,
  onError,
  onMessage,
}: {
  detail: StudentDetail;
  setup: Setup;
  token: string;
  editing: boolean;
  onEditingChange: (value: boolean) => void;
  classLabel: string;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [profile, setProfile] = useState(() => buildProfileForm(detail));

  useEffect(() => {
    setProfile(buildProfileForm(detail));
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
      onEditingChange(false);
      await onUpdated();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update profile");
    }
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        {editing ? (
          <form className="nx-card space-y-5 p-5" onSubmit={saveProfile}>
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-slate-900">Edit profile</h2>
              <div className="flex gap-2">
                <button className="nx-btn-secondary" type="button" onClick={() => onEditingChange(false)}>
                  Cancel
                </button>
                <button className="nx-btn-primary" type="submit">Save changes</button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label><span className="nx-label">First name</span>
                <input className="nx-input" required value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></label>
              <label><span className="nx-label">Last name</span>
                <input className="nx-input" value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} /></label>
              <label><span className="nx-label">Gender</span>
                <select className="nx-input" value={profile.gender}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select></label>
              <label><span className="nx-label">Date of birth</span>
                <input className="nx-input" type="date" value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} /></label>
              <label><span className="nx-label">Blood group</span>
                <input className="nx-input" value={profile.bloodGroup}
                  onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })} /></label>
              <label><span className="nx-label">Religion</span>
                <input className="nx-input" value={profile.religion}
                  onChange={(e) => setProfile({ ...profile, religion: e.target.value })} /></label>
              <label><span className="nx-label">Nationality</span>
                <input className="nx-input" value={profile.nationality}
                  onChange={(e) => setProfile({ ...profile, nationality: e.target.value })} /></label>
              <label><span className="nx-label">Caste</span>
                <input className="nx-input" value={profile.caste}
                  onChange={(e) => setProfile({ ...profile, caste: e.target.value })} /></label>
              <label><span className="nx-label">Mobile</span>
                <input className="nx-input" value={profile.mobile}
                  onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} /></label>
              <label><span className="nx-label">Email</span>
                <input className="nx-input" type="email" value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
              <label><span className="nx-label">Category</span>
                <select className="nx-input" value={profile.categoryId}
                  onChange={(e) => setProfile({ ...profile, categoryId: e.target.value })}>
                  <option value="">Category</option>
                  {setup.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></label>
              <label><span className="nx-label">House</span>
                <select className="nx-input" value={profile.houseId}
                  onChange={(e) => setProfile({ ...profile, houseId: e.target.value })}>
                  <option value="">House</option>
                  {setup.houses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select></label>
              <label><span className="nx-label">Admission date</span>
                <input className="nx-input" type="date" required value={profile.admissionDate}
                  onChange={(e) => setProfile({ ...profile, admissionDate: e.target.value })} /></label>
              <label><span className="nx-label">Admission type</span>
                <select className="nx-input" value={profile.admissionType}
                  onChange={(e) => setProfile({ ...profile, admissionType: e.target.value as AdmissionType })}>
                  <option value="REGULAR">Regular</option>
                  <option value="TRANSFER">Transfer</option>
                </select></label>
              <label className="md:col-span-2"><span className="nx-label">Photo URL</span>
                <input className="nx-input" value={profile.photoUrl}
                  onChange={(e) => setProfile({ ...profile, photoUrl: e.target.value })} /></label>
              <label className="md:col-span-2"><span className="nx-label">Current address</span>
                <textarea className="nx-input min-h-[72px]" value={profile.currentAddress}
                  onChange={(e) => setProfile({ ...profile, currentAddress: e.target.value })} /></label>
              <label className="md:col-span-2"><span className="nx-label">Permanent address</span>
                <textarea className="nx-input min-h-[72px]" value={profile.permanentAddress}
                  onChange={(e) => setProfile({ ...profile, permanentAddress: e.target.value })} /></label>
            </div>
          </form>
        ) : (
          <>
            <section className="nx-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-slate-900">Personal Information</h2>
                <span className="nx-pill nx-pill-neutral">RTE: {detail.rteEnabled ? "Yes" : "No"}</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <InfoRow label="Full Name" value={studentDisplayName(detail)} />
                <InfoRow
                  label="Date of Birth"
                  value={`${formatLongDate(detail.dateOfBirth)}${ageLabel(detail.dateOfBirth)}`}
                />
                <InfoRow label="Gender" value={detail.gender || "—"} />
                <InfoRow label="Blood Group" value={detail.bloodGroup || "—"} />
                <InfoRow label="Religion" value={detail.religion || "—"} />
                <InfoRow label="Nationality" value={detail.nationality || "—"} />
              </div>
            </section>

            <section className="nx-card p-5">
              <h2 className="mb-4 text-[16px] font-semibold text-slate-900">Contact Information</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <InfoRow
                  label="Mobile Number"
                  value={
                    <span className="inline-flex items-center gap-2">
                      {detail.mobile || "—"}
                      {detail.mobile && <span className="nx-pill nx-pill-indigo">PRIMARY</span>}
                    </span>
                  }
                />
                <InfoRow label="Email Address" value={detail.email || "—"} />
                <div className="sm:col-span-2">
                  <InfoRow label="Current Address" value={detail.currentAddress || "—"} />
                </div>
                <div className="sm:col-span-2">
                  <InfoRow label="Permanent Address" value={detail.permanentAddress || "—"} />
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="nx-card h-fit p-5">
        <h2 className="text-[16px] font-semibold text-slate-900">Academic Info</h2>
        <dl className="mt-4 space-y-4">
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
            <dt className="text-[12px] text-slate-500">Admission Date</dt>
            <dd className="text-right text-[13px] font-semibold text-slate-800">{formatLongDate(detail.admissionDate)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
            <dt className="text-[12px] text-slate-500">Admission No.</dt>
            <dd className="text-right font-mono text-[13px] font-semibold text-slate-800">{detail.admissionNumber}</dd>
          </div>
          <div className="border-b border-slate-100 pb-3">
            <dt className="text-[12px] text-slate-500">Class / Section</dt>
            <dd className="mt-1.5 space-y-1 text-right text-[13px] font-semibold text-slate-800">
              {detail.enrollments.length ? (
                detail.enrollments.map((enrollment) => (
                  <p key={enrollment.id}>
                    {enrollment.classSection.academicClass.name} ·{" "}
                    {enrollment.classSection.section.name}
                    {enrollment.rollNumber ? ` · Roll ${enrollment.rollNumber}` : ""}
                    {enrollment.academicSession?.name
                      ? ` · ${enrollment.academicSession.name}`
                      : ""}
                  </p>
                ))
              ) : (
                <p>{classLabel}</p>
              )}
            </dd>
            {detail.enrollments.length > 1 ? (
              <p className="mt-2 text-right text-[11px] font-medium text-indigo-600">
                Multi-class student ({detail.enrollments.length} classes)
              </p>
            ) : null}
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
            <dt className="text-[12px] text-slate-500">Admission Type</dt>
            <dd className="text-right text-[13px] font-semibold text-slate-800">{detail.admissionType}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 pb-3">
            <dt className="text-[12px] text-slate-500">Category</dt>
            <dd className="text-right text-[13px] font-semibold text-slate-800">{detail.category?.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[12px] text-slate-500">House</dt>
            <dd className="text-right text-[13px] font-semibold text-slate-800">{detail.house?.name ?? "—"}</dd>
          </div>
        </dl>

        {(detail.transportOptIn || detail.hostelOptIn || detail.rteEnabled) && (
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            {detail.rteEnabled && (
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-[12.5px] text-indigo-800">
                RTE · {detail.rteSchemeName || "Eligible"}
                {detail.rteCertificateNo ? ` · ${detail.rteCertificateNo}` : ""}
              </div>
            )}
            {detail.transportOptIn && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
                Transport · {detail.transportRoute || "Opted in"}
              </div>
            )}
            {detail.hostelOptIn && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
                Hostel · {detail.hostelRoom || "Opted in"}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function ParentBlock({
  title,
  name,
  phone,
  email,
  occupation,
}: {
  title: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  occupation?: string | null;
}) {
  const empty = !name && !phone && !email;
  return (
    <div className="nx-card flex flex-col p-5">
      <div className="flex items-center gap-3">
        <InitialsAvatar name={name || title} size={48} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">{title}</p>
          <p className="text-[15px] font-bold text-slate-900">{name || "Not provided"}</p>
        </div>
      </div>
      {empty ? (
        <p className="mt-6 text-[13px] italic text-slate-400">No details on file.</p>
      ) : (
        <dl className="mt-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Occupation</p>
            <p className="mt-1 text-[13px] font-medium text-slate-800">{occupation || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Mobile Number</p>
            <p className="mt-1 text-[13px] font-medium text-slate-800">{phone || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Email Address</p>
            <p className="mt-1 truncate text-[13px] font-medium text-slate-800">{email || "—"}</p>
          </div>
        </dl>
      )}
      {phone && (
        <a
          href={`tel:${phone}`}
          className="nx-btn-secondary mt-auto pt-5 text-center"
        >
          Message Parent
        </a>
      )}
    </div>
  );
}

function ParentsTab({
  detail,
  token,
  onUpdated,
  onError,
  onMessage,
}: {
  detail: StudentDetail;
  token: string;
  onUpdated: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [detected, setDetected] = useState<DetectedSibling[]>([]);
  const [linkIds, setLinkIds] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

  async function detectSiblings() {
    setDetecting(true);
    try {
      const next = await apiRequest<DetectedSibling[]>(`/students/${detail.id}/siblings/detect`, token);
      setDetected(next);
      setLinkIds(next.map((item) => item.id));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to detect siblings");
    } finally {
      setDetecting(false);
    }
  }

  async function linkSiblings() {
    const studentIds = [detail.id, ...linkIds.filter((sid) => sid !== detail.id)];
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

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <ParentBlock
          title="Father"
          name={detail.fatherName}
          phone={detail.fatherPhone}
          email={detail.fatherEmail}
          occupation={detail.fatherOccupation}
        />
        <ParentBlock
          title="Mother"
          name={detail.motherName}
          phone={detail.motherPhone}
          email={detail.motherEmail}
          occupation={detail.motherOccupation}
        />
        <ParentBlock
          title={detail.guardianRelation || "Guardian"}
          name={detail.guardianName}
          phone={detail.guardianPhone}
          email={detail.guardianEmail}
          occupation={detail.guardianOccupation}
        />
      </div>

      <div className="nx-card p-5">
        <h3 className="text-[15px] font-bold text-slate-900">Linked siblings</h3>
        {detail.siblings.length > 0 ? (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {detail.siblings.map((sibling) => (
              <div className="flex items-center justify-between p-3.5" key={sibling.id}>
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={studentDisplayName(sibling)} size={36} />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{studentDisplayName(sibling)}</p>
                    <p className="text-[12px] text-slate-500">{sibling.admissionNumber}</p>
                  </div>
                </div>
                <span className={`nx-pill ${sibling.status === "ACTIVE" ? "nx-pill-success" : "nx-pill-danger"}`}>
                  {sibling.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-slate-500">No linked siblings yet.</p>
        )}

        <button className="nx-btn-secondary mt-4" disabled={detecting} type="button" onClick={() => void detectSiblings()}>
          {detecting ? "Detecting…" : "Detect possible siblings"}
        </button>

        {detected.length > 0 && (
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-slate-700">Possible matches</p>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {detected.map((item) => (
                <label className="flex items-center gap-3 p-3.5" key={item.id}>
                  <input
                    type="checkbox"
                    checked={linkIds.includes(item.id)}
                    onChange={() => {
                      setLinkIds((current) =>
                        current.includes(item.id) ? current.filter((sid) => sid !== item.id) : [...current, item.id],
                      );
                    }}
                  />
                  <div>
                    <p className="text-[13px] font-medium">{studentDisplayName(item)}</p>
                    <p className="text-[12px] text-slate-500">
                      {item.admissionNumber}
                      {item.siblingGroupId && " · Already in a sibling group"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <button className="nx-btn-primary mt-3" type="button" onClick={() => void linkSiblings()}>
              Link selected siblings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FeesTab({ detail }: { detail: StudentDetail }) {
  const fees = detail.fees;
  const nextDue = useMemo(() => {
    if (!fees?.assignments.length) return null;
    const unpaid = fees.assignments
      .filter((item) => item.totals.balance > 0)
      .sort((a, b) => +new Date(a.feeMaster.dueDate) - +new Date(b.feeMaster.dueDate));
    return unpaid[0] ?? null;
  }, [fees]);

  if (!fees) {
    return (
      <p className="nx-card mt-5 p-8 text-center text-sm text-slate-500">
        Fee summary is not available for this student.
      </p>
    );
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assigned</p>
            <p className="mt-1 text-[18px] font-bold text-slate-900">{formatMoney(fees.totals.base)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Paid</p>
            <p className="mt-1 text-[18px] font-bold text-emerald-700">{formatMoney(fees.totals.paid)}</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Discount</p>
            <p className="mt-1 text-[18px] font-bold text-amber-700">{formatMoney(fees.totals.discount)}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-600">Balance</p>
            <p className="mt-1 text-[18px] font-bold text-indigo-700">{formatMoney(fees.totals.balance)}</p>
          </div>
        </div>

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5 text-[14px] font-bold text-slate-800">
            Fee assignments
          </div>
          <div className="divide-y divide-slate-100">
            {fees.assignments.map((assignment) => (
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" key={assignment.id}>
                <div>
                  <p className="text-[13px] font-semibold text-slate-800">{assignment.feeMaster.feeType.name}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Due {formatLongDate(assignment.feeMaster.dueDate)} · Base {formatMoney(assignment.totals.base)}
                  </p>
                </div>
                <span className={`nx-pill ${assignment.totals.balance > 0 ? "nx-pill-danger" : "nx-pill-success"}`}>
                  {assignment.totals.balance > 0 ? `Due ${formatMoney(assignment.totals.balance)}` : "Paid"}
                </span>
              </div>
            ))}
            {!fees.assignments.length && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No fee assignments.</p>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="nx-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Next installment</p>
          <p className="mt-2 text-[20px] font-bold text-slate-900">
            {nextDue ? formatLongDate(nextDue.feeMaster.dueDate) : "—"}
          </p>
          {nextDue && (
            <p className="mt-1 text-[13px] text-slate-500">
              {nextDue.feeMaster.feeType.name} · {formatMoney(nextDue.totals.balance)}
            </p>
          )}
        </div>
        <div className="nx-card p-5">
          <p className="text-[13px] font-semibold text-slate-800">Collect payment</p>
          <p className="mt-1 text-[12px] text-slate-500">Open Fees module to record a payment against this student.</p>
          <Link
            to={`/fees?studentId=${detail.id}&action=collect`}
            className="nx-btn-primary mt-4 inline-flex w-full justify-center"
          >
            Collect Payment
          </Link>
        </div>
        <div className="nx-card p-5">
          <p className="text-[13px] font-semibold text-slate-800">Statement</p>
          <p className="mt-1 text-[12px] text-slate-500">Export fee history from the Fees workspace.</p>
          <Link to="/fees" className="nx-btn-secondary mt-4 inline-flex w-full justify-center">
            Download Full Statement
          </Link>
        </div>
      </aside>
    </div>
  );
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsTab({ detail }: { detail: StudentDetail }) {
  const [query, setQuery] = useState("");
  const folders = useMemo(() => {
    const map = new Map<string, { name: string; files: StudentDocument[] }>();
    for (const doc of detail.documents) {
      const key = doc.folder.id;
      const current = map.get(key) ?? { name: doc.folder.name, files: [] };
      current.files.push(doc);
      map.set(key, current);
    }
    return Array.from(map.values());
  }, [detail.documents]);

  const filtered = detail.documents.filter((doc) =>
    doc.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const totalBytes = detail.documents.reduce((sum, doc) => sum + (doc.sizeBytes ?? 0), 0);

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div className="nx-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Storage Overview</p>
          <p className="mt-2 text-[22px] font-bold text-slate-900">{detail.documents.length} Files</p>
          <p className="mt-1 text-[12.5px] text-slate-500">{formatBytes(totalBytes)} used</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.min(100, (totalBytes / (100 * 1024 * 1024)) * 100 || 4)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-violet-50/60 p-5 text-center">
          <CloudUploadOutlined sx={{ fontSize: 28 }} className="text-indigo-500" />
          <p className="mt-2 text-[13px] font-semibold text-slate-800">Quick Upload</p>
          <p className="mt-1 text-[12px] text-slate-500">Drop files here or manage uploads in ERP Documents.</p>
          <Link to="/erp-settings" className="nx-btn-secondary mt-3 inline-flex">
            Open document manager
          </Link>
        </div>

        <div className="nx-card divide-y divide-slate-100 overflow-hidden">
          {folders.map((folder) => (
            <div className="flex items-center gap-3 px-4 py-3" key={folder.name}>
              <div className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <FolderOutlined sx={{ fontSize: 18 }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{folder.name}</p>
                <p className="text-[11px] text-slate-400">{folder.files.length} files</p>
              </div>
            </div>
          ))}
          {!folders.length && (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">No folders yet.</p>
          )}
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="relative min-w-[220px] flex-1">
            <SearchOutlined
              sx={{ fontSize: 18 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-9"
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="text-[12px] text-slate-500">Sort by: Newest First</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map((doc) => (
            <a
              key={doc.id}
              href={doc.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-indigo-50/40"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-slate-50 text-indigo-500">
                <InsertDriveFileOutlined sx={{ fontSize: 20 }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{doc.name}</p>
                <p className="text-[12px] text-slate-500">
                  {doc.folder.name} · Added {formatLongDate(doc.createdAt)} · {formatBytes(doc.sizeBytes)}
                </p>
              </div>
            </a>
          ))}
          {!filtered.length && (
            <p className="px-5 py-12 text-center text-sm text-slate-500">No documents uploaded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_TINT: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-400",
  ABSENT: "bg-rose-500",
  HALF_DAY: "bg-slate-400",
  HOLIDAY: "bg-indigo-300",
};

const STATUS_PILL: Record<string, string> = {
  PRESENT: "nx-pill-success",
  LATE: "nx-pill-warning",
  ABSENT: "nx-pill-danger",
  HALF_DAY: "nx-pill-neutral",
  HOLIDAY: "nx-pill-neutral",
};

function AttendanceTab({ studentId, token }: { studentId: string; token: string }) {
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ studentId, fromDate: range.from, toDate: range.to });
    apiRequest<AttendanceReport>(`/attendance/reports?${params}`, token)
      .then(setReport)
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load attendance"))
      .finally(() => setLoading(false));
  }, [studentId, token, range.from, range.to]);

  const summary = report?.summaries[0];
  const byDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of report?.records ?? []) {
      map.set(record.attendanceDate.slice(0, 10), record.status);
    }
    return map;
  }, [report]);

  const calendarDays = useMemo(() => {
    const cursor = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);
    const days: Array<{ key: string; label: string; status?: string }> = [];
    while (cursor <= end && days.length < 62) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({
        key,
        label: String(cursor.getDate()),
        status: byDate.get(key),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [range, byDate]);

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label>
              <span className="nx-label">From</span>
              <input
                className="nx-input"
                type="date"
                value={range.from}
                onChange={(e) => setRange((current) => ({ ...current, from: e.target.value }))}
              />
            </label>
            <label>
              <span className="nx-label">To</span>
              <input
                className="nx-input"
                type="date"
                value={range.to}
                onChange={(e) => setRange((current) => ({ ...current, to: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-1">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                view === "calendar" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"
              }`}
              onClick={() => setView("calendar")}
            >
              <CalendarMonthOutlined sx={{ fontSize: 16 }} /> Calendar view
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"
              }`}
              onClick={() => setView("list")}
            >
              <ViewListOutlined sx={{ fontSize: 16 }} /> List view
            </button>
          </div>
        </div>

        <div className="nx-card overflow-hidden">
          {view === "list" ? (
            <div className="divide-y divide-slate-100">
              {report?.records.map((record) => (
                <div className="flex items-center justify-between px-5 py-3.5" key={record.id}>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">
                      {new Date(record.attendanceDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {record.studentEnrollment.classSection.academicClass.name}{" "}
                      {record.studentEnrollment.classSection.section.name}
                      {record.periodKey && ` · ${record.periodKey}`}
                    </p>
                  </div>
                  <span className={`nx-pill ${STATUS_PILL[record.status] ?? "nx-pill-neutral"}`}>
                    {record.status.replace("_", " ")}
                  </span>
                </div>
              ))}
              {!loading && !report?.records.length && (
                <p className="px-5 py-12 text-center text-sm text-slate-500">No attendance records in this range.</p>
              )}
              {loading && <p className="px-5 py-12 text-center text-sm text-slate-500">Loading attendance…</p>}
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4 flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Present</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" /> Absent</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" /> Late</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day) => (
                  <div
                    key={day.key}
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/60 text-[12px]"
                    title={day.status || "No record"}
                  >
                    <span className="font-semibold text-slate-700">{day.label}</span>
                    {day.status && (
                      <span className={`mt-1 size-2 rounded-full ${STATUS_TINT[day.status] ?? "bg-slate-300"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="nx-card p-3 text-center">
            <p className="text-[11px] font-medium text-slate-400">Present</p>
            <p className="mt-1 text-[20px] font-bold text-emerald-600">{summary?.present ?? 0}</p>
          </div>
          <div className="nx-card p-3 text-center">
            <p className="text-[11px] font-medium text-slate-400">Absent</p>
            <p className="mt-1 text-[20px] font-bold text-rose-600">{summary?.absent ?? 0}</p>
          </div>
          <div className="nx-card p-3 text-center">
            <p className="text-[11px] font-medium text-slate-400">Late</p>
            <p className="mt-1 text-[20px] font-bold text-amber-600">{summary?.late ?? 0}</p>
          </div>
        </div>
        <div className="nx-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Overall attendance</p>
          <p className="mt-2 text-[32px] font-bold text-indigo-600">
            {summary ? `${summary.percentage}%` : "—"}
          </p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Half days: {summary?.halfDay ?? 0} · Holidays: {summary?.holiday ?? 0}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.min(100, summary?.percentage ?? 0)}%` }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
