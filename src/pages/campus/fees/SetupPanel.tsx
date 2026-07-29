import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  DeleteOutline,
  DescriptionOutlined,
  EditOutlined,
  GroupsOutlined,
  LayersOutlined,
} from "@mui/icons-material";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { confirmDelete } from "../../../lib/confirm";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { FeeGroup, FeeMaster, FeeSetup } from "./types";
import { formatMoney, today } from "./utils";

const GROUP_PAGE_SIZE = 6;
const MASTER_PAGE_SIZE = 6;

type FineUi = "NONE" | "FIXED" | "PER_DAY" | "DATE_RANGE";

function fineLabel(fineType?: string, fineUiHint?: FineUi) {
  if (fineUiHint === "PER_DAY" || fineType === "PER_DAY") return "Per-day";
  if (fineUiHint === "DATE_RANGE" || fineType === "DATE_RANGE") return "Date range";
  if (fineType === "PERCENTAGE") return "Percentage";
  if (fineType === "FIXED") return "Fixed";
  return "None";
}

function finePill(fineType?: string) {
  if (fineType === "FIXED") return "nx-pill nx-pill-indigo";
  if (fineType === "PERCENTAGE" || fineType === "PER_DAY") return "nx-pill nx-pill-warning";
  if (fineType === "DATE_RANGE") return "nx-pill nx-pill-indigo";
  return "nx-pill nx-pill-neutral";
}

function subTabClass(active: boolean) {
  return active
    ? "border-b-2 border-[#6366f1] pb-3 text-[#6366f1]"
    : "pb-3 text-slate-500 hover:text-slate-700";
}

export function SetupPanel({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: FeeSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [subTab, setSubTab] = useState<"types" | "groups" | "masters">("types");
  const [saving, setSaving] = useState(false);

  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupTypeIds, setGroupTypeIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(1);

  const [master, setMaster] = useState({
    feeGroupId: "",
    feeTypeId: "",
    classSectionId: "",
    dueDate: today,
    amount: "",
    fineUi: "NONE" as FineUi,
    fineValue: "",
    rangeStart: today,
    rangeEnd: today,
  });
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [masterPage, setMasterPage] = useState(1);

  const groupPageRows = useMemo(
    () => paginateItems(setup.groups, groupPage, GROUP_PAGE_SIZE),
    [setup.groups, groupPage],
  );
  const masterPageRows = useMemo(
    () => paginateItems(setup.masters, masterPage, MASTER_PAGE_SIZE),
    [setup.masters, masterPage],
  );

  const selectedGroupTypes =
    setup.groups.find((g) => g.id === master.feeGroupId)?.items.map((i) => i.feeType) ?? [];

  const assignedClassCount = useMemo(() => {
    const ids = new Set(
      setup.masters.map((m) => m.classSection?.id).filter((id): id is string => Boolean(id)),
    );
    return ids.size || setup.classSections.length;
  }, [setup.masters, setup.classSections.length]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(setup.groups.length / GROUP_PAGE_SIZE));
    if (groupPage > max) setGroupPage(max);
  }, [setup.groups.length, groupPage]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(setup.masters.length / MASTER_PAGE_SIZE));
    if (masterPage > max) setMasterPage(max);
  }, [setup.masters.length, masterPage]);

  function groupAssignedTo(group: FeeGroup) {
    const classes = setup.masters
      .filter((m) => m.feeGroup.id === group.id && m.classSection)
      .map((m) => m.classSection!.academicClass.name);
    const unique = [...new Set(classes)];
    if (unique.length) return unique.join(", ");
    const match = setup.classSections.find((cs) =>
      group.name.toLowerCase().includes(cs.academicClass.name.toLowerCase()),
    );
    return match?.academicClass.name ?? "—";
  }

  function resetGroupForm() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupTypeIds([]);
  }

  function startEditGroup(group: FeeGroup) {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupTypeIds(group.items.map((item) => item.feeType.id));
    setSubTab("groups");
  }

  function toggleGroupType(id: string) {
    setGroupTypeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function addFeeType(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/fees/types", token, {
        method: "POST",
        body: JSON.stringify({ name: typeName.trim(), code: typeCode.trim() || null }),
      });
      setTypeName("");
      setTypeCode("");
      notifySuccess("Fee type created");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create fee type");
    } finally {
      setSaving(false);
    }
  }

  async function removeFeeType(item: { id: string; name: string }) {
    const ok = await confirmDelete({
      title: "Delete fee type?",
      text: `"${item.name}" will be deleted if unused.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/types/${item.id}`, token, { method: "DELETE" });
      notifySuccess("Fee type deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete fee type");
    }
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    if (!groupName.trim()) return;
    if (!groupTypeIds.length) {
      onError("Select at least one fee type");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: groupName.trim(), feeTypeIds: groupTypeIds };
      if (editingGroupId) {
        await apiRequest(`/fees/groups/${editingGroupId}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/fees/groups", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetGroupForm();
      setGroupPage(1);
      notifySuccess(editingGroupId ? "Fee group updated" : "Fee group saved");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save fee group");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(group: FeeGroup) {
    const ok = await confirmDelete({
      title: "Delete fee group?",
      text: `"${group.name}" will be deleted if unused.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/groups/${group.id}`, token, { method: "DELETE" });
      if (editingGroupId === group.id) resetGroupForm();
      notifySuccess("Fee group deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete fee group");
    }
  }

  async function assignGroup(group: FeeGroup) {
    const masters = setup.masters.filter((m) => m.feeGroup.id === group.id);
    if (!masters.length) {
      onError("Create fee master entries for this group before assigning");
      return;
    }
    setSaving(true);
    try {
      for (const item of masters) {
        await apiRequest(`/fees/masters/${item.id}/assign`, token, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
      notifySuccess("Fee group assigned");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to assign fee group");
    } finally {
      setSaving(false);
    }
  }

  function resetMasterForm() {
    setEditingMasterId(null);
    setMaster({
      feeGroupId: setup.groups[0]?.id ?? "",
      feeTypeId: "",
      classSectionId: "",
      dueDate: today,
      amount: "",
      fineUi: "NONE",
      fineValue: "",
      rangeStart: today,
      rangeEnd: today,
    });
  }

  function startEditMaster(item: FeeMaster) {
    setEditingMasterId(item.id);
    setMaster({
      feeGroupId: item.feeGroup.id,
      feeTypeId: item.feeType.id,
      classSectionId: item.classSection?.id ?? "",
      dueDate: item.dueDate.slice(0, 10),
      amount: String(Number(item.amount)),
      fineUi:
        item.fineType === "PER_DAY"
          ? "PER_DAY"
          : item.fineType === "DATE_RANGE"
            ? "DATE_RANGE"
            : item.fineType === "FIXED" || item.fineType === "PERCENTAGE"
              ? "FIXED"
              : "NONE",
      fineValue: String(Number(item.fineValue ?? 0) || ""),
      rangeStart: item.fineRanges?.[0]?.startDate.slice(0, 10) ?? today,
      rangeEnd: item.fineRanges?.[0]?.endDate?.slice(0, 10) ?? today,
    });
    setSubTab("masters");
  }

  async function saveMaster(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession) {
      onError("No current academic session configured");
      return;
    }
    if (!master.feeGroupId || !master.feeTypeId) {
      onError("Select fee group and fee type");
      return;
    }
    setSaving(true);
    try {
      const fineType =
        master.fineUi === "NONE"
          ? "NONE"
          : master.fineUi === "PER_DAY"
            ? "PER_DAY"
            : master.fineUi === "DATE_RANGE"
              ? "DATE_RANGE"
              : "FIXED";
      const payload = {
        academicSessionId: setup.currentSession.id,
        classSectionId: master.classSectionId || null,
        feeGroupId: master.feeGroupId,
        feeTypeId: master.feeTypeId,
        amount: Number(master.amount),
        dueDate: master.dueDate,
        fineType,
        fineValue: fineType === "NONE" ? 0 : Number(master.fineValue || 0),
        graceDays: 0,
        fineRanges:
          master.fineUi === "DATE_RANGE"
            ? [
                {
                  startDate: master.rangeStart,
                  endDate: master.rangeEnd || null,
                  amount: Number(master.fineValue || 0),
                  perDay: false,
                },
              ]
            : [],
        isCustom: false,
      };
      if (editingMasterId) {
        await apiRequest(`/fees/masters/${editingMasterId}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/fees/masters", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      resetMasterForm();
      setMasterPage(1);
      notifySuccess(editingMasterId ? "Fee master updated" : "Fee master saved");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save fee master");
    } finally {
      setSaving(false);
    }
  }

  async function removeMaster(item: FeeMaster) {
    const ok = await confirmDelete({
      title: "Delete fee master?",
      text: `"${item.feeType.name}" will be removed if no payments are linked.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/masters/${item.id}`, token, { method: "DELETE" });
      if (editingMasterId === item.id) resetMasterForm();
      notifySuccess("Fee master deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete fee master");
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="flex items-center gap-6 border-b border-slate-200 text-[14px] font-semibold">
        <button type="button" className={subTabClass(subTab === "types")} onClick={() => setSubTab("types")}>
          Fees Type
        </button>
        <button type="button" className={subTabClass(subTab === "groups")} onClick={() => setSubTab("groups")}>
          Fees Group
        </button>
        <button type="button" className={subTabClass(subTab === "masters")} onClick={() => setSubTab("masters")}>
          Fees Master
        </button>
      </div>

      {subTab === "types" ? (
        <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <form className="nx-card p-5" onSubmit={(e) => void addFeeType(e)}>
            <h3 className="text-[18px] font-bold text-slate-900">Add fee type</h3>
            <label className="nx-label mt-5">Fee Name</label>
            <input
              className="nx-input"
              placeholder="Enter fee name"
              required
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <label className="nx-label mt-4">Fee Code</label>
            <input
              className="nx-input"
              placeholder="Enter fee code"
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
            />
            <button className="nx-btn-primary mt-5" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 16 }} />
              {saving ? "Saving..." : "Add fee type"}
            </button>
          </form>
          <div className="nx-card p-5">
            <h3 className="text-[18px] font-bold text-slate-900">Existing fee types</h3>
            <div className="mt-5 flex flex-wrap gap-3">
              {setup.types.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-[14px] font-semibold text-indigo-700"
                >
                  {item.name}
                  <button
                    type="button"
                    className="rounded p-0.5 text-indigo-400 hover:bg-indigo-100 hover:text-rose-600"
                    title={`Delete ${item.name}`}
                    onClick={() => void removeFeeType(item)}
                  >
                    <DeleteOutline sx={{ fontSize: 16 }} />
                  </button>
                </span>
              ))}
              {!setup.types.length ? <p className="text-sm text-slate-500">No fee types.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {subTab === "groups" ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form className="nx-card h-fit p-5" onSubmit={(e) => void saveGroup(e)}>
            <h3 className="text-[18px] font-bold text-slate-900">
              {editingGroupId ? "Edit fee group" : "Add fee group"}
            </h3>

            <label className="nx-label mt-5">Group Name</label>
            <input
              className="nx-input"
              placeholder="Enter group name"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
              Match your Academics class name, e.g. &apos;Class 6&apos;. Add &apos;-New&apos; or &apos;-Old&apos; if
              structure differs.
            </p>

            <label className="nx-label mt-4">Select Fee Types</label>
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
              {setup.types.map((item) => {
                const checked = groupTypeIds.includes(item.id);
                return (
                  <label key={item.id} className="flex cursor-pointer items-center gap-3 text-[14px] text-slate-700">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#6366f1]"
                      checked={checked}
                      onChange={() => toggleGroupType(item.id)}
                    />
                    <span className={checked ? "font-semibold text-slate-900" : ""}>{item.name}</span>
                  </label>
                );
              })}
              {!setup.types.length ? (
                <p className="text-[13px] text-slate-500">Create fee types first.</p>
              ) : null}
            </div>

            <button className="nx-btn-primary mt-5 w-full !py-2.5" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 16 }} />
              {saving ? "Saving..." : editingGroupId ? "Save fee group" : "Add fee group"}
            </button>
            {editingGroupId ? (
              <button type="button" className="nx-btn-secondary mt-2 w-full" onClick={resetGroupForm}>
                Cancel edit
              </button>
            ) : null}
          </form>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Existing fee groups</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Group Name</th>
                    <th>Fee Types Included</th>
                    <th>Assigned To</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupPageRows.map((group) => (
                    <tr key={group.id}>
                      <td className="font-semibold text-slate-900">{group.name}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {group.items.map((item) => (
                            <span
                              key={item.feeType.id}
                              className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                            >
                              {item.feeType.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="text-slate-600">{groupAssignedTo(group)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="text-[12px] font-bold uppercase tracking-wide text-indigo-600 hover:underline"
                            onClick={() => void assignGroup(group)}
                            disabled={saving}
                          >
                            Assign / View
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            onClick={() => startEditGroup(group)}
                          >
                            <EditOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => void removeGroup(group)}
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!setup.groups.length ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                        No fee groups yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={groupPage}
              pageSize={GROUP_PAGE_SIZE}
              total={setup.groups.length}
              onPageChange={setGroupPage}
              label="groups"
            />
          </div>
        </div>
      ) : null}

      {subTab === "masters" ? (
        <div className="space-y-4">
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <form className="nx-card h-fit p-5" onSubmit={(e) => void saveMaster(e)}>
              <h3 className="text-[18px] font-bold text-slate-900">
                {editingMasterId ? "Edit Fee Master Entry" : "Add Fee Master Entry"}
              </h3>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Define due dates and amounts for specific fee types within groups.
              </p>

              <label className="nx-label mt-5">Fees Group</label>
              <select
                className="nx-input"
                value={master.feeGroupId}
                onChange={(e) => setMaster({ ...master, feeGroupId: e.target.value, feeTypeId: "" })}
                required
              >
                <option value="">Select Group</option>
                {setup.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>

              <label className="nx-label mt-4">Fee Type</label>
              <select
                className="nx-input"
                value={master.feeTypeId}
                onChange={(e) => setMaster({ ...master, feeTypeId: e.target.value })}
                required
              >
                <option value="">Select Fee Type</option>
                {selectedGroupTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <label className="nx-label mt-4">Class Section (optional)</label>
              <select
                className="nx-input"
                value={master.classSectionId}
                onChange={(e) => setMaster({ ...master, classSectionId: e.target.value })}
              >
                <option value="">All classes in group</option>
                {setup.classSections.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.academicClass.name} - {cs.section.name}
                  </option>
                ))}
              </select>

              <label className="nx-label mt-4">Due Date</label>
              <input
                className="nx-input"
                type="date"
                value={master.dueDate}
                onChange={(e) => setMaster({ ...master, dueDate: e.target.value })}
                required
              />

              <label className="nx-label mt-4">Amount (₹)</label>
              <input
                className="nx-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={master.amount}
                onChange={(e) => setMaster({ ...master, amount: e.target.value })}
                required
              />

              <p className="nx-label mt-4">Fine Type</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["NONE", "None"],
                    ["FIXED", "Fixed amount"],
                    ["PER_DAY", "Per-day"],
                    ["DATE_RANGE", "Date range"],
                  ] as Array<[FineUi, string]>
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
                      master.fineUi === value
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fineUi"
                      className="accent-[#6366f1]"
                      checked={master.fineUi === value}
                      onChange={() => setMaster({ ...master, fineUi: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {master.fineUi === "DATE_RANGE" ? (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="nx-label">Start Date</label>
                      <input
                        className="nx-input"
                        type="date"
                        value={master.rangeStart}
                        onChange={(e) => setMaster({ ...master, rangeStart: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="nx-label">End Date</label>
                      <input
                        className="nx-input"
                        type="date"
                        value={master.rangeEnd}
                        onChange={(e) => setMaster({ ...master, rangeEnd: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="nx-label">Fine (₹)</label>
                    <input
                      className="nx-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="50.00"
                      value={master.fineValue}
                      onChange={(e) => setMaster({ ...master, fineValue: e.target.value })}
                    />
                  </div>
                  <button type="button" className="text-[13px] font-semibold text-indigo-600">
                    + Add range
                  </button>
                </div>
              ) : null}

              {master.fineUi === "FIXED" || master.fineUi === "PER_DAY" ? (
                <div className="mt-3">
                  <label className="nx-label">Fine (₹)</label>
                  <input
                    className="nx-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={master.fineValue}
                    onChange={(e) => setMaster({ ...master, fineValue: e.target.value })}
                  />
                </div>
              ) : null}

              <button className="nx-btn-primary mt-5 w-full !py-2.5" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Master Entry"}
              </button>
              {editingMasterId ? (
                <button type="button" className="nx-btn-secondary mt-2 w-full" onClick={resetMasterForm}>
                  Cancel edit
                </button>
              ) : null}
            </form>

            <div className="nx-card overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-[18px] font-bold text-slate-900">Fee Master Entries</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="nx-table min-w-[820px]">
                  <thead>
                    <tr>
                      <th>Fees Group</th>
                      <th>Fee Type</th>
                      <th>Fee Code</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Fine Type</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterPageRows.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium text-slate-800">{item.feeGroup.name}</td>
                        <td className="text-slate-700">{item.feeType.name}</td>
                        <td className="text-slate-500">{item.feeType.code || "—"}</td>
                        <td className="text-slate-600">{item.dueDate.slice(0, 10)}</td>
                        <td className="font-semibold text-slate-900">{formatMoney(item.amount)}</td>
                        <td>
                          <span className={finePill(item.fineType)}>{fineLabel(item.fineType)}</span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                              onClick={() => startEditMaster(item)}
                            >
                              <EditOutlined sx={{ fontSize: 18 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-[#6366f1] hover:bg-indigo-50"
                              onClick={() => void removeMaster(item)}
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!setup.masters.length ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                          No fee master entries yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <ListPagination
                page={masterPage}
                pageSize={MASTER_PAGE_SIZE}
                total={setup.masters.length}
                onPageChange={setMasterPage}
                label="entries"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="nx-card flex items-center gap-4 bg-indigo-50/50 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                <LayersOutlined sx={{ fontSize: 22 }} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total Groups</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900">{setup.groups.length} Groups</p>
              </div>
            </article>
            <article className="nx-card flex items-center gap-4 bg-indigo-50/50 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                <DescriptionOutlined sx={{ fontSize: 22 }} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Fee Master Count</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900">{setup.masters.length} Entries</p>
              </div>
            </article>
            <article className="nx-card flex items-center gap-4 bg-indigo-50/50 p-4">
              <div className="grid size-11 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                <GroupsOutlined sx={{ fontSize: 22 }} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Assigned Classes</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900">{assignedClassCount} Sections</p>
              </div>
            </article>
          </div>
        </div>
      ) : null}
    </section>
  );
}
