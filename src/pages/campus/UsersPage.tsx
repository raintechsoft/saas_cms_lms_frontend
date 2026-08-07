import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  AdminPanelSettingsOutlined,
  DeleteOutline,
  EditOutlined,
  GroupsOutlined,
  LockOutlined,
  PeopleOutlined,
  ShieldOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader } from "../../components/cms/CmsLayout";
import { CmsIconTabs } from "../../components/cms/CmsIconTabs";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { FieldError } from "../../components/forms/Field";
import { confirmDelete } from "../../lib/confirm";
import { apiRequest } from "../../lib/api";
import {
  applyApiFieldErrors,
  clearFieldError,
  type FieldErrors,
  validateEmail,
  validateRequired,
} from "../../lib/formErrors";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Permission {
  id: string;
  key: string;
  description: string | null;
}
interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ permission: Permission }>;
  _count: { users: number };
}
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: "ACTIVE" | "DISABLED";
  roles: Array<{ role: Role }>;
}

const ROLE_TONES = [
  "from-indigo-50 to-white border-indigo-100",
  "from-sky-50 to-white border-sky-100",
  "from-emerald-50 to-white border-emerald-100",
  "from-violet-50 to-white border-violet-100",
  "from-amber-50 to-white border-amber-100",
  "from-rose-50 to-white border-rose-100",
];

export function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [search, setSearch] = useState("");

  const activeUsers = useMemo(() => users.filter((u) => u.status === "ACTIVE").length, [users]);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.phone ?? "").includes(q) ||
        user.roles.some(({ role }) => role.name.toLowerCase().includes(q))
      );
    });
  }, [users, search]);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? null;
  const selectedRole =
    roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null;

  async function load() {
    try {
      const [nextUsers, nextRoles, nextPermissions] = await Promise.all([
        apiRequest<User[]>("/users", accessToken),
        apiRequest<Role[]>("/roles", accessToken),
        apiRequest<Permission[]>("/permissions", accessToken),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setPermissions(nextPermissions);
      setSelectedUserId((current) => current ?? nextUsers[0]?.id ?? null);
      setSelectedRoleId((current) => current ?? nextRoles[0]?.id ?? null);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load access management");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (selectedUserId && !filteredUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(filteredUsers[0]?.id ?? null);
    }
  }, [filteredUsers, selectedUserId]);

  async function removeUser(user: User) {
    if (user.id === currentUser?.id) {
      notifyError("You cannot delete your own account");
      return;
    }
    const ok = await confirmDelete({
      title: "Delete user?",
      text: `${user.firstName} ${user.lastName} will be deleted if unused, or disabled if they have history.`,
      confirmText: "Yes, delete",
    });
    if (!ok) return;
    try {
      await apiRequest(`/users/${user.id}`, accessToken, { method: "DELETE" });
      notifySuccess("User deleted");
      setMode("view");
      setSelectedUserId(null);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete user");
    }
  }

  const stats = [
    { label: "Users", value: users.length, icon: GroupsOutlined, tint: "#6366f1" },
    { label: "Active", value: activeUsers, icon: VerifiedUserOutlined, tint: "#10b981" },
    { label: "Roles", value: roles.length, icon: ShieldOutlined, tint: "#0ea5e9" },
    { label: "Permissions", value: permissions.length, icon: LockOutlined, tint: "#8b5cf6" },
  ];

  return (
    <CmsPage>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <CmsPageHeader
          title="Users and roles"
          description="Desktop access control — select a row to view details without scrolling the page."
          actions={
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (tab === "users") {
                  setMode("create");
                  setSelectedUserId(null);
                } else {
                  setMode("create");
                  setSelectedRoleId(null);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              Add {tab === "users" ? "user" : "role"}
            </button>
          }
        />

        <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="nx-card flex items-center gap-2.5 px-3 py-2.5"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: `${stat.tint}1f`, color: stat.tint }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </span>
                <div>
                  <p className="text-[18px] font-extrabold leading-none text-slate-900">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <CmsIconTabs
          ariaLabel="Users sections"
          value={tab}
          onChange={(key) => {
            setTab(key);
            setMode("view");
          }}
          columnsClass="grid-cols-2"
          items={[
            {
              key: "users",
              label: `Users (${users.length})`,
              icon: PeopleOutlined,
              tone: "indigo",
            },
            {
              key: "roles",
              label: `Roles (${roles.length})`,
              icon: AdminPanelSettingsOutlined,
              tone: "violet",
            },
          ]}
        />

        {tab === "users" ? (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(280px,0.95fr)_minmax(340px,1.15fr)]">
            <section className="nx-card flex min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-indigo-50 px-3 py-2.5">
                <input
                  className="nx-input !py-2"
                  placeholder="Filter users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredUsers.map((user) => {
                  const name = `${user.firstName} ${user.lastName}`.trim();
                  const active = selectedUser?.id === user.id && mode !== "create";
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setMode("view");
                      }}
                      className={`flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left transition ${
                        active ? "bg-indigo-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <InitialsAvatar name={name || user.email} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{name}</p>
                        <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                      </div>
                      <span
                        className={
                          user.status === "ACTIVE"
                            ? "nx-pill nx-pill-success !px-1.5 !py-0.5 !text-[10px]"
                            : "nx-pill nx-pill-danger !px-1.5 !py-0.5 !text-[10px]"
                        }
                      >
                        {user.status === "ACTIVE" ? "On" : "Off"}
                      </span>
                    </button>
                  );
                })}
                {!filteredUsers.length ? (
                  <p className="p-6 text-center text-[12px] text-slate-500">No users match.</p>
                ) : null}
              </div>
            </section>

            <section className="nx-card flex min-h-0 flex-col overflow-hidden">
              {mode === "create" || mode === "edit" ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <UserForm
                    roles={roles}
                    token={accessToken}
                    initial={mode === "edit" ? selectedUser : null}
                    onCancel={() => setMode("view")}
                    onSaved={async () => {
                      setMode("view");
                      await load();
                    }}
                    onError={notifyError}
                  />
                </div>
              ) : selectedUser ? (
                <UserDetail
                  user={selectedUser}
                  isSelf={selectedUser.id === currentUser?.id}
                  onEdit={() => setMode("edit")}
                  onDelete={() => void removeUser(selectedUser)}
                />
              ) : (
                <p className="m-auto p-6 text-center text-[13px] text-slate-500">
                  Select a user to view details here.
                </p>
              )}
            </section>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(260px,0.9fr)_minmax(340px,1.2fr)]">
            <section className="nx-card flex min-h-0 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {roles.map((role, index) => {
                  const active = selectedRole?.id === role.id && mode !== "create";
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoleId(role.id);
                        setMode("view");
                      }}
                      className={`mb-1.5 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-indigo-200 bg-indigo-50"
                          : `border-transparent bg-gradient-to-br ${ROLE_TONES[index % ROLE_TONES.length]} hover:border-indigo-100`
                      }`}
                    >
                      <span className="grid size-9 place-items-center rounded-xl bg-white/80 text-indigo-600">
                        <AdminPanelSettingsOutlined sx={{ fontSize: 18 }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{role.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {role.permissions.length} permissions · {role._count.users} users
                        </p>
                      </div>
                      {role.isSystem ? (
                        <span className="nx-pill nx-pill-neutral !text-[10px]">System</span>
                      ) : null}
                    </button>
                  );
                })}
                {!roles.length ? (
                  <p className="p-6 text-center text-[12px] text-slate-500">No roles yet.</p>
                ) : null}
              </div>
            </section>

            <section className="nx-card flex min-h-0 flex-col overflow-hidden">
              {mode === "create" ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <RoleForm
                    permissions={permissions}
                    token={accessToken}
                    onCancel={() => setMode("view")}
                    onSaved={async () => {
                      setMode("view");
                      await load();
                    }}
                    onError={notifyError}
                  />
                </div>
              ) : selectedRole ? (
                <RoleDetail role={selectedRole} />
              ) : (
                <p className="m-auto p-6 text-center text-[13px] text-slate-500">
                  Select a role to view permissions here.
                </p>
              )}
            </section>
          </div>
        )}

        <div className="shrink-0">
          <CmsFooter />
        </div>
      </div>
    </CmsPage>
  );
}

function UserDetail({
  user,
  isSelf,
  onEdit,
  onDelete,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50/80 to-white px-4 py-3">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={name || user.email} size={48} />
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">{name}</h2>
            <p className="text-[12px] text-slate-500">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className="nx-btn-secondary !px-2.5 !py-1.5" onClick={onEdit}>
            <EditOutlined sx={{ fontSize: 15 }} />
            Edit
          </button>
          <button
            type="button"
            className="nx-btn-secondary !px-2.5 !py-1.5 !text-rose-600"
            disabled={isSelf}
            onClick={onDelete}
          >
            <DeleteOutline sx={{ fontSize: 15 }} />
            Delete
          </button>
        </div>
      </div>
      <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
        <DetailItem label="Status" value={user.status === "ACTIVE" ? "Active" : "Disabled"} />
        <DetailItem label="Mobile" value={user.phone || "—"} />
        <DetailItem
          label="Roles"
          value={user.roles.map(({ role }) => role.name).join(", ") || "—"}
        />
        <DetailItem label="User ID" value={user.id} mono />
      </div>
    </div>
  );
}

function RoleDetail({ role }: { role: Role }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-indigo-50 bg-gradient-to-r from-sky-50/80 to-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">{role.name}</h2>
            <p className="font-mono text-[11px] text-slate-500">{role.code}</p>
          </div>
          {role.isSystem ? <span className="nx-pill nx-pill-neutral">System</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="nx-pill nx-pill-indigo">{role.permissions.length} permissions</span>
          <span className="nx-pill nx-pill-success">{role._count.users} users</span>
        </div>
        {role.description ? (
          <p className="mt-2 text-[12px] text-slate-600">{role.description}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Permission list
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {role.permissions.map(({ permission }) => (
            <div
              key={permission.id}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2"
            >
              <p className="text-[12px] font-semibold text-slate-800">{permission.key}</p>
              {permission.description ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{permission.description}</p>
              ) : null}
            </div>
          ))}
          {!role.permissions.length ? (
            <p className="col-span-full p-4 text-center text-[12px] text-slate-500">
              No permissions on this role.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-[13px] font-semibold text-slate-800 ${mono ? "break-all font-mono text-[11px]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function UserForm({
  roles,
  token,
  initial,
  onSaved,
  onCancel,
  onError,
}: {
  roles: Role[];
  token: string;
  initial: User | null;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    firstName: initial?.firstName ?? "",
    lastName: initial?.lastName ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    password: "",
    roleId: initial?.roles[0]?.role.id ?? "",
    status: initial?.status ?? "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    setFieldErrors({});
    setForm({
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      password: "",
      roleId: initial?.roles[0]?.role.id ?? "",
      status: initial?.status ?? "ACTIVE",
    });
  }, [initial]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const emailErr = validateEmail(form.email);
    const rules = [
      { key: "firstName", label: "First name" },
      { key: "roleId", label: "Role" },
      ...(isEdit
        ? []
        : [
            {
              key: "password",
              label: "Password",
              test: (value: unknown) => typeof value === "string" && value.trim().length >= 8,
              message: "Password must be at least 8 characters",
            },
          ]),
    ];
    const next = validateRequired(form, rules);
    if (emailErr) next.email = emailErr;
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      if (isEdit && initial) {
        const body: Record<string, unknown> = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone.trim(),
          status: form.status,
          roleIds: [form.roleId],
        };
        if (form.password.trim()) body.password = form.password;
        await apiRequest(`/users/${initial.id}`, token, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiRequest("/users", token, {
          method: "POST",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone.trim(),
            password: form.password,
            roleIds: [form.roleId],
          }),
        });
      }
      notifySuccess(isEdit ? "User updated" : "User created");
      await onSaved();
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors, { roleIds: "roleId" })) {
        onError(cause instanceof Error ? cause.message : `Unable to ${isEdit ? "update" : "create"} user`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void submit(e)}>
      <div className="md:col-span-2 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">{isEdit ? "Edit user" : "Create user"}</h2>
        <button className="nx-btn-secondary !py-1.5" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <label>
        <span className="nx-label">First name</span>
        <input
          className={`nx-input${fieldErrors.firstName ? " is-invalid" : ""}`}
          value={form.firstName}
          onChange={(e) => {
            setFieldErrors((prev) => clearFieldError(prev, "firstName"));
            setForm({ ...form, firstName: e.target.value });
          }}
        />
        <FieldError error={fieldErrors.firstName} />
      </label>
      <label>
        <span className="nx-label">Last name</span>
        <input
          className="nx-input"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
      </label>
      <label>
        <span className="nx-label">Email</span>
        <input
          className={`nx-input${fieldErrors.email ? " is-invalid" : ""}`}
          type="email"
          value={form.email}
          onChange={(e) => {
            setFieldErrors((prev) => clearFieldError(prev, "email"));
            setForm({ ...form, email: e.target.value });
          }}
        />
        <FieldError error={fieldErrors.email} />
      </label>
      <label>
        <span className="nx-label">Mobile</span>
        <input
          className="nx-input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label>
        <span className="nx-label">{isEdit ? "New password (optional)" : "Password"}</span>
        <input
          className={`nx-input${fieldErrors.password ? " is-invalid" : ""}`}
          type="password"
          value={form.password}
          onChange={(e) => {
            setFieldErrors((prev) => clearFieldError(prev, "password"));
            setForm({ ...form, password: e.target.value });
          }}
        />
        <FieldError error={fieldErrors.password} />
      </label>
      <label>
        <span className="nx-label">Role</span>
        <select
          className={`nx-input${fieldErrors.roleId ? " is-invalid" : ""}`}
          value={form.roleId}
          onChange={(e) => {
            setFieldErrors((prev) => clearFieldError(prev, "roleId"));
            setForm({ ...form, roleId: e.target.value });
          }}
        >
          <option value="">Select role</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <FieldError error={fieldErrors.roleId} />
      </label>
      {isEdit ? (
        <label>
          <span className="nx-label">Status</span>
          <select
            className="nx-input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as "ACTIVE" | "DISABLED" })}
          >
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
      ) : null}
      <div className="md:col-span-2">
        <button className="nx-btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save user" : "Create user"}
        </button>
      </div>
    </form>
  );
}

function RoleForm({
  permissions,
  token,
  onSaved,
  onCancel,
  onError,
}: {
  permissions: Permission[];
  token: string;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/roles", token, {
        method: "POST",
        body: JSON.stringify({ name, code: name, permissionIds: selected }),
      });
      notifySuccess("Role created");
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">Create role</h2>
        <button className="nx-btn-secondary !py-1.5" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <label className="mb-3 block max-w-sm">
        <span className="nx-label">Role name</span>
        <input className="nx-input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Permissions</p>
      <div className="grid max-h-[42vh] gap-1.5 overflow-y-auto sm:grid-cols-2">
        {permissions.map((permission) => (
          <label
            key={permission.id}
            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-[12px]"
          >
            <input
              className="mt-0.5"
              type="checkbox"
              checked={selected.includes(permission.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, permission.id]
                    : selected.filter((id) => id !== permission.id),
                )
              }
            />
            <span>
              <span className="font-semibold text-slate-800">{permission.key}</span>
              {permission.description ? (
                <span className="mt-0.5 block text-[11px] text-slate-500">{permission.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      <button className="nx-btn-primary mt-3" type="submit" disabled={saving}>
        {saving ? "Creating…" : "Create role"}
      </button>
    </form>
  );
}
