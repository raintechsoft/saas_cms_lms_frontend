import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircleOutline,
  ContentCopyOutlined,
  DescriptionOutlined,
  ErrorOutline,
  InfoOutlined,
  MenuBookOutlined,
  PhoneIphoneOutlined,
  SaveOutlined,
  ScienceOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
  WhatsApp,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Setup = {
  connection: {
    provider: string;
    isEnabled: boolean;
    isConnected: boolean;
    hasAccessToken: boolean;
    wabaId: string;
    phoneNumberId: string;
    phoneNumber: string;
    phoneVerified: boolean;
    verifyToken: string;
    webhookUrl: string;
    webhookEvents: string[];
    businessHoursMode: string;
    defaultLanguage: string;
    fallbackLanguage: string;
    templateCategoryFilter: string;
    lastConnectedAtLabel: string | null;
    lastTestStatus: string | null;
    tokenExpiresAt: string | null;
    messageQuotaLimit: number;
    messageQuotaUsed: number;
    previewSchoolName: string;
    previewMessage: string;
  };
  eventOptions: Array<{ key: string; label: string }>;
  templateStats: {
    approved: number;
    pending: number;
    rejected: number;
    archived: number;
    active: number;
  };
  summary: {
    totalSent: number;
    delivered: number;
    deliveredPercent: number;
    read: number;
    readPercent: number;
    failed: number;
    failedPercent: number;
    chargesLabel: string;
    growthPercent: number;
  };
  stats: {
    connectionStatus: string;
    phoneNumber: string;
    phoneVerified: boolean;
    quotaLabel: string;
    quotaPercent: number;
    templatesApproved: number;
    messagesSentMonth: number;
    deliveredMonth: number;
    failedMonth: number;
    lastConnectedAtLabel: string;
  };
};

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

export function WhatsAppGatewayPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "WhatsApp Gateway";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [accessTokenInput, setAccessTokenInput] = useState("");
  const [testTo, setTestTo] = useState("");
  const [form, setForm] = useState({
    provider: "meta",
    isEnabled: false,
    wabaId: "",
    phoneNumberId: "",
    phoneNumber: "",
    verifyToken: "",
    webhookEvents: [] as string[],
    businessHoursMode: "always" as "always" | "custom",
    defaultLanguage: "en",
    fallbackLanguage: "en",
    templateCategoryFilter: "ALL",
    previewMessage: "",
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/whatsapp-gateway", accessToken);
      setSetup(data);
      setForm({
        provider: data.connection.provider || "meta",
        isEnabled: data.connection.isEnabled,
        wabaId: data.connection.wabaId,
        phoneNumberId: data.connection.phoneNumberId,
        phoneNumber: data.connection.phoneNumber,
        verifyToken: data.connection.verifyToken,
        webhookEvents: data.connection.webhookEvents,
        businessHoursMode:
          data.connection.businessHoursMode === "custom" ? "custom" : "always",
        defaultLanguage: data.connection.defaultLanguage,
        fallbackLanguage: data.connection.fallbackLanguage,
        templateCategoryFilter: data.connection.templateCategoryFilter,
        previewMessage: data.connection.previewMessage,
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load WhatsApp gateway");
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
      const data = await apiRequest<Setup>("/erp/whatsapp-gateway", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          accessToken: accessTokenInput.trim() || undefined,
        }),
      });
      setSetup(data);
      setAccessTokenInput("");
      notifySuccess("WhatsApp gateway saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save WhatsApp gateway");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!accessToken || !canManage) return;
    setTesting(true);
    try {
      if (accessTokenInput.trim() || !setup?.connection.hasAccessToken) {
        await apiRequest<Setup>("/erp/whatsapp-gateway", accessToken, {
          method: "PUT",
          body: JSON.stringify({
            ...form,
            isEnabled: true,
            accessToken: accessTokenInput.trim() || undefined,
          }),
        });
      }
      const data = await apiRequest<Setup>("/erp/whatsapp-gateway/test", accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSetup(data);
      setForm((p) => ({
        ...p,
        phoneNumber: data.connection.phoneNumber || p.phoneNumber,
        isEnabled: true,
      }));
      notifySuccess("WhatsApp connected successfully");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Connection test failed");
      await load();
    } finally {
      setTesting(false);
    }
  }

  async function sendTestMessage() {
    if (!accessToken || !canManage) return;
    if (!testTo.trim()) {
      notifyError("Enter a recipient WhatsApp number");
      return;
    }
    try {
      const data = await apiRequest<Setup>("/erp/whatsapp-gateway/test-message", accessToken, {
        method: "POST",
        body: JSON.stringify({ to: testTo.trim(), message: form.previewMessage }),
      });
      setSetup(data);
      notifySuccess("Test message sent");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to send test message");
    }
  }

  function toggleEvent(key: string) {
    setForm((prev) => ({
      ...prev,
      webhookEvents: prev.webhookEvents.includes(key)
        ? prev.webhookEvents.filter((item) => item !== key)
        : [...prev.webhookEvents, key],
    }));
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      notifySuccess(`${label} copied`);
    } catch {
      notifyError("Unable to copy");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading WhatsApp gateway…</div>;
  }

  const { stats, summary, templateStats, connection } = setup;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Communication <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">WhatsApp Gateway</h1>
          <p className="text-xs text-[#6B7280]">
            Connect Meta WhatsApp Business API, configure webhooks, and manage message templates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://developers.facebook.com/docs/whatsapp"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <MenuBookOutlined className="!text-[18px]" />
            Documentation
          </a>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Connection Status"
            value={stats.connectionStatus}
            hint={`Last connected: ${stats.lastConnectedAtLabel}`}
            tone="bg-emerald-50"
            icon={<WhatsApp className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Phone Number"
            value={stats.phoneNumber}
            hint={
              stats.phoneVerified ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Verified
                </span>
              ) : (
                "Not verified"
              )
            }
            tone="bg-sky-50"
            icon={<PhoneIphoneOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Message Quota"
            value={stats.quotaLabel}
            hint={
              <div className="mt-1">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${stats.quotaPercent}%` }}
                  />
                </div>
              </div>
            }
            tone="bg-violet-50"
            icon={<DescriptionOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Templates Approved"
            value={`${stats.templatesApproved} Active`}
            hint="Approved templates"
            tone="bg-emerald-50"
            icon={<CheckCircleOutline className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Messages Sent (This Month)"
            value={stats.messagesSentMonth.toLocaleString("en-IN")}
            hint={`Delivered ${stats.deliveredMonth} · Failed ${stats.failedMonth}`}
            tone="bg-amber-50"
            icon={<WhatsApp className="!text-[20px] text-amber-600" />}
          />
        </div>

        <form onSubmit={(e) => void save(e)} className="grid gap-4 xl:grid-cols-2">
          <Card title="1. Connection Settings" hint="Meta WhatsApp Business API credentials.">
            <div className="space-y-3">
              <label className="block">
                <FieldLabel>Provider</FieldLabel>
                <select
                  className={inputClass}
                  value={form.provider}
                  disabled={!canManage}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                >
                  <option value="meta">Meta (WhatsApp Business API)</option>
                  <option value="twilio">Twilio WhatsApp</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel required>WABA ID</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.wabaId}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, wabaId: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel required>Phone Number ID</FieldLabel>
                  <input
                    className={inputClass}
                    value={form.phoneNumberId}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block">
                <FieldLabel>Display Phone Number</FieldLabel>
                <input
                  className={inputClass}
                  value={form.phoneNumber}
                  disabled={!canManage}
                  placeholder="+91 98765 43210"
                  onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>
                  Access Token{" "}
                  {connection.hasAccessToken ? "(leave blank to keep saved)" : ""}
                </FieldLabel>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? "text" : "password"}
                      className={`${inputClass} pr-10`}
                      value={accessTokenInput}
                      disabled={!canManage}
                      placeholder={connection.hasAccessToken ? "••••••••••••••••" : "EAAG..."}
                      onChange={(e) => setAccessTokenInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280]"
                      onClick={() => setShowToken((v) => !v)}
                    >
                      {showToken ? (
                        <VisibilityOffOutlined className="!text-[18px]" />
                      ) : (
                        <VisibilityOutlined className="!text-[18px]" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage || testing}
                    onClick={() => void testConnection()}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    <ScienceOutlined className="!text-[18px]" />
                    {testing ? "Testing…" : "Test Connection"}
                  </button>
                </div>
              </label>
              {connection.lastTestStatus === "SUCCESS" ? (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <CheckCircleOutline className="!text-[16px]" />
                  Token validated
                  {connection.tokenExpiresAt ? ` · expires ${connection.tokenExpiresAt}` : ""}
                </p>
              ) : null}

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-center">
                <WhatsApp className="mx-auto !text-[36px] text-emerald-600" />
                <p className="mt-2 text-sm font-bold text-emerald-800">
                  {connection.isConnected ? "Connected Successfully!" : "Not Connected"}
                </p>
                <p className="text-xs text-emerald-700">
                  {connection.isConnected
                    ? `Ready to send messages via ${connection.phoneNumber || "WhatsApp"}`
                    : "Save credentials and run Test Connection"}
                </p>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => void testConnection()}
                  className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700"
                >
                  Refresh Status
                </button>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  disabled={!canManage}
                  onChange={(e) => setForm((p) => ({ ...p, isEnabled: e.target.checked }))}
                />
                Enable WhatsApp gateway
              </label>
            </div>
          </Card>

          <Card title="2. Webhook Configuration" hint="Meta will call this URL for events.">
            <div className="space-y-3">
              <label className="block">
                <FieldLabel>Webhook URL</FieldLabel>
                <div className="flex gap-2">
                  <input className={inputClass} readOnly value={connection.webhookUrl} />
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 text-[#6B7280]"
                    onClick={() => void copyText(connection.webhookUrl, "Webhook URL")}
                  >
                    <ContentCopyOutlined className="!text-[18px]" />
                  </button>
                </div>
              </label>
              <label className="block">
                <FieldLabel>Verify Token</FieldLabel>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    value={form.verifyToken}
                    disabled={!canManage}
                    onChange={(e) => setForm((p) => ({ ...p, verifyToken: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 text-[#6B7280]"
                    onClick={() => void copyText(form.verifyToken, "Verify token")}
                  >
                    <ContentCopyOutlined className="!text-[18px]" />
                  </button>
                </div>
              </label>
              <div>
                <FieldLabel>Select Events</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {setup.eventOptions.map((item) => (
                    <label
                      key={item.key}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.webhookEvents.includes(item.key)}
                        disabled={!canManage}
                        onChange={() => toggleEvent(item.key)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] p-3 text-xs text-[#5B21B6]">
                Use this verify token in the Meta Developer Console when configuring the callback
                URL.
              </div>
              <button
                type="button"
                disabled={!canManage}
                onClick={() =>
                  notifySuccess("Paste the webhook URL and verify token in Meta to complete setup")
                }
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
              >
                Verify Webhook
              </button>
            </div>
          </Card>
        </form>

        <Card
          title="3. Message Template Settings"
          hint="Template approval status from your WhatsApp Business account."
          actions={
            <button
              type="button"
              className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
              onClick={() =>
                notifySuccess("Template management is available after Meta sync is enabled")
              }
            >
              Manage Templates
            </button>
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            {(
              [
                ["Approved", templateStats.approved, "text-emerald-700 bg-emerald-50"],
                ["Pending", templateStats.pending, "text-amber-700 bg-amber-50"],
                ["Rejected", templateStats.rejected, "text-rose-700 bg-rose-50"],
                ["Archived", templateStats.archived, "text-[#6B7280] bg-[#F3F4F6]"],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl px-3 py-3 ${tone}`}>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <FieldLabel>Default Language</FieldLabel>
              <select
                className={inputClass}
                value={form.defaultLanguage}
                disabled={!canManage}
                onChange={(e) => setForm((p) => ({ ...p, defaultLanguage: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>Fallback Language</FieldLabel>
              <select
                className={inputClass}
                value={form.fallbackLanguage}
                disabled={!canManage}
                onChange={(e) => setForm((p) => ({ ...p, fallbackLanguage: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
            </label>
            <label className="block">
              <FieldLabel>Template Category</FieldLabel>
              <select
                className={inputClass}
                value={form.templateCategoryFilter}
                disabled={!canManage}
                onChange={(e) =>
                  setForm((p) => ({ ...p, templateCategoryFilter: e.target.value }))
                }
              >
                <option value="ALL">All Categories</option>
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>
            </label>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card title="4. Business Hours">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  checked={form.businessHoursMode === "always"}
                  disabled={!canManage}
                  onChange={() => setForm((p) => ({ ...p, businessHoursMode: "always" }))}
                />
                Always Available
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="radio"
                  checked={form.businessHoursMode === "custom"}
                  disabled={!canManage}
                  onChange={() => setForm((p) => ({ ...p, businessHoursMode: "custom" }))}
                />
                Custom Business Hours
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                <span>
                  Outside business hours, inbound messages can be queued for the next working slot.
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-sky-200 bg-white px-2 py-1 font-semibold"
                  onClick={() =>
                    notifySuccess("Custom hours editor can be expanded in a follow-up")
                  }
                >
                  Configure Hours
                </button>
              </div>
            </div>
          </Card>

          <Card title="5. Message Preview">
            <div className="mx-auto w-full max-w-[240px] rounded-[28px] border-[6px] border-[#111827] bg-[#0B141A] p-3 shadow-lg">
              <div className="mb-2 text-center text-[10px] text-[#8696A0]">WhatsApp</div>
              <div className="rounded-lg bg-[#005C4B] px-3 py-2 text-[11px] leading-relaxed text-white">
                {form.previewMessage || connection.previewMessage}
              </div>
              <p className="mt-1 text-right text-[9px] text-[#8696A0]">
                {connection.previewSchoolName}
              </p>
            </div>
            <label className="mt-3 block">
              <FieldLabel>Preview / test message</FieldLabel>
              <textarea
                rows={3}
                className={inputClass}
                value={form.previewMessage}
                disabled={!canManage}
                onChange={(e) => setForm((p) => ({ ...p, previewMessage: e.target.value }))}
              />
            </label>
            <label className="mt-2 block">
              <FieldLabel>Send test to</FieldLabel>
              <input
                className={inputClass}
                value={testTo}
                disabled={!canManage}
                placeholder="+919876543210"
                onChange={(e) => setTestTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => void sendTestMessage()}
              className="mt-3 w-full rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
            >
              Send Test Message
            </button>
          </Card>
        </div>

        <Card title="6. Communication Summary" hint="This month">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-xs text-[#6B7280]">Total Messages Sent</p>
              <p className="text-xl font-bold">{summary.totalSent.toLocaleString("en-IN")}</p>
              <p className="text-xs font-semibold text-emerald-600">+{summary.growthPercent}%</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-xs text-[#6B7280]">Delivered</p>
              <p className="text-xl font-bold">{summary.delivered.toLocaleString("en-IN")}</p>
              <p className="text-xs text-[#6B7280]">{summary.deliveredPercent}%</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-xs text-[#6B7280]">Read</p>
              <p className="text-xl font-bold">{summary.read.toLocaleString("en-IN")}</p>
              <p className="text-xs text-[#6B7280]">{summary.readPercent}%</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-xs text-[#6B7280]">Failed</p>
              <p className="text-xl font-bold text-rose-600">
                {summary.failed.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-[#6B7280]">{summary.failedPercent}%</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] p-3">
              <p className="text-xs text-[#6B7280]">Charges (Est.)</p>
              <p className="text-xl font-bold">{summary.chargesLabel}</p>
              <button type="button" className="text-xs font-semibold text-primary">
                View Details
              </button>
            </div>
          </div>
        </Card>

        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#5B21B6]">
            <InfoOutlined className="!text-[18px]" />
            About WhatsApp Gateway
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#5B21B6]">
            <li>Connect Meta WhatsApp Business API with WABA ID, Phone Number ID, and access token.</li>
            <li>Configure the webhook URL and verify token in the Meta Developer Console.</li>
            <li>Approved templates are required for outbound business-initiated conversations.</li>
            <li>Use Send Test Message to validate delivery after a successful connection test.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
