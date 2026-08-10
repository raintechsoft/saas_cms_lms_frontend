import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  ContentCopyOutlined,
  DeleteOutline,
  EditOutlined,
  EmailOutlined,
  ErrorOutline,
  InfoOutlined,
  PieChartOutlined,
  SaveOutlined,
  ScienceOutlined,
  SpeedOutlined,
  StarBorderOutlined,
  StarOutlined,
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
  id: string;
  name: string;
  host: string;
  port: number;
  encryption: "NONE" | "STARTTLS" | "SSL";
  username: string;
  hasSecrets: boolean;
  fromEmail: string;
  fromName: string | null;
  replyToEmail: string | null;
  ccEmail: string | null;
  isActive: boolean;
  isDefault: boolean;
  balanceCredits: number;
  lastTestStatus: string | null;
  lastTestedAtLabel: string;
};

type Template = {
  id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  isDefault: boolean;
  isActive: boolean;
  updatedAtLabel: string;
};

type Activity = {
  id: string;
  toEmail: string;
  subject: string;
  bodyPreview: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  createdAtLabel: string;
};

type Setup = {
  gateways: Gateway[];
  editingGatewayId: string | null;
  templates: Template[];
  recentActivity: Activity[];
  usage: {
    breakdown: Array<{ key: string; label: string; count: number; percent: number }>;
  };
  stats: {
    activeGateway: string;
    isActive: boolean;
    isDefault: boolean;
    todaySent: number;
    monthlyUsage: number;
    emailBalance: number;
  };
};

type TabKey = "config" | "templates" | "logs" | "settings";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "config", label: "Gateway Configuration" },
  { key: "templates", label: "Email Templates" },
  { key: "logs", label: "Logs" },
  { key: "settings", label: "Settings" },
];

const PAGE_SIZE = 5;
const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const EMPTY_FORM = {
  id: "",
  name: "",
  host: "",
  port: 587,
  encryption: "STARTTLS" as const,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "",
  replyToEmail: "",
  ccEmail: "",
  isActive: true,
  isDefault: false,
  balanceCredits: 0,
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

export function EmailGatewayPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Email Gateway";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState<TabKey>("config");
  const [form, setForm] = useState(EMPTY_FORM);
  const [templateForm, setTemplateForm] = useState({
    id: "",
    name: "",
    type: "TRANSACTIONAL",
    subject: "",
    body: "",
    isDefault: false,
    isActive: true,
  });
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [page, setPage] = useState(1);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/email-gateway", accessToken);
      setSetup(data);
      const current =
        data.gateways.find((g) => g.id === data.editingGatewayId) ?? data.gateways[0];
      if (current) applyGateway(current);
      else setForm(EMPTY_FORM);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load email gateway");
    } finally {
      setLoading(false);
    }
  }

  function applyGateway(item: Gateway) {
    setForm({
      id: item.id,
      name: item.name,
      host: item.host,
      port: item.port,
      encryption: item.encryption,
      username: item.username,
      password: "",
      fromEmail: item.fromEmail,
      fromName: item.fromName ?? "",
      replyToEmail: item.replyToEmail ?? "",
      ccEmail: item.ccEmail ?? "",
      isActive: item.isActive,
      isDefault: item.isDefault,
      balanceCredits: item.balanceCredits,
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const templates = setup?.templates ?? [];
  const totalPages = Math.max(1, Math.ceil(templates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTemplates = templates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const gatewayPageSize = 5;
  const gatewayPages = Math.max(1, Math.ceil((setup?.gateways.length ?? 0) / gatewayPageSize));
  const [gatewayPage, setGatewayPage] = useState(1);
  const pagedGateways = (setup?.gateways ?? []).slice(
    (gatewayPage - 1) * gatewayPageSize,
    gatewayPage * gatewayPageSize,
  );

  const usagePercent = useMemo(() => {
    const first = setup?.usage.breakdown[0]?.percent ?? 0;
    const second = setup?.usage.breakdown[1]?.percent ?? 0;
    return Math.min(100, first + second);
  }, [setup]);

  async function saveGateway(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/email-gateway", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: form.id || undefined,
          name: form.name,
          host: form.host,
          port: form.port,
          encryption: form.encryption,
          username: form.username,
          password: form.password || undefined,
          fromEmail: form.fromEmail,
          fromName: form.fromName || null,
          replyToEmail: form.replyToEmail || null,
          ccEmail: form.ccEmail || null,
          isActive: form.isActive,
          isDefault: form.isDefault,
          balanceCredits: form.balanceCredits,
        }),
      });
      setSetup(data);
      const current =
        data.gateways.find((g) => g.id === (form.id || data.editingGatewayId)) ??
        data.gateways[0];
      if (current) applyGateway(current);
      notifySuccess("Email gateway saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save email gateway");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!accessToken || !canManage) return;
    setTesting(true);
    try {
      const data = await apiRequest<Setup>("/erp/email-gateway/test", accessToken, {
        method: "POST",
        body: JSON.stringify({ id: form.id || undefined }),
      });
      setSetup(data);
      const current = data.gateways.find((g) => g.id === form.id) ?? data.gateways[0];
      if (current) applyGateway(current);
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
      const data = await apiRequest<Setup>("/erp/email-gateway/templates", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: templateForm.id || undefined,
          ...templateForm,
        }),
      });
      setSetup(data);
      setShowTemplateForm(false);
      notifySuccess(templateForm.id ? "Template updated" : "Template created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading email gateway…</div>;
  }

  const stats = setup.stats;
  const testOk = form.id
    ? setup.gateways.find((g) => g.id === form.id)?.lastTestStatus === "SUCCESS"
    : false;
  const currentGateway = setup.gateways.find((g) => g.id === form.id);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Email Gateway</h1>
          <p className="text-xs text-[#6B7280]">
            Configure SMTP gateways, templates, and monitor email delivery.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => {
            setTab("config");
            setForm({
              ...EMPTY_FORM,
              name: "SMTP Backup",
              isDefault: false,
              isActive: true,
            });
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
            value={stats.activeGateway}
            hint={
              stats.isActive
                ? stats.isDefault
                  ? "Active · Default Gateway"
                  : "Active"
                : "Not configured"
            }
            tone="bg-violet-50"
            icon={<EmailOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Emails Sent Today"
            value={stats.todaySent.toLocaleString("en-IN")}
            hint="Successful deliveries"
            tone="bg-sky-50"
            icon={<TodayOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="This Month Usage"
            value={stats.monthlyUsage.toLocaleString("en-IN")}
            hint="Total emails sent"
            tone="bg-emerald-50"
            icon={<SpeedOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Email Balance"
            value={stats.emailBalance.toLocaleString("en-IN")}
            hint="Credits available"
            tone="bg-amber-50"
            icon={<AccountBalanceWalletOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white px-2 shadow-sm">
          <div className="flex min-w-max gap-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  "border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap",
                  tab === item.key
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "config" || tab === "settings" ? (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card
                title="Gateway Configuration"
                hint="SMTP credentials are encrypted at rest and never returned by the API."
              >
                <form onSubmit={(e) => void saveGateway(e)} className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel required>Gateway Name</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.name}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>Host</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.host}
                      disabled={!canManage}
                      placeholder="smtp.sendgrid.net"
                      onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>Port</FieldLabel>
                    <input
                      type="number"
                      className={inputClass}
                      value={form.port}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, port: Number(e.target.value) || 587 }))
                      }
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Encryption</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.encryption}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          encryption: e.target.value as "NONE" | "STARTTLS" | "SSL",
                        }))
                      }
                    >
                      <option value="STARTTLS">STARTTLS</option>
                      <option value="SSL">SSL</option>
                      <option value="NONE">None</option>
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel required>Username</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.username}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>
                      Password{" "}
                      {currentGateway?.hasSecrets ? "(leave blank to keep saved)" : ""}
                    </FieldLabel>
                    <input
                      type="password"
                      className={inputClass}
                      value={form.password}
                      disabled={!canManage}
                      placeholder={currentGateway?.hasSecrets ? "••••••••••••" : "SMTP password"}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>From Email</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.fromEmail}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, fromEmail: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>From Name</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.fromName}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Reply To Email</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.replyToEmail}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, replyToEmail: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>CC Email (Optional)</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.ccEmail}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, ccEmail: e.target.value }))}
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        disabled={!canManage}
                        onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                      />
                      Active
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={form.isDefault}
                        disabled={!canManage}
                        onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                      />
                      Set as Default Gateway
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <button
                      type="button"
                      disabled={!canManage || testing || !form.id}
                      onClick={() => void testConnection()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                    >
                      <ScienceOutlined className="!text-[18px]" />
                      {testing ? "Testing…" : "Test Connection"}
                    </button>
                    {currentGateway?.lastTestStatus ? (
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
                        {currentGateway.lastTestedAtLabel !== "—"
                          ? ` · ${currentGateway.lastTestedAtLabel}`
                          : ""}
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
                <Card title="Usage Summary" hint="This month">
                  <div className="flex items-center gap-4">
                    <div className="relative grid size-28 place-items-center">
                      <svg viewBox="0 0 36 36" className="size-28 -rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="4"
                        />
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
                    <p className="text-sm text-[#6B7280]">No email activity yet.</p>
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
                            <p className="truncate text-sm font-semibold">{item.toEmail}</p>
                            <p className="truncate text-xs text-[#6B7280]">{item.subject}</p>
                            <p className="text-[11px] text-[#9CA3AF]">{item.createdAtLabel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            <Card title="Configured Gateways">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Gateway Name</th>
                      <th className="px-3 py-2">Host</th>
                      <th className="px-3 py-2">From Email</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Default</th>
                      <th className="px-3 py-2">Last Tested</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedGateways.map((item, index) => (
                      <tr key={item.id} className="border-t border-[#F3F4F6]">
                        <td className="px-3 py-2.5 text-[#6B7280]">
                          {(gatewayPage - 1) * gatewayPageSize + index + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">{item.name}</span>
                            {item.isDefault ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Default
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{item.host}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{item.fromEmail}</td>
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
                          {item.isDefault ? (
                            <StarOutlined className="!text-[18px] text-amber-500" />
                          ) : (
                            <StarBorderOutlined className="!text-[18px] text-[#D1D5DB]" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{item.lastTestedAtLabel}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canManage}
                              className="rounded p-1 text-violet-600 hover:bg-violet-50"
                              onClick={() => {
                                applyGateway(item);
                                setTab("config");
                              }}
                            >
                              <EditOutlined className="!text-[18px]" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage}
                              className="rounded p-1 text-sky-600 hover:bg-sky-50"
                              onClick={() =>
                                void (async () => {
                                  if (!accessToken) return;
                                  try {
                                    const data = await apiRequest<Setup>(
                                      `/erp/email-gateway/${item.id}/clone`,
                                      accessToken,
                                      { method: "POST", body: JSON.stringify({}) },
                                    );
                                    setSetup(data);
                                    notifySuccess("Gateway duplicated");
                                  } catch (cause) {
                                    notifyError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "Unable to duplicate gateway",
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
                              className="rounded p-1 text-rose-600 hover:bg-rose-50"
                              onClick={() =>
                                void (async () => {
                                  if (!accessToken) return;
                                  const ok = await confirmDelete(
                                    `Delete gateway "${item.name}"?`,
                                  );
                                  if (!ok) return;
                                  try {
                                    const data = await apiRequest<Setup>(
                                      `/erp/email-gateway/${item.id}`,
                                      accessToken,
                                      { method: "DELETE" },
                                    );
                                    setSetup(data);
                                    const next =
                                      data.gateways.find((g) => g.id === data.editingGatewayId) ??
                                      data.gateways[0];
                                    if (next) applyGateway(next);
                                    else setForm(EMPTY_FORM);
                                    notifySuccess("Gateway deleted");
                                  } catch (cause) {
                                    notifyError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "Unable to delete gateway",
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
              <div className="mt-4 flex justify-end gap-1">
                <button
                  type="button"
                  disabled={gatewayPage <= 1}
                  onClick={() => setGatewayPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(gatewayPages, 5) }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGatewayPage(num)}
                    className={[
                      "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                      num === gatewayPage
                        ? "bg-primary text-white"
                        : "border border-[#E5E7EB]",
                    ].join(" ")}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={gatewayPage >= gatewayPages}
                  onClick={() => setGatewayPage((p) => Math.min(gatewayPages, p + 1))}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </Card>
          </>
        ) : null}

        {tab === "templates" ? (
          <Card
            title="Email Templates"
            actions={
              <button
                type="button"
                disabled={!canManage}
                onClick={() => {
                  setTemplateForm({
                    id: "",
                    name: "",
                    type: "TRANSACTIONAL",
                    subject: "",
                    body: "",
                    isDefault: false,
                    isActive: true,
                  });
                  setShowTemplateForm(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
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
                  <FieldLabel required>Name</FieldLabel>
                  <input
                    className={inputClass}
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Type</FieldLabel>
                  <select
                    className={inputClass}
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, type: e.target.value }))}
                  >
                    <option value="TRANSACTIONAL">Transactional</option>
                    <option value="PROMOTIONAL">Promotional</option>
                    <option value="SYSTEM">System</option>
                    <option value="GENERAL">General</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel required>Subject</FieldLabel>
                  <input
                    className={inputClass}
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, subject: e.target.value }))}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel required>Body</FieldLabel>
                  <textarea
                    rows={4}
                    className={inputClass}
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, body: e.target.value }))}
                  />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                    onClick={() => setShowTemplateForm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
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
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTemplates.map((item, index) => (
                    <tr key={item.id} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2.5">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className="px-3 py-2.5 font-semibold">{item.name}</td>
                      <td className="px-3 py-2.5">{item.type}</td>
                      <td className="max-w-xs truncate px-3 py-2.5 text-[#6B7280]">
                        {item.subject}
                      </td>
                      <td className="px-3 py-2.5 text-[#6B7280]">{item.updatedAtLabel}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded p-1 text-violet-600 hover:bg-violet-50"
                            onClick={() => {
                              setTemplateForm({
                                id: item.id,
                                name: item.name,
                                type: item.type,
                                subject: item.subject,
                                body: item.body,
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
                            className="rounded p-1 text-rose-600 hover:bg-rose-50"
                            onClick={() =>
                              void (async () => {
                                if (!accessToken) return;
                                const ok = await confirmDelete(`Delete "${item.name}"?`);
                                if (!ok) return;
                                try {
                                  const data = await apiRequest<Setup>(
                                    `/erp/email-gateway/templates/${item.id}`,
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
            <div className="mt-4 flex justify-end gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={[
                    "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                    num === currentPage ? "bg-primary text-white" : "border border-[#E5E7EB]",
                  ].join(" ")}
                >
                  {num}
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        {tab === "logs" ? (
          <Card title="Delivery Logs">
            {setup.recentActivity.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No delivery logs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.recentActivity.map((item) => (
                      <tr key={item.id} className="border-t border-[#F3F4F6]">
                        <td className="px-3 py-2.5 font-semibold">{item.toEmail}</td>
                        <td className="px-3 py-2.5 text-[#6B7280]">{item.subject}</td>
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
        ) : null}

        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#5B21B6]">
            <InfoOutlined className="!text-[18px]" />
            About Email Gateway
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#5B21B6]">
            <li>Configure one or more SMTP gateways and mark one as default for outbound mail.</li>
            <li>Use Test Connection to verify host, port, encryption, and credentials.</li>
            <li>Create reusable templates with placeholders for fee, attendance, and notices.</li>
            <li>Delivery logs update as reminders and system emails are sent.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
