import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DescriptionOutlined,
  DownloadOutlined,
  InfoOutlined,
  LayersOutlined,
  LockOutlined,
  SearchOutlined,
  VerifiedUserOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type SystemField = {
  id: string;
  index: number;
  key: string;
  name: string;
  module: string;
  target: string;
  fieldType: string;
  required: boolean;
  unique: boolean;
  status: "ACTIVE" | "INACTIVE";
  description: string;
  readOnly: boolean;
  inUse: boolean;
};

type Setup = {
  fields: SystemField[];
  modules: string[];
  fieldTypes: string[];
  stats: {
    total: number;
    inUse: number;
    required: number;
    readOnly: number;
  };
};

const PAGE_SIZE = 10;

const inputClass =
  "rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function YesNoBadge({ value }: { value: boolean }) {
  if (!value) return <span className="text-sm text-[#6B7280]">No</span>;
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      Yes
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
        <p className="text-xs text-[#9CA3AF]">{hint}</p>
      </div>
    </div>
  );
}

export function SystemFieldsPage() {
  const { accessToken } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "System Fields";

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/system-fields", accessToken);
      setSetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load system fields");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filtered = useMemo(() => {
    const fields = setup?.fields ?? [];
    const q = search.trim().toLowerCase();
    return fields.filter((item) => {
      if (moduleFilter !== "ALL" && item.module !== moduleFilter) return false;
      if (typeFilter !== "ALL" && item.fieldType !== typeFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.module.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [setup, moduleFilter, typeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [moduleFilter, typeFilter, search]);

  function exportCsv() {
    const rows = filtered.length ? filtered : setup?.fields ?? [];
    if (!rows.length) {
      notifyError("No system fields to export");
      return;
    }
    const header = [
      "Field Name",
      "Key",
      "Module",
      "Field Type",
      "Required",
      "Unique",
      "Status",
      "Description",
    ];
    const lines = [
      header.join(","),
      ...rows.map((item) =>
        [
          item.name,
          item.key,
          item.module,
          item.fieldType,
          item.required ? "Yes" : "No",
          item.unique ? "Yes" : "No",
          item.status,
          item.description,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `system-fields-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notifySuccess("System fields exported");
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading system fields…</div>;
  }

  const stats = setup?.stats ?? { total: 0, inUse: 0, required: 0, readOnly: 0 };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">System Fields</h1>
          <p className="max-w-3xl text-xs text-[#6B7280]">
            View and manage predefined system fields used across the system. System fields are
            essential and cannot be deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-[#F5F3FF]"
        >
          <DownloadOutlined className="!text-[18px]" />
          Export System Fields
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total System Fields"
            value={stats.total}
            hint="Across all modules"
            tone="bg-violet-50"
            icon={<LayersOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="In Use"
            value={stats.inUse}
            hint="Fields in active use"
            tone="bg-sky-50"
            icon={<DescriptionOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Required Fields"
            value={stats.required}
            hint="Mandatory in forms"
            tone="bg-emerald-50"
            icon={<VerifiedUserOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Read Only"
            value={stats.readOnly}
            hint="Cannot be modified"
            tone="bg-amber-50"
            icon={<LockOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              className={inputClass}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="ALL">All Modules</option>
              {(setup?.modules ?? []).map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Field Types</option>
              {(setup?.fieldTypes ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <label className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
              <SearchOutlined className="pointer-events-none absolute left-2.5 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
              <input
                className={`${inputClass} w-full pl-9`}
                placeholder="Search system fields..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Field Name</th>
                  <th className="px-3 py-2 font-semibold">Module</th>
                  <th className="px-3 py-2 font-semibold">Field Type</th>
                  <th className="px-3 py-2 font-semibold">Required</th>
                  <th className="px-3 py-2 font-semibold">Unique</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-[#6B7280]">
                      No system fields match your filters.
                    </td>
                  </tr>
                ) : (
                  paged.map((item, index) => (
                    <tr key={item.id} className="border-t border-[#F3F4F6] align-top">
                      <td className="px-3 py-2.5 text-[#6B7280]">
                        {(currentPage - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-[#1A1A1A]">{item.name}</p>
                        <p className="text-[11px] text-[#9CA3AF]">{item.key}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[#374151]">{item.module}</td>
                      <td className="px-3 py-2.5 text-[#374151]">{item.fieldType}</td>
                      <td className="px-3 py-2.5">
                        <YesNoBadge value={item.required} />
                      </td>
                      <td className="px-3 py-2.5">
                        <YesNoBadge value={item.unique} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            item.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          {item.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <p className="max-w-xs text-[#6B7280] line-clamp-2">{item.description}</p>
                          <button
                            type="button"
                            title={item.description}
                            onClick={() =>
                              setOpenInfoId((prev) => (prev === item.id ? null : item.id))
                            }
                            className="mt-0.5 rounded-full border border-[#E5E7EB] p-0.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                          >
                            <InfoOutlined className="!text-[14px]" />
                          </button>
                        </div>
                        {openInfoId === item.id ? (
                          <p className="mt-1 rounded-lg bg-[#F5F3FF] px-2 py-1.5 text-xs text-[#5B21B6]">
                            {item.description}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
            <p>
              Showing {pageStart} to {pageEnd} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
              >
                <ChevronLeftOutlined className="!text-[18px]" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(0, 6)
                .map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={[
                      "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                      num === currentPage
                        ? "bg-primary text-white"
                        : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]",
                    ].join(" ")}
                  >
                    {num}
                  </button>
                ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
              >
                <ChevronRightOutlined className="!text-[18px]" />
              </button>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1E40AF]">
            <InfoOutlined className="!text-[18px]" />
            About System Fields
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#1E3A8A]">
            <li>System fields are predefined by the platform and used across core modules.</li>
            <li>They cannot be deleted because forms, reports, and workflows depend on them.</li>
            <li>Properties such as field name and type cannot be modified.</li>
            <li>Values for these fields are generated or collected automatically by the system.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
