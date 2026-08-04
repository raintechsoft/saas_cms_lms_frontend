import { useState, type FormEvent } from "react";
import { CloseOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import { staffName, type Staff } from "./types";

const today = new Date().toISOString().slice(0, 10);

export function DisableStaffModal({
  member,
  token,
  onClose,
  onSaved,
  onError,
}: {
  member: Staff;
  token: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [disabledReason, setDisabledReason] = useState("");
  const [leavingDate, setLeavingDate] = useState(today);
  const [resignationLetter, setResignationLetter] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabledReason.trim()) {
      onError("Disabled reason is required");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(`/hr/staff/${member.id}/status`, token, {
        method: "PUT",
        body: JSON.stringify({
          status: "DISABLED",
          disabledReason: disabledReason.trim(),
          leavingDate: leavingDate || null,
          resignationLetter: resignationLetter.trim() || null,
        }),
      });
      notifySuccess(`${staffName(member)} disabled`);
      await onSaved();
      onClose();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to disable staff");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-[16px] font-bold text-slate-900">Disable {staffName(member)}</h3>
          <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
        <form className="space-y-3 px-5 py-4" onSubmit={submit}>
          <label className="block">
            <span className="nx-label">Reason for disabling *</span>
            <textarea
              className="nx-input mt-1 w-full"
              rows={3}
              required
              maxLength={1000}
              placeholder="e.g. Resigned, contract ended, terminated…"
              value={disabledReason}
              onChange={(e) => setDisabledReason(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="nx-label">Leaving date</span>
            <input
              className="nx-input mt-1 w-full"
              type="date"
              value={leavingDate}
              onChange={(e) => setLeavingDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="nx-label">Resignation letter / notes</span>
            <textarea
              className="nx-input mt-1 w-full"
              rows={2}
              maxLength={5000}
              placeholder="Optional reference or summary"
              value={resignationLetter}
              onChange={(e) => setResignationLetter(e.target.value)}
            />
          </label>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            Disabled staff lose portal access but their records are retained.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="nx-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="nx-btn-primary !bg-rose-600 hover:!bg-rose-700" disabled={busy}>
              {busy ? "Disabling…" : "Disable staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
