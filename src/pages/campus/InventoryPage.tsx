import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CategoryOutlined,
  DeleteOutline,
  EditOutlined,
  Inventory2Outlined,
  LocalShippingOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsKpiCard,
  CmsKpiGrid,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { ListPagination, paginateItems } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type Tab = "items" | "stock" | "issue" | "categories";

interface InventoryCategory {
  id: string;
  name: string;
  isActive: boolean;
  _count: { items: number };
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  quantity: number;
  reorderLevel: number;
  location: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
}

interface InventoryMovement {
  id: string;
  type: "ADD" | "ISSUE" | "RETURN" | "ADJUST";
  quantity: number;
  note: string | null;
  createdAt: string;
  item: { id: string; name: string; sku: string | null; unit: string | null };
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  } | null;
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
}

interface InventorySummary {
  items: number;
  categories: number;
  totalQuantity: number;
  issued: number;
  lowStock: number;
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "items", label: "Items", shortLabel: "Items", icon: Inventory2Outlined, tone: "slate" },
  { key: "stock", label: "Add stock", shortLabel: "Stock", icon: AddOutlined, tone: "emerald" },
  { key: "issue", label: "Issue / Return", shortLabel: "Issue", icon: LocalShippingOutlined, tone: "indigo" },
  { key: "categories", label: "Categories", shortLabel: "Categories", icon: CategoryOutlined, tone: "amber" },
];

const PAGE_SIZE = 8;

function studentLabel(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function InventoryPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("items");
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [issues, setIssues] = useState<InventoryMovement[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [location, setLocation] = useState("");
  const [itemActive, setItemActive] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [stockItemId, setStockItemId] = useState("");
  const [stockQty, setStockQty] = useState("1");
  const [stockNote, setStockNote] = useState("");
  const [issueItemId, setIssueItemId] = useState("");
  const [issueQty, setIssueQty] = useState("1");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [issueNote, setIssueNote] = useState("");

  const canManage = user?.permissions.includes("inventory.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(items, page, PAGE_SIZE), [items, page]);
  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive !== false),
    [categories],
  );
  const activeItems = useMemo(() => items.filter((item) => item.isActive), [items]);
  const stockedItems = useMemo(
    () => activeItems.filter((item) => item.quantity > 0),
    [activeItems],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [items.length, page]);

  function resetItemForm() {
    setEditingItemId(null);
    setName("");
    setSku("");
    setUnit("pcs");
    setCategoryId("");
    setQuantity("0");
    setReorderLevel("0");
    setLocation("");
    setItemActive(true);
    setShowItemForm(false);
  }

  async function load(q = search) {
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [summaryRow, categoryRows, itemRows, movementRows, issueRows, studentResult] =
        await Promise.all([
          apiRequest<InventorySummary>("/inventory/summary", accessToken),
          apiRequest<InventoryCategory[]>("/inventory/categories", accessToken),
          apiRequest<InventoryItem[]>(`/inventory/items${query}`, accessToken),
          apiRequest<InventoryMovement[]>("/inventory/movements?type=ADD&take=50", accessToken),
          apiRequest<InventoryMovement[]>("/inventory/movements?type=ISSUE&take=100", accessToken),
          apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken).catch(
            () => ({ items: [] as StudentOption[] }),
          ),
        ]);
      setSummary(summaryRow);
      setCategories(Array.isArray(categoryRows) ? categoryRows : []);
      setItems(Array.isArray(itemRows) ? itemRows : []);
      setMovements(Array.isArray(movementRows) ? movementRows : []);
      setIssues(Array.isArray(issueRows) ? issueRows : []);
      setStudents(studentResult.items ?? []);
      setPage(1);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  function startEditItem(item: InventoryItem) {
    setEditingItemId(item.id);
    setName(item.name);
    setSku(item.sku ?? "");
    setUnit(item.unit ?? "pcs");
    setCategoryId(item.category?.id ?? "");
    setQuantity(String(item.quantity));
    setReorderLevel(String(item.reorderLevel));
    setLocation(item.location ?? "");
    setItemActive(item.isActive);
    setShowItemForm(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const payload = {
      name,
      sku: sku || null,
      unit: unit || "pcs",
      categoryId: categoryId || null,
      quantity: editingItemId ? undefined : Number(quantity) || 0,
      reorderLevel: Number(reorderLevel) || 0,
      location: location || null,
      isActive: itemActive,
    };
    try {
      if (editingItemId) {
        await apiRequest(`/inventory/items/${editingItemId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Item updated");
      } else {
        await apiRequest("/inventory/items", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Item created");
      }
      resetItemForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save item");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete item?",
      text: "All stock movement history for this item will be removed.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/inventory/items/${id}`, accessToken, { method: "DELETE" });
      if (editingItemId === id) resetItemForm();
      notifySuccess("Item deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete item");
    }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !categoryName.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest("/inventory/categories", accessToken, {
        method: "POST",
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      notifySuccess("Category created");
      setCategoryName("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create category");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCategory(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete category?",
      text: "Items keep their records without a category.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/inventory/categories/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Category deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete category");
    }
  }

  async function addStock(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !stockItemId) return;
    setSubmitting(true);
    try {
      await apiRequest("/inventory/stock/add", accessToken, {
        method: "POST",
        body: JSON.stringify({
          itemId: stockItemId,
          quantity: Number(stockQty) || 1,
          note: stockNote || null,
        }),
      });
      notifySuccess("Stock added");
      setStockItemId("");
      setStockQty("1");
      setStockNote("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add stock");
    } finally {
      setSubmitting(false);
    }
  }

  async function issueItem(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !issueItemId) return;
    setSubmitting(true);
    try {
      await apiRequest("/inventory/issue", accessToken, {
        method: "POST",
        body: JSON.stringify({
          itemId: issueItemId,
          quantity: Number(issueQty) || 1,
          studentId: issueStudentId || null,
          note: issueNote || null,
        }),
      });
      notifySuccess("Item issued");
      setIssueItemId("");
      setIssueQty("1");
      setIssueStudentId("");
      setIssueNote("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to issue item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="Inventory"
        description="Track stock, add items, and issue materials to students."
        actions={
          canManage && tab === "items" ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (showItemForm && !editingItemId) resetItemForm();
                else {
                  setEditingItemId(null);
                  setShowItemForm(true);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showItemForm && !editingItemId ? "Close form" : "Add item"}
            </button>
          ) : null
        }
      />

      <CmsKpiGrid>
        <CmsKpiCard icon={<Inventory2Outlined sx={{ fontSize: 20 }} />} label="Items" value={summary?.items ?? 0} tint="#475569" />
        <CmsKpiCard icon={<AddOutlined sx={{ fontSize: 20 }} />} label="Total qty" value={summary?.totalQuantity ?? 0} tint="#059669" />
        <CmsKpiCard icon={<LocalShippingOutlined sx={{ fontSize: 20 }} />} label="Issues" value={summary?.issued ?? 0} tint="#4f46e5" />
        <CmsKpiCard icon={<WarningAmberOutlined sx={{ fontSize: 20 }} />} label="Low stock" value={summary?.lowStock ?? 0} tint="#d97706" />
      </CmsKpiGrid>

      <CmsIconTabs
        ariaLabel="Inventory sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        items={TABS}
      />

      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "items" ? (
          <>
            {canManage && showItemForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-900">{editingItemId ? "Edit item" : "Add item"}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {editingItemId ? "Update details. Use Add stock to change quantity." : "Optional opening stock is logged as an ADD movement."}
                  </p>
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveItem}>
                  <label>
                    <span className="nx-label">Name *</span>
                    <input className="nx-input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">SKU</span>
                    <input className="nx-input w-full" value={sku} onChange={(e) => setSku(e.target.value)} />
                  </label>
                  <label className="sm:col-span-1">
                    <span className="nx-label">Category</span>
                    <select className="nx-input w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">{activeCategories.length ? "Select category (optional)" : "No categories yet"}</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    {!activeCategories.length ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Create categories in the Categories tab first, then refresh this form.
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">{activeCategories.length} categor{activeCategories.length === 1 ? "y" : "ies"} available</p>
                    )}
                  </label>
                  <label>
                    <span className="nx-label">Unit</span>
                    <input className="nx-input w-full" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
                  </label>
                  {!editingItemId ? (
                    <label>
                      <span className="nx-label">Opening qty</span>
                      <input className="nx-input w-full" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                    </label>
                  ) : null}
                  <label>
                    <span className="nx-label">Reorder level</span>
                    <input className="nx-input w-full" type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Location</span>
                    <input className="nx-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={itemActive} onChange={(e) => setItemActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active</span>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {editingItemId ? "Update item" : "Create item"}
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetItemForm}>Cancel</button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Stock list</h2>
                  <p className="text-xs text-slate-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void load(search);
                  }}
                >
                  <input
                    className="nx-input w-56 text-sm"
                    placeholder="Search name, SKU, location…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="submit" className="nx-btn-secondary text-xs">Search</button>
                </form>
              </div>
              {loading ? (
                <EmptyState icon={<Inventory2Outlined />} title="Loading items…" />
              ) : !items.length ? (
                <EmptyState icon={<Inventory2Outlined />} title="No inventory items yet" hint="Add stationery, lab kits, uniforms, etc." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Qty</th>
                          <th>Reorder</th>
                          <th>Location</th>
                          {canManage ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((item) => {
                          const low = item.quantity <= item.reorderLevel;
                          return (
                            <tr key={item.id}>
                              <td>
                                <p className="font-semibold text-slate-900">{item.name}</p>
                                <p className="text-xs text-slate-500">
                                  {[item.sku, item.unit].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </td>
                              <td>{item.category?.name ?? "—"}</td>
                              <td>
                                <span className={`inline-flex rounded-lg px-2 py-1 text-xs font-bold ${low ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="text-slate-600">{item.reorderLevel}</td>
                              <td className="text-slate-700">{item.location ?? "—"}</td>
                              {canManage ? (
                                <td>
                                  <div className="flex gap-1.5">
                                    <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => startEditItem(item)}>
                                      <EditOutlined sx={{ fontSize: 14 }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600"
                                      onClick={() => void removeItem(item.id)}
                                    >
                                      <DeleteOutline sx={{ fontSize: 14 }} />
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "stock" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <CmsSectionCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900">Add stock</h2>
              <p className="mt-0.5 text-xs text-slate-500">Increase quantity for an existing item.</p>
              {canManage ? (
                <form className="mt-4 grid gap-3" onSubmit={addStock}>
                  <label>
                    <span className="nx-label">Item *</span>
                    <select className="nx-input w-full" value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} required>
                      <option value="">{activeItems.length ? "Select item" : "No items yet — create under Items tab"}</option>
                      {activeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (qty {item.quantity})
                        </option>
                      ))}
                    </select>
                    {!activeItems.length ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Categories alone are not enough. Go to <strong>Items → Add item</strong> first.
                      </p>
                    ) : null}
                  </label>
                  <label>
                    <span className="nx-label">Quantity *</span>
                    <input className="nx-input w-full" type="number" min="1" value={stockQty} onChange={(e) => setStockQty(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Note</span>
                    <input className="nx-input w-full" value={stockNote} onChange={(e) => setStockNote(e.target.value)} placeholder="Purchase / donation" />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Add stock</button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">You need inventory.manage to add stock.</p>
              )}
            </CmsSectionCard>
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Recent stock adds</h2>
              </div>
              {!movements.length ? (
                <EmptyState icon={<AddOutlined />} title="No stock additions yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-xs text-slate-500">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="font-medium text-slate-900">{row.item.name}</td>
                          <td className="font-bold text-emerald-700">+{row.quantity}</td>
                          <td className="text-slate-600">{row.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "issue" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <CmsSectionCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900">Issue item</h2>
              <p className="mt-0.5 text-xs text-slate-500">Optionally assign to a student.</p>
              {canManage ? (
                <form className="mt-4 grid gap-3" onSubmit={issueItem}>
                  <label>
                    <span className="nx-label">Item *</span>
                    <select className="nx-input w-full" value={issueItemId} onChange={(e) => setIssueItemId(e.target.value)} required>
                      <option value="">Select item</option>
                      {stockedItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (qty {item.quantity})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Quantity *</span>
                    <input className="nx-input w-full" type="number" min="1" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Student</span>
                    <select className="nx-input w-full" value={issueStudentId} onChange={(e) => setIssueStudentId(e.target.value)}>
                      <option value="">General / no student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.admissionNumber} · {studentLabel(student)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Note</span>
                    <input className="nx-input w-full" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Issue item</button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">You need inventory.manage to issue items.</p>
              )}
            </CmsSectionCard>
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Recent issues</h2>
              </div>
              {!issues.length ? (
                <EmptyState icon={<LocalShippingOutlined />} title="No issues yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap text-xs text-slate-500">
                            {new Date(row.createdAt).toLocaleString()}
                          </td>
                          <td className="font-medium text-slate-900">{row.item.name}</td>
                          <td className="font-bold text-indigo-700">-{row.quantity}</td>
                          <td className="text-slate-700">
                            {row.student
                              ? `${row.student.admissionNumber} · ${studentLabel(row.student)}`
                              : row.note || "General"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "categories" ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {canManage ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-sm font-bold text-slate-900">Add category</h2>
                <form className="mt-4 grid gap-3" onSubmit={saveCategory}>
                  <label>
                    <span className="nx-label">Name *</span>
                    <input className="nx-input w-full" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Create category</button>
                </form>
              </CmsSectionCard>
            ) : null}
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Categories</h2>
              </div>
              {!categories.length ? (
                <EmptyState icon={<CategoryOutlined />} title="No categories yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Items</th>
                        {canManage ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.id}>
                          <td className="font-semibold text-slate-900">{category.name}</td>
                          <td>{category._count.items}</td>
                          {canManage ? (
                            <td>
                              <button
                                type="button"
                                className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600"
                                onClick={() => void removeCategory(category.id)}
                              >
                                <DeleteOutline sx={{ fontSize: 14 }} />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
