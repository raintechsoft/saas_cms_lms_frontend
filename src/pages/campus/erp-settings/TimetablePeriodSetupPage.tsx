import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  MenuBookOutlined,
  OpenInNewOutlined,
  SaveOutlined,
  ScheduleOutlined,
  ViewWeekOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };
type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
type PeriodNumberingMode = "CONTINUOUS" | "RESET_AFTER_BREAKS";

interface NamedClass {
  id: string;
  name: string;
  sortOrder?: number;
}

interface PeriodItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  sortOrder: number;
  durationMins: number;
}

interface TemplateItem {
  id: string;
  name: string;
  workingDays: Weekday[];
  isActive: boolean;
  createdAt: string;
  periodCount: number;
  classes: NamedClass[];
}

interface PeriodSetupSettings {
  workingDays: Weekday[];
  defaultPeriodDuration: number;
  firstPeriodStartsAt: string;
  lastPeriodEndsAt: string;
  periodNumberingMode: PeriodNumberingMode;
  allowPeriodOverlap: boolean;
  enableDoublePeriod: boolean;
}

interface PeriodSetupPayload {
  settings: PeriodSetupSettings;
  periods: PeriodItem[];
  templates: TemplateItem[];
  classes: NamedClass[];
}

const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string }> = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

const SHORT_DAY: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const TEMPLATE_PAGE_SIZE = 10;

function Card({
  title,
  children,
  actions,
  className = "",
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs leading-relaxed text-[#1E40AF]">
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-primary" : "bg-[#D1D5DB]",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block size-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function formatWorkingDays(days: Weekday[]) {
  if (!days.length) return "—";
  const ordered = WEEKDAY_OPTIONS.map((d) => d.value).filter((d) => days.includes(d));
  if (ordered.length === 1) return SHORT_DAY[ordered[0]];
  return `${SHORT_DAY[ordered[0]]} - ${SHORT_DAY[ordered[ordered.length - 1]]}`;
}

function formatCreatedOn(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toInputTime(value: string) {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function TimetablePeriodSetupPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Timetable & Period Setup";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "timetable.manage", "academics.manage"].includes(p),
    ),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<PeriodSetupPayload | null>(null);

  const [workingDays, setWorkingDays] = useState<Weekday[]>([]);
  const [defaultPeriodDuration, setDefaultPeriodDuration] = useState("45");
  const [firstPeriodStartsAt, setFirstPeriodStartsAt] = useState("08:00");
  const [lastPeriodEndsAt, setLastPeriodEndsAt] = useState("15:30");
  const [periodNumberingMode, setPeriodNumberingMode] =
    useState<PeriodNumberingMode>("CONTINUOUS");
  const [allowPeriodOverlap, setAllowPeriodOverlap] = useState(false);
  const [enableDoublePeriod, setEnableDoublePeriod] = useState(true);

  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("08:00");
  const [periodEnd, setPeriodEnd] = useState("08:45");
  const [periodIsBreak, setPeriodIsBreak] = useState(false);

  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateClassIds, setTemplateClassIds] = useState<string[]>([]);
  const [templateWorkingDays, setTemplateWorkingDays] = useState<Weekday[]>([]);
  const [templatePage, setTemplatePage] = useState(1);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<PeriodSetupPayload>(
        "/erp/timetable-period-setup",
        accessToken,
      );
      setPayload(data);
      setWorkingDays(data.settings.workingDays);
      setDefaultPeriodDuration(String(data.settings.defaultPeriodDuration));
      setFirstPeriodStartsAt(toInputTime(data.settings.firstPeriodStartsAt));
      setLastPeriodEndsAt(toInputTime(data.settings.lastPeriodEndsAt));
      setPeriodNumberingMode(data.settings.periodNumberingMode);
      setAllowPeriodOverlap(data.settings.allowPeriodOverlap);
      setEnableDoublePeriod(data.settings.enableDoublePeriod);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load timetable setup");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const periods = payload?.periods ?? [];
  const templates = payload?.templates ?? [];
  const classes = payload?.classes ?? [];

  const totalTemplatePages = Math.max(1, Math.ceil(templates.length / TEMPLATE_PAGE_SIZE));
  const currentTemplatePage = Math.min(templatePage, totalTemplatePages);
  const pagedTemplates = templates.slice(
    (currentTemplatePage - 1) * TEMPLATE_PAGE_SIZE,
    currentTemplatePage * TEMPLATE_PAGE_SIZE,
  );
  const templateRangeStart = templates.length
    ? (currentTemplatePage - 1) * TEMPLATE_PAGE_SIZE + 1
    : 0;
  const templateRangeEnd = Math.min(
    currentTemplatePage * TEMPLATE_PAGE_SIZE,
    templates.length,
  );

  function toggleWorkingDay(day: Weekday) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  }

  function toggleTemplateDay(day: Weekday) {
    setTemplateWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  }

  function toggleTemplateClass(id: string) {
    setTemplateClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function resetPeriodForm() {
    setPeriodFormOpen(false);
    setEditingPeriodId(null);
    setPeriodName("");
    setPeriodStart("08:00");
    setPeriodEnd("08:45");
    setPeriodIsBreak(false);
  }

  function startAddPeriod() {
    setPeriodFormOpen(true);
    setEditingPeriodId(null);
    setPeriodName("");
    setPeriodStart(firstPeriodStartsAt || "08:00");
    const mins = Number(defaultPeriodDuration) || 45;
    const [h, m] = (firstPeriodStartsAt || "08:00").split(":").map(Number);
    const endTotal = h * 60 + m + mins;
    setPeriodEnd(
      `${String(Math.floor(endTotal / 60) % 24).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`,
    );
    setPeriodIsBreak(false);
  }

  function startEditPeriod(item: PeriodItem) {
    setPeriodFormOpen(true);
    setEditingPeriodId(item.id);
    setPeriodName(item.name);
    setPeriodStart(item.startTime);
    setPeriodEnd(item.endTime);
    setPeriodIsBreak(item.isBreak);
  }

  function resetTemplateForm() {
    setTemplateFormOpen(false);
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateClassIds([]);
    setTemplateWorkingDays(workingDays);
  }

  function startAddTemplate() {
    setTemplateFormOpen(true);
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateClassIds([]);
    setTemplateWorkingDays(workingDays);
  }

  function startEditTemplate(item: TemplateItem) {
    setTemplateFormOpen(true);
    setEditingTemplateId(item.id);
    setTemplateName(item.name);
    setTemplateClassIds(item.classes.map((c) => c.id));
    setTemplateWorkingDays(item.workingDays);
  }

  async function saveSettings() {
    if (!accessToken || !canManage) return;
    const duration = Number(defaultPeriodDuration);
    if (!Number.isFinite(duration) || duration < 5) {
      notifyError("Default period duration must be at least 5 minutes.");
      return;
    }
    if (!workingDays.length) {
      notifyError("Select at least one working day.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/erp/timetable-period-setup/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          workingDays,
          defaultPeriodDuration: duration,
          firstPeriodStartsAt,
          lastPeriodEndsAt,
          periodNumberingMode,
          allowPeriodOverlap,
          enableDoublePeriod,
        }),
      });
      notifySuccess("Timetable settings saved");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function savePeriod(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = periodName.trim();
    if (!name) {
      notifyError("Period name is required.");
      return;
    }
    if (periodEnd <= periodStart) {
      notifyError("End time must be after start time.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        startTime: periodStart,
        endTime: periodEnd,
        isBreak: periodIsBreak,
      };
      if (editingPeriodId) {
        await apiRequest(`/erp/timetable-periods/${editingPeriodId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Period updated");
      } else {
        await apiRequest("/erp/timetable-periods", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Period added");
      }
      resetPeriodForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save period");
    } finally {
      setSaving(false);
    }
  }

  async function deletePeriod(item: PeriodItem) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete "${item.name}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/timetable-periods/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Period deleted");
      if (editingPeriodId === item.id) resetPeriodForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete period");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = templateName.trim();
    if (!name) {
      notifyError("Template name is required.");
      return;
    }
    if (!templateClassIds.length) {
      notifyError("Select at least one applicable class.");
      return;
    }
    if (!templateWorkingDays.length) {
      notifyError("Select working days for the template.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        classIds: templateClassIds,
        workingDays: templateWorkingDays,
        isActive: true,
      };
      if (editingTemplateId) {
        await apiRequest(`/erp/timetable-templates/${editingTemplateId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Template updated");
      } else {
        await apiRequest("/erp/timetable-templates", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Template added");
      }
      resetTemplateForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(item: TemplateItem) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete template "${item.name}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/timetable-templates/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Template deleted");
      if (editingTemplateId === item.id) resetTemplateForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete template");
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (periodFormOpen && (editingPeriodId || periodName.trim())) {
      await savePeriod();
      return;
    }
    if (templateFormOpen && (editingTemplateId || templateName.trim())) {
      await saveTemplate();
      return;
    }
    await saveSettings();
  }

  const guideItems = useMemo(
    () => [
      {
        icon: <ScheduleOutlined sx={{ fontSize: 18 }} />,
        title: "Periods",
        text: "Define teaching slots with start and end times for the school day.",
      },
      {
        icon: <ViewWeekOutlined sx={{ fontSize: 18 }} />,
        title: "Breaks",
        text: "Mark breaks so they appear highlighted and are excluded from teaching counts.",
      },
      {
        icon: <MenuBookOutlined sx={{ fontSize: 18 }} />,
        title: "Double Period",
        text: "When enabled, schedulers can book two consecutive periods for one subject.",
      },
      {
        icon: <InfoOutlined sx={{ fontSize: 18 }} />,
        title: "Timetable Templates",
        text: "Save period configurations for class groups (e.g. Primary vs Secondary).",
      },
    ],
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
          onClick={() => void saveConfiguration()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Timetable & Period Setup
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure periods, working days, and timetable templates for your institution.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]">
              <Card
                title="1. Configure Periods"
                actions={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                    disabled={!canManage || saving}
                    onClick={startAddPeriod}
                  >
                    <AddOutlined sx={{ fontSize: 16 }} />
                    Add Period
                  </button>
                }
              >
                {periodFormOpen ? (
                  <form
                    className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2"
                    onSubmit={(e) => void savePeriod(e)}
                  >
                    <label className="block sm:col-span-2">
                      <FieldLabel>Period Name</FieldLabel>
                      <input
                        className="nx-input w-full"
                        value={periodName}
                        disabled={saving}
                        onChange={(e) => setPeriodName(e.target.value)}
                        placeholder="e.g. Period 1"
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Start Time</FieldLabel>
                      <input
                        type="time"
                        className="nx-input w-full"
                        value={periodStart}
                        disabled={saving}
                        onChange={(e) => setPeriodStart(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>End Time</FieldLabel>
                      <input
                        type="time"
                        className="nx-input w-full"
                        value={periodEnd}
                        disabled={saving}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-[#374151] sm:col-span-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={periodIsBreak}
                        disabled={saving}
                        onChange={(e) => setPeriodIsBreak(e.target.checked)}
                      />
                      Mark as break
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                        disabled={saving}
                      >
                        {editingPeriodId ? "Update Period" : "Save Period"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                        onClick={resetPeriodForm}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Period Name</th>
                        <th className="px-2 py-2">Start Time</th>
                        <th className="px-2 py-2">End Time</th>
                        <th className="px-2 py-2">Duration</th>
                        <th className="px-2 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-6 text-center text-[#6B7280]">
                            {loading ? "Loading…" : "No periods configured."}
                          </td>
                        </tr>
                      ) : (
                        periods.map((item, index) => (
                          <tr
                            key={item.id}
                            className={[
                              "border-b border-[#F3F4F6] last:border-b-0",
                              item.isBreak ? "bg-amber-50" : "hover:bg-[#F9FAFB]",
                            ].join(" ")}
                          >
                            <td className="px-2 py-2.5 text-[#6B7280]">{index + 1}</td>
                            <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{item.name}</td>
                            <td className="px-2 py-2.5 text-[#6B7280]">{item.startTime}</td>
                            <td className="px-2 py-2.5 text-[#6B7280]">{item.endTime}</td>
                            <td className="px-2 py-2.5 text-[#6B7280]">{item.durationMins} mins</td>
                            <td className="px-2 py-2.5">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                  disabled={!canManage || saving}
                                  onClick={() => startEditPeriod(item)}
                                >
                                  <EditOutlined sx={{ fontSize: 18 }} />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                  disabled={!canManage || saving}
                                  onClick={() => void deletePeriod(item)}
                                >
                                  <DeleteOutline sx={{ fontSize: 18 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <InfoBox>Breaks are marked in yellow and will not be considered as teaching periods.</InfoBox>
              </Card>

              <Card title="2. Working Days">
                <div className="space-y-2.5">
                  {WEEKDAY_OPTIONS.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-2.5 text-sm text-[#374151]"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={workingDays.includes(day.value)}
                        disabled={!canManage || saving}
                        onChange={() => toggleWorkingDay(day.value)}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <InfoBox>Timetable will be generated only for selected working days.</InfoBox>
              </Card>

              <Card title="3. Timetable Settings">
                <div className="space-y-3">
                  <label className="block">
                    <FieldLabel>Default Period Duration</FieldLabel>
                    <div className="relative">
                      <input
                        type="number"
                        min={5}
                        className="nx-input w-full pr-12"
                        value={defaultPeriodDuration}
                        disabled={!canManage || saving}
                        onChange={(e) => setDefaultPeriodDuration(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">
                        mins
                      </span>
                    </div>
                  </label>
                  <label className="block">
                    <FieldLabel>First Period Starts At</FieldLabel>
                    <input
                      type="time"
                      className="nx-input w-full"
                      value={firstPeriodStartsAt}
                      disabled={!canManage || saving}
                      onChange={(e) => setFirstPeriodStartsAt(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Last Period Ends At</FieldLabel>
                    <input
                      type="time"
                      className="nx-input w-full"
                      value={lastPeriodEndsAt}
                      disabled={!canManage || saving}
                      onChange={(e) => setLastPeriodEndsAt(e.target.value)}
                    />
                  </label>
                  <div>
                    <FieldLabel>Period Numbering</FieldLabel>
                    <div className="mt-1 space-y-2">
                      {(
                        [
                          { value: "CONTINUOUS", label: "Continuous" },
                          { value: "RESET_AFTER_BREAKS", label: "Reset After Breaks" },
                        ] as const
                      ).map((option) => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 text-sm text-[#374151]"
                        >
                          <input
                            type="radio"
                            name="period-numbering"
                            className="size-4 accent-primary"
                            checked={periodNumberingMode === option.value}
                            disabled={!canManage || saving}
                            onChange={() => setPeriodNumberingMode(option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3">
                    <span className="text-sm text-[#374151]">Allow Period Overlap</span>
                    <Toggle
                      checked={allowPeriodOverlap}
                      disabled={!canManage || saving}
                      onChange={setAllowPeriodOverlap}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#374151]">Enable Double Period</span>
                    <Toggle
                      checked={enableDoublePeriod}
                      disabled={!canManage || saving}
                      onChange={setEnableDoublePeriod}
                    />
                  </div>
                </div>
              </Card>
            </div>

            <Card
              title="Existing Timetable Templates"
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={startAddTemplate}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                  Add Timetable Template
                </button>
              }
            >
              {templateFormOpen ? (
                <form
                  className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2"
                  onSubmit={(e) => void saveTemplate(e)}
                >
                  <label className="block sm:col-span-2">
                    <FieldLabel>Template Name</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={templateName}
                      disabled={saving}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Secondary School Timetable"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <FieldLabel>Applicable Classes</FieldLabel>
                    <div className="mt-1 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-2">
                      {classes.length === 0 ? (
                        <p className="text-sm text-[#6B7280]">No classes available.</p>
                      ) : (
                        classes.map((item) => (
                          <label
                            key={item.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#F3F4F6] px-2 py-1 text-xs text-[#374151]"
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-primary"
                              checked={templateClassIds.includes(item.id)}
                              onChange={() => toggleTemplateClass(item.id)}
                            />
                            {item.name}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Working Days</FieldLabel>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {WEEKDAY_OPTIONS.map((day) => (
                        <label
                          key={day.value}
                          className="inline-flex items-center gap-1.5 text-xs text-[#374151]"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={templateWorkingDays.includes(day.value)}
                            onChange={() => toggleTemplateDay(day.value)}
                          />
                          {SHORT_DAY[day.value]}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={saving}
                    >
                      {editingTemplateId ? "Update Template" : "Save Template"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetTemplateForm}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Template Name</th>
                      <th className="px-2 py-2.5">Applicable Classes</th>
                      <th className="px-2 py-2.5">Working Days</th>
                      <th className="px-2 py-2.5">Periods</th>
                      <th className="px-2 py-2.5">Created On</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading ? "Loading…" : "No timetable templates yet."}
                        </td>
                      </tr>
                    ) : (
                      pagedTemplates.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                        >
                          <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{item.name}</td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {item.classes.map((c) => c.name).join(", ") || "—"}
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {formatWorkingDays(item.workingDays)}
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {item.periodCount} Periods
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {formatCreatedOn(item.createdAt)}
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                item.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              {item.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => startEditTemplate(item)}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => void deleteTemplate(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
                <p>
                  Showing {templateRangeStart} to {templateRangeEnd} of {templates.length}{" "}
                  templates
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                    disabled={currentTemplatePage <= 1}
                    onClick={() => setTemplatePage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
                    {currentTemplatePage}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 hover:bg-[#F6F7F9] disabled:opacity-40"
                    disabled={currentTemplatePage >= totalTemplatePages}
                    onClick={() =>
                      setTemplatePage((p) => Math.min(totalTemplatePages, p + 1))
                    }
                  >
                    ›
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">Quick Guide</h2>
              <div className="space-y-4">
                {guideItems.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-primary p-4 text-white shadow-sm sm:p-5">
              <h3 className="text-sm font-bold">Need Help?</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/85">
                Learn how to set up periods and build class timetables efficiently.
              </p>
              <Link
                to="/timetable"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
              >
                View Guide
                <OpenInNewOutlined sx={{ fontSize: 14 }} />
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
