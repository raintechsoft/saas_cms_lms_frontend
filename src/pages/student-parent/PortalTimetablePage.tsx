import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import { PORTAL_WEEKDAYS, type PortalTimetableItem } from "./portalTypes";

export function PortalTimetablePage() {
  const { accessToken, child, productMode, basePath } = usePortal();
  const [entries, setEntries] = useState<PortalTimetableItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const showLms = isProductBucketAllowed(productMode, "LMS");

  useEffect(() => {
    if (!showLms || !child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<PortalTimetableItem[]>(`/portal/children/${child.student.id}/timetable`, accessToken)
      .then(setEntries)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load timetable");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id, showLms]);

  if (!showLms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  const activeDays = PORTAL_WEEKDAYS.filter((day) => entries.some((entry) => entry.weekday === day));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Timetable</h1>
        <p className="mt-1 text-sm text-slate-500">Weekly class schedule.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading timetable…</p>
      ) : entries.length === 0 ? (
        <section className="card p-6">
          <p className="text-sm text-slate-500">No timetable published yet.</p>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDays.map((day) => (
            <section className="card overflow-hidden" key={day}>
              <div className="border-b border-slate-100 px-5 py-3 font-semibold">
                {day[0]}
                {day.slice(1).toLowerCase()}
              </div>
              <div className="space-y-2 p-4">
                {entries
                  .filter((entry) => entry.weekday === day)
                  .map((entry) => (
                    <div className="rounded-lg bg-slate-50 p-3 text-sm" key={entry.id}>
                      <p className="font-medium">
                        {entry.startTime}–{entry.endTime} · {entry.subject}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.teacher ?? "No teacher"}
                        {entry.room ? ` · ${entry.room}` : ""}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
