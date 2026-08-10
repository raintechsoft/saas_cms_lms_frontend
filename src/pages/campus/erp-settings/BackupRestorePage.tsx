import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  CloudUploadOutlined,
  DeleteOutline,
  DownloadOutlined,
  FilterListOutlined,
  InfoOutlined,
  RestoreOutlined,
  SearchOutlined,
  SecurityOutlined,
  StorageOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Backup = {
  id: string;
  name: string;
  type: "FULL" | "DATABASE" | "FILES";
  typeLabel: string;
  sizeLabel: string;
  status: string;
  createdByLabel: string;
  canRestoreConfig: boolean;
  createdAtLabel: string;
  index: number;
};

type Setup = {
  stats: {
    totalBackups: number;
    lastBackupLabel: string;
    lastBackupName: string;
    totalSizeLabel: string;
    retentionDays: number;
    status: string;
    statusHint: string;
  };
  storage: {
    totalLabel: string;
    segments: Array<{ key: string; label: string; percent: number }>;
  };
  locations: {
    primary: string;
    secondary: string;
    localEnabled: boolean;
    localLabel: string;
  };
  settings: {
    retentionDays: number;
    primaryLocation: string;
    secondaryLocation: string;
    localEnabled: boolean;
    compressBackups: boolean;
    encryptBackups: boolean;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
  };
  schedules: Array<{
    id: string;
    name: string;
    frequency: string;
    timeOfDay: string;
    backupType: string;
    backupTypeLabel: string;
    isActive: boolean;
    nextRunLabel: string;
  }>;
  backups: Backup[];
  logs: Array<{
    id: string;
    action: string;
    message: string;
    level: string;
    createdAtLabel: string;
  }>;
};

const PAGE_SIZE = 8;

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: ReactNode;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="truncate text-lg font-bold text-[#1A1A1A]">{value}</p>
        <div className="text-xs text-[#9CA3AF]">{hint}</div>
      </div>
    </div>
  );
}

function typeBadge(type: Backup["type"]) {
  if (type === "FULL") return "bg-violet-50 text-violet-700";
  if (type === "DATABASE") return "bg-sky-50 text-sky-700";
  return "bg-amber-50 text-amber-700";
}

export function BackupRestorePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Backup & Restore";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "erp.backup"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<
    "backups" | "restore" | "schedules" | "settings" | "logs"
  >("backups");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "System Backup Full",
    type: "FULL" as "FULL" | "DATABASE" | "FILES",
  });
  const [settingsForm, setSettingsForm] = useState({
    retentionDays: 30,
    primaryLocation: "",
    secondaryLocation: "",
    localEnabled: true,
    compressBackups: true,
    encryptBackups: true,
    notifyOnSuccess: false,
    notifyOnFailure: true,
  });
  const [scheduleForm, setScheduleForm] = useState({
    id: "",
    name: "",
    frequency: "DAILY" as "DAILY" | "WEEKLY" | "MONTHLY",
    timeOfDay: "02:00",
    backupType: "FULL" as "FULL" | "DATABASE" | "FILES",
    isActive: true,
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/backup-restore", accessToken);
      setSetup(data);
      setSettingsForm({
        retentionDays: data.settings.retentionDays,
        primaryLocation: data.settings.primaryLocation,
        secondaryLocation: data.settings.secondaryLocation,
        localEnabled: data.settings.localEnabled,
        compressBackups: data.settings.compressBackups,
        encryptBackups: data.settings.encryptBackups,
        notifyOnSuccess: data.settings.notifyOnSuccess,
        notifyOnFailure: data.settings.notifyOnFailure,
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load backup & restore");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setup?.backups ?? []).filter((item) => {
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.typeLabel.toLowerCase().includes(q) ||
        item.createdByLabel.toLowerCase().includes(q)
      );
    });
  }, [setup, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  async function createBackup(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/backup-restore/backups", accessToken, {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setSetup(data);
      setCreateOpen(false);
      notifySuccess("Backup created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create backup");
    } finally {
      setSaving(false);
    }
  }

  async function restoreBackup(id: string, name: string) {
    if (!accessToken || !canManage) return;
    if (
      !window.confirm(
        `Restore from "${name}"? Current configuration will be replaced with the selected backup.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>(
        `/erp/backup-restore/backups/${id}/restore`,
        accessToken,
        { method: "POST", body: JSON.stringify({}) },
      );
      setSetup(data);
      notifySuccess("Backup restored");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to restore backup");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBackup(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this backup permanently?")) return;
    try {
      const data = await apiRequest<Setup>(`/erp/backup-restore/backups/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Backup deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete backup");
    }
  }

  async function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/backup-restore/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(settingsForm),
      });
      setSetup(data);
      notifySuccess("Backup settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/backup-restore/schedules", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: scheduleForm.id || undefined,
          name: scheduleForm.name,
          frequency: scheduleForm.frequency,
          timeOfDay: scheduleForm.timeOfDay,
          backupType: scheduleForm.backupType,
          isActive: scheduleForm.isActive,
        }),
      });
      setSetup(data);
      setScheduleForm({
        id: "",
        name: "",
        frequency: "DAILY",
        timeOfDay: "02:00",
        backupType: "FULL",
        isActive: true,
      });
      notifySuccess(scheduleForm.id ? "Schedule updated" : "Schedule created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save schedule");
    } finally {
      setSaving(false);
    }
  }

  async function removeSchedule(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this schedule?")) return;
    try {
      const data = await apiRequest<Setup>(`/erp/backup-restore/schedules/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Schedule deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete schedule");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading backup & restore…</div>;
  }

  const stats = setup.stats;
  const dbPct = setup.storage.segments[0]?.percent ?? 33;
  const filesPct = setup.storage.segments[1]?.percent ?? 50;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Backup & Restore</h1>
          <p className="text-xs text-[#6B7280]">
            Create, manage and restore backups of your ERP system data. Ensure your data is safe and
            can be recovered anytime.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Create Backup
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Backups"
            value={stats.totalBackups}
            hint="All time backups"
            tone="bg-violet-50"
            icon={<StorageOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Last Backup"
            value={stats.lastBackupLabel}
            hint={stats.lastBackupName}
            tone="bg-emerald-50"
            icon={<CheckCircleOutline className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Total Size"
            value={stats.totalSizeLabel}
            hint="Across all backups"
            tone="bg-sky-50"
            icon={<CloudUploadOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Retention Policy"
            value={`${stats.retentionDays} Days`}
            hint={`Auto delete after ${stats.retentionDays} days`}
            tone="bg-amber-50"
            icon={<CalendarMonthOutlined className="!text-[20px] text-amber-600" />}
          />
          <StatCard
            label="Status"
            value={stats.status}
            hint={<span className="text-emerald-600">{stats.statusHint}</span>}
            tone="bg-violet-50"
            icon={<SecurityOutlined className="!text-[20px] text-violet-600" />}
          />
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-3">
            {(
              [
                ["backups", "Backups"],
                ["restore", "Restore"],
                ["schedules", "Scheduled Backups"],
                ["settings", "Backup Settings"],
                ["logs", "Logs"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "backups" ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#1A1A1A]">Backup History</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          className={`${inputClass} w-44 pl-8`}
                          placeholder="Search backups..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <select
                        className={inputClass + " w-36"}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                      >
                        <option value="ALL">All Types</option>
                        <option value="FULL">Full</option>
                        <option value="DATABASE">Database</option>
                        <option value="FILES">Files</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold"
                      >
                        <FilterListOutlined className="!text-[16px]" />
                        Filters
                      </button>
                    </div>
                  </div>

                  {showFilters ? (
                    <div className="mb-3 rounded-lg bg-[#FAFAFA] px-3 py-2 text-xs text-[#6B7280]">
                      Showing {typeFilter === "ALL" ? "all backup types" : typeFilter.toLowerCase()}{" "}
                      matching “{search || "any name"}”.
                    </div>
                  ) : null}

                  <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                        <tr>
                          <th className="px-3 py-2.5 font-semibold">#</th>
                          <th className="px-3 py-2.5 font-semibold">Backup Name</th>
                          <th className="px-3 py-2.5 font-semibold">Type</th>
                          <th className="px-3 py-2.5 font-semibold">Size</th>
                          <th className="px-3 py-2.5 font-semibold">Created On</th>
                          <th className="px-3 py-2.5 font-semibold">Created By</th>
                          <th className="px-3 py-2.5 font-semibold">Status</th>
                          <th className="px-3 py-2.5 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((backup, idx) => (
                          <tr key={backup.id} className="border-b border-[#F3F4F6]">
                            <td className="px-3 py-3 text-[#9CA3AF]">
                              {(currentPage - 1) * PAGE_SIZE + idx + 1}
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-semibold text-[#1A1A1A]">{backup.name}</p>
                              <p className="text-xs text-[#9CA3AF]">{backup.typeLabel}</p>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeBadge(backup.type)}`}
                              >
                                {backup.type === "FULL"
                                  ? "Full"
                                  : backup.type === "DATABASE"
                                    ? "Database"
                                    : "Files"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[#6B7280]">{backup.sizeLabel}</td>
                            <td className="px-3 py-3 text-xs text-[#6B7280]">
                              {backup.createdAtLabel}
                            </td>
                            <td className="px-3 py-3 text-[#6B7280]">{backup.createdByLabel}</td>
                            <td className="px-3 py-3">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                {backup.status === "SUCCESS" ? "Success" : backup.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                                  title="Download metadata"
                                  onClick={() =>
                                    notifySuccess(`Download queued for ${backup.name}`)
                                  }
                                >
                                  <DownloadOutlined className="!text-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  className="rounded p-1 text-primary hover:bg-[#F3F4F6] disabled:opacity-50"
                                  title="Restore"
                                  onClick={() => void restoreBackup(backup.id, backup.name)}
                                >
                                  <RestoreOutlined className="!text-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  className="rounded p-1 text-rose-600 hover:bg-[#F3F4F6] disabled:opacity-50"
                                  title="Delete"
                                  onClick={() => void deleteBackup(backup.id)}
                                >
                                  <DeleteOutline className="!text-[18px]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!paged.length ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-3 py-10 text-center text-sm text-[#9CA3AF]"
                            >
                              No backups found
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                    <span>
                      Showing {pageStart} to {pageEnd} of {filtered.length} entries
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          className={`h-7 w-7 rounded ${
                            currentPage === n
                              ? "bg-primary text-white"
                              : "border border-[#E5E7EB] text-[#374151]"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="text-sm font-bold text-[#1A1A1A]">Storage Overview</h3>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="relative h-28 w-28 shrink-0 rounded-full"
                        style={{
                          background: `conic-gradient(#8B5CF6 0 ${dbPct}%, #0EA5E9 0 ${dbPct + filesPct}%, #F59E0B 0 100%)`,
                        }}
                      >
                        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white text-center">
                          <p className="text-[10px] text-[#9CA3AF]">Total Used</p>
                          <p className="text-xs font-bold text-[#1A1A1A]">
                            {setup.storage.totalLabel}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {setup.storage.segments.map((seg) => (
                          <li key={seg.key} className="flex justify-between gap-3">
                            <span className="text-[#4B5563]">{seg.label}</span>
                            <span className="font-semibold text-[#9CA3AF]">{seg.percent}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="mb-2 text-sm font-bold text-[#1A1A1A]">Backup Location</h3>
                    <ul className="space-y-2 text-sm text-[#374151]">
                      <li className="flex items-start gap-2">
                        <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-600" />
                        <span>
                          <span className="font-semibold">Primary Location:</span>{" "}
                          {setup.locations.primary}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-600" />
                        <span>
                          <span className="font-semibold">Secondary Location:</span>{" "}
                          {setup.locations.secondary}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-600" />
                        <span>
                          <span className="font-semibold">Local Backup:</span>{" "}
                          {setup.locations.localEnabled
                            ? setup.locations.localLabel
                            : "Disabled"}
                        </span>
                      </li>
                    </ul>
                  </section>

                  <section className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <h3 className="mb-3 text-sm font-bold text-[#1A1A1A]">Quick Actions</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[#6B7280]">Create Backup Now</span>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => setCreateOpen(true)}
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Create Now
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[#6B7280]">Upload Backup</span>
                        <button
                          type="button"
                          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold"
                          onClick={() => notifySuccess("Upload picker coming soon")}
                        >
                          Upload
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[#6B7280]">Download Logs</span>
                        <button
                          type="button"
                          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold"
                          onClick={() => {
                            setTab("logs");
                            notifySuccess("Opened logs");
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : null}

            {tab === "restore" ? (
              <div className="space-y-3">
                <p className="text-sm text-[#6B7280]">
                  Select a Full or Database backup that includes a configuration snapshot to restore
                  tenant settings.
                </p>
                <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                      <tr>
                        <th className="px-3 py-2">Backup</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setup.backups
                        .filter((b) => b.type !== "FILES")
                        .slice(0, 10)
                        .map((backup) => (
                          <tr key={backup.id} className="border-t border-[#F3F4F6]">
                            <td className="px-3 py-2 font-semibold">{backup.name}</td>
                            <td className="px-3 py-2">{backup.typeLabel}</td>
                            <td className="px-3 py-2 text-xs text-[#6B7280]">
                              {backup.createdAtLabel}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() => void restoreBackup(backup.id, backup.name)}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Restore
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tab === "schedules" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <form
                  onSubmit={(e) => void saveSchedule(e)}
                  className="space-y-3 rounded-lg border border-[#E5E7EB] p-4"
                >
                  <h3 className="text-sm font-bold">
                    {scheduleForm.id ? "Edit Schedule" : "Add Schedule"}
                  </h3>
                  <input
                    className={inputClass}
                    required
                    placeholder="Schedule name"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      className={inputClass}
                      value={scheduleForm.frequency}
                      onChange={(e) =>
                        setScheduleForm((p) => ({
                          ...p,
                          frequency: e.target.value as "DAILY" | "WEEKLY" | "MONTHLY",
                        }))
                      }
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                    <input
                      className={inputClass}
                      type="time"
                      value={scheduleForm.timeOfDay}
                      onChange={(e) =>
                        setScheduleForm((p) => ({ ...p, timeOfDay: e.target.value }))
                      }
                    />
                    <select
                      className={inputClass}
                      value={scheduleForm.backupType}
                      onChange={(e) =>
                        setScheduleForm((p) => ({
                          ...p,
                          backupType: e.target.value as "FULL" | "DATABASE" | "FILES",
                        }))
                      }
                    >
                      <option value="FULL">Full</option>
                      <option value="DATABASE">Database</option>
                      <option value="FILES">Files</option>
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={scheduleForm.isActive}
                      onChange={(e) =>
                        setScheduleForm((p) => ({ ...p, isActive: e.target.checked }))
                      }
                    />
                    Active
                  </label>
                  <button
                    type="submit"
                    disabled={!canManage || saving}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Save Schedule
                  </button>
                </form>
                <div className="space-y-2">
                  {setup.schedules.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[#E5E7EB] p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{item.name}</p>
                        <p className="text-xs text-[#6B7280]">
                          {item.frequency} · {item.timeOfDay} · {item.backupTypeLabel}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">Next: {item.nextRunLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary"
                          onClick={() =>
                            setScheduleForm({
                              id: item.id,
                              name: item.name,
                              frequency: item.frequency as "DAILY" | "WEEKLY" | "MONTHLY",
                              timeOfDay: item.timeOfDay,
                              backupType: item.backupType as "FULL" | "DATABASE" | "FILES",
                              isActive: item.isActive,
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600"
                          onClick={() => void removeSchedule(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "settings" ? (
              <form onSubmit={(e) => void saveSettings(e)} className="max-w-2xl space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Retention (days)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className={inputClass}
                    value={settingsForm.retentionDays}
                    onChange={(e) =>
                      setSettingsForm((p) => ({
                        ...p,
                        retentionDays: Number(e.target.value) || 30,
                      }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Primary Location
                  </span>
                  <input
                    className={inputClass}
                    value={settingsForm.primaryLocation}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, primaryLocation: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Secondary Location
                  </span>
                  <input
                    className={inputClass}
                    value={settingsForm.secondaryLocation}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, secondaryLocation: e.target.value }))
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(
                    [
                      ["localEnabled", "Local server storage"],
                      ["compressBackups", "Compress backups"],
                      ["encryptBackups", "Encrypt backups"],
                      ["notifyOnSuccess", "Notify on success"],
                      ["notifyOnFailure", "Notify on failure"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settingsForm[key]}
                        onChange={(e) =>
                          setSettingsForm((p) => ({ ...p, [key]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save Settings
                </button>
              </form>
            ) : null}

            {tab === "logs" ? (
              <ul className="space-y-2">
                {setup.logs.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#1A1A1A]">{log.action}</span>
                      <span className="text-xs text-[#9CA3AF]">{log.createdAtLabel}</span>
                    </div>
                    <p className="text-[#6B7280]">{log.message}</p>
                  </li>
                ))}
                {!setup.logs.length ? (
                  <li className="py-8 text-center text-sm text-[#9CA3AF]">No logs yet</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <InfoOutlined className="!text-[18px]" />
            About Backup & Restore
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sky-800">
            <li>
              Regular backups help you recover data after accidental deletion, corruption, or system
              failure.
            </li>
            <li>Create manual backups or set up automatic scheduled backups.</li>
            <li>Backups are tracked across primary, secondary, and local locations.</li>
            <li>
              Use restore carefully — current configuration will be replaced with the selected
              backup.
            </li>
          </ul>
        </div>
      </div>

      {createOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={(e) => void createBackup(e)}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-base font-bold text-[#1A1A1A]">Create Backup</h2>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Backup Name</span>
              <input
                className={inputClass}
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Type</span>
              <select
                className={inputClass}
                value={createForm.type}
                onChange={(e) =>
                  setCreateForm((p) => ({
                    ...p,
                    type: e.target.value as "FULL" | "DATABASE" | "FILES",
                  }))
                }
              >
                <option value="FULL">Full Backup</option>
                <option value="DATABASE">Database</option>
                <option value="FILES">Files</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Backup"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
