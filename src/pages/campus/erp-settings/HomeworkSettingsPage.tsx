import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  LightbulbOutlined,
  MenuBookOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type LatePenaltyType = "PERCENT_MARKS" | "FIXED_MARKS";
type SubmissionStart = "ASSIGNMENT_DATETIME" | "NEXT_DAY";
type DueDateBehavior = "BLOCK" | "ALLOW_WITH_PENALTY" | "ALLOW";
type ReminderUnit = "DAYS" | "DAY_BEFORE" | "HOURS";
type AutoReminder = "NONE" | "EMAIL_SMS" | "EMAIL" | "SMS";

type HomeworkSettings = {
  moduleEnabled: boolean;
  allowTeachersAssign: boolean;
  allowAttachments: boolean;
  allowOnlineSubmission: boolean;
  allowLateSubmission: boolean;
  latePenaltyValue: number;
  latePenaltyType: LatePenaltyType;
  allowPortalView: boolean;
  submissionStartsFrom: SubmissionStart;
  dueDateBehavior: DueDateBehavior;
  graceDays: number;
  reminderBeforeValue: number;
  reminderBeforeUnit: ReminderUnit;
  autoReminderMode: AutoReminder;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
};

type HomeworkType = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

type WorkflowStatus = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isFinal: boolean;
  isActive: boolean;
  sortOrder: number;
};

type Setup = {
  settings: HomeworkSettings;
  types: HomeworkType[];
  statuses: WorkflowStatus[];
};

const DEFAULT_SETTINGS: HomeworkSettings = {
  moduleEnabled: true,
  allowTeachersAssign: true,
  allowAttachments: true,
  allowOnlineSubmission: true,
  allowLateSubmission: true,
  latePenaltyValue: 10,
  latePenaltyType: "PERCENT_MARKS",
  allowPortalView: true,
  submissionStartsFrom: "ASSIGNMENT_DATETIME",
  dueDateBehavior: "BLOCK",
  graceDays: 1,
  reminderBeforeValue: 1,
  reminderBeforeUnit: "DAY_BEFORE",
  autoReminderMode: "EMAIL_SMS",
  maxFileSizeMb: 10,
  allowedFileTypes: ["PDF", "DOC", "DOCX", "JPG", "PNG"],
};

function Card({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 ${className}`}>
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

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  info,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  info?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1 text-sm font-semibold text-[#1A1A1A]">
          {label}
          {info ? <InfoOutlined sx={{ fontSize: 14 }} className="text-[#9CA3AF]" /> : null}
        </p>
        {description ? <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-primary" : "bg-[#D1D5DB]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function HomeworkSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Homework Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["homework.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [settings, setSettings] = useState<HomeworkSettings>(DEFAULT_SETTINGS);
  const [types, setTypes] = useState<HomeworkType[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileTypeDraft, setFileTypeDraft] = useState("");

  const [typeFormOpen, setTypeFormOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [typeActive, setTypeActive] = useState(true);

  const [statusFormOpen, setStatusFormOpen] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [statusName, setStatusName] = useState("");
  const [statusDescription, setStatusDescription] = useState("");
  const [statusColor, setStatusColor] = useState("#6366F1");
  const [statusFinal, setStatusFinal] = useState(false);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/homework-settings", accessToken);
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setTypes(data.types ?? []);
      setStatuses(data.statuses ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load homework settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function patchSettings<K extends keyof HomeworkSettings>(key: K, value: HomeworkSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/homework-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setTypes(data.types ?? []);
      setStatuses(data.statuses ?? []);
      notifySuccess("Homework settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save homework settings");
    } finally {
      setSaving(false);
    }
  }

  function resetTypeForm() {
    setTypeFormOpen(false);
    setEditingTypeId(null);
    setTypeName("");
    setTypeDescription("");
    setTypeActive(true);
  }

  function startEditType(item: HomeworkType) {
    setTypeFormOpen(true);
    setEditingTypeId(item.id);
    setTypeName(item.name);
    setTypeDescription(item.description ?? "");
    setTypeActive(item.isActive);
  }

  async function saveType(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = typeName.trim();
    if (!name) {
      notifyError("Type name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        description: typeDescription.trim() || null,
        isActive: typeActive,
      };
      if (editingTypeId) {
        await apiRequest(`/erp/homework-types/${editingTypeId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Homework type updated");
      } else {
        await apiRequest("/erp/homework-types", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Homework type added");
      }
      resetTypeForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save homework type");
    } finally {
      setSaving(false);
    }
  }

  async function deleteType(item: HomeworkType) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete homework type "${item.name}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/homework-types/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Homework type deleted");
      if (editingTypeId === item.id) resetTypeForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete homework type");
    } finally {
      setSaving(false);
    }
  }

  function resetStatusForm() {
    setStatusFormOpen(false);
    setEditingStatusId(null);
    setStatusName("");
    setStatusDescription("");
    setStatusColor("#6366F1");
    setStatusFinal(false);
  }

  function startEditStatus(item: WorkflowStatus) {
    setStatusFormOpen(true);
    setEditingStatusId(item.id);
    setStatusName(item.name);
    setStatusDescription(item.description ?? "");
    setStatusColor(item.color);
    setStatusFinal(item.isFinal);
  }

  async function saveStatus(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = statusName.trim();
    if (!name) {
      notifyError("Status name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        description: statusDescription.trim() || null,
        color: statusColor,
        isFinal: statusFinal,
      };
      if (editingStatusId) {
        await apiRequest(`/erp/homework-workflow-statuses/${editingStatusId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Status updated");
      } else {
        await apiRequest("/erp/homework-workflow-statuses", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Status added");
      }
      resetStatusForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save status");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStatus(item: WorkflowStatus) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete status "${item.name}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/homework-workflow-statuses/${item.id}`, accessToken, {
        method: "DELETE",
      });
      notifySuccess("Status deleted");
      if (editingStatusId === item.id) resetStatusForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete status");
    } finally {
      setSaving(false);
    }
  }

  function addFileType() {
    const next = fileTypeDraft.trim().toUpperCase();
    if (!next) return;
    if (settings.allowedFileTypes.includes(next)) {
      setFileTypeDraft("");
      return;
    }
    patchSettings("allowedFileTypes", [...settings.allowedFileTypes, next]);
    setFileTypeDraft("");
  }

  return (
    <form className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]" onSubmit={saveSettings}>
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Homework Settings</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure homework policy, submission rules and related preferences.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card
                title="General Settings"
                hint="Configure general homework rules and preferences."
              >
                <ToggleRow
                  label="Enable Homework Module"
                  description="Enable/disable homework feature for all classes."
                  checked={settings.moduleEnabled}
                  disabled={!canManage || saving}
                  onChange={() => patchSettings("moduleEnabled", !settings.moduleEnabled)}
                />
                <ToggleRow
                  label="Allow Teachers to Assign Homework"
                  description="Teachers can create and assign homework."
                  checked={settings.allowTeachersAssign}
                  disabled={!canManage || saving || !settings.moduleEnabled}
                  onChange={() =>
                    patchSettings("allowTeachersAssign", !settings.allowTeachersAssign)
                  }
                  info
                />
                <ToggleRow
                  label="Allow Attachments"
                  description="Teachers can attach files to homework."
                  checked={settings.allowAttachments}
                  disabled={!canManage || saving || !settings.moduleEnabled}
                  onChange={() => patchSettings("allowAttachments", !settings.allowAttachments)}
                />
                <ToggleRow
                  label="Allow Online Submission"
                  description="Students can submit homework online."
                  checked={settings.allowOnlineSubmission}
                  disabled={!canManage || saving || !settings.moduleEnabled}
                  onChange={() =>
                    patchSettings("allowOnlineSubmission", !settings.allowOnlineSubmission)
                  }
                />
                <ToggleRow
                  label="Allow Late Submission"
                  description="Students can submit after the due date."
                  checked={settings.allowLateSubmission}
                  disabled={!canManage || saving || !settings.moduleEnabled}
                  onChange={() =>
                    patchSettings("allowLateSubmission", !settings.allowLateSubmission)
                  }
                />

                {settings.allowLateSubmission ? (
                  <div className="mt-3">
                    <FieldLabel>Late Submission Penalty (Optional)</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                        value={settings.latePenaltyValue}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          patchSettings("latePenaltyValue", Number(e.target.value) || 0)
                        }
                      />
                      <select
                        className="min-w-[180px] flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                        value={settings.latePenaltyType}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          patchSettings("latePenaltyType", e.target.value as LatePenaltyType)
                        }
                      >
                        <option value="PERCENT_MARKS">% Marks Deduction</option>
                        <option value="FIXED_MARKS">Fixed Marks Deduction</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                <ToggleRow
                  label="Allow Parent/Student View"
                  description="Show homework on student and parent portals."
                  checked={settings.allowPortalView}
                  disabled={!canManage || saving || !settings.moduleEnabled}
                  onChange={() => patchSettings("allowPortalView", !settings.allowPortalView)}
                />

                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  These settings will be applicable across all classes and sections.
                </div>
              </Card>

              <Card title="Submission Settings" hint="Set submission rules and constraints.">
                <label className="mb-3 block">
                  <FieldLabel>Submission Starts From</FieldLabel>
                  <select
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    value={settings.submissionStartsFrom}
                    disabled={!canManage || saving}
                    onChange={(e) =>
                      patchSettings("submissionStartsFrom", e.target.value as SubmissionStart)
                    }
                  >
                    <option value="ASSIGNMENT_DATETIME">Assignment Date & Time</option>
                    <option value="NEXT_DAY">Next Day</option>
                  </select>
                </label>
                <label className="mb-3 block">
                  <FieldLabel>Due Date Behavior</FieldLabel>
                  <select
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    value={settings.dueDateBehavior}
                    disabled={!canManage || saving}
                    onChange={(e) =>
                      patchSettings("dueDateBehavior", e.target.value as DueDateBehavior)
                    }
                  >
                    <option value="BLOCK">Block Submission After Due Date</option>
                    <option value="ALLOW_WITH_PENALTY">Allow With Penalty</option>
                    <option value="ALLOW">Allow Without Penalty</option>
                  </select>
                </label>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Grace Time After Due Date</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                        value={settings.graceDays}
                        disabled={!canManage || saving}
                        onChange={(e) => patchSettings("graceDays", Number(e.target.value) || 0)}
                      />
                      <span className="shrink-0 text-xs text-[#6B7280]">Days</span>
                    </div>
                  </label>
                  <label className="block">
                    <FieldLabel>Reminder Before Due Date</FieldLabel>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                        value={settings.reminderBeforeValue}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          patchSettings("reminderBeforeValue", Number(e.target.value) || 0)
                        }
                      />
                      <select
                        className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-2 py-2 text-sm"
                        value={settings.reminderBeforeUnit}
                        disabled={!canManage || saving}
                        onChange={(e) =>
                          patchSettings("reminderBeforeUnit", e.target.value as ReminderUnit)
                        }
                      >
                        <option value="DAY_BEFORE">Day Before</option>
                        <option value="DAYS">Days Before</option>
                        <option value="HOURS">Hours Before</option>
                      </select>
                    </div>
                  </label>
                </div>
                <label className="mb-3 block">
                  <FieldLabel>Auto Reminders</FieldLabel>
                  <select
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    value={settings.autoReminderMode}
                    disabled={!canManage || saving}
                    onChange={(e) =>
                      patchSettings("autoReminderMode", e.target.value as AutoReminder)
                    }
                  >
                    <option value="EMAIL_SMS">Yes, Send Email / SMS</option>
                    <option value="EMAIL">Email Only</option>
                    <option value="SMS">SMS Only</option>
                    <option value="NONE">No Reminders</option>
                  </select>
                </label>
                <label className="mb-3 block">
                  <FieldLabel>Max File Size Allowed</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      className="w-24 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      value={settings.maxFileSizeMb}
                      disabled={!canManage || saving}
                      onChange={(e) =>
                        patchSettings("maxFileSizeMb", Number(e.target.value) || 1)
                      }
                    />
                    <span className="text-xs text-[#6B7280]">MB</span>
                  </div>
                </label>
                <div>
                  <FieldLabel>Allowed File Types</FieldLabel>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {settings.allowedFileTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                      >
                        {type}
                        <button
                          type="button"
                          className="text-primary/70 hover:text-primary"
                          disabled={!canManage}
                          onClick={() =>
                            patchSettings(
                              "allowedFileTypes",
                              settings.allowedFileTypes.filter((item) => item !== type),
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={fileTypeDraft}
                      onChange={(e) => setFileTypeDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addFileType();
                        }
                      }}
                      placeholder="Add type (e.g. PDF)"
                      className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      disabled={!canManage || saving}
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
                      disabled={!canManage || saving}
                      onClick={addFileType}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </Card>
            </div>

            <Card
              title="Homework Types"
              hint="Manage types/categories of homework."
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={() => {
                    resetTypeForm();
                    setTypeFormOpen(true);
                  }}
                >
                  <AddOutlined sx={{ fontSize: 14 }} />
                  Add Homework Type
                </button>
              }
            >
              {typeFormOpen ? (
                <div className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 md:grid-cols-3">
                  <label className="block md:col-span-1">
                    <FieldLabel required>Type Name</FieldLabel>
                    <input
                      value={typeName}
                      onChange={(e) => setTypeName(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="block md:col-span-1">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      value={typeDescription}
                      onChange={(e) => setTypeDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      disabled={!canManage}
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-[#374151]">
                      <input
                        type="checkbox"
                        checked={typeActive}
                        onChange={(e) => setTypeActive(e.target.checked)}
                        disabled={!canManage}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={!canManage || saving}
                      onClick={() => void saveType()}
                    >
                      {editingTypeId ? "Update" : "Add"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetTypeForm}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Type Name</th>
                      <th className="px-2 py-2 font-semibold">Description</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-2 py-6 text-center text-[#9CA3AF]">
                          No homework types yet.
                        </td>
                      </tr>
                    ) : (
                      types.map((item, index) => (
                        <tr key={item.id} className="border-b border-[#F3F4F6]">
                          <td className="px-2 py-2.5 text-[#6B7280]">{index + 1}</td>
                          <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{item.name}</td>
                          <td className="px-2 py-2.5 text-[#6B7280]">
                            {item.description || "—"}
                          </td>
                          <td className="px-2 py-2.5">
                            {item.isActive ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="rounded-md p-1 text-primary hover:bg-primary/10"
                                disabled={!canManage}
                                onClick={() => startEditType(item)}
                              >
                                <EditOutlined sx={{ fontSize: 16 }} />
                              </button>
                              <button
                                type="button"
                                className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                                disabled={!canManage}
                                onClick={() => void deleteType(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                These types will be available while assigning homework.
              </div>
            </Card>

            <Card
              title="Homework Status Workflow"
              hint="Define and manage homework status workflow."
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={() => {
                    resetStatusForm();
                    setStatusFormOpen(true);
                  }}
                >
                  <AddOutlined sx={{ fontSize: 14 }} />
                  Add Status
                </button>
              }
            >
              {statusFormOpen ? (
                <div className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 md:grid-cols-4">
                  <label className="block">
                    <FieldLabel required>Status Name</FieldLabel>
                    <input
                      value={statusName}
                      onChange={(e) => setStatusName(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Description</FieldLabel>
                    <input
                      value={statusDescription}
                      onChange={(e) => setStatusDescription(e.target.value)}
                      className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      disabled={!canManage}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Color</FieldLabel>
                    <input
                      type="color"
                      value={statusColor}
                      onChange={(e) => setStatusColor(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-1"
                      disabled={!canManage}
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-[#374151]">
                      <input
                        type="checkbox"
                        checked={statusFinal}
                        onChange={(e) => setStatusFinal(e.target.checked)}
                        disabled={!canManage}
                      />
                      Final
                    </label>
                    <button
                      type="button"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={!canManage || saving}
                      onClick={() => void saveStatus()}
                    >
                      {editingStatusId ? "Update" : "Add"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetStatusForm}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Status Name</th>
                      <th className="px-2 py-2 font-semibold">Description</th>
                      <th className="px-2 py-2 font-semibold">Color</th>
                      <th className="px-2 py-2 font-semibold">Is Final Status</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statuses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-6 text-center text-[#9CA3AF]">
                          No workflow statuses yet.
                        </td>
                      </tr>
                    ) : (
                      statuses.map((item, index) => (
                        <tr key={item.id} className="border-b border-[#F3F4F6]">
                          <td className="px-2 py-2.5 text-[#6B7280]">{index + 1}</td>
                          <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{item.name}</td>
                          <td className="px-2 py-2.5 text-[#6B7280]">
                            {item.description || "—"}
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#374151]">
                              <span
                                className="inline-block size-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              {item.color}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-[#374151]">
                            {item.isFinal ? "Yes" : "No"}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="rounded-md p-1 text-primary hover:bg-primary/10"
                                disabled={!canManage}
                                onClick={() => startEditStatus(item)}
                              >
                                <EditOutlined sx={{ fontSize: 16 }} />
                              </button>
                              <button
                                type="button"
                                className="rounded-md p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || item.isFinal}
                                onClick={() => void deleteStatus(item)}
                                title={item.isFinal ? "Final status cannot be deleted" : "Delete"}
                              >
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                Final status cannot be changed once marked.
              </div>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MenuBookOutlined sx={{ fontSize: 18 }} />
                </span>
                <h3 className="text-sm font-bold text-[#1A1A1A]">Quick Guide</h3>
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-xs text-[#4B5563]">
                <li>Enable the homework module for your campus.</li>
                <li>Define submission start, due-date and reminder rules.</li>
                <li>Create homework types used while assigning work.</li>
                <li>Configure the status workflow teachers will follow.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-950">
                <LightbulbOutlined sx={{ fontSize: 18 }} className="text-amber-600" />
                Note
              </div>
              <p className="text-xs text-amber-950/80">
                Changes saved here will apply to all classes. Teachers will follow these rules while
                assigning homework.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </form>
  );
}
