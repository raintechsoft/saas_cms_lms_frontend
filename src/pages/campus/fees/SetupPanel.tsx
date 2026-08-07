import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  ArrowDownwardOutlined,
  ArrowUpwardOutlined,
  DeleteOutline,
  DescriptionOutlined,
  EditOutlined,
  GroupsOutlined,
  LayersOutlined,
} from "@mui/icons-material";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { FieldError } from "../../../components/forms/Field";
import { confirmDelete } from "../../../lib/confirm";
import { apiRequest } from "../../../lib/api";
import {
  applyApiFieldErrors,
  clearFieldError,
  type FieldErrors,
  validateRequired,
} from "../../../lib/formErrors";
import { notifySuccess } from "../../../lib/notify";
import type {
  FeeGroup,
  FeeMaster,
  FeeMasterAssignPreview,
  FeeSetup,
  ReceiptBook,
} from "./types";
import { formatMoney, today } from "./utils";

const GROUP_PAGE_SIZE = 6;
const MASTER_PAGE_SIZE = 6;

type FineUi = "NONE" | "FIXED";
type FinePenaltyKind = "RANGE" | "EVERY_DAY";

interface FinePenaltyRow {
  key: string;
  kind: FinePenaltyKind;
  startDate: string;
  endDate: string;
  amount: string;
}

function newPenaltyRow(kind: FinePenaltyKind = "RANGE"): FinePenaltyRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    startDate: today,
    endDate: today,
    amount: "",
  };
}

function fineLabel(fineType?: string, ranges?: FeeMaster["fineRanges"]) {
  if (fineType === "DATE_RANGE") {
    const hasPerDay = ranges?.some((r) => r.perDay);
    const hasRange = ranges?.some((r) => !r.perDay);
    if (hasPerDay && hasRange) return "Mixed fine";
    if (hasPerDay) return "Every day";
    return "Date range";
  }
  if (fineType === "PER_DAY") return "Per-day";
  if (fineType === "PERCENTAGE") return "Percentage";
  if (fineType === "FIXED") return "Fixed";
  return "None";
}

function finePill(fineType?: string) {
  if (fineType === "FIXED" || fineType === "DATE_RANGE") return "nx-pill nx-pill-indigo";
  if (fineType === "PERCENTAGE" || fineType === "PER_DAY") return "nx-pill nx-pill-warning";
  return "nx-pill nx-pill-neutral";
}

function subTabClass(active: boolean) {
  return active
    ? "border-b-2 border-[#6366f1] pb-3 text-[#6366f1]"
    : "border-b-2 border-transparent pb-3 text-slate-500 hover:text-slate-700";
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
  const [subTab, setSubTab] = useState<"types" | "groups" | "masters" | "books">("types");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupTypeIds, setGroupTypeIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(1);

  const [bookForm, setBookForm] = useState({
    name: "",
    prefix: "RCPT-",
    nextNumber: "1",
    isDefault: false,
  });
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  const [master, setMaster] = useState({
    feeGroupId: "",
    feeTypeId: "",
    classSectionId: "",
    dueDate: today,
    amount: "",
    fineUi: "NONE" as FineUi,
  });
  const [finePenalties, setFinePenalties] = useState<FinePenaltyRow[]>([]);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [masterPage, setMasterPage] = useState(1);
  const [assignPreview, setAssignPreview] = useState<FeeMasterAssignPreview | null>(null);
  const [assignMasterIds, setAssignMasterIds] = useState<string[]>([]);
  const [assignSelected, setAssignSelected] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

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
    setFieldErrors((prev) => clearFieldError(prev, "feeTypeIds"));
  }

  async function addFeeType(event: FormEvent) {
    event.preventDefault();
    const errors = validateRequired({ typeName }, [{ key: "typeName", label: "Fee name" }]);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await apiRequest("/fees/types", token, {
        method: "POST",
        body: JSON.stringify({ name: typeName.trim(), code: typeCode.trim() || null }),
      });
      setTypeName("");
      setTypeCode("");
      setFieldErrors({});
      notifySuccess("Fee type created");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors, { name: "typeName" })) {
        onError(cause instanceof Error ? cause.message : "Unable to create fee type");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeFeeType(item: { id: string; name: string; canDelete?: boolean }) {
    if (item.canDelete === false) {
      onError("This fee type is in use and cannot be deleted");
      return;
    }
    const ok = await confirmDelete({
      title: "Delete fee type?",
      text: `"${item.name}" will be permanently deleted.`,
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
    const errors = validateRequired({ groupName }, [{ key: "groupName", label: "Class group name" }]);
    if (!groupTypeIds.length) {
      errors.feeTypeIds = "Select at least one fee type";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
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
      setFieldErrors({});
      setGroupPage(1);
      notifySuccess(editingGroupId ? "Fees class group updated" : "Fees class group saved");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors, { name: "groupName", feeTypeIds: "feeTypeIds" })) {
        onError(cause instanceof Error ? cause.message : "Unable to save fees class group");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(group: FeeGroup) {
    if (group.canDelete === false) {
      onError(
        group.collectedPaymentCount
          ? "Cannot delete this fees class group — student fees have already been collected"
          : "Cannot delete this fees class group while fee master entries still use it",
      );
      return;
    }
    const ok = await confirmDelete({
      title: "Delete fees class group?",
      text: `"${group.name}" will be permanently deleted.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/groups/${group.id}`, token, { method: "DELETE" });
      if (editingGroupId === group.id) resetGroupForm();
      notifySuccess("Fees class group deleted");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete fees class group");
    }
  }

  async function assignGroup(group: FeeGroup) {
    const masters = setup.masters.filter((m) => m.feeGroup.id === group.id);
    if (!masters.length) {
      onError("Create fee master entries for this group (Fees Master tab) before assigning");
      return;
    }
    // Open student picker using the first master as the student scope.
    setAssignLoading(true);
    setAssignPreview(null);
    setAssignMasterIds(masters.map((m) => m.id));
    try {
      const data = await apiRequest<FeeMasterAssignPreview>(
        `/fees/masters/${masters[0].id}/assign-candidates`,
        token,
      );
      setAssignPreview({
        ...data,
        master: {
          ...data.master,
          // Show group-level context in the modal header.
          feeType: {
            ...data.master.feeType,
            name:
              masters.length > 1
                ? `${masters.length} fee types in ${group.name}`
                : data.master.feeType.name,
          },
        },
      });
      setAssignSelected(
        data.students.filter((s) => s.canSelect && s.assigned).map((s) => s.enrollmentId),
      );
    } catch (cause) {
      setAssignMasterIds([]);
      onError(cause instanceof Error ? cause.message : "Unable to load students for assign");
    } finally {
      setAssignLoading(false);
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
    });
    setFinePenalties([]);
  }

  function startEditMaster(item: FeeMaster) {
    setEditingMasterId(item.id);
    const hasRanges = Boolean(item.fineRanges?.length);
    const applyFine =
      item.fineType === "DATE_RANGE" ||
      item.fineType === "FIXED" ||
      item.fineType === "PER_DAY" ||
      item.fineType === "PERCENTAGE";
    setMaster({
      feeGroupId: item.feeGroup.id,
      feeTypeId: item.feeType.id,
      classSectionId: item.classSection?.id ?? "",
      dueDate: item.dueDate.slice(0, 10),
      amount: String(Number(item.amount)),
      fineUi: applyFine ? "FIXED" : "NONE",
    });
    if (hasRanges) {
      setFinePenalties(
        (item.fineRanges ?? []).map((range) => ({
          key: range.id,
          kind: range.perDay ? "EVERY_DAY" : "RANGE",
          startDate: range.startDate.slice(0, 10),
          endDate: (range.endDate ?? range.startDate).slice(0, 10),
          amount: String(Number(range.amount)),
        })),
      );
    } else if (item.fineType === "PER_DAY") {
      setFinePenalties([
        {
          ...newPenaltyRow("EVERY_DAY"),
          amount: String(Number(item.fineValue ?? 0) || ""),
          endDate: today,
        },
      ]);
    } else if (item.fineType === "FIXED" || item.fineType === "PERCENTAGE") {
      setFinePenalties([
        {
          ...newPenaltyRow("RANGE"),
          startDate: item.dueDate.slice(0, 10),
          endDate: item.dueDate.slice(0, 10),
          amount: String(Number(item.fineValue ?? 0) || ""),
        },
      ]);
    } else {
      setFinePenalties([]);
    }
    setSubTab("masters");
  }

  async function saveMaster(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession) {
      onError("No current academic session configured");
      return;
    }
    const errors = validateRequired(
      { feeGroupId: master.feeGroupId, feeTypeId: master.feeTypeId, amount: master.amount },
      [
        { key: "feeGroupId", label: "Fees class group" },
        { key: "feeTypeId", label: "Fee type" },
        {
          key: "amount",
          label: "Amount",
          test: (value) => value != null && Number(value) > 0,
          message: "Enter a valid amount",
        },
      ],
    );
    if (master.fineUi === "FIXED") {
      if (!finePenalties.length) {
        errors.finePenalties = "Add at least one fine range or every-day penalty";
      }
      for (const row of finePenalties) {
        if (!row.amount || Number(row.amount) < 0) {
          errors.finePenalties = "Enter a valid fine amount for each penalty row";
          break;
        }
        if (!row.startDate || (row.kind === "RANGE" && !row.endDate) || (row.kind === "EVERY_DAY" && !row.endDate)) {
          errors.finePenalties = "Complete dates for each fine penalty row";
          break;
        }
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const fineRanges =
        master.fineUi === "FIXED"
          ? finePenalties.map((row) => ({
              startDate: row.startDate,
              endDate: row.endDate || null,
              amount: Number(row.amount),
              perDay: row.kind === "EVERY_DAY",
            }))
          : [];
      const payload = {
        academicSessionId: setup.currentSession.id,
        classSectionId: master.classSectionId || null,
        feeGroupId: master.feeGroupId,
        feeTypeId: master.feeTypeId,
        amount: Number(master.amount),
        dueDate: master.dueDate,
        fineType: master.fineUi === "FIXED" ? "DATE_RANGE" : "NONE",
        fineValue: 0,
        graceDays: 0,
        fineRanges,
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
      setFieldErrors({});
      setMasterPage(1);
      notifySuccess(editingMasterId ? "Fee master updated" : "Fee master saved");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors)) {
        onError(cause instanceof Error ? cause.message : "Unable to save fee master");
      }
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

  async function moveMaster(item: FeeMaster, direction: -1 | 1) {
    const index = setup.masters.findIndex((row) => row.id === item.id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= setup.masters.length) return;
    const orderedIds = setup.masters.map((row) => row.id);
    [orderedIds[index], orderedIds[swapWith]] = [orderedIds[swapWith], orderedIds[index]];
    setSaving(true);
    try {
      await apiRequest("/fees/masters/reorder", token, {
        method: "PUT",
        body: JSON.stringify({ orderedIds }),
      });
      notifySuccess("Fee master order updated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to reorder fee masters");
    } finally {
      setSaving(false);
    }
  }

  async function openAssignMaster(item: FeeMaster) {
    setAssignLoading(true);
    setAssignPreview(null);
    setAssignMasterIds([item.id]);
    try {
      const data = await apiRequest<FeeMasterAssignPreview>(
        `/fees/masters/${item.id}/assign-candidates`,
        token,
      );
      setAssignPreview(data);
      setAssignSelected(
        data.students.filter((s) => s.canSelect && s.assigned).map((s) => s.enrollmentId),
      );
    } catch (cause) {
      setAssignMasterIds([]);
      onError(cause instanceof Error ? cause.message : "Unable to load students for assign");
    } finally {
      setAssignLoading(false);
    }
  }

  function toggleAssignStudent(enrollmentId: string, canSelect: boolean) {
    if (!canSelect) return;
    setAssignSelected((current) =>
      current.includes(enrollmentId)
        ? current.filter((id) => id !== enrollmentId)
        : [...current, enrollmentId],
    );
  }

  async function saveAssignMaster() {
    if (!assignPreview) return;
    const masterIds = assignMasterIds.length
      ? assignMasterIds
      : [assignPreview.master.id];
    setSaving(true);
    try {
      let lastEligible = 0;
      for (const masterId of masterIds) {
        const result = await apiRequest<{ assigned: number; eligible: number }>(
          `/fees/masters/${masterId}/assign`,
          token,
          {
            method: "POST",
            body: JSON.stringify({ enrollmentIds: assignSelected }),
          },
        );
        lastEligible = result.eligible;
      }
      notifySuccess(
        masterIds.length > 1
          ? `Assigned ${masterIds.length} fee types to ${lastEligible} student(s)`
          : `Assigned to ${lastEligible} student(s)`,
      );
      setAssignPreview(null);
      setAssignMasterIds([]);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to assign fees");
    } finally {
      setSaving(false);
    }
  }

  function resetBookForm() {
    setEditingBookId(null);
    setBookForm({ name: "", prefix: "RCPT-", nextNumber: "1", isDefault: false });
  }

  function editBook(book: ReceiptBook) {
    setEditingBookId(book.id);
    setBookForm({
      name: book.name,
      prefix: book.prefix,
      nextNumber: String(book.nextNumber ?? 1),
      isDefault: book.isDefault,
    });
    setSubTab("books");
  }

  async function saveBook(event: FormEvent) {
    event.preventDefault();
    const nextNumber = Number(bookForm.nextNumber);
    const errors = validateRequired({ bookName: bookForm.name, prefix: bookForm.prefix }, [
      { key: "bookName", label: "Book name" },
      { key: "prefix", label: "Prefix" },
    ]);
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      errors.nextNumber = "Enter a valid starting number (1 or greater)";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const body = {
        name: bookForm.name.trim(),
        prefix: bookForm.prefix.trim(),
        nextNumber,
        isDefault: bookForm.isDefault,
      };
      if (editingBookId) {
        await apiRequest(`/fees/receipt-books/${editingBookId}`, token, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Receipt book updated");
      } else {
        await apiRequest("/fees/receipt-books", token, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Receipt book created");
      }
      resetBookForm();
      setFieldErrors({});
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors, { name: "bookName" })) {
        onError(cause instanceof Error ? cause.message : "Unable to save receipt book");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeBook(book: ReceiptBook) {
    const ok = await confirmDelete({
      title: "Delete receipt book?",
      text: `"${book.name}" can only be deleted if it has no payments and is not the default.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/receipt-books/${book.id}`, token, { method: "DELETE" });
      notifySuccess("Receipt book deleted");
      if (editingBookId === book.id) resetBookForm();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete receipt book");
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(
          [
            ["types", "Fees Type"],
            ["groups", "Fees Class Group"],
            ["masters", "Fees Master"],
            ["books", "Receipt Books"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`px-3.5 text-[13.5px] font-semibold transition-colors ${subTabClass(subTab === key)}`}
            onClick={() => {
              setSubTab(key);
              setFieldErrors({});
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "types" ? (
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <form className="nx-card h-fit p-5" onSubmit={(e) => void addFeeType(e)}>
            <h3 className="text-[17px] font-bold text-slate-900">Add fee type</h3>
            <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
              Fee types are building blocks used in class groups and masters (e.g. Tuition, Transport).
            </p>
            <label className="nx-label mt-5">Fee name</label>
            <input
              className={`nx-input${fieldErrors.typeName ? " is-invalid" : ""}`}
              placeholder="e.g. Tuition Fee"
              value={typeName}
              onChange={(e) => {
                setTypeName(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "typeName"));
              }}
            />
            <FieldError error={fieldErrors.typeName} />
            <label className="nx-label mt-4">Fee code</label>
            <input
              className="nx-input"
              placeholder="Optional short code"
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
            />
            <button className="nx-btn-primary mt-5 w-full !py-2.5" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 16 }} />
              {saving ? "Saving..." : "Add fee type"}
            </button>
          </form>

          <div className="nx-card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900">Fee types</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Types linked to groups or masters cannot be deleted.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {setup.types.length} total
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.types.map((item) => {
                    const inUse = item.canDelete === false;
                    return (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-900">{item.name}</td>
                        <td className="font-mono text-[13px] text-slate-500">{item.code || "—"}</td>
                        <td>
                          {inUse ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                              In use
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Available
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end">
                            {inUse ? (
                              <span className="px-2 py-1 text-[11px] font-medium text-slate-400">—</span>
                            ) : (
                              <button
                                type="button"
                                className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title={`Delete ${item.name}`}
                                onClick={() => void removeFeeType(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!setup.types.length ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center">
                        <p className="font-medium text-slate-700">No fee types yet</p>
                        <p className="mt-1 text-[13px] text-slate-500">
                          Add your first fee type using the form on the left.
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {subTab === "groups" ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form className="nx-card h-fit p-5" onSubmit={(e) => void saveGroup(e)}>
            <h3 className="text-[18px] font-bold text-slate-900">
              {editingGroupId ? "Edit fees class group" : "Add fees class group"}
            </h3>

            <label className="nx-label mt-5">Class Group Name</label>
            <input
              className={`nx-input${fieldErrors.groupName ? " is-invalid" : ""}`}
              placeholder="e.g. Class 10-New"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setFieldErrors((prev) => clearFieldError(prev, "groupName"));
              }}
            />
            <FieldError error={fieldErrors.groupName} />
            <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
              Use the same class name as Academics (e.g. Class 1). Add -New or -Old when fee
              structure differs (Class 1-New / Class 1-Old). Use -New when there is only one
              structure per class.
            </p>

            <label className="nx-label mt-4">Select Fee Types</label>
            <div
              className={`mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border bg-white p-3 ${
                fieldErrors.feeTypeIds ? "border-rose-300" : "border-slate-200"
              }`}
            >
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
            <FieldError error={fieldErrors.feeTypeIds} />

            <button className="nx-btn-primary mt-5 w-full !py-2.5" type="submit" disabled={saving}>
              <AddOutlined sx={{ fontSize: 16 }} />
              {saving ? "Saving..." : editingGroupId ? "Save class group" : "Add class group"}
            </button>
            {editingGroupId ? (
              <button type="button" className="nx-btn-secondary mt-2 w-full" onClick={resetGroupForm}>
                Cancel edit
              </button>
            ) : null}
          </form>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Existing fees class groups</h3>
              <p className="mt-1 text-[12px] text-slate-500">
                Delete is hidden after fees are collected for that group (or while masters use it).
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Class Group</th>
                    <th>Fee Types Included</th>
                    <th>Assigned To</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupPageRows.map((group) => (
                    <tr key={group.id}>
                      <td className="font-semibold text-slate-900">
                        {group.name}
                        {(group.collectedPaymentCount ?? 0) > 0 ? (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            Collected
                          </span>
                        ) : null}
                      </td>
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
                          {group.canDelete !== false ? (
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              onClick={() => void removeGroup(group)}
                              title="Delete fees class group"
                            >
                              <DeleteOutline sx={{ fontSize: 18 }} />
                            </button>
                          ) : (
                            <span
                              className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                              title={
                                (group.collectedPaymentCount ?? 0) > 0
                                  ? "Delete locked — fees already collected"
                                  : "Delete locked — used by fee masters"
                              }
                            >
                              Locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!setup.groups.length ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                        No fees class groups yet.
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
              label="class groups"
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

              <label className="nx-label mt-5">Fees Class Group</label>
              <select
                className={`nx-input${fieldErrors.feeGroupId ? " is-invalid" : ""}`}
                value={master.feeGroupId}
                onChange={(e) => {
                  setMaster({ ...master, feeGroupId: e.target.value, feeTypeId: "" });
                  setFieldErrors((prev) => clearFieldError(prev, "feeGroupId"));
                }}
              >
                <option value="">Select class group</option>
                {setup.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <FieldError error={fieldErrors.feeGroupId} />

              <label className="nx-label mt-4">Fee Type</label>
              <select
                className={`nx-input${fieldErrors.feeTypeId ? " is-invalid" : ""}`}
                value={master.feeTypeId}
                onChange={(e) => {
                  setMaster({ ...master, feeTypeId: e.target.value });
                  setFieldErrors((prev) => clearFieldError(prev, "feeTypeId"));
                }}
              >
                <option value="">Select Fee Type</option>
                {selectedGroupTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <FieldError error={fieldErrors.feeTypeId} />

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
                className={`nx-input${fieldErrors.amount ? " is-invalid" : ""}`}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={master.amount}
                onChange={(e) => {
                  setMaster({ ...master, amount: e.target.value });
                  setFieldErrors((prev) => clearFieldError(prev, "amount"));
                }}
              />
              <FieldError error={fieldErrors.amount} />

              <p className="nx-label mt-4">Fine Type</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["NONE", "None"],
                    ["FIXED", "Fixed amount"],
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
                      onChange={() => {
                        setMaster({ ...master, fineUi: value });
                        if (value === "FIXED" && !finePenalties.length) {
                          setFinePenalties([newPenaltyRow("RANGE")]);
                        }
                        if (value === "NONE") setFinePenalties([]);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>

              {master.fineUi === "FIXED" ? (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <FieldError error={fieldErrors.finePenalties} />
                  <p className="text-[12px] leading-5 text-slate-500">
                    Add Range (same fine between dates) and/or Every day (fine increases daily until a date).
                  </p>
                  {finePenalties.map((row, index) => (
                    <div
                      key={row.key}
                      className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-2">
                          {(
                            [
                              ["RANGE", "Range"],
                              ["EVERY_DAY", "Every day"],
                            ] as Array<[FinePenaltyKind, string]>
                          ).map(([kind, label]) => (
                            <label
                              key={kind}
                              className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12px] font-semibold ${
                                row.kind === kind
                                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                  : "border-slate-200 text-slate-500"
                              }`}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                checked={row.kind === kind}
                                onChange={() =>
                                  setFinePenalties((rows) =>
                                    rows.map((item, i) =>
                                      i === index ? { ...item, kind } : item,
                                    ),
                                  )
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {finePenalties.length > 1 ? (
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() =>
                              setFinePenalties((rows) => rows.filter((_, i) => i !== index))
                            }
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="nx-label">
                            {row.kind === "EVERY_DAY" ? "From date" : "Start date"}
                          </label>
                          <input
                            className="nx-input"
                            type="date"
                            value={row.startDate}
                            onChange={(e) =>
                              setFinePenalties((rows) =>
                                rows.map((item, i) =>
                                  i === index ? { ...item, startDate: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="nx-label">
                            {row.kind === "EVERY_DAY" ? "Till date" : "End date"}
                          </label>
                          <input
                            className="nx-input"
                            type="date"
                            value={row.endDate}
                            onChange={(e) =>
                              setFinePenalties((rows) =>
                                rows.map((item, i) =>
                                  i === index ? { ...item, endDate: e.target.value } : item,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="nx-label">
                          {row.kind === "EVERY_DAY" ? "Fine per day (₹)" : "Fine (₹)"}
                        </label>
                        <input
                          className="nx-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={row.amount}
                          onChange={(e) =>
                            setFinePenalties((rows) =>
                              rows.map((item, i) =>
                                i === index ? { ...item, amount: e.target.value } : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
                    onClick={() => setFinePenalties((rows) => [...rows, newPenaltyRow("RANGE")])}
                  >
                    <AddOutlined sx={{ fontSize: 16 }} />
                    Add range / every day
                  </button>
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
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Use arrows to change collection order. Assign/View to select students.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="nx-table min-w-[920px]">
                  <thead>
                    <tr>
                      <th className="w-16">Order</th>
                      <th>Fees Class Group</th>
                      <th>Fee Type</th>
                      <th>Fee Code</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Fine Type</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterPageRows.map((item, pageIndex) => {
                      const absoluteIndex = (masterPage - 1) * MASTER_PAGE_SIZE + pageIndex;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-30"
                                disabled={saving || absoluteIndex === 0}
                                title="Move up"
                                onClick={() => void moveMaster(item, -1)}
                              >
                                <ArrowUpwardOutlined sx={{ fontSize: 16 }} />
                              </button>
                              <button
                                type="button"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-30"
                                disabled={saving || absoluteIndex >= setup.masters.length - 1}
                                title="Move down"
                                onClick={() => void moveMaster(item, 1)}
                              >
                                <ArrowDownwardOutlined sx={{ fontSize: 16 }} />
                              </button>
                            </div>
                          </td>
                          <td className="font-medium text-slate-800">{item.feeGroup.name}</td>
                          <td className="text-slate-700">{item.feeType.name}</td>
                          <td className="text-slate-500">{item.feeType.code || "—"}</td>
                          <td className="text-slate-600">{item.dueDate.slice(0, 10)}</td>
                          <td className="font-semibold text-slate-900">{formatMoney(item.amount)}</td>
                          <td>
                            <span className={finePill(item.fineType)}>
                              {fineLabel(item.fineType, item.fineRanges)}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 hover:underline"
                                disabled={assignLoading || saving}
                                onClick={() => void openAssignMaster(item)}
                              >
                                Assign / View
                              </button>
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
                      );
                    })}
                    {!setup.masters.length ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
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

      {assignPreview || assignLoading ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => {
            if (!saving) {
              setAssignPreview(null);
              setAssignMasterIds([]);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Assign / View students</h3>
              {assignPreview ? (
                <p className="mt-1 text-[13px] text-slate-500">
                  {assignPreview.master.feeGroup.name} · {assignPreview.master.feeType.name} ·{" "}
                  {formatMoney(assignPreview.master.amount)}
                </p>
              ) : null}
              <p className="mt-2 text-[12px] leading-5 text-slate-500">
                No checkbox means fees are already collected or the student is disabled. Revert the
                payment first if you need to change that student&apos;s fee group.
              </p>
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-5 py-3">
              {assignLoading && !assignPreview ? (
                <p className="py-10 text-center text-sm text-slate-500">Loading students…</p>
              ) : null}
              {assignPreview ? (
                <table className="nx-table w-full">
                  <thead>
                    <tr>
                      <th className="w-12"></th>
                      <th>Student</th>
                      <th>Admission #</th>
                      <th>Class</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignPreview.students.map((row) => {
                      const name = `${row.student.firstName} ${row.student.lastName ?? ""}`.trim();
                      const checked = assignSelected.includes(row.enrollmentId);
                      return (
                        <tr key={row.enrollmentId} className={!row.canSelect ? "bg-slate-50" : undefined}>
                          <td>
                            {row.canSelect ? (
                              <input
                                type="checkbox"
                                className="size-4 accent-[#6366f1]"
                                checked={checked}
                                onChange={() => toggleAssignStudent(row.enrollmentId, true)}
                              />
                            ) : (
                              <span className="inline-block w-4" title={row.lockReason ?? undefined} />
                            )}
                          </td>
                          <td className="font-medium text-slate-900">{name}</td>
                          <td className="text-slate-500">{row.student.admissionNumber}</td>
                          <td className="text-slate-600">
                            {row.classSection
                              ? `${row.classSection.academicClass.name} - ${row.classSection.section.name}`
                              : "—"}
                          </td>
                          <td>
                            {row.collected ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Collected
                              </span>
                            ) : row.disabled ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                Disabled
                              </span>
                            ) : row.assigned ? (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                Assigned
                              </span>
                            ) : (
                              <span className="text-[12px] text-slate-400">Not assigned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!assignPreview.students.length ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500">
                          No students found for this fee master scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              {assignPreview ? (
                <p className="text-[12px] text-slate-500">
                  {assignPreview.summary.selectable} selectable · {assignSelected.length} selected ·{" "}
                  {assignPreview.summary.collected} collected · {assignPreview.summary.disabled}{" "}
                  disabled
                </p>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="nx-btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    setAssignPreview(null);
                    setAssignMasterIds([]);
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="nx-btn-primary"
                  disabled={saving || !assignPreview}
                  onClick={() => void saveAssignMaster()}
                >
                  {saving ? "Saving…" : "Save assignments"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {subTab === "books" ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form className="nx-card p-5" onSubmit={(e) => void saveBook(e)}>
            <h3 className="text-[18px] font-bold text-slate-900">
              {editingBookId ? "Edit receipt book" : "Add receipt book"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Receipt numbers use prefix + sequence, e.g. RCPT-000001.
            </p>
            <label className="nx-label mt-5">Book name</label>
            <input
              className={`nx-input${fieldErrors.bookName ? " is-invalid" : ""}`}
              placeholder="Main"
              value={bookForm.name}
              onChange={(e) => {
                setBookForm({ ...bookForm, name: e.target.value });
                setFieldErrors((prev) => clearFieldError(prev, "bookName"));
              }}
            />
            <FieldError error={fieldErrors.bookName} />
            <label className="nx-label mt-4">Prefix</label>
            <input
              className={`nx-input${fieldErrors.prefix ? " is-invalid" : ""}`}
              placeholder="RCPT-"
              value={bookForm.prefix}
              onChange={(e) => {
                setBookForm({ ...bookForm, prefix: e.target.value });
                setFieldErrors((prev) => clearFieldError(prev, "prefix"));
              }}
            />
            <FieldError error={fieldErrors.prefix} />
            <label className="nx-label mt-4">Next number</label>
            <input
              className={`nx-input${fieldErrors.nextNumber ? " is-invalid" : ""}`}
              type="number"
              min={1}
              value={bookForm.nextNumber}
              onChange={(e) => {
                setBookForm({ ...bookForm, nextNumber: e.target.value });
                setFieldErrors((prev) => clearFieldError(prev, "nextNumber"));
              }}
            />
            <FieldError error={fieldErrors.nextNumber} />
            <p className="mt-1 text-[12px] text-slate-500">
              Next receipt preview: {bookForm.prefix}
              {String(Number(bookForm.nextNumber) || 1).padStart(6, "0")}
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={bookForm.isDefault}
                onChange={(e) => setBookForm({ ...bookForm, isDefault: e.target.checked })}
              />
              Set as default receipt book
            </label>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="nx-btn-primary" type="submit" disabled={saving}>
                <AddOutlined sx={{ fontSize: 16 }} />
                {saving ? "Saving…" : editingBookId ? "Update book" : "Add book"}
              </button>
              {editingBookId ? (
                <button type="button" className="nx-btn-secondary" onClick={resetBookForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>

          <div className="nx-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Receipt books</h3>
              <p className="text-sm text-slate-500">Used when collecting fees and generating receipts.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Next #</th>
                    <th>Default</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {setup.receiptBooks.map((book) => (
                    <tr key={book.id}>
                      <td className="font-semibold text-slate-900">{book.name}</td>
                      <td className="font-mono text-sm">{book.prefix}</td>
                      <td className="font-mono text-sm">
                        {book.prefix}
                        {String(book.nextNumber ?? 1).padStart(6, "0")}
                      </td>
                      <td>
                        {book.isDefault ? (
                          <span className="nx-pill nx-pill-indigo">Default</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                            title="Edit"
                            onClick={() => editBook(book)}
                          >
                            <EditOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
                            title="Delete"
                            onClick={() => void removeBook(book)}
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!setup.receiptBooks.length ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                        No receipt books yet. Create one to start collecting fees.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
