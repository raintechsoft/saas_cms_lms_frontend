import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  DevicesOutlined,
  ErrorOutline,
  MenuBookOutlined,
  NotificationsActiveOutlined,
  NotificationsNoneOutlined,
  SaveOutlined,
  ScienceOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Topic = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subscriberCount: number;
  isActive: boolean;
  createdAtLabel: string;
  index: number;
};

type Setup = {
  gateway: {
    provider: string;
    isEnabled: boolean;
    isActive: boolean;
    hasServerKey: boolean;
    hasWebApiKey: boolean;
    senderId: string;
    projectId: string;
    androidEnabled: boolean;
    iosEnabled: boolean;
    webEnabled: boolean;
    defaultTitle: string;
    defaultIconUrl: string;
    defaultClickAction: string;
    defaultSound: string;
    showBadge: boolean;
    requireConsent: boolean;
    lastConnectedAt: string | null;
    lastConnectedAtLabel: string | null;
    lastTestStatus: string | null;
    envPushConfigured: boolean;
  };
  topics: Topic[];
  recent: Array<{
    id: string;
    title: string;
    bodyPreview: string;
    topicKey: string | null;
    recipientCount: number;
    status: string;
    createdAtLabel: string;
  }>;
  usage: {
    daily: Array<{ day: number; count: number }>;
    totalSent: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveredPercent: number;
    failedPercent: number;
    growthPercent: number;
  };
  stats: {
    gatewayStatus: string;
    isActive: boolean;
    totalDevices: number;
    notificationsSent: number;
    delivered: number;
    failed: number;
    deliveredPercent: number;
    failedPercent: number;
    growthPercent: number;
    lastConnectedAtLabel: string;
  };
};

const PAGE_SIZE = 5;

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const EMPTY_TOPIC = {
  id: "",
  key: "",
  name: "",
  description: "",
  isActive: true,
  subscriberCount: 0,
};

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

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-3 text-left disabled:opacity-50"
    >
      <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-primary" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function statusTone(status: string) {
  if (status === "DELIVERED" || status === "SENT") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "FAILED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export function PushGatewayPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Push Notification Gateway";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showServerKey, setShowServerKey] = useState(false);
  const [showWebKey, setShowWebKey] = useState(false);
  const [serverKey, setServerKey] = useState("");
  const [webApiKey, setWebApiKey] = useState("");
  const [topicPage, setTopicPage] = useState(1);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [topicForm, setTopicForm] = useState(EMPTY_TOPIC);
  const [form, setForm] = useState({
    provider: "fcm",
    isEnabled: true,
    senderId: "",
    projectId: "",
    androidEnabled: true,
    iosEnabled: true,
    webEnabled: true,
    defaultTitle: "",
    defaultIconUrl: "",
    defaultClickAction: "open_home",
    defaultSound: "default",
    showBadge: true,
    requireConsent: true,
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/push-gateway", accessToken);
      setSetup(data);
      setForm({
        provider: data.gateway.provider || "fcm",
        isEnabled: data.gateway.isEnabled,
        senderId: data.gateway.senderId,
        projectId: data.gateway.projectId,
        androidEnabled: data.gateway.androidEnabled,
        iosEnabled: data.gateway.iosEnabled,
        webEnabled: data.gateway.webEnabled,
        defaultTitle: data.gateway.defaultTitle,
        defaultIconUrl: data.gateway.defaultIconUrl,
        defaultClickAction: data.gateway.defaultClickAction || "open_home",
        defaultSound: data.gateway.defaultSound || "default",
        showBadge: data.gateway.showBadge,
        requireConsent: data.gateway.requireConsent,
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load push gateway");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const topics = setup?.topics ?? [];
  const totalPages = Math.max(1, Math.ceil(topics.length / PAGE_SIZE));
  const currentPage = Math.min(topicPage, totalPages);
  const pagedTopics = topics.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const maxDaily = useMemo(() => {
    const values = setup?.usage.daily.map((d) => d.count) ?? [0];
    return Math.max(1, ...values);
  }, [setup]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/push-gateway", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          serverKey: serverKey.trim() || undefined,
          webApiKey: webApiKey.trim() || undefined,
        }),
      });
      setSetup(data);
      setServerKey("");
      setWebApiKey("");
      notifySuccess("Push gateway saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save push gateway");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!accessToken || !canManage) return;
    setTesting(true);
    try {
      if (serverKey.trim() || webApiKey.trim() || !setup?.gateway.hasServerKey) {
        await apiRequest<Setup>("/erp/push-gateway", accessToken, {
          method: "PUT",
          body: JSON.stringify({
            ...form,
            isEnabled: true,
            serverKey: serverKey.trim() || undefined,
            webApiKey: webApiKey.trim() || undefined,
          }),
        });
      }
      const data = await apiRequest<Setup>("/erp/push-gateway/test", accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSetup(data);
      setServerKey("");
      setWebApiKey("");
      notifySuccess("Connected successfully");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Connection test failed");
      await load();
    } finally {
      setTesting(false);
    }
  }

  async function saveTopic(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/push-gateway/topics", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: topicForm.id || undefined,
          key: topicForm.key,
          name: topicForm.name,
          description: topicForm.description || null,
          isActive: topicForm.isActive,
          subscriberCount: topicForm.subscriberCount,
        }),
      });
      setSetup(data);
      setShowTopicForm(false);
      setTopicForm(EMPTY_TOPIC);
      notifySuccess(topicForm.id ? "Topic updated" : "Topic created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save topic");
    } finally {
      setSaving(false);
    }
  }

  async function removeTopic(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this topic?")) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>(`/erp/push-gateway/topics/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Topic deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete topic");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading push notification gateway…</div>;
  }

  const stats = setup.stats;
  const testOk = setup.gateway.lastTestStatus === "SUCCESS";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Communication <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Push Notification Gateway</h1>
          <p className="text-xs text-[#6B7280]">
            Configure and manage push notification gateway to send real-time notifications to users.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://firebase.google.com/docs/cloud-messaging"
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
            label="Gateway Status"
            value={stats.gatewayStatus}
            hint={`Last connected: ${stats.lastConnectedAtLabel}`}
            tone={stats.isActive ? "bg-emerald-50" : "bg-slate-50"}
            icon={
              stats.isActive ? (
                <CheckCircleOutline className="!text-[20px] text-emerald-600" />
              ) : (
                <ErrorOutline className="!text-[20px] text-slate-500" />
              )
            }
          />
          <StatCard
            label="Total Devices"
            value={stats.totalDevices.toLocaleString()}
            hint="Registered this month"
            tone="bg-sky-50"
            icon={<DevicesOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Notifications Sent"
            value={stats.notificationsSent.toLocaleString()}
            hint={
              stats.growthPercent >= 0
                ? `Up ${stats.growthPercent}% vs last month`
                : `Down ${Math.abs(stats.growthPercent)}% vs last month`
            }
            tone="bg-violet-50"
            icon={<NotificationsActiveOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Delivered"
            value={stats.delivered.toLocaleString()}
            hint={`${stats.deliveredPercent}% delivery rate`}
            tone="bg-emerald-50"
            icon={<CheckCircleOutline className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Failed"
            value={stats.failed.toLocaleString()}
            hint={`${stats.failedPercent}% failure rate`}
            tone="bg-rose-50"
            icon={<ErrorOutline className="!text-[20px] text-rose-600" />}
          />
        </div>

        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <Card
            title="1. Gateway Configuration"
            hint="Choose provider and enter service credentials."
            actions={
              <button
                type="button"
                disabled={!canManage || testing}
                onClick={() => void testConnection()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#374151] disabled:opacity-50"
              >
                <ScienceOutlined className="!text-[16px]" />
                {testing ? "Testing…" : "Test Connection"}
              </button>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "fcm", label: "Firebase Cloud Messaging (FCM)" },
                { id: "onesignal", label: "OneSignal" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setForm((prev) => ({ ...prev, provider: option.id }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                    form.provider === option.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-[#E5E7EB] bg-white text-[#374151]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <FieldLabel required>Server Key</FieldLabel>
                <div className="relative">
                  <input
                    type={showServerKey ? "text" : "password"}
                    className={inputClass}
                    disabled={!canManage}
                    value={serverKey}
                    placeholder={
                      setup.gateway.hasServerKey ? "••••••••••••••••" : "Enter FCM server key"
                    }
                    onChange={(e) => setServerKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                    onClick={() => setShowServerKey((v) => !v)}
                  >
                    {showServerKey ? (
                      <VisibilityOffOutlined className="!text-[18px]" />
                    ) : (
                      <VisibilityOutlined className="!text-[18px]" />
                    )}
                  </button>
                </div>
              </label>
              <label className="block">
                <FieldLabel>Web API Key</FieldLabel>
                <div className="relative">
                  <input
                    type={showWebKey ? "text" : "password"}
                    className={inputClass}
                    disabled={!canManage}
                    value={webApiKey}
                    placeholder={
                      setup.gateway.hasWebApiKey ? "••••••••••••••••" : "Enter web API key"
                    }
                    onChange={(e) => setWebApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                    onClick={() => setShowWebKey((v) => !v)}
                  >
                    {showWebKey ? (
                      <VisibilityOffOutlined className="!text-[18px]" />
                    ) : (
                      <VisibilityOutlined className="!text-[18px]" />
                    )}
                  </button>
                </div>
              </label>
              <label className="block">
                <FieldLabel>Sender ID</FieldLabel>
                <input
                  className={inputClass}
                  disabled={!canManage}
                  value={form.senderId}
                  onChange={(e) => setForm((prev) => ({ ...prev, senderId: e.target.value }))}
                  placeholder="123456789012"
                />
              </label>
              <label className="block">
                <FieldLabel>Project ID</FieldLabel>
                <input
                  className={inputClass}
                  disabled={!canManage}
                  value={form.projectId}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  placeholder="school-erp-2026"
                />
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={form.isEnabled}
                disabled={!canManage}
                onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
              />
              Enable push notification gateway
            </label>

            {testOk ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircleOutline className="!text-[18px]" />
                Connected Successfully!
              </p>
            ) : setup.gateway.lastTestStatus === "FAILED" ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                <ErrorOutline className="!text-[18px]" />
                Last connection test failed
              </p>
            ) : null}
          </Card>

          <Card title="2. Platform Settings" hint="Enable delivery channels for each platform.">
            <div className="grid gap-3 md:grid-cols-3">
              <Toggle
                label="Android"
                checked={form.androidEnabled}
                disabled={!canManage}
                onChange={(androidEnabled) => setForm((prev) => ({ ...prev, androidEnabled }))}
              />
              <Toggle
                label="iOS"
                checked={form.iosEnabled}
                disabled={!canManage}
                onChange={(iosEnabled) => setForm((prev) => ({ ...prev, iosEnabled }))}
              />
              <Toggle
                label="Web Push"
                checked={form.webEnabled}
                disabled={!canManage}
                onChange={(webEnabled) => setForm((prev) => ({ ...prev, webEnabled }))}
              />
            </div>
          </Card>

          <Card title="3. Notification Settings" hint="Default behavior for outbound push messages.">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <FieldLabel>Default Title</FieldLabel>
                <input
                  className={inputClass}
                  disabled={!canManage}
                  value={form.defaultTitle}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultTitle: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Default Icon (URL)</FieldLabel>
                <input
                  className={inputClass}
                  disabled={!canManage}
                  value={form.defaultIconUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultIconUrl: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Default Click Action</FieldLabel>
                <select
                  className={inputClass}
                  disabled={!canManage}
                  value={form.defaultClickAction}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, defaultClickAction: e.target.value }))
                  }
                >
                  <option value="open_home">Open App Home</option>
                  <option value="open_url">Open Deep Link / URL</option>
                  <option value="open_inbox">Open Notification Inbox</option>
                </select>
              </label>
              <label className="block">
                <FieldLabel>Default Sound</FieldLabel>
                <select
                  className={inputClass}
                  disabled={!canManage}
                  value={form.defaultSound}
                  onChange={(e) => setForm((prev) => ({ ...prev, defaultSound: e.target.value }))}
                >
                  <option value="default">default</option>
                  <option value="alert">alert</option>
                  <option value="silent">silent</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#374151]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showBadge}
                  disabled={!canManage}
                  onChange={(e) => setForm((prev) => ({ ...prev, showBadge: e.target.checked }))}
                />
                Show notification badge count
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requireConsent}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, requireConsent: e.target.checked }))
                  }
                />
                Require user consent before sending
              </label>
            </div>
          </Card>
        </form>

        <Card
          title="4. Topic Management"
          hint="Manage broadcast topics and subscriber groups."
          actions={
            <button
              type="button"
              disabled={!canManage}
              onClick={() => {
                setTopicForm(EMPTY_TOPIC);
                setShowTopicForm(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <AddOutlined className="!text-[16px]" />
              Add Topic
            </button>
          }
        >
          {showTopicForm ? (
            <form
              onSubmit={(e) => void saveTopic(e)}
              className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3 md:grid-cols-2"
            >
              <label className="block">
                <FieldLabel required>Key</FieldLabel>
                <input
                  className={inputClass}
                  required
                  value={topicForm.key}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, key: e.target.value }))}
                  placeholder="all_students"
                />
              </label>
              <label className="block">
                <FieldLabel required>Name</FieldLabel>
                <input
                  className={inputClass}
                  required
                  value={topicForm.name}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <input
                  className={inputClass}
                  value={topicForm.description}
                  onChange={(e) =>
                    setTopicForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </label>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={topicForm.isActive}
                    onChange={(e) =>
                      setTopicForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                  />
                  Active
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {topicForm.id ? "Update Topic" : "Create Topic"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTopicForm(false);
                    setTopicForm(EMPTY_TOPIC);
                  }}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#374151]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                <tr>
                  <th className="px-2 py-2 font-semibold">Topic</th>
                  <th className="px-2 py-2 font-semibold">Description</th>
                  <th className="px-2 py-2 font-semibold">Subscribers</th>
                  <th className="px-2 py-2 font-semibold">Created</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedTopics.map((topic) => (
                  <tr key={topic.id} className="border-b border-[#F3F4F6]">
                    <td className="px-2 py-2.5">
                      <p className="font-semibold text-[#1A1A1A]">{topic.name}</p>
                      <p className="font-mono text-xs text-[#9CA3AF]">{topic.key}</p>
                    </td>
                    <td className="px-2 py-2.5 text-[#6B7280]">{topic.description || "—"}</td>
                    <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">
                      {topic.subscriberCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-[#6B7280]">{topic.createdAtLabel}</td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          topic.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {topic.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canManage}
                          className="text-xs font-semibold text-primary disabled:opacity-50"
                          onClick={() => {
                            setTopicForm({
                              id: topic.id,
                              key: topic.key,
                              name: topic.name,
                              description: topic.description || "",
                              isActive: topic.isActive,
                              subscriberCount: topic.subscriberCount,
                            });
                            setShowTopicForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          className="text-xs font-semibold text-rose-600 disabled:opacity-50"
                          onClick={() => void removeTopic(topic.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!pagedTopics.length ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-sm text-[#9CA3AF]">
                      No topics yet
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#6B7280]">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setTopicPage((p) => Math.max(1, p - 1))}
                className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setTopicPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="5. Recent Notifications" hint="Latest push deliveries from this tenant.">
            <ul className="space-y-3">
              {setup.recent.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1A1A1A]">{item.title}</p>
                    <p className="text-xs text-[#6B7280]">
                      {item.topicKey || "general"} · {item.recipientCount.toLocaleString()}{" "}
                      recipients · {item.createdAtLabel}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(item.status)}`}
                  >
                    {item.status === "DELIVERED"
                      ? "Delivered"
                      : item.status === "FAILED"
                        ? "Failed"
                        : item.status}
                  </span>
                </li>
              ))}
              {!setup.recent.length ? (
                <li className="py-6 text-center text-sm text-[#9CA3AF]">
                  <NotificationsNoneOutlined className="mb-1 !text-[28px] text-[#D1D5DB]" />
                  <p>No notifications sent yet</p>
                </li>
              ) : null}
            </ul>
          </Card>

          <Card title="6. Gateway Usage (This Month)" hint="Daily notifications and delivery summary.">
            <div className="mb-4 flex h-40 items-end gap-1">
              {setup.usage.daily.map((point) => (
                <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{
                      height: `${Math.max(4, Math.round((point.count / maxDaily) * 120))}px`,
                    }}
                    title={`Day ${point.day}: ${point.count}`}
                  />
                  {point.day % 5 === 0 || point.day === 1 ? (
                    <span className="text-[9px] text-[#9CA3AF]">{point.day}</span>
                  ) : (
                    <span className="h-3" />
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total Sent", value: setup.usage.totalSent },
                { label: "Delivered", value: setup.usage.delivered },
                { label: "Failed", value: setup.usage.failed },
                { label: "Pending", value: setup.usage.pending },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2"
                >
                  <p className="text-[11px] font-semibold text-[#9CA3AF]">{item.label}</p>
                  <p className="text-sm font-bold text-[#1A1A1A]">
                    {item.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
