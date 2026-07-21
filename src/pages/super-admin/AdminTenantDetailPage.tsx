import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPanel, opsBtnSecondary, opsLinkMuted } from "./platformUi";
import type { TenantDetail } from "./types";

type Tab = "overview" | "users" | "settings" | "activity";

export function AdminTenantDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiRequest<TenantDetail>(`/platform/tenants/${id}`, accessToken)
      .then(setTenant)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load tenant"));
  }, [id, accessToken]);

  if (error) return <p className="alert-error">{error}</p>;
  if (!tenant) return <p className="text-sm text-zinc-500">Loading tenant…</p>;

  const branding = (tenant.branding ?? {}) as Record<string, unknown>;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "settings", label: "Settings" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className={opsLinkMuted} to="/admin/tenants">
            ← Tenants
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">{tenant.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            /{tenant.slug} · {tenant.type} · {tenant.productMode}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={tenant.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{tenant.status}</span>
          <Link className={opsBtnSecondary} to={`/admin/tenants/${tenant.id}/edit`}>
            Edit
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              tab === item.id ? "bg-zinc-950 text-amber-400" : "text-zinc-600 hover:bg-zinc-100"
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <OpsPanel title="Institution" code="OVW">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-zinc-500">Distribution</dt>
                  <dd>{tenant.distributionModel}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Reseller</dt>
                  <dd>{tenant.reseller?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Users</dt>
                  <dd>{tenant.users}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Students</dt>
                  <dd>{tenant.students}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Created</dt>
                  <dd>{new Date(tenant.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Updated</dt>
                  <dd>{tenant.updatedAt ? new Date(tenant.updatedAt).toLocaleString() : "—"}</dd>
                </div>
              </dl>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Campus login for this school</p>
                <p className="mt-1">
                  Workspace slug: <code className="rounded bg-white px-1.5 py-0.5">{tenant.slug}</code>
                </p>
                <p className="mt-1 text-amber-900">
                  Use an admin email from the Users tab + that slug on{" "}
                  <code className="rounded bg-white px-1.5 py-0.5">/login</code> (Institution Admin). Default password if
                  you left it blank when creating: <code className="rounded bg-white px-1.5 py-0.5">ChangeMe123!</code>
                </p>
              </div>
            </OpsPanel>
          </div>
          <OpsPanel title="Branding" code="BRD">
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-md border border-zinc-200"
                style={{ background: String(branding.primaryColor ?? "#0f766e") }}
              />
              <div className="text-sm">
                <p className="font-semibold text-zinc-900">{String(branding.logoText ?? tenant.name)}</p>
                <p className="text-zinc-500">{String(branding.customDomain ?? "No custom domain")}</p>
              </div>
            </div>
          </OpsPanel>
        </div>
      )}

      {tab === "users" && (
        <OpsPanel title="Recent users" code="USR">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-3 pr-3">Name</th>
                  <th className="pb-3 pr-3">Email</th>
                  <th className="pb-3 pr-3">Roles</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tenant.recentUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 pr-3">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="py-3 pr-3">{user.email}</td>
                    <td className="py-3 pr-3">{user.roles.join(", ") || "—"}</td>
                    <td className="py-3">
                      <span className={user.status === "ACTIVE" ? "badge-success" : "badge-danger"}>{user.status}</span>
                    </td>
                  </tr>
                ))}
                {tenant.recentUsers.length === 0 && (
                  <tr>
                    <td className="py-8 text-zinc-400" colSpan={4}>
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>
      )}

      {tab === "settings" && (
        <OpsPanel title="Campus settings snapshot" code="SET">
          {tenant.settingsSummary ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Currency</dt>
                <dd>{tenant.settingsSummary.currency}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Attendance</dt>
                <dd>{tenant.settingsSummary.attendanceType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Exam results</dt>
                <dd>{tenant.settingsSummary.examResultType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Auto admission #</dt>
                <dd>{tenant.settingsSummary.autoAdmissionNumber ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Online admission</dt>
                <dd>{tenant.settingsSummary.onlineAdmission ? "Yes" : "No"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-zinc-500">No tenant settings configured yet.</p>
          )}
        </OpsPanel>
      )}

      {tab === "activity" && (
        <OpsPanel title="Recent activity" code="ACT">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-3 pr-3">When</th>
                  <th className="pb-3 pr-3">Action</th>
                  <th className="pb-3 pr-3">Actor</th>
                  <th className="pb-3">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tenant.activity.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap py-3 pr-3">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="py-3 pr-3">{row.action}</td>
                    <td className="py-3 pr-3">{row.actor ?? "—"}</td>
                    <td className="py-3">{row.entityType}</td>
                  </tr>
                ))}
                {tenant.activity.length === 0 && (
                  <tr>
                    <td className="py-8 text-zinc-400" colSpan={4}>
                      No recent activity.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </OpsPanel>
      )}
    </div>
  );
}
