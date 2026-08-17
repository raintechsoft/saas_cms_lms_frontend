import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CalendarMonthOutlined,
  CurrencyRupeeOutlined,
  DeleteOutline,
  EditOutlined,
  GroupsOutlined,
  InfoOutlined,
  PaymentsOutlined,
  SaveOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  payrollFrequency: string;
  financialYear: string;
  payDay: number;
  paymentMethod: string;
  salaryCalculationMethod: string;
  roundingOff: string;
  incomeTaxCalculation: string;
  arrearCalculation: boolean;
  autoRecalculate: boolean;
  generatePayslip: boolean;
  emailPayslip: boolean;
  lockPayrollAfterApproval: boolean;
  pfScheme: string;
  esiApplicability: string;
  epfNumber: string | null;
  esiNumber: string | null;
  professionalTax: string;
  labourWelfareFund: string;
  payStructure: string;
  allowNegativeSalary: boolean;
  minimumPayLimit: number;
  maximumPayLimit: number;
  overtimeCalculation: string;
  leaveEncashment: string;
  preparedByRole: string;
  reviewedByRole: string;
  approvedByRole: string;
};

type Component = {
  id: string;
  name: string;
  shortCode: string | null;
  type: "EARNING" | "DEDUCTION";
  taxable: boolean;
  isActive: boolean;
  defaultAmount: number;
};

type HistoryRow = {
  id: string;
  payrollMonth: string;
  payrollPeriod: string;
  employees: number;
  grossAmount: number;
  netAmount: number;
  status: string;
  processedBy: string;
  processedOn: string;
};

type Summary = {
  totalEmployees: number;
  payrollFrequency: string;
  nextPayrollRun: string;
  nextPayrollFor: string;
  lastPayrollRun: string | null;
  lastPayrollFor: string | null;
};

type Setup = {
  settings: Settings;
  components: Component[];
  summary: Summary;
  history: HistoryRow[];
};

const DEFAULT_SETTINGS: Settings = {
  payrollFrequency: "MONTHLY",
  financialYear: "2026-2027",
  payDay: 31,
  paymentMethod: "BANK_TRANSFER",
  salaryCalculationMethod: "CALENDAR_DAYS",
  roundingOff: "NEAREST_RUPEE",
  incomeTaxCalculation: "NEW_REGIME",
  arrearCalculation: true,
  autoRecalculate: true,
  generatePayslip: true,
  emailPayslip: false,
  lockPayrollAfterApproval: true,
  pfScheme: "12_BOTH",
  esiApplicability: "APPLICABLE",
  epfNumber: "",
  esiNumber: "",
  professionalTax: "STATE_RULES",
  labourWelfareFund: "NOT_APPLICABLE",
  payStructure: "DEFAULT",
  allowNegativeSalary: false,
  minimumPayLimit: 5000,
  maximumPayLimit: 500000,
  overtimeCalculation: "HOURLY_RATE",
  leaveEncashment: "YEAR_END",
  preparedByRole: "HR Manager",
  reviewedByRole: "Accounts Manager",
  approvedByRole: "Finance Head",
};

const EMPTY_COMPONENT = {
  name: "",
  shortCode: "",
  type: "EARNING" as "EARNING" | "DEDUCTION",
  taxable: true,
  isActive: true,
  defaultAmount: "0",
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Card({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
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

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5">
      <span className="text-sm font-medium text-[#1A1A1A]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-primary" : "bg-[#D1D5DB]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs text-[#1E40AF]">
      <InfoOutlined className="!text-[16px] shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function frequencyLabel(value: string) {
  switch (value) {
    case "WEEKLY":
      return "Weekly";
    case "BIWEEKLY":
      return "Bi-Weekly";
    default:
      return "Monthly";
  }
}

export function PayrollSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Payroll Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["hr.manage", "payroll.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [components, setComponents] = useState<Component[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [componentForm, setComponentForm] = useState(EMPTY_COMPONENT);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/payroll-settings", accessToken);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data.settings,
        epfNumber: data.settings.epfNumber ?? "",
        esiNumber: data.settings.esiNumber ?? "",
      });
      setComponents(data.components ?? []);
      setSummary(data.summary);
      setHistory(data.history ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load payroll settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const visibleComponents = useMemo(
    () => components.filter((item) => item.type === tab),
    [components, tab],
  );

  async function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Settings>("/erp/payroll-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          epfNumber: settings.epfNumber || null,
          esiNumber: settings.esiNumber || null,
          minimumPayLimit: Number(settings.minimumPayLimit),
          maximumPayLimit: Number(settings.maximumPayLimit),
          payDay: Number(settings.payDay),
        }),
      });
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        epfNumber: data.epfNumber ?? "",
        esiNumber: data.esiNumber ?? "",
      });
      notifySuccess("Payroll configuration saved");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save configuration");
    } finally {
      setSaving(false);
    }
  }

  function openAddComponent() {
    setEditingId(null);
    setComponentForm({ ...EMPTY_COMPONENT, type: tab, taxable: tab === "EARNING" });
    setShowComponentForm(true);
  }

  function openEditComponent(item: Component) {
    setEditingId(item.id);
    setComponentForm({
      name: item.name,
      shortCode: item.shortCode ?? "",
      type: item.type,
      taxable: item.taxable,
      isActive: item.isActive,
      defaultAmount: String(item.defaultAmount ?? 0),
    });
    setTab(item.type);
    setShowComponentForm(true);
  }

  async function saveComponent(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    const name = componentForm.name.trim();
    if (!name) {
      notifyError("Component name is required");
      return;
    }
    try {
      const body = {
        name,
        shortCode: componentForm.shortCode.trim() || null,
        type: componentForm.type,
        taxable: componentForm.taxable,
        isActive: componentForm.isActive,
        defaultAmount: Number(componentForm.defaultAmount) || 0,
      };
      if (editingId) {
        await apiRequest(`/erp/payroll-components/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Component updated");
      } else {
        await apiRequest("/erp/payroll-components", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Component added");
      }
      setShowComponentForm(false);
      setEditingId(null);
      setComponentForm(EMPTY_COMPONENT);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save component");
    }
  }

  async function removeComponent(item: Component) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete "${item.name}"?` });
    if (!ok) return;
    try {
      await apiRequest(`/erp/payroll-components/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Component deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete component");
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading payroll settings…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Payroll Settings</h1>
          <p className="text-xs text-[#6B7280]">
            Configure payroll structure, components, rules and preferences.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage || saving}
          onClick={() => void saveSettings()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <SaveOutlined className="!text-[18px]" />
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Employees",
              value: String(summary?.totalEmployees ?? 0),
              hint: "Active Employees",
              icon: <GroupsOutlined className="!text-[20px] text-violet-600" />,
              tone: "bg-violet-50",
            },
            {
              label: "Payroll Frequency",
              value: frequencyLabel(summary?.payrollFrequency ?? settings.payrollFrequency),
              hint: "Current Payroll Cycle",
              icon: <PaymentsOutlined className="!text-[20px] text-emerald-600" />,
              tone: "bg-emerald-50",
            },
            {
              label: "Next Payroll Run",
              value: formatDate(summary?.nextPayrollRun),
              hint: summary?.nextPayrollFor ? `For ${summary.nextPayrollFor}` : "Upcoming cycle",
              icon: <CalendarMonthOutlined className="!text-[20px] text-orange-500" />,
              tone: "bg-orange-50",
            },
            {
              label: "Last Payroll Run",
              value: formatDate(summary?.lastPayrollRun),
              hint: summary?.lastPayrollFor ? `For ${summary.lastPayrollFor}` : "No runs yet",
              icon: <CurrencyRupeeOutlined className="!text-[20px] text-sky-600" />,
              tone: "bg-sky-50",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
            >
              <div className={`rounded-lg p-2 ${card.tone}`}>{card.icon}</div>
              <div>
                <p className="text-xs font-semibold text-[#6B7280]">{card.label}</p>
                <p className="text-base font-bold text-[#1A1A1A]">{card.value}</p>
                <p className="text-xs text-[#9CA3AF]">{card.hint}</p>
              </div>
            </div>
          ))}
        </div>

        <Card
          title="1. Salary Components"
          hint="Manage earnings and deductions used in payroll calculation."
          actions={
            <button
              type="button"
              disabled={!canManage}
              onClick={openAddComponent}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <AddOutlined className="!text-[16px]" />
              Add Component
            </button>
          }
        >
          <div className="mb-3 flex gap-2 border-b border-[#E5E7EB]">
            {(
              [
                ["EARNING", "Earnings"],
                ["DEDUCTION", "Deductions"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={[
                  "border-b-2 px-3 py-2 text-sm font-semibold transition",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {showComponentForm ? (
            <form
              onSubmit={(event) => void saveComponent(event)}
              className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label>
                <FieldLabel>Component Name</FieldLabel>
                <input
                  className={inputClass}
                  value={componentForm.name}
                  disabled={!canManage}
                  onChange={(e) => setComponentForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label>
                <FieldLabel>Short Code</FieldLabel>
                <input
                  className={inputClass}
                  value={componentForm.shortCode}
                  disabled={!canManage}
                  onChange={(e) => setComponentForm((p) => ({ ...p, shortCode: e.target.value }))}
                />
              </label>
              <label>
                <FieldLabel>Type</FieldLabel>
                <select
                  className={inputClass}
                  value={componentForm.type}
                  disabled={!canManage}
                  onChange={(e) =>
                    setComponentForm((p) => ({
                      ...p,
                      type: e.target.value as "EARNING" | "DEDUCTION",
                    }))
                  }
                >
                  <option value="EARNING">Earning</option>
                  <option value="DEDUCTION">Deduction</option>
                </select>
              </label>
              <label>
                <FieldLabel>Taxable</FieldLabel>
                <select
                  className={inputClass}
                  value={componentForm.taxable ? "YES" : "NO"}
                  disabled={!canManage}
                  onChange={(e) =>
                    setComponentForm((p) => ({ ...p, taxable: e.target.value === "YES" }))
                  }
                >
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              </label>
              <label>
                <FieldLabel>Status</FieldLabel>
                <select
                  className={inputClass}
                  value={componentForm.isActive ? "ACTIVE" : "INACTIVE"}
                  disabled={!canManage}
                  onChange={(e) =>
                    setComponentForm((p) => ({ ...p, isActive: e.target.value === "ACTIVE" }))
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <label>
                <FieldLabel>Default Amount</FieldLabel>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={componentForm.defaultAmount}
                  disabled={!canManage}
                  onChange={(e) =>
                    setComponentForm((p) => ({ ...p, defaultAmount: e.target.value }))
                  }
                />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  disabled={!canManage}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {editingId ? "Update Component" : "Save Component"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowComponentForm(false);
                    setEditingId(null);
                  }}
                  className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Component Name</th>
                  <th className="px-3 py-2 font-semibold">Short Code</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Taxable</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleComponents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-[#6B7280]">
                      No {tab === "EARNING" ? "earnings" : "deductions"} configured yet.
                    </td>
                  </tr>
                ) : (
                  visibleComponents.map((item, index) => (
                    <tr key={item.id} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2.5 text-[#6B7280]">{index + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A1A]">{item.name}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{item.shortCode || "—"}</td>
                      <td className="px-3 py-2.5 text-[#374151]">
                        {item.type === "EARNING" ? "Earning" : "Deduction"}
                      </td>
                      <td className="px-3 py-2.5 text-[#374151]">{item.taxable ? "Yes" : "No"}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600",
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
                            onClick={() => openEditComponent(item)}
                            className="rounded p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                          >
                            <EditOutlined className="!text-[18px]" />
                          </button>
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => void removeComponent(item)}
                            className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                          >
                            <DeleteOutline className="!text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <form onSubmit={(event) => void saveSettings(event)} className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="2. Payroll Preferences" hint="Set how payroll is processed every cycle.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>Payroll Frequency</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.payrollFrequency}
                    disabled={!canManage}
                    onChange={(e) => patch("payrollFrequency", e.target.value)}
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="BIWEEKLY">Bi-Weekly</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Financial Year</FieldLabel>
                  <input
                    className={inputClass}
                    value={settings.financialYear}
                    disabled={!canManage}
                    onChange={(e) => patch("financialYear", e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel>Pay Day</FieldLabel>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={inputClass}
                    value={settings.payDay}
                    disabled={!canManage}
                    onChange={(e) => patch("payDay", Number(e.target.value) || 1)}
                  />
                </label>
                <label>
                  <FieldLabel>Payment Method</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.paymentMethod}
                    disabled={!canManage}
                    onChange={(e) => patch("paymentMethod", e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Salary Calculation Method</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.salaryCalculationMethod}
                    disabled={!canManage}
                    onChange={(e) => patch("salaryCalculationMethod", e.target.value)}
                  >
                    <option value="CALENDAR_DAYS">Calendar Days</option>
                    <option value="WORKING_DAYS">Working Days</option>
                    <option value="FIXED_DAYS_30">Fixed 30 Days</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Rounding Off</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.roundingOff}
                    disabled={!canManage}
                    onChange={(e) => patch("roundingOff", e.target.value)}
                  >
                    <option value="NEAREST_RUPEE">Nearest Rupee</option>
                    <option value="ROUND_UP">Round Up</option>
                    <option value="ROUND_DOWN">Round Down</option>
                    <option value="NONE">No Rounding</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <FieldLabel>Income Tax Calculation</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.incomeTaxCalculation}
                    disabled={!canManage}
                    onChange={(e) => patch("incomeTaxCalculation", e.target.value)}
                  >
                    <option value="NEW_REGIME">New Regime</option>
                    <option value="OLD_REGIME">Old Regime</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ToggleRow
                  label="Arrear Calculation"
                  checked={settings.arrearCalculation}
                  disabled={!canManage}
                  onChange={() => patch("arrearCalculation", !settings.arrearCalculation)}
                />
                <ToggleRow
                  label="Auto Recalculate"
                  checked={settings.autoRecalculate}
                  disabled={!canManage}
                  onChange={() => patch("autoRecalculate", !settings.autoRecalculate)}
                />
                <ToggleRow
                  label="Generate Payslip"
                  checked={settings.generatePayslip}
                  disabled={!canManage}
                  onChange={() => patch("generatePayslip", !settings.generatePayslip)}
                />
                <ToggleRow
                  label="Email Payslip"
                  checked={settings.emailPayslip}
                  disabled={!canManage}
                  onChange={() => patch("emailPayslip", !settings.emailPayslip)}
                />
                <ToggleRow
                  label="Lock Payroll After Approval"
                  checked={settings.lockPayrollAfterApproval}
                  disabled={!canManage}
                  onChange={() =>
                    patch("lockPayrollAfterApproval", !settings.lockPayrollAfterApproval)
                  }
                />
              </div>
              <InfoNote>These preferences will be applied to all payroll runs.</InfoNote>
            </Card>

            <Card
              title="3. Statutory & Compliance Settings"
              hint="Configure PF, ESI and other statutory contributions."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>Provident Fund (PF)</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.pfScheme}
                    disabled={!canManage}
                    onChange={(e) => patch("pfScheme", e.target.value)}
                  >
                    <option value="12_BOTH">12% Employee + Employer</option>
                    <option value="12_EMPLOYEE">12% Employee Only</option>
                    <option value="NONE">Not Applicable</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>ESI Applicability</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.esiApplicability}
                    disabled={!canManage}
                    onChange={(e) => patch("esiApplicability", e.target.value)}
                  >
                    <option value="APPLICABLE">Applicable</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>EPF Number</FieldLabel>
                  <input
                    className={inputClass}
                    value={settings.epfNumber ?? ""}
                    disabled={!canManage}
                    onChange={(e) => patch("epfNumber", e.target.value)}
                    placeholder="Enter EPF number"
                  />
                </label>
                <label>
                  <FieldLabel>ESI Number</FieldLabel>
                  <input
                    className={inputClass}
                    value={settings.esiNumber ?? ""}
                    disabled={!canManage}
                    onChange={(e) => patch("esiNumber", e.target.value)}
                    placeholder="Enter ESI number"
                  />
                </label>
                <label>
                  <FieldLabel>Professional Tax</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.professionalTax}
                    disabled={!canManage}
                    onChange={(e) => patch("professionalTax", e.target.value)}
                  >
                    <option value="STATE_RULES">As per State Rules</option>
                    <option value="FIXED">Fixed Amount</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Labour Welfare Fund</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.labourWelfareFund}
                    disabled={!canManage}
                    onChange={(e) => patch("labourWelfareFund", e.target.value)}
                  >
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                    <option value="APPLICABLE">Applicable</option>
                  </select>
                </label>
              </div>
              <InfoNote>Ensure statutory rates are updated as per government notifications.</InfoNote>
            </Card>

            <Card title="4. Pay Structure & Salary Rules" hint="Define pay limits and calculation rules.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>Pay Structure</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.payStructure}
                    disabled={!canManage}
                    onChange={(e) => patch("payStructure", e.target.value)}
                  >
                    <option value="DEFAULT">Default</option>
                    <option value="CUSTOM">Custom</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <div className="w-full">
                    <ToggleRow
                      label="Allow Negative Salary"
                      checked={settings.allowNegativeSalary}
                      disabled={!canManage}
                      onChange={() => patch("allowNegativeSalary", !settings.allowNegativeSalary)}
                    />
                  </div>
                </div>
                <label>
                  <FieldLabel>Minimum Pay Limit</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${inputClass} pl-7`}
                      value={settings.minimumPayLimit}
                      disabled={!canManage}
                      onChange={(e) => patch("minimumPayLimit", Number(e.target.value) || 0)}
                    />
                  </div>
                </label>
                <label>
                  <FieldLabel>Maximum Pay Limit</FieldLabel>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${inputClass} pl-7`}
                      value={settings.maximumPayLimit}
                      disabled={!canManage}
                      onChange={(e) => patch("maximumPayLimit", Number(e.target.value) || 0)}
                    />
                  </div>
                </label>
                <label>
                  <FieldLabel>Overtime Calculation</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.overtimeCalculation}
                    disabled={!canManage}
                    onChange={(e) => patch("overtimeCalculation", e.target.value)}
                  >
                    <option value="HOURLY_RATE">Based on Hourly Rate</option>
                    <option value="FIXED">Fixed Amount</option>
                    <option value="NONE">Not Applicable</option>
                  </select>
                </label>
                <label>
                  <FieldLabel>Leave Encashment</FieldLabel>
                  <select
                    className={inputClass}
                    value={settings.leaveEncashment}
                    disabled={!canManage}
                    onChange={(e) => patch("leaveEncashment", e.target.value)}
                  >
                    <option value="YEAR_END">At Year End</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ON_EXIT">On Exit Only</option>
                    <option value="NONE">Not Allowed</option>
                  </select>
                </label>
              </div>
            </Card>

            <Card title="5. Payroll Approval Workflow" hint="Define who prepares, reviews and approves payroll.">
              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    label: "Prepared By",
                    key: "preparedByRole" as const,
                    options: ["HR Manager", "Payroll Officer", "Admin"],
                  },
                  {
                    step: 2,
                    label: "Reviewed By",
                    key: "reviewedByRole" as const,
                    options: ["Accounts Manager", "Accountant", "Admin"],
                  },
                  {
                    step: 3,
                    label: "Approved By",
                    key: "approvedByRole" as const,
                    options: ["Finance Head", "Principal", "Institution Admin"],
                  },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {item.step}
                    </div>
                    <label className="min-w-0 flex-1">
                      <FieldLabel>{item.label}</FieldLabel>
                      <select
                        className={inputClass}
                        value={settings[item.key]}
                        disabled={!canManage}
                        onChange={(e) => patch(item.key, e.target.value)}
                      >
                        {item.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <InfoNote>Payroll will move to next level after approval from each step.</InfoNote>
            </Card>
          </div>
        </form>

        <Card
          title="6. Payroll History"
          hint="View recent payroll runs and their status"
          actions={
            <Link
              to="/hr"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View All Payrolls
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Payroll Month</th>
                  <th className="px-3 py-2 font-semibold">Payroll Period</th>
                  <th className="px-3 py-2 font-semibold">Employees</th>
                  <th className="px-3 py-2 font-semibold">Gross Amount (₹)</th>
                  <th className="px-3 py-2 font-semibold">Net Pay (₹)</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Processed By</th>
                  <th className="px-3 py-2 font-semibold">Processed On</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-[#6B7280]">
                      No payroll runs yet. Generate payroll from HR to see history here.
                    </td>
                  </tr>
                ) : (
                  history.map((row, index) => (
                    <tr key={row.id} className="border-t border-[#F3F4F6]">
                      <td className="px-3 py-2.5 text-[#6B7280]">{index + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A1A]">{row.payrollMonth}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{row.payrollPeriod}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{row.employees}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{formatMoney(row.grossAmount)}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{formatMoney(row.netAmount)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            row.status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-sky-50 text-sky-700",
                          ].join(" ")}
                        >
                          {row.status === "COMPLETED" ? "Completed" : "Approved"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#374151]">{row.processedBy}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{formatDate(row.processedOn)}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          to="/hr"
                          className="inline-flex rounded p-1 text-sky-600 hover:bg-sky-50"
                          title="View payroll"
                        >
                          <VisibilityOutlined className="!text-[18px]" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
