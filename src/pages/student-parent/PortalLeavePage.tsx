import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api";
import { usePortal } from "./PortalContext";
import type { PortalLeave } from "./portalTypes";

const today = new Date().toISOString().slice(0, 10);

export function PortalLeavePage() {
  const { accessToken, child, role } = usePortal();
  const [leaves, setLeaves] = useState<PortalLeave[]>([]);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!child) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      setLeaves(await apiRequest<PortalLeave[]>(`/portal/children/${child.student.id}/leaves`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken, child?.student.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!child) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/portal/children/${child.student.id}/leaves`, accessToken, {
        method: "POST",
        body: JSON.stringify({ fromDate, toDate, reason }),
      });
      setReason("");
      setMessage("Leave request submitted");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="mt-1 text-sm text-slate-500">
          {role === "PARENT"
            ? `Submit leave for ${child.student.firstName}.`
            : "Request leave for yourself."}
        </p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>
      )}

      <section className="card p-6">
        <h2 className="font-semibold">New leave request</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">From date</span>
            <input className="input" type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">To date</span>
            <input className="input" type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Reason</span>
            <textarea
              className="input"
              required
              minLength={3}
              rows={3}
              placeholder="Reason for leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 font-semibold">Previous requests</div>
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading…</p>
        ) : leaves.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No leave requests yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaves.map((leave) => (
              <div className="px-5 py-4" key={leave.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {new Date(leave.fromDate).toLocaleDateString()} – {new Date(leave.toDate).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{leave.reason}</p>
                    {leave.reviewNote && (
                      <p className="mt-2 text-sm text-indigo-700">Review: {leave.reviewNote}</p>
                    )}
                  </div>
                  <span className={`badge ${leave.status === "APPROVED" ? "badge-success" : leave.status === "REJECTED" ? "badge-danger" : ""}`}>
                    {leave.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
