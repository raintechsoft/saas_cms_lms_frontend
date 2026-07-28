import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CloseOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import type { FeeDiscount, FeeSetup } from "./types";
import { formatMoney } from "./utils";

const PAGE_SIZE = 8;

const DISCOUNT_CATEGORIES = [
  "RTE",
  "SCHOLARSHIP",
  "SIBLING",
  "STAFF WARD",
  "MERIT",
  "OTHER",
] as const;

export function DiscountsPanel({
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
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeDiscount | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [amountType, setAmountType] = useState<"FIXED" | "PERCENTAGE">("FIXED");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => setup.discounts, [setup.discounts]);
  const pageRows = useMemo(() => paginateItems(rows, page, PAGE_SIZE), [rows, page]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, page]);

  function reset() {
    setEditing(null);
    setName("");
    setCode("");
    setCategory("");
    setAmountType("FIXED");
    setValue("");
    setDescription("");
    setShowForm(false);
  }

  function startEdit(item: FeeDiscount) {
    setShowForm(true);
    setEditing(item);
    setName(item.name);
    setCode(item.code ?? "");
    setCategory(item.category ?? "");
    setAmountType(item.type);
    setValue(String(Number(item.value)));
    setDescription(item.description ?? "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      onError("");
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        category: category.trim() || null,
        description: description.trim() || null,
        type: amountType,
        value: Number(value),
      };
      if (editing) {
        await apiRequest(`/fees/discounts/${editing.id}`, token, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/fees/discounts", token, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      reset();
      setPage(1);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save discount");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: FeeDiscount) {
    const ok = await confirmDelete({
      title: "Delete discount?",
      text: `"${item.name}" will be removed if not in use.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/fees/discounts/${item.id}`, token, { method: "DELETE" });
      if (editing?.id === item.id) reset();
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete discount");
    }
  }

  function categoryPill(categoryValue?: string | null) {
    const valueText = (categoryValue || "OTHER").toUpperCase();
    if (valueText === "RTE") return "nx-pill nx-pill-indigo";
    if (valueText === "SCHOLARSHIP") return "nx-pill nx-pill-warning";
    if (valueText === "SIBLING") return "nx-pill nx-pill-neutral";
    if (valueText.includes("STAFF")) return "nx-pill nx-pill-success";
    return "nx-pill nx-pill-neutral";
  }

  return (
    <section className="mt-5 space-y-4">
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="flex w-full max-w-2xl max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onSubmit={(e) => void submit(e)}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-[18px] font-bold text-slate-900">
                {editing ? "Edit discount" : "Add discount"}
              </h3>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={reset}
                aria-label="Close"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="grid shrink-0 gap-3 px-5 py-4 sm:grid-cols-2">
              <div>
                <label className="nx-label">Discount Name</label>
                <input
                  className="nx-input"
                  placeholder="Enter discount name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="nx-label">Discount Code</label>
                <input
                  className="nx-input"
                  placeholder="Enter discount code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>

              <div>
                <label className="nx-label">Type</label>
                <select
                  className="nx-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select type</option>
                  {DISCOUNT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="nx-label">Amount</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-slate-500">
                    {amountType === "PERCENTAGE" ? "%" : "₹"}
                  </span>
                  <input
                    className="nx-input pl-8"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Enter amount"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="nx-label">Amount Type</label>
                <div className="mt-1.5 flex flex-wrap gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-[14px] text-slate-700">
                    <input
                      type="radio"
                      name="amountType"
                      className="size-4 accent-[#6366f1]"
                      checked={amountType === "FIXED"}
                      onChange={() => setAmountType("FIXED")}
                    />
                    Fixed amount
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[14px] text-slate-700">
                    <input
                      type="radio"
                      name="amountType"
                      className="size-4 accent-[#6366f1]"
                      checked={amountType === "PERCENTAGE"}
                      onChange={() => setAmountType("PERCENTAGE")}
                    />
                    Percentage
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="nx-label">Description (Optional)</label>
                <textarea
                  className="nx-input min-h-[72px] resize-none"
                  rows={2}
                  placeholder="Enter description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              <button className="nx-btn-primary w-full !py-2.5" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Discount"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[28px] font-bold text-slate-900">Active Discounts</h3>
            <button type="button" className="nx-btn-primary" onClick={() => setShowForm(true)}>
              + Add discount
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[860px]">
            <thead>
              <tr>
                <th>Discount Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold text-slate-900">{item.name}</td>
                  <td className="text-slate-500">{item.code || "—"}</td>
                  <td>
                    <span className={categoryPill(item.category)}>{item.category || item.type}</span>
                  </td>
                  <td className="font-semibold text-slate-900">
                    {item.type === "PERCENTAGE" ? `${Number(item.value)}%` : formatMoney(item.value)}
                  </td>
                  <td>
                    <span className={`nx-pill ${item.isActive === false ? "nx-pill-neutral" : "nx-pill-success"}`}>
                      {item.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                        onClick={() => startEdit(item)}
                      >
                        <EditOutlined sx={{ fontSize: 18 }} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => void remove(item)}
                      >
                        <DeleteOutline sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No discounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
          label="categories"
        />
      </div>
    </section>
  );
}
