import { useEffect, useState } from "react";
import {
  enableBrowserPush,
  getPortalPushChoice,
  getPushPermission,
  isPushSupported,
  setPortalPushChoice,
  ensureBrowserPushSubscribed,
} from "../../lib/push";

export function PortalPushPrompt({
  accessToken,
  userId,
}: {
  accessToken: string;
  userId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || !userId) return;
    if (!isPushSupported()) return;

    const choice = getPortalPushChoice(userId);
    const permission = getPushPermission();

    if (permission === "granted") {
      void ensureBrowserPushSubscribed(accessToken)
        .then((ok) => {
          if (ok) setPortalPushChoice(userId, "enabled");
        })
        .catch(() => undefined);
      return;
    }

    if (permission === "denied") return;
    if (choice === "dismissed" || choice === "enabled") return;

    setVisible(true);
  }, [accessToken, userId]);

  if (!visible) return null;

  async function onAllow() {
    setBusy(true);
    setError("");
    try {
      await enableBrowserPush(accessToken);
      setPortalPushChoice(userId, "enabled");
      setVisible(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to enable notifications");
    } finally {
      setBusy(false);
    }
  }

  function onNotNow() {
    setPortalPushChoice(userId, "dismissed");
    setVisible(false);
  }

  return (
    <div className="mb-6 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">Notifications</p>
          <h2 className="mt-1 text-[15px] font-bold text-slate-900">Allow browser notifications?</h2>
          <p className="mt-1 text-[13px] text-slate-600">
            Get fee reminders, notices, and important school updates even when this page is closed.
          </p>
          {busy ? (
            <p className="mt-2 text-[12px] font-medium text-teal-700">
              Look for the browser permission popup (usually near the address bar) and click Allow.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-[12px] font-medium text-rose-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 disabled:opacity-60"
            disabled={busy}
            onClick={() => void onAllow()}
          >
            {busy ? "Enabling…" : "Allow"}
          </button>
          <button
            type="button"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={onNotNow}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
