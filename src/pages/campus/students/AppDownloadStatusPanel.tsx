import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DownloadOutlined,
  NotificationsActiveOutlined,
  PhoneAndroidOutlined,
  RefreshOutlined,
  ScheduleOutlined,
  SendOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { Setup } from "./types";

type LoginStatus = "ACTIVE" | "INACTIVE" | "NO_ACCOUNT";
type StatusFilter = "ALL" | LoginStatus;

type StatusRow = {
  studentId: string;
  admissionNumber: string;
  name: string;
  mobile: string | null;
  email: string | null;
  classLabel: string | null;
  session: string | null;
  loginStatus: LoginStatus;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  lastLoginChannel: string | null;
  hasPortalAccount: boolean;
  userId: string | null;
};

type StatusResponse = {
  summary: { total: number; active: number; inactive: number; noAccount: number };
  items: StatusRow[];
};

type ReminderSettings = {
  enabled: boolean;
  sendSms: boolean;
  sendEmail: boolean;
  intervalDays: number;
};

function statusPill(status: LoginStatus) {
  if (status === "ACTIVE") return "nx-pill nx-pill-success";
  if (status === "INACTIVE") return "nx-pill nx-pill-warning";
  return "nx-pill nx-pill-neutral";
}

function statusLabel(status: LoginStatus) {
  if (status === "ACTIVE") return "Logged in";
  if (status === "INACTIVE") return "Not logged in";
  return "No portal account";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function exportCsv(items: StatusRow[]) {
  const header = [
    "admissionNumber",
    "name",
    "class",
    "mobile",
    "email",
    "loginStatus",
    "firstLoginAt",
    "lastLoginAt",
    "channel",
  ];
  const rows = items.map((row) =>
    [
      row.admissionNumber,
      row.name,
      row.classLabel ?? "",
      row.mobile ?? "",
      row.email ?? "",
      row.loginStatus,
      row.firstLoginAt ?? "",
      row.lastLoginAt ?? "",
      row.lastLoginChannel ?? "",
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `app-download-status-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AppDownloadStatusPanel({
  setup,
  token,
}: {
  setup: Setup;
  token: string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [classSectionId, setClassSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<StatusResponse>({
    summary: { total: 0, active: 0, inactive: 0, noAccount: 0 },
    items: [],
  });
  const [settings, setSettings] = useState<ReminderSettings>({
    enabled: false,
    sendSms: true,
    sendEmail: true,
    intervalDays: 7,
  });

  const classOptions = useMemo(
    () =>
      [...setup.classSections].sort((a, b) =>
        `${a.academicClass.name}-${a.section.name}`.localeCompare(
          `${b.academicClass.name}-${b.section.name}`,
        ),
      ),
    [setup.classSections],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (classSectionId) params.set("classSectionId", classSectionId);
      if (search.trim()) params.set("search", search.trim());

      const [statusData, reminder] = await Promise.all([
        apiRequest<StatusResponse>(`/students/app-download-status?${params}`, token),
        apiRequest<ReminderSettings>("/students/app-download-status/reminder-settings", token),
      ]);
      setData(statusData ?? { summary: { total: 0, active: 0, inactive: 0, noAccount: 0 }, items: [] });
      if (reminder) setSettings(reminder);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to load app download status");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, classSectionId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await apiRequest<ReminderSettings>(
        "/students/app-download-status/reminder-settings",
        token,
        { method: "PUT", body: JSON.stringify(settings) },
      );
      if (saved) setSettings(saved);
      notifySuccess("SMS / email reminder schedule saved");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to save reminder schedule");
    } finally {
      setBusy(false);
    }
  }

  async function sendReminders(studentId?: string) {
    setBusy(true);
    try {
      const result = await apiRequest<{ count: number; emailSent: number; smsSent: number }>(
        "/students/app-download-status/remind",
        token,
        {
          method: "POST",
          body: JSON.stringify(studentId ? { studentId } : {}),
        },
      );
      notifySuccess(
        studentId
          ? `Alert sent (email: ${result?.emailSent ?? 0}, SMS: ${result?.smsSent ?? 0})`
          : `Reminders queued for ${result?.count ?? 0} inactive student(s)`,
      );
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Failed to send reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total students", value: data.summary.total, tone: "text-slate-800" },
          { label: "Logged in (active)", value: data.summary.active, tone: "text-emerald-700" },
          { label: "Not logged in", value: data.summary.inactive, tone: "text-amber-700" },
          { label: "No portal account", value: data.summary.noAccount, tone: "text-slate-500" },
        ].map((card) => (
          <div key={card.label} className="nx-card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <form className="nx-card p-4" onSubmit={saveSchedule}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ScheduleOutlined className="!text-[18px] text-sky-600" />
              Inactive student reminder schedule
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Automatically remind students who have a portal account but have never logged in via
              web or app.
            </p>
          </div>
          <button type="submit" className="nx-btn-primary" disabled={busy}>
            Save schedule
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Enable schedule
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.sendSms}
              onChange={(e) => setSettings({ ...settings, sendSms: e.target.checked })}
            />
            Send SMS
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.sendEmail}
              onChange={(e) => setSettings({ ...settings, sendEmail: e.target.checked })}
            />
            Send Email
          </label>
          <label className="text-sm text-slate-700">
            Interval (days)
            <input
              type="number"
              min={1}
              max={90}
              className="nx-input mt-1 w-full"
              value={settings.intervalDays}
              onChange={(e) =>
                setSettings({ ...settings, intervalDays: Number(e.target.value) || 7 })
              }
            />
          </label>
        </div>
      </form>

      <div className="nx-card overflow-hidden">
        <form
          className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 lg:flex-row lg:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <input
            className="nx-input min-w-0 flex-1"
            placeholder="Search by name, admission no, email, mobile..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="nx-input lg:w-48"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Logged in</option>
            <option value="INACTIVE">Not logged in</option>
            <option value="NO_ACCOUNT">No portal account</option>
          </select>
          <select
            className="nx-input lg:w-56"
            value={classSectionId}
            onChange={(e) => setClassSectionId(e.target.value)}
          >
            <option value="">All classes</option>
            {classOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.academicClass.name} - {item.section.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="nx-btn-secondary">
              Filter
            </button>
            <button
              type="button"
              className="nx-btn-secondary"
              disabled={loading || busy}
              onClick={() => void load()}
            >
              <RefreshOutlined className="!text-[16px]" /> Refresh
            </button>
            <button
              type="button"
              className="nx-btn-secondary"
              disabled={!data.items.length}
              onClick={() => exportCsv(data.items)}
            >
              <DownloadOutlined className="!text-[16px]" /> Download report
            </button>
            <button
              type="button"
              className="nx-btn-primary"
              disabled={busy || data.summary.inactive === 0}
              onClick={() => void sendReminders()}
            >
              <SendOutlined className="!text-[16px]" /> Alert all inactive
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th>Admission</th>
                <th>Student</th>
                <th>Class</th>
                <th>Contact</th>
                <th>Status</th>
                <th>First login</th>
                <th>Last login</th>
                <th>Channel</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    Loading portal login status...
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => (
                  <tr key={row.studentId}>
                    <td className="font-medium text-slate-800">{row.admissionNumber}</td>
                    <td>{row.name}</td>
                    <td>{row.classLabel ?? "—"}</td>
                    <td className="text-xs text-slate-600">
                      <div>{row.mobile ?? "—"}</div>
                      <div>{row.email ?? "—"}</div>
                    </td>
                    <td>
                      <span className={statusPill(row.loginStatus)}>
                        {statusLabel(row.loginStatus)}
                      </span>
                    </td>
                    <td className="text-xs">{formatDate(row.firstLoginAt)}</td>
                    <td className="text-xs">{formatDate(row.lastLoginAt)}</td>
                    <td>
                      {row.lastLoginChannel ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                          <PhoneAndroidOutlined className="!text-[14px]" />
                          {row.lastLoginChannel}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.loginStatus === "INACTIVE" ? (
                        <button
                          type="button"
                          className="nx-btn-secondary !px-2 !py-1 text-xs"
                          disabled={busy}
                          onClick={() => void sendReminders(row.studentId)}
                          title="Send individual alert"
                        >
                          <NotificationsActiveOutlined className="!text-[15px]" /> Alert
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
