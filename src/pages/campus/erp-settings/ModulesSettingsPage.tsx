import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  CloseOutlined,
  EditOutlined,
  GridViewOutlined,
  GroupOutlined,
  InfoOutlined,
  MoreVertOutlined,
  SearchOutlined,
  SettingsOutlined,
  ViewListOutlined,
  WidgetsOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type ModuleGroup = "CORE" | "CMS" | "LMS" | "SYSTEM" | "WEBSITE";

type ModuleRow = {
  id: string;
  moduleKey: string;
  label: string;
  description: string;
  groupKey: ModuleGroup;
  sortOrder: number;
  isConfigured: boolean;
  adminEnabled: boolean;
  studentEnabled: boolean;
  parentEnabled: boolean;
  isActive: boolean;
  users: number;
  isCustom: boolean;
};

type Setup = {
  stats: {
    totalModules: number;
    activeModules: number;
    configuredModules: number;
    totalUsers: number;
  };
  groups: Array<{ key: string; label: string; count: number }>;
  modules: ModuleRow[];
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const EMPTY_FORM = {
  label: "",
  description: "",
  groupKey: "CMS" as ModuleGroup,
  moduleKey: "",
  adminEnabled: true,
  studentEnabled: true,
  parentEnabled: true,
  isConfigured: true,
};

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: ReactNode;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="truncate text-lg font-bold text-[#1A1A1A]">{value}</p>
        <div className="text-xs text-[#9CA3AF]">{hint}</div>
      </div>
    </div>
  );
}

function moduleIcon(group: ModuleGroup) {
  const tone =
    group === "LMS"
      ? "bg-sky-50 text-sky-600"
      : group === "SYSTEM"
        ? "bg-violet-50 text-violet-600"
        : group === "WEBSITE"
          ? "bg-amber-50 text-amber-600"
          : group === "CORE"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-primary/10 text-primary";
  return (
    <div className={`rounded-lg p-1.5 ${tone}`}>
      <WidgetsOutlined className="!text-[18px]" />
    </div>
  );
}

export function ModulesSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Modules";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/modules-setup", accessToken);
      setSetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load modules");
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
    return (setup?.modules ?? []).filter((item) => {
      if (groupFilter !== "ALL" && item.groupKey !== groupFilter) return false;
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.moduleKey.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.groupKey.toLowerCase().includes(q)
      );
    });
  }, [setup, groupFilter, statusFilter, search]);

  function openCreate() {
    setEditingKey(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
    setMenuId(null);
  }

  function openEdit(module: ModuleRow) {
    setEditingKey(module.moduleKey);
    setForm({
      label: module.label,
      description: module.description,
      groupKey: module.groupKey,
      moduleKey: module.moduleKey,
      adminEnabled: module.adminEnabled,
      studentEnabled: module.studentEnabled,
      parentEnabled: module.parentEnabled,
      isConfigured: module.isConfigured,
    });
    setEditorOpen(true);
    setMenuId(null);
  }

  async function saveModule(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = editingKey
        ? await apiRequest<Setup>(`/erp/modules-setup/${editingKey}`, accessToken, {
            method: "PUT",
            body: JSON.stringify(form),
          })
        : await apiRequest<Setup>("/erp/modules-setup", accessToken, {
            method: "POST",
            body: JSON.stringify(form),
          });
      setSetup(data);
      setEditorOpen(false);
      notifySuccess(editingKey ? "Module updated" : "Module added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save module");
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(moduleKey: string, adminEnabled?: boolean) {
    if (!accessToken || !canManage) return;
    try {
      const data = await apiRequest<Setup>(
        `/erp/modules-setup/${moduleKey}/toggle`,
        accessToken,
        { method: "POST", body: JSON.stringify({ adminEnabled }) },
      );
      setSetup(data);
      notifySuccess("Module status updated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update module");
    }
  }

  async function removeModule(moduleKey: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this custom module?")) return;
    setMenuId(null);
    try {
      const data = await apiRequest<Setup>(`/erp/modules-setup/${moduleKey}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Module deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete module");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading modules…</div>;
  }

  const stats = setup.stats;
  const allSelected =
    filtered.length > 0 && filtered.every((item) => selected[item.moduleKey]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Modules</h1>
          <p className="text-xs text-[#6B7280]">
            Manage ERP modules, enable/disable and configure module access for your institution.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Add Module
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Modules"
            value={stats.totalModules}
            hint="All modules in system"
            tone="bg-violet-50"
            icon={<WidgetsOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Active Modules"
            value={stats.activeModules}
            hint="Currently active"
            tone="bg-emerald-50"
            icon={<CheckCircleOutline className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Configured Modules"
            value={stats.configuredModules}
            hint="With custom settings"
            tone="bg-sky-50"
            icon={<SettingsOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            hint="Using system modules"
            tone="bg-amber-50"
            icon={<GroupOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={inputClass + " w-40"}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="ALL">All Groups</option>
                {setup.groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label} ({g.count})
                  </option>
                ))}
              </select>
              <select
                className={inputClass + " w-36"}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <div className="relative">
                <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  className={`${inputClass} w-52 pl-8`}
                  placeholder="Search modules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold ${
                  view === "grid" ? "bg-primary text-white" : "bg-white text-[#6B7280]"
                }`}
              >
                <GridViewOutlined className="!text-[16px]" />
                Grid View
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold ${
                  view === "list" ? "bg-primary text-white" : "bg-white text-[#6B7280]"
                }`}
              >
                <ViewListOutlined className="!text-[16px]" />
                List View
              </button>
            </div>
          </div>

          {view === "list" ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                  <tr>
                    <th className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          const next: Record<string, boolean> = {};
                          if (e.target.checked) {
                            for (const item of filtered) next[item.moduleKey] = true;
                          }
                          setSelected(next);
                        }}
                      />
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Module Name</th>
                    <th className="px-3 py-2.5 font-semibold">Group</th>
                    <th className="px-3 py-2.5 font-semibold">Description</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Users</th>
                    <th className="px-3 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((module) => (
                    <tr key={module.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[module.moduleKey])}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [module.moduleKey]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {moduleIcon(module.groupKey)}
                          <div>
                            <p className="font-semibold text-[#1A1A1A]">{module.label}</p>
                            <p className="font-mono text-[11px] text-[#9CA3AF]">
                              {module.moduleKey}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs font-semibold text-[#4B5563]">
                          {module.groupKey}
                        </span>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-[#6B7280]">{module.description}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => void toggleModule(module.moduleKey)}
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold disabled:opacity-50 ${
                            module.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {module.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-3 py-3 font-semibold text-[#1A1A1A]">{module.users}</td>
                      <td className="relative px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!canManage}
                            className="rounded p-1 text-primary hover:bg-[#F3F4F6] disabled:opacity-50"
                            onClick={() => openEdit(module)}
                          >
                            <EditOutlined className="!text-[18px]" />
                          </button>
                          <button
                            type="button"
                            disabled={!canManage}
                            className="rounded p-1 text-primary hover:bg-[#F3F4F6] disabled:opacity-50"
                            onClick={() => openEdit(module)}
                            title="Settings"
                          >
                            <SettingsOutlined className="!text-[18px]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]"
                            onClick={() =>
                              setMenuId((id) => (id === module.id ? null : module.id))
                            }
                          >
                            <MoreVertOutlined className="!text-[18px]" />
                          </button>
                        </div>
                        {menuId === module.id ? (
                          <div className="absolute right-3 z-10 mt-1 w-40 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                              onClick={() => void toggleModule(module.moduleKey, !module.isActive)}
                            >
                              {module.isActive ? "Disable" : "Enable"}
                            </button>
                            {module.isCustom ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-[#F9FAFB]"
                                onClick={() => void removeModule(module.moduleKey)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#9CA3AF]">
                        No modules match your filters
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((module) => (
                <div
                  key={module.id}
                  className="rounded-xl border border-[#E5E7EB] p-4 hover:border-primary/40"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {moduleIcon(module.groupKey)}
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{module.label}</p>
                        <p className="text-xs text-[#9CA3AF]">{module.groupKey}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        module.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {module.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-[#6B7280]">{module.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#9CA3AF]">{module.users} users</span>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => openEdit(module)}
                      className="text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#4C1D95]">
          <div className="mb-1 flex items-center gap-2 font-bold">
            <InfoOutlined className="!text-[18px]" />
            Module Management
          </div>
          <ul className="list-disc space-y-1 pl-5 text-[#5B21B6]">
            <li>Enable or disable modules as per your institution&apos;s requirements.</li>
            <li>Configure module settings and permissions for different user roles.</li>
            <li>Monitor module usage and performance.</li>
            <li>Add custom modules for extended functionality.</li>
          </ul>
        </div>
      </div>

      {editorOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={(e) => void saveModule(e)}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A1A]">
                {editingKey ? "Edit Module" : "Add Module"}
              </h2>
              <button type="button" onClick={() => setEditorOpen(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Module Name</span>
                <input
                  className={inputClass}
                  required
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                />
              </label>
              {!editingKey ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                    Module Key (optional)
                  </span>
                  <input
                    className={inputClass}
                    value={form.moduleKey}
                    placeholder="auto-generated from name"
                    onChange={(e) => setForm((p) => ({ ...p, moduleKey: e.target.value }))}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Group</span>
                <select
                  className={inputClass}
                  value={form.groupKey}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, groupKey: e.target.value as ModuleGroup }))
                  }
                >
                  <option value="CORE">CORE</option>
                  <option value="CMS">CMS</option>
                  <option value="LMS">LMS</option>
                  <option value="SYSTEM">SYSTEM</option>
                  <option value="WEBSITE">WEBSITE</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Description</span>
                <textarea
                  className={inputClass + " min-h-[80px]"}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.adminEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, adminEnabled: e.target.checked }))}
                  />
                  Enable for Admin panel
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.studentEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, studentEnabled: e.target.checked }))}
                  />
                  Enable for Student panel
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.parentEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, parentEnabled: e.target.checked }))}
                  />
                  Enable for Parent panel
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isConfigured}
                    onChange={(e) => setForm((p) => ({ ...p, isConfigured: e.target.checked }))}
                  />
                  Mark as configured
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Module"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
