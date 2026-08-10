import { useEffect, useState, type ReactNode } from "react";
import {
  AccessTimeOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  HelpOutlineOutlined,
  HistoryOutlined,
  InfoOutlined,
  ListAltOutlined,
  LockOutlined,
  NotificationsOutlined,
  OpenInNewOutlined,
  SaveOutlined,
  SecurityOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Policy = {
  sessionTimeoutMinutes: number;
  warningBeforeLogoutMinutes: number;
  forceLogoutOtherDevices: boolean;
  rememberMeEnabled: boolean;
  autoLogoutOnBrowserClose: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  lockAccountAfterMaxAttempts: boolean;
  notifyAdminOnLock: boolean;
  captchaOnLogin: boolean;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  passwordExpiryDays: number;
  preventPasswordReuseLast: number;
  allowedIpAddresses: string;
  blockedIpAddresses: string;
  restrictToAllowedIps: boolean;
};

type Setup = {
  policy: Policy;
  activeSessions: Array<{
    id: string;
    userName: string;
    userEmail: string | null;
    roleLabel: string;
    deviceLabel: string;
    ipAddress: string;
    location: string;
    lastActiveLabel: string;
    isCurrent: boolean;
  }>;
  loginActivity: Array<{
    id: string;
    userName: string;
    status: "SUCCESS" | "FAILED";
    statusLabel: string;
    ipAddress: string;
    location: string;
    deviceLabel: string;
    timeLabel: string;
  }>;
  bestPractices: string[];
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

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
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-[#D1D5DB]"
      } disabled:opacity-50`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-[#F3F4F6] py-3 first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        <p className="text-xs text-[#9CA3AF]">{description}</p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#6B7280]">
        {icon}
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[#9CA3AF]">{hint}</span> : null}
    </label>
  );
}

export function SessionLoginPolicyPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Session & Login Policy";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function applySetup(data: Setup) {
    setSetup(data);
    setForm({ ...data.policy });
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/session-login-policy", accessToken);
      applySetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load session policy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function patch<K extends keyof Policy>(key: K, value: Policy[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!accessToken || !canManage || !form) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/session-login-policy", accessToken, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      applySetup(data);
      notifySuccess("Session & login policy saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save policy");
    } finally {
      setSaving(false);
    }
  }

  async function terminateSession(id: string) {
    if (!accessToken || !canManage) return;
    try {
      const data = await apiRequest<Setup>(
        `/erp/session-login-policy/sessions/${id}`,
        accessToken,
        { method: "DELETE" },
      );
      applySetup(data);
      notifySuccess("Session terminated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to terminate session");
    }
  }

  async function terminateOthers() {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Terminate all other active sessions?")) return;
    try {
      const data = await apiRequest<Setup>(
        "/erp/session-login-policy/sessions/terminate-others",
        accessToken,
        { method: "POST" },
      );
      applySetup(data);
      notifySuccess("Other sessions terminated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to terminate sessions");
    }
  }

  if (loading || !setup || !form) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading session & login policy…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Data &amp; Security <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Session &amp; Login Policy</h1>
          <p className="text-xs text-[#6B7280]">
            Configure session management and login rules to secure user access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              notifySuccess("Set timeouts, lockout rules, and password strength, then save")
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
          </button>
          <button
            type="button"
            onClick={() => notifySuccess("Recent login activity is listed below")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <ListAltOutlined className="!text-[18px]" />
            Audit Log
          </button>
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">1. Session Management</h2>
            <div className="space-y-3">
              <Field
                label="Session Timeout (Minutes)"
                hint="Time after which user will be logged out due to inactivity."
                icon={<AccessTimeOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.sessionTimeoutMinutes}
                  disabled={!canManage}
                  onChange={(e) => patch("sessionTimeoutMinutes", Number(e.target.value) || 1)}
                />
              </Field>
              <Field
                label="Warning Before Logout (Minutes)"
                hint="User will be warned before session expires."
                icon={<NotificationsOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.warningBeforeLogoutMinutes}
                  disabled={!canManage}
                  onChange={(e) =>
                    patch("warningBeforeLogoutMinutes", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <div className="pt-1">
                <ToggleRow
                  label="Force logout on all other devices"
                  description="If enabled, user will be logged out from other active sessions when they login."
                  checked={form.forceLogoutOtherDevices}
                  disabled={!canManage}
                  onChange={() =>
                    patch("forceLogoutOtherDevices", !form.forceLogoutOtherDevices)
                  }
                />
                <ToggleRow
                  label="Remember Me Option"
                  description="Allow users to stay signed in on this device."
                  checked={form.rememberMeEnabled}
                  disabled={!canManage}
                  onChange={() => patch("rememberMeEnabled", !form.rememberMeEnabled)}
                />
                <ToggleRow
                  label="Auto logout when browser is closed"
                  description="User will be logged out automatically when browser is closed."
                  checked={form.autoLogoutOnBrowserClose}
                  disabled={!canManage}
                  onChange={() =>
                    patch("autoLogoutOnBrowserClose", !form.autoLogoutOnBrowserClose)
                  }
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">2. Login Attempts Policy</h2>
            <div className="space-y-3">
              <Field
                label="Maximum Login Attempts"
                hint="Allowed consecutive failed login attempts."
                icon={<SecurityOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.maxLoginAttempts}
                  disabled={!canManage}
                  onChange={(e) => patch("maxLoginAttempts", Number(e.target.value) || 1)}
                />
              </Field>
              <Field
                label="Lockout Duration (Minutes)"
                hint="Time for which the account will be locked."
                icon={<AccessTimeOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.lockoutDurationMinutes}
                  disabled={!canManage}
                  onChange={(e) =>
                    patch("lockoutDurationMinutes", Number(e.target.value) || 1)
                  }
                />
              </Field>
              <div className="pt-1">
                <ToggleRow
                  label="Lock account after maximum attempts"
                  description="User account will be locked after exceeding max attempts."
                  checked={form.lockAccountAfterMaxAttempts}
                  disabled={!canManage}
                  onChange={() =>
                    patch("lockAccountAfterMaxAttempts", !form.lockAccountAfterMaxAttempts)
                  }
                />
                <ToggleRow
                  label="Notify admin on account lock"
                  description="Send email notification to admin when account is locked."
                  checked={form.notifyAdminOnLock}
                  disabled={!canManage}
                  onChange={() => patch("notifyAdminOnLock", !form.notifyAdminOnLock)}
                />
                <ToggleRow
                  label="Captcha on login page"
                  description="Display captcha to prevent automated login attempts."
                  checked={form.captchaOnLogin}
                  disabled={!canManage}
                  onChange={() => patch("captchaOnLogin", !form.captchaOnLogin)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">3. Password Policy</h2>
            <div className="space-y-3">
              <Field
                label="Minimum Password Length"
                icon={<LockOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.minPasswordLength}
                  disabled={!canManage}
                  onChange={(e) => patch("minPasswordLength", Number(e.target.value) || 6)}
                />
              </Field>
              <div>
                <p className="mb-2 text-xs font-semibold text-[#6B7280]">Password Must Contain</p>
                <div className="space-y-2 text-sm text-[#374151]">
                  {(
                    [
                      ["requireUppercase", "Uppercase Letters (A-Z)"],
                      ["requireLowercase", "Lowercase Letters (a-z)"],
                      ["requireNumbers", "Numbers (0-9)"],
                      ["requireSpecialChars", "Special Characters (!@#$%^&*)"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        disabled={!canManage}
                        onChange={() => patch(key, !form[key])}
                        className="accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <Field
                label="Password Expiry (Days)"
                hint="Set 0 to never expire password."
                icon={<CalendarMonthOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.passwordExpiryDays}
                  disabled={!canManage}
                  onChange={(e) => patch("passwordExpiryDays", Number(e.target.value) || 0)}
                />
              </Field>
              <Field
                label="Prevent password reuse (Last)"
                hint="Users cannot reuse the last passwords."
                icon={<HistoryOutlined className="!text-[14px]" />}
              >
                <input
                  type="number"
                  className={inputClass}
                  value={form.preventPasswordReuseLast}
                  disabled={!canManage}
                  onChange={(e) =>
                    patch("preventPasswordReuseLast", Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
          </section>
        </div>

        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">4. Active Sessions</h2>
            <p className="mb-3 text-xs text-[#6B7280]">
              View and manage active user sessions across devices.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                  <tr>
                    <th className="px-2 py-2 font-semibold">User</th>
                    <th className="px-2 py-2 font-semibold">Role</th>
                    <th className="px-2 py-2 font-semibold">Device / Browser</th>
                    <th className="px-2 py-2 font-semibold">IP Address</th>
                    <th className="px-2 py-2 font-semibold">Location</th>
                    <th className="px-2 py-2 font-semibold">Last Active</th>
                    <th className="px-2 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.activeSessions.map((row) => (
                    <tr key={row.id} className="border-b border-[#F3F4F6]">
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {row.userName
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <p className="font-semibold text-[#1A1A1A]">{row.userName}</p>
                            {row.userEmail ? (
                              <p className="text-[11px] text-[#9CA3AF]">{row.userEmail}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                          {row.roleLabel}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.deviceLabel}</td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.ipAddress}</td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.location}</td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[#374151]">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {row.lastActiveLabel}
                          {row.isCurrent ? (
                            <span className="text-[10px] font-semibold text-primary">(you)</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          disabled={!canManage || row.isCurrent}
                          onClick={() => void terminateSession(row.id)}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 disabled:opacity-40"
                        >
                          Terminate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3">
              <p className="inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
                <WarningAmberOutlined className="!text-[14px] text-amber-500" />
                Terminating sessions will force users to log in again.
              </p>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => void terminateOthers()}
                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"
              >
                Terminate All Other Sessions
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">5. IP &amp; Device Restrictions</h2>
            <div className="space-y-3">
              <Field
                label="Allowed IP Addresses"
                hint="Enter comma separated IPs or IP ranges. Leave blank to allow all."
                icon={<SecurityOutlined className="!text-[14px]" />}
              >
                <textarea
                  className={inputClass}
                  rows={4}
                  placeholder="e.g. 192.168.1.1, 192.168.1.0/24"
                  value={form.allowedIpAddresses}
                  disabled={!canManage}
                  onChange={(e) => patch("allowedIpAddresses", e.target.value)}
                />
              </Field>
              <Field
                label="Blocked IP Addresses"
                icon={<SecurityOutlined className="!text-[14px]" />}
              >
                <textarea
                  className={inputClass}
                  rows={4}
                  placeholder="e.g. 10.0.0.1, 10.0.0.0/24"
                  value={form.blockedIpAddresses}
                  disabled={!canManage}
                  onChange={(e) => patch("blockedIpAddresses", e.target.value)}
                />
              </Field>
              <ToggleRow
                label="Restrict login to allowed IPs only"
                description="When enabled, only listed IPs can sign in."
                checked={form.restrictToAllowedIps}
                disabled={!canManage}
                onChange={() => patch("restrictToAllowedIps", !form.restrictToAllowedIps)}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">6. Login Activity Log (Recent)</h2>
            <p className="mb-3 text-xs text-[#6B7280]">
              Track recent login attempts and activity.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                  <tr>
                    <th className="px-2 py-2 font-semibold">User</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">IP Address</th>
                    <th className="px-2 py-2 font-semibold">Location</th>
                    <th className="px-2 py-2 font-semibold">Device / Browser</th>
                    <th className="px-2 py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.loginActivity.map((row) => (
                    <tr key={row.id} className="border-b border-[#F3F4F6]">
                      <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{row.userName}</td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.status === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.ipAddress}</td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.location}</td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.deviceLabel}</td>
                      <td className="px-2 py-2.5 text-[#374151]">{row.timeLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => notifySuccess("Full login history is available in audit logs")}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
            >
              <OpenInNewOutlined className="!text-[14px]" />
              View Full Login History
            </button>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Best Practices</h2>
              <ul className="space-y-2">
                {setup.bestPractices.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-[#374151]">
                    <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-900">
                <InfoOutlined className="mt-0.5 !text-[16px]" />
                <p>These policies help protect your system and sensitive data.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
