import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { usePortal } from "./PortalContext";
import type { PortalAttendanceRecord } from "./portalTypes";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PortalAttendancePage() {
  const { accessToken, child } = usePortal();
  const [records, setRecords] = useState<PortalAttendanceRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<{ records: PortalAttendanceRecord[] }>(
      `/portal/children/${child.student.id}/attendance`,
      accessToken,
    )
      .then((data) => setRecords(data.records))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load attendance");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id]);

  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, total: 0 };
    for (const record of records) {
      counts.total += 1;
      if (record.status === "PRESENT") counts.present += 1;
      if (record.status === "LATE") counts.late += 1;
      if (record.status === "ABSENT") counts.absent += 1;
      if (record.status === "HALF_DAY") counts.halfDay += 1;
      if (record.status === "HOLIDAY") counts.holiday += 1;
    }
    const counted = counts.total - counts.holiday;
    const attended = counts.present + counts.late + counts.halfDay * 0.5;
    const percentage = counted ? Number(((attended / counted) * 100).toFixed(2)) : 0;
    return { ...counts, percentage };
  }, [records]);

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Recent attendance records for {child.student.firstName}.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading attendance…</p>
      ) : (
        <>
          {records.length > 0 && (
            <section className="card p-6">
              <div className="flex items-end gap-3">
                <p className="text-4xl font-semibold">{summary.percentage}%</p>
                <p className="pb-1 text-sm text-slate-500">present (recent period)</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Present" value={summary.present} />
                <Stat label="Late" value={summary.late} />
                <Stat label="Absent" value={summary.absent} />
                <Stat label="Half day" value={summary.halfDay} />
                <Stat label="Holiday" value={summary.holiday} />
                <Stat label="Marked" value={summary.total} />
              </div>
            </section>
          )}

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 font-semibold">Recent records</div>
            {records.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">No attendance records yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {records.map((record) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm" key={record.id}>
                    <div>
                      <p className="font-medium">{formatDate(record.date)}</p>
                      {record.note && <p className="text-xs text-slate-500">{record.note}</p>}
                    </div>
                    <span className={`badge ${statusBadge(record.status)}`}>{record.status.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "PRESENT") return "badge-success";
  if (status === "ABSENT") return "badge-danger";
  return "";
}
