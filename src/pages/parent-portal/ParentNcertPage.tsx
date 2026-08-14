import { useCallback, useEffect, useState } from "react";
import { LinkOutlined, MenuBookOutlined, UploadFileOutlined } from "@mui/icons-material";
import { API_ORIGIN, apiRequest, assetUrl } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type PortalNcertResource = {
  id: string;
  title: string;
  chapter: string | null;
  resourceType: "LINK" | "FILE";
  resourceUrl: string | null;
  fileName: string | null;
  subject: { id: string; name: string } | null;
};

function openUrl(url: string | null) {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return assetUrl(url) || `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export function ParentNcertPage() {
  const { activeChild, portalChild, accessToken } = useParentPortal();
  const studentId = portalChild?.student?.id;
  const [rows, setRows] = useState<PortalNcertResource[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken || !studentId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<PortalNcertResource[]>(
        `/portal/children/${studentId}/ncert-content`,
        accessToken,
      );
      setRows(data ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load NCERT content");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="NCERT Content"
        subtitle={`Published study links and files for ${activeChild.name}.`}
      />

      <section
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Resources</h2>
        </div>
        {loading ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#6B7280]">
            No published NCERT resources for this class yet.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: PARENT_BORDER }}>
            {rows.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span
                  className="grid size-10 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                >
                  {item.resourceType === "FILE" ? (
                    <UploadFileOutlined sx={{ fontSize: 20 }} />
                  ) : item.resourceType === "LINK" ? (
                    <LinkOutlined sx={{ fontSize: 20 }} />
                  ) : (
                    <MenuBookOutlined sx={{ fontSize: 20 }} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[#1A1A2E]">{item.title}</p>
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
                    className="rounded-xl px-3 py-2 text-[12px] font-semibold text-white"
                    style={{ background: PARENT_PRIMARY }}
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
