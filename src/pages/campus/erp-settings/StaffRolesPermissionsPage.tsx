import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  AdminPanelSettingsOutlined,
  DeleteOutline,
  EditOutlined,
  GroupsOutlined,
  LightbulbOutlined,
  MenuBookOutlined,
  PersonRemoveOutlined,
  SaveOutlined,
  SearchOutlined,
  ShieldOutlined,
  VerifiedUserOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Permission = { id: string; key: string; description: string | null };

type StaffMember = {
  id: string;
  name: string;
  email: string;
  employeeNumber: string | null;
  department: string | null;
  status: string;
  roleIds?: string[];
};

type RoleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  staffCount: number;
  permissionIds: string[];
  permissionKeys: string[];
  staff: StaffMember[];
};

type ModuleDef = {
  key: string;
  label: string;
  view: string | null;
  manage: string | null;
  extras: string[];
};

type Setup = {
  stats: {
    totalRoles: number;
    totalStaff: number;
    customRoles: number;
    systemRoles: number;
  };
  roles: RoleItem[];
  permissions: Permission[];
  modules: ModuleDef[];
  assignableStaff: StaffMember[];
};

type MatrixAction = "view" | "add" | "edit" | "delete" | "export" | "print";

const PAGE_SIZE = 10;
const MATRIX_ACTIONS: MatrixAction[] = ["view", "add", "edit", "delete", "export", "print"];

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

function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-flex size-10 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </span>
        <div>
          <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
          <p className="text-xs text-[#6B7280]">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** Map matrix column to underlying permission key(s) for a module. */
function keysForAction(mod: ModuleDef, action: MatrixAction): string[] | null {
  if (action === "view") return mod.view ? [mod.view] : null;
  if (action === "add" || action === "edit" || action === "delete") {
    return mod.manage ? [mod.manage] : null;
  }
  if (action === "export") {
    if (mod.key === "reports" && mod.view) return [mod.view];
    if (mod.key === "documents") return ["documents.generate"];
    return null;
  }
  if (action === "print") {
    if (mod.key === "exams" || mod.key === "documents" || mod.key === "reports") {
      return mod.view ? [mod.view] : null;
    }
    return null;
  }
  return null;
}

export function StaffRolesPermissionsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Staff Roles & Permissions";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["roles.manage", "erp.manage", "settings.manage", "hr.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permTab, setPermTab] = useState<"module" | "data">("module");
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(5);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);

  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleActive, setRoleActive] = useState(true);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function load(keepRoleId?: string | null) {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/staff-roles-setup", accessToken);
      setSetup(data);
      const nextId =
        keepRoleId && data.roles.some((r) => r.id === keepRoleId)
          ? keepRoleId
          : selectedRoleId && data.roles.some((r) => r.id === selectedRoleId)
            ? selectedRoleId
            : data.roles[0]?.id ?? null;
      setSelectedRoleId(nextId);
      const role = data.roles.find((r) => r.id === nextId);
      if (role) {
        setRoleName(role.name);
        setRoleDescription(role.description ?? "");
        setRoleActive(role.isActive);
        setSelectedPermissionIds(role.permissionIds);
        setCreating(false);
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load staff roles");
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const roles = setup?.roles ?? [];
  const permissions = setup?.permissions ?? [];
  const modules = setup?.modules ?? [];
  const permissionByKey = useMemo(() => {
    const map = new Map<string, Permission>();
    for (const item of permissions) map.set(item.key, item);
    return map;
  }, [permissions]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) =>
      [role.name, role.code, role.description ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [roles, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRoles = filteredRoles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (!selectedRole || creating) return;
    setRoleName(selectedRole.name);
    setRoleDescription(selectedRole.description ?? "");
    setRoleActive(selectedRole.isActive);
    setSelectedPermissionIds(selectedRole.permissionIds);
    setStaffPage(1);
    setAssignOpen(false);
  }, [selectedRoleId, selectedRole, creating]);

  const selectedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const id of selectedPermissionIds) {
      const perm = permissions.find((p) => p.id === id);
      if (perm) set.add(perm.key);
    }
    return set;
  }, [selectedPermissionIds, permissions]);

  function togglePermissionKey(key: string, enabled: boolean) {
    const perm = permissionByKey.get(key);
    if (!perm) return;
    setSelectedPermissionIds((prev) => {
      if (enabled) return prev.includes(perm.id) ? prev : [...prev, perm.id];
      return prev.filter((id) => id !== perm.id);
    });
  }

  function startCreate() {
    setCreating(true);
    setSelectedRoleId(null);
    setRoleName("");
    setRoleDescription("");
    setRoleActive(true);
    setSelectedPermissionIds([]);
  }

  function selectRole(role: RoleItem) {
    setCreating(false);
    setSelectedRoleId(role.id);
  }

  async function saveConfiguration(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = roleName.trim();
    if (!name) {
      notifyError("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 60);
        const created = await apiRequest<RoleItem>("/roles", accessToken, {
          method: "POST",
          body: JSON.stringify({
            name,
            code,
            description: roleDescription.trim() || null,
            permissionIds: selectedPermissionIds,
            isActive: roleActive,
          }),
        });
        notifySuccess("Role created");
        setCreating(false);
        await load(created.id);
      } else if (selectedRole) {
        await apiRequest(`/roles/${selectedRole.id}`, accessToken, {
          method: "PUT",
          body: JSON.stringify({
            name,
            description: roleDescription.trim() || null,
            permissionIds: selectedPermissionIds,
            isActive: roleActive,
          }),
        });
        notifySuccess("Role configuration saved");
        await load(selectedRole.id);
      } else {
        notifyError("Select or create a role first.");
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save role");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: RoleItem) {
    if (!accessToken || !canManage) return;
    if (role.isSystem) {
      notifyError("System roles cannot be deleted.");
      return;
    }
    const ok = await confirmDelete(`Delete role "${role.name}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/roles/${role.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Role deleted");
      await load(null);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete role");
    } finally {
      setSaving(false);
    }
  }

  async function assignStaff() {
    if (!accessToken || !canManage || !selectedRole || !assignUserIds.length) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/staff-roles/${selectedRole.id}/assign`, accessToken, {
        method: "POST",
        body: JSON.stringify({ userIds: assignUserIds }),
      });
      notifySuccess("Staff assigned to role");
      setAssignOpen(false);
      setAssignUserIds([]);
      await load(selectedRole.id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign staff");
    } finally {
      setSaving(false);
    }
  }

  async function removeStaff(userId: string) {
    if (!accessToken || !canManage || !selectedRole) return;
    const ok = await confirmDelete("Remove this staff member from the role?");
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(
        `/erp/staff-roles/${selectedRole.id}/users/${userId}`,
        accessToken,
        { method: "DELETE" },
      );
      notifySuccess("Staff removed from role");
      await load(selectedRole.id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to remove staff");
    } finally {
      setSaving(false);
    }
  }

  const staffList = selectedRole?.staff ?? [];
  const staffTotalPages = Math.max(1, Math.ceil(staffList.length / staffPageSize));
  const staffCurrentPage = Math.min(staffPage, staffTotalPages);
  const pagedStaff = staffList.slice(
    (staffCurrentPage - 1) * staffPageSize,
    staffCurrentPage * staffPageSize,
  );

  const assignableForRole = (setup?.assignableStaff ?? []).filter(
    (member) => !selectedRole || !member.roleIds?.includes(selectedRole.id),
  );

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
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Staff Roles & Permissions
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage staff roles and define module level permissions.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<AdminPanelSettingsOutlined sx={{ fontSize: 20 }} />}
            tone="bg-violet-50 text-violet-700"
            value={setup?.stats.totalRoles ?? 0}
            label="Total Roles"
          />
          <StatCard
            icon={<GroupsOutlined sx={{ fontSize: 20 }} />}
            tone="bg-emerald-50 text-emerald-700"
            value={setup?.stats.totalStaff ?? 0}
            label="Total Staff"
          />
          <StatCard
            icon={<VerifiedUserOutlined sx={{ fontSize: 20 }} />}
            tone="bg-amber-50 text-amber-700"
            value={setup?.stats.customRoles ?? 0}
            label="Custom Roles"
          />
          <StatCard
            icon={<ShieldOutlined sx={{ fontSize: 20 }} />}
            tone="bg-sky-50 text-sky-700"
            value={setup?.stats.systemRoles ?? 0}
            label="System Roles"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title="1. Roles"
            hint="Create and manage staff roles."
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                disabled={!canManage}
                onClick={startCreate}
              >
                <AddOutlined sx={{ fontSize: 14 }} />
                Add Role
              </button>
            }
          >
            <div className="relative mb-3">
              <SearchOutlined
                sx={{ fontSize: 18 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles..."
                className="w-full rounded-lg border border-[#E5E7EB] py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2 font-semibold">#</th>
                    <th className="px-2 py-2 font-semibold">Role Name</th>
                    <th className="px-2 py-2 font-semibold">Role Type</th>
                    <th className="px-2 py-2 font-semibold">Staff Count</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRoles.map((role, index) => {
                    const selected = !creating && selectedRoleId === role.id;
                    return (
                      <tr
                        key={role.id}
                        className={[
                          "cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F9FAFB]",
                          selected ? "bg-primary/5" : "",
                        ].join(" ")}
                        onClick={() => selectRole(role)}
                      >
                        <td className="px-2 py-2.5 text-[#6B7280]">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{role.name}</td>
                        <td className="px-2 py-2.5">
                          {role.isSystem ? (
                            <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                              System
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-[#374151]">{role.staffCount}</td>
                        <td className="px-2 py-2.5">
                          {role.isActive ? (
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
                              onClick={() => selectRole(role)}
                            >
                              <EditOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                              disabled={!canManage || role.isSystem}
                              onClick={() => void deleteRole(role)}
                            >
                              <DeleteOutline sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
              <span>
                Showing{" "}
                {filteredRoles.length
                  ? `${(currentPage - 1) * PAGE_SIZE + 1} to ${Math.min(currentPage * PAGE_SIZE, filteredRoles.length)}`
                  : "0"}{" "}
                of {filteredRoles.length} roles
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

          <Card
            title="2. Permissions"
            hint="Configure module access for the selected role."
            actions={
              <select
                className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs"
                value={creating ? "" : selectedRoleId ?? ""}
                disabled={creating}
                onChange={(e) => {
                  const role = roles.find((r) => r.id === e.target.value);
                  if (role) selectRole(role);
                }}
              >
                {creating ? <option value="">New role</option> : null}
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            }
          >
            <div className="mb-3 flex gap-2 border-b border-[#E5E7EB]">
              {(
                [
                  ["module", "Module Permissions"],
                  ["data", "Data Permissions"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPermTab(key)}
                  className={[
                    "border-b-2 px-3 py-2 text-xs font-semibold",
                    permTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-[#6B7280]",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {permTab === "module" ? (
              <>
                <div className="max-h-[360px] overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-[#E5E7EB] text-[10px] uppercase tracking-wide text-[#9CA3AF]">
                        <th className="px-2 py-2 font-semibold">Module</th>
                        {MATRIX_ACTIONS.map((action) => (
                          <th key={action} className="px-2 py-2 text-center font-semibold capitalize">
                            {action}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((mod) => (
                        <tr key={mod.key} className="border-b border-[#F3F4F6]">
                          <td className="px-2 py-2 font-medium text-[#1A1A1A]">{mod.label}</td>
                          {MATRIX_ACTIONS.map((action) => {
                            const keys = keysForAction(mod, action);
                            if (!keys) {
                              return (
                                <td key={action} className="px-2 py-2 text-center text-[#9CA3AF]">
                                  —
                                </td>
                              );
                            }
                            const available = keys.filter((k) => permissionByKey.has(k));
                            if (!available.length) {
                              return (
                                <td key={action} className="px-2 py-2 text-center text-[#9CA3AF]">
                                  —
                                </td>
                              );
                            }
                            const checked = available.every((k) => selectedKeys.has(k));
                            return (
                              <td key={action} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!canManage}
                                  onChange={(e) => {
                                    for (const key of available) {
                                      togglePermissionKey(key, e.target.checked);
                                    }
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#6B7280]">
                  <span>Checked (Allowed)</span>
                  <span>Empty (Not Allowed)</span>
                  <span>Dash (Not Applicable)</span>
                </div>
                <p className="mt-2 text-[11px] text-[#9CA3AF]">
                  Add / Edit / Delete map to each module&apos;s manage permission in this system.
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-[#6B7280]">
                  Data permissions control whether this role can view or manage records in key
                  modules.
                </p>
                {[
                  { label: "Students data", view: "students.view", manage: "students.manage" },
                  { label: "Fees data", view: "fees.view", manage: "fees.manage" },
                  { label: "Attendance data", view: "attendance.view", manage: "attendance.manage" },
                  { label: "Exam results", view: "exams.view", manage: "exams.manage" },
                  { label: "HR records", view: "hr.view", manage: "hr.manage" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F3F4F6] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[#1A1A1A]">{row.label}</span>
                    <div className="flex gap-4 text-xs">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.view)}
                          disabled={!canManage || !permissionByKey.has(row.view)}
                          onChange={(e) => togglePermissionKey(row.view, e.target.checked)}
                        />
                        View
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.manage)}
                          disabled={!canManage || !permissionByKey.has(row.manage)}
                          onChange={(e) => togglePermissionKey(row.manage, e.target.checked)}
                        />
                        Manage
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="3. Role Details" hint="Edit the selected role profile.">
            <div className="space-y-3">
              <label className="block">
                <FieldLabel required>Role Name</FieldLabel>
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  disabled={!canManage || (!creating && !selectedRole)}
                />
              </label>
              <label className="block">
                <FieldLabel>Role Type</FieldLabel>
                <input
                  value={creating ? "Custom" : selectedRole?.isSystem ? "System" : "Custom"}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-sm"
                  disabled
                />
              </label>
              <label className="block">
                <FieldLabel>Description</FieldLabel>
                <textarea
                  rows={3}
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                  disabled={!canManage || (!creating && !selectedRole)}
                />
              </label>
              <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-3">
                <span className="text-sm font-semibold text-[#1A1A1A]">Active</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={roleActive}
                  disabled={!canManage || (!creating && !selectedRole)}
                  onClick={() => setRoleActive((v) => !v)}
                  className={[
                    "relative h-7 w-12 rounded-full transition disabled:opacity-50",
                    roleActive ? "bg-primary" : "bg-[#D1D5DB]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
                      roleActive ? "left-[22px]" : "left-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
          </Card>

          <Card
            title="4. Staff Assigned to Role"
            hint="Staff members currently linked to this role."
            actions={
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                disabled={!canManage || !selectedRole || creating}
                onClick={() => setAssignOpen((v) => !v)}
              >
                <AddOutlined sx={{ fontSize: 14 }} />
                Assign Staff
              </button>
            }
          >
            {assignOpen && selectedRole ? (
              <div className="mb-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <FieldLabel>Select staff to assign</FieldLabel>
                <div className="mb-2 max-h-40 space-y-1 overflow-auto">
                  {assignableForRole.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF]">No additional staff available.</p>
                  ) : (
                    assignableForRole.map((member) => (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={assignUserIds.includes(member.id)}
                          onChange={(e) => {
                            setAssignUserIds((prev) =>
                              e.target.checked
                                ? [...prev, member.id]
                                : prev.filter((id) => id !== member.id),
                            );
                          }}
                        />
                        <span>
                          {member.name}
                          {member.employeeNumber ? ` · ${member.employeeNumber}` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    disabled={!assignUserIds.length || saving}
                    onClick={() => void assignStaff()}
                  >
                    Assign selected
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#6B7280]"
                    onClick={() => {
                      setAssignOpen(false);
                      setAssignUserIds([]);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-2 py-2 font-semibold">#</th>
                    <th className="px-2 py-2 font-semibold">Staff Name</th>
                    <th className="px-2 py-2 font-semibold">Employee ID</th>
                    <th className="px-2 py-2 font-semibold">Department</th>
                    <th className="px-2 py-2 font-semibold">Status</th>
                    <th className="px-2 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedRole || creating ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-[#9CA3AF]">
                        Select a role to view assigned staff.
                      </td>
                    </tr>
                  ) : pagedStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-[#9CA3AF]">
                        No staff assigned to this role.
                      </td>
                    </tr>
                  ) : (
                    pagedStaff.map((member, index) => (
                      <tr key={member.id} className="border-b border-[#F3F4F6]">
                        <td className="px-2 py-2.5 text-[#6B7280]">
                          {(staffCurrentPage - 1) * staffPageSize + index + 1}
                        </td>
                        <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{member.name}</td>
                        <td className="px-2 py-2.5 text-[#374151]">
                          {member.employeeNumber || "—"}
                        </td>
                        <td className="px-2 py-2.5 text-[#374151]">
                          {member.department || "—"}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {member.status}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6]"
                              title={member.email}
                            >
                              <VisibilityOutlined sx={{ fontSize: 16 }} />
                            </button>
                            <button
                              type="button"
                              className="rounded-md p-1 text-rose-600 hover:bg-rose-50"
                              disabled={!canManage}
                              onClick={() => void removeStaff(member.id)}
                            >
                              <PersonRemoveOutlined sx={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {selectedRole && !creating ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                <label className="inline-flex items-center gap-2">
                  Rows
                  <select
                    value={staffPageSize}
                    onChange={(e) => {
                      setStaffPageSize(Number(e.target.value));
                      setStaffPage(1);
                    }}
                    className="rounded border border-[#E5E7EB] px-1 py-0.5"
                  >
                    {[5, 10, 20].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                    disabled={staffCurrentPage <= 1}
                    onClick={() => setStaffPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                    disabled={staffCurrentPage >= staffTotalPages}
                    onClick={() => setStaffPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MenuBookOutlined sx={{ fontSize: 18 }} />
              </span>
              <h3 className="text-sm font-bold text-[#1A1A1A]">Quick Guide</h3>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-xs text-[#4B5563]">
              <li>Create a custom role or select an existing one.</li>
              <li>Set module permissions using the matrix checkboxes.</li>
              <li>Save configuration to apply permission changes.</li>
              <li>Assign staff members to the role as needed.</li>
            </ul>
          </section>
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-950">
              <LightbulbOutlined sx={{ fontSize: 18 }} className="text-amber-600" />
              Note
            </div>
            <p className="text-xs text-amber-950/80">
              System roles cannot be deleted. Changes to permissions apply the next time assigned
              staff sign in or refresh their session.
            </p>
          </section>
        </div>
      </div>
    </form>
  );
}
