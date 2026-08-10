import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AddOutlined,
  AssignmentOutlined,
  BadgeOutlined,
  CampaignOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  CloseOutlined,
  DashboardOutlined,
  DeleteOutline,
  DirectionsBusOutlined,
  DownloadOutlined,
  EditOutlined,
  EventBusyOutlined,
  EventOutlined,
  HelpOutlineOutlined,
  InfoOutlined,
  Inventory2Outlined,
  KeyboardOutlined,
  LibraryBooksOutlined,
  MenuBookOutlined,
  MeetingRoomOutlined,
  PaymentsOutlined,
  PeopleOutlined,
  PersonAddOutlined,
  PersonOutlined,
  PrintOutlined,
  QuizOutlined,
  ReceiptLongOutlined,
  RefreshOutlined,
  RestartAltOutlined,
  SaveOutlined,
  ScheduleOutlined,
  SchoolOutlined,
  SearchOutlined,
  SelectAllOutlined,
  SettingsOutlined,
  TodayOutlined,
  TuneOutlined,
  UndoOutlined,
  UploadFileOutlined,
  AssessmentOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type ShortcutItem = {
  id: string;
  actionKey: string;
  label: string;
  module: string;
  category: string;
  shortcut: string;
  defaultShortcut: string;
  description: string;
  icon: string;
  isEnabled: boolean;
  isCustom: boolean;
  status: "ACTIVE" | "CUSTOM";
};

type Setup = {
  shortcuts: ShortcutItem[];
  modules: string[];
  categories: string[];
  stats: {
    total: number;
    active: number;
    custom: number;
    defaultCount: number;
  };
};

const PAGE_SIZE = 10;
const inputClass =
  "rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const ICON_MAP: Record<string, ReactNode> = {
  save: <SaveOutlined className="!text-[16px]" />,
  search: <SearchOutlined className="!text-[16px]" />,
  refresh: <RefreshOutlined className="!text-[16px]" />,
  print: <PrintOutlined className="!text-[16px]" />,
  help: <HelpOutlineOutlined className="!text-[16px]" />,
  close: <CloseOutlined className="!text-[16px]" />,
  add: <AddOutlined className="!text-[16px]" />,
  delete: <DeleteOutline className="!text-[16px]" />,
  select: <SelectAllOutlined className="!text-[16px]" />,
  undo: <UndoOutlined className="!text-[16px]" />,
  person_add: <PersonAddOutlined className="!text-[16px]" />,
  people: <PeopleOutlined className="!text-[16px]" />,
  person: <PersonOutlined className="!text-[16px]" />,
  upgrade: <TuneOutlined className="!text-[16px]" />,
  download: <DownloadOutlined className="!text-[16px]" />,
  event: <EventOutlined className="!text-[16px]" />,
  today: <TodayOutlined className="!text-[16px]" />,
  report: <AssessmentOutlined className="!text-[16px]" />,
  payments: <PaymentsOutlined className="!text-[16px]" />,
  receipt: <ReceiptLongOutlined className="!text-[16px]" />,
  school: <SchoolOutlined className="!text-[16px]" />,
  menu_book: <MenuBookOutlined className="!text-[16px]" />,
  schedule: <ScheduleOutlined className="!text-[16px]" />,
  assignment: <AssignmentOutlined className="!text-[16px]" />,
  edit: <EditOutlined className="!text-[16px]" />,
  analytics: <AssessmentOutlined className="!text-[16px]" />,
  homework: <AssignmentOutlined className="!text-[16px]" />,
  rate_review: <EditOutlined className="!text-[16px]" />,
  badge: <BadgeOutlined className="!text-[16px]" />,
  event_busy: <EventBusyOutlined className="!text-[16px]" />,
  library: <LibraryBooksOutlined className="!text-[16px]" />,
  bus: <DirectionsBusOutlined className="!text-[16px]" />,
  hostel: <MeetingRoomOutlined className="!text-[16px]" />,
  dashboard: <DashboardOutlined className="!text-[16px]" />,
  settings: <SettingsOutlined className="!text-[16px]" />,
  campaign: <CampaignOutlined className="!text-[16px]" />,
  upload: <UploadFileOutlined className="!text-[16px]" />,
  inventory: <Inventory2Outlined className="!text-[16px]" />,
  quiz: <QuizOutlined className="!text-[16px]" />,
  calendar: <TodayOutlined className="!text-[16px]" />,
};

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
        <p className="text-xs text-[#9CA3AF]">{hint}</p>
      </div>
    </div>
  );
}

function KbdShortcut({ value }: { value: string }) {
  const parts = value.split("+").filter(Boolean);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-[11px] text-[#9CA3AF]">+</span> : null}
          <kbd className="rounded border border-[#E5E7EB] bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] font-semibold text-[#374151]">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutKeysPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Shortcut Keys";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [rows, setRows] = useState<ShortcutItem[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, custom: 0, defaultCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftShortcut, setDraftShortcut] = useState("");
  const [dirty, setDirty] = useState(false);

  function applySetup(data: Setup) {
    setRows(data.shortcuts);
    setModules(data.modules);
    setCategories(data.categories);
    setStats(data.stats);
    setDirty(false);
    setEditingKey(null);
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/shortcut-keys", accessToken);
      applySetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load shortcut keys");
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
    return rows.filter((item) => {
      if (moduleFilter !== "ALL" && item.module !== moduleFilter) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.shortcut.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [rows, moduleFilter, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [moduleFilter, categoryFilter, search]);

  const liveStats = useMemo(() => {
    const custom = rows.filter(
      (item) => item.shortcut !== item.defaultShortcut || item.isCustom,
    ).filter((item) => item.shortcut !== item.defaultShortcut).length;
    return {
      total: rows.length,
      active: rows.filter((item) => item.isEnabled).length,
      custom,
      defaultCount: rows.length - custom,
    };
  }, [rows]);

  function startEdit(item: ShortcutItem) {
    if (!canManage) return;
    setEditingKey(item.actionKey);
    setDraftShortcut(item.shortcut);
  }

  function applyEdit(actionKey: string) {
    const next = draftShortcut.trim();
    if (!next) {
      notifyError("Shortcut key is required");
      return;
    }
    const conflict = rows.find(
      (item) =>
        item.actionKey !== actionKey &&
        item.isEnabled &&
        item.shortcut.toLowerCase() === next.toLowerCase(),
    );
    if (conflict) {
      notifyError(`Shortcut already used by "${conflict.label}"`);
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        item.actionKey === actionKey
          ? {
              ...item,
              shortcut: next,
              isCustom: next !== item.defaultShortcut,
              status: next !== item.defaultShortcut ? "CUSTOM" : "ACTIVE",
            }
          : item,
      ),
    );
    setDirty(true);
    setEditingKey(null);
  }

  function resetOne(item: ShortcutItem) {
    if (!canManage) return;
    setRows((prev) =>
      prev.map((row) =>
        row.actionKey === item.actionKey
          ? {
              ...row,
              shortcut: row.defaultShortcut,
              isCustom: false,
              status: "ACTIVE",
              isEnabled: true,
            }
          : row,
      ),
    );
    setDirty(true);
    if (editingKey === item.actionKey) setEditingKey(null);
  }

  async function saveAll() {
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/shortcut-keys", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          shortcuts: rows.map((item) => ({
            actionKey: item.actionKey,
            shortcut: item.shortcut,
            isEnabled: item.isEnabled,
          })),
        }),
      });
      applySetup(data);
      notifySuccess("Shortcut keys saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save shortcut keys");
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/shortcut-keys/reset", accessToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      applySetup(data);
      notifySuccess("Shortcut keys reset to defaults");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to reset shortcut keys");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading shortcut keys…</div>;
  }

  const displayStats = dirty ? liveStats : stats;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Shortcut Keys</h1>
          <p className="text-xs text-[#6B7280]">
            View and customize keyboard shortcuts to perform actions quickly across the system.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void resetAll()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <RestartAltOutlined className="!text-[18px]" />
            Reset to Default
          </button>
          <button
            type="button"
            disabled={!canManage || saving || !dirty}
            onClick={() => void saveAll()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Shortcuts"
            value={displayStats.total}
            hint="Across all modules"
            tone="bg-violet-50"
            icon={<KeyboardOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Active Shortcuts"
            value={displayStats.active}
            hint="Currently in use"
            tone="bg-sky-50"
            icon={<TuneOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Custom Shortcuts"
            value={displayStats.custom}
            hint="Customized by admin"
            tone="bg-emerald-50"
            icon={<EditOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Default Shortcuts"
            value={displayStats.defaultCount}
            hint="System default"
            tone="bg-amber-50"
            icon={<RestartAltOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              className={inputClass}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="ALL">All Modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <label className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
              <SearchOutlined className="pointer-events-none absolute left-2.5 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
              <input
                className={`${inputClass} w-full pl-9`}
                placeholder="Search shortcut..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Action / Feature</th>
                  <th className="px-3 py-2 font-semibold">Module</th>
                  <th className="px-3 py-2 font-semibold">Category</th>
                  <th className="px-3 py-2 font-semibold">Shortcut Key</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#6B7280]">
                      No shortcuts match your filters.
                    </td>
                  </tr>
                ) : (
                  paged.map((item, index) => {
                    const isEditing = editingKey === item.actionKey;
                    return (
                      <tr key={item.actionKey} className="border-t border-[#F3F4F6] align-top">
                        <td className="px-3 py-2.5 text-[#6B7280]">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-[#F5F3FF] text-primary">
                              {ICON_MAP[item.icon] ?? <KeyboardOutlined className="!text-[16px]" />}
                            </span>
                            <span className="font-semibold text-[#1A1A1A]">{item.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#374151]">{item.module}</td>
                        <td className="px-3 py-2.5 text-[#374151]">{item.category}</td>
                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <div className="flex min-w-[160px] items-center gap-1">
                              <input
                                className={`${inputClass} w-28`}
                                value={draftShortcut}
                                autoFocus
                                placeholder="Ctrl+N"
                                onChange={(e) => setDraftShortcut(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    applyEdit(item.actionKey);
                                  }
                                  if (e.key === "Escape") setEditingKey(null);
                                }}
                              />
                              <button
                                type="button"
                                className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white"
                                onClick={() => applyEdit(item.actionKey)}
                              >
                                OK
                              </button>
                            </div>
                          ) : (
                            <KbdShortcut value={item.shortcut} />
                          )}
                        </td>
                        <td className="max-w-xs px-3 py-2.5 text-[#6B7280]">{item.description}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              item.shortcut !== item.defaultShortcut
                                ? "bg-sky-50 text-sky-700"
                                : "bg-emerald-50 text-emerald-700",
                            ].join(" ")}
                          >
                            {item.shortcut !== item.defaultShortcut ? "Custom" : "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canManage}
                              onClick={() => startEdit(item)}
                              className="rounded p-1 text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                              title="Edit shortcut"
                            >
                              <EditOutlined className="!text-[18px]" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManage || item.shortcut === item.defaultShortcut}
                              onClick={() => resetOne(item)}
                              className="rounded p-1 text-violet-600 hover:bg-violet-50 disabled:opacity-40"
                              title="Reset to default"
                            >
                              <RestartAltOutlined className="!text-[18px]" />
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
            <p>
              Showing {pageStart} to {pageEnd} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
              >
                <ChevronLeftOutlined className="!text-[18px]" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  className={[
                    "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                    num === currentPage
                      ? "bg-primary text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]",
                  ].join(" ")}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
              >
                <ChevronRightOutlined className="!text-[18px]" />
              </button>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1E40AF]">
            <InfoOutlined className="!text-[18px]" />
            About Shortcut Keys
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#1E3A8A]">
            <li>Use shortcut keys to perform actions quickly without using the mouse.</li>
            <li>You can customize shortcuts by clicking the edit icon.</li>
            <li>If a shortcut is already in use, you will be notified.</li>
            <li>Click &quot;Reset to Default&quot; to restore original system shortcuts.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
