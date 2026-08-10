import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  FilterListOutlined,
  InfoOutlined,
  LightbulbOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type LeaveType = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  annualLimit: number | null;
  isPaid: boolean;
  applicableTo: string;
  isActive: boolean;
  carryForward: boolean;
  encashmentAllowed: boolean;
  genderApplicability: string;
  allocationMethod: string;
  allocationFrequency: string;
  defaultAllocationDays: number;
  accrualRate: number;
  accrualBased: boolean;
  effectiveFrom: string | null;
  restriction: string;
  requireApproval: boolean;
  applyOnWeekends: boolean;
  applyOnHolidays: boolean;
  allowHalfDay: boolean;
  minimumNoticeDays: number;
  documentRequired: string;
};

type Setup = {
  leaveTypes: LeaveType[];
  stats: { total: number; active: number; paid: number; unpaid: number };
};

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  annualLimit: "12",
  isPaid: true,
  applicableTo: "ALL",
  isActive: true,
  carryForward: false,
  encashmentAllowed: false,
  genderApplicability: "ALL",
  allocationMethod: "YEARLY",
  allocationFrequency: "ON_ANNIVERSARY",
  defaultAllocationDays: "12",
  accrualRate: "1.00",
  accrualBased: true,
  effectiveFrom: "",
  restriction: "NONE",
  requireApproval: true,
  applyOnWeekends: false,
  applyOnHolidays: false,
  allowHalfDay: true,
  minimumNoticeDays: "1",
  documentRequired: "NOT_REQUIRED",
};

function Card({
  title,
  hint,
  actions,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5 ${className}`}>
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

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
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
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1A1A1A]">{label}</p>
        {description ? <p className="text-xs text-[#6B7280]">{description}</p> : null}
      </div>
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

function applicableLabel(value: string) {
  switch (value) {
    case "TEACHING":
      return "Teaching Staff";
    case "NON_TEACHING":
      return "Non-Teaching Staff";
    default:
      return "All Staff";
  }
}

export function LeaveTypesSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Leave Types";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["hr.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [paidFilter, setPaidFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load(keepId?: string | null) {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/leave-types-setup", accessToken);
      setSetup(data);
      const nextId =
        keepId && data.leaveTypes.some((t) => t.id === keepId)
          ? keepId
          : selectedId && data.leaveTypes.some((t) => t.id === selectedId)
            ? selectedId
            : data.leaveTypes[0]?.id ?? null;
      setSelectedId(nextId);
      const item = data.leaveTypes.find((t) => t.id === nextId);
      if (item && !editingId) fillForm(item);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load leave types");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function fillForm(item: LeaveType) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setForm({
      name: item.name,
      code: item.code ?? "",
      description: item.description ?? "",
      annualLimit: String(item.annualLimit ?? item.defaultAllocationDays ?? 12),
      isPaid: item.isPaid,
      applicableTo: item.applicableTo || "ALL",
      isActive: item.isActive,
      carryForward: item.carryForward,
      encashmentAllowed: item.encashmentAllowed,
      genderApplicability: item.genderApplicability || "ALL",
      allocationMethod: item.allocationMethod || "YEARLY",
      allocationFrequency: item.allocationFrequency || "ON_ANNIVERSARY",
      defaultAllocationDays: String(item.defaultAllocationDays ?? 12),
      accrualRate: Number(item.accrualRate ?? 1).toFixed(2),
      accrualBased: item.accrualBased,
      effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : "",
      restriction: item.restriction || "NONE",
      requireApproval: item.requireApproval,
      applyOnWeekends: item.applyOnWeekends,
      applyOnHolidays: item.applyOnHolidays,
      allowHalfDay: item.allowHalfDay,
      minimumNoticeDays: String(item.minimumNoticeDays ?? 1),
      documentRequired: item.documentRequired || "NOT_REQUIRED",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function patchForm<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const leaveTypes = setup?.leaveTypes ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leaveTypes.filter((item) => {
      if (paidFilter === "PAID" && !item.isPaid) return false;
      if (paidFilter === "UNPAID" && item.isPaid) return false;
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (!q) return true;
      return [item.name, item.code ?? "", item.description ?? "", item.applicableTo]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leaveTypes, search, paidFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, paidFilter, statusFilter]);

  function buildBody() {
    return {
      name: form.name.trim(),
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      annualLimit: Number(form.annualLimit) || 0,
      isPaid: form.isPaid,
      applicableTo: form.applicableTo,
      isActive: form.isActive,
      carryForward: form.carryForward,
      encashmentAllowed: form.encashmentAllowed,
      genderApplicability: form.genderApplicability,
      allocationMethod: form.allocationMethod,
      allocationFrequency: form.allocationFrequency,
      defaultAllocationDays: Number(form.defaultAllocationDays) || 0,
      accrualRate: Number(form.accrualRate) || 0,
      accrualBased: form.accrualBased,
      effectiveFrom: form.effectiveFrom || null,
      restriction: form.restriction,
      requireApproval: form.requireApproval,
      applyOnWeekends: form.applyOnWeekends,
      applyOnHolidays: form.applyOnHolidays,
      allowHalfDay: form.allowHalfDay,
      minimumNoticeDays: Number(form.minimumNoticeDays) || 0,
      documentRequired: form.documentRequired,
    };
  }

  async function saveLeaveType(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.name.trim()) {
      notifyError("Leave type name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = buildBody();
      if (editingId) {
        await apiRequest(`/erp/leave-types/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Leave type updated");
        await load(editingId);
      } else {
        const created = await apiRequest<LeaveType>("/erp/leave-types", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Leave type created");
        await load(created.id);
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save leave type");
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration(event?: FormEvent) {
    event?.preventDefault();
    await saveLeaveType();
  }

  async function deleteType(item: LeaveType) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete leave type "${item.name}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/leave-types/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Leave type deleted");
      if (editingId === item.id) resetForm();
      await load(null);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete leave type");
    } finally {
      setSaving(false);
    }
  }

  const previewName = form.name.trim() || "This leave";
  const previewCode = form.code.trim() ? ` (${form.code.trim().toUpperCase()})` : "";
  const previewDays = form.defaultAllocationDays || form.annualLimit || "12";
  const previewNotice = form.minimumNoticeDays || "1";

  return (
    <form
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]"
      onSubmit={saveConfiguration}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Leave Types</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Create and manage different types of leaves available for staff.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card
            title="1. Leave Types"
            hint="Overview of configured leave categories."
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                disabled={!canManage}
                onClick={resetForm}
              >
                <AddOutlined sx={{ fontSize: 14 }} />
                Add Leave Type
              </button>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative min-w-[220px] flex-1">
                <SearchOutlined
                  sx={{ fontSize: 18 }}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leave types..."
                  className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
              >
                <FilterListOutlined sx={{ fontSize: 16 }} />
                Filters
              </button>
            </div>
            {showFilters ? (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <select
                  value={paidFilter}
                  onChange={(e) => setPaidFilter(e.target.value as typeof paidFilter)}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="ALL">All paid/unpaid</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2 font-semibold">#</th>
                    <th className="px-2 py-2 font-semibold">Leave Type Name</th>
                    <th className="px-2 py-2 font-semibold">Code</th>
                    <th className="px-2 py-2 font-semibold">Paid / Unpaid</th>
                    <th className="px-2 py-2 font-semibold">Applicable To</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-8 text-center text-[#9CA3AF]">
                        No leave types found.
                      </td>
                    </tr>
                  ) : (
                    paged.map((item, index) => {
                      const selected = selectedId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className={[
                            "cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F9FAFB]",
                            selected ? "bg-primary/5" : "",
                          ].join(" ")}
                          onClick={() => fillForm(item)}
                        >
                          <td className="px-2 py-2.5 text-[#6B7280]">
                            {(currentPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{item.name}</td>
                          <td className="px-2 py-2.5 text-[#374151]">{item.code || "—"}</td>
                          <td className="px-2 py-2.5">
                            {item.isPaid ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Paid
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-[#374151]">
                            {applicableLabel(item.applicableTo)}
                          </td>
                          <td className="px-2 py-2.5">
                            {item.isActive ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                className="rounded-md p-1 text-primary hover:bg-primary/10"
                                onClick={() => fillForm(item)}
                              >
                                <EditOutlined sx={{ fontSize: 16 }} />
                              </button>
                              <button
                                type="button"
                                className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                                disabled={!canManage}
                                onClick={() => void deleteType(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
              <span>
                Showing{" "}
                {filtered.length
                  ? `${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(currentPage * PAGE_SIZE, filtered.length)}`
                  : "0"}{" "}
                of {filtered.length} leave types
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              title="2. Add / Edit Leave Type"
              hint={editingId ? "Editing selected leave type." : "Create a new leave type."}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <FieldLabel required>Leave Type Name</FieldLabel>
                  <input
                    value={form.name}
                    onChange={(e) => patchForm("name", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Leave Code</FieldLabel>
                  <input
                    value={form.code}
                    onChange={(e) => patchForm("code", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    placeholder="e.g. CL"
                    disabled={!canManage}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => patchForm("description", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Applicable To</FieldLabel>
                  <select
                    value={form.applicableTo}
                    onChange={(e) => patchForm("applicableTo", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="ALL">All Staff</option>
                    <option value="TEACHING">Teaching Staff</option>
                    <option value="NON_TEACHING">Non-Teaching Staff</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Paid / Unpaid</FieldLabel>
                  <select
                    value={form.isPaid ? "PAID" : "UNPAID"}
                    onChange={(e) => patchForm("isPaid", e.target.value === "PAID")}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="PAID">Paid</option>
                    <option value="UNPAID">Unpaid</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Carry Forward</FieldLabel>
                  <select
                    value={form.carryForward ? "YES" : "NO"}
                    onChange={(e) => patchForm("carryForward", e.target.value === "YES")}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="NO">Not Allowed</option>
                    <option value="YES">Allowed</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Maximum Leave Days</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.annualLimit}
                    onChange={(e) => patchForm("annualLimit", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <div className="sm:col-span-2">
                  <FieldLabel>Encashment Allowed</FieldLabel>
                  <div className="flex gap-4 text-sm">
                    {(["Yes", "No"] as const).map((label) => {
                      const yes = label === "Yes";
                      return (
                        <label key={label} className="inline-flex items-center gap-1.5">
                          <input
                            type="radio"
                            checked={form.encashmentAllowed === yes}
                            disabled={!canManage}
                            onChange={() => patchForm("encashmentAllowed", yes)}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Status</FieldLabel>
                  <div className="flex gap-4 text-sm">
                    {(["Active", "Inactive"] as const).map((label) => {
                      const active = label === "Active";
                      return (
                        <label key={label} className="inline-flex items-center gap-1.5">
                          <input
                            type="radio"
                            checked={form.isActive === active}
                            disabled={!canManage}
                            onChange={() => patchForm("isActive", active)}
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <label className="block sm:col-span-2">
                  <FieldLabel>Gender Applicability</FieldLabel>
                  <select
                    value={form.genderApplicability}
                    onChange={(e) => patchForm("genderApplicability", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="ALL">Applicable for all</option>
                    <option value="MALE">Male only</option>
                    <option value="FEMALE">Female only</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                  onClick={resetForm}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={!canManage || saving}
                  onClick={() => void saveLeaveType()}
                >
                  Save Leave Type
                </button>
              </div>
            </Card>

            <Card title="3. Leave Allocation Rules" hint="How leave is accrued or granted.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Allocation Method</FieldLabel>
                  <select
                    value={form.allocationMethod}
                    onChange={(e) => patchForm("allocationMethod", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Allocation Frequency</FieldLabel>
                  <select
                    value={form.allocationFrequency}
                    onChange={(e) => patchForm("allocationFrequency", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="ON_ANNIVERSARY">On Anniversary</option>
                    <option value="CALENDAR_YEAR">Calendar Year</option>
                    <option value="ACADEMIC_YEAR">Academic Year</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Default Allocation Days</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.defaultAllocationDays}
                    onChange={(e) => patchForm("defaultAllocationDays", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Accrual Rate</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.accrualRate}
                    onChange={(e) => patchForm("accrualRate", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Effective From</FieldLabel>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => patchForm("effectiveFrom", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Restriction</FieldLabel>
                  <select
                    value={form.restriction}
                    onChange={(e) => patchForm("restriction", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="NONE">No restriction</option>
                    <option value="PROBATION">Not in probation</option>
                    <option value="CONFIRMATION">After confirmation</option>
                  </select>
                </label>
              </div>
              <div className="mt-3">
                <ToggleRow
                  label="Accrual Based"
                  checked={form.accrualBased}
                  disabled={!canManage}
                  onChange={() => patchForm("accrualBased", !form.accrualBased)}
                />
              </div>
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                Leave allocation will be applied as per the selected rules.
              </div>
            </Card>

            <Card title="4. Leave Settings" hint="Behavior of leave requests for this type.">
              <ToggleRow
                label="Require Approval"
                description="Leave request requires approval."
                checked={form.requireApproval}
                disabled={!canManage}
                onChange={() => patchForm("requireApproval", !form.requireApproval)}
              />
              <ToggleRow
                label="Apply on Weekends"
                description="Count leave on weekends."
                checked={form.applyOnWeekends}
                disabled={!canManage}
                onChange={() => patchForm("applyOnWeekends", !form.applyOnWeekends)}
              />
              <ToggleRow
                label="Apply on Holidays"
                description="Count leave on holidays."
                checked={form.applyOnHolidays}
                disabled={!canManage}
                onChange={() => patchForm("applyOnHolidays", !form.applyOnHolidays)}
              />
              <ToggleRow
                label="Allow Half Day"
                description="Allow half day leave."
                checked={form.allowHalfDay}
                disabled={!canManage}
                onChange={() => patchForm("allowHalfDay", !form.allowHalfDay)}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Minimum Notice (Days)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    value={form.minimumNoticeDays}
                    onChange={(e) => patchForm("minimumNoticeDays", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Document Required</FieldLabel>
                  <select
                    value={form.documentRequired}
                    onChange={(e) => patchForm("documentRequired", e.target.value)}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    disabled={!canManage}
                  >
                    <option value="NOT_REQUIRED">Not Required</option>
                    <option value="OPTIONAL">Optional</option>
                    <option value="REQUIRED">Required</option>
                  </select>
                </label>
              </div>
            </Card>

            <Card title="5. Leave Policy Information">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm text-[#374151]">
                <p className="font-semibold text-[#1A1A1A]">Policy Preview</p>
                <p className="mt-2">
                  {previewName}
                  {previewCode} is {form.isPaid ? "paid" : "unpaid"} leave
                  {form.description.trim()
                    ? ` — ${form.description.trim()}`
                    : " granted as per campus policy"}
                  . Employees can apply for a maximum of {previewDays} days per year.
                  {form.requireApproval
                    ? ` Leave requests require approval at least ${previewNotice} day(s) in advance.`
                    : " Leave requests do not require approval."}
                </p>
              </div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <LightbulbOutlined sx={{ fontSize: 16 }} className="text-amber-600" />
                  Note
                </div>
                Changes in leave settings will affect future allocations and leave requests.
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                <InfoOutlined sx={{ fontSize: 14 }} className="mt-0.5 shrink-0" />
                Use Save Leave Type or Save configuration to persist the form above.
              </div>
            </Card>
          </div>
        </div>
      </div>
    </form>
  );
}
