import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  ContentCopyOutlined,
  DeleteOutline,
  EditOutlined,
  ErrorOutline,
  InfoOutlined,
  PieChartOutlined,
  SaveOutlined,
  ScienceOutlined,
  SmsOutlined,
  SpeedOutlined,
  AccountBalanceWalletOutlined,
  TodayOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Gateway = {
  provider: string;
  isEnabled: boolean;
  hasSecrets: boolean;
  gatewayName: string;
  senderId: string;
  country: string;
  route: string;
  templateId: string;
  balanceCredits: number;
  lastTestStatus: string | null;
  lastTestedAt: string | null;
};

type Template = {
  id: string;
  name: string;
  type: string;
  body: string;
  providerCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  updatedAtLabel: string;
};

type Activity = {
  id: string;
  toNumber: string;
  bodyPreview: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  createdAtLabel: string;
};

type Setup = {
  gateway: Gateway;
  providers: Array<{ key: string; label: string }>;
  templates: Template[];
  recentActivity: Activity[];
  usage: {
    breakdown: Array<{ key: string; label: string; count: number; percent: number }>;
  };
  stats: {
    activeGateway: string;
    isActive: boolean;
    todaySent: number;
    monthlyUsage: number;
    smsBalance: number;
    templateCount: number;
  };
};

const PAGE_SIZE = 5;
const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Card({
  title,
  hint,
  actions,
  children,
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title ? <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2> : null}
            {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
          </div>
          {actions}
        </div>
      )}
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

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
        <p className="text-xs text-[#9CA3AF]">{hint}</p>
      </div>
    </div>
  );
}

const EMPTY_TEMPLATE = {
  id: "",
  name: "",
  type: "TRANSACTIONAL",
  body: "",
  providerCode: "",
  isDefault: false,
  isActive: true,
};

export function SmsGatewayPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "SMS Gateway";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<"config" | "logs">("config");
  const [page, setPage] = useState(1);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [authKey, setAuthKey] = useState("");
  const [form, setForm] = useState({
    provider: "msg91",
    isEnabled: false,
    gatewayName: "",
    senderId: "",
    country: "91",
    route: "4",
    templateId: "",
    balanceCredits: 0,
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/sms-gateway", accessToken);
      setSetup(data);
      setForm({
        provider: data.gateway.provider || "msg91",
        isEnabled: data.gateway.isEnabled,
        gatewayName: data.gateway.gatewayName,
        senderId: data.gateway.senderId,
        country: data.gateway.country || "91",
        route: data.gateway.route || "4",
        templateId: data.gateway.templateId,
        balanceCredits: data.gateway.balanceCredits,
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load SMS gateway");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const templates = setup?.templates ?? [];
  const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = templates.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, templates.length);
  const pagedTemplates = templates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const usagePercent = useMemo(() => {
    const promo = setup?.usage.breakdown.find((b) => b.key === "promotional")?.percent ?? 0;
    return Math.min(100, promo + (setup?.usage.breakdown[1]?.percent ?? 0));
  }, [setup]);

  async function saveGateway(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/sms-gateway", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          authKey: authKey.trim() || undefined,
        }),
      });
      setSetup(data);
      setAuthKey("");
      notifySuccess("SMS gateway saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save SMS gateway");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!accessToken || !canManage) return;
    setTesting(true);
    try {
      const data = await apiRequest<Setup>("/erp/sms-gateway/test", accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSetup(data);
      setForm((prev) => ({
        ...prev,
        balanceCredits: data.gateway.balanceCredits,
      }));
      notifySuccess("Connection test successful");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Connection test failed");
      await load();
    } finally {
      setTesting(false);
    }
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/sms-gateway/templates", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: templateForm.id || undefined,
          name: templateForm.name,
          type: templateForm.type,
          body: templateForm.body,
          providerCode: templateForm.providerCode || null,
          isDefault: templateForm.isDefault,
          isActive: templateForm.isActive,
        }),
      });
      setSetup(data);
      setShowTemplateForm(false);
      setTemplateForm(EMPTY_TEMPLATE);
      notifySuccess(templateForm.id ? "Template updated" : "Template created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading SMS gateway…</div>;
  }

  const stats = setup.stats;
  const testOk = setup.gateway.lastTestStatus === "SUCCESS";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">SMS Gateway</h1>
          <p className="text-xs text-[#6B7280]">
            Configure SMS providers, templates, and monitor delivery activity.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => {
            setTab("config");
            setForm((prev) => ({
              ...prev,
              gatewayName: prev.gatewayName || "Primary Gateway",
              isEnabled: true,
            }));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Add Gateway
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Gateway"
            value={stats.isActive ? stats.activeGateway : "Inactive"}
            hint={stats.isActive ? "Currently enabled" : "Not enabled"}
            tone="bg-violet-50"
            icon={<SmsOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Today's SMS Sent"
            value={stats.todaySent}
            hint="Successful deliveries"
            tone="bg-sky-50"
            icon={<TodayOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Monthly Usage"
            value={stats.monthlyUsage}
            hint="This month"
            tone="bg-emerald-50"
            icon={<SpeedOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="SMS Balance"
            value={stats.smsBalance.toLocaleString("en-IN")}
            hint="Credits available"
            tone="bg-amber-50"
            icon={<AccountBalanceWalletOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white px-2 shadow-sm">
          <div className="flex min-w-max gap-1">
            {(
              [
                ["config", "Gateway Configuration"],
                ["logs", "Delivery Logs"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={[
                  "border-b-2 px-3 py-3 text-sm font-semibold",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "config" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card
              title="Gateway Configuration"
              hint="Credentials are encrypted at rest and never returned by the API."
            >
              <form onSubmit={(e) => void saveGateway(e)} className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel required>Gateway Provider</FieldLabel>
                  <select
                    className={inputClass}
                    value={form.provider}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                  >
                    {setup.providers.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel required>Gateway Name</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.gatewayName}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, gatewayName: e.target.value }))}
                    placeholder="MSG91 Primary"
                  />
                </label>
                <label className="block">
                  <FieldLabel required>Sender ID</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.senderId}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, senderId: e.target.value }))}
                    placeholder="SCHOOL"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Country</FieldLabel>
                  <select
                    className={inputClass}
                    value={form.country}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                  >
                    <option value="91">India (+91)</option>
                    <option value="1">USA (+1)</option>
                    <option value="44">UK (+44)</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Route</FieldLabel>
                  <select
                    className={inputClass}
                    value={form.route}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, route: e.target.value }))}
                  >
                    <option value="4">Transactional (4)</option>
                    <option value="1">Promotional (1)</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Default Flow / Template ID</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.templateId}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, templateId: e.target.value }))}
                    placeholder="MSG91 flow id (optional)"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>
                    Auth Key {setup.gateway.hasSecrets ? "(leave blank to keep saved key)" : ""}
                  </FieldLabel>
                  <input
                    type="password"
                    className={inputClass}
                    value={authKey}
                    disabled={!canManage}
                    onChange={(e) => setAuthKey(e.target.value)}
                    placeholder={setup.gateway.hasSecrets ? "••••••••••••••••" : "Enter auth key"}
                  />
                </label>
                <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2 sm:col-span-2">
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">Status</p>
                    <p className="text-xs text-[#6B7280]">Enable to use this gateway for outbound SMS</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => setForm((p) => ({ ...p, isEnabled: !p.isEnabled }))}
                    className={[
                      "relative h-6 w-11 rounded-full transition",
                      form.isEnabled ? "bg-primary" : "bg-[#D1D5DB]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 size-5 rounded-full bg-white transition",
                        form.isEnabled ? "left-5" : "left-0.5",
                      ].join(" ")}
                    />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={!canManage || testing}
                    onClick={() => void testConnection()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    <ScienceOutlined className="!text-[18px]" />
                    {testing ? "Testing…" : "Test Connection"}
                  </button>
                  {setup.gateway.lastTestStatus ? (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        testOk
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      ].join(" ")}
                    >
                      {testOk ? (
                        <CheckCircleOutline className="!text-[14px]" />
                      ) : (
                        <ErrorOutline className="!text-[14px]" />
                      )}
                      {testOk ? "Success" : "Failed"}
                    </span>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!canManage || saving}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <SaveOutlined className="!text-[18px]" />
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </Card>

            <div className="space-y-4">
              <Card title="Usage Summary">
                <div className="flex items-center gap-4">
                  <div className="relative grid size-28 place-items-center">
                    <svg viewBox="0 0 36 36" className="size-28 -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#E5E7EB" strokeWidth="4" />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#6366F1"
                        strokeWidth="4"
                        strokeDasharray={`${usagePercent * 0.88} 88`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <PieChartOutlined className="!text-[18px] text-primary" />
                      <p className="text-xs font-bold">{stats.monthlyUsage}</p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {setup.usage.breakdown.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-xs">
                        <span className="text-[#6B7280]">
                          {item.label}: {item.count}
                        </span>
                        <span className="font-semibold text-[#374151]">{item.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title="Recent Activity">
                {setup.recentActivity.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No SMS activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {setup.recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg border border-[#F3F4F6] px-2 py-2"
                      >
                        {item.status === "SUCCESS" ? (
                          <CheckCircleOutline className="!text-[18px] text-emerald-600" />
                        ) : (
                          <ErrorOutline className="!text-[18px] text-rose-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                            {item.toNumber}
                          </p>
                          <p className="truncate text-xs text-[#6B7280]">{item.bodyPreview}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{item.createdAtLabel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <Card title="Delivery Logs" hint="Recent outbound SMS attempts for this campus.">
            {setup.recentActivity.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No delivery logs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Message</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.recentActivity.map((item) => (
                      <tr key={item.id} className="border-t border-[#F3F4F6]">
                        <td className="px-3 py-2.5 font-semibold">{item.toNumber}</td>
                        <td className="max-w-xs truncate px-3 py-2.5 text-[#6B7280]">
                          {item.bodyPreview}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              item.status === "SUCCESS"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.status === "SKIPPED"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-rose-50 text-rose-700",
                            ].join(" ")}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{item.createdAtLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <Card
          title="SMS Templates"
          hint="Reusable message templates with placeholders like {student_name}."
          actions={
            <button
              type="button"
              disabled={!canManage}
              onClick={() => {
                setTemplateForm(EMPTY_TEMPLATE);
                setShowTemplateForm(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <AddOutlined className="!text-[16px]" />
              Add Template
            </button>
          }
        >
          {showTemplateForm ? (
            <form
              onSubmit={(e) => void saveTemplate(e)}
              className="mb-4 grid gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:grid-cols-2"
            >
              <label className="block">
                <FieldLabel required>Template Name</FieldLabel>
                <input
                  className={inputClass}
                  value={templateForm.name}
                  disabled={!canManage}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Type</FieldLabel>
                <select
                  className={inputClass}
                  value={templateForm.type}
                  disabled={!canManage}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="TRANSACTIONAL">Transactional</option>
                  <option value="PROMOTIONAL">Promotional</option>
                  <option value="OTP">OTP</option>
                  <option value="ALERT">Alert</option>
                  <option value="GENERAL">General</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel required>Message Body</FieldLabel>
                <textarea
                  rows={3}
                  className={inputClass}
                  value={templateForm.body}
                  disabled={!canManage}
                  onChange={(e) => setTemplateForm((p) => ({ ...p, body: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Provider Template Code</FieldLabel>
                <input
                  className={inputClass}
                  value={templateForm.providerCode}
                  disabled={!canManage}
                  onChange={(e) =>
                    setTemplateForm((p) => ({ ...p, providerCode: e.target.value }))
                  }
                />
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={templateForm.isDefault}
                    disabled={!canManage}
                    onChange={(e) =>
                      setTemplateForm((p) => ({ ...p, isDefault: e.target.checked }))
                    }
                  />
                  Default
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={templateForm.isActive}
                    disabled={!canManage}
                    onChange={(e) =>
                      setTemplateForm((p) => ({ ...p, isActive: e.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    setShowTemplateForm(false);
                    setTemplateForm(EMPTY_TEMPLATE);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save Template
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Template Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Message Preview</th>
                  <th className="px-3 py-2">Last Updated</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedTemplates.map((item, index) => (
                  <tr key={item.id} className="border-t border-[#F3F4F6]">
                    <td className="px-3 py-2.5 text-[#6B7280]">
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#1A1A1A]">{item.name}</span>
                        {item.isDefault ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Default
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#374151]">{item.type}</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-[#6B7280]">{item.body}</td>
                    <td className="px-3 py-2.5 text-[#6B7280]">{item.updatedAtLabel}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700",
                        ].join(" ")}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!canManage}
                          className="rounded p-1 text-violet-600 hover:bg-violet-50 disabled:opacity-40"
                          onClick={() => {
                            setTemplateForm({
                              id: item.id,
                              name: item.name,
                              type: item.type,
                              body: item.body,
                              providerCode: item.providerCode ?? "",
                              isDefault: item.isDefault,
                              isActive: item.isActive,
                            });
                            setShowTemplateForm(true);
                          }}
                        >
                          <EditOutlined className="!text-[18px]" />
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          className="rounded p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                          onClick={() =>
                            void (async () => {
                              if (!accessToken) return;
                              try {
                                const data = await apiRequest<Setup>(
                                  `/erp/sms-gateway/templates/${item.id}/clone`,
                                  accessToken,
                                  { method: "POST", body: JSON.stringify({}) },
                                );
                                setSetup(data);
                                notifySuccess("Template cloned");
                              } catch (cause) {
                                notifyError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Unable to clone template",
                                );
                              }
                            })()
                          }
                        >
                          <ContentCopyOutlined className="!text-[18px]" />
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          onClick={() =>
                            void (async () => {
                              if (!accessToken) return;
                              const ok = await confirmDelete(`Delete template "${item.name}"?`);
                              if (!ok) return;
                              try {
                                const data = await apiRequest<Setup>(
                                  `/erp/sms-gateway/templates/${item.id}`,
                                  accessToken,
                                  { method: "DELETE" },
                                );
                                setSetup(data);
                                notifySuccess("Template deleted");
                              } catch (cause) {
                                notifyError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Unable to delete template",
                                );
                              }
                            })()
                          }
                        >
                          <DeleteOutline className="!text-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
            <p>
              Showing {pageStart} to {pageEnd} of {templates.length} entries
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={[
                    "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                    num === currentPage
                      ? "bg-primary text-white"
                      : "border border-[#E5E7EB] text-[#374151]",
                  ].join(" ")}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1D4ED8]">
            <InfoOutlined className="!text-[18px]" />
            About SMS Gateway
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#1D4ED8]">
            <li>Configure MSG91 (or another provider) with sender ID and encrypted auth key.</li>
            <li>Use Test Connection to verify credentials and refresh SMS balance.</li>
            <li>Create templates with placeholders like {"{student_name}"} for fee and attendance alerts.</li>
            <li>Delivery logs appear as SMS is sent from reminders and notifications.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
