import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { LinkOutlined, MenuBookOutlined, UploadFileOutlined } from "@mui/icons-material";
import { isProductBucketAllowed } from "../../lib/productMode";
import { API_ORIGIN, apiRequest, assetUrl } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { usePortal } from "./PortalContext";

type PortalNcertResource = {
  id: string;
  title: string;
  description: string | null;
  chapter: string | null;
  resourceType: "LINK" | "FILE";
  resourceUrl: string | null;
  fileName: string | null;
  subject: { id: string; name: string } | null;
  academicClass: { id: string; name: string } | null;
};

function openUrl(url: string | null) {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return assetUrl(url) || `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export function PortalNcertPage() {
  const { child, basePath, productMode, accessToken } = usePortal();
  const showLms = isProductBucketAllowed(productMode, "LMS");
  const [rows, setRows] = useState<PortalNcertResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");

  const load = useCallback(async () => {
    if (!accessToken || !child?.student?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<PortalNcertResource[]>(
        `/portal/children/${child.student.id}/ncert-content`,
        accessToken,
      );
      setRows(data ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load NCERT content");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, child?.student?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.subject) map.set(row.subject.id, row.subject.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!subjectFilter) return rows;
    return rows.filter((row) => row.subject?.id === subjectFilter);
  }, [rows, subjectFilter]);

  if (!showLms) return <Navigate to={basePath} replace />;
  if (!child) return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">NCERT Content</h1>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          <Link to={basePath} className="hover:text-[#6B7280]">
            Dashboard
          </Link>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-[#6B7280]">NCERT Content</span>
        </p>
        <p className="mt-2 text-[12px] text-[#6B7280]">
          Published study links and files for your class.
        </p>
      </div>

      {subjects.length > 1 ? (
        <label className="block max-w-xs">
          <span className="mb-1 block text-[11px] font-semibold text-[#6B7280]">Subject</span>
          <select
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[13px] font-semibold"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]">
        {loading ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">
            No published NCERT resources for your class yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {filtered.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className="grid size-10 place-items-center rounded-xl bg-[#D1FAE5] text-[#059669]">
                  {item.resourceType === "FILE" ? (
                    <UploadFileOutlined sx={{ fontSize: 20 }} />
                  ) : item.resourceType === "LINK" ? (
                    <LinkOutlined sx={{ fontSize: 20 }} />
                  ) : (
                    <MenuBookOutlined sx={{ fontSize: 20 }} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[#1A1A1A]">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    {[item.chapter, item.subject?.name].filter(Boolean).join(" · ") || "Study material"}
                  </p>
                </div>
                {item.resourceUrl ? (
                  <a
                    href={openUrl(item.resourceUrl)}
                    target="_blank"
                    rel="noreferrer"
                    {...(item.resourceType === "FILE"
                      ? { download: item.fileName || true }
                      : {})}
                    className="rounded-xl bg-[#534AB7] px-3 py-2 text-[12px] font-semibold text-white"
                  >
                    {item.resourceType === "FILE" ? "Download" : "Open"}
                  </a>
                ) : (
                  <span className="text-[11px] font-medium text-[#9CA3AF]">No link</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
