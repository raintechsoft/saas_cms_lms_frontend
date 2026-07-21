import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, opsBtnPrimary, opsBtnSecondary, opsLinkMuted } from "./platformUi";
import {
  DISTRIBUTION_MODELS,
  PRODUCT_MODES,
  TENANT_TYPES,
  type DistributionModel,
  type ProductMode,
  type ResellerRow,
  type TenantDetail,
  type TenantType,
} from "./types";

const emptyForm = {
  name: "",
  slug: "",
  type: "SCHOOL" as TenantType,
  productMode: "BOTH" as ProductMode,
  distributionModel: "UNIVERSE_AI" as DistributionModel,
  resellerId: "",
  primaryColor: "#0f766e",
  logoText: "",
  customDomain: "",
  adminEmail: "",
  adminFirstName: "",
  adminLastName: "",
  adminPassword: "",
};

export function AdminTenantFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<ResellerRow[]>("/platform/resellers", accessToken)
      .then(setResellers)
      .catch(() => setResellers([]));
  }, [accessToken]);

  useEffect(() => {
    if (!id) return;
    apiRequest<TenantDetail>(`/platform/tenants/${id}`, accessToken)
      .then((tenant) => {
        const branding = (tenant.branding ?? {}) as Record<string, unknown>;
        setForm({
          ...emptyForm,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          productMode: tenant.productMode,
          distributionModel: tenant.distributionModel,
          resellerId: tenant.reseller?.id ?? "",
          primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : "#0f766e",
          logoText: typeof branding.logoText === "string" ? branding.logoText : "",
          customDomain: typeof branding.customDomain === "string" ? branding.customDomain : "",
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load tenant"));
  }, [id, accessToken]);

  function setType(type: TenantType) {
    setForm((prev) => ({
      ...prev,
      type,
      productMode: type === "INDIVIDUAL" ? "LMS" : prev.productMode,
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setTempPassword("");
    try {
      const branding = {
        primaryColor: form.primaryColor,
        logoText: form.logoText || form.name,
        ...(form.customDomain.trim() ? { customDomain: form.customDomain.trim() } : {}),
      };
      if (isEdit && id) {
        await apiRequest(`/platform/tenants/${id}`, accessToken, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            productMode: form.type === "INDIVIDUAL" ? "LMS" : form.productMode,
            distributionModel: form.distributionModel,
            resellerId: form.resellerId || null,
            branding,
          }),
        });
        navigate(`/admin/tenants/${id}`);
      } else {
        const body: Record<string, unknown> = {
          name: form.name,
          type: form.type,
          productMode: form.type === "INDIVIDUAL" ? "LMS" : form.productMode,
          distributionModel: form.distributionModel,
          branding,
        };
        if (form.slug.trim()) body.slug = form.slug.trim();
        if (form.resellerId) body.resellerId = form.resellerId;
        if (form.adminEmail.trim()) {
          body.adminEmail = form.adminEmail.trim();
          if (form.adminFirstName.trim()) body.adminFirstName = form.adminFirstName.trim();
          if (form.adminLastName.trim()) body.adminLastName = form.adminLastName.trim();
          if (form.adminPassword.trim()) body.adminPassword = form.adminPassword.trim();
        }
        const created = await apiRequest<{ tenant: { id: string }; admin: { temporaryPassword?: string } | null }>(
          "/platform/tenants",
          accessToken,
          { method: "POST", body: JSON.stringify(body) },
        );
        if (created.admin?.temporaryPassword) {
          setTempPassword(created.admin.temporaryPassword);
        }
        navigate(`/admin/tenants/${created.tenant.id}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save tenant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link className={opsLinkMuted} to="/admin/tenants">
          ← Tenants
        </Link>
        <div className="mt-2">
          <OpsPageHeader title={isEdit ? "Edit tenant" : "Create tenant"} />
        </div>
      </div>
      {error && <p className="alert-error">{error}</p>}
      {tempPassword && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Temporary admin password: <strong>{tempPassword}</strong>
        </p>
      )}

      <form className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm" onSubmit={submit}>
        <section className="grid gap-3 md:grid-cols-2">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 md:col-span-2">Basic</h2>
          <label className="text-sm font-medium text-zinc-700">
            Name
            <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Slug{!isEdit && " (optional)"}
            <input
              className="input mt-1"
              disabled={isEdit}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="auto from name"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Type
            <select className="input mt-1" value={form.type} onChange={(e) => setType(e.target.value as TenantType)}>
              {TENANT_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Product mode
            <select
              className="input mt-1"
              value={form.productMode}
              disabled={form.type === "INDIVIDUAL"}
              onChange={(e) => setForm({ ...form, productMode: e.target.value as ProductMode })}
            >
              {PRODUCT_MODES.map((item) => (
                <option key={item} value={item} disabled={form.type === "INDIVIDUAL" && item !== "LMS"}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {form.type === "INDIVIDUAL" && (
            <p className="text-xs text-amber-700 md:col-span-2">Individual tenants are forced to LMS only.</p>
          )}
          <label className="text-sm font-medium text-zinc-700">
            Distribution
            <select
              className="input mt-1"
              value={form.distributionModel}
              onChange={(e) => setForm({ ...form, distributionModel: e.target.value as DistributionModel })}
            >
              {DISTRIBUTION_MODELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Reseller
            <select className="input mt-1" value={form.resellerId} onChange={(e) => setForm({ ...form, resellerId: e.target.value })}>
              <option value="">None (SaaS CMS LMS)</option>
              {resellers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 md:col-span-2">Branding</h2>
          <label className="text-sm font-medium text-zinc-700">
            Primary color
            <input className="input mt-1" type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Logo text
            <input className="input mt-1" value={form.logoText} onChange={(e) => setForm({ ...form, logoText: e.target.value })} />
          </label>
          <label className="text-sm font-medium text-zinc-700 md:col-span-2">
            Custom domain (placeholder)
            <input
              className="input mt-1"
              value={form.customDomain}
              onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
              placeholder="school.example.com"
            />
          </label>
        </section>

        {!isEdit && (
          <section className="grid gap-3 md:grid-cols-2">
            <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700 md:col-span-2">
              Initial institution admin (optional)
            </h2>
            <label className="text-sm font-medium text-zinc-700">
              Admin email
              <input className="input mt-1" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Admin password
              <input
                className="input mt-1"
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                placeholder="defaults to ChangeMe123!"
              />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              First name
              <input className="input mt-1" value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Last name
              <input className="input mt-1" value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} />
            </label>
          </section>
        )}

        <div className="flex gap-2">
          <button className={opsBtnPrimary} type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create tenant"}
          </button>
          <Link className={opsBtnSecondary} to={isEdit && id ? `/admin/tenants/${id}` : "/admin/tenants"}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
