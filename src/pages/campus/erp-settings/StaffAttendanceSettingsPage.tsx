import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  LightbulbOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  moduleEnabled: boolean;
  markingMode: string;
  allowManual: boolean;
  allowSelfCheckIn: boolean;
  allowSelfCheckOut: boolean;
  showOfficeLocation: boolean;
  requireRemarksManual: boolean;
  halfDayAs: string;
  colorScheme: string;
  defaultShiftId: string | null;
  workingDays: number[];
  weeklyOffDays: number[];
  workFrom: string;
  workTo: string;
  breakMinutes: number;
  graceBeforeMinutes: number;
  graceAfterMinutes: number;
  lateAfterMinutes: number;
  earlyLeavingMinutes: number;
  halfDayAfterMinutes: number;
  overtimeMode: string;
  minFullDayMinutes: number;
  markAbsentWeeklyOff: boolean;
  markAbsentHoliday: boolean;
  autoApplyApprovedLeave: boolean;
  autoMarkHoliday: boolean;
  leaveDayCounting: string;
  absentMarkingType: string;
  cdOnWeeklyOff: boolean;
  locationTracking: boolean;
  attendanceRadiusMeters: number;
  allowCheckInOutside: boolean;
  allowCheckOutOutside: boolean;
  restrictMultipleLogin: boolean;
  deviceRestriction: string;
};

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isDefault: boolean;
  isActive: boolean;
};

type Holiday = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  kind: "MANDATORY" | "OPTIONAL";
  repeatsAnnually: boolean;
  description: string | null;
};

type Setup = { settings: Settings; shifts: Shift[]; holidays: Holiday[] };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = [
  { key: "purple", swatch: "bg-violet-600" },
  { key: "blue", swatch: "bg-sky-500" },
  { key: "green", swatch: "bg-emerald-500" },
  { key: "yellow", swatch: "bg-amber-400" },
  { key: "orange", swatch: "bg-orange-500" },
  { key: "red", swatch: "bg-rose-500" },
];

const DEFAULTS: Settings = {
  moduleEnabled: true,
  markingMode: "WEB_MOBILE",
  allowManual: true,
  allowSelfCheckIn: true,
  allowSelfCheckOut: true,
  showOfficeLocation: true,
  requireRemarksManual: false,
  halfDayAs: "HALF_DAY",
  colorScheme: "purple",
  defaultShiftId: null,
  workingDays: [1, 2, 3, 4, 5],
  weeklyOffDays: [0, 6],
  workFrom: "09:00",
  workTo: "18:00",
  breakMinutes: 60,
  graceBeforeMinutes: 15,
  graceAfterMinutes: 15,
  lateAfterMinutes: 15,
  earlyLeavingMinutes: 15,
  halfDayAfterMinutes: 240,
  overtimeMode: "AFTER_OFFICE",
  minFullDayMinutes: 480,
  markAbsentWeeklyOff: false,
  markAbsentHoliday: false,
  autoApplyApprovedLeave: true,
  autoMarkHoliday: true,
  leaveDayCounting: "EXCLUDE_OFF_HOLIDAY",
  absentMarkingType: "FULL_DAY",
  cdOnWeeklyOff: false,
  locationTracking: true,
  attendanceRadiusMeters: 100,
  allowCheckInOutside: false,
  allowCheckOutOutside: false,
  restrictMultipleLogin: true,
  deviceRestriction: "ANY",
};

function Card({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-2.5 last:border-b-0">
      <span className="text-sm font-medium text-[#1A1A1A]">{label}</span>
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
    </div>
  );
}

function minutesToHoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatHolidayDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function StaffAttendanceSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Staff Attendance Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["hr.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [shiftFormOpen, setShiftFormOpen] = useState(false);
  const [shiftName, setShiftName] = useState("");
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("18:00");

  const [holidayFormOpen, setHolidayFormOpen] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null);
  const [holidayTitle, setHolidayTitle] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayKind, setHolidayKind] = useState<"MANDATORY" | "OPTIONAL">("MANDATORY");
  const [holidayRepeat, setHolidayRepeat] = useState(true);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/staff-attendance-settings", accessToken);
      setSettings({ ...DEFAULTS, ...data.settings });
      setShifts(data.shifts ?? []);
      setHolidays(data.holidays ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/staff-attendance-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings({ ...DEFAULTS, ...data.settings });
      setShifts(data.shifts ?? []);
      setHolidays(data.holidays ?? []);
      notifySuccess("Staff attendance settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  function toggleWorkingDay(day: number) {
    const next = settings.workingDays.includes(day)
      ? settings.workingDays.filter((d) => d !== day)
      : [...settings.workingDays, day].sort();
    const weeklyOff = [0, 1, 2, 3, 4, 5, 6].filter((d) => !next.includes(d));
    patch("workingDays", next);
    patch("weeklyOffDays", weeklyOff);
  }

  async function addShift() {
    if (!accessToken || !canManage) return;
    const name = shiftName.trim();
    if (!name) {
      notifyError("Shift name is required.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/erp/staff-work-shifts", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name,
          startTime: shiftStart,
          endTime: shiftEnd,
          isDefault: shifts.length === 0,
        }),
      });
      notifySuccess("Shift added");
      setShiftFormOpen(false);
      setShiftName("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add shift");
    } finally {
      setSaving(false);
    }
  }

  function resetHolidayForm() {
    setHolidayFormOpen(false);
    setEditingHolidayId(null);
    setHolidayTitle("");
    setHolidayDate("");
    setHolidayKind("MANDATORY");
    setHolidayRepeat(true);
  }

  function startEditHoliday(item: Holiday) {
    setHolidayFormOpen(true);
    setEditingHolidayId(item.id);
    setHolidayTitle(item.title);
    setHolidayDate(item.startDate.slice(0, 10));
    setHolidayKind(item.kind);
    setHolidayRepeat(item.repeatsAnnually);
  }

  async function saveHoliday() {
    if (!accessToken || !canManage) return;
    if (!holidayTitle.trim() || !holidayDate) {
      notifyError("Holiday name and date are required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: holidayTitle.trim(),
        startDate: holidayDate,
        endDate: holidayDate,
        kind: holidayKind,
        repeatsAnnually: holidayRepeat,
      };
      if (editingHolidayId) {
        await apiRequest(`/erp/staff-attendance-holidays/${editingHolidayId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Holiday updated");
      } else {
        await apiRequest("/erp/staff-attendance-holidays", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Holiday added");
      }
      resetHolidayForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save holiday");
    } finally {
      setSaving(false);
    }
  }

  async function deleteHoliday(item: Holiday) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete holiday "${item.title}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/staff-attendance-holidays/${item.id}`, accessToken, {
        method: "DELETE",
      });
      notifySuccess("Holiday deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete holiday");
    } finally {
      setSaving(false);
    }
  }

  const weeklyOffLabel = settings.weeklyOffDays.map((d) => DAY_LABELS[d]).join(", ") || "None";

  return (
    <form className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]" onSubmit={save}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Staff Attendance Settings
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure staff attendance policies, working hours and related preferences.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card title="1. General Settings">
            <ToggleRow
              label="Enable Staff Attendance"
              checked={settings.moduleEnabled}
              disabled={!canManage || saving}
              onChange={() => patch("moduleEnabled", !settings.moduleEnabled)}
            />
            <label className="mt-3 block">
              <FieldLabel>Attendance Marking Mode</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.markingMode}
                disabled={!canManage}
                onChange={(e) => patch("markingMode", e.target.value)}
              >
                <option value="WEB_MOBILE">Web & Mobile App</option>
                <option value="WEB">Web Only</option>
                <option value="MOBILE">Mobile Only</option>
                <option value="BIOMETRIC">Biometric</option>
              </select>
            </label>
            <ToggleRow
              label="Allow Manual Attendance"
              checked={settings.allowManual}
              disabled={!canManage}
              onChange={() => patch("allowManual", !settings.allowManual)}
            />
            <ToggleRow
              label="Allow Self Check-In"
              checked={settings.allowSelfCheckIn}
              disabled={!canManage}
              onChange={() => patch("allowSelfCheckIn", !settings.allowSelfCheckIn)}
            />
            <ToggleRow
              label="Allow Self Check-Out"
              checked={settings.allowSelfCheckOut}
              disabled={!canManage}
              onChange={() => patch("allowSelfCheckOut", !settings.allowSelfCheckOut)}
            />
            <ToggleRow
              label="Show Office Location in App"
              checked={settings.showOfficeLocation}
              disabled={!canManage}
              onChange={() => patch("showOfficeLocation", !settings.showOfficeLocation)}
            />
            <ToggleRow
              label="Require Remarks on Manual Entry"
              checked={settings.requireRemarksManual}
              disabled={!canManage}
              onChange={() => patch("requireRemarksManual", !settings.requireRemarksManual)}
            />
            <label className="mt-3 block">
              <FieldLabel>Consider Half Day as</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.halfDayAs}
                disabled={!canManage}
                onChange={(e) => patch("halfDayAs", e.target.value)}
              >
                <option value="HALF_DAY">Half Day</option>
                <option value="ABSENT">Absent</option>
                <option value="PRESENT">Present</option>
              </select>
            </label>
            <div className="mt-3">
              <FieldLabel>Attendance Color Scheme</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color.key}
                    type="button"
                    disabled={!canManage}
                    onClick={() => patch("colorScheme", color.key)}
                    className={[
                      "inline-flex size-8 items-center justify-center rounded-full",
                      color.swatch,
                      settings.colorScheme === color.key
                        ? "ring-2 ring-offset-2 ring-[#1A1A1A]"
                        : "",
                    ].join(" ")}
                  >
                    {settings.colorScheme === color.key ? (
                      <CheckOutlined sx={{ fontSize: 14 }} className="text-white" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title="2. Working Hours & Shift Settings"
            actions={
              <button
                type="button"
                className="text-xs font-semibold text-primary disabled:opacity-50"
                disabled={!canManage}
                onClick={() => setShiftFormOpen((v) => !v)}
              >
                + Add Shift
              </button>
            }
          >
            {shiftFormOpen ? (
              <div className="mb-3 space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <input
                  placeholder="Shift name"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void addShift()}
                  >
                    Save shift
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs"
                    onClick={() => setShiftFormOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <label className="mb-3 block">
              <FieldLabel>Default Shift</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.defaultShiftId ?? ""}
                disabled={!canManage}
                onChange={(e) => {
                  const id = e.target.value || null;
                  patch("defaultShiftId", id);
                  const shift = shifts.find((s) => s.id === id);
                  if (shift) {
                    patch("workFrom", shift.startTime);
                    patch("workTo", shift.endTime);
                  }
                }}
              >
                <option value="">Select shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.startTime} - {shift.endTime})
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-3">
              <FieldLabel>Standard Working Days</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => {
                  const active = settings.workingDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!canManage}
                      onClick={() => toggleWorkingDay(day)}
                      className={[
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                        active
                          ? "bg-primary text-white"
                          : "border border-[#E5E7EB] bg-white text-[#6B7280]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mb-3 block">
              <FieldLabel>Weekly Off</FieldLabel>
              <input
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm"
                value={weeklyOffLabel}
                disabled
              />
            </label>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>Working Hours From</FieldLabel>
                <input
                  type="time"
                  className="w-full rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                  value={settings.workFrom}
                  disabled={!canManage}
                  onChange={(e) => patch("workFrom", e.target.value)}
                />
              </label>
              <label className="block">
                <FieldLabel>To</FieldLabel>
                <input
                  type="time"
                  className="w-full rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                  value={settings.workTo}
                  disabled={!canManage}
                  onChange={(e) => patch("workTo", e.target.value)}
                />
              </label>
            </div>

            <label className="mb-3 block">
              <FieldLabel>Break Duration (minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.breakMinutes}
                disabled={!canManage}
                onChange={(e) => patch("breakMinutes", Number(e.target.value) || 0)}
              />
              <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                {minutesToHoursLabel(settings.breakMinutes)} Hours
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>Grace Time (Before In)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                  value={settings.graceBeforeMinutes}
                  disabled={!canManage}
                  onChange={(e) => patch("graceBeforeMinutes", Number(e.target.value) || 0)}
                />
              </label>
              <label className="block">
                <FieldLabel>Grace Time (After Out)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                  value={settings.graceAfterMinutes}
                  disabled={!canManage}
                  onChange={(e) => patch("graceAfterMinutes", Number(e.target.value) || 0)}
                />
              </label>
            </div>
          </Card>

          <Card title="3. Attendance Rules">
            <label className="mb-3 block">
              <FieldLabel>Late Marking — after (minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.lateAfterMinutes}
                disabled={!canManage}
                onChange={(e) => patch("lateAfterMinutes", Number(e.target.value) || 0)}
              />
            </label>
            <label className="mb-3 block">
              <FieldLabel>Early Leaving — before (minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.earlyLeavingMinutes}
                disabled={!canManage}
                onChange={(e) => patch("earlyLeavingMinutes", Number(e.target.value) || 0)}
              />
            </label>
            <label className="mb-3 block">
              <FieldLabel>Half Day Marking — after (minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.halfDayAfterMinutes}
                disabled={!canManage}
                onChange={(e) => patch("halfDayAfterMinutes", Number(e.target.value) || 0)}
              />
              <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                {minutesToHoursLabel(settings.halfDayAfterMinutes)} Hours
              </span>
            </label>
            <label className="mb-3 block">
              <FieldLabel>Overtime Calculation</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.overtimeMode}
                disabled={!canManage}
                onChange={(e) => patch("overtimeMode", e.target.value)}
              >
                <option value="AFTER_OFFICE">After Office Hours</option>
                <option value="AFTER_SHIFT">After Shift End</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </label>
            <label className="mb-3 block">
              <FieldLabel>Minimum Working Hours (Full Day, minutes)</FieldLabel>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.minFullDayMinutes}
                disabled={!canManage}
                onChange={(e) => patch("minFullDayMinutes", Number(e.target.value) || 0)}
              />
              <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                {minutesToHoursLabel(settings.minFullDayMinutes)} Hours
              </span>
            </label>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="inline-flex items-center gap-1 font-semibold">
                <LightbulbOutlined sx={{ fontSize: 14 }} />
                Note:
              </span>{" "}
              Rules will be applied to all staff unless shift specific rules are set.
            </div>
          </Card>

          <Card title="4. Attendance Policy">
            <ToggleRow
              label="Mark Absent on Weekly Off"
              checked={settings.markAbsentWeeklyOff}
              disabled={!canManage}
              onChange={() => patch("markAbsentWeeklyOff", !settings.markAbsentWeeklyOff)}
            />
            <ToggleRow
              label="Mark Absent on Holiday"
              checked={settings.markAbsentHoliday}
              disabled={!canManage}
              onChange={() => patch("markAbsentHoliday", !settings.markAbsentHoliday)}
            />
            <ToggleRow
              label="Auto Apply Approved Leave"
              checked={settings.autoApplyApprovedLeave}
              disabled={!canManage}
              onChange={() => patch("autoApplyApprovedLeave", !settings.autoApplyApprovedLeave)}
            />
            <ToggleRow
              label="Auto Mark Attendance on Holidays"
              checked={settings.autoMarkHoliday}
              disabled={!canManage}
              onChange={() => patch("autoMarkHoliday", !settings.autoMarkHoliday)}
            />
            <label className="mt-3 block">
              <FieldLabel>Leave Day Counting</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.leaveDayCounting}
                disabled={!canManage}
                onChange={(e) => patch("leaveDayCounting", e.target.value)}
              >
                <option value="EXCLUDE_OFF_HOLIDAY">Exclude Weekly Off & Holidays</option>
                <option value="INCLUDE_ALL">Include All Days</option>
                <option value="EXCLUDE_HOLIDAY">Exclude Holidays Only</option>
              </select>
            </label>
            <label className="mt-3 block">
              <FieldLabel>Absent Marking Type</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.absentMarkingType}
                disabled={!canManage}
                onChange={(e) => patch("absentMarkingType", e.target.value)}
              >
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </label>
            <ToggleRow
              label="CD on Weekly Off"
              checked={settings.cdOnWeeklyOff}
              disabled={!canManage}
              onChange={() => patch("cdOnWeeklyOff", !settings.cdOnWeeklyOff)}
            />
          </Card>

          <Card title="5. Location & Device Settings">
            <ToggleRow
              label="Enable Location Tracking"
              checked={settings.locationTracking}
              disabled={!canManage}
              onChange={() => patch("locationTracking", !settings.locationTracking)}
            />
            <label className="mt-3 block">
              <FieldLabel>Attendance Range (Radius, meters)</FieldLabel>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.attendanceRadiusMeters}
                disabled={!canManage}
                onChange={(e) => patch("attendanceRadiusMeters", Number(e.target.value) || 1)}
              />
            </label>
            <ToggleRow
              label="Allow Check-In Outside Office"
              checked={settings.allowCheckInOutside}
              disabled={!canManage}
              onChange={() => patch("allowCheckInOutside", !settings.allowCheckInOutside)}
            />
            <ToggleRow
              label="Allow Check-Out Outside Office"
              checked={settings.allowCheckOutOutside}
              disabled={!canManage}
              onChange={() => patch("allowCheckOutOutside", !settings.allowCheckOutOutside)}
            />
            <ToggleRow
              label="Restrict Multiple Login"
              checked={settings.restrictMultipleLogin}
              disabled={!canManage}
              onChange={() => patch("restrictMultipleLogin", !settings.restrictMultipleLogin)}
            />
            <label className="mt-3 block">
              <FieldLabel>Device Restriction</FieldLabel>
              <select
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                value={settings.deviceRestriction}
                disabled={!canManage}
                onChange={(e) => patch("deviceRestriction", e.target.value)}
              >
                <option value="ANY">Allow from any device</option>
                <option value="REGISTERED">Registered devices only</option>
                <option value="SINGLE">Single device per staff</option>
              </select>
            </label>
          </Card>

          <Card
            title="6. Holidays"
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                disabled={!canManage}
                onClick={() => {
                  resetHolidayForm();
                  setHolidayFormOpen(true);
                }}
              >
                <AddOutlined sx={{ fontSize: 14 }} />
                Add Holiday
              </button>
            }
          >
            {holidayFormOpen ? (
              <div className="mb-3 space-y-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <input
                  placeholder="Holiday name"
                  value={holidayTitle}
                  onChange={(e) => setHolidayTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={holidayKind}
                    onChange={(e) => setHolidayKind(e.target.value as "MANDATORY" | "OPTIONAL")}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-2 text-sm"
                  >
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={holidayRepeat}
                      onChange={(e) => setHolidayRepeat(e.target.checked)}
                    />
                    Annually
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => void saveHoliday()}
                  >
                    {editingHolidayId ? "Update" : "Add"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs"
                    onClick={resetHolidayForm}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-1 py-2 font-semibold">#</th>
                    <th className="px-1 py-2 font-semibold">Holiday Name</th>
                    <th className="px-1 py-2 font-semibold">Date</th>
                    <th className="px-1 py-2 font-semibold">Type</th>
                    <th className="px-1 py-2 font-semibold">Repeat</th>
                    <th className="px-1 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-1 py-4 text-center text-[#9CA3AF]">
                        No holidays yet.
                      </td>
                    </tr>
                  ) : (
                    holidays.slice(0, 8).map((item, index) => (
                      <tr key={item.id} className="border-b border-[#F3F4F6]">
                        <td className="px-1 py-2 text-[#6B7280]">{index + 1}</td>
                        <td className="px-1 py-2 font-medium text-[#1A1A1A]">{item.title}</td>
                        <td className="px-1 py-2 text-[#374151]">
                          {formatHolidayDate(item.startDate)}
                        </td>
                        <td className="px-1 py-2 text-[#374151]">
                          {item.kind === "MANDATORY" ? "Mandatory" : "Optional"}
                        </td>
                        <td className="px-1 py-2 text-[#374151]">
                          {item.repeatsAnnually ? "Annually" : "Once"}
                        </td>
                        <td className="px-1 py-2">
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              className="rounded p-1 text-primary"
                              disabled={!canManage}
                              onClick={() => startEditHoliday(item)}
                            >
                              <EditOutlined sx={{ fontSize: 14 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded p-1 text-rose-600"
                              disabled={!canManage}
                              onClick={() => void deleteHoliday(item)}
                            >
                              <DeleteOutline sx={{ fontSize: 14 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Link
              to="/erp/holidays-calendar"
              className="mt-3 inline-block text-xs font-semibold text-primary"
            >
              View All Holidays
            </Link>
          </Card>
        </div>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <div className="flex items-start gap-2">
            <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-sky-600" />
            <p>
              Note: Changes saved here will reflect in staff attendance module and mobile app
              immediately.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
