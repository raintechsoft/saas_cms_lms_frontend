import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { VideocamOutlined } from "@mui/icons-material";
import { isProductBucketAllowed } from "../../lib/productMode";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { usePortal } from "./PortalContext";

type SchedulePhase = "UPCOMING" | "LIVE" | "ENDED" | null;

type PortalLiveClass = {
  id: string;
  title: string;
  topic: string | null;
  meetingUrl: string | null;
  provider: string | null;
  startsAt: string;
  endsAt: string;
  schedulePhase: SchedulePhase;
  subject: { id: string; name: string } | null;
  hostTeacher: { id: string; firstName: string; lastName: string };
};

function formatWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const phaseTone: Record<Exclude<SchedulePhase, null>, string> = {
  LIVE: "bg-[#FEE2E2] text-[#DC2626]",
  UPCOMING: "bg-[#DBEAFE] text-[#2563EB]",
  ENDED: "bg-[#F3F4F6] text-[#6B7280]",
};

export function PortalLiveClassesPage() {
  const { child, basePath, productMode, accessToken } = usePortal();
  const showLms = isProductBucketAllowed(productMode, "LMS");
  const [rows, setRows] = useState<PortalLiveClass[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken || !child?.student?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<PortalLiveClass[]>(
        `/portal/children/${child.student.id}/live-classes`,
        accessToken,
      );
      setRows(data ?? []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Unable to load live classes");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, child?.student?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!showLms) return <Navigate to={basePath} replace />;
  if (!child) return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;

  const live = rows.filter((r) => r.schedulePhase === "LIVE");
  const upcoming = rows.filter((r) => r.schedulePhase === "UPCOMING");
  const ended = rows.filter((r) => r.schedulePhase === "ENDED");

  function SessionList({ items }: { items: PortalLiveClass[] }) {
    if (items.length === 0) {
      return <p className="px-5 py-8 text-center text-[13px] text-[#6B7280]">None right now.</p>;
    }
    return (
      <ul className="divide-y divide-[#E5E7EB]">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <span className="grid size-10 place-items-center rounded-xl bg-[#FEE2E2] text-[#EF4444]">
              <VideocamOutlined sx={{ fontSize: 20 }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[14px] font-bold text-[#1A1A1A]">{item.title}</p>
                {item.schedulePhase ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${phaseTone[item.schedulePhase]}`}
                  >
                    {item.schedulePhase}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                {formatWhen(item.startsAt)}
                {item.subject ? ` · ${item.subject.name}` : ""}
                {` · ${item.hostTeacher.firstName} ${item.hostTeacher.lastName}`}
              </p>
              {item.topic ? <p className="mt-0.5 text-[12px] text-[#9CA3AF]">{item.topic}</p> : null}
            </div>
            {item.meetingUrl && item.schedulePhase !== "ENDED" ? (
              <a
                href={item.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#534AB7] px-3 py-2 text-[12px] font-semibold text-white"
              >
                Join
              </a>
            ) : (
              <span className="text-[11px] font-medium text-[#9CA3AF]">No link</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Live Classes</h1>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          <Link to={basePath} className="hover:text-[#6B7280]">
            Dashboard
          </Link>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-[#6B7280]">Live Classes</span>
        </p>
        <p className="mt-2 text-[12px] text-[#6B7280]">
          Published sessions for your class. Join opens the school’s meeting link.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading…</p>
      ) : (
        <>
          <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]">
            <div className="border-b border-[#E5E7EB] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Live now ({live.length})</h2>
            </div>
            <SessionList items={live} />
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]">
            <div className="border-b border-[#E5E7EB] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Upcoming ({upcoming.length})</h2>
            </div>
            <SessionList items={upcoming} />
          </section>

          {ended.length > 0 ? (
            <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]">
              <div className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Recently ended</h2>
              </div>
              <SessionList items={ended} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
