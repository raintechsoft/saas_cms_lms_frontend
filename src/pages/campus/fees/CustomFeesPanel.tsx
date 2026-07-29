import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AccountBalanceWalletOutlined,
  AddOutlined,
  SearchOutlined,
  UnfoldMoreOutlined,
} from "@mui/icons-material";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { FeeMaster, FeeSetup } from "./types";
import { formatMoney } from "./utils";

const PAGE_SIZE = 5;

type TargetMode = "ALL" | "INDIVIDUAL" | "CLASS";

function targetLabel(master: FeeMaster) {
  const code = master.feeType.code ?? "";
  if (master.classSection) {
    return `${master.classSection.academicClass.name} - ${master.classSection.section.name}`;
  }
  if (code.startsWith("CUSTOM_IND")) return "Individual Basis";
  return "All Students";
}

function targetTooltip(master: FeeMaster, schoolName?: string) {
  if (master.classSection) {
    return `${master.classSection.academicClass.name} ${master.classSection.section.name}`;
  }
  if ((master.feeType.code ?? "").startsWith("CUSTOM_IND")) {
    return schoolName || "Individual students";
  }
  return "Applies to all students";
}

export function CustomFeesPanel({
  setup,
  token,
  schoolName,
  onSaved,
  onError,
  focusCreateSignal = 0,
}: {
  setup: FeeSetup;
  token: string;
  schoolName?: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  focusCreateSignal?: number;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [target, setTarget] = useState<TargetMode | "">("");
  const [classSectionId, setClassSectionId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const customFees = useMemo(
    () =>
      (setup.masters ?? []).filter((master) => master.isCustom).sort((a, b) => {
        const aTime = new Date(a.createdAt ?? 0).getTime();
        const bTime = new Date(b.createdAt ?? 0).getTime();
        return bTime - aTime;
      }),
    [setup.masters],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customFees;
    return customFees.filter((master) => {
      const haystack = [
        master.feeType.name,
        master.feeType.description ?? "",
        targetLabel(master),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [customFees, search]);

  const pageRows = useMemo(() => paginateItems(filtered, page, PAGE_SIZE), [filtered, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filtered.length, page]);

  useEffect(() => {
    if (!focusCreateSignal) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameRef.current?.focus();
  }, [focusCreateSignal]);

  function resetForm() {
    setName("");
    setAmount("0.00");
    setTarget("");
    setClassSectionId("");
    setDescription("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target) {
      onError("Select a target group");
      return;
    }
    if (target === "CLASS" && !classSectionId) {
      onError("Select a class section");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/fees/custom", token, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          amount: Number(amount),
          description: description.trim() || null,
          target,
          classSectionId: target === "CLASS" ? classSectionId : null,
          academicSessionId: setup.currentSession?.id,
        }),
      });
      resetForm();
      notifySuccess("Custom fee created");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create custom fee");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(master: FeeMaster) {
    const next = master.feeType.isActive === false;
    setTogglingId(master.id);
    try {
      await apiRequest(`/fees/custom/${master.id}/active`, token, {
        method: "PUT",
        body: JSON.stringify({ isActive: next }),
      });
      notifySuccess(next ? "Custom fee activated" : "Custom fee deactivated");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update status");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
      <div className="nx-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Existing Custom Fees</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Manage special fee categories and one-off charges.
            </p>
          </div>
          <div className="relative w-full max-w-[220px]">
            <SearchOutlined
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input !h-9 w-full !rounded-lg pl-9 text-[13px]"
              placeholder="Search fees..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="nx-table min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 text-left">
                  <span className="inline-flex items-center gap-1">
                    Fee Name
                    <UnfoldMoreOutlined sx={{ fontSize: 14 }} />
                  </span>
                </th>
                <th className="px-3 py-3 text-left">Target Group</th>
                <th className="px-3 py-3 text-left">Amount</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Date Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No custom fees yet. Create one on the right.
                  </td>
                </tr>
              ) : (
                pageRows.map((master) => {
                  const active = master.feeType.isActive !== false;
                  const created = master.createdAt
                    ? new Date(master.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";
                  return (
                    <tr key={master.id} className="align-top transition hover:bg-indigo-50/30">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{master.feeType.name}</p>
                        <p className="mt-1 line-clamp-2 text-[12px] text-slate-500">
                          {master.feeType.description || "No description provided."}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span
                          title={targetTooltip(master, schoolName)}
                          className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                        >
                          {targetLabel(master)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[13px] font-semibold text-indigo-600">
                        {formatMoney(master.amount)}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-[12.5px] text-slate-600">{created}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                          disabled={togglingId === master.id}
                          onClick={() => void toggleActive(master)}
                        >
                          {togglingId === master.id ? "Updating…" : active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 px-5 py-3">
          <ListPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
            label="custom fee categories"
          />
        </div>
      </div>

      <div className="nx-card h-fit p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <AccountBalanceWalletOutlined sx={{ fontSize: 20 }} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Create Custom Fee</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Define a new special fee category for students.
            </p>
          </div>
        </div>

        <form ref={formRef} className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Fee Name
            </span>
            <input
              ref={nameRef}
              className="nx-input mt-1.5 w-full"
              required
              minLength={2}
              placeholder="e.g. Science Lab Kit"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Amount (₹)
            </span>
            <input
              className="nx-input mt-1.5 w-full"
              required
              type="number"
              min={0.01}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Applicable To
            </span>
            <select
              className="nx-input mt-1.5 w-full"
              required
              value={target === "CLASS" ? `CLASS:${classSectionId}` : target}
              onChange={(event) => {
                const value = event.target.value;
                if (value.startsWith("CLASS:")) {
                  setTarget("CLASS");
                  setClassSectionId(value.slice(6));
                } else {
                  setTarget(value as TargetMode | "");
                  setClassSectionId("");
                }
              }}
            >
              <option value="">Select target group</option>
              <option value="ALL">All Students</option>
              <option value="INDIVIDUAL">Individual Basis</option>
              {setup.classSections.map((section) => (
                <option key={section.id} value={`CLASS:${section.id}`}>
                  {section.academicClass.name} - {section.section.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Description
            </span>
            <textarea
              className="nx-input mt-1.5 min-h-28 w-full"
              placeholder="Provide details about what this fee covers..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <button type="submit" className="nx-btn-primary w-full !justify-center" disabled={saving}>
            <AddOutlined sx={{ fontSize: 16 }} />
            {saving ? "Adding…" : "Add Custom Fee"}
          </button>
        </form>
      </div>
    </section>
  );
}
