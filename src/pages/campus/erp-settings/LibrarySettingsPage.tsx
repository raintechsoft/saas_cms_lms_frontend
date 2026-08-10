import { useEffect, useState, type ReactNode } from "react";
import {
  AddOutlined,
  BookmarkBorderOutlined,
  DeleteOutline,
  EditOutlined,
  HelpOutlineOutlined,
  InfoOutlined,
  ListAltOutlined,
  MenuBookOutlined,
  PeopleOutline,
  QrCode2Outlined,
  SaveOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  moduleEnabled: boolean;
  libraryName: string;
  accessionPrefix: string;
  defaultIssuePeriodDays: number;
  allowRenewals: boolean;
  maxBooksPerMember: number;
  maxRenewalsPerBook: number;
  reservationValidityDays: number;
  returnGracePeriodDays: number;
  fineType: "PER_DAY" | "FLAT";
  fineAmount: number;
  maxFinePerBook: number;
  processingFee: number;
  enableReservations: boolean;
  dueDateReminders: boolean;
  notifyOnOverdue: boolean;
  allowFineExemptions: boolean;
  autoCalculateFine: boolean;
  showAvailabilityToStudents: boolean;
  allowMemberSelfRegistration: boolean;
  barcodeType: "CODE128" | "CODE39" | "EAN13" | "QR";
  barcodePrefix: string;
  barcodeStartingNumber: number;
};

type MemberType = {
  id: string;
  name: string;
  color: string;
  maxBooks: number;
  issuePeriodDays: number;
  maxRenewals: number;
  finePerDay: number;
};

type CategoryNode = {
  id: string;
  name: string;
  isActive: boolean;
  bookCount: number;
  children: CategoryNode[];
};

type Setup = {
  settings: Settings;
  memberTypes: MemberType[];
  categories: CategoryNode[];
  flatCategories: Array<{ id: string; name: string; parentId: string | null }>;
  overview: {
    totalBooks: number;
    totalMembers: number;
    issuedBooks: number;
    overdueBooks: number;
  };
  quickActions: Array<{ key: string; label: string; href: string }>;
  note: string;
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-primary" : "bg-[#D1D5DB]"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  disabled,
  onChange,
  icon,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[#F3F4F6] px-3 py-2.5">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
          {description ? <p className="text-xs text-[#9CA3AF]">{description}</p> : null}
        </div>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function CategoryTree({
  nodes,
  parentId = null,
  depth = 0,
  canManage,
  onEdit,
  onDelete,
}: {
  nodes: CategoryNode[];
  parentId?: string | null;
  depth?: number;
  canManage: boolean;
  onEdit: (id: string, name: string, parentId: string | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className={depth ? "ml-4 border-l border-[#E5E7EB] pl-3" : "space-y-1"}>
      {nodes.map((node) => (
        <li key={node.id} className="py-1">
          <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F9FAFB]">
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">{node.name}</p>
              <p className="text-[11px] text-[#9CA3AF]">{node.bookCount} books</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={!canManage}
                onClick={() => onEdit(node.id, node.name, parentId)}
                className="rounded p-1 text-primary hover:bg-primary/10"
              >
                <EditOutlined className="!text-[16px]" />
              </button>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => onDelete(node.id)}
                className="rounded p-1 text-rose-600 hover:bg-rose-50"
              >
                <DeleteOutline className="!text-[16px]" />
              </button>
            </div>
          </div>
          {node.children.length ? (
            <CategoryTree
              nodes={node.children}
              parentId={node.id}
              depth={depth + 1}
              canManage={canManage}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function LibrarySettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Library Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "library.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);

  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    id: "",
    name: "",
    color: "#10B981",
    maxBooks: 5,
    issuePeriodDays: 14,
    maxRenewals: 2,
    finePerDay: 5,
  });

  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    parentId: "",
  });

  function applySetup(data: Setup) {
    setSetup(data);
    setForm({ ...data.settings });
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/library-settings", accessToken);
      applySetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load library settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function save() {
    if (!accessToken || !canManage || !form) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/library-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      applySetup(data);
      notifySuccess("Library configuration saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveMember() {
    if (!accessToken || !canManage) return;
    if (!memberForm.name.trim()) {
      notifyError("Member type name is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/library-settings/member-types", accessToken, {
        method: memberForm.id ? "PUT" : "POST",
        body: JSON.stringify({
          id: memberForm.id || undefined,
          name: memberForm.name.trim(),
          color: memberForm.color,
          maxBooks: memberForm.maxBooks,
          issuePeriodDays: memberForm.issuePeriodDays,
          maxRenewals: memberForm.maxRenewals,
          finePerDay: memberForm.finePerDay,
        }),
      });
      applySetup(data);
      setMemberModal(false);
      notifySuccess(memberForm.id ? "Member type updated" : "Member type added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save member type");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this member type?")) return;
    try {
      const data = await apiRequest<Setup>(
        `/erp/library-settings/member-types/${id}`,
        accessToken,
        { method: "DELETE" },
      );
      applySetup(data);
      notifySuccess("Member type deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete member type");
    }
  }

  async function saveCategory() {
    if (!accessToken || !canManage) return;
    if (!categoryForm.name.trim()) {
      notifyError("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/library-settings/categories", accessToken, {
        method: categoryForm.id ? "PUT" : "POST",
        body: JSON.stringify({
          id: categoryForm.id || undefined,
          name: categoryForm.name.trim(),
          parentId: categoryForm.parentId || null,
        }),
      });
      applySetup(data);
      setCategoryModal(false);
      notifySuccess(categoryForm.id ? "Category updated" : "Category added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save category");
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this category?")) return;
    try {
      const data = await apiRequest<Setup>(
        `/erp/library-settings/categories/${id}`,
        accessToken,
        { method: "DELETE" },
      );
      applySetup(data);
      notifySuccess("Category deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete category");
    }
  }

  async function generateBarcodePreview() {
    if (!accessToken || !canManage || !form) return;
    try {
      // Persist barcode fields first so preview matches form
      const data = await apiRequest<Setup>("/erp/library-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          barcodeType: form.barcodeType,
          barcodePrefix: form.barcodePrefix,
          barcodeStartingNumber: form.barcodeStartingNumber,
        }),
      });
      applySetup(data);
      const preview = await apiRequest<{ preview: string }>(
        "/erp/library-settings/barcode-preview",
        accessToken,
      );
      setBarcodePreview(preview.preview);
      notifySuccess(`Next barcode: ${preview.preview}`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to preview barcode");
    }
  }

  if (loading || !setup || !form) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading library settings…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Operations <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Library Settings</h1>
          <p className="text-xs text-[#6B7280]">
            Configure library circulation, fines, member types, categories and barcodes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => notifySuccess("Library configuration changes are audited")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <ListAltOutlined className="!text-[18px]" />
            Audit Log
          </button>
          <button
            type="button"
            onClick={() =>
              notifySuccess("Set policies, member types and categories, then save configuration")
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
          </button>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">1. Library Configuration</h2>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#1A1A1A]">Enable Library Module</p>
                <Toggle
                  checked={form.moduleEnabled}
                  disabled={!canManage}
                  onChange={() => setForm({ ...form, moduleEnabled: !form.moduleEnabled })}
                />
              </div>
              <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
                Library Name
                <input
                  className={`${inputClass} mt-1`}
                  value={form.libraryName}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, libraryName: e.target.value })}
                />
              </label>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#6B7280]">
                  Accession Number Prefix
                  <input
                    className={`${inputClass} mt-1`}
                    value={form.accessionPrefix}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, accessionPrefix: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-semibold text-[#6B7280]">
                  Default Issue Period (Days)
                  <input
                    type="number"
                    className={`${inputClass} mt-1`}
                    value={form.defaultIssuePeriodDays}
                    disabled={!canManage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultIssuePeriodDays: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#1A1A1A]">Allow Renewals</p>
                <Toggle
                  checked={form.allowRenewals}
                  disabled={!canManage}
                  onChange={() => setForm({ ...form, allowRenewals: !form.allowRenewals })}
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">2. Circulation &amp; Due Policy</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["maxBooksPerMember", "Max Books Per Member"],
                    ["maxRenewalsPerBook", "Max Renewals Per Book"],
                    ["reservationValidityDays", "Reservation Validity (Days)"],
                    ["returnGracePeriodDays", "Return Grace Period (Days)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs font-semibold text-[#6B7280]">
                    {label}
                    <input
                      type="number"
                      className={`${inputClass} mt-1`}
                      value={form[key]}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">3. Fine &amp; Charges</h2>
              <p className="mb-2 text-xs font-semibold text-[#6B7280]">Fine Type</p>
              <div className="mb-3 flex gap-4 text-sm">
                {(
                  [
                    ["PER_DAY", "Per Day"],
                    ["FLAT", "Flat"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="fineType"
                      checked={form.fineType === value}
                      disabled={!canManage}
                      onChange={() => setForm({ ...form, fineType: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["fineAmount", "Fine Amount (₹)"],
                    ["maxFinePerBook", "Max Fine Per Book (₹)"],
                    ["processingFee", "Processing Fee (₹)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs font-semibold text-[#6B7280]">
                    {label}
                    <input
                      type="number"
                      className={`${inputClass} mt-1`}
                      value={form[key]}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1A1A1A]">4. Member Types</h2>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    setMemberForm({
                      id: "",
                      name: "",
                      color: "#10B981",
                      maxBooks: 5,
                      issuePeriodDays: 14,
                      maxRenewals: 2,
                      finePerDay: 5,
                    });
                    setMemberModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <AddOutlined className="!text-[16px]" />
                  Add Member Type
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                    <tr>
                      <th className="px-2 py-2 font-semibold">#</th>
                      <th className="px-2 py-2 font-semibold">Member Type</th>
                      <th className="px-2 py-2 font-semibold">Max Books</th>
                      <th className="px-2 py-2 font-semibold">Issue Period</th>
                      <th className="px-2 py-2 font-semibold">Renewals</th>
                      <th className="px-2 py-2 font-semibold">Fine (₹/Day)</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.memberTypes.map((item, index) => (
                      <tr key={item.id} className="border-b border-[#F3F4F6]">
                        <td className="px-2 py-2.5">{index + 1}</td>
                        <td className="px-2 py-2.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                            style={{ backgroundColor: item.color }}
                          >
                            {item.name}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">{item.maxBooks}</td>
                        <td className="px-2 py-2.5">{item.issuePeriodDays}</td>
                        <td className="px-2 py-2.5">{item.maxRenewals}</td>
                        <td className="px-2 py-2.5">{Number(item.finePerDay).toFixed(2)}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => {
                                setMemberForm({
                                  id: item.id,
                                  name: item.name,
                                  color: item.color,
                                  maxBooks: item.maxBooks,
                                  issuePeriodDays: item.issuePeriodDays,
                                  maxRenewals: item.maxRenewals,
                                  finePerDay: item.finePerDay,
                                });
                                setMemberModal(true);
                              }}
                              className="rounded p-1 text-primary hover:bg-primary/10"
                            >
                              <EditOutlined className="!text-[18px]" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => void removeMember(item.id)}
                              className="rounded p-1 text-rose-600 hover:bg-rose-50"
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
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#1A1A1A]">5. Book Categories</h2>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    setCategoryForm({ id: "", name: "", parentId: "" });
                    setCategoryModal(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <AddOutlined className="!text-[16px]" />
                  Add Category
                </button>
              </div>
              <CategoryTree
                nodes={setup.categories}
                canManage={canManage}
                onEdit={(id, name, parentId) => {
                  setCategoryForm({
                    id,
                    name,
                    parentId: parentId || "",
                  });
                  setCategoryModal(true);
                }}
                onDelete={(id) => void removeCategory(id)}
              />
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">6. General Settings</h2>
              <div className="grid gap-2 md:grid-cols-2">
                <ToggleSetting
                  label="Enable Book Reservations"
                  checked={form.enableReservations}
                  disabled={!canManage}
                  onChange={() =>
                    setForm({ ...form, enableReservations: !form.enableReservations })
                  }
                />
                <ToggleSetting
                  label="Send Due Date Reminders"
                  checked={form.dueDateReminders}
                  disabled={!canManage}
                  onChange={() => setForm({ ...form, dueDateReminders: !form.dueDateReminders })}
                />
                <ToggleSetting
                  label="Notify on Overdue"
                  checked={form.notifyOnOverdue}
                  disabled={!canManage}
                  onChange={() => setForm({ ...form, notifyOnOverdue: !form.notifyOnOverdue })}
                />
                <ToggleSetting
                  label="Allow Fine Exemptions"
                  checked={form.allowFineExemptions}
                  disabled={!canManage}
                  onChange={() =>
                    setForm({ ...form, allowFineExemptions: !form.allowFineExemptions })
                  }
                />
                <ToggleSetting
                  label="Auto Calculate Fine"
                  checked={form.autoCalculateFine}
                  disabled={!canManage}
                  onChange={() =>
                    setForm({ ...form, autoCalculateFine: !form.autoCalculateFine })
                  }
                />
                <ToggleSetting
                  label="Show Book Availability to Students"
                  checked={form.showAvailabilityToStudents}
                  disabled={!canManage}
                  onChange={() =>
                    setForm({
                      ...form,
                      showAvailabilityToStudents: !form.showAvailabilityToStudents,
                    })
                  }
                />
                <ToggleSetting
                  label="Allow Member Self Registration"
                  checked={form.allowMemberSelfRegistration}
                  disabled={!canManage}
                  onChange={() =>
                    setForm({
                      ...form,
                      allowMemberSelfRegistration: !form.allowMemberSelfRegistration,
                    })
                  }
                />
              </div>
            </section>

            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <InfoOutlined className="mt-0.5 !text-[18px]" />
              <p>
                <span className="font-semibold">Note:</span> {setup.note}
              </p>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Library Quick Actions</h2>
              <ul className="space-y-1">
                {setup.quickActions.map((action) => (
                  <li key={action.key}>
                    <Link
                      to={action.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#374151] hover:bg-primary/5 hover:text-primary"
                    >
                      <BookmarkBorderOutlined className="!text-[16px]" />
                      {action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Library Overview</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "Total Books",
                    value: setup.overview.totalBooks.toLocaleString(),
                    icon: <MenuBookOutlined className="!text-[18px] text-violet-600" />,
                  },
                  {
                    label: "Total Members",
                    value: setup.overview.totalMembers.toLocaleString(),
                    icon: <PeopleOutline className="!text-[18px] text-sky-600" />,
                  },
                  {
                    label: "Issued Books",
                    value: setup.overview.issuedBooks.toLocaleString(),
                    icon: <BookmarkBorderOutlined className="!text-[18px] text-emerald-600" />,
                  },
                  {
                    label: "Overdue Books",
                    value: setup.overview.overdueBooks.toLocaleString(),
                    icon: <WarningAmberOutlined className="!text-[18px] text-rose-600" />,
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-lg border border-[#E5E7EB] p-3">
                    <div className="mb-1">{card.icon}</div>
                    <p className="text-[11px] font-semibold uppercase text-[#9CA3AF]">
                      {card.label}
                    </p>
                    <p className="text-lg font-bold text-[#1A1A1A]">{card.value}</p>
                  </div>
                ))}
              </div>
              <Link
                to="/library"
                className="mt-3 inline-block text-xs font-semibold text-primary"
              >
                View Details →
              </Link>
            </section>

            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Barcode Settings</h2>
              <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
                Barcode Type
                <select
                  className={`${inputClass} mt-1`}
                  value={form.barcodeType}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcodeType: e.target.value as Settings["barcodeType"],
                    })
                  }
                >
                  <option value="CODE128">Code 128</option>
                  <option value="CODE39">Code 39</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="QR">QR Code</option>
                </select>
              </label>
              <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
                Barcode Prefix
                <input
                  className={`${inputClass} mt-1`}
                  value={form.barcodePrefix}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, barcodePrefix: e.target.value })}
                />
              </label>
              <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
                Starting Number
                <input
                  type="number"
                  className={`${inputClass} mt-1`}
                  value={form.barcodeStartingNumber}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      barcodeStartingNumber: Number(e.target.value) || 1,
                    })
                  }
                />
              </label>
              {barcodePreview ? (
                <p className="mb-2 rounded-lg bg-[#F3F4F6] px-3 py-2 text-center font-mono text-sm font-bold text-[#1A1A1A]">
                  {barcodePreview}
                </p>
              ) : null}
              <button
                type="button"
                disabled={!canManage}
                onClick={() => void generateBarcodePreview()}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary"
              >
                <QrCode2Outlined className="!text-[16px]" />
                Generate Next Barcode Preview
              </button>
            </section>
          </aside>
        </div>
      </div>

      {memberModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold">
              {memberForm.id ? "Edit Member Type" : "Add Member Type"}
            </h3>
            <div className="mt-3 space-y-3">
              <input
                className={inputClass}
                placeholder="Name"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
              />
              <input
                type="color"
                className="h-10 w-full rounded-lg border border-[#E5E7EB]"
                value={memberForm.color}
                onChange={(e) => setMemberForm({ ...memberForm, color: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Max books"
                  value={memberForm.maxBooks}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, maxBooks: Number(e.target.value) || 1 })
                  }
                />
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Issue days"
                  value={memberForm.issuePeriodDays}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      issuePeriodDays: Number(e.target.value) || 1,
                    })
                  }
                />
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Renewals"
                  value={memberForm.maxRenewals}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      maxRenewals: Number(e.target.value) || 0,
                    })
                  }
                />
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Fine/day"
                  value={memberForm.finePerDay}
                  onChange={(e) =>
                    setMemberForm({
                      ...memberForm,
                      finePerDay: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                onClick={() => setMemberModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void saveMember()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {categoryModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold">
              {categoryForm.id ? "Edit Category" : "Add Category"}
            </h3>
            <div className="mt-3 space-y-3">
              <input
                className={inputClass}
                placeholder="Category name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />
              <select
                className={inputClass}
                value={categoryForm.parentId}
                onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value })}
              >
                <option value="">No parent (top level)</option>
                {setup.flatCategories
                  .filter((c) => c.id !== categoryForm.id && !c.parentId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                onClick={() => setCategoryModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void saveCategory()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
