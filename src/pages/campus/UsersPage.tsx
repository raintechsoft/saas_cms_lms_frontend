import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

interface Permission { id: string; key: string; description: string | null }
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
  status: "ACTIVE" | "DISABLED";
  roles: Array<{ role: Role }>;
}

export function UsersPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load access management");
    }
  }

  useEffect(() => { void load(); }, [accessToken]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="Access management"
        title="Users and roles"
        description="Issue tenant credentials and control permissions."
        action={<button className="button-primary" onClick={() => setShowForm(true)}>
          Add {tab === "users" ? "user" : "role"}
        </button>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      <div className="mt-8 flex gap-2 border-b border-slate-200">
        {(["users", "roles"] as const).map((item) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`}
            onClick={() => { setTab(item); setShowForm(false); }}>
            {item === "users" ? `Users (${users.length})` : `Roles (${roles.length})`}
          </button>
        ))}
      </div>

      {showForm && tab === "users" && (
        <UserForm roles={roles} token={accessToken} onSaved={() => { setShowForm(false); void load(); }}
          onError={setError} />
      )}
      {showForm && tab === "roles" && (
        <RoleForm permissions={permissions} token={accessToken}
          onSaved={() => { setShowForm(false); void load(); }} onError={setError} />
      )}

      {tab === "users" ? (
        <div className="card mt-6 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {user.roles.map(({ role }) => <span className="badge" key={role.id}>{role.name}</span>)}
                  <span className={user.status === "ACTIVE" ? "badge-success" : "badge-danger"}>
                    {user.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <article className="card p-5" key={role.id}>
              <div className="flex items-start justify-between">
                <div><h2 className="font-semibold">{role.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{role.code}</p></div>
                {role.isSystem && <span className="badge">System</span>}
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {role.permissions.length} permissions · {role._count.users} users
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function UserForm({ roles, token, onSaved, onError }: {
  roles: Role[]; token: string; onSaved: () => void; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", roleId: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/users", token, {
        method: "POST",
        body: JSON.stringify({ ...form, roleIds: [form.roleId] }),
      });
      onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create user"); }
  }
  return (
    <form className="card mt-6 grid gap-4 p-5 md:grid-cols-2" onSubmit={submit}>
      <input className="input" placeholder="First name" required value={form.firstName}
        onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      <input className="input" placeholder="Last name" required value={form.lastName}
        onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      <input className="input" type="email" placeholder="Email" required value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input className="input" type="password" minLength={8} placeholder="Temporary password" required
        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select className="input" required value={form.roleId}
        onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
        <option value="">Select role</option>
        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
      <button className="button-primary md:justify-self-start" type="submit">Create user</button>
    </form>
  );
}

function RoleForm({ permissions, token, onSaved, onError }: {
  permissions: Permission[]; token: string; onSaved: () => void; onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/roles", token, {
        method: "POST",
        body: JSON.stringify({ name, code: name, permissionIds: selected }),
      });
      onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create role"); }
  }
  return (
    <form className="card mt-6 p-5" onSubmit={submit}>
      <input className="input max-w-md" placeholder="Role name" required value={name}
        onChange={(e) => setName(e.target.value)} />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {permissions.map((permission) => (
          <label className="flex items-center gap-2 text-sm" key={permission.id}>
            <input type="checkbox" checked={selected.includes(permission.id)}
              onChange={(e) => setSelected(e.target.checked
                ? [...selected, permission.id] : selected.filter((id) => id !== permission.id))} />
            {permission.key}
          </label>
        ))}
      </div>
      <button className="button-primary mt-5" type="submit">Create role</button>
    </form>
  );
}
