import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, OpsPanel, opsBtnPrimary, opsBtnSecondary, opsLink, opsLinkMuted } from "./platformUi";
import {
  PRODUCT_MODES,
  TENANT_STATUSES,
  TENANT_TYPES,
  type ProductMode,
  type ResellerRow,
  type TenantRow,
  type TenantStatus,
} from "./types";

export function AdminTenantsPage() {
  const { accessToken } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [productMode, setProductMode] = useState("");
  const [resellerId, setResellerId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      if (productMode) params.set("productMode", productMode);
      if (resellerId) params.set("resellerId", resellerId);
      const qs = params.toString() ? `?${params}` : "";
      const [nextTenants, nextResellers] = await Promise.all([
        apiRequest<TenantRow[]>(`/platform/tenants${qs}`, accessToken),
        apiRequest<ResellerRow[]>("/platform/resellers", accessToken),
      ]);
      setTenants(nextTenants);
      setResellers(nextResellers);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load tenants");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function changeStatus(id: string, next: TenantStatus) {
    if (!window.confirm(`Set tenant status to ${next}?`)) return;
    try {
      await apiRequest(`/platform/tenants/${id}/status`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      setMessage(`Tenant ${next.toLowerCase()}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update status");
    }
  }

  async function changeMode(id: string, mode: ProductMode) {
    try {
      await apiRequest(`/platform/tenants/${id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ productMode: mode }),
      });
      setMessage("Product mode updated");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update mode");
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        title="Tenants"
        description={`${tenants.length} institutions on the platform`}
        action={
          <Link className={opsBtnPrimary} to="/admin/tenants/new">
            New tenant
          </Link>
        }
      />

      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>
      )}

      <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-5">
        <input className="input" placeholder="Search name or slug" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {TENANT_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {TENANT_TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="input" value={productMode} onChange={(e) => setProductMode(e.target.value)}>
          <option value="">All modes</option>
          {PRODUCT_MODES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select className="input" value={resellerId} onChange={(e) => setResellerId(e.target.value)}>
            <option value="">All resellers</option>
            {resellers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className={opsBtnSecondary} type="button" onClick={load}>
            Filter
          </button>
        </div>
      </div>

      <OpsPanel title="Tenant registry" code="02">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-3 pr-3">Tenant</th>
                <th className="pb-3 pr-3">Type</th>
                <th className="pb-3 pr-3">Mode</th>
                <th className="pb-3 pr-3">Distribution</th>
                <th className="pb-3 pr-3">Reseller</th>
                <th className="pb-3 pr-3">Users</th>
                <th className="pb-3 pr-3">Students</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="py-3 pr-3">
                    <Link className={opsLink} to={`/admin/tenants/${tenant.id}`}>
                      {tenant.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-zinc-400">/{tenant.slug}</span>
                  </td>
                  <td className="py-3 pr-3 text-zinc-700">{tenant.type}</td>
                  <td className="py-3 pr-3">
                    <select
                      className="input py-1 text-xs"
                      value={tenant.productMode}
                      disabled={tenant.type === "INDIVIDUAL"}
                      onChange={(e) => changeMode(tenant.id, e.target.value as ProductMode)}
                    >
                      {PRODUCT_MODES.map((mode) => (
                        <option key={mode} value={mode} disabled={tenant.type === "INDIVIDUAL" && mode !== "LMS"}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3 text-zinc-700">{tenant.distributionModel}</td>
                  <td className="py-3 pr-3 text-zinc-700">{tenant.reseller?.name ?? "—"}</td>
                  <td className="py-3 pr-3 text-zinc-700">{tenant.users}</td>
                  <td className="py-3 pr-3 text-zinc-700">{tenant.students}</td>
                  <td className="py-3 pr-3">
                    <span className={tenant.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{tenant.status}</span>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link className={opsLinkMuted} to={`/admin/tenants/${tenant.id}/edit`}>
                        Edit
                      </Link>
                      {tenant.status !== "ACTIVE" && (
                        <button className="text-xs font-semibold text-emerald-700" type="button" onClick={() => changeStatus(tenant.id, "ACTIVE")}>
                          Activate
                        </button>
                      )}
                      {tenant.status !== "SUSPENDED" && (
                        <button className="text-xs font-semibold text-amber-700" type="button" onClick={() => changeStatus(tenant.id, "SUSPENDED")}>
                          Suspend
                        </button>
                      )}
                      {tenant.status !== "ARCHIVED" && (
                        <button className="text-xs font-semibold text-rose-700" type="button" onClick={() => changeStatus(tenant.id, "ARCHIVED")}>
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td className="py-8 text-zinc-400" colSpan={9}>
                    No tenants match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </OpsPanel>
    </div>
  );
}
