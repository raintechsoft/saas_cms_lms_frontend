import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AssignmentOutlined,
  CalendarMonthOutlined,
  CheckBoxOutlined,
  DirectionsBusOutlined,
  EditOutlined,
  EventNoteOutlined,
  GroupsOutlined,
  HistoryOutlined,
  HomeWorkOutlined,
  InfoOutlined,
  LibraryBooksOutlined,
  MeetingRoomOutlined,
  MenuBookOutlined,
  NotificationsOutlined,
  PaymentsOutlined,
  PersonOutline,
  ReceiptLongOutlined,
  SaveOutlined,
  SchoolOutlined,
  SearchOutlined,
  SupportAgentOutlined,
  TableChartOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  disableStudentLogin: boolean;
  allowProfileEditing: boolean;
  profileEditFrom: string | null;
  profileEditTo: string | null;
  selectedClassIds: string[];
  enabledPermissions: string[];
};

type ClassItem = {
  id: string;
  name: string;
  code: string | null;
  sortOrder: number;
  sectionCount: number;
  label: string;
};

type PermissionItem = { key: string; label: string };

type Setup = {
  settings: Settings;
  classes: ClassItem[];
  permissionCatalog: PermissionItem[];
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const PERMISSION_ICONS: Record<string, ReactNode> = {
  VIEW_PROFILE: <PersonOutline className="!text-[18px]" />,
  UPDATE_PROFILE: <EditOutlined className="!text-[18px]" />,
  VIEW_ATTENDANCE: <EventNoteOutlined className="!text-[18px]" />,
  VIEW_TIMETABLE: <TableChartOutlined className="!text-[18px]" />,
  VIEW_EXAM_RESULTS: <AssignmentOutlined className="!text-[18px]" />,
  VIEW_FEES: <ReceiptLongOutlined className="!text-[18px]" />,
  VIEW_HOMEWORK: <HomeWorkOutlined className="!text-[18px]" />,
  DOWNLOAD_STUDY_MATERIAL: <MenuBookOutlined className="!text-[18px]" />,
  VIEW_NOTICES: <NotificationsOutlined className="!text-[18px]" />,
  RAISE_SUPPORT_TICKET: <SupportAgentOutlined className="!text-[18px]" />,
  APPLY_LEAVE: <CalendarMonthOutlined className="!text-[18px]" />,
  ONLINE_PAYMENTS: <PaymentsOutlined className="!text-[18px]" />,
  VIEW_LIBRARY: <LibraryBooksOutlined className="!text-[18px]" />,
  BOOK_TRANSPORT: <DirectionsBusOutlined className="!text-[18px]" />,
  VIEW_HOSTEL: <MeetingRoomOutlined className="!text-[18px]" />,
};

function toInputDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Card({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-primary" : "bg-[#D1D5DB]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition",
          checked ? "left-[22px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export function StudentAccessPermissionsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Student Access & Permissions";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["students.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [settings, setSettings] = useState<Settings>({
    disableStudentLogin: false,
    allowProfileEditing: true,
    profileEditFrom: null,
    profileEditTo: null,
    selectedClassIds: [],
    enabledPermissions: [],
  });
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [catalog, setCatalog] = useState<PermissionItem[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/student-access", accessToken);
      setSettings(data.settings);
      setClasses(data.classes ?? []);
      setCatalog(data.permissionCatalog ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load student access settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        (item.code ?? "").toLowerCase().includes(q),
    );
  }, [classes, classSearch]);

  const allClassesSelected =
    classes.length > 0 && classes.every((item) => settings.selectedClassIds.includes(item.id));

  const allPermissionsSelected =
    catalog.length > 0 && catalog.every((item) => settings.enabledPermissions.includes(item.key));

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleClass(id: string) {
    setSettings((prev) => {
      const exists = prev.selectedClassIds.includes(id);
      return {
        ...prev,
        selectedClassIds: exists
          ? prev.selectedClassIds.filter((item) => item !== id)
          : [...prev.selectedClassIds, id],
      };
    });
  }

  function togglePermission(key: string) {
    setSettings((prev) => {
      const exists = prev.enabledPermissions.includes(key);
      return {
        ...prev,
        enabledPermissions: exists
          ? prev.enabledPermissions.filter((item) => item !== key)
          : [...prev.enabledPermissions, key],
      };
    });
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Settings>("/erp/student-access", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          disableStudentLogin: settings.disableStudentLogin,
          allowProfileEditing: settings.allowProfileEditing,
          profileEditFrom: settings.profileEditFrom || null,
          profileEditTo: settings.profileEditTo || null,
          selectedClassIds: settings.selectedClassIds,
          enabledPermissions: settings.enabledPermissions,
        }),
      });
      setSettings(data);
      notifySuccess("Student access configuration saved");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save configuration");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading student access settings…</div>;
  }

  const loginEnabled = !settings.disableStudentLogin;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Access & Fields <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Student Access & Permissions</h1>
          <p className="text-xs text-[#6B7280]">
            Manage student portal access and permission controls.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
          >
            <HistoryOutlined className="!text-[18px]" />
            Audit Log
          </Link>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="flex items-start gap-2 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2.5 text-sm text-[#3730A3]">
          <InfoOutlined className="!text-[18px] mt-0.5 shrink-0" />
          <p>Control what students can access and update in the student portal and mobile app.</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Card title="1. Student Portal Access" hint="Control whether students can sign in.">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F3F4F6] px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Disable Student Login</p>
                  <p className="text-xs text-[#6B7280]">Completely disable student login.</p>
                </div>
                <Toggle
                  checked={settings.disableStudentLogin}
                  disabled={!canManage}
                  onChange={() => patch("disableStudentLogin", !settings.disableStudentLogin)}
                />
              </div>
              {settings.disableStudentLogin ? (
                <div className="mt-3 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2.5 text-xs text-[#5B21B6]">
                  When disabled, students will not be able to login with their credentials.
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-xs text-[#166534]">
                  Student login is currently enabled for the portal and mobile app.
                </div>
              )}
            </Card>

            <Card
              title="2. Student Profile Edit Rights"
              hint="Allow students to edit their profile during a date window."
            >
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F3F4F6] px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Allow Profile Editing</p>
                  <p className="text-xs text-[#6B7280]">Students can update profile details.</p>
                </div>
                <Toggle
                  checked={settings.allowProfileEditing}
                  disabled={!canManage}
                  onChange={() => patch("allowProfileEditing", !settings.allowProfileEditing)}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>From Date</FieldLabel>
                  <input
                    type="date"
                    className={inputClass}
                    disabled={!canManage || !settings.allowProfileEditing}
                    value={toInputDate(settings.profileEditFrom)}
                    onChange={(e) => patch("profileEditFrom", e.target.value || null)}
                  />
                </label>
                <label>
                  <FieldLabel>To Date</FieldLabel>
                  <input
                    type="date"
                    className={inputClass}
                    disabled={!canManage || !settings.allowProfileEditing}
                    value={toInputDate(settings.profileEditTo)}
                    onChange={(e) => patch("profileEditTo", e.target.value || null)}
                  />
                </label>
              </div>
              {settings.allowProfileEditing ? (
                <div className="mt-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5 text-xs text-[#166534]">
                  Profile editing is open from {formatDisplayDate(settings.profileEditFrom)} to{" "}
                  {formatDisplayDate(settings.profileEditTo)}.
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-xs text-[#92400E]">
                  Profile editing is turned off for students.
                </div>
              )}
            </Card>

            <Card
              title="3. Class Access"
              hint="Choose which classes these portal permissions apply to."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage || classes.length === 0}
                    onClick={() =>
                      patch(
                        "selectedClassIds",
                        allClassesSelected ? [] : classes.map((item) => item.id),
                      )
                    }
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                  >
                    {allClassesSelected ? "Clear All" : "Select All"}
                  </button>
                  <label className="relative">
                    <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[16px] -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      className="w-44 rounded-lg border border-[#E5E7EB] bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
                      placeholder="Search class..."
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                    />
                  </label>
                </div>
              }
            >
              {filteredClasses.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#6B7280]">
                  {classes.length === 0
                    ? "No classes found. Create classes in Class & Section setup first."
                    : "No classes match your search."}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredClasses.map((item) => {
                    const selected = settings.selectedClassIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleClass(item.id)}
                        className={[
                          "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-50",
                          selected
                            ? "border-primary bg-[#F5F3FF]"
                            : "border-[#E5E7EB] bg-white hover:border-[#C7D2FE]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                            selected
                              ? "border-primary bg-primary text-white"
                              : "border-[#D1D5DB] bg-white",
                          ].join(" ")}
                        >
                          {selected ? <CheckBoxOutlined className="!text-[12px]" /> : null}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-[#1A1A1A]">
                            {item.name}
                          </span>
                          <span className="block text-[11px] text-[#6B7280]">
                            {item.sectionCount > 0 ? "All Sections" : "No sections"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 inline-flex rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">
                Selected Classes: {settings.selectedClassIds.length}
              </div>
            </Card>
          </div>

          <aside className="h-fit rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm xl:sticky xl:top-0">
            <h3 className="mb-3 text-sm font-bold text-[#1A1A1A]">Configuration Summary</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-[#F0FDF4] px-3 py-2.5">
                <PersonOutline className="!text-[18px] mt-0.5 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-[#6B7280]">Student Login</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {loginEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-[#EFF6FF] px-3 py-2.5">
                <EditOutlined className="!text-[18px] mt-0.5 text-sky-600" />
                <div>
                  <p className="text-xs font-semibold text-[#6B7280]">Profile Edit Window</p>
                  <p className="text-sm font-bold text-sky-700">
                    {settings.allowProfileEditing
                      ? `${formatDisplayDate(settings.profileEditFrom)} - ${formatDisplayDate(settings.profileEditTo)}`
                      : "Not allowed"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-[#F5F3FF] px-3 py-2.5">
                <GroupsOutlined className="!text-[18px] mt-0.5 text-violet-600" />
                <div>
                  <p className="text-xs font-semibold text-[#6B7280]">Applicable Classes</p>
                  <p className="text-sm font-bold text-violet-700">
                    {settings.selectedClassIds.length} Class
                    {settings.selectedClassIds.length === 1 ? "" : "es"} Selected
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2.5">
                <SchoolOutlined className="!text-[18px] mt-0.5 text-[#6B7280]" />
                <div>
                  <p className="text-xs font-semibold text-[#6B7280]">Feature Permissions</p>
                  <p className="text-sm font-bold text-[#1A1A1A]">
                    {settings.enabledPermissions.length} / {catalog.length} Enabled
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <Card
          title="4. Portal & Feature Permissions"
          hint="Toggle features students can use in the portal."
          actions={
            <button
              type="button"
              disabled={!canManage || catalog.length === 0}
              onClick={() =>
                patch(
                  "enabledPermissions",
                  allPermissionsSelected ? [] : catalog.map((item) => item.key),
                )
              }
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-40"
            >
              {allPermissionsSelected ? "Clear All" : "Select All"}
            </button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {catalog.map((item) => {
              const enabled = settings.enabledPermissions.includes(item.key);
              return (
                <div
                  key={item.key}
                  className={[
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5",
                    enabled ? "border-[#DDD6FE] bg-[#F5F3FF]" : "border-[#E5E7EB] bg-white",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        enabled ? "bg-white text-primary" : "bg-[#F3F4F6] text-[#6B7280]",
                      ].join(" ")}
                    >
                      {PERMISSION_ICONS[item.key] ?? <SchoolOutlined className="!text-[18px]" />}
                    </span>
                    <span className="truncate text-xs font-semibold text-[#1A1A1A]">
                      {item.label}
                    </span>
                  </div>
                  <Toggle
                    checked={enabled}
                    disabled={!canManage}
                    onChange={() => togglePermission(item.key)}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs text-[#1E40AF]">
            <InfoOutlined className="!text-[16px] shrink-0" />
            <p>Permissions will apply to the selected classes only.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
