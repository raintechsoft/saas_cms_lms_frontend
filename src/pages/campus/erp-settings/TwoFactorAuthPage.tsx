import { useEffect, useMemo, useState } from "react";
import {
  CheckCircleOutline,
  EmailOutlined,
  ExpandMoreOutlined,
  HelpOutlineOutlined,
  InfoOutlined,
  ListAltOutlined,
  PhoneIphoneOutlined,
  SaveOutlined,
  SecurityOutlined,
  SmsOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type MethodKey = "totp" | "sms" | "email" | "backup";

type Setup = {
  overview: {
    enabled: boolean;
    enforcedRoles: string[];
    optionalRoles: string[];
    enforcedCount: number;
    optionalCount: number;
    coveragePercent: number;
    enabledUsers: number;
    totalUsers: number;
    statusMessage: string;
  };
  methods: Array<{
    key: MethodKey;
    label: string;
    description: string;
    enabled: boolean;
    color: string;
    configurable: boolean;
  }>;
  policy: {
    enforcedRoleCodes: string[];
    optionalRoleCodes: string[];
    gracePeriodDays: number;
    requireOnNewDevices: boolean;
    rememberDeviceDays: number;
    maxAttemptsWithout2fa: number;
  };
  backup: {
    generateBackupCodes: boolean;
    backupCodesCount: number;
  };
  methodConfig: {
    totpIssuer: string;
    smsCodeExpirySeconds: number;
    emailCodeExpirySeconds: number;
  };
  availableRoles: Array<{ code: string; label: string; shortLabel: string }>;
  coverageByRole: Array<{
    code: string;
    label: string;
    shortLabel: string;
    color: string;
    totalUsers: number;
    enabledUsers: number;
    percent: number;
  }>;
  setupFlow: string[];
  securityTips: string[];
};

type FormState = {
  enabled: boolean;
  methodTotp: boolean;
  methodSms: boolean;
  methodEmail: boolean;
  methodBackupCodes: boolean;
  enforcedRoleCodes: string[];
  optionalRoleCodes: string[];
  gracePeriodDays: number;
  requireOnNewDevices: boolean;
  rememberDeviceDays: number;
  maxAttemptsWithout2fa: number;
  generateBackupCodes: boolean;
  backupCodesCount: number;
  totpIssuer: string;
  smsCodeExpirySeconds: number;
  emailCodeExpirySeconds: number;
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function methodIcon(key: MethodKey, color: string) {
  const cls = `!text-[22px]`;
  const style = { color };
  if (key === "totp") return <PhoneIphoneOutlined className={cls} style={style} />;
  if (key === "sms") return <SmsOutlined className={cls} style={style} />;
  if (key === "email") return <EmailOutlined className={cls} style={style} />;
  return <SecurityOutlined className={cls} style={style} />;
}

function CoverageRing({ percent }: { percent: number }) {
  const size = 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative inline-flex h-[88px] w-[88px] items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-lg font-bold text-[#1A1A1A]">{percent}%</span>
    </div>
  );
}

function DonutChart({
  segments,
}: {
  segments: Array<{ color: string; value: number; label: string }>;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let cursor = 0;
  const gradient = segments
    .map((s) => {
      const start = (cursor / total) * 100;
      cursor += s.value;
      const end = (cursor / total) * 100;
      return `${s.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div
      className="mx-auto h-28 w-28 rounded-full"
      style={{
        background: `conic-gradient(${gradient})`,
        mask: "radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))",
        WebkitMask:
          "radial-gradient(farthest-side, transparent calc(100% - 14px), #000 calc(100% - 13px))",
      }}
      title={segments.map((s) => s.label).join(", ")}
    />
  );
}

export function TwoFactorAuthPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Two-Factor Authentication";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedMethod, setExpandedMethod] = useState<MethodKey | null>(null);

  function applySetup(data: Setup) {
    setSetup(data);
    setForm({
      enabled: data.overview.enabled,
      methodTotp: data.methods.find((m) => m.key === "totp")?.enabled ?? true,
      methodSms: data.methods.find((m) => m.key === "sms")?.enabled ?? true,
      methodEmail: data.methods.find((m) => m.key === "email")?.enabled ?? false,
      methodBackupCodes: data.methods.find((m) => m.key === "backup")?.enabled ?? true,
      enforcedRoleCodes: [...data.policy.enforcedRoleCodes],
      optionalRoleCodes: [...data.policy.optionalRoleCodes],
      gracePeriodDays: data.policy.gracePeriodDays,
      requireOnNewDevices: data.policy.requireOnNewDevices,
      rememberDeviceDays: data.policy.rememberDeviceDays,
      maxAttemptsWithout2fa: data.policy.maxAttemptsWithout2fa,
      generateBackupCodes: data.backup.generateBackupCodes,
      backupCodesCount: data.backup.backupCodesCount,
      totpIssuer: data.methodConfig.totpIssuer,
      smsCodeExpirySeconds: data.methodConfig.smsCodeExpirySeconds,
      emailCodeExpirySeconds: data.methodConfig.emailCodeExpirySeconds,
    });
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/two-factor", accessToken);
      applySetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load 2FA settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const methodEnabled = useMemo(() => {
    if (!form) return {} as Record<MethodKey, boolean>;
    return {
      totp: form.methodTotp,
      sms: form.methodSms,
      email: form.methodEmail,
      backup: form.methodBackupCodes,
    };
  }, [form]);

  function toggleRole(code: string, list: "enforced" | "optional") {
    if (!form) return;
    setForm((prev) => {
      if (!prev) return prev;
      if (list === "enforced") {
        const exists = prev.enforcedRoleCodes.includes(code);
        const enforcedRoleCodes = exists
          ? prev.enforcedRoleCodes.filter((c) => c !== code)
          : [...prev.enforcedRoleCodes, code];
        const optionalRoleCodes = prev.optionalRoleCodes.filter((c) => c !== code);
        return { ...prev, enforcedRoleCodes, optionalRoleCodes };
      }
      const exists = prev.optionalRoleCodes.includes(code);
      const optionalRoleCodes = exists
        ? prev.optionalRoleCodes.filter((c) => c !== code)
        : [...prev.optionalRoleCodes, code];
      const enforcedRoleCodes = prev.enforcedRoleCodes.filter((c) => c !== code);
      return { ...prev, enforcedRoleCodes, optionalRoleCodes };
    });
  }

  async function save() {
    if (!accessToken || !canManage || !form) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/two-factor", accessToken, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      applySetup(data);
      notifySuccess("2FA configuration saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save 2FA settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup || !form) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading two-factor settings…</div>;
  }

  const enforcedLabels = form.enforcedRoleCodes.map(
    (code) => setup.availableRoles.find((r) => r.code === code)?.shortLabel || code,
  );
  const optionalLabels = form.optionalRoleCodes.map(
    (code) => setup.availableRoles.find((r) => r.code === code)?.shortLabel || code,
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Data &amp; Security <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Two-Factor Authentication</h1>
          <p className="text-xs text-[#6B7280]">
            Add an extra layer of security for user accounts by requiring a second form of
            verification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => notifySuccess("Audit events will appear in system logs")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <ListAltOutlined className="!text-[18px]" />
            Audit Log
          </button>
          <button
            type="button"
            onClick={() =>
              notifySuccess("Enable 2FA, pick methods, then enforce for admin and staff roles")
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    2FA Status
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-3">
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => setForm((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev))}
                      className={`relative h-7 w-12 rounded-full transition ${
                        form.enabled ? "bg-emerald-500" : "bg-[#D1D5DB]"
                      } disabled:opacity-50`}
                      aria-pressed={form.enabled}
                    >
                      <span
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                          form.enabled ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                    <span
                      className={`text-sm font-bold ${
                        form.enabled ? "text-emerald-600" : "text-[#6B7280]"
                      }`}
                    >
                      {form.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </label>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Enforced For
                  </p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {enforcedLabels.join(", ") || "None"}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-primary"
                    onClick={() =>
                      document.getElementById("enforce-roles")?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    {form.enforcedRoleCodes.length} Roles
                  </button>
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    Optional For
                  </p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {optionalLabels.join(", ") || "None"}
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-primary"
                    onClick={() =>
                      document.getElementById("enforce-roles")?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    {form.optionalRoleCodes.length} Roles
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <CoverageRing percent={setup.overview.coveragePercent} />
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">Users with 2FA</p>
                    <p className="text-xs text-[#6B7280]">
                      {setup.overview.enabledUsers} of {setup.overview.totalUsers} users
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                  form.enabled
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {form.enabled ? (
                  <CheckCircleOutline className="mt-0.5 !text-[18px]" />
                ) : (
                  <WarningAmberOutlined className="mt-0.5 !text-[18px]" />
                )}
                <p>
                  {form.enabled
                    ? setup.overview.statusMessage
                    : "Two-Factor Authentication is disabled. Enable it to protect user accounts."}
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-bold text-[#1A1A1A]">1. 2FA Methods</h2>
              <p className="mb-3 text-xs text-[#6B7280]">
                Select and configure the two-factor authentication methods available to users.
              </p>
              <div className="space-y-2">
                {setup.methods.map((method) => {
                  const enabled = methodEnabled[method.key];
                  const expanded = expandedMethod === method.key;
                  return (
                    <div
                      key={method.key}
                      className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white"
                          style={{ boxShadow: "inset 0 0 0 1px #E5E7EB" }}
                        >
                          {methodIcon(method.key, method.color)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{method.label}</p>
                          <p className="text-xs text-[#6B7280]">{method.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            setForm((prev) => {
                              if (!prev) return prev;
                              if (method.key === "totp") {
                                return { ...prev, methodTotp: !prev.methodTotp };
                              }
                              if (method.key === "sms") {
                                return { ...prev, methodSms: !prev.methodSms };
                              }
                              if (method.key === "email") {
                                return { ...prev, methodEmail: !prev.methodEmail };
                              }
                              return { ...prev, methodBackupCodes: !prev.methodBackupCodes };
                            })
                          }
                          className={`relative h-6 w-11 rounded-full transition ${
                            enabled ? "bg-primary" : "bg-[#D1D5DB]"
                          } disabled:opacity-50`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                              enabled ? "left-[22px]" : "left-0.5"
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMethod((prev) => (prev === method.key ? null : method.key))
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#374151]"
                        >
                          Configure
                          <ExpandMoreOutlined
                            className={`!text-[16px] transition ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>
                      {expanded ? (
                        <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white p-3">
                          {method.key === "totp" ? (
                            <label className="block max-w-sm text-sm">
                              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                                TOTP Issuer Name
                              </span>
                              <input
                                className={inputClass}
                                value={form.totpIssuer}
                                disabled={!canManage}
                                onChange={(e) =>
                                  setForm((prev) =>
                                    prev ? { ...prev, totpIssuer: e.target.value } : prev,
                                  )
                                }
                              />
                            </label>
                          ) : null}
                          {method.key === "sms" ? (
                            <label className="block max-w-sm text-sm">
                              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                                SMS Code Expiry (seconds)
                              </span>
                              <input
                                type="number"
                                className={inputClass}
                                value={form.smsCodeExpirySeconds}
                                disabled={!canManage}
                                onChange={(e) =>
                                  setForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          smsCodeExpirySeconds: Number(e.target.value) || 300,
                                        }
                                      : prev,
                                  )
                                }
                              />
                            </label>
                          ) : null}
                          {method.key === "email" ? (
                            <label className="block max-w-sm text-sm">
                              <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                                Email Code Expiry (seconds)
                              </span>
                              <input
                                type="number"
                                className={inputClass}
                                value={form.emailCodeExpirySeconds}
                                disabled={!canManage}
                                onChange={(e) =>
                                  setForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          emailCodeExpirySeconds: Number(e.target.value) || 600,
                                        }
                                      : prev,
                                  )
                                }
                              />
                            </label>
                          ) : null}
                          {method.key === "backup" ? (
                            <p className="text-xs text-[#6B7280]">
                              Backup code generation is controlled in section 3 below.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              id="enforce-roles"
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5"
            >
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">2. 2FA Policy Settings</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold text-[#6B7280]">Enforce 2FA For Roles</p>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2">
                    {setup.availableRoles.map((role) => {
                      const enforced = form.enforcedRoleCodes.includes(role.code);
                      return (
                        <button
                          key={role.code}
                          type="button"
                          disabled={!canManage}
                          onClick={() => toggleRole(role.code, "enforced")}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            enforced
                              ? "bg-primary text-white"
                              : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                          }`}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-[#9CA3AF]">
                    Optional roles:{" "}
                    {setup.availableRoles
                      .filter((r) => form.optionalRoleCodes.includes(r.code))
                      .map((r) => r.label)
                      .join(", ") || "None"}{" "}
                    — click a role again after removing from enforce to mark optional, or use:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {setup.availableRoles.map((role) => {
                      const optional = form.optionalRoleCodes.includes(role.code);
                      return (
                        <button
                          key={`opt-${role.code}`}
                          type="button"
                          disabled={!canManage}
                          onClick={() => toggleRole(role.code, "optional")}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            optional
                              ? "border-sky-300 bg-sky-50 text-sky-700"
                              : "border-[#E5E7EB] text-[#9CA3AF]"
                          }`}
                        >
                          Optional: {role.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Grace Period (Days)
                  </span>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.gracePeriodDays}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, gracePeriodDays: Number(e.target.value) || 0 }
                          : prev,
                      )
                    }
                  />
                  <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                    Users will be prompted to setup 2FA within this period.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Require 2FA on New Devices
                  </span>
                  <select
                    className={inputClass}
                    value={form.requireOnNewDevices ? "yes" : "no"}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, requireOnNewDevices: e.target.value === "yes" }
                          : prev,
                      )
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                  <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                    Ask for 2FA verification on new devices.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Remember Device (Days)
                  </span>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.rememberDeviceDays}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, rememberDeviceDays: Number(e.target.value) || 0 }
                          : prev,
                      )
                    }
                  />
                  <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                    Skip 2FA on trusted devices for this period.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Max Login Attempts Without 2FA
                  </span>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.maxAttemptsWithout2fa}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              maxAttemptsWithout2fa: Number(e.target.value) || 1,
                            }
                          : prev,
                      )
                    }
                  />
                  <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                    Account will be locked after exceeding attempts.
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">3. Backup Codes Policy</h2>
              <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={form.generateBackupCodes}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, generateBackupCodes: e.target.checked }
                            : prev,
                        )
                      }
                      className="accent-primary"
                    />
                    Generate backup codes for users
                  </label>
                  <label className="block max-w-xs">
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Number of Backup Codes
                    </span>
                    <select
                      className={inputClass}
                      value={form.backupCodesCount}
                      disabled={!canManage || !form.generateBackupCodes}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? { ...prev, backupCodesCount: Number(e.target.value) }
                            : prev,
                        )
                      }
                    >
                      {[5, 8, 10, 12, 16].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                      Number of single-use backup codes.
                    </span>
                  </label>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                  <InfoOutlined className="mt-0.5 shrink-0 !text-[18px]" />
                  <p>
                    <span className="font-semibold">Note:</span> Backup codes can be used when a
                    user loses access to their 2FA device.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <WarningAmberOutlined className="mt-0.5 !text-[18px]" />
              <p>
                <span className="font-semibold">Important:</span> Enforcing 2FA may require users to
                re-login and set up their preferred 2FA method.
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">2FA Setup Flow</h2>
              <ol className="space-y-3">
                {setup.setupFlow.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm text-[#374151]">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Security Tips</h2>
              <ul className="space-y-2">
                {setup.securityTips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-[#374151]">
                    <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">User 2FA Status (By Role)</h2>
              <DonutChart
                segments={setup.coverageByRole.map((row) => ({
                  color: row.color,
                  value: row.enabledUsers || 1,
                  label: row.shortLabel,
                }))}
              />
              <ul className="mt-4 space-y-2">
                {setup.coverageByRole.map((row) => (
                  <li key={row.code} className="flex items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-2 text-[#374151]">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.shortLabel}
                    </span>
                    <span className="font-semibold text-[#1A1A1A]">
                      {row.enabledUsers}/{row.totalUsers} ({row.percent}%)
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => notifySuccess("Full 2FA adoption report coming soon")}
                className="mt-4 w-full rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
              >
                View Full Report
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
