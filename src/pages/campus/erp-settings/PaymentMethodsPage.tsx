import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  CreditCardOutlined,
  DeleteOutline,
  EditOutlined,
  HistoryOutlined,
  InfoOutlined,
  PaymentsOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Method = {
  id: string;
  code: string;
  name: string;
  displayName: string;
  description: string;
  methodType: "ONLINE" | "OFFLINE";
  provider: string;
  logoUrl: string;
  modes: {
    cards: boolean;
    upi: boolean;
    netbanking: boolean;
    wallets: boolean;
    emi: boolean;
  };
  enableForFees: boolean;
  enableForAdmission: boolean;
  enableForMisc: boolean;
  enableForRefunds: boolean;
  showInPortal: boolean;
  instructions: string;
  isActive: boolean;
  sortOrder: number;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasWebhookSecret: boolean;
  index: number;
};

type Setup = {
  stats: {
    totalMethods: number;
    activeMethods: number;
    onlineTransactions: number;
    onlineAmountLabel: string;
    offlineCollections: number;
    offlineAmountLabel: string;
    refunds: number;
    refundAmountLabel: string;
  };
  providers: Array<{ key: string; label: string }>;
  methods: Method[];
  recentTransactions: Array<{
    index: number;
    name: string;
    transactions: number;
    amountLabel: string;
  }>;
  refundSettings: {
    allowPartialRefunds: boolean;
    requireApproval: boolean;
    autoRefundFailedOrders: boolean;
    refundWindowDays: number;
  };
  transactionCharges: {
    absorbGatewayFees: boolean;
    passToPayer: boolean;
    flatFeePaise: number;
    percentFee: number;
  };
};

const PAGE_SIZE = 6;

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const EMPTY_FORM = {
  name: "",
  displayName: "",
  description: "",
  methodType: "ONLINE" as "ONLINE" | "OFFLINE",
  provider: "razorpay",
  logoUrl: "",
  instructions: "",
  isActive: true,
  sortOrder: 1,
  modes: { cards: true, upi: true, netbanking: true, wallets: true, emi: false },
  enableForFees: true,
  enableForAdmission: true,
  enableForMisc: true,
  enableForRefunds: true,
  showInPortal: true,
  apiKey: "",
  apiSecret: "",
  webhookSecret: "",
};

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

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

export function PaymentMethodsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Payment Methods";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<
    "methods" | "charges" | "refunds" | "accounts" | "logs"
  >("methods");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/payment-methods/setup", accessToken);
      setSetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load payment methods");
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
    return (setup?.methods ?? []).filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.methodType.toLowerCase().includes(q)
      );
    });
  }, [setup, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: (setup?.methods.length ?? 0) + 1 });
    setShowForm(true);
  }

  function editMethod(method: Method) {
    setEditingId(method.id);
    setForm({
      name: method.name,
      displayName: method.displayName,
      description: method.description,
      methodType: method.methodType,
      provider: method.provider,
      logoUrl: method.logoUrl,
      instructions: method.instructions,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
      modes: { ...method.modes },
      enableForFees: method.enableForFees,
      enableForAdmission: method.enableForAdmission,
      enableForMisc: method.enableForMisc,
      enableForRefunds: method.enableForRefunds,
      showInPortal: method.showInPortal,
      apiKey: "",
      apiSecret: "",
      webhookSecret: "",
    });
    setShowForm(true);
  }

  async function saveMethod(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/payment-methods/setup", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: editingId || undefined,
          ...form,
          apiKey: form.apiKey.trim() || undefined,
          apiSecret: form.apiSecret.trim() || undefined,
          webhookSecret: form.webhookSecret.trim() || undefined,
        }),
      });
      setSetup(data);
      setForm((prev) => ({ ...prev, apiKey: "", apiSecret: "", webhookSecret: "" }));
      notifySuccess(editingId ? "Payment method updated" : "Payment method added");
      if (!editingId) resetForm();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save payment method");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMethod(id: string, isActive?: boolean) {
    if (!accessToken || !canManage) return;
    try {
      const data = await apiRequest<Setup>(`/erp/payment-methods/${id}/toggle`, accessToken, {
        method: "POST",
        body: JSON.stringify({ isActive }),
      });
      setSetup(data);
      if (editingId === id) {
        const updated = data.methods.find((m) => m.id === id);
        if (updated) setForm((prev) => ({ ...prev, isActive: updated.isActive }));
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update status");
    }
  }

  async function removeMethod(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this payment method?")) return;
    try {
      const data = await apiRequest<Setup>(`/erp/payment-methods/setup/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      if (editingId === id) resetForm();
      notifySuccess("Payment method deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete payment method");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading payment methods…</div>;
  }

  const stats = setup.stats;
  const editingMethod = editingId ? setup.methods.find((m) => m.id === editingId) : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Payment Methods</h1>
          <p className="text-xs text-[#6B7280]">
            Configure and manage payment gateways and offline payment methods for fee collection and
            other transactions.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={resetForm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Add Payment Method
        </button>
      </div>

      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 sm:px-5">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              ["methods", "Payment Methods"],
              ["charges", "Transaction Charges"],
              ["refunds", "Refund Settings"],
              ["accounts", "Payment Accounts"],
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
                  : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Methods"
            value={stats.totalMethods}
            hint="Configured gateways & offline"
            tone="bg-violet-50"
            icon={<CreditCardOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Active Methods"
            value={stats.activeMethods}
            hint="Available for collection"
            tone="bg-emerald-50"
            icon={<CheckCircleOutline className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Online Transactions"
            value={stats.onlineTransactions.toLocaleString()}
            hint={stats.onlineAmountLabel}
            tone="bg-sky-50"
            icon={<ShoppingCartOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Offline Collections"
            value={stats.offlineCollections.toLocaleString()}
            hint={stats.offlineAmountLabel}
            tone="bg-amber-50"
            icon={<PaymentsOutlined className="!text-[20px] text-amber-600" />}
          />
          <StatCard
            label="Refunds"
            value={stats.refunds.toLocaleString()}
            hint={stats.refundAmountLabel}
            tone="bg-rose-50"
            icon={<HistoryOutlined className="!text-[20px] text-rose-600" />}
          />
        </div>

        {tab === "methods" ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {showForm ? (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                  <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">
                    {editingId ? "Edit Payment Method" : "Add Payment Method"}
                  </h2>
                  <form onSubmit={(e) => void saveMethod(e)} className="space-y-4">
                    <div>
                      <FieldLabel>Method Type</FieldLabel>
                      <div className="flex flex-wrap gap-4 text-sm">
                        {(
                          [
                            ["ONLINE", "Online Gateway"],
                            ["OFFLINE", "Offline Method"],
                          ] as const
                        ).map(([value, label]) => (
                          <label key={value} className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name="methodType"
                              disabled={!canManage}
                              checked={form.methodType === value}
                              onChange={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  methodType: value,
                                  provider:
                                    value === "ONLINE"
                                      ? prev.provider === "offline"
                                        ? "razorpay"
                                        : prev.provider
                                      : "offline",
                                }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <FieldLabel>Name</FieldLabel>
                        <input
                          className={inputClass}
                          required
                          disabled={!canManage}
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <FieldLabel>Display Name</FieldLabel>
                        <input
                          className={inputClass}
                          disabled={!canManage}
                          value={form.displayName}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, displayName: e.target.value }))
                          }
                        />
                      </label>
                    </div>

                    <label className="block">
                      <FieldLabel>Description</FieldLabel>
                      <textarea
                        className={inputClass + " min-h-[72px]"}
                        disabled={!canManage}
                        value={form.description}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                    </label>

                    {form.methodType === "ONLINE" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <FieldLabel>Provider</FieldLabel>
                          <select
                            className={inputClass}
                            disabled={!canManage}
                            value={form.provider}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, provider: e.target.value }))
                            }
                          >
                            {setup.providers
                              .filter((p) => p.key !== "offline")
                              .map((p) => (
                                <option key={p.key} value={p.key}>
                                  {p.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="block">
                          <FieldLabel>API Key</FieldLabel>
                          <div className="relative">
                            <input
                              type={showApiKey ? "text" : "password"}
                              className={inputClass}
                              disabled={!canManage}
                              value={form.apiKey}
                              placeholder={
                                editingMethod?.hasApiKey ? "••••••••••••••••" : "rzp_live_..."
                              }
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, apiKey: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                              onClick={() => setShowApiKey((v) => !v)}
                            >
                              {showApiKey ? (
                                <VisibilityOffOutlined className="!text-[18px]" />
                              ) : (
                                <VisibilityOutlined className="!text-[18px]" />
                              )}
                            </button>
                          </div>
                        </label>
                        <label className="block">
                          <FieldLabel>API Secret</FieldLabel>
                          <div className="relative">
                            <input
                              type={showApiSecret ? "text" : "password"}
                              className={inputClass}
                              disabled={!canManage}
                              value={form.apiSecret}
                              placeholder={
                                editingMethod?.hasApiSecret ? "••••••••••••••••" : "Enter secret"
                              }
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, apiSecret: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                              onClick={() => setShowApiSecret((v) => !v)}
                            >
                              {showApiSecret ? (
                                <VisibilityOffOutlined className="!text-[18px]" />
                              ) : (
                                <VisibilityOutlined className="!text-[18px]" />
                              )}
                            </button>
                          </div>
                        </label>
                        <label className="block">
                          <FieldLabel>Webhook Secret</FieldLabel>
                          <div className="relative">
                            <input
                              type={showWebhook ? "text" : "password"}
                              className={inputClass}
                              disabled={!canManage}
                              value={form.webhookSecret}
                              placeholder={
                                editingMethod?.hasWebhookSecret
                                  ? "••••••••••••••••"
                                  : "whsec_..."
                              }
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                              onClick={() => setShowWebhook((v) => !v)}
                            >
                              {showWebhook ? (
                                <VisibilityOffOutlined className="!text-[18px]" />
                              ) : (
                                <VisibilityOutlined className="!text-[18px]" />
                              )}
                            </button>
                          </div>
                        </label>
                      </div>
                    ) : null}

                    {form.methodType === "ONLINE" ? (
                      <div>
                        <FieldLabel>Payment Modes</FieldLabel>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {(
                            [
                              ["cards", "Cards"],
                              ["upi", "UPI"],
                              ["netbanking", "Net Banking"],
                              ["wallets", "Wallets"],
                              ["emi", "EMI"],
                            ] as const
                          ).map(([key, label]) => (
                            <label key={key} className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={!canManage}
                                checked={form.modes[key]}
                                onChange={(e) =>
                                  setForm((prev) => ({
                                    ...prev,
                                    modes: { ...prev.modes, [key]: e.target.checked },
                                  }))
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-3">
                      <p className="text-xs font-semibold text-[#6B7280]">Logo</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="flex h-12 w-28 items-center justify-center rounded bg-white text-xs font-bold text-primary shadow-sm">
                          {form.name || "Logo"}
                        </div>
                        <div>
                          <input
                            className={inputClass}
                            disabled={!canManage}
                            placeholder="Logo URL (optional)"
                            value={form.logoUrl}
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, logoUrl: e.target.value }))
                            }
                          />
                          <p className="mt-1 text-[11px] text-[#9CA3AF]">
                            Recommended size: 200 x 80px
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Additional Settings</FieldLabel>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        {(
                          [
                            ["enableForFees", "Enable for Fee Payments"],
                            ["enableForAdmission", "Enable for Online Admission"],
                            ["enableForMisc", "Enable for Miscellaneous Payments"],
                            ["enableForRefunds", "Enable for Refunds"],
                            ["showInPortal", "Show in Portal / Mobile App"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={!canManage}
                              checked={form[key]}
                              onChange={(e) =>
                                setForm((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="block">
                      <FieldLabel>Instructions for Users (Optional)</FieldLabel>
                      <textarea
                        className={inputClass + " min-h-[72px]"}
                        disabled={!canManage}
                        value={form.instructions}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, instructions: e.target.value }))
                        }
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <span className="font-semibold text-[#6B7280]">Status</span>
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() =>
                            setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${
                            form.isActive ? "bg-primary" : "bg-[#D1D5DB]"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                              form.isActive ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        <span className="text-[#374151]">
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <span className="font-semibold text-[#6B7280]">Sort Order</span>
                        <input
                          type="number"
                          min={0}
                          className="w-20 rounded-lg border border-[#E5E7EB] px-2 py-1"
                          disabled={!canManage}
                          value={form.sortOrder}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              sortOrder: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingId(null);
                        }}
                        className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!canManage || saving}
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save Method"}
                      </button>
                    </div>
                  </form>
                </section>
              ) : (
                <section className="flex items-center justify-center rounded-xl border border-dashed border-[#E5E7EB] bg-white p-8 text-sm text-[#9CA3AF]">
                  Select a method to edit, or click Add Payment Method.
                </section>
              )}

              <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
                  <h2 className="text-sm font-bold text-[#1A1A1A]">Payment Methods List</h2>
                  <div className="relative">
                    <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      className={`${inputClass} w-44 pl-8`}
                      placeholder="Search methods..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">#</th>
                        <th className="px-3 py-2.5 font-semibold">Method Name</th>
                        <th className="px-3 py-2.5 font-semibold">Type</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-3 py-2.5 font-semibold">Sort</th>
                        <th className="px-3 py-2.5 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((method, idx) => (
                        <tr key={method.id} className="border-b border-[#F3F4F6]">
                          <td className="px-3 py-3 text-[#9CA3AF]">
                            {(currentPage - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-[#1A1A1A]">{method.name}</p>
                            <p className="text-xs text-[#9CA3AF]">{method.displayName}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                method.methodType === "ONLINE"
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {method.methodType === "ONLINE" ? "Online" : "Offline"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                method.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {method.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[#6B7280]">{method.sortOrder}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!canManage}
                                className="rounded p-1 text-primary hover:bg-[#F3F4F6] disabled:opacity-50"
                                onClick={() => editMethod(method)}
                              >
                                <EditOutlined className="!text-[18px]" />
                              </button>
                              <button
                                type="button"
                                disabled={!canManage}
                                className="rounded p-1 text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-50"
                                onClick={() => void toggleMethod(method.id)}
                                title="Toggle active"
                              >
                                {method.isActive ? (
                                  <VisibilityOutlined className="!text-[18px]" />
                                ) : (
                                  <VisibilityOffOutlined className="!text-[18px]" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={!canManage}
                                className="rounded p-1 text-rose-600 hover:bg-[#F3F4F6] disabled:opacity-50"
                                onClick={() => void removeMethod(method.id)}
                              >
                                <DeleteOutline className="!text-[18px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!paged.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-sm text-[#9CA3AF]">
                            No payment methods found
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-1 px-3 py-3">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-7 w-7 rounded text-xs font-semibold ${
                        currentPage === n
                          ? "bg-primary text-white"
                          : "border border-[#E5E7EB] text-[#374151]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#4C1D95]">
                  <InfoOutlined className="!text-[18px]" />
                  About Payment Methods
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[#5B21B6]">
                  <li>Configure online gateways like Razorpay, PhonePe, and Paytm.</li>
                  <li>Add offline methods such as Cash, Cheque, UPI QR, and Bank Transfer.</li>
                  <li>Control portal visibility and which modules can use each method.</li>
                  <li>Store API credentials securely and toggle methods without deleting them.</li>
                </ul>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1A1A1A]">
                    Recent Transactions (This Month)
                  </h2>
                  <button type="button" className="text-xs font-semibold text-primary">
                    View All
                  </button>
                </div>
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-[#9CA3AF]">
                    <tr>
                      <th className="py-1 font-semibold">#</th>
                      <th className="py-1 font-semibold">Payment Method</th>
                      <th className="py-1 font-semibold">Transactions</th>
                      <th className="py-1 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.recentTransactions.map((row) => (
                      <tr key={row.name} className="border-t border-[#F3F4F6]">
                        <td className="py-2 text-[#9CA3AF]">{row.index}</td>
                        <td className="py-2 font-semibold text-[#1A1A1A]">{row.name}</td>
                        <td className="py-2 text-[#6B7280]">{row.transactions.toLocaleString()}</td>
                        <td className="py-2 font-semibold text-[#1A1A1A]">{row.amountLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        ) : null}

        {tab === "charges" ? (
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Transaction Charges</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Decide whether gateway fees are absorbed by the school or passed to the payer.
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={setup.transactionCharges.absorbGatewayFees} readOnly />
                Absorb gateway fees (school pays)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={setup.transactionCharges.passToPayer} readOnly />
                Pass convenience fee to payer
              </label>
              <p className="text-xs text-[#9CA3AF]">
                Flat fee: ₹{(setup.transactionCharges.flatFeePaise / 100).toFixed(2)} · Percent fee:{" "}
                {setup.transactionCharges.percentFee}%
              </p>
            </div>
          </section>
        ) : null}

        {tab === "refunds" ? (
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Refund Settings</h2>
            <div className="mt-4 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={setup.refundSettings.allowPartialRefunds} readOnly />
                Allow partial refunds
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={setup.refundSettings.requireApproval} readOnly />
                Require approval before refund
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={setup.refundSettings.autoRefundFailedOrders}
                  readOnly
                />
                Auto-refund failed online orders
              </label>
              <p className="text-xs text-[#9CA3AF]">
                Refund window: {setup.refundSettings.refundWindowDays} days
              </p>
            </div>
          </section>
        ) : null}

        {tab === "accounts" ? (
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Payment Accounts</h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Settlement accounts for online gateways will appear here once linked. Configure gateway
              credentials under Payment Methods first.
            </p>
          </section>
        ) : null}

        {tab === "logs" ? (
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Payment Logs</h2>
            <p className="mt-2 text-sm text-[#6B7280]">
              Gateway webhooks, failed charges, and refund events will be listed here. Use fee
              reports for full receipt-level history.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
