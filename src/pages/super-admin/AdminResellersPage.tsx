import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, OpsPanel, opsBtnPrimary, opsBtnSecondary, opsLink, opsLinkMuted } from "./platformUi";
import type { ResellerDetail, ResellerRow, TenantRow } from "./types";

export function AdminResellersPage() {
  const { accessToken } = useAuth();
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setResellers(await apiRequest<ResellerRow[]>("/platform/resellers", accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load resellers");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  return (
    <div className="space-y-6">
      <OpsPageHeader
        title="Resellers"
        description="White-label partners and channel distributors"
        action={
          <Link className={opsBtnPrimary} to="/admin/resellers/new">
            New reseller
          </Link>
        }
      />
      {error && <p className="alert-error">{error}</p>}

      <OpsPanel title="Reseller directory" code="03">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="pb-3 pr-3">Name</th>
                <th className="pb-3 pr-3">Slug</th>
                <th className="pb-3 pr-3">Tenants</th>
                <th className="pb-3 pr-3">Users</th>
                <th className="pb-3 pr-3">Created</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {resellers.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-3">
                    <Link className={opsLink} to={`/admin/resellers/${item.id}`}>
                      {item.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-zinc-500">/{item.slug}</td>
                  <td className="py-3 pr-3">{item.tenants}</td>
                  <td className="py-3 pr-3">{item.users}</td>
                  <td className="py-3 pr-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className="py-3">
                    <div className="flex gap-3">
                      <Link className={opsLinkMuted} to={`/admin/resellers/${item.id}`}>
                        View
                      </Link>
                      <Link className={opsLinkMuted} to={`/admin/resellers/${item.id}/edit`}>
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {resellers.length === 0 && (
                <tr>
                  <td className="py-8 text-zinc-400" colSpan={6}>
                    No resellers yet.
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

export function AdminResellerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primaryColor: "#f59e0b",
    logoText: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiRequest<ResellerDetail>(`/platform/resellers/${id}`, accessToken)
      .then((item) => {
        const branding = (item.branding ?? {}) as Record<string, unknown>;
        setForm({
          name: item.name,
          slug: item.slug,
          primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : "#f59e0b",
          logoText: typeof branding.logoText === "string" ? branding.logoText : "",
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load reseller"));
  }, [id, accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const branding = {
        primaryColor: form.primaryColor,
        logoText: form.logoText || form.name,
      };
      if (isEdit && id) {
        await apiRequest(`/platform/resellers/${id}`, accessToken, {
          method: "PUT",
          body: JSON.stringify({ name: form.name, branding }),
        });
        navigate(`/admin/resellers/${id}`);
      } else {
        const created = await apiRequest<{ id: string }>("/platform/resellers", accessToken, {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
            branding,
          }),
        });
        navigate(`/admin/resellers/${created.id}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save reseller");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link className={opsLinkMuted} to="/admin/resellers">
          ← Resellers
        </Link>
        <div className="mt-2">
          <OpsPageHeader title={isEdit ? "Edit reseller" : "Create reseller"} />
        </div>
      </div>
      {error && <p className="alert-error">{error}</p>}
      <form className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm" onSubmit={submit}>
        <label className="block text-sm font-medium text-zinc-700">
          Name
          <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          Slug{!isEdit && " (optional)"}
          <input
            className="input mt-1"
            disabled={isEdit}
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="auto from name"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700">
            Primary color
            <input className="input mt-1" type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Logo text
            <input className="input mt-1" value={form.logoText} onChange={(e) => setForm({ ...form, logoText: e.target.value })} />
          </label>
        </div>
        <div className="flex gap-2">
          <button className={opsBtnPrimary} type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </button>
          <Link className={opsBtnSecondary} to="/admin/resellers">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export function AdminResellerDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [reseller, setReseller] = useState<ResellerDetail | null>(null);
  const [allTenants, setAllTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!id) return;
    try {
      const [detail, tenants] = await Promise.all([
        apiRequest<ResellerDetail>(`/platform/resellers/${id}`, accessToken),
        apiRequest<TenantRow[]>("/platform/tenants", accessToken),
      ]);
      setReseller(detail);
      setAllTenants(tenants);
      setSelected(detail.tenants.map((t) => t.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load reseller");
    }
  }

  useEffect(() => {
    void load();
  }, [id, accessToken]);

  async function saveAssignments() {
    if (!id) return;
    try {
      await apiRequest(`/platform/resellers/${id}/tenants`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ tenantIds: selected }),
      });
      setMessage("Tenant assignments updated");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to assign tenants");
    }
  }

  function toggleTenant(tenantId: string) {
    setSelected((prev) => (prev.includes(tenantId) ? prev.filter((x) => x !== tenantId) : [...prev, tenantId]));
  }

  if (error && !reseller) return <p className="alert-error">{error}</p>;
  if (!reseller) return <p className="text-sm text-zinc-500">Loading…</p>;

  const branding = (reseller.branding ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className={opsLinkMuted} to="/admin/resellers">
            ← Resellers
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{reseller.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            /{reseller.slug} · {reseller.tenantCount} tenants · {reseller.userCount} users
          </p>
        </div>
        <Link className={opsBtnSecondary} to={`/admin/resellers/${reseller.id}/edit`}>
          Edit
        </Link>
      </div>
      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <span
          className="h-10 w-10 rounded-md border border-zinc-200"
          style={{ background: String(branding.primaryColor ?? "#f59e0b") }}
        />
        <div className="text-sm">
          <p className="font-semibold text-zinc-900">{String(branding.logoText ?? reseller.name)}</p>
          <p className="text-zinc-500">Reseller branding</p>
        </div>
      </div>

      <OpsPanel
        title="Assigned tenants"
        code="ASSIGN"
        action={
          <button className={opsBtnPrimary} type="button" onClick={saveAssignments}>
            Save assignments
          </button>
        }
      >
        <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
          {allTenants.map((tenant) => (
            <label
              key={tenant.id}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:border-amber-300"
            >
              <input type="checkbox" checked={selected.includes(tenant.id)} onChange={() => toggleTenant(tenant.id)} />
              <span className="flex-1">
                <span className="font-medium text-zinc-900">{tenant.name}</span>
                <span className="ml-2 font-mono text-xs text-zinc-400">/{tenant.slug}</span>
              </span>
              <span className="text-xs text-zinc-500">{tenant.status}</span>
            </label>
          ))}
        </div>
      </OpsPanel>
    </div>
  );
}
