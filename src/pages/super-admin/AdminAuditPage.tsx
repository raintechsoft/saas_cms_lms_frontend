import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, OpsPanel, opsBtnSecondary } from "./platformUi";
import type { AuditRow, TenantRow } from "./types";

export function AdminAuditPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState("100");
  const [error, setError] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      if (action.trim()) params.set("action", action.trim());
      if (actor.trim()) params.set("actor", actor.trim());
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
      params.set("limit", limit);
      const [nextRows, nextTenants] = await Promise.all([
        apiRequest<AuditRow[]>(`/platform/audit?${params}`, accessToken),
        apiRequest<TenantRow[]>("/platform/tenants", accessToken),
      ]);
      setRows(nextRows);
      setTenants(nextTenants);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load audit trail");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <OpsPageHeader title="Audit Trail" description="Platform and tenant activity log" />
      {error && <p className="alert-error">{error}</p>}

      <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        <select className="input" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          <option value="">All tenants</option>
          {tenants.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Action contains…" value={action} onChange={(e) => setAction(e.target.value)} />
        <input className="input" placeholder="Actor name or email" value={actor} onChange={(e) => setActor(e.target.value)} />
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-2">
          <select className="input" value={limit} onChange={(e) => setLimit(e.target.value)}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="300">300</option>
          </select>
          <button className={opsBtnSecondary} type="button" onClick={load}>
            Filter
          </button>
        </div>
      </div>

      <OpsPanel title="Event log" code="05">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-3 pr-3">When</th>
                <th className="pb-3 pr-3">Action</th>
                <th className="pb-3 pr-3">Entity</th>
                <th className="pb-3 pr-3">Tenant</th>
                <th className="pb-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap py-3 pr-3">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="py-3 pr-3 font-medium text-zinc-900">{row.action}</td>
                  <td className="py-3 pr-3">{row.entityType}</td>
                  <td className="py-3 pr-3">
                    {row.tenant ?? "Platform"}
                    {row.tenantSlug ? ` (/${row.tenantSlug})` : ""}
                  </td>
                  <td className="py-3">
                    <span className="block">{row.actor ?? "—"}</span>
                    {row.actorEmail && <span className="text-xs text-zinc-400">{row.actorEmail}</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="py-8 text-zinc-400" colSpan={5}>
                    No audit events match these filters.
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
