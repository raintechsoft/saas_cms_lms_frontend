import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { BarChart, DonutChart } from "../../components/charts/PremiumCharts";
import { apiRequest } from "../../lib/api";
import { OpsPanel, opsBtnDark, opsBtnPrimary, opsLinkOnDark } from "./platformUi";
import type { AuditRow, PlatformStats } from "./types";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#f59e0b",
  SUSPENDED: "#ef4444",
  ARCHIVED: "#a1a1aa",
};

const MODE_COLORS: Record<string, string> = {
  CMS: "#2563eb",
  LMS: "#d97706",
  BOTH: "#18181b",
};

function formatLabel(key: string) {
  return key.replaceAll("_", " ");
}

function OpsKpi({
  label,
  value,
  hint,
  accent = "amber",
}: {
  label: string;
  value: number | string;
  hint: string;
  accent?: "amber" | "zinc" | "red" | "blue";
}) {
  const bar =
    accent === "amber"
      ? "bg-amber-500"
      : accent === "red"
        ? "bg-red-500"
        : accent === "blue"
          ? "bg-blue-600"
          : "bg-zinc-800";
  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="pl-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 pl-2 text-3xl font-semibold tracking-tight text-zinc-950">{value}</p>
      <p className="mt-1 pl-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export function AdminDashboardPage() {
  const { accessToken, user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest<PlatformStats>("/platform/stats", accessToken),
      apiRequest<AuditRow[]>("/platform/audit?limit=10", accessToken),
    ])
      .then(([nextStats, nextAudit]) => {
        setStats(nextStats);
        setAudit(nextAudit);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load dashboard"));
  }, [accessToken]);

  const statusSlices = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.tenantsByStatus).map(([label, value]) => ({
      label: formatLabel(label),
      value,
      color: STATUS_COLORS[label] ?? "#71717a",
    }));
  }, [stats]);

  const modeSlices = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.tenantsByProductMode).map(([label, value]) => ({
      label,
      value,
      color: MODE_COLORS[label] ?? "#71717a",
    }));
  }, [stats]);

  const typeCategories = useMemo(() => {
    if (!stats) return { categories: [] as string[], values: [] as number[] };
    const entries = Object.entries(stats.tenantsByType);
    return {
      categories: entries.map(([key]) => formatLabel(key)),
      values: entries.map(([, value]) => value),
    };
  }, [stats]);

  if (error) return <p className="alert-error">{error}</p>;
  if (!stats) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
        Loading ops metrics…
      </div>
    );
  }

  const activePct =
    stats.totals.tenants > 0
      ? Math.round((stats.totals.activeTenants / stats.totals.tenants) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Command hero — distinct from campus welcome cards */}
      <section className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-white shadow-xl shadow-zinc-900/20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{
          backgroundImage:
            "linear-gradient(#f59e0b 1px, transparent 1px), linear-gradient(90deg, #f59e0b 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
        <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-amber-400">
              Command center // {new Date().toISOString().slice(0, 10)}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Platform network status
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Operator view for {user?.firstName ?? "admin"}. Campus portals use a school panel UI —
              this console is for platform-wide tenant, reseller, and audit control.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/tenants/new" className={opsBtnPrimary}>
              Provision tenant
            </Link>
            <Link to="/admin/audit" className={opsBtnDark}>
              Open audit log
            </Link>
          </div>
        </div>
        <div className="relative grid grid-cols-2 border-t border-zinc-800 sm:grid-cols-4">
          {[
            { label: "Fleet health", value: `${activePct}%` },
            { label: "Live tenants", value: stats.totals.activeTenants },
            { label: "Network users", value: stats.totals.users },
            { label: "Students served", value: stats.totals.students },
          ].map((item) => (
            <div key={item.label} className="border-zinc-800 px-5 py-4 sm:border-r sm:last:border-r-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <OpsKpi label="Tenants" value={stats.totals.tenants} hint="All institutions" accent="amber" />
        <OpsKpi label="Active" value={stats.totals.activeTenants} hint="Online workspaces" accent="amber" />
        <OpsKpi label="Suspended" value={stats.totals.suspendedTenants} hint="Access blocked" accent="red" />
        <OpsKpi label="Resellers" value={stats.totals.resellers} hint="Channel partners" accent="zinc" />
        <OpsKpi label="Users" value={stats.totals.users} hint="All accounts" accent="blue" />
        <OpsKpi label="Students" value={stats.totals.students} hint="Across tenants" accent="zinc" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <OpsPanel title="Tenant fleet health" code="GRAPH.01">
          {statusSlices.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No status data.</p>
          ) : (
            <DonutChart
              size={270}
              slices={statusSlices}
              centerValue={`${activePct}%`}
              centerLabel="Active"
            />
          )}
        </OpsPanel>

        <OpsPanel title="Entitlement mix" code="GRAPH.02">
          {modeSlices.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No mode data.</p>
          ) : (
            <DonutChart
              size={270}
              slices={modeSlices}
              centerValue={String(stats.totals.tenants)}
              centerLabel="Total"
            />
          )}
        </OpsPanel>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <OpsPanel title="Institution typology" code="GRAPH.03">
            {typeCategories.categories.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">No type data.</p>
            ) : (
              <BarChart
                categories={typeCategories.categories}
                series={[{ label: "Tenants", color: "#f59e0b", values: typeCategories.values }]}
              />
            )}
          </OpsPanel>
        </div>

        <div className="lg:col-span-2">
          <OpsPanel
            title="Operator shortcuts"
            code="NAV.01"
            action={
              <span className="font-mono text-[10px] text-zinc-500">6 routes</span>
            }
          >
            <div className="space-y-2">
              {[
                { to: "/admin/tenants", label: "Tenant registry", code: "02" },
                { to: "/admin/resellers", label: "Reseller network", code: "03" },
                { to: "/admin/users", label: "Identity directory", code: "04" },
                { to: "/admin/audit", label: "Security timeline", code: "05" },
                { to: "/admin/settings", label: "Platform defaults", code: "06" },
                { to: "/admin/tenants/new", label: "Provision workspace", code: "++" },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <span className="text-sm font-semibold text-zinc-800">{item.label}</span>
                  <span className="font-mono text-[10px] font-bold text-amber-700">{item.code}</span>
                </Link>
              ))}
            </div>
          </OpsPanel>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <OpsPanel
          title="Recent fleet changes"
          code="TENANTS"
          action={
            <Link className={opsLinkOnDark} to="/admin/tenants">
              Registry →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-3 pr-3">Tenant</th>
                  <th className="pb-3 pr-3">Mode</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.recentTenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="py-3 pr-3">
                      <Link className="font-semibold text-zinc-900 hover:text-amber-700" to={`/admin/tenants/${tenant.id}`}>
                        {tenant.name}
                      </Link>
                      <p className="font-mono text-[11px] text-zinc-400">/{tenant.slug}</p>
                    </td>
                    <td className="py-3 pr-3 text-zinc-600">{tenant.productMode}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${
                          tenant.status === "ACTIVE"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OpsPanel>

        <OpsPanel
          title="Audit stream"
          code="AUDIT"
          action={
            <Link className={opsLinkOnDark} to="/admin/audit">
              Full log →
            </Link>
          }
        >
          {audit.length === 0 ? (
            <p className="text-sm text-zinc-500">No events yet.</p>
          ) : (
            <ol className="relative space-y-0 border-l border-zinc-200 pl-4">
              {audit.map((row) => (
                <li key={row.id} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2.5 rounded-full border-2 border-white bg-amber-500" />
                  <p className="text-sm font-semibold text-zinc-900">{row.action}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    {row.actor ?? "system"} · {row.tenant ?? "platform"} ·{" "}
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </OpsPanel>
      </div>
    </div>
  );
}
