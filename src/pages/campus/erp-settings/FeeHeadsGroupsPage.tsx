import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  FilterListOutlined,
  InfoOutlined,
  SaveOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { FeeGroup, FeeHeadKind, FeeSetup, FeeType } from "../fees/types";

type OutletCtx = { activeLabel?: string };

const KIND_OPTIONS: Array<{ value: FeeHeadKind; label: string }> = [
  { value: "MANDATORY", label: "Mandatory" },
  { value: "ONE_TIME", label: "One Time" },
  { value: "OPTIONAL", label: "Optional" },
  { value: "REFUNDABLE", label: "Refundable" },
];

const KIND_BADGE: Record<FeeHeadKind, string> = {
  MANDATORY: "bg-violet-50 text-violet-700",
  ONE_TIME: "bg-sky-50 text-sky-700",
  OPTIONAL: "bg-amber-50 text-amber-700",
  REFUNDABLE: "bg-emerald-50 text-emerald-700",
};

function Card({
  title,
  children,
  actions,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">{children}</span>;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
        checked ? "bg-primary" : "bg-[#D1D5DB]",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block size-5 rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function kindLabel(kind?: FeeHeadKind) {
  return KIND_OPTIONS.find((item) => item.value === (kind ?? "MANDATORY"))?.label ?? "Mandatory";
}

export function FeeHeadsGroupsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Fee Heads & Fee Groups";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["fees.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<FeeSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | FeeHeadKind>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [headName, setHeadName] = useState("");
  const [headCode, setHeadCode] = useState("");
  const [headDescription, setHeadDescription] = useState("");
  const [headKind, setHeadKind] = useState<FeeHeadKind>("MANDATORY");
  const [headApplicableTo, setHeadApplicableTo] = useState("All Classes");
  const [headGst, setHeadGst] = useState(false);
  const [headAmount, setHeadAmount] = useState("0");
  const [headActive, setHeadActive] = useState(true);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupActive, setGroupActive] = useState(true);
  const [addHeadToGroupId, setAddHeadToGroupId] = useState("");

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<FeeSetup>("/fees/setup", accessToken);
      setSetup(data);
      setSelectedGroupId((prev) => prev || data.groups[0]?.id || "");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load fee setup");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const types = setup?.types ?? [];
  const groups = setup?.groups ?? [];

  const filteredHeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return types.filter((item) => {
      if (kindFilter !== "ALL" && (item.kind ?? "MANDATORY") !== kindFilter) return false;
      if (!q) return true;
      return [item.name, item.code ?? "", item.applicableTo ?? "", item.kind ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [types, search, kindFilter]);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const availableHeadsForGroup = useMemo(() => {
    const assignedElsewhere = new Set(
      groups
        .filter((g) => g.id !== selectedGroupId)
        .flatMap((g) => g.items.map((item) => item.feeType.id)),
    );
    const inSelected = new Set((selectedGroup?.items ?? []).map((item) => item.feeType.id));
    return types.filter(
      (t) => t.isActive !== false && !assignedElsewhere.has(t.id) && !inSelected.has(t.id),
    );
  }, [types, groups, selectedGroupId, selectedGroup]);

  function resetHeadForm() {
    setEditingHeadId(null);
    setHeadName("");
    setHeadCode("");
    setHeadDescription("");
    setHeadKind("MANDATORY");
    setHeadApplicableTo("All Classes");
    setHeadGst(false);
    setHeadAmount("0");
    setHeadActive(true);
  }

  function startEditHead(item: FeeType) {
    setEditingHeadId(item.id);
    setHeadName(item.name);
    setHeadCode(item.code ?? "");
    setHeadDescription(item.description ?? "");
    setHeadKind(item.kind ?? "MANDATORY");
    setHeadApplicableTo(item.applicableTo || "All Classes");
    setHeadGst(Boolean(item.gstApplicable));
    setHeadAmount(String(Number(item.defaultAmount ?? 0)));
    setHeadActive(item.isActive !== false);
  }

  function resetGroupForm() {
    setGroupFormOpen(false);
    setEditingGroupId(null);
    setGroupName("");
    setGroupDescription("");
    setGroupActive(true);
  }

  function startEditGroup(group: FeeGroup) {
    setGroupFormOpen(true);
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupDescription(group.description ?? "");
    setGroupActive(group.isActive !== false);
    setSelectedGroupId(group.id);
  }

  async function saveHead(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = headName.trim();
    if (!name) {
      notifyError("Fee head name is required.");
      return;
    }
    const amount = Number(headAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      notifyError("Default amount must be a valid number.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        code: headCode.trim() || null,
        description: headDescription.trim() || null,
        kind: headKind,
        applicableTo: headApplicableTo.trim() || "All Classes",
        gstApplicable: headGst,
        defaultAmount: amount,
        isActive: headActive,
      };
      if (editingHeadId) {
        await apiRequest(`/fees/types/${editingHeadId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Fee head updated");
      } else {
        await apiRequest("/fees/types", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Fee head added");
      }
      resetHeadForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save fee head");
    } finally {
      setSaving(false);
    }
  }

  async function deleteHead(item: FeeType) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete fee head "${item.name}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/fees/types/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Fee head removed");
      if (editingHeadId === item.id) resetHeadForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete fee head");
    } finally {
      setSaving(false);
    }
  }

  async function saveGroup(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = groupName.trim();
    if (!name) {
      notifyError("Group name is required.");
      return;
    }
    setSaving(true);
    try {
      if (editingGroupId) {
        const currentIds = (groups.find((g) => g.id === editingGroupId)?.items ?? []).map(
          (item) => item.feeType.id,
        );
        await apiRequest(`/fees/groups/${editingGroupId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify({
            name,
            description: groupDescription.trim() || null,
            isActive: groupActive,
            feeTypeIds: currentIds,
          }),
        });
        notifySuccess("Fee group updated");
      } else {
        const created = await apiRequest<FeeGroup>("/fees/groups", accessToken, {
          method: "POST",
          body: JSON.stringify({
            name,
            description: groupDescription.trim() || null,
            isActive: groupActive,
            feeTypeIds: [],
          }),
        });
        setSelectedGroupId(created.id);
        notifySuccess("Fee group added");
      }
      resetGroupForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save fee group");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(group: FeeGroup) {
    if (!accessToken || !canManage) return;
    if (group.canDelete === false) {
      notifyError("This fee group is in use and cannot be deleted.");
      return;
    }
    const ok = await confirmDelete({ text: `Delete fee group "${group.name}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/fees/groups/${group.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Fee group deleted");
      if (selectedGroupId === group.id) setSelectedGroupId("");
      if (editingGroupId === group.id) resetGroupForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete fee group");
    } finally {
      setSaving(false);
    }
  }

  async function addHeadToGroup() {
    if (!accessToken || !canManage || !selectedGroup || !addHeadToGroupId) return;
    const nextIds = [
      ...selectedGroup.items.map((item) => item.feeType.id),
      addHeadToGroupId,
    ];
    setSaving(true);
    try {
      await apiRequest(`/fees/groups/${selectedGroup.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ feeTypeIds: nextIds }),
      });
      setAddHeadToGroupId("");
      notifySuccess("Fee head added to group");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add fee head to group");
    } finally {
      setSaving(false);
    }
  }

  async function removeHeadFromGroup(feeTypeId: string) {
    if (!accessToken || !canManage || !selectedGroup) return;
    const nextIds = selectedGroup.items
      .map((item) => item.feeType.id)
      .filter((id) => id !== feeTypeId);
    setSaving(true);
    try {
      await apiRequest(`/fees/groups/${selectedGroup.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ feeTypeIds: nextIds }),
      });
      notifySuccess("Fee head removed from group");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to remove fee head");
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (editingHeadId || headName.trim()) {
      await saveHead();
      return;
    }
    if (groupFormOpen && (editingGroupId || groupName.trim())) {
      await saveGroup();
      return;
    }
    notifySuccess("Configuration is up to date");
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
          onClick={() => void saveConfiguration()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Fee Heads & Fee Groups
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage fee heads and organize them into groups for fee structures.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card
            title="1. Fee Heads"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <SearchOutlined
                    sx={{ fontSize: 16 }}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                  />
                  <input
                    className="nx-input w-40 pl-8 sm:w-48"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-semibold text-[#374151]"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <FilterListOutlined sx={{ fontSize: 16 }} />
                  Filters
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={resetHeadForm}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                  Add Fee Head
                </button>
              </div>
            }
          >
            {showFilters ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {(["ALL", ...KIND_OPTIONS.map((k) => k.value)] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKindFilter(value)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      kindFilter === value
                        ? "bg-primary text-white"
                        : "bg-[#F3F4F6] text-[#6B7280]",
                    ].join(" ")}
                  >
                    {value === "ALL" ? "All" : kindLabel(value)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Fee Head Name</th>
                    <th className="px-2 py-2">Fee Code</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Applicable To</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-8 text-center text-[#6B7280]">
                        {loading ? "Loading…" : "No fee heads found."}
                      </td>
                    </tr>
                  ) : (
                    filteredHeads.map((item, index) => {
                      const kind = item.kind ?? "MANDATORY";
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                        >
                          <td className="px-2 py-2.5 text-[#6B7280]">{index + 1}</td>
                          <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{item.name}</td>
                          <td className="px-2 py-2.5 text-[#6B7280]">{item.code || "—"}</td>
                          <td className="px-2 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${KIND_BADGE[kind]}`}
                            >
                              {kindLabel(kind)}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-[#6B7280]">
                            {item.applicableTo || "All Classes"}
                          </td>
                          <td className="px-2 py-2.5">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                item.isActive !== false
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              {item.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => startEditHead(item)}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => void deleteHead(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
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
          </Card>

          <Card title={editingHeadId ? "2. Edit Fee Head" : "2. Add / Edit Fee Head"}>
            <form className="space-y-3" onSubmit={(e) => void saveHead(e)}>
              <label className="block">
                <FieldLabel>Fee Head Name</FieldLabel>
                <input
                  className="nx-input w-full"
                  value={headName}
                  disabled={!canManage || saving}
                  onChange={(e) => setHeadName(e.target.value)}
                  placeholder="e.g. Tuition Fee"
                />
              </label>
              <label className="block">
                <FieldLabel>Fee Code</FieldLabel>
                <input
                  className="nx-input w-full"
                  value={headCode}
                  disabled={!canManage || saving}
                  onChange={(e) => setHeadCode(e.target.value)}
                  placeholder="e.g. TFEE"
                />
              </label>
              <label className="block">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  className="nx-input min-h-[72px] w-full"
                  value={headDescription}
                  disabled={!canManage || saving}
                  onChange={(e) => setHeadDescription(e.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Fee Type</FieldLabel>
                  <select
                    className="nx-input w-full"
                    value={headKind}
                    disabled={!canManage || saving}
                    onChange={(e) => setHeadKind(e.target.value as FeeHeadKind)}
                  >
                    {KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Applicable To</FieldLabel>
                  <select
                    className="nx-input w-full"
                    value={headApplicableTo}
                    disabled={!canManage || saving}
                    onChange={(e) => setHeadApplicableTo(e.target.value)}
                  >
                    <option value="All Classes">All Classes</option>
                    <option value="Classes 1-5">Classes 1-5</option>
                    <option value="Classes 6-12">Classes 6-12</option>
                    <option value="Classes 11-12">Classes 11-12</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>GST Applicable</FieldLabel>
                  <select
                    className="nx-input w-full"
                    value={headGst ? "yes" : "no"}
                    disabled={!canManage || saving}
                    onChange={(e) => setHeadGst(e.target.value === "yes")}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label className="block">
                  <FieldLabel>Default Amount (₹)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="nx-input w-full"
                    value={headAmount}
                    disabled={!canManage || saving}
                    onChange={(e) => setHeadAmount(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2.5">
                <span className="text-sm text-[#374151]">Status</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280]">
                    {headActive ? "Active" : "Inactive"}
                  </span>
                  <Toggle
                    checked={headActive}
                    disabled={!canManage || saving}
                    onChange={setHeadActive}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                  onClick={resetHeadForm}
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!canManage || saving}
                >
                  {editingHeadId ? "Update Fee Head" : "Save Fee Head"}
                </button>
              </div>
            </form>
          </Card>

          <Card
            title="3. Fee Groups"
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                disabled={!canManage || saving}
                onClick={() => {
                  setGroupFormOpen(true);
                  setEditingGroupId(null);
                  setGroupName("");
                  setGroupDescription("");
                  setGroupActive(true);
                }}
              >
                <AddOutlined sx={{ fontSize: 16 }} />
                Add Fee Group
              </button>
            }
          >
            {groupFormOpen ? (
              <form
                className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3"
                onSubmit={(e) => void saveGroup(e)}
              >
                <label className="block">
                  <FieldLabel>Group Name</FieldLabel>
                  <input
                    className="nx-input w-full"
                    value={groupName}
                    disabled={saving}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Academic Fees"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Description</FieldLabel>
                  <input
                    className="nx-input w-full"
                    value={groupDescription}
                    disabled={saving}
                    onChange={(e) => setGroupDescription(e.target.value)}
                  />
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#374151]">Active</span>
                  <Toggle checked={groupActive} disabled={saving} onChange={setGroupActive} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={saving}
                  >
                    {editingGroupId ? "Update Group" : "Save Group"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                    onClick={resetGroupForm}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2">Group Name</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">No. of Fee Heads</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-8 text-center text-[#6B7280]">
                        {loading ? "Loading…" : "No fee groups yet."}
                      </td>
                    </tr>
                  ) : (
                    groups.map((group) => {
                      const selected = group.id === selectedGroupId;
                      return (
                        <tr
                          key={group.id}
                          onClick={() => setSelectedGroupId(group.id)}
                          className={[
                            "cursor-pointer border-b border-[#F3F4F6] last:border-b-0",
                            selected ? "bg-primary/[0.06]" : "hover:bg-[#F9FAFB]",
                          ].join(" ")}
                        >
                          <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">
                            {group.name}
                          </td>
                          <td className="px-2 py-2.5 text-[#6B7280]">
                            {group.description || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-[#6B7280]">{group.items.length}</td>
                          <td className="px-2 py-2.5">
                            <span
                              className={[
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                group.isActive !== false
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              {group.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditGroup(group);
                                }}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving || group.canDelete === false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteGroup(group);
                                }}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
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
          </Card>

          <Card title="4. Group Details">
            <label className="mb-3 block">
              <FieldLabel>Select Group</FieldLabel>
              <select
                className="nx-input w-full"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                {groups.length === 0 ? <option value="">No groups</option> : null}
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedGroup ? (
              <p className="mb-3 text-xs text-[#6B7280]">
                {selectedGroup.description || "No description"}
              </p>
            ) : null}

            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="min-w-[180px] flex-1">
                <FieldLabel>Add Fee Head to Group</FieldLabel>
                <select
                  className="nx-input w-full"
                  value={addHeadToGroupId}
                  disabled={!canManage || saving || !selectedGroup}
                  onChange={(e) => setAddHeadToGroupId(e.target.value)}
                >
                  <option value="">Select fee head</option>
                  {availableHeadsForGroup.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                disabled={!canManage || saving || !selectedGroup || !addHeadToGroupId}
                onClick={() => void addHeadToGroup()}
              >
                <AddOutlined sx={{ fontSize: 16 }} />
                Add Fee Head to Group
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2">Fee Head</th>
                    <th className="px-2 py-2">Amount (₹)</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedGroup || selectedGroup.items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-8 text-center text-[#6B7280]">
                        {selectedGroup ? "No fee heads in this group." : "Select a group."}
                      </td>
                    </tr>
                  ) : (
                    selectedGroup.items.map((item) => (
                      <tr
                        key={item.feeType.id}
                        className="border-b border-[#F3F4F6] last:border-b-0"
                      >
                        <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">
                          {item.feeType.name}
                        </td>
                        <td className="px-2 py-2.5 text-[#6B7280]">
                          {money(item.feeType.defaultAmount)}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                            disabled={!canManage || saving}
                            onClick={() => void removeHeadFromGroup(item.feeType.id)}
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs text-[#1E40AF]">
              <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0" />
              <span>Fee heads can exist in only one group.</span>
            </div>
          </Card>
        </div>

        <p className="mt-4 text-center text-xs text-[#6B7280]">
          Changes made here will reflect in fee structure and invoices across the system.
        </p>
      </div>
    </div>
  );
}
