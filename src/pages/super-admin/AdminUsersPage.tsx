import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, OpsPanel, opsBtnSecondary, opsLinkMuted } from "./platformUi";
import type { PlatformUser, TenantRow, UserStatus } from "./types";

const ROLE_OPTIONS = [
  "UNIVERSE_SUPER_ADMIN",
  "RESELLER_ADMIN",
  "INSTITUTION_ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "STUDENT",
  "PARENT",
];

export function AdminUsersPage() {
  const { accessToken, user: me } = useAuth();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [selected, setSelected] = useState<PlatformUser | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (role) params.set("role", role);
      if (tenantId) params.set("tenantId", tenantId);
      const qs = params.toString() ? `?${params}` : "";
      const [nextUsers, nextTenants] = await Promise.all([
        apiRequest<PlatformUser[]>(`/platform/users${qs}`, accessToken),
        apiRequest<TenantRow[]>("/platform/tenants", accessToken),
      ]);
      setUsers(nextUsers);
      setTenants(nextTenants);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load users");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function setUserStatus(id: string, next: UserStatus) {
    try {
      await apiRequest(`/platform/users/${id}/status`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setMessage(`User ${next === "ACTIVE" ? "enabled" : "disabled"}`);
      setSelected(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update user");
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader title="Users" description="Platform-wide directory across all tenants" />
      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>
      )}

      <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-5">
        <input className="input" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
        </select>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button className={opsBtnSecondary} type="button" onClick={load}>
          Filter
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <OpsPanel title="User directory" code="04">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-3 pr-3">User</th>
                  <th className="pb-3 pr-3">Tenant</th>
                  <th className="pb-3 pr-3">Roles</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((user) => (
                  <tr key={user.id} className={selected?.id === user.id ? "bg-amber-50" : undefined}>
                    <td className="py-3 pr-3">
                      <button className="text-left" type="button" onClick={() => setSelected(user)}>
                        <span className="block font-medium text-zinc-900">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-zinc-500">{user.email}</span>
                      </button>
                    </td>
                    <td className="py-3 pr-3">{user.tenant?.name ?? user.reseller?.name ?? "Platform"}</td>
                    <td className="py-3 pr-3">{user.roles.join(", ") || "—"}</td>
                    <td className="py-3 pr-3">
                      <span className={user.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{user.status}</span>
                    </td>
                    <td className="py-3">
                      {user.id !== me?.id && (
                        <button
                          className={opsLinkMuted}
                          type="button"
                          onClick={() => setUserStatus(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                        >
                          {user.status === "ACTIVE" ? "Disable" : "Enable"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="py-8 text-zinc-400" colSpan={5}>
                      No users match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel title="User detail" code="INFO">
          {selected ? (
            <div className="space-y-3 text-sm">
              <p className="text-lg font-semibold text-zinc-950">
                {selected.firstName} {selected.lastName}
              </p>
              <p className="text-zinc-500">{selected.email}</p>
              <dl className="space-y-2">
                <div>
                  <dt className="text-zinc-500">Status</dt>
                  <dd>{selected.status}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Tenant</dt>
                  <dd>{selected.tenant?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Reseller</dt>
                  <dd>{selected.reseller?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Roles</dt>
                  <dd>{selected.roles.join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Created</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
              {selected.id !== me?.id && (
                <button
                  className={`${opsBtnSecondary} w-full`}
                  type="button"
                  onClick={() => setUserStatus(selected.id, selected.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                >
                  {selected.status === "ACTIVE" ? "Disable user" : "Enable user"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Select a user to view details.</p>
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
