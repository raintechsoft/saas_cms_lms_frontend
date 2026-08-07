import { useEffect, useMemo, useState } from "react";
import { AssignmentOutlined } from "@mui/icons-material";
import { apiRequest } from "../../lib/api";
import type { PortalHomeworkItem } from "../student-parent/portalTypes";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type Filter = "ALL" | "PENDING" | "SUBMITTED" | "OVERDUE";

function deriveStatus(item: PortalHomeworkItem): Filter {
  if (item.submission) return "SUBMITTED";
  if (new Date(item.submissionDate).getTime() < Date.now()) return "OVERDUE";
  return "PENDING";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ParentHomeworkPage() {
  const { activeChild, portalChild, accessToken } = useParentPortal();
  const studentId = portalChild?.student.id;
  const [items, setItems] = useState<PortalHomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    apiRequest<PortalHomeworkItem[]>(`/portal/children/${studentId}/homework`, accessToken)
      .then((data) => {
        setItems(data ?? []);
        setSelectedId(data?.[0]?.id ?? null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load homework");
      })
      .finally(() => setLoading(false));
  }, [accessToken, studentId]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    return items.filter((item) => deriveStatus(item) === filter);
  }, [items, filter]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const tone = (status: Filter): "orange" | "green" | "red" | "blue" => {
    if (status === "SUBMITTED") return "green";
    if (status === "OVERDUE") return "red";
    if (status === "PENDING") return "orange";
    return "blue";
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Homework"
        subtitle={`${activeChild.name} · ${activeChild.className} - ${activeChild.section}`}
      />

      <div className="flex flex-wrap gap-2">
        {(["ALL", "PENDING", "SUBMITTED", "OVERDUE"] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-bold transition"
            style={{
              background: filter === key ? PARENT_PRIMARY : PARENT_PRIMARY_SUBTLE,
              color: filter === key ? "#fff" : PARENT_PRIMARY,
            }}
          >
            {key === "ALL" ? "All" : key[0] + key.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#6B7280]">Loading homework…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <section
            className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-[13px] text-[#6B7280]">
                No homework in this filter.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: PARENT_BORDER }}>
                {filtered.map((item) => {
                  const status = deriveStatus(item);
                  const active = selected?.id === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#F9FAFB]"
                        style={{ background: active ? PARENT_PRIMARY_SUBTLE : undefined }}
                      >
                        <span
                          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl"
                          style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                        >
                          <AssignmentOutlined sx={{ fontSize: 18 }} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[14px] font-bold text-[#1A1A2E]">{item.title}</p>
                            <StatusChip
                              label={status[0] + status.slice(1).toLowerCase()}
                              tone={tone(status)}
                            />
                          </div>
                          <p className="mt-0.5 text-[12px] text-[#6B7280]">
                            {item.subject} · Due {formatDate(item.submissionDate)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside
            className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            {selected ? (
              <>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  {selected.subject}
                </p>
                <h2 className="mt-1 text-[16px] font-extrabold text-[#1A1A2E]">{selected.title}</h2>
                <p className="mt-3 text-[13px] leading-relaxed text-[#4B5563]">{selected.description}</p>
                <dl className="mt-4 space-y-2 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6B7280]">Assigned</dt>
                    <dd className="font-semibold text-[#1A1A2E]">{formatDate(selected.homeworkDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6B7280]">Due</dt>
                    <dd className="font-semibold text-[#1A1A2E]">{formatDate(selected.submissionDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#6B7280]">Status</dt>
                    <dd className="font-semibold text-[#1A1A2E]">
                      {deriveStatus(selected)[0] + deriveStatus(selected).slice(1).toLowerCase()}
                    </dd>
                  </div>
                </dl>
                {selected.attachmentUrl && (
                  <a
                    href={selected.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-[13px] font-bold text-[#4F46E5] hover:underline"
                  >
                    Open attachment
                  </a>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[#6B7280]">Select a homework item to view details.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
