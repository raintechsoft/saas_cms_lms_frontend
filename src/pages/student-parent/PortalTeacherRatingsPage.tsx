import { useEffect, useState, type FormEvent } from "react";
import { StarOutline, StarRate } from "@mui/icons-material";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { usePortal } from "./PortalContext";

interface PortalTeacher {
  id: string;
  staffId: string;
  name: string;
  subject?: string | null;
  photoUrl?: string | null;
  designation?: string | null;
}

const today = new Date().toISOString().slice(0, 10);

export function PortalTeacherRatingsPage() {
  const { child, accessToken, reload } = usePortal();
  const studentId = child?.student.id ?? "";
  const [teachers, setTeachers] = useState<PortalTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [ratingDate, setRatingDate] = useState(today);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setTeachers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<PortalTeacher[]>(`/portal/children/${studentId}/teachers`, accessToken)
      .then((rows) => {
        setTeachers(rows);
        if (rows.length) setSelectedStaffId(rows[0].staffId);
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof Error ? cause.message : "Unable to load teachers");
        setTeachers([]);
      })
      .finally(() => setLoading(false));
  }, [studentId, accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!studentId || !selectedStaffId) {
      notifyError("Select a teacher first");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/portal/children/${studentId}/teachers/${selectedStaffId}/ratings`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          ratingDate,
        }),
      });
      notifySuccess("Thank you — your rating was submitted");
      setComment("");
      setRating(5);
      await reload();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit rating");
    } finally {
      setBusy(false);
    }
  }

  if (!child) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Select a child above to rate their teachers.
      </p>
    );
  }

  const selected = teachers.find((item) => item.staffId === selectedStaffId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Rate Teachers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Share feedback for {child.student.firstName}&apos;s class teachers.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading teachers…</p>
      ) : !teachers.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-sm text-slate-500">No teachers found for this class yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {teachers.map((teacher) => (
              <li key={teacher.staffId}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    selectedStaffId === teacher.staffId ? "bg-teal-50/80 ring-1 ring-inset ring-teal-200" : ""
                  }`}
                  onClick={() => setSelectedStaffId(teacher.staffId)}
                >
                  <InitialsAvatar name={teacher.name} photoUrl={teacher.photoUrl} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{teacher.name}</span>
                    <span className="block truncate text-[12.5px] text-slate-500">
                      {teacher.subject ?? teacher.designation ?? "Teacher"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <form
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={submit}
          >
            {selected ? (
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <InitialsAvatar name={selected.name} photoUrl={selected.photoUrl} size={48} />
                <div>
                  <p className="font-bold text-slate-900">{selected.name}</p>
                  <p className="text-[12.5px] text-slate-500">
                    {selected.subject ?? selected.designation ?? "Teacher"}
                  </p>
                </div>
              </div>
            ) : null}

            <label className="mt-4 block">
              <span className="mb-2 block text-[12.5px] font-semibold text-slate-700">Rating</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    title={`${value} star${value === 1 ? "" : "s"}`}
                    className="rounded p-0.5 transition hover:scale-110"
                    onClick={() => setRating(value)}
                  >
                    <StarRate
                      sx={{ fontSize: 32 }}
                      className={value <= rating ? "text-amber-400" : "text-slate-200"}
                    />
                  </button>
                ))}
              </div>
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12.5px] font-semibold text-slate-700">Date</span>
              <input
                className="nx-input w-full"
                type="date"
                value={ratingDate}
                max={today}
                onChange={(e) => setRatingDate(e.target.value)}
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[12.5px] font-semibold text-slate-700">
                Comment (optional)
              </span>
              <textarea
                className="nx-input w-full"
                rows={4}
                maxLength={1000}
                placeholder="What went well? Any suggestions?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>

            <button type="submit" className="nx-btn-primary mt-4 w-full" disabled={busy}>
              {busy ? "Submitting…" : "Submit rating"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
