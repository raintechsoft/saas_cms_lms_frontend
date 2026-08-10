import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  InfoOutlined,
  SaveOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type SettingsPayload = {
  liveClassAutoAttendance: boolean;
};

type LiveClassIntegration = {
  category: string;
  provider: string | null;
  isEnabled: boolean;
  hasSecrets: boolean;
};

type ErpSetupLite = {
  integrations: LiveClassIntegration[];
};

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-primary" : "bg-[#D1D5DB]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function OnlineClassLivePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Online Class & Live Sessions";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [autoAttendance, setAutoAttendance] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [hasSecrets, setHasSecrets] = useState(false);
  const [sdkKey, setSdkKey] = useState("");
  const [showSdkKey, setShowSdkKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [settings, erp] = await Promise.all([
          apiRequest<SettingsPayload>("/settings", accessToken),
          apiRequest<ErpSetupLite>("/erp/setup", accessToken).catch(() => ({
            integrations: [] as LiveClassIntegration[],
          })),
        ]);
        if (cancelled) return;
        setAutoAttendance(Boolean(settings.liveClassAutoAttendance));
        const live = erp.integrations.find((item) => item.category === "LIVE_CLASS");
        setZoomEnabled(Boolean(live?.isEnabled));
        setHasSecrets(Boolean(live?.hasSecrets));
        setSdkKey("");
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load live class settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;

    if (zoomEnabled && !hasSecrets && !sdkKey.trim()) {
      notifyError("Enter your Zoom SDK key to enable live sessions.");
      return;
    }

    setSaving(true);
    try {
      const integrationBody: {
        provider: string;
        isEnabled: boolean;
        config: Record<string, unknown>;
        secrets?: { sdkKey: string };
      } = {
        provider: "zoom",
        isEnabled: zoomEnabled,
        config: {},
      };
      if (sdkKey.trim()) {
        integrationBody.secrets = { sdkKey: sdkKey.trim() };
      }

      await Promise.all([
        apiRequest("/settings", accessToken, {
          method: "PUT",
          body: JSON.stringify({ liveClassAutoAttendance: autoAttendance }),
        }),
        apiRequest("/erp/integrations/LIVE_CLASS", accessToken, {
          method: "PUT",
          body: JSON.stringify(integrationBody),
        }),
      ]);

      if (sdkKey.trim()) {
        setHasSecrets(true);
        setSdkKey("");
      }
      notifySuccess("Online class settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save online class settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]" onSubmit={save}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Online Class & Live Sessions
          </h1>
          {loading ? <p className="mt-1 text-sm text-[#6B7280]">Loading…</p> : null}
        </div>

        <div className="space-y-4">
          <Card>
            <ToggleRow
              label="Auto-mark Attendance"
              description="Automatically mark attendance when students join the online class."
              checked={autoAttendance}
              disabled={!canManage || saving}
              onChange={() => setAutoAttendance((value) => !value)}
            />
            <ToggleRow
              label="Zoom SDK Key"
              description="Enter your Zoom SDK key to enable live sessions integration."
              checked={zoomEnabled}
              disabled={!canManage || saving}
              onChange={() => setZoomEnabled((value) => !value)}
            />

            {zoomEnabled ? (
              <label className="mt-4 block max-w-xl">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                  SDK Key <span className="text-rose-500">*</span>
                </span>
                <div className="relative">
                  <input
                    className="nx-input w-full pr-10"
                    type={showSdkKey ? "text" : "password"}
                    value={sdkKey}
                    placeholder={hasSecrets ? "••••••••••••••••" : "Enter Zoom SDK key"}
                    disabled={!canManage || saving}
                    onChange={(e) => setSdkKey(e.target.value)}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-[#6B7280] hover:text-[#1A1A1A]"
                    onClick={() => setShowSdkKey((value) => !value)}
                    aria-label={showSdkKey ? "Hide SDK key" : "Show SDK key"}
                  >
                    {showSdkKey ? (
                      <VisibilityOffOutlined sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityOutlined sx={{ fontSize: 18 }} />
                    )}
                  </button>
                </div>
                <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                  Your Zoom SDK key is encrypted and secure.
                  {hasSecrets ? " Leave blank to keep the current key." : ""}
                </span>
              </label>
            ) : null}
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <InfoOutlined sx={{ fontSize: 18 }} className="text-primary" />
              About Online Class & Live Sessions
            </div>
            <p className="text-[#374151]">
              These settings help you manage and integrate live classes seamlessly.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B5563]">
              <li>Auto-mark attendance ensures accurate tracking.</li>
              <li>Zoom SDK integration enables secure live sessions.</li>
              <li>Ensure your Zoom account has SDK enabled.</li>
            </ul>
            <p className="mt-2 text-[#4B5563]">
              Changes will apply to new and upcoming live sessions.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
